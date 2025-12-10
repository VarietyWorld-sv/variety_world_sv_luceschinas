import { supabase } from './config.js';
import { abrirModal, cerrarModal } from './ui.js';

let idPedidoActual = null;
let costoEnvioActual = 0;

export async function cargarPedidos() {
    const tbody = document.getElementById('tabla-pedidos-body');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Cargando...</td></tr>';

    const { data: pedidos, error } = await supabase
        .from('pedidos')
        .select(`
            id_pedido, fecha_pedido, total_factura, estado_pedido, id_usuario,
            facturacion_envio ( nombre_factura )
        `)
        .order('fecha_pedido', { ascending: false })
        .limit(30);

    if (error) {
        console.error(error);
        tbody.innerHTML = '<tr><td colspan="6">Error al cargar</td></tr>';
        return;
    }

    tbody.innerHTML = '';
    
    for (const p of pedidos) {
        const fecha = new Date(p.fecha_pedido).toLocaleDateString();
        
        let nombreMostrar = "N/A";
        
        if (p.facturacion_envio) {
            if (Array.isArray(p.facturacion_envio) && p.facturacion_envio.length > 0) {
                nombreMostrar = p.facturacion_envio[0].nombre_factura;
            } else if (p.facturacion_envio.nombre_factura) {
                nombreMostrar = p.facturacion_envio.nombre_factura;
            }
        }

        if (nombreMostrar === "N/A" && p.id_usuario) {
            const { data: perfil } = await supabase
                .from('perfiles_cliente')
                .select('nombre, apellidos')
                .eq('id_cliente', p.id_usuario)
                .maybeSingle();
            
            if (perfil) nombreMostrar = `${perfil.nombre} ${perfil.apellidos}`;
            else nombreMostrar = "Usuario (Sin perfil)";
        } else if (nombreMostrar === "N/A") {
            nombreMostrar = "Invitado";
        }

        tbody.innerHTML += `
            <tr>
                <td><small style="color:#ccc;">${p.id_pedido.slice(0, 6)}...</small></td>
                <td>${fecha}</td>
                <td style="color:#fff; font-weight:bold;">${nombreMostrar}</td>
                <td style="color:#E6B325;">$${parseFloat(p.total_factura).toFixed(2)}</td>
                <td><span class="status-badge ${p.estado_pedido.toLowerCase()}">${p.estado_pedido}</span></td>
                <td>
                    <button class="btn-action" onclick="window.gestionarPedido('${p.id_pedido}')">
                        <i class="fa-solid fa-edit"></i> Editar
                    </button>
                </td>
            </tr>
        `;
    }
}

export async function gestionarPedido(id) {
    idPedidoActual = id;
    costoEnvioActual = 0; 
    
    const selectEstado = document.getElementById('select-estado-pedido');
    const tituloCliente = document.getElementById('cliente-modal-titulo');
    
    if (tituloCliente) tituloCliente.innerText = "Cargando...";

    const { data: pedido } = await supabase
        .from('pedidos')
        .select(`estado_pedido, id_usuario, facturacion_envio(nombre_factura)`)
        .eq('id_pedido', id)
        .single();

    if (pedido) {
        if(selectEstado) selectEstado.value = pedido.estado_pedido;
        
        let nombreReal = "Cliente Desconocido";
        const datosEnvio = Array.isArray(pedido.facturacion_envio) ? pedido.facturacion_envio[0] : pedido.facturacion_envio;
        
        if (datosEnvio?.nombre_factura) {
            nombreReal = datosEnvio.nombre_factura;
        } else if (pedido.id_usuario) {
            const { data: perfil } = await supabase.from('perfiles_cliente').select('nombre, apellidos').eq('id_cliente', pedido.id_usuario).maybeSingle();
            if (perfil) nombreReal = `${perfil.nombre} ${perfil.apellidos}`;
        }
        if (tituloCliente) tituloCliente.innerText = nombreReal;
    }

    await cargarDetallesPedido(id);
    try { await cargarListaProductosSelect(); } catch(e) {}

    abrirModal('modalAdminPedido');
}

async function cargarListaProductosSelect() {
    const select = document.getElementById('select-add-producto');
    if (!select || select.children.length > 1) return; 

    select.innerHTML = '<option value="">Cargando...</option>';
    const { data: productos } = await supabase
        .from('productos')
        .select('id_producto, nombre, precio_unitario, stock')
        .gt('stock', 0)
        .order('nombre');

    select.innerHTML = '<option value="">Seleccionar producto...</option>';
    if(productos) {
        productos.forEach(p => {
            const option = document.createElement('option');
            option.value = p.id_producto;
            option.text = `${p.nombre} (Stock: ${p.stock}) - $${p.precio_unitario}`;
            option.dataset.precio = p.precio_unitario;
            option.dataset.stock = p.stock; 
            select.appendChild(option);
        });
    }
}

async function cargarDetallesPedido(idPedido) {
    const tbody = document.getElementById('tabla-detalles-pedido');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Cargando...</td></tr>';

    const { data: pedidoData } = await supabase.from('pedidos').select('costo_envio').eq('id_pedido', idPedido).single();
    costoEnvioActual = pedidoData ? (pedidoData.costo_envio || 0) : 0;

    const { data: detalles, error } = await supabase
        .from('detalles_pedido')
        .select(`id_detalle, cantidad, precio_al_comprar, id_producto, productos ( nombre )`)
        .eq('id_pedido', idPedido);

    if (error) { console.error(error); return; }

    tbody.innerHTML = '';
    
    if (detalles) {
        detalles.forEach(d => {
            const subtotal = d.cantidad * d.precio_al_comprar;
            const nombreProd = d.productos ? d.productos.nombre : '(Eliminado)';
            const safeIdProducto = d.id_producto ? d.id_producto : ''; 
            
            tbody.innerHTML += `
                <tr id="fila-${d.id_detalle}">
                    <td data-label="Producto:">${nombreProd}</td>
                    <td data-label="Precio:" class="col-precio" data-precio="${d.precio_al_comprar}">$${d.precio_al_comprar.toFixed(2)}</td>
                    <td data-label="Cantidad:">
                        <input type="number" class="input-tabla" style="width:60px; text-align:center;"
                                value="${d.cantidad}" min="1"
                                onchange="window.actualizarCantidadDetalle(this, '${d.id_detalle}', '${safeIdProducto}', ${d.cantidad})">
                    </td>
                    <td data-label="Subtotal:" class="col-subtotal" id="subtotal-${d.id_detalle}">$${subtotal.toFixed(2)}</td>
                    <td data-label="">
                        <button class="btn-action" style="background:#E62525; padding:5px 10px;" 
                            onclick="window.eliminarDetalle(this, '${d.id_detalle}', '${safeIdProducto}', ${d.cantidad})">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        });
    }
    calcularTotalVisual();
}

function calcularTotalVisual() {
    const celdasSubtotal = document.querySelectorAll('.col-subtotal');
    let sumaProductos = 0;

    celdasSubtotal.forEach(celda => {
        const valor = parseFloat(celda.innerText.replace('$', '')) || 0;
        sumaProductos += valor;
    });

    const granTotal = sumaProductos + costoEnvioActual;
    const totalEl = document.getElementById('total-pedido-modal');
    
    if (totalEl) {
        totalEl.innerText = `$${granTotal.toFixed(2)}`;
    }
    return granTotal;
}

async function guardarTotalEnBD(idPedido, totalCalculado) {
    const subtotal = totalCalculado - costoEnvioActual;
    await supabase.from('pedidos').update({ subtotal: subtotal, total_factura: totalCalculado }).eq('id_pedido', idPedido);
}

window.actualizarCantidadDetalle = async (input, idDetalle, idProducto, cantidadAnterior) => {
    const nuevaCantidad = parseInt(input.value);
    if (isNaN(nuevaCantidad) || nuevaCantidad < 1) { alert("Mínimo 1"); input.value = cantidadAnterior; return; }
    if (nuevaCantidad == cantidadAnterior) return;

    // 1. Actualización Visual Inmediata
    const fila = document.getElementById(`fila-${idDetalle}`);
    const precio = parseFloat(fila.querySelector('.col-precio').dataset.precio);
    const nuevoSubtotal = precio * nuevaCantidad;
    
    document.getElementById(`subtotal-${idDetalle}`).innerText = `$${nuevoSubtotal.toFixed(2)}`;
    const nuevoTotalGlobal = calcularTotalVisual(); // Actualiza el total amarillo al instante

    try {
        input.disabled = true; 
        const diferencia = cantidadAnterior - nuevaCantidad;

        // Actualizar BD
        await supabase.from('detalles_pedido').update({ cantidad: nuevaCantidad }).eq('id_detalle', idDetalle);

        // Ajustar Stock
        if (idProducto) {
            const { data: prod } = await supabase.from('productos').select('stock').eq('id_producto', idProducto).single();
            if (prod) {
                const nuevoStock = prod.stock + diferencia;
                if (nuevoStock < 0) {
                    alert(`Stock insuficiente. Máximo: ${prod.stock}`);
                    // Revertir visualmente
                    input.value = cantidadAnterior;
                    document.getElementById(`subtotal-${idDetalle}`).innerText = `$${(precio * cantidadAnterior).toFixed(2)}`;
                    calcularTotalVisual();
                    
                    // Revertir BD
                    await supabase.from('detalles_pedido').update({ cantidad: cantidadAnterior }).eq('id_detalle', idDetalle);
                    input.disabled = false;
                    return;
                }
                await supabase.from('productos').update({ stock: nuevoStock }).eq('id_producto', idProducto);
            }
        }

        // Guardar total en BD (silenciosamente)
        await guardarTotalEnBD(idPedidoActual, nuevoTotalGlobal);

        input.setAttribute('onchange', `window.actualizarCantidadDetalle(this, '${idDetalle}', '${idProducto}', ${nuevaCantidad})`);
        
        // Efecto visual de éxito
        input.style.borderColor = "#4CAF50";
        setTimeout(() => input.style.borderColor = "", 1000);

    } catch (err) {
        console.error("Error:", err);
        alert("Error de conexión.");
        input.value = cantidadAnterior;
    } finally {
        input.disabled = false;
    }
};

document.getElementById('btn-add-producto')?.addEventListener('click', async () => {
    const select = document.getElementById('select-add-producto');
    const inputCant = document.getElementById('input-add-cantidad');
    const idProducto = select.value;
    const cantidad = parseInt(inputCant.value);
    
    if (!idProducto || cantidad < 1) return alert("Datos inválidos.");

    const btn = document.getElementById('btn-add-producto');
    btn.disabled = true;
    btn.innerText = "...";

    const opt = select.options[select.selectedIndex];
    const precio = parseFloat(opt.dataset.precio);
    const stock = parseInt(opt.dataset.stock);

    if (cantidad > stock) {
        btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-plus"></i> Agregar';
        return alert(`Stock insuficiente.`);
    }

    try {
        // Verificar existencia
        const { data: existente } = await supabase.from('detalles_pedido')
            .select('id_detalle, cantidad').eq('id_pedido', idPedidoActual).eq('id_producto', idProducto).maybeSingle();

        if (existente) {
            await supabase.from('detalles_pedido').update({ cantidad: existente.cantidad + cantidad }).eq('id_detalle', existente.id_detalle);
        } else {
            await supabase.from('detalles_pedido').insert([{
                id_pedido: idPedidoActual, id_producto: idProducto, cantidad: cantidad, precio_al_comprar: precio
            }]);
        }

        await supabase.from('productos').update({ stock: stock - cantidad }).eq('id_producto', idProducto);

        inputCant.value = 1;
        
        await cargarDetallesPedido(idPedidoActual);
        select.innerHTML = ''; await cargarListaProductosSelect(); 

    } catch (err) { console.error(err); alert("Error al agregar."); }
    
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-plus"></i> Agregar';
});

window.eliminarDetalle = async (boton, idDetalle, idProducto, cantidad) => {
    if (!confirm("¿Eliminar producto? El stock regresará.")) return;

    if (boton) {
        const fila = boton.closest('tr');
        fila.remove(); 
        const nuevoTotal = calcularTotalVisual();
        
        
        try {
            await supabase.from('detalles_pedido').delete().eq('id_detalle', idDetalle);
            
            if (idProducto) {
                const { data: prod } = await supabase.from('productos').select('stock').eq('id_producto', idProducto).maybeSingle();
                if (prod) await supabase.from('productos').update({ stock: prod.stock + parseInt(cantidad) }).eq('id_producto', idProducto);
            }
            
            await guardarTotalEnBD(idPedidoActual, nuevoTotal);

            const sel = document.getElementById('select-add-producto');
            if(sel) { sel.innerHTML = ''; await cargarListaProductosSelect(); }

        } catch (err) {
            console.error("Error asíncrono:", err);
            alert("Error de red. Recargando...");
            await cargarDetallesPedido(idPedidoActual);
        }
    }
};

document.getElementById('btn-guardar-estado')?.addEventListener('click', async () => {
    if (!idPedidoActual) return;
    const nuevoEstado = document.getElementById('select-estado-pedido').value;
    const btn = document.getElementById('btn-guardar-estado');
    
    btn.disabled = true;
    btn.innerText = "...";

    try {
        // Si cancela, devolver stock
        const { data: pedidoAnt } = await supabase.from('pedidos').select('estado_pedido').eq('id_pedido', idPedidoActual).single();
        
        if (nuevoEstado === 'Cancelado' && pedidoAnt.estado_pedido !== 'Cancelado') {
            if(!confirm("Al cancelar se devuelve el stock. ¿Seguro?")) {
                btn.disabled = false; btn.innerText = "Actualizar Estado"; return;
            }
            const { data: detalles } = await supabase.from('detalles_pedido').select('id_producto, cantidad').eq('id_pedido', idPedidoActual);
            if (detalles) {
                for (const item of detalles) {
                    const { data: prod } = await supabase.from('productos').select('stock').eq('id_producto', item.id_producto).single();
                    if (prod) await supabase.from('productos').update({ stock: prod.stock + item.cantidad }).eq('id_producto', item.id_producto);
                }
            }
        }

        await supabase.from('pedidos').update({ estado_pedido: nuevoEstado }).eq('id_pedido', idPedidoActual);
        
        alert(`Estado actualizado a: ${nuevoEstado}`);
        cerrarModal('modalAdminPedido');
        cargarPedidos();

    } catch(e) { console.error(e); alert("Error."); }
    
    btn.disabled = false;
    btn.innerText = "Actualizar Estado";
});

window.gestionarPedido = gestionarPedido;
window.eliminarDetalle = eliminarDetalle;
window.actualizarCantidadDetalle = window.actualizarCantidadDetalle;