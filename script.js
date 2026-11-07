// Configuración de Supabase (Tus credenciales reales)
const SUPABASE_URL = 'https://ipiqgkosdnajgrkouili.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable__vTtg0nVjkfyzF2IM_FraA_blfW7dO8';
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function registrarParticipante() {
    const nombre = document.getElementById('nombre').value.trim();
    const deseos = document.getElementById('deseos').value.trim();
    const pin = document.getElementById('pin').value.trim();

    if (!nombre || !pin) {
        alert('Por favor ingresa tu nombre y un PIN.');
        return;
    }

    const { error } = await supabase
        .from('amigos')
        .insert([{ nombre, deseos, pin }]);

    if (error) {
        alert('Hubo un error al registrarse: ' + error.message);
    } else {
        alert('¡Registro exitoso!');
        document.getElementById('nombre').value = '';
        document.getElementById('deseos').value = '';
        document.getElementById('pin').value = '';
    }
}

async function realizarSorteo() {
    const { data: participantes, error } = await supabase.from('amigos').select('*');
    
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

        await supabase
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

    const { data, error } = await supabase
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

    const { data: amigoData } = await supabase
        .from('amigos')
        .select('deseos')
        .eq('nombre', data.amigo_asignado)
        .single();

    const listaDeseos = amigoData ? amigoData.deseos : 'No registró lista de deseos.';

    divResultado.innerHTML = `🎉 Te tocó regalar a: <strong>${data.amigo_asignado}</strong><br>🎁 Su lista de deseos: <br><em>${listaDeseos}</em>`;
}