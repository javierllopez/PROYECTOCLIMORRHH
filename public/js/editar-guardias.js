// Lógica para Editar/Agregar Guardias (CSP-safe)
(function(){
  const qs = (s, r=document) => r.querySelector(s);
  const on = (el, ev, fn) => el && el.addEventListener(ev, fn);

  const syncPartialVisibility = () => {
    const sel = qs('#TipoGuardia');
    const cont = qs('#partialGuardiaDetails') || qs('#GuardiaParcial');
    if (!sel || !cont) return;
    cont.style.display = sel.value === '2' ? 'flex' : 'none';
  };

  const init = () => {
    const sel = qs('#TipoGuardia');
    on(sel, 'change', syncPartialVisibility);
    syncPartialVisibility();
  };

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); } else { init(); }
})();
