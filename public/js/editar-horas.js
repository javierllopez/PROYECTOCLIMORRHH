// Lógica para Editar/Agregar Horas (CSP-safe)
(function(){
  const on = (el, ev, fn) => el && el.addEventListener(ev, fn);
  const qs = (s, r=document) => r.querySelector(s);

  const setTodayOnEntrada = () => {
    const fe = qs('#FechaEntrada');
    if (!fe || fe.value) return;
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,'0');
    const day = String(d.getDate()).padStart(2,'0');
    fe.value = `${y}-${m}-${day}`;
  };
  const copiarFechaEntradaEnSalida = () => {
    const fs = qs('#FechaSalida');
    const fe = qs('#FechaEntrada');
    if (!fs || !fe) return;
    on(fs, 'focus', ()=>{ fs.value = fe.value; });
  };

  const init = () => {
    setTodayOnEntrada();
    copiarFechaEntradaEnSalida();
  };
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); } else { init(); }
})();
