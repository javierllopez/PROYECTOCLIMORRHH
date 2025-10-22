// Renderiza pequeños gráficos de líneas sobre canvases con clase "sparkline".
(function(){
  const parsearPuntos = (canvas) => {
    try {
      const texto = canvas.getAttribute('data-puntos') || '[]';
      const valores = JSON.parse(texto);
      return Array.isArray(valores) ? valores : [];
    } catch (error) {
      return [];
    }
  };

  const crearSparkline = (canvas) => {
    if (typeof Chart === 'undefined' || !canvas) return;
    const puntos = parsearPuntos(canvas);
    const borde = canvas.getAttribute('data-color') || '#0d6efd';
    const fondo = canvas.getAttribute('data-background') || 'rgba(13,110,253,0.10)';
    const contexto = canvas.getContext('2d');
    if (!contexto) return;

    return new Chart(contexto, {
      type: 'line',
      data: {
        labels: puntos.map((_, indice) => indice + 1),
        datasets: [{
          data: puntos,
          borderColor: borde,
          backgroundColor: fondo,
          tension: 0.3,
          fill: true,
          pointRadius: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { enabled: false }
        },
        scales: {
          x: { display: false },
          y: { display: false }
        }
      }
    });
  };

  const inicializar = () => {
    const canvases = document.querySelectorAll('canvas.sparkline');
    if (!canvases.length) return;
    canvases.forEach(crearSparkline);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializar);
  } else {
    inicializar();
  }
})();
