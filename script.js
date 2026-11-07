// Configuración de Supabase
const SUPABASE_URL = 'https://ipiqgkosdnajgrkouili.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable__vTtg0nVjkfyzF2IM_FraA_blfW7dO8';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let usuarioActual = null;
let listaArchivosSeleccionados = [];
const PIN_ADMIN = '132118';

// Funciones de cifrado básico para ocultar el PIN y el amigo asignado en la base de datos
function cifrarTexto(texto) {
    return btoa(encodeURIComponent(texto)); // Codifica en Base64 seguro
}

function descifrarTexto(textoCifrado) {
    try {
        return decodeURIComponent(atob(textoCifrado));
    } catch (e) {
        return textoCifrado; // Por si algún dato antiguo no estaba cifrado
    }
}

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

// 1. Registro inicial
async function registrarUsuario() {
    const nombreOriginal = document.getElementById('reg-nombre').value.trim();
    const nombre = nombreOriginal.toLowerCase();
    const pinPlano = document.getElementById('reg-pin').value.trim();

    if (!nombre || !pinPlano) {
        alert('Por favor ingresa tu nombre y un PIN.');
        return;
    }

    const { data: config } = await supabaseClient
        .from('configuracion')
        .select('*')
        .eq('clave', 'inscripciones_cerradas')
        .single();

    if (config && config.valor === 'true') {
        alert('Lo sentimos, las inscripciones ya han sido cerradas por el administrador.');
        return;
    }

    // Verificar si ya existe el nombre exacto en minúsculas
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

    // Ciframos el PIN antes de guardarlo para que sea secreto en la BD
    const pinCifrado = cifrarTexto(pinPlano);

    const { error } = await supabaseClient
        .from('amigos')
        .insert([{ nombre, pin: pinCifrado, deseos: '', amigo_asignado: null }]);

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
    const nombre = document.getElementById('login-nombre').value.trim().toLowerCase();
    const pinPlano = document.getElementById('login-pin').value.trim();

    if (!nombre || !pinPlano) {
        alert('Ingresa tu nombre y tu PIN.');
        return;
    }

    // Traemos al usuario por nombre y comparamos el PIN descifrado
    const { data, error } = await supabaseClient
        .from('amigos')
        .select('*')
        .eq('nombre', nombre)
        .single();

    if (error || !data || descifrarTexto(data.pin) !== pinPlano) {
        alert('Nombre o PIN incorrecto.');
        return;
    }

    usuarioActual = data;
    document.getElementById('span-nombre-usuario').innerText = data.nombre.toUpperCase();
    
    let textoDeseos = data.deseos || '';
    listaArchivosSeleccionados = [];
    
    if (textoDeseos.includes('[Fotos:')) {
        const partes = textoDeseos.split('[Fotos:');
        textoDeseos = partes[0].trim();
        try {
            const urlsGuardadas = JSON.parse(partes[1].replace(']', '').trim());
            urlsGuardadas.forEach(url => {
                listaArchivosSeleccionados.push({ tipo: 'url', valor: url });
            });
        } catch (e) {}
    }

    document.getElementById('panel-deseos').value = textoDeseos;
    actualizarVistaPrevia();
    verificarResultadoPanel();
    mostrarSeccion('panel');
}

function previsualizarFotos(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
        if (listaArchivosSeleccionados.length >= 5) {
            alert('Has alcanzado el límite máximo de 5 imágenes.');
            break;
        }
        listaArchivosSeleccionados.push({ tipo: 'file', valor: files[i] });
    }

    event.target.value = '';
    actualizarVistaPrevia();
}

function eliminarFoto(index) {
    listaArchivosSeleccionados.splice(index, 1);
    actualizarVistaPrevia();
}

function actualizarVistaPrevia() {
    const grid = document.getElementById('grid-previsualizacion');
    grid.innerHTML = '';

    listaArchivosSeleccionados.forEach((item, index) => {
        const tarjeta = document.createElement('div');
        tarjeta.className = 'tarjeta-img';

        let imageSrc = item.tipo === 'url' ? item.valor : URL.createObjectURL(item.valor);

        tarjeta.innerHTML = `
            <img src="${imageSrc}">
            <span style="font-size:10px; display:block; margin:2px 0;">Foto ${index + 1}</span>
            <button type="button" onclick="eliminarFoto(${index})" style="background:#dc3545; color:white; border:none; border-radius:4px; padding:2px; font-size:10px; cursor:pointer; width:100%;">Eliminar</button>
        `;
        grid.appendChild(tarjeta);
    });
}

async function guardarDeseos() {
    const deseosTexto = document.getElementById('panel-deseos').value.trim();
    let urlsFinales = [];

    for (let i = 0; i < listaArchivosSeleccionados.length; i++) {
        const item = listaArchivosSeleccionados[i];

        if (item.tipo === 'url') {
            urlsFinales.push(item.valor);
        } else {
            const archivo = item.valor;
            const nombreArchivo = `${Date.now()}_${i}_${archivo.name}`;

            const { error: uploadError } = await supabaseClient.storage
                .from('regalos')
                .upload(nombreArchivo, archivo);

            if (uploadError) {
                alert('Error al subir imagen: ' + uploadError.message);
                return;
            }

            const { data: publicURLData } = await supabaseClient.storage
                .from('regalos')
                .getPublicUrl(nombreArchivo);

            urlsFinales.push(publicURLData.publicUrl);
        }
    }

    const deseosFinales = deseosTexto + (urlsFinales.length > 0 ? ` \n[Fotos: ${JSON.stringify(urlsFinales)}]` : '');

    const { error } = await supabaseClient
        .from('amigos')
        .update({ deseos: deseosFinales })
        .eq('id', usuarioActual.id);

    if (error) {
        alert('Error al actualizar: ' + error.message);
    } else {
        usuarioActual.deseos = deseosFinales;
        listaArchivosSeleccionados = urlsFinales.map(url => ({ tipo: 'url', valor: url }));
        actualizarVistaPrevia();
        alert('¡Lista de deseos y fotos guardadas con éxito!');
    }
}

async function verificarResultadoPanel() {
    const divResultado = document.getElementById('panel-resultado');

    if (!usuarioActual.amigo_asignado) {
        divResultado.innerHTML = 'El sorteo aún no se ha realizado por el administrador.';
        return;
    }

    // Desciframos el nombre del amigo asignado para mostrarlo en pantalla
    const amigoSecretoNombre = descifrarTexto(usuarioActual.amigo_asignado);

    const { data: amigoData } = await supabaseClient
        .from('amigos')
        .select('deseos')
        .eq('nombre', amigoSecretoNombre)
        .single();

    let textoDeseosAmigo = amigoData ? amigoData.deseos : 'No registró lista de deseos.';
    let galeriaHTML = '';

    if (textoDeseosAmigo.includes('[Fotos:')) {
        const partes = textoDeseosAmigo.split('[Fotos:');
        textoDeseosAmigo = partes[0].trim();
        try {
            const urls = JSON.parse(partes[1].replace(']', '').trim());
            if (urls.length > 0) {
                galeriaHTML = '<br><br>📸 <strong>Fotos de referencia:</strong><div class="contenedor-galeria">';
                urls.forEach((url, index) => {
                    galeriaHTML += `<div class="item-galeria"><img src="${url}"><span style="font-size:11px;">Opción ${index+1}</span></div>`;
                });
                galeriaHTML += '</div>';
            }
        } catch (e) {}
    }

    divResultado.innerHTML = `🎉 Te tocó regalar a: <strong>${amigoSecretoNombre.toUpperCase()}</strong><br><br>🎁 <strong>Su lista de deseos:</strong><br>${textoDeseosAmigo}${galeriaHTML}`;
}

function cerrarSesion() {
    usuarioActual = null;
    listaArchivosSeleccionados = [];
    document.getElementById('login-nombre').value = '';
    document.getElementById('login-pin').value = '';
    document.getElementById('panel-deseos').value = '';
    document.getElementById('grid-previsualizacion').innerHTML = '';
    mostrarSeccion('consulta');
}

// --- FUNCIONES DE ADMINISTRACIÓN ---

function ingresarAdmin() {
    const pinIngresado = document.getElementById('admin-pin').value.trim();
    if (pinIngresado === PIN_ADMIN) {
        document.getElementById('card-admin-login').style.display = 'none';
        document.getElementById('card-admin-panel').style.display = 'block';
        alert('¡Bienvenido al panel de administración!');
    } else {
        alert('PIN de administrador incorrecto.');
    }
}

function cerrarAdmin() {
    document.getElementById('admin-pin').value = '';
    document.getElementById('card-admin-panel').style.display = 'none';
    document.getElementById('card-admin-login').style.display = 'block';
}

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

    // Guardamos el amigo asignado totalmente cifrado (secreto) en la base de datos
    for (let i = 0; i < participantes.length; i++) {
        const asignadoCifrado = cifrarTexto(asignados[i]);
        await supabaseClient
            .from('amigos')
            .update({ amigo_asignado: asignadoCifrado })
            .eq('id', participantes[i].id);
    }

    alert('¡Sorteo realizado o regenerado con éxito! Las asignaciones se han guardado de forma secreta y cifrada.');
}

async function toggleInscripciones() {
    const { data } = await supabaseClient
        .from('configuracion')
        .select('*')
        .eq('clave', 'inscripciones_cerradas')
        .single();

    let nuevoEstado = 'true';
    let mensaje = 'Inscripciones CERRADAS. Nadie más podrá registrarse.';

    if (data && data.valor === 'true') {
        nuevoEstado = 'false';
        mensaje = 'Inscripciones ABIERTAS nuevamente.';
    }

    const { error } = await supabaseClient
        .from('configuracion')
        .upsert([{ clave: 'inscripciones_cerradas', valor: nuevoEstado }], { onConflict: ['clave'] });

    if (error) {
        alert('Error al cambiar el estado.');
    } else {
        alert(mensaje);
    }
}
