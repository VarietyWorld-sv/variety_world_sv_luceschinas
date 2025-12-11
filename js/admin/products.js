import { supabase } from './config.js';
import { abrirModal, cerrarModal } from './ui.js';

let idProductoEdit = null;

async function subirImagenASupabase(file) {
    if (!file) return null;

    const userResult = await supabase.auth.getUser();
    const userId = userResult.data.user ? userResult.data.user.id : 'admin_files'; 
    
    const bucketName = 'inventario';
    const fileName = file.name.replace(/\s/g, '_').replace(/[^\w._-]/g, '');
    const filePath = `${userId}/${Date.now()}_${fileName}`;

    const { error } = await supabase.storage
        .from(bucketName)
        .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false,
        });

    if (error) {
        throw new Error("Error al subir la imagen a Storage: " + error.message);
    }
    
    const { data: publicUrl } = supabase.storage
        .from(bucketName)
        .getPublicUrl(filePath);

    return publicUrl.publicUrl;
}

function convertirUrlImagen(url) {
    if (!url || url.trim() === '') return 'https://via.placeholder.com/40';
    
    if (url.includes('drive.google.com') || url.includes('docs.google.com')) {
        const idMatch = url.match(/\/d\/(.*?)\/|id=(.*?)(&|$)/);
        const id = idMatch ? (idMatch[1] || idMatch[2]) : null;
        
        if (id) {
            return `https://lh3.googleusercontent.com/d/${id}`;
        }
    }

    if (url.includes('dropbox.com')) {
        return url.replace('dl=0', 'raw=1');
    }

    return url;
}

export async function cargarProductos() {
    const tbody = document.getElementById('tabla-productos-body');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Cargando...</td></tr>';

    const { data, error } = await supabase
        .from('productos')
        .select('*')
        .order('id_producto', { ascending: true });

    if (error) {
        tbody.innerHTML = '<tr><td colspan="6">Error al cargar datos</td></tr>';
        return;
    }

    tbody.innerHTML = '';
    
    if (data) {
        data.forEach(p => {
            const img = convertirUrlImagen(p.imagen_url);
            const codigo = p.codigo_producto ? `<br><small style="color:#E6B325;">${p.codigo_producto}</small>` : '';
            const jsonP = JSON.stringify(p).replace(/'/g, "'");

            tbody.innerHTML += `
                <tr>
                    <td>
                        <img src="${img}" class="img-thumb" 
                            alt="Img"
                            onerror="this.onerror=null;this.src='https://via.placeholder.com/40?text=X';">
                    </td>
                    <td>
                        ${p.nombre}
                        ${codigo}
                    </td>
                    <td>$${p.precio_unitario}</td>
                    <td style="font-weight:bold; color:${p.stock < 5 ? '#ff4757' : '#fff'}">${p.stock}</td>
                    <td>${p.porcentaje_descuento || 0}%</td>
                    <td>
                        <button class="btn-action" onclick='window.prepararEdicionProducto(${jsonP})'>
                            <i class="fa-solid fa-pen"></i>
                        </button>
                        <button class="btn-action" onclick="window.eliminarProducto('${p.id_producto}')" style="background-color:#E62525; border-color:#E62525;">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        });
    }
}

function activarModoRapido(producto) {
    const msgBox = document.getElementById('msg-producto-encontrado');
    const camposDetallados = document.getElementById('campos-detallados');
    const btnCancelar = document.getElementById('btn-cancelar-modo-rapido');

    idProductoEdit = producto.id_producto;
    
    document.getElementById('prod-nombre').value = producto.nombre;
    document.getElementById('prod-precio').value = producto.precio_unitario;
    document.getElementById('prod-descuento').value = producto.porcentaje_descuento || 0;
    document.getElementById('prod-imagen-url').value = producto.imagen_url || '';
    document.getElementById('prod-categoria').value = producto.categoria || '';
    document.getElementById('prod-desc').value = producto.descripcion || '';
    document.getElementById('prod-paquete').value = producto.unidades_por_paquete || 1;
    document.getElementById('input-url-video').value = producto.video_url || '';

    document.getElementById('txt-nombre-encontrado').innerText = producto.nombre;
    document.getElementById('txt-precio-encontrado').innerText = `$${producto.precio_unitario}`;
    document.getElementById('prod-stock').value = producto.stock;

    document.getElementById('prod-nombre').removeAttribute('required');
    document.getElementById('prod-precio').removeAttribute('required');

    msgBox.style.display = 'block';
    camposDetallados.style.display = 'none';
    btnCancelar.style.display = 'block';
    
    document.getElementById('tituloModalProducto').innerText = "Actualizar Stock";
    document.getElementById('prod-stock').focus();
    document.getElementById('prod-stock').select();
}

function desactivarModoRapido() {
    const msgBox = document.getElementById('msg-producto-encontrado');
    const camposDetallados = document.getElementById('campos-detallados');
    const btnCancelar = document.getElementById('btn-cancelar-modo-rapido');

    msgBox.style.display = 'none';
    camposDetallados.style.display = 'block'; 
    btnCancelar.style.display = 'none';
    
    document.getElementById('prod-nombre').setAttribute('required', 'true');
    document.getElementById('prod-precio').setAttribute('required', 'true');
    
    document.getElementById('tituloModalProducto').innerText = idProductoEdit ? "Editar Producto" : "Nuevo Producto";
}

document.getElementById('prod-codigo')?.addEventListener('change', async (e) => {
    const codigo = e.target.value.trim();
    if (codigo.length < 2) return;

    const { data } = await supabase.from('productos').select('*').eq('codigo_producto', codigo).maybeSingle();

    if (data) {
        activarModoRapido(data);
    } else {
        if(document.getElementById('campos-detallados').style.display === 'none'){
            desactivarModoRapido();
            document.getElementById('formProducto').reset();
            document.getElementById('prod-codigo').value = codigo;
            idProductoEdit = null;
        }
    }
});

document.getElementById('btn-cancelar-modo-rapido')?.addEventListener('click', () => {
    desactivarModoRapido();
});

async function cargarCategoriasEnDatalist() {
    const datalist = document.getElementById('lista-categorias');
    if (!datalist) return;
    datalist.innerHTML = '';
    
    const categoriasFijas = ["Para los reyes del hogar", "Recreativos", "Producto nacional", "Baterías"];
    categoriasFijas.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        datalist.appendChild(option);
    });
}

export function prepararCreacionProducto() {
    document.getElementById('formProducto').reset();
    idProductoEdit = null;
    desactivarModoRapido();
    document.getElementById('tituloModalProducto').innerText = "Nuevo Producto";
    document.getElementById('prod-paquete').value = 1;
    document.getElementById('input-url-video').value = '';
    
    document.getElementById('prod-imagen-file').value = '';
    document.getElementById('upload-progress-bar').style.display = 'none';


    cargarCategoriasEnDatalist();
    abrirModal('modalProductoAdmin');
}

export function prepararEdicionProducto(prod) {
    idProductoEdit = prod.id_producto;
    desactivarModoRapido();
    
    document.getElementById('tituloModalProducto').innerText = "Editar Producto";
    document.getElementById('prod-codigo').value = prod.codigo_producto || '';
    document.getElementById('prod-nombre').value = prod.nombre;
    document.getElementById('prod-precio').value = prod.precio_unitario;
    document.getElementById('prod-stock').value = prod.stock;
    document.getElementById('prod-descuento').value = prod.porcentaje_descuento || 0;
    document.getElementById('prod-imagen-url').value = prod.imagen_url || '';
    document.getElementById('prod-categoria').value = prod.categoria || '';
    document.getElementById('prod-desc').value = prod.descripcion || '';
    document.getElementById('prod-paquete').value = prod.unidades_por_paquete || 1;
    document.getElementById('input-url-video').value = prod.video_url || '';
    
    document.getElementById('prod-imagen-file').value = '';
    document.getElementById('upload-progress-bar').style.display = 'none';


    cargarCategoriasEnDatalist();
    abrirModal('modalProductoAdmin');
}

export async function guardarProducto(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-guardar-producto');
    const txtOriginal = btn.innerText;
    const fileInput = document.getElementById('prod-imagen-file');
    const urlInput = document.getElementById('prod-imagen-url');
    const progressBar = document.getElementById('upload-progress-bar');
    
    btn.innerText = "Guardando...";
    btn.disabled = true;
    progressBar.value = 0;

    let imagenUrlFinal = urlInput.value.trim();

    try {
        if (fileInput.files.length > 0) {
            const archivo = fileInput.files[0];
            
            progressBar.style.display = 'block';
            progressBar.value = 25; 

            imagenUrlFinal = await subirImagenASupabase(archivo);
            
            if (!imagenUrlFinal) {
                throw new Error("La URL de la imagen subida no pudo ser generada.");
            }
            progressBar.value = 100;
        } 
        
        const datos = {
            codigo_producto: document.getElementById('prod-codigo').value || null,
            nombre: document.getElementById('prod-nombre').value,
            precio_unitario: document.getElementById('prod-precio').value,
            stock: document.getElementById('prod-stock').value,
            porcentaje_descuento: document.getElementById('prod-descuento').value,
            imagen_url: imagenUrlFinal || null,
            categoria: document.getElementById('prod-categoria').value,
            descripcion: document.getElementById('prod-desc').value,
            unidades_por_paquete: document.getElementById('prod-paquete').value,
            video_url: document.getElementById('input-url-video').value || null
        };


        let error;
        if (idProductoEdit) {
            ({ error } = await supabase.from('productos').update(datos).eq('id_producto', idProductoEdit));
        } else {
            ({ error } = await supabase.from('productos').insert([datos]));
        }

        if (error) {
            throw error;
        } else {
            alert("Producto guardado correctamente.");
            cerrarModal('modalProductoAdmin');
            
            sessionStorage.removeItem('catalogo_global');
            
            cargarProductos(); 
        }

    } catch (error) {
        console.error('Error al guardar/subir:', error);
        let mensaje = "Error desconocido.";
        if (error.code === '23505') mensaje = 'El código de producto ya existe.';
        else if (error.message.includes('Storage')) mensaje = `Error de Storage: ${error.message}`;
        else if (error.message.includes('generada')) mensaje = error.message;

        alert("Error: " + mensaje);
    } finally {
        btn.innerText = txtOriginal;
        btn.disabled = false;
        progressBar.style.display = 'none';
        progressBar.value = 0;
    }
}

export async function eliminarProducto(id) {
    if (!confirm("¿Seguro que deseas eliminar este producto?")) return;
    const { error } = await supabase.from('productos').delete().eq('id_producto', id);
    if (error) alert("Error al eliminar (posibles pedidos asociados).");
    else cargarProductos();
}