import { supabase } from './config.js';
import { abrirModal, cerrarModal } from './ui.js';

let idZonaEdit = null;

export async function cargarZonas() {
    const tbody = document.getElementById('tabla-zonas-body');
    if (!tbody) return;

    const { data } = await supabase.from('zonas_envio').select('*').order('costo_base');
    tbody.innerHTML = '';

    if (data) {
        data.forEach(z => {
            const jsonZ = JSON.stringify(z).replace(/'/g, "&#39;");

            tbody.innerHTML += `
                <tr>
                    <td>${z.nombre_zona}</td>
                    <td>$${parseFloat(z.costo_base).toFixed(2)}</td>
                    <td>
                        <button class="btn-action" onclick='window.prepararEdicionZona(${jsonZ})'>
                            <i class="fa-solid fa-pen"></i>
                        </button>
                        <button class="btn-action" onclick="window.eliminarZona('${z.id_zona}')" style="background-color:#E62525; border-color:#E62525;">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        });
    }
}

export function prepararCreacionZona() {
    document.getElementById('formZona').reset();
    idZonaEdit = null;
    abrirModal('modalZonaAdmin');
}

export function prepararEdicionZona(zona) {
    idZonaEdit = zona.id_zona;
    document.getElementById('zona-nombre').value = zona.nombre_zona;
    document.getElementById('zona-costo').value = zona.costo_base;
    abrirModal('modalZonaAdmin');
}

export async function guardarZona(e) {
    e.preventDefault();
    const datos = {
        nombre_zona: document.getElementById('zona-nombre').value,
        costo_base: document.getElementById('zona-costo').value
    };
    
    let error;
    if (idZonaEdit) {
        ({ error } = await supabase.from('zonas_envio').update(datos).eq('id_zona', idZonaEdit));
    } else {
        ({ error } = await supabase.from('zonas_envio').insert([datos]));
    }

    if (error) {
        alert("Error: " + error.message);
    } else {
        cerrarModal('modalZonaAdmin');
        cargarZonas();
    }
}

export async function eliminarZona(id) {
    if (!confirm("¿Borrar esta zona?")) return;
    const { error } = await supabase.from('zonas_envio').delete().eq('id_zona', id);
    if (error) alert("Error al eliminar.");
    else cargarZonas();
}