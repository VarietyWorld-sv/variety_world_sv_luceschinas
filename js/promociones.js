document.addEventListener('DOMContentLoaded', () => {
    iniciarSistema();
});

function iniciarSistema() {
    const SUPABASE_URL = 'https://fpmsddnonhiqxnsydfpz.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZwbXNkZG5vbmhpcXhuc3lkZnB6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5MTE4NTAsImV4cCI6MjA3ODQ4Nzg1MH0.Lj3q5iOHpGzBhwul1yPx4jxoSB9u-blu5EYJ6lsftXY';
    
    if (typeof supabase === 'undefined') return;
    const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    let itemSeleccionado = null;
    let listaMedios = [];
    let indiceMediaActual = 0;

    const inputManual = document.getElementById('inputCantidad');
    if (inputManual) {
        inputManual.removeAttribute('readonly');
        
        inputManual.addEventListener('input', (e) => {
            actualizarInputCantidad(e.target.value);
        });

        inputManual.addEventListener('change', (e) => {
            actualizarInputCantidad(e.target.value, true);
        });
    }

    async function gestionarCargaInicial(sb) {
        try {
            await cargarCombos(sb); 

            const { data: { user } } = await sb.auth.getUser();

            const divBloqueado = document.getElementById('ofertas-bloqueadas');
            const gridOfertas = document.getElementById('grid-ofertas');
            const containerOfertas = document.getElementById('contenedor-ofertas');

            if (user) {
                if (divBloqueado) divBloqueado.style.display = 'none';
                if (containerOfertas) containerOfertas.classList.remove('contenedor-relativo');
                if (gridOfertas) gridOfertas.style.display = 'grid';
                if (typeof gestionarUsuarioLogueado === 'function') gestionarUsuarioLogueado(user.id);

                await cargarLiquidacion(sb);
            } else {
                if (divBloqueado) divBloqueado.style.display = 'flex';
                if (gridOfertas) gridOfertas.style.display = 'none';
            }
        } catch (e) {
            console.error("Error en carga inicial:", e);
            const contenedor = document.getElementById('grid-combos');
            if (contenedor) {
                contenedor.innerHTML = '<p style="grid-column:1/-1; text-align:center; color:#ff4757;">Error al cargar combos.</p>';
            }
        }
    }

    gestionarCargaInicial(sb);

    function validarInput(e, esChange = false) {
        if (!itemSeleccionado) return 1;

        let val = parseInt(e.target.value);
        
        const stockMax = itemSeleccionado.stock; 

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

    function actualizarInputCantidad(valor, esChange = false) {
        if (!itemSeleccionado) return;
        let val = parseInt(valor);
        const stockMax = itemSeleccionado.stock;
        const limite = 50;

        if (isNaN(val) || val < 1) val = 1;
        if (val > stockMax) { if(esChange) alert(`Stock máximo: ${stockMax}`); val = stockMax; }
        if (val > limite) { if(esChange) alert("Máximo 50 unidades."); val = limite; }

        if(esChange) document.getElementById('inputCantidad').value = val;
        actualizarPrecioTotal(val);
    }

    function actualizarPrecioTotal(cantidad) {
        if (!itemSeleccionado) return;
        const precio = parseFloat(itemSeleccionado.precio);
        const total = precio * cantidad;
        const span = document.getElementById('precioTotalCalculado');
        if(span) span.innerText = `$${total.toFixed(2)}`;
    }

    function convertirUrlImagen(url) {
        if (!url || url.trim() === '') return 'https://via.placeholder.com/300x220?text=Sin+Foto';
        
        if (url.includes('drive.google.com') || url.includes('docs.google.com')) {
            const idMatch = url.match(/\/d\/(.*?)\/|id=(.*?)(&|$)/);
            const id = idMatch ? (idMatch[1] || idMatch[2]) : null;
            
            if (id) {
                return `https://drive.google.com/thumbnail?id=${id}&sz=w500`; 
            }
        }
        
        // Dropbox
        if (url.includes('dropbox.com')) {
            return url.replace('dl=0', 'raw=1');
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

    // Funciones para cargar combos y productos en liquidación
    async function cargarCombos(sb) {
        const contenedor = document.getElementById('grid-combos');
        try {
            const { data: combos, error } = await sb
                .from('combos')
                .select(`
                    id_combo,
                    nombre,
                    descripcion,
                    precio,
                    imagen_url,
                    codigo,
                    productos_json,
                    precio_normal_sumado
                `)
                .eq('activo', true);

            if (error) throw error;
            contenedor.innerHTML = '';
            if (!combos || combos.length === 0) { 
                contenedor.innerHTML = '<p style="grid-column:1/-1; text-align:center; color:#fff;">Próximamente nuevos combos.</p>'; 
                return; 
            }
            
            combos.forEach(combo => {
                const precioCombo = parseFloat(combo.precio || 0);
                const precioNormal = parseFloat(combo.precio_normal_sumado || 0); 
                const listaProductos = JSON.parse(combo.productos_json || '[]'); 
                
                const ahorro = precioNormal - precioCombo;
                const pctAhorro = precioNormal > 0 ? ((ahorro / precioNormal) * 100) : 0;
                const cod = combo.codigo ? `Cód: ${combo.codigo}` : 'Combo Especial';
                
                const datos = {
                    tipo: 'combo',
                    id: combo.id_combo,
                    nombre: combo.nombre,
                    precio: precioCombo,
                    imagen: combo.imagen_url,
                    descripcion: combo.descripcion,
                    listaProductos: listaProductos, 
                    ahorro: ahorro,
                    precioNormal: precioNormal, 
                    stock: 999 
                };
                const datosString = encodeURIComponent(JSON.stringify(datos));
                
                const imgUrlConvertida = convertirUrlImagen(datos.imagen);

                contenedor.innerHTML += `
                    <div class="caja-combo-estilo-nuevo">
                        <div class="combo-img-box"><img src="${imgUrlConvertida}" alt="${datos.nombre}" onerror="this.src='https://via.placeholder.com/300'"></div>
                        <div class="combo-info-box">
                            <span class="combo-codigo">${cod}</span>
                            <h3 class="combo-titulo">${datos.nombre}</h3>
                            <div class="combo-precios">
                                <span class="precio-final">$${precioCombo.toFixed(2)}</span>
                                ${precioNormal > precioCombo ? `<span class="precio-tachado">$${precioNormal.toFixed(2)}</span>` : ''}
                            </div>
                            <small class="ahorro-text">¡Ahorras ${pctAhorro.toFixed(0)}%!</small>
                        </div>
                        <button class="btn-combo-detalle" onclick="abrirModalUniversal('${datosString}')">Ver detalles y ahorro</button>
                    </div>`;
            });
        } catch (e) { console.error(e); }
    }

    async function cargarLiquidacion(sb) {
        const contenedor = document.getElementById('grid-ofertas');
        
        
        if (document.getElementById('ofertas-bloqueadas').style.display === 'flex') {
            return; 
        }

        contenedor.innerHTML = '<p class="cargando">Buscando ofertas...</p>';
        
        try {
            const fetchFunction = async () => {
                return await sb
                    .from('productos')
                    .select('*, video_url, porcentaje_descuento') 
                    .or('stock.lt.20,porcentaje_descuento.gt.0')
                    .gt('stock', 0) 
                    .order('porcentaje_descuento', { ascending: false }) 
                    .order('stock', { ascending: true }) 
                    .limit(30); 
            };
            
            const { data: productos, error } = await fetchFunction();
            
            if (error) throw error;
            contenedor.innerHTML = '';
            if (!productos.length) { contenedor.innerHTML = '<p style="color:#fff;">No hay ofertas.</p>'; return; }
            
            productos.forEach(prod => {
                
                let colorBadge = '#009DFF'; 
                let textoUrgencia = `Disponible: ${prod.stock}`;
                
                if (prod.stock <= 3) { 
                    colorBadge = '#E62525'; 
                    textoUrgencia = `¡Solo ${prod.stock}!`; 
                }
                else if (prod.stock <= 5) { 
                    colorBadge = '#E6A925'; 
                    textoUrgencia = `Quedan ${prod.stock}`; 
                }
                else if (prod.stock <= 10) { 
                    colorBadge = '#009DFF'; 
                    textoUrgencia = `Quedan ${prod.stock}`; 
                }
                
                
                const precioNormal = parseFloat(prod.precio_unitario || prod.precio);
                const descuento = prod.porcentaje_descuento || 0;
                let precioFinal = precioNormal;

                let htmlPrecios = `<p class="precioProducto" style="color:${colorBadge};">$${precioNormal.toFixed(2)}</p>`;

                if (descuento > 0) {
                    precioFinal = precioNormal - (precioNormal * (descuento / 100));
                    htmlPrecios = `
                        <div class="combo-precios">
                            <span class="precio-tachado">$${precioNormal.toFixed(2)}</span>
                            <span class="precio-final" style="color:#ff4757;">$${precioFinal.toFixed(2)}</span>
                        </div>
                        <small class="ahorro-text-off">-${descuento}% OFF</small>
                    `;
                }
                
                const datos = {
                    tipo: 'producto', 
                    id: prod.id_producto,
                    nombre: prod.nombre,
                    precio: precioFinal,
                    precioNormal: precioNormal,
                    descuento: descuento,
                    descripcion: prod.descripcion,
                    imagen: prod.imagen_url,
                    video: prod.video_url, 
                    stock: prod.stock,
                    codigo: prod.codigo_producto
                };
                const encoded = encodeURIComponent(JSON.stringify(datos));
                
                const imgUrlConvertida = convertirUrlImagen(prod.imagen_url);

                const html = `
                <div class="cajaProducto" style="border-color: ${colorBadge}; box-shadow: 0 0 10px ${colorBadge}40;">
                    <div class="badge-stock-flotante" style="background-color: ${colorBadge};">
                        ${textoUrgencia}
                    </div>
                    <div class="imagenProducto">
                        <img src="${imgUrlConvertida}" alt="${prod.nombre}" onerror="this.src='https://via.placeholder.com/300'">
                    </div>
                    <div class="info-tarjeta">
                        <span class="combo-codigo">${datos.codigo ? `Cód: ${datos.codigo}` : ''}</span>
                        <h3 class="nombreProducto">${prod.nombre}</h3>
                        ${htmlPrecios}
                    </div>
                    <button class="btn-ver-mas" onclick="abrirModalUniversal('${encoded}')">
                        Ver más información
                    </button>
                </div>`;
                contenedor.innerHTML += html;
            });
        } catch (e) { console.error(e); }
    }

    
    window.abrirModalUniversal = (datosEncoded) => {
        const datos = JSON.parse(decodeURIComponent(datosEncoded));

        itemSeleccionado = {
            id: datos.id,
            tipo: datos.tipo,
            nombre: datos.nombre,
            precio: datos.precio,
            stock: datos.stock
        };

        document.getElementById('modalNombre').innerText = datos.nombre;
        const precioEl = document.getElementById('modalPrecio');

        if (datos.tipo === 'producto' && datos.descuento > 0) {
            precioEl.innerHTML = `
                <span style="text-decoration:line-through; color:#888; font-size:1.2rem; margin-right:10px;">$${datos.precioNormal.toFixed(2)}</span>
                <span style="color:#ff4757; font-size:2rem; background-color: transparent;">$${datos.precio.toFixed(2)}</span>
                <div style="font-size:1rem; color:#ff4757; font-weight:normal; background-color: transparent;">(Descuento del ${datos.descuento}%)</div>
            `;
        } else {
            precioEl.innerText = `$${datos.precio.toFixed(2)}`;
            precioEl.style.color = '#ffffff';
        }
        precioEl.style.display = 'block';

        const descDiv = document.getElementById('modalDescripcion');
        if (datos.tipo === 'combo') {
            let tablaHTML = `<p>${datos.descripcion || ''}</p><br><h4 style="color:#E6B325;">Productos Incluidos:</h4><table class="tabla-combo"><thead><tr><th>Cant.</th><th>Producto</th><th>Precio Unitario</th><th>Subtotal Normal</th></tr></thead><tbody>`;
            
            datos.listaProductos.forEach(p => {
                const subtotalNormal = p.cantidad * p.precio_unitario; 
                
                tablaHTML += `<tr>
                    <td style="text-align:center;">${p.cantidad}</td>
                    <td>${p.nombre}</td>
                    <td style="color:#fff;">$${p.precio_unitario.toFixed(2)}</td>
                    <td style="color:#E6B325;">$${subtotalNormal.toFixed(2)}</td>
                </tr>`;
            });
            
            tablaHTML += `</tbody></table>
            <div style="margin-top:15px; padding:10px; border-radius:5px; background-color: #151538;">
                <p style="text-align:right; font-size:1.1rem; color:#ccc;">Suma Normal: <span style="text-decoration:line-through; color:#fff;">$${datos.precioNormal.toFixed(2)}</span></p>
                <p style="text-align:right; font-size:1.4rem; font-weight:bold; color:#E6B325;">Precio Combo: $${parseFloat(datos.precio).toFixed(2)}</p>
            </div>`;
            
            if (datos.ahorro > 0) tablaHTML += `<div class="ahorro-badge">¡Te ahorras $${datos.ahorro.toFixed(2)}!</div>`;
            descDiv.innerHTML = tablaHTML;
        } else {
            descDiv.innerText = datos.descripcion || "Sin descripción.";
        }
        
        document.getElementById('inputCantidad').value = 1;
        actualizarPrecioTotal(1);

        const badge = document.getElementById('modalBadgeStock');
        if(datos.tipo === 'producto') {
            badge.style.display = 'block';
            badge.innerText = `¡Solo quedan ${datos.stock} unidades!`;
            badge.style.backgroundColor = 'transparent';
        } else {
            badge.style.display = 'none';
        }

        listaMedios = [];
        
        if (datos.tipo === 'producto' && datos.video && datos.video.length > 5) {
            listaMedios.push({ tipo: 'video', url: datos.video });
        }

        if (datos.imagen) {
            listaMedios.push({ tipo: 'image', url: convertirUrlImagen(datos.imagen) });
        } else {
            listaMedios.push({ tipo: 'image', url: 'https://via.placeholder.com/300?text=Sin+Foto' });
        }

        indiceMediaActual = 0;
        renderizarMedia();

        document.getElementById('modalProducto').style.display = 'flex';
    };

    window.renderizarMedia = () => {
        const mediaContainer = document.getElementById('modalMediaContainer');
        const prevBtn = document.getElementById('btnMediaPrev');
        const nextBtn = document.getElementById('btnMediaNext');

        if (!mediaContainer) return;
        mediaContainer.innerHTML = '';
        
        const item = listaMedios[indiceMediaActual];

        if (!item) {
            mediaContainer.innerHTML = '<p style="text-align:center; color:#ccc;">No hay medios disponibles.</p>';
            if(prevBtn) prevBtn.style.display = 'none';
            if(nextBtn) nextBtn.style.display = 'none';
            return;
        }
        
        const arrows = listaMedios.length > 1 ? 'block' : 'none'; 
        if(prevBtn) prevBtn.style.display = arrows;
        if(nextBtn) nextBtn.style.display = arrows;

        if (item.tipo === 'video') {
            const urlEmbed = obtenerUrlEmbed(item.url);
            
            if (urlEmbed) {
                // Si es un archivo directo (MP4, MOV, etc.)
                if (urlEmbed.match(/\.(mp4|mov|webm|ogg)$/i)) {
                    mediaContainer.innerHTML = `<video width="100%" height="100%" controls autoplay muted style="max-height: 350px;"><source src="${urlEmbed}" type="video/mp4">Tu navegador no soporta el tag de video.</video>`;
                } else {
                    // Si es una plataforma (YouTube, TikTok, Instagram)
                    mediaContainer.innerHTML = `<iframe width="100%" height="100%" src="${urlEmbed}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen style="min-height: 350px; border-radius: 8px;"></iframe>`;
                }
            } else {
                mediaContainer.innerHTML = `<p style="color:red; text-align:center;">URL de video no válida o no soportada.</p>`;
            }
        } else {
            const img = document.createElement('img');
            img.src = item.url;
            img.alt = "Producto";
            img.onerror = function () { this.src = 'https://via.placeholder.com/300?text=Sin+Imagen'; };
            img.style.width = '100%';
            img.style.maxHeight = '350px';
            img.style.objectFit = 'contain';
            mediaContainer.appendChild(img);
        }
    };

    function estilarIframe(iframe) {
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        iframe.style.border = 'none';
        iframe.style.borderRadius = '10px';
        iframe.style.minHeight = '300px';
    }

    window.cambiarMedia = (direccion) => {
        indiceMediaActual += direccion;
        if (indiceMediaActual < 0) indiceMediaActual = listaMedios.length - 1;
        if (indiceMediaActual >= listaMedios.length) indiceMediaActual = 0;
        renderizarMedia();
    };


    
    window.cerrarModal = () => { 
        document.getElementById('modalProducto').style.display = 'none'; 
        document.getElementById('modalMediaContainer').innerHTML = '';
        itemSeleccionado = null; 
        const video = document.querySelector('video');
        if(video) video.pause();
    };

    // Cambiar cantidad en el modal
    window.cambiarCantidad = (cambio) => {
        const input = document.getElementById('inputCantidad');
        let val = parseInt(input.value) + cambio;
        actualizarInputCantidad(val, true);
    };

    // Agregar al carrito desde el modal
    window.agregarAlCarrito = () => {
        if (!itemSeleccionado) return;

        const cantidadA_Agregar = parseInt(document.getElementById('inputCantidad').value);
        let carrito = JSON.parse(localStorage.getItem('carrito_compras')) || [];
        const idCarrito = itemSeleccionado.tipo === 'combo' ? `combo_${itemSeleccionado.id}` : itemSeleccionado.id;

        const itemEnCarrito = carrito.find(item => item.id === idCarrito);
        const cantidadEnCarrito = itemEnCarrito ? itemEnCarrito.cantidad : 0;
        const cantidadTotalFutura = cantidadEnCarrito + cantidadA_Agregar;
        const stockMaximo = itemSeleccionado.stock; 

        if (cantidadEnCarrito >= stockMaximo) {
            alert(`¡Ya tienes todo el stock disponible (${stockMaximo}) en tu carrito! No puedes agregar más.`);
            return;
        }

        if (cantidadTotalFutura > stockMaximo) {
            const disponibles = stockMaximo - cantidadEnCarrito;
            alert(`Stock insuficiente. Ya tienes ${cantidadEnCarrito} en el carrito y solo quedan ${stockMaximo} en total. Solo puedes agregar ${disponibles} más.`);
            return;
        }

        if (itemEnCarrito) {
            itemEnCarrito.cantidad += cantidadA_Agregar;
        } else {
            carrito.push({
                id: idCarrito,
                nombre: itemSeleccionado.nombre,
                precio: parseFloat(itemSeleccionado.precio),
                imagen: itemSeleccionado.imagen,
                cantidad: cantidadA_Agregar
            });
        }

        localStorage.setItem('carrito_compras', JSON.stringify(carrito));
        
        alert(`¡${itemSeleccionado.nombre} agregado!`);
        cerrarModal();
    };

    window.ordenarProductos = (orden) => {
        let lista = [...inventarioGlobal];
        if (orden === 'asc') lista.sort((a,b) => a.precio_unitario - b.precio_unitario);
        if (orden === 'desc') lista.sort((a,b) => b.precio_unitario - a.precio_unitario);
        // generarVistaDinamica(lista);
    };
    
    window.gestionarUsuarioLogueado = async (userId) => {
        // Lógica adicional para usuarios logueados si es necesaria
    };
}


function obtenerIdYoutube(url) {
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = url.match(regex);
    return (match && match[1]) ? match[1] : null;
}

function obtenerUrlEmbed(url) {
    if (!url) return null;

    // YouTube
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
        const videoId = obtenerIdYoutube(url);
        return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
    }
    
    // Archivo de video directo (MP4, etc.)
    if (url.match(/\.(mp4|mov|webm|ogg)$/i)) {
        return url; 
    }

    // TikTok
    if (url.includes('tiktok.com/')) {
        const idMatch = url.match(/\/video\/(\d+)/);
        if (idMatch) {
            return `https://www.tiktok.com/embed/v2/${idMatch[1]}`;
        }
    }

    // Instagram
    if (url.includes('instagram.com/')) {
        if (url.includes('/p/')) {
            return url.replace(/\/$/, '') + '/embed/';
        }
    }
    
    return null; 
}