// Lógica de validación y toggles para Autorizar Horas (CSP-safe)
(function(){
  function handleSelectChange(reemplaza, observaciones) {
    const r = String(reemplaza);
    const o = String(observaciones);
    const reemplazaArea = document.getElementById('ReemplazaArea');
    const observacionesArea = document.getElementById('ObservacionesArea');
    const reemplazo = document.getElementById('reemplazo');
    const obs = document.getElementById('observaciones');

    if (reemplazaArea && reemplazo) {
      if (r === '1') {
        reemplazaArea.style.display = 'block';
        reemplazo.setAttribute('required', 'required');
      } else {
        reemplazaArea.style.display = 'none';
        reemplazo.removeAttribute('required');
      }
    }

    if (observacionesArea && obs) {
      if (o === '1') {
        observacionesArea.style.display = 'block';
        obs.setAttribute('required', 'required');
      } else {
        observacionesArea.style.display = 'none';
        obs.removeAttribute('required');
      }
    }
  }

  function setup(){
    const selectElement = document.getElementById('motivo');
    if (selectElement) {
      selectElement.addEventListener('change', (event) => {
        const selectedOption = event.target.options[event.target.selectedIndex];
        const observaciones = selectedOption.getAttribute('data-observaciones');
        const reemplaza = selectedOption.getAttribute('data-reemplaza');
        handleSelectChange(reemplaza, observaciones);
      });
      // Si hay un valor preseleccionado, aplicar el estado inicial
      const initial = selectElement.options[selectElement.selectedIndex];
      if (initial) {
        handleSelectChange(initial.getAttribute('data-reemplaza'), initial.getAttribute('data-observaciones'));
      }
    }

    const form = document.getElementById('autorizarHorasForm');
    if (form) {
      form.addEventListener('submit', (event) => {
        if (!form.checkValidity()) {
          event.preventDefault();
          event.stopPropagation();
        }
        form.classList.add('was-validated');
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup);
  } else { setup(); }
})();
