/**
 * Script de Nómina Valorizada (CSP friendly, sin inline JS)
 * - Normaliza textos del selector de períodos a DD/MM/YYYY
 * - Envía POST a /nominaValorizada/filtroGeneral al cambiar el período
 */
(function(){
  function fechaUtcATextoLocal(entrada) {
    if (!entrada) return '';
    const s = String(entrada);
    const ymd = s.includes('T') ? s.split('T')[0] : (s.includes(' ') ? s.split(' ')[0] : s);
    // Construir fecha en horario local a partir de YYYY-MM-DD para evitar desplazamientos por TZ
    const parts = ymd.split('-').map(p => parseInt(p, 10));
    if (parts.length < 3 || parts.some(p => Number.isNaN(p))) return '';
    const [yyyy, mm, dd] = parts;
    const d = new Date(yyyy, mm - 1, dd); // medianoche local
    const ddStr = String(d.getDate()).padStart(2, '0');
    const mmStr = String(d.getMonth() + 1).padStart(2, '0');
    const yyyyStr = d.getFullYear();
    return `${ddStr}/${mmStr}/${yyyyStr}`;
  }

  function ajustarTextoPeriodo() {
    const sel = document.getElementById('periodoNomina');
    if (!sel) return;
    sel.querySelectorAll('option').forEach(opt => {
      const desde = opt.getAttribute('data-desde');
      const hasta = opt.getAttribute('data-hasta');
      if (desde && hasta) {
        const desdeTxt = fechaUtcATextoLocal(desde);
        const hastaTxt = fechaUtcATextoLocal(hasta);
        if (desdeTxt && hastaTxt) {
          opt.textContent = `Entre ${desdeTxt} y ${hastaTxt}`;
        }
      }
    });
  }

  async function onPeriodoChange(e){
    const selectedValue = e.target.value;
    try {
      const response = await fetch('/nominaValorizada/filtroGeneral', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filtro: selectedValue })
      });
      if (!response.ok) throw new Error('Network response was not ok');
      window.location.reload();
    } catch (error) {
      // Silencioso en UI, log en consola
      console.error('Error enviando filtroGeneral:', error);
      window.location.reload();
    }
  }

  function ready(fn){
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  ready(function(){
    ajustarTextoPeriodo();
    const sel = document.getElementById('periodoNomina');
    if (sel) sel.addEventListener('change', onPeriodoChange, false);
    const botonActualizar = document.getElementById('botonActualizarNomina');
    if (sel && botonActualizar) {
      botonActualizar.addEventListener('click', function(evt){
        evt.preventDefault();
        const idSeleccionado = sel.value;
        const opcion = sel.options[sel.selectedIndex];
        const desde = opcion ? opcion.dataset.desde : null;
        const hasta = opcion ? opcion.dataset.hasta : null;
        const params = new URLSearchParams();
        if (idSeleccionado) params.append('idNomina', idSeleccionado);
        if (desde) params.append('vigenciaDesde', desde);
        if (hasta) params.append('vigenciaHasta', hasta);
        const queryString = params.toString();
        const destino = queryString ? `/nominaValorizada/actualizarNomina?${queryString}` : '/nominaValorizada/actualizarNomina';
        window.location.href = destino;
      }, false);
    }
  });
})();
