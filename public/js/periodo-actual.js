// Coordina la visualización del período y el autocompletado de fechas en la pantalla de nuevo período.
(function(){
  const BLOQUEADOS = new Set(['e', 'E', '+', '-', '.', ' ', ',']);

  const normalizarMes = (valor) => {
    const soloDigitos = String(valor || '').replace(/\D+/g, '').slice(0, 2);
    if (!soloDigitos) return '';
    let numero = parseInt(soloDigitos, 10);
    if (Number.isNaN(numero)) return '';
    if (numero < 1) numero = 1;
    if (numero > 12) numero = 12;
    return String(numero);
  };

  const actualizarPeriodo = ({ mesInput, anioInput, periodoDisplay, novedadesHasta }) => {
    const mesNormalizado = normalizarMes(mesInput.value);
    const anio = anioInput.value;

    if (mesNormalizado !== mesInput.value) {
      mesInput.value = mesNormalizado;
    }

    if (mesNormalizado && anio) {
      const mesIndex = parseInt(mesNormalizado, 10) - 1;
      const nombreMes = new Date(0, mesIndex).toLocaleString('es-AR', { month: 'long' });
      const capitalizado = nombreMes.charAt(0).toUpperCase() + nombreMes.slice(1);
      periodoDisplay.textContent = `${capitalizado} ${anio}`;
      const ultimoDia = new Date(Number(anio), mesIndex + 1, 0).toISOString().split('T')[0];
      if (novedadesHasta) {
        novedadesHasta.value = ultimoDia;
      }
    } else {
      periodoDisplay.textContent = '';
      if (novedadesHasta) {
        novedadesHasta.value = '';
      }
    }
  };

  const inicializar = () => {
    const mesInput = document.getElementById('mes');
    const anioInput = document.getElementById('anio');
    const novedadesHasta = document.getElementById('NovedadesHasta');
    const periodoDisplay = document.getElementById('periodoDisplay');

    if (!mesInput || !anioInput || !periodoDisplay) return;

    const contexto = { mesInput, anioInput, periodoDisplay, novedadesHasta };
    let autoTabTimer = null;

    mesInput.addEventListener('keydown', (evento) => {
      if (BLOQUEADOS.has(evento.key)) {
        evento.preventDefault();
      }
    });

    mesInput.addEventListener('input', () => {
      actualizarPeriodo(contexto);
      clearTimeout(autoTabTimer);
      autoTabTimer = setTimeout(() => {
        const valor = mesInput.value;
        if (!valor) return;
        if (valor.length === 2 || (valor.length === 1 && valor !== '1')) {
          const numero = parseInt(valor, 10);
          if (numero >= 1 && numero <= 12) {
            anioInput.focus();
            anioInput.select();
          }
        }
      }, 120);
    });

    mesInput.addEventListener('paste', (evento) => {
      evento.preventDefault();
      const texto = (evento.clipboardData || window.clipboardData).getData('text');
      mesInput.value = normalizarMes(texto);
      actualizarPeriodo(contexto);
    });

    anioInput.addEventListener('input', () => actualizarPeriodo(contexto));
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializar);
  } else {
    inicializar();
  }
})();
