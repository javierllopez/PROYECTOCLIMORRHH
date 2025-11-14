(function(){
  function ready(fn){ if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn); else fn(); }
  function crearPie(ctx, labels, data, titulo){
    if (!ctx) return;
    const colores = ['#0d6efd','#6f42c1','#198754','#dc3545','#fd7e14','#20c997','#0dcaf0','#6c757d','#6610f2','#ffc107','#1982C4','#8AC926'];
    const bg = labels.map((_,i)=>colores[i % colores.length]);
    const cfg = {
      type: 'pie',
      data: { labels, datasets: [{ data, backgroundColor: bg }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom' },
          title: { display: !!titulo, text: titulo },
          tooltip: { callbacks: { label: (ctx)=>{
            const l = ctx.label || '';
            const v = Number(ctx.parsed) || 0;
            const ds = ctx.chart && ctx.chart.data && ctx.chart.data.datasets ? ctx.chart.data.datasets[0] : null;
            const arr = ds && Array.isArray(ds.data) ? ds.data : [];
            const total = arr.reduce((a,b)=> (Number(a)||0)+(Number(b)||0), 0);
            const pct = total ? (v * 100 / total) : 0;
            const pctStr = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(pct);
            return `${l}: ${pctStr}%`;
          }}}
        }
      }
    };
    return new Chart(ctx, cfg);
  }

  ready(function(){
    let chartSectorHoras, chartSectorMontos, chartMotivoHoras, chartMotivoMontos;
    function initSectorCharts(){
      if (chartSectorHoras || chartSectorMontos) return;
      const secDataEl = document.getElementById('chart-sector-data');
      if (!secDataEl) return;
      try {
        const data = JSON.parse(secDataEl.textContent || '{}');
        const ctxH = document.getElementById('pie-sector-horas');
        const ctxM = document.getElementById('pie-sector-montos');
        if (ctxH) chartSectorHoras = crearPie(ctxH, data.labels || [], (data.horas||[]).map(Number), 'Horas (minutos) por sector');
        if (ctxM) chartSectorMontos = crearPie(ctxM, data.labels || [], (data.importes||[]).map(Number), 'Monto por sector');
      } catch(e){ /* noop */ }
    }
    function initMotivoCharts(){
      if (chartMotivoHoras || chartMotivoMontos) return;
      const motDataEl = document.getElementById('chart-motivo-data');
      if (!motDataEl) return;
      try {
        const data = JSON.parse(motDataEl.textContent || '{}');
        const ctxH = document.getElementById('pie-motivo-horas');
        const ctxM = document.getElementById('pie-motivo-montos');
        if (ctxH) chartMotivoHoras = crearPie(ctxH, data.labels || [], (data.horas||[]).map(Number), 'Horas (minutos) por motivo');
        if (ctxM) chartMotivoMontos = crearPie(ctxM, data.labels || [], (data.importes||[]).map(Number), 'Monto por motivo');
      } catch(e){ /* noop */ }
    }

    document.querySelectorAll('button[data-bs-toggle="tab"]').forEach(btn=>{
      btn.addEventListener('shown.bs.tab', (ev)=>{
        const id = ev.target && ev.target.id;
        if (id === 'tab-sector-graf-tab') initSectorCharts();
        if (id === 'tab-motivo-graf-tab') initMotivoCharts();
      });
    });

    const sectorGrafTab = document.getElementById('tab-sector-graf');
    if (sectorGrafTab && sectorGrafTab.classList.contains('show')) initSectorCharts();
    const motivoGrafTab = document.getElementById('tab-motivo-graf');
    if (motivoGrafTab && motivoGrafTab.classList.contains('show')) initMotivoCharts();
  });
})();