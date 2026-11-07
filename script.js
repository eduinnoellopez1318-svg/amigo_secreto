// Configuración de Supabase
const SUPABASE_URL = 'https://ipiqgkosdnajgrkouili.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable__vTtg0nVjkfyzF2IM_FraA_blfW7dO8';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let usuarioActual = null;

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

async function registrarUsuario() {
    const nombre = document.getElementById('reg-nombre').value.trim();
    const pin = document.getElementById('reg-pin').value.trim();

    if (!nombre || !pin) {
        alert('Por favor ingresa tu nombre y un PIN.');
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
    
    // Limpiar texto de deseos quitando etiquetas de fotos guardadas
    let textoDeseos = data.deseos || '';
    if (textoDeseos.includes('[Fotos:')) {
        textoDeseos = textoDeseos.split('[Fotos:')[0].trim();
    }
    document.getElementById('panel-deseos').value = textoDeseos;
    document.getElementById('grid-previsualizacion').innerHTML = '';
    document.getElementById('panel-fotos').value = '';

    verificarResultadoPanel();
    mostrarSeccion('panel');
}

// Previsualizar las imágenes seleccionadas antes de guardar
function previsualizarFotos(event) {
    const files = event.target.files;
    const grid = document.getElementById('grid-previsualizacion');
    grid.innerHTML = '';

    if (files.length > 5) {
        alert('Solo puedes seleccionar un máximo de 5 imágenes.');
        document.getElementById('panel-fotos').value = '';
        return;
    }

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const reader = new FileReader();

        reader.onload = function(e) {
            const tarjeta = document.createElement('div');
            tarjeta.className = 'tarjeta-img';
            tarjeta.innerHTML = `<img src="${e.target.result}"><span style="font-size:11px; color:#666;">Foto ${i+1}</span>`;
            grid.appendChild(tarjeta);
        }
        reader.readAsDataURL(file);
    }
}

async function guardarDeseos() {
    const deseosTexto = document.getElementById('panel-deseos').value.trim();
    const archivoInput = document.getElementById('panel-fotos');
    let urlsFotos = [];

    // Extraer URLs de fotos ya guardadas previamente si existen
    let deseosOriginales = usuarioActual.deseos || '';
    if (deseosOriginales.includes('[Fotos:')) {
        const match = deseosOriginales.match(/\[Fotos: ((.*?)\])/);
        if (match) {
            try {
                urlsFotos = JSON.parse(match[1]);
            } catch (e) {
                urlsFotos = [];
            }
        }
    }

    // Subir nuevas fotos seleccionadas
    if (archivoInput.files.length > 0) {
        if (archivoInput.files.length > 5) {
            alert('El límite máximo es de 5 imágenes.');
            return;
        }

        urlsFotos = []; // Sobrescribir con las nuevas seleccionadas
        for (let i = 0; i < archivoInput.files.length; i++) {
            const archivo = archivoInput.files[i];
            const nombreArchivo = `${Date.now()}_${i}_${archivo.name}`;

            const { error: uploadError } = await supabaseClient.storage
                .from('regalos')
                .upload(nombreArchivo, archivo);

            if (uploadError) {
                alert('Error al subir imagen: ' + uploadError.message);
                return;
            }

            const { data: publicURLData } = supabaseClient.storage
                .from('regalos')
                .getPublicUrl(nombreArchivo);

            urlsFotos.push(publicURLData.publicUrl);
        }
    }

    const deseosFinales = deseosTexto + (urlsFotos.length > 0 ? ` \n[Fotos: ${JSON.stringify(urlsFotos)}]` : '');

    const { error } = await supabaseClient
        .from('amigos')
        .update({ deseos: deseosFinales })
        .eq('id', usuarioActual.id);

    if (error) {
        alert('Error al actualizar: ' + error.message);
    } else {
        usuarioActual.deseos = deseosFinales;
        alert('¡Lista de deseos y fotos guardadas con éxito!');
    }
}

async function verificarResultadoPanel() {
    const divResultado = document.getElementById('panel-resultado');

    if (!usuarioActual.amigo_asignado) {
        divResultado.innerHTML = 'El sorteo aún no se ha realizado por el administrador.';
        return;
    }

    const { data: amigoData } = await supabaseClient
        .from('amigos')
        .select('deseos')
        .eq('nombre', usuarioActual.amigo_asignado)
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

    divResultado.innerHTML = `🎉 Te tocó regalar a: <strong>${usuarioActual.amigo_asignado}</strong><br><br>🎁 <strong>Su lista de deseos:</strong><br>${textoDeseosAmigo}${galeriaHTML}`;
}

function cerrarSesion() {
    usuarioActual = null;
    document.getElementById('login-nombre').value = '';
    document.getElementById('login-pin').value = '';
    document.getElementById('panel-deseos').value = '';
    document.getElementById('panel-fotos').value = '';
    document.getElementById('grid-previsualizacion').innerHTML = '';
    mostrarSeccion('consulta');
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
        await supabaseClient
            .from('amigos')
            .update({ amigo_asignado: asignados[i] })
            .eq('id', participantes[i].id);
    }

    alert('¡Sorteo realizado con éxito! Ya pueden entrar a su panel a consultar.');
}
