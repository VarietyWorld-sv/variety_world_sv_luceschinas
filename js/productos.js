document.addEventListener('DOMContentLoaded', () => {
    iniciarSistemaProductos();
});

function iniciarSistemaProductos() {
    const SUPABASE_URL = 'https://fpmsddnonhiqxnsydfpz.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZwbXNkZG5vbmhpcXhuc3lkZnB6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5MTE4NTAsImV4cCI6MjA3ODQ4Nzg1MH0.Lj3q5iOHpGzBhwul1yPx4jxoSB9u-blu5EYJ6lsftXY';
    
    if (typeof supabase === 'undefined') return;
    const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    let inventarioGlobal = [];
    let productoSeleccionado = null;
    let listaMedios = [];
    let indiceMediaActual = 0;

    const inputManual = document.getElementById('inputCantidad');
    if (inputManual) {
        inputManual.removeAttribute('readonly');
        inputManual.addEventListener('input', (e) => validarInput(e));
        inputManual.addEventListener('change', (e) => validarInput(e, true));
    }

    function validarInput(e, esChange = false) {
        if (!productoSeleccionado) return 1;

        let val = parseInt(e.target.value);
        
        const stockMax = productoSeleccionado.stockVisual ?? productoSeleccionado.stock; 

        if (isNaN(val) || val < 1) val = 1;
        if (val > stockMax) { 
            if (esChange) alert(`Solo hay ${stockMax} disponibles.`); 
            val = stockMax; 
        }
        
        const limiteGeneral = 50; 
        if (val > limiteGeneral) { 
            if (esChange) alert(`Máximo ${limiteGeneral} unidades.`); 
            val = limiteGeneral; 
        }
        
        if (e.target.id !== 'inputCantidad') {
            actualizarPrecioTotal(val);
        }

        return val; 
    }

    function actualizarPrecioTotal(cantidad) {
        if (!productoSeleccionado) return;
        let precio = Number(productoSeleccionado.precio_unitario ?? 0);
        const span = document.getElementById('precioTotalCalculado');
        if (span) span.innerText = `$${(precio * cantidad).toFixed(2)}`;
    }

    function convertirUrlImagen(url) {
        if (!url) return 'https://via.placeholder.com/300x220?text=Sin+Foto';
        
        if (url.includes('drive.google.com') || url.includes('docs.google.com')) {
            const idMatch = url.match(/\/d\/(.*?)\/|id=(.*?)(&|$)/);
            const id = idMatch ? (idMatch[1] || idMatch[2]) : null;
            
            if (id) {
                return `https://lh3.googleusercontent.com/d/${id}`;
            }
        }
        return url;
    }
    async function obtenerDatosConCache(clave, fetchFunction, tiempoValidez = 15) {
        const cache = sessionStorage.getItem(clave);
        if (cache) {
            const { datos, timestamp } = JSON.parse(cache);
            if ((new Date().getTime() - timestamp) < (tiempoValidez * 60 * 1000)) {
                return { data: datos, error: null };
            }
        }
        const resultado = await fetchFunction();
        if (!resultado.error && resultado.data) {
            sessionStorage.setItem(clave, JSON.stringify({ datos: resultado.data, timestamp: new Date().getTime() }));
        }
        return resultado;
    }

    async function obtenerProductos() {
        const contenedorMain = document.getElementById('contenedor-principal');
        if (contenedorMain) {
            contenedorMain.innerHTML = `
                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(300px, 1fr)); gap:20px; padding:20px;">
                    <div style="height:400px; background:#1E1E49; border-radius:20px; border:2px solid #5D4037; opacity:0.5;"></div>
                    <div style="height:400px; background:#1E1E49; border-radius:20px; border:2px solid #5D4037; opacity:0.5;"></div>
                    <div style="height:400px; background:#1E1E49; border-radius:20px; border:2px solid #5D4037; opacity:0.5;"></div>
                </div>`;
        }

        try {
            const urlParams = new URLSearchParams(window.location.search);
            const termino = urlParams.get('q');
            let productos = [];

            if (termino) {
                const inputB = document.getElementById('inputBusquedaGlobal');
                if(inputB) inputB.value = termino;
                
                const { data, error } = await sb.from('productos')
                    .select('id_producto, nombre, precio_unitario, imagen_url, stock, categoria, codigo_producto, descripcion, porcentaje_descuento, unidades_por_paquete, video_url')
                    .or(`nombre.ilike.%${termino}%,codigo_producto.ilike.%${termino}%,categoria.ilike.%${termino}%`)
                    .order('id_producto', { ascending: true });
                
                if (error) throw error;
                productos = data;
            } else {
                const fetchCatalogo = async () => {
                    return await sb.from('productos')
                        .select('id_producto, nombre, precio_unitario, imagen_url, stock, categoria, codigo_producto, descripcion, porcentaje_descuento, unidades_por_paquete, video_url')
                        .order('id_producto', { ascending: true });
                };

                const resultado = await obtenerDatosConCache('catalogo_global', fetchCatalogo, 30);
                if (resultado.error) throw resultado.error;
                productos = resultado.data;
            }

            productos.forEach(p => p.stock = Number(p.stock));
            inventarioGlobal = productos;
            
            ajustarStockVisual();

            if (termino) {
                mostrarResultadosBusqueda(productos, termino);
            } else {
                generarVistaDinamica(inventarioGlobal);
            }

        } catch (error) { console.error(error); }
    }

    function generarVistaDinamica(productos) {
        const sidebar = document.getElementById('lista-categorias-dinamica');
        const contenedorMain = document.getElementById('contenedor-principal');
        
        if (!sidebar || !contenedorMain) return;

        sidebar.innerHTML = '';
        contenedorMain.innerHTML = '';

        const categoriasUnicas = [...new Set(productos.map(p => p.categoria))].filter(c => c).sort();

        categoriasUnicas.forEach(cat => {
            const divLink = document.createElement('div');
            divLink.className = 'category';
            divLink.innerHTML = `<a href="#" onclick="window.filtrarPorCategoria('${cat}', event)"><h3>${cat}</h3></a>`;
            sidebar.appendChild(divLink);

            const seccion = document.createElement('div');
            seccion.className = 'seccionProductos';
            seccion.id = `seccion-${btoa(cat).replace(/=/g, '')}`; 
            seccion.dataset.categoria = cat;

            seccion.innerHTML = `<h2 class="titulos-secciones">${cat}</h2>`;
            
            const prodsDeEstaCategoria = productos.filter(p => p.categoria === cat);
            
            prodsDeEstaCategoria.forEach(p => {
                seccion.innerHTML += crearTarjetaHTML(p);
            });

            contenedorMain.appendChild(seccion);
        });
    }

    window.filtrarPorCategoria = (categoria, event) => {
        if (event) event.preventDefault();
        
        const secciones = document.querySelectorAll('.seccionProductos');
        
        if (categoria === 'todos') {
            secciones.forEach(sec => sec.style.display = 'grid');
        } else {
            secciones.forEach(sec => {
                if (sec.dataset.categoria === categoria) {
                    sec.style.display = 'grid';
                    sec.scrollIntoView({ behavior: 'smooth' });
                } else {
                    sec.style.display = 'none';
                }
            });
        }
    };

    function ajustarStockVisual() {
        const carrito = JSON.parse(localStorage.getItem('carrito_compras')) || [];
        inventarioGlobal.forEach(p => {
            const enCarro = carrito.find(i => i.id === p.id_producto);
            p.stockVisual = enCarro ? p.stock - enCarro.cantidad : p.stock;
        });
    }

    function mostrarResultadosBusqueda(productos, termino) {
        const main = document.getElementById('contenedor-principal');
        main.innerHTML = `<div class="seccionProductos"><h2 class="titulos-secciones">Resultados para: "${termino}"</h2></div>`;
        
        const contenedor = main.querySelector('.seccionProductos');
        
        if (productos.length === 0) {
            contenedor.innerHTML += `<p style="grid-column:1/-1; text-align:center; color:#fff;">No hay resultados.</p>`;
        } else {
            productos.forEach(p => contenedor.innerHTML += crearTarjetaHTML(p));
        }
    }

    function crearTarjetaHTML(p) {
        const codigoHtml = p.codigo_producto ? `<small style="display:block; color:#666; font-size:0.8em; margin-bottom:1px; font-weight:bold; background-color:transparent;">Cód: ${p.codigo_producto}</small>` : '';
        
        const imagenValida = convertirUrlImagen(p.imagen_url);

        return `
            <div class="cajaProducto">
                <div class="imagenProducto">
                    <img src="${imagenValida}" onerror="this.src='https://via.placeholder.com/300x220?text=Sin+Foto'">
                </div>
                <div class="info-tarjeta">
                    ${codigoHtml}
                    <h3 class="nombreProducto">${p.nombre}</h3>
                    <p class="precioProducto">$${parseFloat(p.precio_unitario).toFixed(2)}</p>
                </div>
                <button class="btn-ver-mas" onclick="abrirModal('${p.id_producto}')">Ver más información</button>
            </div>
        `;
    }

    window.abrirModal = (id) => {
        productoSeleccionado = inventarioGlobal.find(p => p.id_producto == id);
        if (!productoSeleccionado) return;

        document.getElementById('modalNombre').innerText = productoSeleccionado.nombre;
        document.getElementById('modalDescripcion').innerText = productoSeleccionado.descripcion || "Sin descripción.";
        document.getElementById('modalPrecio').innerText = `$${parseFloat(productoSeleccionado.precio_unitario).toFixed(2)}`;
        
        const stockReal = Math.max(0, productoSeleccionado.stockVisual ?? productoSeleccionado.stock);
        document.getElementById('modalStock').innerText = stockReal;
        document.getElementById('modalPaquete').innerText = productoSeleccionado.unidades_por_paquete || 1;
        
        const elCode = document.getElementById('modalCodigo');
        if(elCode) elCode.innerText = productoSeleccionado.codigo_producto ? `Código: ${productoSeleccionado.codigo_producto}` : '';

        const input = document.getElementById('inputCantidad');
        if(input) { input.value = 1; actualizarPrecioTotal(1); }

        listaMedios = [];
        if (productoSeleccionado.video_url && productoSeleccionado.video_url.length > 5) {
            listaMedios.push({ type: 'video', url: productoSeleccionado.video_url });
        }
        
        const imgUrl = convertirUrlImagen(productoSeleccionado.imagen_url);
        listaMedios.push({ type: 'image', url: imgUrl });
        
        indiceMediaActual = 0;
        renderizarMedia();

        document.getElementById('modalProducto').style.display = 'flex';
    };

    window.cerrarModal = () => {
        document.getElementById('modalProducto').style.display = 'none';
        const v = document.querySelector('video'); if(v) v.pause();
    };

    window.renderizarMedia = () => {
        const container = document.getElementById('modalMediaContainer');
        container.innerHTML = '';
        const item = listaMedios[indiceMediaActual];
        
        if (item.type === 'video') {
            if (item.url.includes('youtu')) {
                const id = item.url.split('v=')[1] || item.url.split('/').pop();
                container.innerHTML = `<iframe src="https://www.youtube.com/embed/${id}" style="width:100%; height:100%; border:none;"></iframe>`;
            } else {
                const vid = document.createElement('video');
                vid.src = item.url; vid.controls = true; vid.style.width = '100%';
                container.appendChild(vid);
            }
        } else {
            const img = document.createElement('img');
            img.src = item.url; img.style.width = '100%';
            container.appendChild(img);
        }

        const arrows = listaMedios.length > 1 ? 'flex' : 'none';
        document.getElementById('btnMediaPrev').style.display = arrows;
        document.getElementById('btnMediaNext').style.display = arrows;
    };

    window.cambiarMedia = (dir) => {
        indiceMediaActual += dir;
        if (indiceMediaActual < 0) indiceMediaActual = listaMedios.length - 1;
        if (indiceMediaActual >= listaMedios.length) indiceMediaActual = 0;
        renderizarMedia();
    };

    window.cambiarCantidad = (delta) => {
        const input = document.getElementById('inputCantidad');
        let nuevoValor = parseInt(input.value) + delta;

        const valorValidado = validarInput({ target: { value: nuevoValor } }, true);
        
        if (valorValidado !== null) {
            input.value = valorValidado;
            actualizarPrecioTotal(valorValidado);
        }
    };

    window.agregarAlCarrito = () => {
        if (!productoSeleccionado) return;
        const cant = parseInt(document.getElementById('inputCantidad').value);
        const max = productoSeleccionado.stockVisual ?? productoSeleccionado.stock;

        if (cant > max) return alert("Stock insuficiente.");

        let carrito = JSON.parse(localStorage.getItem('carrito_compras')) || [];
        const existente = carrito.find(i => i.id === productoSeleccionado.id_producto);

        if (existente) existente.cantidad += cant;
        else {
            const imgConvertida = convertirUrlImagen(productoSeleccionado.imagen_url);
            
            carrito.push({
                id: productoSeleccionado.id_producto,
                nombre: productoSeleccionado.nombre,
                precio: parseFloat(productoSeleccionado.precio_unitario),
                imagen: imgConvertida,
                cantidad: cant
            });
        }

        localStorage.setItem('carrito_compras', JSON.stringify(carrito));
        productoSeleccionado.stockVisual -= cant;
        alert(`Has agregado ${cant} unidad(es) de este producto al carrito`);
        cerrarModal();
    };

    window.ordenarProductos = (orden) => {
        let lista = [...inventarioGlobal];
        if (orden === 'asc') lista.sort((a,b) => a.precio_unitario - b.precio_unitario);
        if (orden === 'desc') lista.sort((a,b) => b.precio_unitario - a.precio_unitario);
        generarVistaDinamica(lista);
    };

    obtenerProductos();
}