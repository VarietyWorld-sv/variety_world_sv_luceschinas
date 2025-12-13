function estandarizarTelefono(telefono) {
    const telLimpio = telefono.replace(/[^\d]/g, '');
    if (telLimpio.length === 8) {
        return `+503${telLimpio}`;
    }
    return telefono.startsWith('+') ? telefono : `+${telLimpio}`;
}

document.addEventListener('DOMContentLoaded', async () => {
    
    const SUPABASE_URL = 'https://fpmsddnonhiqxnsydfpz.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZwbXNkZG5vbmhpcXhuc3lkZnB6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5MTE4NTAsImV4cCI6MjA3ODQ4Nzg1MH0.Lj3q5iOHpGzBhwul1yPx4jxoSB9u-blu5EYJ6lsftXY';
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        window.location.href = 'login.html';
        return;
    }

    cargarDatosPerfil(supabase, user.id, user.email);
    cargarHistorialPedidosBD(supabase, user.id);
    
    calcularNivelCliente(supabase, user.id);

    const btnCamara = document.getElementById('btn-cambiar-foto');
    const inputFoto = document.getElementById('input-foto-archivo');
    const imgPerfil = document.getElementById('foto-perfil-img');

    if (btnCamara && inputFoto) {
        btnCamara.addEventListener('click', () => inputFoto.click());

        inputFoto.addEventListener('change', async (e) => {
            const archivo = e.target.files[0];
            if (!archivo) return;

            if (!archivo.type.startsWith('image/')) {
                alert("Por favor sube un archivo de imagen válido.");
                return;
            }

            if (imgPerfil) imgPerfil.style.opacity = '0.5';
            btnCamara.disabled = true;

            try {
                const fileExt = archivo.name.split('.').pop();
                const fileName = `${user.id}-${Date.now()}.${fileExt}`;
                const filePath = `perfiles/${fileName}`;

                const { error: uploadError } = await supabase.storage
                    .from('fotos_perfil')
                    .upload(filePath, archivo, { upsert: true });

                if (uploadError) throw uploadError;

                const { data: { publicUrl } } = supabase.storage
                    .from('fotos_perfil')
                    .getPublicUrl(filePath);

                const { error: dbError } = await supabase
                    .from('perfiles_cliente')
                    .update({ foto_url: publicUrl })
                    .eq('id_cliente', user.id);

                if (dbError) throw dbError;

                if (imgPerfil) imgPerfil.src = `${publicUrl}?t=${Date.now()}`;
                alert("Foto actualizada correctamente.");
                
            } catch (error) {
                console.error("Error foto:", error);
                alert("Hubo un error al actualizar la foto.");
            } finally {
                if (imgPerfil) imgPerfil.style.opacity = '1';
                btnCamara.disabled = false;
                inputFoto.value = '';
            }
        });
    }

    const modalEdit = document.getElementById('modalEditarPerfil');
    const btnAbrirEdit = document.getElementById('btnAbrirEdicion');
    const spanCloseEdit = document.getElementsByClassName("close-modal-edit")[0];
    const formEdit = document.getElementById('formEditarPerfil');

    if (btnAbrirEdit) {
        btnAbrirEdit.addEventListener('click', async () => {
            modalEdit.style.display = 'flex';
            
            const { data: perfil } = await supabase.from('perfiles_cliente').select('*').eq('id_cliente', user.id).single();
            const { data: usuario } = await supabase.from('usuarios').select('telefono_contacto, correo_electronico').eq('id_usuario', user.id).single();

            if (perfil) {
                document.getElementById('edit-nombre').value = perfil.nombre || '';
                document.getElementById('edit-apellidos').value = perfil.apellidos || '';
                
                document.getElementById('edit-fecha').value = perfil.fecha_nacimiento || ''; 
                document.getElementById('edit-genero').value = perfil.genero || ''; 
                document.getElementById('edit-departamento').value = perfil.departamento || ''; 
                document.getElementById('edit-municipio').value = perfil.municipio || '';
            }
            if (usuario) {
                let telMostrar = usuario.telefono_contacto || '';
                if (telMostrar.startsWith('+503') && telMostrar.length === 12) {
                    telMostrar = telMostrar.substring(4); 
                }
                document.getElementById('edit-telefono').value = telMostrar;
                
                const correoReal = usuario.correo_electronico;
                document.getElementById('edit-email').value = correoReal || '';
            }
        });
    }

    if (spanCloseEdit) spanCloseEdit.onclick = () => modalEdit.style.display = "none";

    if (formEdit) {
        formEdit.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btnSubmit = formEdit.querySelector('button');
            const txtOriginal = btnSubmit.textContent;
            btnSubmit.textContent = "Guardando...";
            btnSubmit.disabled = true;

            const updatesPerfil = {
                nombre: document.getElementById('edit-nombre').value,
                apellidos: document.getElementById('edit-apellidos').value,
                fecha_nacimiento: document.getElementById('edit-fecha').value || null,
                genero: document.getElementById('edit-genero').value,
                departamento: document.getElementById('edit-departamento').value,
                municipio: document.getElementById('edit-municipio').value
            };
            
            const telefonoInput = document.getElementById('edit-telefono').value;
            const nuevoTelefono = estandarizarTelefono(telefonoInput); 
            const nuevoTelefonoLimpio = telefonoInput.replace(/[^\d]/g, ''); 
            const nuevoCorreo = document.getElementById('edit-email').value.trim();

            try {
                const { data: usuarioActual } = await supabase
                    .from('usuarios')
                    .select('correo_electronico')
                    .eq('id_usuario', user.id)
                    .single();

                let correoParaAuth = user.email;
                let correoParaTabla = nuevoCorreo || null;

                if (nuevoCorreo && nuevoCorreo !== usuarioActual.correo_electronico) {
                    
                    const { error: authUpdateError } = await supabase.auth.updateUser({ 
                        email: nuevoCorreo 
                    });
                    
                    if (authUpdateError) throw authUpdateError;
                    
                    correoParaAuth = nuevoCorreo;
                } 

                
                const { error: errPerfil } = await supabase
                    .from('perfiles_cliente')
                    .update(updatesPerfil)
                    .eq('id_cliente', user.id);

                if (errPerfil) throw errPerfil;

                const { error: errUser } = await supabase
                    .from('usuarios')
                    .update({ 
                        telefono_contacto: nuevoTelefono, 
                        telefono_limpio: nuevoTelefonoLimpio,
                        correo_electronico: correoParaTabla 
                    })
                    .eq('id_usuario', user.id);

                if (errUser) throw errUser;


                alert("¡Datos actualizados correctamente!");
                modalEdit.style.display = 'none';
                
                cargarDatosPerfil(supabase, user.id, correoParaAuth); 

            } catch (error) {
                console.error("Error actualización:", error);
                alert("Ocurrió un error al guardar los cambios: " + error.message);
            } finally {
                btnSubmit.textContent = txtOriginal;
                btnSubmit.disabled = false;
            }
        });
    }

    window.onclick = function (event) {
        if (event.target == document.getElementById('orderModal')) {
            document.getElementById('orderModal').style.display = "none";
        }
        if (event.target == modalEdit) {
            modalEdit.style.display = "none";
        }
    }

    const btnCerrar = document.getElementById('btnCerrarSesion');
    if (btnCerrar) {
        btnCerrar.addEventListener('click', async () => {
            await supabase.auth.signOut();
            localStorage.removeItem('carrito_compras');
            window.location.href = '../index.html';
        });
    }

    const spanCloseDetails = document.getElementsByClassName("close-modal")[0];
    if (spanCloseDetails) {
        const modalDetails = document.getElementById('orderModal');
        spanCloseDetails.onclick = function () { modalDetails.style.display = "none"; }
    }
});


async function calcularNivelCliente(supabase, userId) {
    const META_FRECUENTE = 300;

    try {
        const { data: pedidos } = await supabase
            .from('pedidos')
            .select('total_factura')
            .eq('id_usuario', userId)
            .eq('estado_pedido', 'Entregado');

        let totalGastado = 0;
        if (pedidos) {
            pedidos.forEach(p => totalGastado += parseFloat(p.total_factura));
        }

        let porcentaje = (totalGastado / META_FRECUENTE) * 100;
        if (porcentaje > 100) porcentaje = 100;

        const falta = Math.max(0, META_FRECUENTE - totalGastado);

        const barra = document.getElementById('barra-nivel');
        const textoNivel = document.getElementById('texto-nivel');
        const textoFalta = document.getElementById('texto-falta-nivel');
        const contenedor = document.querySelector('.nivel-cliente-card');
        const icono = document.getElementById('icono-medalla');

        setTimeout(() => {
            if(barra) barra.style.width = `${porcentaje}%`;
        }, 500);

        if (totalGastado >= META_FRECUENTE) {
            if(textoNivel) {
                textoNivel.innerText = "¡CLIENTE FRECUENTE!";
                textoNivel.style.color = "#E6B325";
            }
            if(contenedor) contenedor.classList.add('nivel-vip');
            if(textoFalta) textoFalta.innerHTML = "¡Felicidades! Disfrutas de beneficios exclusivos.";
            if(icono) icono.className = "fa-solid fa-crown"; 
            
            await supabase.from('perfiles_cliente').update({ es_frecuente: true }).eq('id_cliente', user.id);

        } else {
            if(textoNivel) textoNivel.innerText = "Explorador";
            if(textoFalta) textoFalta.innerHTML = `Te faltan <span style="color:#E6B325; background-color: transparent; font-weight:bold;">$${falta.toFixed(2)}</span> para ser VIP.`;
        }

    } catch (err) {
        console.error("Error calculando nivel:", err);
    }
}

async function cargarDatosPerfil(supabase, userId, email) {
    const emailEl = document.getElementById('email-txt');
    const passEl = document.getElementById('password-mask-txt');
    const defaultFoto = "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png";

    
    const { data: usuarioData } = await supabase
        .from('usuarios')
        .select('correo_electronico, telefono_contacto')
        .eq('id_usuario', userId)
        .single();

    const correoAuth = email;
    let correoMostrar = "No registrado"; 

    if (usuarioData && usuarioData.correo_electronico) {
        correoMostrar = usuarioData.correo_electronico;
    } else if (correoAuth && !correoAuth.includes('@varietyworld.com')) {
        correoMostrar = correoAuth;
    }
    
    
    if (emailEl) {
        if (correoMostrar === "No registrado") {
            emailEl.textContent = "No registrado";
            emailEl.style.color = '#ccc'; 
        } else {
            emailEl.textContent = correoMostrar;
            emailEl.style.color = '#fff';
        }
    }
    
    if (passEl) passEl.textContent = "********";
    
    if (usuarioData) {
        const telEl = document.getElementById('telefono-txt');
        if (telEl) telEl.textContent = usuarioData.telefono_contacto ? usuarioData.telefono_contacto : 'No registrado';
    }

    try {
        const { data: perfil } = await supabase.from('perfiles_cliente').select('nombre, foto_url').eq('id_cliente', userId).single();
        
        if (perfil) {
            const saludoEl = document.getElementById('saludo-top');
            if (saludoEl) {
                const primerNombre = perfil.nombre ? perfil.nombre.split(' ')[0] : 'Usuario';
                saludoEl.textContent = `Hola, ${primerNombre}`;
            }
            const imgElement = document.getElementById('foto-perfil-img');
            if (imgElement) {
                imgElement.src = perfil.foto_url ? `${perfil.foto_url}?t=${Date.now()}` : defaultFoto;
            }
        }
    } catch (e) { console.error("Error cargando datos:", e); }
}

async function cargarHistorialPedidosBD(supabase, userId) {
    const container = document.getElementById('orders-list-container');
    const totalTxt = document.getElementById('total-compras-txt');
    if (!container) return;
    
    container.innerHTML = '<p style="color:#ccc; font-style: italic;">Cargando tu historial...</p>';
    
    try {
        const { data: pedidos, error } = await supabase
            .from('pedidos')
            .select(`
                id_pedido, fecha_pedido, estado_pedido, total_factura, ubicacion_envio, costo_envio,
                detalles_pedido (
                    cantidad, precio_al_comprar,
                    productos ( nombre )
                )
            `)
            .eq('id_usuario', userId)
            .order('fecha_pedido', { ascending: false });

        if (error) throw error;

        if (!pedidos || pedidos.length === 0) {
            container.innerHTML = `<div style="text-align:center; padding: 30px; background-color: transparent;"><p>Aún no tienes pedidos.</p><a href="productos.html" style="color:#E6B325; background-color: transparent;">Ir a comprar</a></div>`;
            if (totalTxt) totalTxt.textContent = "$0.00";
            return;
        }
        
        container.innerHTML = '';
        let totalGastadoHistorico = 0;

        pedidos.forEach(pedido => {
            
            if (pedido.estado_pedido !== 'Cancelado') {
                totalGastadoHistorico += parseFloat(pedido.total_factura || 0);
            }
            
            const fechaStr = new Date(pedido.fecha_pedido).toLocaleDateString('es-ES');
            const idCorto = '...' + pedido.id_pedido.slice(-6);

            // Recopilar datos de envío y costo
            const direccion = pedido.ubicacion_envio || 'No especificada';
            const costoEnvio = parseFloat(pedido.costo_envio || 0).toFixed(2);
            
            const productosSimple = pedido.detalles_pedido.map(d => ({
                nombre: d.productos?.nombre || 'Producto no disponible',
                cantidad: d.cantidad,
                precio: d.precio_al_comprar
            }));
            const productosEncoded = encodeURIComponent(JSON.stringify(productosSimple));

            let color = '#87CEEB';
            if (pedido.estado_pedido === 'Entregado') color = '#4CAF50';
            if (pedido.estado_pedido === 'Cancelado') color = '#ff4757';

            const html = `
                <div class="order-item">
                    <div class="cajita" style="background:transparent;">
                        <p class="order-id">Pedido ${idCorto}</p>
                        <p class="order-date">${fechaStr}</p>
                        <span style="font-size:0.85em; background-color: transparent; font-weight:bold; color: ${color};">${pedido.estado_pedido}</span>
                    </div>
                    <div class="order-total">$${parseFloat(pedido.total_factura).toFixed(2)}</div>
                    <button class="btn-view-details" onclick="verDetallePedidoBD('${pedido.id_pedido.slice(-6)}', '${fechaStr}', '${pedido.total_factura}', '${productosEncoded}', '${direccion}', '${costoEnvio}')">
                        <i class="fa-solid fa-chevron-right"></i>
                    </button>
                </div>
            `;
            container.innerHTML += html;
        });

        if (totalTxt) totalTxt.textContent = `$${totalGastadoHistorico.toFixed(2)}`;

    } catch (err) { console.error(err); }
}


window.verDetallePedidoBD = function (id, fecha, total, encoded, direccion, costoEnvio) {
    const modal = document.getElementById('orderModal');
    const body = document.getElementById('modal-body-content');
    const prods = JSON.parse(decodeURIComponent(encoded));

    let list = '';
    prods.forEach(p => list += `<li>${p.cantidad}x ${p.nombre} - $${(p.precio * p.cantidad).toFixed(2)}</li>`);
    
    const totalFloat = parseFloat(total);
    const costoEnvioFloat = parseFloat(costoEnvio);
    const subtotal = (totalFloat - costoEnvioFloat).toFixed(2);
    
    body.innerHTML = `
        <h3>Pedido #${id}</h3>
        <p>${fecha}</p>
        
        <h4 style="margin-top: 15px; background-color: transparent;">Productos:</h4>
        <ul style="margin-bottom: 15px;">${list}</ul>
        
        <div style="background-color: transparent; border-top: 1px dashed #444; padding-top: 10px;">
            <p style="background-color: transparent; font-weight: bold;">
                Dirección de envío: 
                <span style="font-weight: normal; background-color: transparent;">${direccion}</span>
            </p>
            <p style="background-color: transparent; margin-top: 5px;">
                Subtotal (Productos): 
                <span style="float: right; background-color: transparent;">$${subtotal}</span>
            </p>
            <p style="background-color: transparent;">
                Costo de envío: 
                <span style="float: right; background-color: transparent;">$${costoEnvio}</span>
            </p>
        </div>

        <h3 style="text-align:right; color:#E6B325; background-color: transparent; margin-top: 15px;">
            Total: $${totalFloat.toFixed(2)}
        </h3>
    `;
    modal.style.display = "flex";
}