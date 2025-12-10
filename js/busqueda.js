import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://fpmsddnonhiqxnsydfpz.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZwbXNkZG5vbmhpcXhuc3lkZnB6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5MTE4NTAsImV4cCI6MjA3ODQ4Nzg1MH0.Lj3q5iOHpGzBhwul1yPx4jxoSB9u-blu5EYJ6lsftXY';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

document.addEventListener('DOMContentLoaded', () => {
    const inputBusqueda = document.getElementById('inputBusquedaGlobal');
    const boxSugerencias = document.getElementById('listaSugerencias');
    let debounceTimer;

    if (inputBusqueda && boxSugerencias) {

        inputBusqueda.addEventListener('input', (e) => {
            const termino = e.target.value.trim();

            clearTimeout(debounceTimer);

            if (termino.length < 2) {
                boxSugerencias.style.display = 'none';
                boxSugerencias.innerHTML = '';
                return;
            }

            debounceTimer = setTimeout(async () => {
                await buscarSugerencias(termino);
            }, 300);
        });

        inputBusqueda.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                irAResultados(inputBusqueda.value.trim());
            }
        });

        document.addEventListener('click', (e) => {
            if (!inputBusqueda.contains(e.target) && !boxSugerencias.contains(e.target)) {
                boxSugerencias.style.display = 'none';
            }
        });
    }

    //función para buscar sugerencias en la base de datos
    async function buscarSugerencias(texto) {
        try {
            const { data, error } = await supabase
                .from('productos')
                .select('id_producto, nombre, precio_unitario, imagen_url')
                .or(`nombre.ilike.%${texto}%,codigo_producto.ilike.%${texto}%`)
                .limit(5);

            if (error) throw error;

            renderizarSugerencias(data);

        } catch (err) {
            console.error("Error búsqueda:", err);
        }
    }

    function renderizarSugerencias(productos) {
        boxSugerencias.innerHTML = '';

        if (!productos || productos.length === 0) {
            boxSugerencias.style.display = 'none';
            return;
        }

        productos.forEach(prod => {
            const item = document.createElement('div');
            item.className = 'sugerencia-item';

            const imgUrl = prod.imagen_url || 'https://via.placeholder.com/30?text=X';

            item.innerHTML = `
                <img src="${imgUrl}" class="sugerencia-img" onerror="this.style.display='none'">
                <div class="sugerencia-info">
                    <span class="sugerencia-nombre">${prod.nombre}</span>
                    <span class="sugerencia-precio">$${parseFloat(prod.precio_unitario).toFixed(2)}</span>
                </div>
            `;

            item.addEventListener('click', () => {
                irAResultados(prod.nombre);
            });

            boxSugerencias.appendChild(item);
        });

        boxSugerencias.style.display = 'block';
    }

    function irAResultados(termino) {
        if (!termino) return;

        const rutaBase = window.location.pathname.includes('/html/') ? 'productos.html' : 'html/productos.html';
        window.location.href = `${rutaBase}?q=${encodeURIComponent(termino)}`;
    }
});