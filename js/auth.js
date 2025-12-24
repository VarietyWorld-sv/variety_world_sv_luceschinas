var SUPABASE_URL = 'https://fpmsddnonhiqxnsydfpz.supabase.co';
var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZwbXNkZG5vbmhpcXhuc3lkZnB6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5MTE4NTAsImV4cCI6MjA3ODQ4Nzg1MH0.Lj3q5iOHpGzBhwul1yPx4jxoSB9u-blu5EYJ6lsftXY';

//const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

if (typeof supabase === 'undefined') {
    window.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
} else {
    if (!window.supabase.auth) {
        window.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    }
}

var supabase = window.supabase;

function estandarizarTelefono(telefono) {
    const telLimpio = telefono.replace(/[^\d]/g, '');
    if (telLimpio.length === 8) {
        return `+503${telLimpio}`;
    }
    return telefono.startsWith('+') ? telefono : `+${telLimpio}`;
}

const registroForm = document.getElementById('registroForm');

if (registroForm) {
    registroForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const nombre = document.getElementById('nombre').value;
        const apellidos = document.getElementById('apellidos').value;
        const telefonoInput = document.getElementById('telefono').value;
        const telefono = estandarizarTelefono(telefonoInput);
        const telefonoLimpio = telefonoInput.replace(/[^\d]/g, '');
        const password = document.getElementById('reg-password').value;
        
        const correoIngresado = document.getElementById('reg-email').value.trim();
        const correoFalso = `tel_${telefono.replace('+', '')}@varietyworld.com`;
        
        const correoParaAuth = correoIngresado || correoFalso;
        const correoParaTabla = correoIngresado || null; 

        try {
            const { data: existente } = await supabase
                .from('usuarios')
                .select('id_usuario')
                .or(`telefono_contacto.eq.${telefono},telefono_limpio.eq.${telefonoLimpio}`)
                .maybeSingle();
            
            if (existente) {
                alert('Hubo un error al registrarse: Este número de teléfono ya está asociado a una cuenta.');
                return;
            }
            
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: correoParaAuth,
                password: password
            });

            if (authError) {
                if (authError.message.includes('User already registered')) {
                     alert('Hubo un error al registrarse: Este correo electrónico ya está asociado a una cuenta. Por favor, usa otro o inicia sesión.');
                     return;
                }
                throw authError;
            }

            const userId = authData.user.id;

            const { error: tablaUsuarioError } = await supabase
                .from('usuarios')
                .insert([{
                    id_usuario: userId,
                    correo_electronico: correoParaTabla,
                    tipo_usuario: 'Cliente',
                    telefono_contacto: telefono,
                    telefono_limpio: telefonoLimpio
                }]);

            if (tablaUsuarioError) throw tablaUsuarioError;

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

            let mensajeExito = '¡Registro exitoso! Ya puedes iniciar sesión usando tu teléfono y contraseña.';
            if (correoIngresado) {
                mensajeExito = '¡Registro exitoso! Por favor, revisa tu correo electrónico para confirmar tu cuenta y luego inicia sesión.';
            }

            alert(mensajeExito);
            window.location.href = 'login.html';

        } catch (error) {
            console.error('Error:', error);
            if (error.message && error.message.includes('User already registered')) {
                alert('Hubo un error al registrarse: Este correo electrónico o número de teléfono ya están asociados a una cuenta.');
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
            authParams.email = inputValor;
        } else {
            
            const telIngresadoLimpio = inputValor.replace(/[^\d]/g, ''); 

            if (telIngresadoLimpio.length < 6) {
                alert('Error: El teléfono debe tener al menos 6 dígitos.');
                return;
            }
            
            // Búsqueda CLAVE: Buscamos la coincidencia exacta en la columna limpia.
            const { data: usuario, error: userError } = await supabase
                .from('usuarios')
                .select('id_usuario, correo_electronico, telefono_contacto')
                .eq('telefono_limpio', telIngresadoLimpio) 
                .maybeSingle();

            if (userError || !usuario) {
                alert('Error: Teléfono no encontrado.');
                return;
            }
            
            const correoEnBD = usuario.correo_electronico;
            const telGuardadoLimpio = usuario.telefono_contacto.replace('+', '');
            const correoFalsoReconstruido = `tel_${telGuardadoLimpio}@varietyworld.com`;
            
            authParams.email = correoEnBD || correoFalsoReconstruido;
        }
        
        const { data, error } = await supabase.auth.signInWithPassword({
            email: authParams.email,
            password: password
        });

        if (error) {
            alert('Error: Credenciales incorrectas o usuario no encontrado.');
        } else {
            const userId = data.user.id;
            try {
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