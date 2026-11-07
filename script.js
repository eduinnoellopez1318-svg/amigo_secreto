// Configuración de Supabase
const SUPABASE_URL = 'https://ipiqgkosdnajgrkouili.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable__vTtg0nVjkfyzF2IM_FraA_blfW7dO8';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let usuarioActual = null;
let listaArchivosSeleccionados = []; // Arreglo para acumular las fotos seleccionadas una por una

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
    
    // Limpiar texto de deseos y recuperar fotos ya guardadas si las hay
    let textoDeseos = data.deseos || '';
    listaArchivosSeleccionados = []; // Reiniciar acumulador
    
    if (textoDeseos.includes('[Fotos:')) {
        const partes = textoDeseos.split('[Fotos:');
        textoDeseos = partes[0].trim();
        try {
            const urlsGuardadas = JSON.parse(partes[1].replace(']', '').trim());
            // Si ya tiene fotos en la base de datos, las cargamos como URLs existentes en la vista previa
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

// Función para ir acumulando las fotos seleccionadas una por una (máximo 5)
function previsualizarFotos(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
        if (listaArchivosSeleccionados.length >= 5) {
            alert('Has alcanzado el límite máximo de 5 imágenes.');
            break;
        }
        // Agregamos el archivo nuevo a la lista acumulada
        listaArchivosSeleccionados.push({ tipo: 'file', valor: files[i] });
    }

    // Limpiamos el input para permitir seleccionar otra imagen de nuevo
    event.target.value = '';
    actualizarVistaPrevia();
}

// Eliminar una foto de la lista antes de guardar
function eliminarFoto(index) {
    listaArchivosSeleccionados.splice(index, 1);
    actualizarVistaPrevia();
}

// Renderizar las tarjetas en pantalla
function actualizarVistaPrevia() {
    const grid = document.getElementById('grid-previsualizacion');
    grid.innerHTML = '';

    listaArchivosSeleccionados.forEach((item, index) => {
        const tarjeta = document.createElement('div');
        tarjeta.className = 'tarjeta-img';

        let imageSrc = '';
        if (item.tipo === 'url') {
            imageSrc = item.valor;
        } else {
            imageSrc = URL.createObjectURL(item.valor);
        }

        tarjeta.innerHTML = `
            <img src="${imageSrc}">
            <span style="font-size:11px; display:block; margin:2px 0;">Foto ${index + 1}</span>
            <button type="button" onclick="eliminarFoto(${index})" style="background:#dc3545; color:#white; border:none; border-radius:4px; padding:2px 5px; font-size:10px; cursor:pointer; width:100%;">Eliminar</button>
        `;
        grid.appendChild(tarjeta);
    });
}

async function guardarDeseos() {
    const deseosTexto = document.getElementById('panel-deseos').value.trim();
    let urlsFinales = [];

    // Procesar cada elemento de la lista acumulada
    for (let i = 0; i < listaArchivosSeleccionados.length; i++) {
        const item = listaArchivosSeleccionados[i];

        if (item.tipo === 'url') {
            // Si ya era una URL existente en la nube, la conservamos
            urlsFinales.push(item.valor);
        } else {
            // Si es un archivo nuevo seleccionado desde el celular/PC, lo subimos a Supabase
            const archivo = item.valor;
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
        // Actualizamos la lista local para reflejar las URLs ya subidas
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
    listaArchivosSeleccionados = [];
    document.getElementById('login-nombre').value = '';
    document.getElementById('login-pin').value = '';
    document.getElementById('panel-deseos').value = '';
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
