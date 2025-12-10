import { supabase } from './config.js';
import * as UI from './ui.js';

let idComboEdit = null;
let comboItemsTemp = []; 

function convertirUrlImagen(url) {
    if (!url || url.trim() === '') return 'https://via.placeholder.com/40';
    
    if (url.includes('drive.google.com') || url.includes('docs.google.com')) {
        const idMatch = url.match(/\/d\/(.*?)\/|id=(.*?)(&|$)/);
        const id = idMatch ? (idMatch[1] || idMatch[2]) : null;
        
        if (id) {
            return `https://drive.google.com/thumbnail?id=${id}&sz=w500`;
        }
    }

    if (url.includes('dropbox.com')) {
        return url.replace('dl=0', 'raw=1');
    }

    return url;
}

function calcularTotalNormal() {
	let total = 0;
	comboItemsTemp.forEach(item => {
		total += item.cantidad * item.precio_unitario;
	});
	document.getElementById('combo-precio-normal').innerText = `$${total.toFixed(2)}`;
	return total;
}


function calcularPrecioOferta() {
    const totalNormal = calcularTotalNormal();
    const inputDescuento = document.getElementById('combo-descuento-porcentaje');
    const inputPrecioFinal = document.getElementById('combo-precio-calculado');
    const inputPrecioOculto = document.getElementById('combo-precio');
    
    let descuentoPct = parseFloat(inputDescuento.value) || 0;
    
    if (descuentoPct < 0) descuentoPct = 0;
    if (descuentoPct > 100) descuentoPct = 100;
    inputDescuento.value = descuentoPct;
    
    const precioFinal = totalNormal * (1 - (descuentoPct / 100));

    inputPrecioFinal.value = `$${precioFinal.toFixed(2)}`;
    inputPrecioOculto.value = precioFinal.toFixed(2);
}


function redibujarTablaItems() {
	const tbody = document.getElementById('tabla-combo-items');
	if (!tbody) return;

	tbody.innerHTML = '';
	
	if (comboItemsTemp.length === 0) {
		tbody.innerHTML = '<tr id="empty-combo-row"><td colspan="5" style="text-align:center; color:#999;">Aún no hay productos en este combo.</td></tr>';
		calcularTotalNormal();
		return;
	}
	
	comboItemsTemp.forEach((item, index) => {
		const subtotal = item.cantidad * item.precio_unitario;
		const img = convertirUrlImagen(item.imagen_url); 
		
		tbody.innerHTML += `
			<tr id="combo-item-${index}">
				<td>
					<img src="${img}" style="width: 30px; height: 30px; border-radius: 5px; margin-right: 10px;" onerror="this.src='https://via.placeholder.com/30'">
					${item.nombre}
				</td>
				<td>$${item.precio_unitario.toFixed(2)}</td>
				<td style="text-align:center;">${item.cantidad}</td>
				<td style="font-weight:bold;">$${subtotal.toFixed(2)}</td>
				<td>
					<button type="button" class="btn-action" style="background:#E62525; padding:5px 10px;" 
						onclick="window.removerItemCombo(${index})">
						<i class="fa-solid fa-trash"></i>
					</button>
				</td>
			</tr>
		`;
	});
	
	calcularTotalNormal();
    calcularPrecioOferta();
}

async function cargarProductosDisponibles() {
	const select = document.getElementById('select-add-combo-producto');
	if (!select || select.children.length > 1) return; 

	const { data: productos } = await supabase
		.from('productos')
		.select('id_producto, nombre, precio_unitario, stock, imagen_url')
		.gt('stock', 0)
		.order('nombre');

	select.innerHTML = '<option value="">Seleccionar producto...</option>';
	if(productos) {
		productos.forEach(p => {
			const imgUrlConvertida = convertirUrlImagen(p.imagen_url); 
            
			const option = document.createElement('option');
			option.value = p.id_producto;
			option.text = `${p.nombre} ($${p.precio_unitario.toFixed(2)})`;
			option.dataset.nombre = p.nombre;
			option.dataset.precio = p.precio_unitario;
			option.dataset.imagen = imgUrlConvertida;
			select.appendChild(option);
		});
	}
}

window.agregarItemCombo = () => {
	const select = document.getElementById('select-add-combo-producto');
	const inputCant = document.getElementById('input-add-combo-cantidad');

	const idProducto = select.value;
	const cantidad = parseInt(inputCant.value);
	
	if (!idProducto) return alert("Por favor, selecciona un producto.");
	if (cantidad < 1 || isNaN(cantidad)) return alert("La cantidad debe ser 1 o más.");

	const opt = select.options[select.selectedIndex];
	const nombre = opt.dataset.nombre;
	const precio = parseFloat(opt.dataset.precio);
	const imagen = opt.dataset.imagen;

	const existente = comboItemsTemp.findIndex(item => item.id_producto === idProducto);
	
	if (existente !== -1) {
		comboItemsTemp[existente].cantidad += cantidad;
	} else {
		comboItemsTemp.push({
			id_producto: idProducto,
			nombre: nombre,
			precio_unitario: precio,
			cantidad: cantidad,
			imagen_url: imagen
		});
	}

	redibujarTablaItems();
	inputCant.value = 1; 
};

window.removerItemCombo = (index) => {
	comboItemsTemp.splice(index, 1);
	redibujarTablaItems();
};

document.getElementById('btn-add-combo-item')?.addEventListener('click', window.agregarItemCombo);
document.getElementById('combo-descuento-porcentaje')?.addEventListener('input', calcularPrecioOferta);

export function prepararCreacionCombo() {
	document.getElementById('formCombo').reset();
	idComboEdit = null;
	comboItemsTemp = [];
	document.querySelector('#tituloModalCombo').innerText = "Nuevo Combo";
	cargarProductosDisponibles();
	redibujarTablaItems(); 
	UI.abrirModal('modalComboAdmin');
}

export function prepararEdicionCombo(combo) {
    document.querySelector('#tituloModalCombo').innerText = "Editar Combo";
    idComboEdit = combo.id_combo;
    
    comboItemsTemp = JSON.parse(combo.productos_json || '[]'); 
    
    document.getElementById('combo-nombre').value = combo.nombre;

    document.getElementById('combo-precio').value = combo.precio;
    document.getElementById('combo-imagen').value = combo.imagen_url || '';
    document.getElementById('combo-desc').value = combo.descripcion || '';
    document.getElementById('combo-activo').value = combo.activo ? "true" : "false";

    const descuentoGuardado = combo.descuento_porcentaje || 0;
    document.getElementById('combo-descuento-porcentaje').value = descuentoGuardado; 

    const precioNormalGuardado = parseFloat(combo.precio_normal_sumado || 0);
    document.getElementById('combo-precio-normal').innerText = `$${precioNormalGuardado.toFixed(2)}`;

    cargarProductosDisponibles();
    redibujarTablaItems();
    
    calcularPrecioOferta(); 

    UI.abrirModal('modalComboAdmin');
}


export async function cargarCombos() {
	const tbody = document.getElementById('tabla-combos-body');
	if (!tbody) return;

	tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Cargando...</td></tr>';

	const { data, error } = await supabase
		.from('combos')
		.select(`*, productos_json, precio_normal_sumado`)
		.order('id_combo', { ascending: false });

	if (error) {
		console.error(error);
		tbody.innerHTML = '<tr><td colspan="5">Error al cargar</td></tr>';
		return;
	}

	tbody.innerHTML = '';
	if (data) {
		data.forEach(c => {
			const img = convertirUrlImagen(c.imagen_url); 
			const estado = c.activo ? '<span class="status-badge entregado">Activo</span>' : '<span class="status-badge cancelado">Inactivo</span>';
			
            const jsonC = JSON.stringify(c).replace(/"/g, '&quot;'); 


			tbody.innerHTML += `
				<tr>
					<td><img src="${img}" class="img-thumb" onerror="this.src='https://via.placeholder.com/40'"></td>
					<td>${c.nombre}</td>
					<td>$${parseFloat(c.precio).toFixed(2)}</td>
					<td>${estado}</td>
					<td>
						<button class="btn-action" onclick='window.editarCombo(${jsonC})'><i class="fa-solid fa-pen"></i></button>
						<button class="btn-action" style="background:#E62525" onclick="window.eliminarCombo('${c.id_combo}')"><i class="fa-solid fa-trash"></i></button>
					</td>
				</tr>
			`;
		});
	}
}

export async function guardarCombo(e) {
    e.preventDefault();

    if (comboItemsTemp.length === 0) {
        return alert("El combo debe incluir al menos un producto.");
    }

    const totalNormalCalculado = calcularTotalNormal();
    const precioDescontado = parseFloat(document.getElementById('combo-precio').value); 
    
    // Obtener el porcentaje de descuento
    const descuentoPct = parseFloat(document.getElementById('combo-descuento-porcentaje').value);

    const btn = e.target.querySelector('button');
    btn.disabled = true; btn.innerText = "Guardando...";

    const datosBase = {
        nombre: document.getElementById('combo-nombre').value,
        precio: precioDescontado, // Precio final calculado
        imagen_url: document.getElementById('combo-imagen').value,
        descripcion: document.getElementById('combo-desc').value,
        activo: document.getElementById('combo-activo').value === "true",
        
        descuento_porcentaje: descuentoPct,
        productos_json: JSON.stringify(comboItemsTemp), 
        precio_normal_sumado: totalNormalCalculado     
    };

    let error;
    if (idComboEdit) {
        ({ error } = await supabase.from('combos').update(datosBase).eq('id_combo', idComboEdit));
    } else {
        ({ error } = await supabase.from('combos').insert([datosBase]));
    }

    btn.disabled = false; btn.innerText = "Guardar Combo";

    if (error) alert("Error: " + error.message);
    else {
        alert("Combo guardado.");
        UI.cerrarModal('modalComboAdmin');
        cargarCombos();
    }
}

export async function eliminarCombo(id) {
	if(!confirm("¿Borrar este combo?")) return;
	const { error } = await supabase.from('combos').delete().eq('id_combo', id);
	if(error) alert("Error al borrar.");
	else cargarCombos();
}

window.agregarItemCombo = window.agregarItemCombo;
window.removerItemCombo = window.removerItemCombo;
window.prepararCreacionCombo = prepararCreacionCombo;
window.prepararEdicionCombo = prepararEdicionCombo;
window.editarCombo = prepararEdicionCombo;
window.eliminarCombo = eliminarCombo;
