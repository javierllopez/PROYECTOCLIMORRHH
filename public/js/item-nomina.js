// Lógica de visibilidad para Item de Nómina (CSP-safe)
(function(){
  function toggle(el, show){ if (el) el.style.visibility = show ? 'visible' : 'hidden'; }
  function setup(){
    const cbBasico = document.getElementById('idInformaValorSueldoBasico');
    const horasMens = document.getElementById('HorasMensuales');
    const lblHorasMens = document.getElementById('lblHorasMensuales');

    const cbGD = document.getElementById('idInformaGuardiaDiurna');
    const horasGD = document.getElementById('HorasGuardiaDiurna');
    const lblHorasGD = document.getElementById('lblHorasGuardiaDiurna');

    const cbGN = document.getElementById('idInformaGuardiaNocturna');
    const horasGN = document.getElementById('HorasGuardiaNocturna');
    const lblHorasGN = document.getElementById('lblHorasGuardiaNocturna');

    const cbAdic = document.getElementById('idInformaAdicionalMensual');
    const txtAdic = document.getElementById('TextoAdicionalMensual');
    const lblTxtAdic = document.getElementById('LblTextoAdicionalMensual');

    const refresh = () => {
      toggle(horasMens, cbBasico && cbBasico.checked);
      toggle(lblHorasMens, cbBasico && cbBasico.checked);
      toggle(horasGD, cbGD && cbGD.checked);
      toggle(lblHorasGD, cbGD && cbGD.checked);
      toggle(horasGN, cbGN && cbGN.checked);
      toggle(lblHorasGN, cbGN && cbGN.checked);
      toggle(txtAdic, cbAdic && cbAdic.checked);
      toggle(lblTxtAdic, cbAdic && cbAdic.checked);
    };

    if (cbBasico) cbBasico.addEventListener('change', refresh);
    if (cbGD) cbGD.addEventListener('change', refresh);
    if (cbGN) cbGN.addEventListener('change', refresh);
    if (cbAdic) cbAdic.addEventListener('change', refresh);

    refresh();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup);
  } else { setup(); }
})();
