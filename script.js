// Configuración de Supabase
const SUPABASE_URL = 'https://ipiqgkosdnajgrkouili.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable__vTtg0nVjkfyzF2IM_FraA_blfW7dO8';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Variable global para recordar qué usuario ha iniciado sesión
let usuarioActual = null;

// Funciones para cambiar de vista (pestañas)
function mostrarSeccion(tipo) {
    document.getElementById('card-registro').style.display = 'none';
    document.getElementById('card-login').style.display = 'none';
    document.getElementById('card-panel').style.display = 'none';

    if (tipo === 'registro') {
        document.getElementById('card-registro').style.display = 'block';
    } else if (tipo === 'consulta') {
        document.getElementById('card-login').style.display = 'block';
    } else if (tipo === 'panel') {
        document.getElementById('card-panel').style.display = 'block';
    }
}

// 1. Registro inicial (Solo nombre y PIN)
async function registrarUsuario() {
    const nombre = document.getElementById('reg-nombre').value.trim();
    const pin = document.getElementById('reg-pin').value.trim();

    if (!nombre || !pin) {
        alert('Por favor ingresa tu nombre y un PIN.');
        return;
    }

    // Verificar si ya existe
    const { data: existente } = await supabaseClient
        .from('amigos')
        .select('*')
        .eq('nombre', nombre)
        .single();

    if (existente) {
        alert('Este nombre ya está registrado. Por favor ingresa a tu panel.');
        mostrarSeccion('consulta');
        return;
    }

    // Insertar nuevo usuario vacío
    const { error } = await supabaseClient
        .from('amigos')
        .insert([{ nombre, pin, deseos: '', amigo_asignado: null }]);

    if (error) {
        alert('Error al registrarse: ' + error.message);
    } else {
        alert('¡Inscripción exitosa! Ahora inicia sesión para poner tu lista de deseos.');
        document.getElementById('reg-nombre').value = '';
        document.getElementById('reg-pin').value = '';
        mostrarSeccion('consulta');
    }
}

// 2. Iniciar sesión al panel personal
async function ingresarPanel() {
    const nombre = document.getElementById('login-nombre').value.trim();
    const pin = document.getElementById('login-pin').value.trim();

    if (!nombre || !pin) {
        alert('Ingresa tu nombre y tu PIN.');
        return;
    }

    const { data, error } = await supabaseClient
        .from('amigos')
        .select('*')
        .eq('nombre', nombre)
        .eq('pin', pin)
        .single();

    if (error || !data) {
        alert('Nombre o PIN incorrecto.');
        return;
    }

    usuarioActual = data;
    document.getElementById('span-nombre-usuario').innerText = data.nombre;
    
    // Cargar deseos actuales (separando texto limpio de la foto si la hay)
    let textoDeseos = data.deseos || '';
    if (textoDeseos.includes('[Foto de referencia:')) {
        textoDeseos = textoDeseos.split('[Foto de referencia:')[0].trim();
    }
    document.getElementById('panel-deseos').value = textoDeseos;

    // Cargar estado del amigo secreto
    verificarResultadoPanel();

    // Mostrar panel privado
    mostrarSeccion('panel');
}

// 3. Guardar / Actualizar deseos y foto en el panel personal
async function guardarDeseos() {
    const deseosTexto = document.getElementById('panel-deseos').value.trim();
    const archivoInput = document.getElementById('panel-foto');
    let fotoUrl = '';

    // Extraer foto anterior si existía en el texto guardado
    let deseosOriginales = usuarioActual.deseos || '';
    if (deseosOriginales.includes('[Foto de referencia:')) {
        const match = deseosOriginales.match(/\[Foto de referencia: (.*?)\]/);
        if (match) fotoUrl = match[1];
    }

    // Si seleccionó una nueva foto, subirla
    if (archivoInput.files.length > 0) {
        const archivo = archivoInput.files[0];
        const nombreArchivo = `${Date.now()}_${archivo.name}`;

        const { error: uploadError } = await supabaseClient.storage
            .from('regalos')
            .upload(nombreArchivo, archivo);

        if (uploadError) {
            alert('Error al subir la imagen: ' + uploadError.message);
            return;
        }

        const { data: publicURLData } = supabaseClient.storage
            .from('regalos')
            .getPublicUrl(nombreArchivo);

        fotoUrl = publicURLData.publicUrl;
    }

    const deseosFinales = deseosTexto + (fotoUrl ? ` \n[Foto de referencia: ${fotoUrl}]` : '');

    const { error } = await supabaseClient
        .from('amigos')
        .update({ deseos: deseosFinales })
        .eq('id', usuarioActual.id);

    if (error) {
        alert('Error al actualizar: ' + error.message);
    } else {
        usuarioActual.deseos = deseosFinales;
        alert('¡Lista de deseos actualizada con éxito!');
    }
}

// 4. Consultar a quién le debe regalar y ver los deseos de esa persona
async function verificarResultadoPanel() {
    const divResultado = document.getElementById('panel-resultado');

    if (!usuarioActual.amigo_asignado) {
        divResultado.innerHTML = 'El sorteo aún no se ha realizado por el administrador.';
        return;
    }

    // Buscar la lista de deseos del amigo asignado
    const { data: amigoData } = await supabaseClient
        .from('amigos')
        .select('deseos')
        .eq('nombre', usuarioActual.amigo_asignado)
        .single();

    let listaDeseosAmigo = amigoData ? amigoData.deseos : 'No registró lista de deseos.';

    if (listaDeseosAmigo.includes('[Foto de referencia:')) {
        listaDeseosAmigo = listaDeseosAmigo.replace(/\[Foto de referencia: (.*?)\]/g, '<br><br>📸 <strong>Foto de referencia:</strong><br><img src="$1" style="max-width:100%; border-radius:8px; margin-top:5px;">');
    }

    divResultado.innerHTML = `🎉 Te tocó regalar a: <strong>${usuarioActual.amigo_asignado}</strong><br><br>🎁 <strong>Su lista de deseos:</strong><br>${listaDeseosAmigo}`;
}

// 5. Cerrar sesión
function cerrarSesion() {
    usuarioActual = null;
    document.getElementById('login-nombre').value = '';
    document.getElementById('login-pin').value = '';
    document.getElementById('panel-deseos').value = '';
    document.getElementById('panel-foto').value = '';
    mostrarSeccion('consulta');
}

// 6. Realizar sorteo (Administrador)
async function realizarSorteo() {
    const { data: participantes, error } = await supabaseClient.from('amigos').select('*');
    
    if (error || participantes.length < 2) {
        alert('Se necesitan al menos 2 participantes para hacer el sorteo.');
        return;
    }

    let nombres = participantes.map(p => p.nombre);
    let asignados = [...nombres];
    let esValido = false;

    while (!esValido) {
        asignados.sort(() => Math.random() - 0.5);
        esValido = true;
        for (let i = 0; i < nombres.length; i++) {
            if (nombres[i] === asignados[i]) {
                esValido = false;
                break;
            }
        }
    }

    for (let i = 0; i < participantes.length; i++) {
        await supabaseClient
            .from('amigos')
            .update({ amigo_asignado: asignados[i] })
            .eq('id', participantes[i].id);
    }

    alert('¡Sorteo realizado con éxito! Ya pueden entrar a su panel a consultar.');
}
