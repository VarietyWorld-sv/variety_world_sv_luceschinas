export function mostrarSeccion(idSeccion, elementoLi) {
    document.querySelectorAll('.seccion-admin').forEach(sec => {
        sec.style.display = 'none';
    });

    document.querySelectorAll('.admin-menu li').forEach(li => {
        li.classList.remove('active');
    });

    const seccion = document.getElementById('sec-' + idSeccion);
    if (seccion) {
        seccion.style.display = 'block';
    }

    if (elementoLi) {
        elementoLi.classList.add('active');
    }
}

export function abrirModal(idModal) {
    const modal = document.getElementById(idModal);
    if (modal) {
        modal.style.display = 'flex';
    }
}

export function cerrarModal(idModal) {
    const modal = document.getElementById(idModal);
    if (modal) {
        modal.style.display = 'none';
    }
}

window.onclick = (e) => {
    if (e.target.classList.contains('modal-overlay')) {
        e.target.style.display = 'none';
    }
};