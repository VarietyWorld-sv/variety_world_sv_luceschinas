document.addEventListener('DOMContentLoaded', async () => {

    const SUPABASE_URL = 'https://fpmsddnonhiqxnsydfpz.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZwbXNkZG5vbmhpcXhuc3lkZnB6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5MTE4NTAsImV4cCI6MjA3ODQ4Nzg1MH0.Lj3q5iOHpGzBhwul1yPx4jxoSB9u-blu5EYJ6lsftXY';

    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    var map = L.map('mapa-envios', {
        attributionControl: false
    }).setView([13.6929, -89.2182], 10);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
    }).addTo(map);

    const listaContainer = document.getElementById('lista-lugares');

    function pintarZona(nombre, lat, lng, precio) {
        if (lat && lng) {
            L.marker([lat, lng])
                .addTo(map)
                .bindPopup(`
                    <div style="text-align:center">
                        <strong>${nombre}</strong><br>
                        Envío: <strong>$${parseFloat(precio).toFixed(2)}</strong>
                    </div>
                `);
        }

        const item = document.createElement('li');
        item.innerHTML = `
            <span>${nombre}</span> 
            <span class="texto-precio" style="color:#E6B325; font-weight:bold;">$${parseFloat(precio).toFixed(2)}</span>
        `;

        if (lat && lng) {
            item.addEventListener('click', () => {
                map.flyTo([lat, lng], 13, { duration: 1.5 });
            });
        }

        if (listaContainer) {
            listaContainer.appendChild(item);
        }
    }

    // Cargar las zonas desde la BD
    async function cargarZonasDesdeBD() {
        if (listaContainer) listaContainer.innerHTML = '<p style="padding:15px; color:#ccc;">Cargando tarifas...</p>';

        try {
            const { data: zonas, error } = await supabase
                .from('zonas_envio')
                .select('*')
                .order('costo_base', { ascending: true });

            if (error) throw error;

            if (listaContainer) listaContainer.innerHTML = '';

            if (zonas && zonas.length > 0) {
                zonas.forEach(zona => {
                    pintarZona(zona.nombre_zona, zona.latitud, zona.longitud, zona.costo_base);
                });
            } else {
                if (listaContainer) listaContainer.innerHTML = '<p style="padding:15px;">No hay zonas disponibles.</p>';
            }

        } catch (err) {
            console.error("Error cargando zonas:", err.message);
            if (listaContainer) listaContainer.innerHTML = '<p style="padding:15px; color:red;">Error al cargar mapa.</p>';
        }
    }

    cargarZonasDesdeBD();


    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
        gestionarUsuarioLogueado(user.id);
    }
    // Función para gestionar usuario logueado
    async function gestionarUsuarioLogueado(userId) {
        const { data: usuarioData } = await supabase
            .from('usuarios')
            .select('tipo_usuario')
            .eq('id_usuario', userId)
            .single();

        if (!usuarioData) return;

        let nombreA_Mostrar = "Usuario";

        if (usuarioData.tipo_usuario === 'Cliente' || usuarioData.tipo_usuario === 'cliente') {
            const { data: perfil } = await supabase
                .from('perfiles_cliente')
                .select('nombre')
                .eq('id_cliente', userId)
                .single();

            if (perfil) nombreA_Mostrar = perfil.nombre;
        }
        
        actualizarBotonSesion(nombreA_Mostrar);
    }
    
    function actualizarBotonSesion(nombre) {
        const botonSesion = document.querySelector('.btnSesion a');
        if (botonSesion) {
            botonSesion.innerHTML = `<img src="../images/login-icon.png" style="filter: brightness(0) invert(1);"> Ver perfil`;
            botonSesion.href = "../html/perfil.html";
            const nuevoBoton = botonSesion.cloneNode(true);
            botonSesion.parentNode.replaceChild(nuevoBoton, botonSesion);
        }
    }
});