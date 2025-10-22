// Control de UI para Generar Nómina (CSP-safe)
// - Muestra/oculta sección de aumento
// - Precarga valores desde template JSON
// - Muestra spinner y oculta botón al enviar

(function () {
  document.addEventListener('DOMContentLoaded', function () {
    const opAumento = document.getElementById('GeneraSobreNominaAnterior');
    const opNueva = document.getElementById('NominaNueva');
    const seccion = document.getElementById('seccion');

    if (seccion) {
      seccion.style.display = 'none';
      const toggle = () => {
        seccion.style.display = opAumento && opAumento.checked ? 'block' : 'none';
      };
      if (opAumento) opAumento.addEventListener('change', toggle);
      if (opNueva) opNueva.addEventListener('change', toggle);
      // Llamado inicial por si viene preseleccionado
      toggle();
    }

    // Precarga de paquete desde template JSON
    const tpl = document.getElementById('paquete-json');
    if (tpl && tpl.textContent && tpl.textContent.trim() !== '') {
      try {
        const paquete = JSON.parse(tpl.textContent);
        if (paquete) {
          const desde = document.getElementById('VigenteDesde');
          const hasta = document.getElementById('VigenteHasta');
          const aumento = document.getElementById('Aumento');
          const idNominaBase = document.getElementById('IdNominaBase');
          if (desde && paquete.VigenteDesde) desde.value = paquete.VigenteDesde;
          if (hasta && paquete.VigenteHasta) hasta.value = paquete.VigenteHasta;
          if (aumento && (paquete.Aumento ?? paquete.Aumento === 0)) aumento.value = paquete.Aumento;
          if (idNominaBase && paquete.IdNominaBase) idNominaBase.value = paquete.IdNominaBase;
        }
      } catch (e) {
        console.error('No se pudo parsear paquete-json', e);
      }
    }

    // Spinner al enviar
    const form = document.querySelector('form[action="/nominaValorizada/generarNomina"]');
    if (form) {
      form.addEventListener('submit', function () {
        const btn = document.getElementById('submitBtn');
        const spinner = document.getElementById('spinner');
        if (btn) btn.style.display = 'none';
        if (spinner) spinner.style.display = 'inline-block';
      });
    }
  });
})();
