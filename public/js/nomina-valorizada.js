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
    const d = new Date(ymd + 'T00:00:00Z');
    if (isNaN(d.getTime())) return '';
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
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
  });
})();
