import { supabase } from './config.js';

export async function cargarUsuarios() {
    const tbody = document.getElementById('tabla-usuarios-body');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;background-color:transparent;">Cargando...</td></tr>';

    const { data: usuarios, error } = await supabase
        .from('usuarios')
        .select(`id_usuario, correo_electronico, tipo_usuario, telefono_contacto`)
        .order('tipo_usuario');
    
    if (error) {
        console.error("Error cargando usuarios:", error);
        tbody.innerHTML = `<tr><td colspan="5" style="color:#ff4757; text-align:center;">Error al cargar usuarios. (Verifique permisos RLS en usuarios)</td></tr>`;
        return;
    }

    if (!usuarios || usuarios.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#ccc;">No se encontraron usuarios.</td></tr>`;
        return;
    }

    const promesasUsuarios = usuarios.map(async (u) => {
        
        const { data: perfil } = await supabase
            .from('perfiles_cliente')
            .select('nombre, apellidos, departamento, municipio, fecha_nacimiento, genero')
            .eq('id_cliente', u.id_usuario)
            .maybeSingle(); 

        let nombreCompleto = '';
        let contactoPrincipal = u.telefono_contacto || u.correo_electronico || 'N/A';
        
        
        if (perfil) {
            nombreCompleto = `${perfil.nombre || ''} ${perfil.apellidos || ''}`.trim();
        }

        if (nombreCompleto === '') {
            nombreCompleto = u.correo_electronico || `ID: ${u.id_usuario.slice(0, 8)}`;
        }
        
        const direccion = (perfil?.departamento && perfil?.municipio) ? `${perfil.departamento}, ${perfil.municipio}` : 'N/A';
        const fechaNac = perfil?.fecha_nacimiento || 'N/A';
        const genero = perfil?.genero || 'N/A';


        return {
            ...u,
            nombreCompleto,
            contactoPrincipal,
            direccion,
            fechaNac,
            genero
        };
    });

    
    const usuariosConPerfil = await Promise.all(promesasUsuarios);

    tbody.innerHTML = '';

    
    usuariosConPerfil.forEach(u => {
        const rolLower = u.tipo_usuario.toLowerCase();
        let claseBadge = 'procesando'; 

        if (['administrador', 'admin'].includes(rolLower)) {
            claseBadge = 'administrador'; 
        } else if (rolLower === 'ayudante') {
            claseBadge = 'ayudante'; 
        } else if (rolLower === 'proveedor') {
            claseBadge = 'enviado'; 
        }
        
        tbody.innerHTML += `
            <tr>
                <td style="color:#E6B325; font-weight:bold;">${u.nombreCompleto}</td>
                <td style="font-size:0.9em; color:#ccc;">${u.contactoPrincipal}</td>
                <td><span class="status-badge ${claseBadge}">${u.tipo_usuario}</span></td>
                <td>
                    <select class="input-tabla" id="rol-${u.id_usuario}">
                        <option value="Cliente">Cliente</option>
                        <option value="Proveedor">Proveedor</option>
                        <option value="Ayudante">Ayudante</option>
                        <option value="Administrador">Administrador</option>
                    </select>
                </td>
                <td>
                    <button class="btn-action" onclick="window.cambiarRol('${u.id_usuario}')">Guardar</button>
                    <button class="btn-action btn-detalles" onclick='window.abrirModalDetalles(${JSON.stringify(u)})'>Ver detalles</button>
                </td>
            </tr>
        `;

        
        setTimeout(() => {
            const sel = document.getElementById(`rol-${u.id_usuario}`);
            if (sel) sel.value = u.tipo_usuario;
        }, 0);
    });
}


window.abrirModalDetalles = (usuario) => {
    const modal = document.getElementById('modalDetallesUsuario');
    const contenido = document.getElementById('modalDetallesContent');
    
    if (!modal || !contenido) {
        alert("Falta el modal de detalles en admin.html");
        return;
    }

    const contenidoHTML = `
        <h3 style="color:#E6B325; margin-bottom: 15px;">Detalles de ${usuario.nombreCompleto}</h3>
        <p><strong>ID de Usuario:</strong> ${usuario.id_usuario.slice(0, 8)}</p>
        <p><strong>Teléfono:</strong> ${usuario.telefono_contacto || 'N/A'}</p>
        <p><strong>Email Principal:</strong> ${usuario.correo_electronico || 'N/A'}</p>
        <hr style="border-top: 1px solid #333; margin: 10px 0;">
        <p><strong>Fecha de Nacimiento:</strong> ${usuario.fechaNac}</p>
        <p><strong>Género:</strong> ${usuario.genero}</p>
        <p><strong>Dirección:</strong> ${usuario.direccion}</p>
    `;

    contenido.innerHTML = contenidoHTML;
    modal.style.display = 'flex';
};


window.onclick = function(event) {
    const modal = document.getElementById('modalDetallesUsuario');
    if (modal && event.target == modal) {
        modal.style.display = "none";
    }
}

export async function cambiarRol(idUsuario) {
    const nuevoRol = document.getElementById(`rol-${idUsuario}`).value;
    
    if (!confirm(`¿Cambiar rol a ${nuevoRol}?`)) return;
    
    const { error } = await supabase
        .from('usuarios')
        .update({ tipo_usuario: nuevoRol })
        .eq('id_usuario', idUsuario);

    if (error) {
        alert("Error: " + error.message);
    } else {
        alert("Rol actualizado exitosamente.");
        cargarUsuarios();
    }
}