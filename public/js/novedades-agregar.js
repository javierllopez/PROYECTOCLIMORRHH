// Lógica para novedadesAgregar (CSP-safe)
(function(){
  const qs = (s, r=document) => r.querySelector(s);
  const on = (el, ev, fn) => el && el.addEventListener(ev, fn);

  const onMotivoChange = () => {
    const sel = qs('#MotivoExtra');
    if (!sel) return;
    const opt = sel.options[sel.selectedIndex];
    if (!opt) return;
    const reemplazo = opt.getAttribute('data-Reemplazo');
    const descripcion = opt.getAttribute('data-Observaciones');
    const rep = qs('#ReemplazoExtra');
    const obs = qs('#ObservacionesExtra');
    if (rep) rep.style.display = (reemplazo == '1') ? 'block' : 'none';
    const repSel = qs('#IdEmpleadoReemplazoExtra');
    if (repSel) repSel.required = (reemplazo == '1');
    if (obs) obs.style.display = (descripcion == '1') ? 'block' : 'none';
    const obsInp = qs('#DescripcionObligatoriaExtra');
    if (obsInp) obsInp.required = (descripcion == '1');
  };

  const onNominaChange = () => {
    const sel = qs('#Nomina');
    if (!sel) return;
    const opt = sel.options[sel.selectedIndex];
    if (!opt) return;
    const horas = opt.getAttribute('data-horas') === '1';
    const guardias = opt.getAttribute('data-guardias') === '1';
    const horasSec = qs('#Horas');
    const guardiasSec = qs('#Guardias');
    if (horasSec) horasSec.style.display = horas ? 'block' : 'none';
    if (guardiasSec) guardiasSec.style.display = guardias ? 'block' : 'none';
    // requeridos
    const req = (sel, v) => { const el = qs(sel); if (el) el.required = v; };
    req('#FechaHoras', horas);
    req('#HoraInicio', horas);
    req('#HoraFin', horas);
    req('#FechaGuardia', guardias);
    req('#GuardiaRealizada', guardias);
    req('#TipoGuardia', guardias);
    const tipo = qs('#TipoNovedad');
    if (tipo) tipo.value = horas ? 'Horas' : (guardias ? 'Guardias' : '');
  };

  const onTipoGuardiaChange = () => {
    const sel = qs('#TipoGuardia');
    const show = sel && sel.value == '2';
    const cont = qs('#GuardiaParcial');
    if (cont) cont.style.display = show ? 'block' : 'none';
    const req = (sel, v) => { const el = qs(sel); if (el) el.required = v; };
    req('#InicioGuardiaParcial', show);
    req('#FinGuardiaParcial', show);
  };

  const onReset = () => {
    const hide = (id)=>{ const el = qs(id); if (el) el.style.display = 'none'; };
    hide('#Horas'); hide('#Guardias'); hide('#ReemplazoExtra'); hide('#ObservacionesExtra'); hide('#GuardiaParcial');
    ['#FechaHoras','#HoraInicio','#HoraFin','#FechaGuardia','#GuardiaRealizada','#TipoGuardia','#IdEmpleadoReemplazoExtra','#DescripcionObligatoriaExtra','#InicioGuardiaParcial','#FinGuardiaParcial']
      .forEach(sel=>{ const el = qs(sel); if (el) el.required = false; });
  };

  const init = () => {
    on(qs('#MotivoExtra'), 'change', onMotivoChange);
    on(qs('#Nomina'), 'change', onNominaChange);
    on(qs('#TipoGuardia'), 'change', onTipoGuardiaChange);
    const resetBtn = document.querySelector('button[type="reset"]');
    on(resetBtn, 'click', onReset);
  };
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); } else { init(); }
})();
