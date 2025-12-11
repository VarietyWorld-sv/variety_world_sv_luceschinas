import { supabase } from './config.js';

export async function cargarAnaliticas() {
    
    if (!document.getElementById('kpi-entregado')) return;

    console.log("Cargando analíticas...");

    const { data: pedidos } = await supabase
        .from('pedidos')
        .select('total_factura, fecha_pedido, estado_pedido');

    const { count: usuarios } = await supabase
        .from('usuarios')
        .select('*', { count: 'exact', head: true })
        .eq('tipo_usuario', 'Cliente');

    const { count: productos } = await supabase
        .from('productos')
        .select('*', { count: 'exact', head: true });

    let ingresosEntregados = 0; 
    let ventasPendientes = 0;   
    let totalVentas = 0;        
    
    let ventasPorFecha = {};
    const estadosCount = { 'Pendiente': 0, 'Entregado': 0, 'Cancelado': 0, 'Enviado': 0, 'Procesando': 0 };

    if (pedidos) {
        pedidos.forEach(p => {
            const total = parseFloat(p.total_factura || 0);
            const estado = p.estado_pedido || 'Pendiente';
            const estadoLower = estado.toLowerCase();
            
            if (estadoLower !== 'cancelado') {
                totalVentas += total;
            }

            if (estadoLower === 'entregado') {
                ingresosEntregados += total;
            } else if (estadoLower === 'pendiente' || estadoLower === 'procesando' || estadoLower === 'enviado') {
                ventasPendientes += total;
            }

            let fecha = p.fecha_pedido.split('T')[0];
            if (estadoLower !== 'cancelado') {
                ventasPorFecha[fecha] = (ventasPorFecha[fecha] || 0) + total;
            }

            let estadoCapitalized = estado.charAt(0).toUpperCase() + estado.slice(1).toLowerCase();

            if (estadosCount[estadoCapitalized] !== undefined) estadosCount[estadoCapitalized]++;
            else estadosCount[estadoCapitalized] = 1;
        });
    }

    document.getElementById('kpi-entregado').innerText = `$${ingresosEntregados.toFixed(2)}`;
    document.getElementById('kpi-pendiente').innerText = `$${ventasPendientes.toFixed(2)}`;
    
    document.getElementById('kpi-usuarios').innerText = usuarios || 0;
    document.getElementById('kpi-productos').innerText = productos || 0;

    renderizarGraficoLinea(ventasPorFecha);
    renderizarGraficoDonut(estadosCount);
}

function renderizarGraficoLinea(datos) {
    const ctx = document.getElementById('chartLineaVentas');
    if (!ctx) return;

    if (window.chartVentas instanceof Chart) window.chartVentas.destroy();

    const fechas = Object.keys(datos).sort().slice(-7);
    const valores = fechas.map(f => datos[f]);

    window.chartVentas = new Chart(ctx, {
        type: 'line',
        data: {
            labels: fechas,
            datasets: [{
                label: 'Ingresos ($)',
                data: valores,
                borderColor: '#E6B325',
                backgroundColor: 'rgba(230, 179, 37, 0.2)',
                tension: 0.4,
                fill: true,
                pointBackgroundColor: '#E6B325'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { labels: { color: '#fff' } } },
            scales: {
                y: { ticks: { color: '#fff' }, grid: { color: '#333' } },
                x: { ticks: { color: '#fff' }, grid: { display: false } }
            }
        }
    });
}

function renderizarGraficoDonut(datos) {
    const ctx = document.getElementById('chartEstados');
    if (!ctx) return;

    if (window.chartEstadosDonut instanceof Chart) window.chartEstadosDonut.destroy();

    const labels = Object.keys(datos).filter(k => datos[k] > 0);
    const values = labels.map(k => datos[k]);

    window.chartEstadosDonut = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: ['#E6A925', '#4CAF50', '#E62525', '#009DFF', '#888'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { labels: { color: '#fff' } } }
        }
    });
}