import { supabase } from '../../config.js';
import * as UI from '../../ui.js';
import * as Analytics from '../../analytics.js';
import * as Products from '../../products.js';
import * as Users from '../../users.js';
import * as Zones from '../../zones.js';
import * as Orders from '../../orders.js';
import * as Combos from '../../combos.js';

document.addEventListener('DOMContentLoaded', async () => {

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        window.location.href = '../html/login.html';
        return;
    }

    const { data: userData } = await supabase
        .from('usuarios')
        .select('tipo_usuario')
        .eq('id_usuario', user.id)
        .single();

    if (!userData || !['administrador', 'admin', 'ayudante'].includes(userData.tipo_usuario.toLowerCase())) {
        alert("Acceso denegado.");
        window.location.href = '../index.html';
        return;
    }

    const textoRol = document.getElementById('sidebar-rol-texto');
    const imgRol = document.getElementById('sidebar-foto-perfil');
    const rol = userData.tipo_usuario; 

    if (textoRol) textoRol.innerText = rol;

    if (imgRol) {
        if (rol.toLowerCase() === 'ayudante') {
            imgRol.src = "https://cdn-icons-png.flaticon.com/512/4537/4537019.png"; 
            imgRol.style.borderColor = "#d05ce3"; 
        } else {
            imgRol.src = "https://cdn-icons-png.flaticon.com/512/9703/9703596.png";
            imgRol.style.borderColor = "#E6B325"; 
        }
    }

    Analytics.cargarAnaliticas();

    const formProd = document.getElementById('formProducto');
    if (formProd) {
        formProd.addEventListener('submit', Products.guardarProducto);
    }

    const formZona = document.getElementById('formZona');
    if (formZona) {
        formZona.addEventListener('submit', Zones.guardarZona);
    }
    
    const formCombo = document.getElementById('formCombo');
    if (formCombo) formCombo.addEventListener('submit', Combos.guardarCombo);

    const btnSalir = document.getElementById('btnCerrarSesionAdmin');
    if (btnSalir) {
        btnSalir.addEventListener('click', async (e) => {
            e.preventDefault();
            await supabase.auth.signOut();
            window.location.href = '../html/login.html';
        });
    }
    
    const btnMenu = document.getElementById('btnMenuMobile');
    const sidebar = document.querySelector('.admin-sidebar');
    let overlay = document.querySelector('.menu-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'menu-overlay';
        document.body.appendChild(overlay);
    }
    if (btnMenu) {
        btnMenu.addEventListener('click', () => {
            sidebar.classList.toggle('active');
            overlay.classList.toggle('active');
        });
    }
    overlay.addEventListener('click', () => {
        sidebar.classList.remove('active');
        overlay.classList.remove('active');
    });
});

// Funciones expuestas globalmente
window.mostrarSeccion = (id, el) => {
    UI.mostrarSeccion(id, el);

    if (id === 'productos') Products.cargarProductos();
    if (id === 'usuarios') Users.cargarUsuarios();
    if (id === 'zonas') Zones.cargarZonas();
    if (id === 'pedidos') Orders.cargarPedidos();
    if (id === 'dashboard') Analytics.cargarAnaliticas();
    if (id === 'combos') Combos.cargarCombos();
};

window.cerrarModal = UI.cerrarModal;

window.abrirModalProducto = Products.prepararCreacionProducto;
window.prepararEdicionProducto = Products.prepararEdicionProducto;
window.eliminarProducto = Products.eliminarProducto;

window.cambiarRol = Users.cambiarRol;

window.abrirModalZona = Zones.prepararCreacionZona;
window.prepararEdicionZona = Zones.prepararEdicionZona;
window.eliminarZona = Zones.eliminarZona;

window.gestionarPedido = Orders.gestionarPedido;

window.abrirModalCombo = Combos.prepararCreacionCombo;
window.editarCombo = Combos.prepararEdicionCombo;
window.eliminarCombo = Combos.eliminarCombo;