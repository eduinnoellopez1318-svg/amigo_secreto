// Configuración de Supabase
const SUPABASE_URL = 'https://ipiqgkosdnajgrkouili.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable__vTtg0nVjkfyzF2IM_FraA_blfW7dO8';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let usuarioActual = null;
let listaArchivosSeleccionados = [];
const PIN_ADMIN = '132118';

function cifrarTexto(texto) {
    return btoa(encodeURIComponent(texto));
}

function descifrarTexto(textoCifrado) {
    try {
        return decodeURIComponent(atob(textoCifrado));
    } catch (e) {
        return textoCifrado;
    }
}

window.addEventListener('DOMContentLoaded', async () => {
    verificarInscripcionesYMostrarRegistro();
});

async function verificarInscripcionesYMostrarRegistro() {
    const { data: config } = await supabaseClient
        .from('configuracion')
        .select('*')
        .eq('clave', 'inscripciones_cerradas')
        .single();

    const cardRegistro = document.getElementById('card-registro');
    const cardLogin = document.getElementById('card-login');
    const btnVolverRegistro = document.getElementById('btn-volver-registro');

    if (config && config.valor === 'true') {
        if (cardRegistro) cardRegistro.style.display = 'none';
        if (cardLogin) cardLogin.style.display = 'block';
        if (btnVolverRegistro) btnVolverRegistro.style.display = 'none';
    } else {
        if (cardRegistro) cardRegistro.style.display = 'block';
        if (cardLogin) cardLogin.style.display = 'none';
        if (btnVolverRegistro) btnVolverRegistro.style.display = 'block';
    }
}

function mostrarSeccion(tipo) {
    document.getElementById('card-registro').style.display = 'none';
    document.getElementById('card-login').style.display = 'none';
    document.getElementById('card-panel').style.display = 'none';

    if (tipo === 'registro') {
        verificarInscripcionesYMostrarRegistro();
    } else if (tipo === 'consulta') {
        document.getElementById('card-login').style.display = 'block';
    } else if (tipo === 'panel') {
        document.getElementById('card-panel').style.display = 'block';
    }
}

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
        verificarInscripcionesYMostrarRegistro();
        return;
    }

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

async function ingresarPanel() {
    const nombre = document.getElementById('login-nombre').value.trim().toLowerCase();
    const pinPlano = document.getElementById('login-pin').value.trim();

    if (!nombre || !pinPlano) {
        alert('Ingresa tu nombre y tu PIN.');
        return;
    }

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
    verificarInscripcionesYMostrarRegistro();
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
    let mensaje = 'Inscripciones CERRADAS. La tarjeta de registro ha sido ocultada.';

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
        verificarInscripcionesYMostrarRegistro();
    }
}

// --- FUNCIÓN CON DOBLE CONFIRMACIÓN PARA BORRAR TODO EL SORTEO ---
async function reiniciarTodoSorteo() {
    // Primera confirmación
    const confirmar1 = confirm('⚠️ ADVERTENCIA: ¿Estás seguro de que deseas eliminar TODOS los participantes, listas de deseos y reiniciar el sorteo por completo?');
    if (!confirmar1) return;

    // Segunda confirmación estricta
    const confirmar2 = confirm('🔴 ÚLTIMA ADVERTENCIA: Esta acción no se puede deshacer. Se borrará toda la base de datos del sorteo. ¿Deseas continuar?');
    if (!confirmar2) return;

    try {
        // Borrar todos los registros de la tabla amigos
        const { error: errorAmigos } = await supabaseClient
            .from('amigos')
            .delete()
            .neq('id', 0); // Borra todas las filas

        // Reabrir inscripciones automáticamente borrando la configuración o poniéndolas en falso
        await supabaseClient
            .from('configuracion')
            .upsert([{ clave: 'inscripciones_cerradas', valor: 'false' }], { onConflict: ['clave'] });

        if (errorAmigos) {
            alert('Hubo un error al limpiar los datos: ' + errorAmigos.message);
        } else {
            alert('✨ ¡El sorteo se ha reiniciado y borrado por completo con éxito!');
            location.reload(); // Recarga la página para dejarla limpia
        }
    } catch (e) {
        alert('Error inesperado al reiniciar: ' + e.message);
    }
}
