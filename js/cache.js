/**
 * Busca datos en memoria primero. Si no existen, va a la BD.
 * @param {string} clave
 * @param {Function} fetchFunction
 * @param {number} tiempoValidez
 */
export async function obtenerDatosConCache(clave, fetchFunction, tiempoValidez = 15) {
    const cache = sessionStorage.getItem(clave);
    
    if (cache) {
        const { datos, timestamp } = JSON.parse(cache);
        const ahora = new Date().getTime();
        if ((ahora - timestamp) < (tiempoValidez * 60 * 1000)) {
            console.log(`⚡ Usando caché para: ${clave}`);
            return { data: datos, error: null };
        }
    }

    console.log(`Descargando de internet: ${clave}`);
    const resultado = await fetchFunction();
    
    if (!resultado.error && resultado.data) {
        const objetoCache = {
            datos: resultado.data,
            timestamp: new Date().getTime()
        };
        sessionStorage.setItem(clave, JSON.stringify(objetoCache));
    }

    return resultado;
}