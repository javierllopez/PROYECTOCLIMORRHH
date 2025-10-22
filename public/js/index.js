// Gráficos del home: versión externa compatible con CSP, replica el inline original

(function(){
  const obtenerDashboard = () => {
    const script = document.getElementById('dashboard-data');
    if (!script) return null;
    try { return JSON.parse(script.textContent || '{}'); } catch (e) { return null; }
  };

  const minutosAFormato = (minutos) => {
    const horas = Math.floor(minutos / 60).toString().padStart(2, '0');
    const mins = (minutos % 60).toString().padStart(2, '0');
    return `${horas}:${mins}`;
  };

  const monedaArs = (valor) => {
    try {
      return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(valor) || 0);
    } catch (e) {
      const n = Number(valor) || 0;
      return `$ ${n.toFixed(2)}`;
    }
  };

  const registrarDataLabels = () => {
    const DLP = (typeof ChartDataLabels !== 'undefined') ? ChartDataLabels : null;
    if (DLP && typeof Chart !== 'undefined' && Chart.register) {
      try { Chart.register(DLP); } catch (e) {}
    }
  };

  const coloresBase = ['#0d6efd', '#dc3545', '#198754', '#ffc107', '#20c997', '#6f42c1', '#fd7e14', '#6610f2', '#adb5bd', '#198754', '#e83e8c', '#20c997', '#343a40', '#ffc107', '#6c757d'];
  const obtenerColores = (cantidad) => {
    const colores = coloresBase.slice();
    while (colores.length < cantidad) {
      colores.push('#' + Math.floor(Math.random() * 16777215).toString(16));
    }
    return colores.slice(0, cantidad);
  };

  const iniciar = () => {
  const dashboard = obtenerDashboard();
    if (!dashboard || typeof Chart === 'undefined') return;

    registrarDataLabels();

    const ctxSectores = document.getElementById('tortaMinutosSectores');
    const ctxMotivos = document.getElementById('tortaMinutosMotivos');
    const ctxLinea = document.getElementById('lineaHoras');
    const ctxBarras = document.getElementById('barrasImportes');

    if (ctxSectores && dashboard.graficoTortaSectores) {
      const colores = obtenerColores((dashboard.graficoTortaSectores.labels || []).length);
      new Chart(ctxSectores, {
        type: 'doughnut',
        data: {
          labels: dashboard.graficoTortaSectores.labels,
          datasets: [{ data: dashboard.graficoTortaSectores.data, backgroundColor: colores }]
        },
        options: {
          onClick: function () { window.location.href = '/detalleHorasSectores'; },
          plugins: {
            legend: { position: 'bottom' },
            datalabels: {
              color: '#222',
              font: { weight: 'bold', size: 13 },
              formatter: function (value, context) {
                const total = (context.chart.data.datasets[0].data || []).reduce(function (a, b) { return a + (b || 0); }, 0) || 1;
                const pct = Math.round((value / total) * 100);
                return value > 0 ? `${context.chart.data.labels[context.dataIndex]} (${pct}%)` : '';
              }
            },
            tooltip: {
              callbacks: {
                label: function (context) {
                  const minutos = context.parsed;
                  const total = (context.dataset.data || []).reduce(function (a, b) { return a + (b || 0); }, 0) || 1;
                  const pct = Math.round((minutos / total) * 100);
                  return `${context.label}: ${minutosAFormato(minutos)} (${pct}%)`;
                }
              }
            }
          }
        }
      });
    }

    if (ctxMotivos && dashboard.graficoTortaMotivos) {
      const coloresM = obtenerColores((dashboard.graficoTortaMotivos.labels || []).length);
      new Chart(ctxMotivos, {
        type: 'doughnut',
        data: {
          labels: dashboard.graficoTortaMotivos.labels,
          datasets: [{ data: dashboard.graficoTortaMotivos.data, backgroundColor: coloresM }]
        },
        options: {
          onClick: function () { window.location.href = '/detalleHorasMotivos'; },
          plugins: {
            legend: { position: 'bottom' },
            datalabels: {
              color: '#222',
              font: { weight: 'bold', size: 13 },
              formatter: function (value, context) {
                const total = (context.chart.data.datasets[0].data || []).reduce(function (a, b) { return a + (b || 0); }, 0) || 1;
                const pct = Math.round((value / total) * 100);
                return value > 0 ? `${context.chart.data.labels[context.dataIndex]} (${pct}%)` : '';
              }
            },
            tooltip: {
              callbacks: {
                label: function (context) {
                  const minutos = context.parsed;
                  const total = (context.dataset.data || []).reduce(function (a, b) { return a + (b || 0); }, 0) || 1;
                  const pct = Math.round((minutos / total) * 100);
                  return `${context.label}: ${minutosAFormato(minutos)} (${pct}%)`;
                }
              }
            }
          }
        }
      });
    }

    if (ctxLinea && dashboard.graficoLineaHoras && (dashboard.graficoLineaHoras.labels || []).length) {
      new Chart(ctxLinea, {
        type: 'line',
        data: {
          labels: dashboard.graficoLineaHoras.labels,
          datasets: [
            { label: 'Hs 50%', data: dashboard.graficoLineaHoras.min50, borderColor: '#0d6efd', backgroundColor: 'rgba(13,110,253,0.15)', tension: 0.2, fill: true },
            { label: 'Hs 100%', data: dashboard.graficoLineaHoras.min100, borderColor: '#dc3545', backgroundColor: 'rgba(220,53,69,0.15)', tension: 0.2, fill: true },
            { label: 'Total', data: dashboard.graficoLineaHoras.total, borderColor: '#198754', backgroundColor: 'rgba(25,135,84,0.15)', tension: 0.2, fill: true }
          ]
        },
        options: {
          plugins: {
            legend: { position: 'bottom' },
            datalabels: { display: false },
            tooltip: {
              callbacks: {
                label: function (context) {
                  const minutos = context.parsed.y || 0;
                  return `${context.dataset.label}: ${minutosAFormato(minutos)}`;
                }
              }
            }
          },
          scales: {
            y: {
              ticks: {
                callback: function (value) { return minutosAFormato(value); }
              }
            }
          }
        }
      });
      ctxLinea.addEventListener('click', function () { window.location.href = '/evolucionHorasSectores'; });
    }

    if (ctxBarras && dashboard.graficoLineaImportes && (dashboard.graficoLineaImportes.labels || []).length) {
      new Chart(ctxBarras, {
        type: 'bar',
        data: {
          labels: dashboard.graficoLineaImportes.labels,
          datasets: [
            { label: 'Importes pagados', data: dashboard.graficoLineaImportes.importes, backgroundColor: 'rgba(13,110,253,0.25)', borderColor: '#0d6efd', borderWidth: 1 }
          ]
        },
        options: {
          plugins: {
            legend: { position: 'bottom' },
            datalabels: { display: false },
            tooltip: {
              callbacks: {
                label: function (context) {
                  const valor = (context.parsed && (context.parsed.y != null)) ? context.parsed.y : context.parsed;
                  return `${context.dataset.label}: ${monedaArs(valor || 0)}`;
                }
              }
            }
          },
          scales: {
            y: {
              ticks: {
                callback: function (value) { return monedaArs(value); }
              }
            }
          }
        }
      });
      ctxBarras.addEventListener('click', function () { window.location.href = '/evolucionImportesSectores'; });
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }
})();
