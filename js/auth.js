const SUPABASE_URL = 'https://fpmsddnonhiqxnsydfpz.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZwbXNkZG5vbmhpcXhuc3lkZnB6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5MTE4NTAsImV4cCI6MjA3ODQ4Nzg1MH0.Lj3q5iOHpGzBhwul1yPx4jxoSB9u-blu5EYJ6lsftXY';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

function estandarizarTelefono(telefono) {
    const telLimpio = telefono.replace(/[^\d]/g, '');
    if (telLimpio.length === 8) {
        return `+503${telLimpio}`;
    }
    // Asegura que siempre tenga el '+' si no lo tiene, para evitar errores de formato en la BD
    return telefono.startsWith('+') ? telefono : `+${telLimpio}`;
}

const registroForm = document.getElementById('registroForm');

if (registroForm) {
    registroForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const nombre = document.getElementById('nombre').value;
        const apellidos = document.getElementById('apellidos').value;
        const telefono = estandarizarTelefono(document.getElementById('telefono').value);
        const password = document.getElementById('reg-password').value;

        const correoFalso = `tel_${telefono.replace('+', '')}@varietyworld.com`;

        try {
            // 1. VALIDACIÓN DE EXISTENCIA DEL TELÉFONO EN LA BASE DE DATOS
            const { data: existente } = await supabase
                .from('usuarios')
                .select('id_usuario')
                .eq('telefono_contacto', telefono)
                .maybeSingle();
            
            if (existente) {
                alert('Hubo un error al registrarse: Este número de teléfono ya está asociado a una cuenta.');
                return; // Detiene el registro si ya existe en la tabla usuarios
            }

            // 2. REGISTRO EN SUPABASE AUTH
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: correoFalso, 
                password: password
            });

            if (authError) throw authError;

            const userId = authData.user.id;

            // 3. INSERCIÓN EN TABLA USUARIOS
            const { error: tablaUsuarioError } = await supabase
                .from('usuarios')
                .insert([{
                    id_usuario: userId,
                    // Dejamos correo_electronico como NULL ya que es teléfono-only
                    correo_electronico: null, 
                    tipo_usuario: 'Cliente',
                    telefono_contacto: telefono
                }]);

            if (tablaUsuarioError) throw tablaUsuarioError;

            // 4. INSERCIÓN EN PERFILES
            const { error: perfilError } = await supabase
                .from('perfiles_cliente')
                .insert([{
                    id_cliente: userId,
                    nombre: nombre,
                    apellidos: apellidos,
                    total_compras: 0,
                    es_frecuente: false
                }]);

            if (perfilError) throw perfilError;

            alert('¡Registro exitoso! Ya puedes iniciar sesión usando tu teléfono y contraseña.');
            window.location.href = 'login.html';

        } catch (error) {
            console.error('Error:', error);
            // Mostrar error específico si es por credenciales ya usadas (por si falla la validación previa)
            if (error.message && error.message.includes('User already registered')) {
                 alert('Hubo un error al registrarse: Este número de teléfono ya está asociado a una cuenta.');
            } else {
                 alert('Hubo un error al registrarse: ' + error.message);
            }
        }
    });
}

const loginForm = document.getElementById('loginForm');

if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const inputValor = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;

        let authParams = {};

        if (inputValor.includes('@')) {
            // LOGIN CON CORREO
            authParams.email = inputValor;
        } else {
            // LOGIN CON TELÉFONO
            const telefonoEstandarizado = estandarizarTelefono(inputValor);
            const telLimpio = telefonoEstandarizado.replace(/[^\d]/g, '');

            if (telLimpio.length < 6) {
                 alert('Error: El teléfono debe tener al menos 6 dígitos.');
                 return;
            }

            // CLAVE: Buscar por ambos formatos posibles (+503... O 60376012)
            const { data: usuario, error: userError } = await supabase
                .from('usuarios')
                .select('id_usuario, correo_electronico, telefono_contacto')
                .or(`telefono_contacto.eq.${telefonoEstandarizado},telefono_contacto.eq.${telLimpio}`)
                .maybeSingle();

            if (userError || !usuario) {
                alert('Error: Teléfono no encontrado.');
                return;
            }
            
            // Reconstruir Correo Falso para el login nativo
            const telParaCorreo = usuario.telefono_contacto.replace('+', '');
            const correoFalsoReconstruido = `tel_${telParaCorreo}@varietyworld.com`;
            
            // Usar el correo de la BD (si existe) o el reconstruido si es NULL
            authParams.email = usuario.correo_electronico || correoFalsoReconstruido;
        }
        
        // Ejecutar login nativo
        const { data, error } = await supabase.auth.signInWithPassword({
            email: authParams.email,
            password: password
        });

        if (error) {
            alert('Error: Credenciales incorrectas o usuario no encontrado.');
        } else {
            const userId = data.user.id;
            try {
                // Lógica de verificación de rol y redirección (sin cambios)
                const { data: usuarioData } = await supabase
                    .from('usuarios')
                    .select('tipo_usuario')
                    .eq('id_usuario', userId)
                    .single();

                const { data: perfilData } = await supabase
                    .from('perfiles_cliente')
                    .select('nombre')
                    .eq('id_cliente', userId)
                    .single();

                const nombreMostrar = perfilData ? perfilData.nombre : 'Usuario';

                if (usuarioData && ['administrador', 'admin', 'ayudante', 'Ayudante'].includes(usuarioData.tipo_usuario.toLowerCase())) {
                    alert(`¡Bienvenido al Panel de Control, ${nombreMostrar}!`);
                    window.location.href = '../html/admin.html';
                } else {
                    alert(`¡Bienvenido de nuevo, ${nombreMostrar}!`);
                    window.location.href = '../index.html';
                }

            } catch (err) {
                console.error("Error verificando rol:", err);
                window.location.href = '../index.html';
            }
        }
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
        gestionarUsuarioLogueado(user.id);
    }
});

async function gestionarUsuarioLogueado(userId) {
    const { data: usuarioData, error } = await supabase
        .from('usuarios')
        .select('tipo_usuario')
        .eq('id_usuario', userId)
        .single();

    if (error || !usuarioData) return;

    let nombreA_Mostrar = "Usuario";
    const esStaff = ['administrador', 'admin', 'ayudante', 'Ayudante'].includes(usuarioData.tipo_usuario.toLowerCase());

    if (usuarioData.tipo_usuario.toLowerCase() === 'cliente' || esStaff) {
        const { data: perfil } = await supabase
            .from('perfiles_cliente')
            .select('nombre')
            .eq('id_cliente', userId)
            .single();

        if (perfil) nombreA_Mostrar = perfil.nombre;
    }

    actualizarBotonSesion(nombreA_Mostrar);

    if (esStaff && !window.location.href.includes('admin.html')) {
        crearBotonFlotanteAdmin();
    }
}

function actualizarBotonSesion(nombre) {
    const botonSesion = document.querySelector('.btnSesion a');

    if (botonSesion) {
        botonSesion.innerHTML = `
            <img src="../images/login-icon.png" style="filter: brightness(0) invert(1);"> 
            Ver perfil
        `;
        botonSesion.href = "../html/perfil.html";

        const nuevoBoton = botonSesion.cloneNode(true);
        botonSesion.parentNode.replaceChild(nuevoBoton, botonSesion);
    }
}

function crearBotonFlotanteAdmin() {
    if (document.getElementById('btn-volver-dashboard')) return;

    const btn = document.createElement('a');
    btn.id = 'btn-volver-dashboard';
    btn.href = '../html/admin.html';
    
    btn.className = 'btn-volver-dashboard'; 

    btn.innerHTML = '<i class="fa-solid fa-gauge-high"></i> Volver al dashboard';

    document.body.appendChild(btn);
}