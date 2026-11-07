// Configuración de Supabase
const SUPABASE_URL = 'https://ipiqgkosdnajgrkouili.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable__vTtg0nVjkfyzF2IM_FraA_blfW7dO8';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function registrarParticipante() {
    const nombre = document.getElementById('nombre').value.trim();
    const deseos = document.getElementById('deseos').value.trim();
    const pin = document.getElementById('pin').value.trim();
    const archivoInput = document.getElementById('foto');

    if (!nombre || !pin) {
        alert('Por favor ingresa tu nombre y un PIN.');
        return;
    }

    let fotoUrl = '';

    // Si seleccionó una nueva foto, la subimos a Supabase Storage
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

    // 1. Verificar si el usuario ya existe con ese nombre y PIN
    const { data: usuarioExistente } = await supabaseClient
        .from('amigos')
        .select('*')
        .eq('nombre', nombre)
        .eq('pin', pin)
        .single();

    let error;

    if (usuarioExistente) {
        // SI YA EXISTE: Actualizamos su lista de deseos y foto
        const nuevosDeseos = deseos + (fotoUrl ? ` \n[Foto de referencia: ${fotoUrl}]` : '');
        
        const res = await supabaseClient
            .from('amigos')
            .update({ deseos: nuevosDeseos })
            .eq('id', usuarioExistente.id);
        
        error = res.error;
    } else {
        // SI ES NUEVO: Lo insertamos por primera vez
        const nuevosDeseos = deseos + (fotoUrl ? ` \n[Foto de referencia: ${fotoUrl}]` : '');
        
        const res = await supabaseClient
            .from('amigos')
            .insert([{ nombre, deseos: nuevosDeseos, pin }]);
        
        error = res.error;
    }

    if (error) {
        alert('Hubo un error al guardar: ' + error.message);
    } else {
        alert('¡Datos guardados / actualizados con éxito!');
        document.getElementById('nombre').value = '';
        document.getElementById('deseos').value = '';
        document.getElementById('pin').value = '';
        document.getElementById('foto').value = '';
    }
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
        const participanteId = participantes[i].id;
        const amigoAsignado = asignados[i];

        await supabaseClient
            .from('amigos')
            .update({ amigo_asignado: amigoAsignado })
            .eq('id', participanteId);
    }

    alert('¡Sorteo realizado con éxito! Ya pueden consultar sus resultados.');
}

async function consultarResultado() {
    const nombre = document.getElementById('consulta-nombre').value.trim();
    const pin = document.getElementById('consulta-pin').value.trim();
    const divResultado = document.getElementById('resultado');

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
        divResultado.innerHTML = 'Nombre o PIN incorrecto.';
        return;
    }

    if (!data.amigo_asignado) {
        divResultado.innerHTML = 'El sorteo aún no se ha realizado.';
        return;
    }

    const { data: amigoData } = await supabaseClient
        .from('amigos')
        .select('deseos')
        .eq('nombre', data.amigo_asignado)
        .single();

    let listaDeseos = amigoData ? amigoData.deseos : 'No registró lista de deseos.';

    if (listaDeseos.includes('[Foto de referencia:')) {
        listaDeseos = listaDeseos.replace(/\[Foto de referencia: (.*?)\]/g, '<br><br>📸 <strong>Foto de referencia:</strong><br><img src="$1" style="max-width:100%; border-radius:8px; margin-top:5px;">');
    }

    divResultado.innerHTML = `🎉 Te tocó regalar a: <strong>${data.amigo_asignado}</strong><br><br>🎁 <strong>Su lista de deseos:</strong><br>${listaDeseos}`;
}
