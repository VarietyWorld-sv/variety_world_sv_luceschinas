const SUPABASE_URL = 'https://fpmsddnonhiqxnsydfpz.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZwbXNkZG5vbmhpcXhuc3lkZnB6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5MTE4NTAsImV4cCI6MjA3ODQ4Nzg1MH0.Lj3q5iOHpGzBhwul1yPx4jxoSB9u-blu5EYJ6lsftXY';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let totalProductos = 0;
let costoEnvio = 0;
let datosPedidoTemporal = {};

document.addEventListener('DOMContentLoaded', async () => {
    cargarCarrito();
    await cargarZonasEnvio();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
        gestionarUsuarioLogueado(user.id);
    }
    configurarFormularioInvitado();
});

function cargarCarrito() {
    let carrito = JSON.parse(localStorage.getItem('carrito_compras')) || [];

    const contenedorItems = document.getElementById('lista-productos');
    const contenedorVacio = document.getElementById('carrito-vacio');
    const contenedorContenido = document.getElementById('contenido-carrito');

    if (!contenedorItems) return;

    if (carrito.length === 0) {
        if (contenedorVacio) contenedorVacio.style.display = 'block';
        if (contenedorContenido) contenedorContenido.style.display = 'none';
        return;
    }
    
    if (contenedorVacio) contenedorVacio.style.display = 'none';
    if (contenedorContenido) contenedorContenido.style.display = 'grid';
    contenedorItems.innerHTML = '';

    totalProductos = 0;
    
    carrito.forEach((producto, index) => {
        const subtotal = producto.precio * producto.cantidad;
        totalProductos += subtotal;

        const itemDiv = document.createElement('div');
        itemDiv.classList.add('item-carrito');
        
        itemDiv.innerHTML = `
            <img src="${producto.imagen}" alt="${producto.nombre}" class="img-item-carrito" onerror="this.src='https://via.placeholder.com/100?text=Sin+Foto'">
            <div class="info-item">
                <h3>${producto.nombre}</h3>
                <div class="precio-unitario">Precio: $${producto.precio.toFixed(2)}</div>
                <div class="subtotal-item">Subtotal: $${subtotal.toFixed(2)}</div>
            </div>
            <div class="controles-item">
                <div class="cantidad-wrapper">
                    <button class="btn-cant" onclick="actualizarCantidad(${index}, -1)">-</button>
                    <input type="text" class="input-cant-carrito" value="${producto.cantidad}" readonly>
                    <button class="btn-cant" onclick="actualizarCantidad(${index}, 1)">+</button>
                </div>
                <button class="btn-eliminar" onclick="eliminarProducto(${index})">
                    <i class="fa-solid fa-trash"></i> Eliminar
                </button>
            </div>
        `;
        contenedorItems.appendChild(itemDiv);
    });
    
    const botonContinuar = document.createElement('a');
    botonContinuar.href = "productos.html";
    botonContinuar.classList.add('continuar-compra');
    botonContinuar.innerHTML = `
        <i class="fa-solid fa-angle-left" style="background-color: transparent; padding-right: 22px;"></i>Continuar viendo más productos
    `;
    contenedorItems.appendChild(botonContinuar);

    actualizarTotalesPantalla();
    configurarBotonesCheckout(carrito);
}

function actualizarTotalesPantalla() {
    const subtotalEl = document.getElementById('subtotal-monto');
    const envioEl = document.getElementById('envio-monto');
    const totalEl = document.getElementById('total-monto');

    const selectZona = document.getElementById('select-zona');

    if (selectZona && selectZona.value === "whatsapp") {
        costoEnvio = 0;
    } else {
        costoEnvio = selectZona && selectZona.value ? parseFloat(selectZona.value) : 0;
    }

    //costoEnvio = selectZona && selectZona.value ? parseFloat(selectZona.value) : 0;

    const totalFinal = totalProductos + costoEnvio;

    if (subtotalEl) subtotalEl.innerText = `$${totalProductos.toFixed(2)}`;
    if (envioEl) envioEl.innerText = `$${costoEnvio.toFixed(2)}`;
    if (totalEl) totalEl.innerText = `$${totalFinal.toFixed(2)}`;

    const btnFinalizar = document.getElementById('btn-finalizar');
    if (btnFinalizar) {
        if (selectZona && selectZona.value === "whatsapp") {
            btnFinalizar.disabled = true;
            btnFinalizar.innerText = "¡Usa el botón de WhatsApp!";
            btnFinalizar.style.backgroundColor = 'gray';
        } else {
            btnFinalizar.disabled = false;
            btnFinalizar.innerText = "Confirmar pedido";
            btnFinalizar.style.backgroundColor = '';
        }
    }
}

async function cargarZonasEnvio() {
    const selectZona = document.getElementById('select-zona');
    const divDireccion = document.getElementById('bloque-direccion');

    if (!selectZona) return;

    selectZona.innerHTML = '';
    const defaultOption = document.createElement('option');
    defaultOption.value = "";
    defaultOption.text = "Selecciona una zona...";
    defaultOption.disabled = true;
    defaultOption.selected = true;
    selectZona.appendChild(defaultOption);

    const zonasEnCache = sessionStorage.getItem('zonas_cache');

    if (zonasEnCache) {
        const zonas = JSON.parse(zonasEnCache);
        renderizarOpcionesZonas(zonas, selectZona);
        if (divDireccion) divDireccion.style.display = 'block';
    } else {
        try {
            const { data: zonas, error } = await supabase
                .from('zonas_envio')
                .select('*')
                .order('costo_base', { ascending: true });

            if (error) throw error;

            sessionStorage.setItem('zonas_cache', JSON.stringify(zonas));
            renderizarOpcionesZonas(zonas, selectZona);
            if (divDireccion) divDireccion.style.display = 'block';

        } catch (err) {
            console.error("Error cargando zonas:", err);
        }
    }
    
    //selectZona.addEventListener('change', actualizarTotalesPantalla);
    selectZona.addEventListener('change', (e) => {
        const valorSeleccionado = e.target.value;
        
        if (valorSeleccionado === "whatsapp") {
            if (divDireccion) divDireccion.style.display = 'none';
        } else {
            if (divDireccion) divDireccion.style.display = 'block';
        }
        actualizarTotalesPantalla();
    });

}

function renderizarOpcionesZonas(lista, select) {
    lista.forEach(zona => {
        const option = document.createElement('option');
        option.value = zona.costo_base;
        option.text = `${zona.nombre_zona} - $${parseFloat(zona.costo_base).toFixed(2)}`;
        option.dataset.nombre = zona.nombre_zona;
        select.appendChild(option);
    });

    // Opción de Whatsapp para direcciones fuera de lista
    const whatsappOption = document.createElement('option');
    whatsappOption.value = "whatsapp";
    whatsappOption.text = "Mi dirección no se encuentra en la lista";
    whatsappOption.dataset.nombre = "Consulta por WhatsApp";
    select.appendChild(whatsappOption);
}

function manejarZonaWhatsapp(select) {
    costoEnvio = 0;
    actualizarTotalesPantalla();

    const btnFinalizar = document.getElementById('btn-finalizar');
    
    if (btnFinalizar) {
        btnFinalizar.disabled = true;
        btnFinalizar.innerText = "¡Contáctanos por WhatsApp!";
        btnFinalizar.style.backgroundColor = 'gray';
        btnFinalizar.style.cursor = 'default';
    }

    alert("Tu dirección no está en la lista. Por favor, utiliza el botón de 'Consultar por WhatsApp' para coordinar tu envío.");
}


window.actualizarCantidad = (index, cambio) => {
    let carrito = JSON.parse(localStorage.getItem('carrito_compras')) || [];
    let nuevaCantidad = carrito[index].cantidad + cambio;

    if (nuevaCantidad < 1) return;
    if (nuevaCantidad > 50) { alert("Máximo 50 unidades."); return; }

    carrito[index].cantidad = nuevaCantidad;
    localStorage.setItem('carrito_compras', JSON.stringify(carrito));
    cargarCarrito();
};

window.eliminarProducto = (index) => {
    let carrito = JSON.parse(localStorage.getItem('carrito_compras')) || [];
    if (confirm(`¿Eliminar producto?`)) {
        carrito.splice(index, 1);
        localStorage.setItem('carrito_compras', JSON.stringify(carrito));
        cargarCarrito();
    }
};

function configurarBotonesCheckout(carrito) {
    const btnWhatsapp = document.getElementById('btn-whatsapp');
    const btnFinalizar = document.getElementById('btn-finalizar');

    if (btnWhatsapp) {
        const nuevoWp = btnWhatsapp.cloneNode(true);
        btnWhatsapp.parentNode.replaceChild(nuevoWp, btnWhatsapp);

        nuevoWp.addEventListener('click', () => {
            const selectZona = document.getElementById('select-zona');
            const inputDireccion = document.getElementById('input-direccion');
            
            let zonaEnvio = "Aún no seleccionada";
            let direccionDetalle = "No especificada";
            let totalFinal = totalProductos + costoEnvio;

            if (selectZona && selectZona.value) {
                const opcionZona = selectZona.options[selectZona.selectedIndex];
                zonaEnvio = opcionZona.dataset.nombre || opcionZona.text;
                
                if (selectZona.value === "whatsapp") {
                    zonaEnvio = "Mi dirección no está en la lista";
                    totalFinal = totalProductos;
                }
            }

            if (inputDireccion && inputDireccion.value.trim().length > 0) {
                direccionDetalle = inputDireccion.value.trim();
            }

            let mensaje = "Hola, Variety World SV, quiero hacer un pedido\n\n*Productos:*\n";
            carrito.forEach(p => mensaje += `- ${p.cantidad}x ${p.nombre}\n`);
            mensaje += `\n*Subtotal:* $${totalProductos.toFixed(2)}`;
            mensaje += `\n*Zona de Envío:* ${zonaEnvio}`;
            
            if (selectZona && selectZona.value !== "whatsapp" && direccionDetalle !== "No especificada") {
                mensaje += `\n*Dirección:* ${direccionDetalle}`;
            } else if (selectZona && selectZona.value === "whatsapp") {
                mensaje += `\n_Necesito cotizar el envío. Mi dirección es: ${direccionDetalle}_`;
            } else {
                mensaje += `\n*Dirección:* (Por favor, especificar en la respuesta)`;
            }

            mensaje += `\n*Total estimado:* $${totalFinal.toFixed(2)}`;
            window.open(`https://wa.me/50377622211?text=${encodeURIComponent(mensaje)}`, '_blank');
        });
    }

    if (btnFinalizar) {
        const nuevoBtn = btnFinalizar.cloneNode(true);
        btnFinalizar.parentNode.replaceChild(nuevoBtn, btnFinalizar);

        nuevoBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            
            const selectZona = document.getElementById('select-zona');
            const inputDireccion = document.getElementById('input-direccion');
            const selectPago = document.getElementById('select-pago');

            if (!selectZona || selectZona.value === "") {
                alert("⚠️ Por favor selecciona una Zona de Envío antes de continuar.");
                if(selectZona) selectZona.focus(); 
                return; 
            }
            
            if (selectZona.value === "whatsapp") {
                alert("Has seleccionado 'Mi dirección no se encuentra en la lista'. Por favor, usa el botón de 'Consultar por WhatsApp' para coordinar tu envío.");
                return;
            }

            if (!selectPago || selectPago.value === "") {
                alert("⚠️ Por favor selecciona un método de pago.");
                if (selectPago) selectPago.focus(); 
                return;
            }

            const costo = parseFloat(selectZona.value) || 0;
            
            if (costo > 0 && (!inputDireccion || inputDireccion.value.trim().length < 5)) {
                alert("⚠️ Por favor ingresa una dirección de entrega válida.");
                if (inputDireccion) inputDireccion.focus(); 
                return;
            }

            const opcionZona = selectZona.options[selectZona.selectedIndex];
            datosPedidoTemporal = {
                costoEnvio: costo,
                nombreZona: opcionZona ? (opcionZona.dataset.nombre || opcionZona.text) : 'General',
                direccion: inputDireccion ? inputDireccion.value.trim() : 'N/A',
                metodoPago: selectPago.value,
                carrito: carrito,
                totalProductos: totalProductos
            };

            const { data: { user } } = await supabase.auth.getUser();

            if (user) {
                if (confirm(`¿Confirmar pedido por $${(totalProductos + costo).toFixed(2)}?`)) {
                    await procesarPedidoBD(user.id, user.email);
                }
            } else {
                const modal = document.getElementById('modalGuestCheckout');
                if (modal) modal.style.display = 'flex';
            }
        });
    }
}

function configurarFormularioInvitado() {
    const formGuest = document.getElementById('formGuest');
    if (formGuest) {
        formGuest.addEventListener('submit', async (e) => {
            e.preventDefault();

            const nombreGuest = document.getElementById('guest-nombre').value;
            const telGuest = document.getElementById('guest-telefono').value;

            if (!nombreGuest || !telGuest) {
                alert("Por favor completa todos los datos.");
                return;
            }

            const nombreParaFactura = `${nombreGuest} (Tel: ${telGuest}) - INVITADO`;

            await procesarPedidoBD(null, nombreParaFactura);

            document.getElementById('modalGuestCheckout').style.display = 'none';
        });
    }
}

async function procesarPedidoBD(userId, nombreCliente) {
    const { costoEnvio, nombreZona, direccion, metodoPago, carrito, totalProductos } = datosPedidoTemporal;
    const totalFinal = totalProductos + costoEnvio;

    try {
        const btnMain = document.getElementById('btn-finalizar');
        const btnGuest = document.querySelector('#formGuest button');
        if (btnMain) { btnMain.innerText = "Procesando..."; btnMain.disabled = true; }
        if (btnGuest) { btnGuest.innerText = "Procesando..."; btnGuest.disabled = true; }

        const { data: pedidoData, error: pedidoError } = await supabase
            .from('pedidos')
            .insert([{
                id_usuario: userId,
                fecha_pedido: new Date().toISOString(),
                estado_pedido: 'Pendiente',
                subtotal: totalProductos,
                descuento_aplicado: 0,
                costo_envio: costoEnvio,
                total_factura: totalFinal,
                metodo_pago: metodoPago,
                ubicacion_envio: direccion
            }])
            .select();

        if (pedidoError) throw pedidoError;
        const nuevoIdPedido = pedidoData[0].id_pedido;

        for (const prod of carrito) {
            const { error: detalleError } = await supabase
                .from('detalles_pedido')
                .insert([{
                    id_pedido: nuevoIdPedido,
                    id_producto: prod.id,
                    cantidad: prod.cantidad,
                    precio_al_comprar: prod.precio
                }]);
            
            if (detalleError) throw detalleError;

            const { data: prodBD } = await supabase
                .from('productos')
                .select('stock')
                .eq('id_producto', prod.id)
                .single();

            if (prodBD) {
                const nuevoStock = prodBD.stock - prod.cantidad;
                await supabase
                    .from('productos')
                    .update({ stock: nuevoStock })
                    .eq('id_producto', prod.id);
            }
        }

        const { error: envioError } = await supabase
            .from('facturacion_envio')
            .insert([{
                id_pedido: nuevoIdPedido,
                nombre_factura: nombreCliente,
                direccion_envio: direccion,
                zona_envio: nombreZona,
                requiere_factura_electronica: false
            }]);

        if (envioError) throw envioError;

        alert(`¡Gracias por tu compra! Tu pedido #${nuevoIdPedido.slice(0, 6)} ha sido recibido.`);
        localStorage.removeItem('carrito_compras');

        if (userId) window.location.href = "perfil.html";
        else window.location.href = "../index.html";

    } catch (error) {
        console.error("Error al procesar:", error);
        alert("Hubo un error al guardar el pedido. Intenta nuevamente.");
        
        const btnMain = document.getElementById('btn-finalizar');
        const btnGuest = document.querySelector('#formGuest button');
        
        if (btnMain) { btnMain.innerText = "Confirmar pedido"; btnMain.disabled = false; }
        if (btnGuest) { btnGuest.innerText = "Confirmar pedido"; btnGuest.disabled = false; }
    }
}

async function gestionarUsuarioLogueado(userId) {
    const { data: usuarioData } = await supabase
        .from('usuarios')
        .select('tipo_usuario')
        .eq('id_usuario', userId)
        .single();

    if (!usuarioData) return;

    let nombreA_Mostrar = "Usuario";

    if (usuarioData.tipo_usuario.toLowerCase() === 'cliente' || ['administrador', 'admin'].includes(usuarioData.tipo_usuario.toLowerCase())) {
        const { data: perfil } = await supabase
            .from('perfiles_cliente')
            .select('nombre')
            .eq('id_cliente', userId)
            .single();

        if (perfil) nombreA_Mostrar = perfil.nombre;
    }
    
    const botonSesion = document.querySelector('.btnSesion a');
    if (botonSesion) {
        botonSesion.innerHTML = `<img src="../images/login-icon.png" style="filter: brightness(0) invert(1);"> Ver perfil`;
        botonSesion.href = "../html/perfil.html";
    }
}