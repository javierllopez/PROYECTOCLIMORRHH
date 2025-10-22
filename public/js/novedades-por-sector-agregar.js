// Controla la lógica del formulario de altas de novedades por sector.
(function(){
  const actualizarCamposMotivo = (estado) => {
    const { motivoSelect, informaReemplazoDiv, reemplazoInput, informaObservacionesDiv, observacionesInput } = estado;
    if (!motivoSelect) return;
    const opcion = motivoSelect.options[motivoSelect.selectedIndex];
    if (!opcion || !opcion.value) {
      if (informaReemplazoDiv) informaReemplazoDiv.style.display = 'none';
      if (reemplazoInput) reemplazoInput.required = false;
      if (informaObservacionesDiv) informaObservacionesDiv.style.display = 'none';
      if (observacionesInput) observacionesInput.required = false;
      return;
    }
    const requiereReemplazo = opcion.getAttribute('data-informareemplazo');
    const requiereObservaciones = opcion.getAttribute('data-descripcionobligatoria');
    if (requiereReemplazo === '1' || requiereReemplazo === 'true') {
      if (informaReemplazoDiv) informaReemplazoDiv.style.display = '';
      if (reemplazoInput) reemplazoInput.required = true;
    } else {
      if (informaReemplazoDiv) informaReemplazoDiv.style.display = 'none';
      if (reemplazoInput) reemplazoInput.required = false;
    }
    if (requiereObservaciones === '1' || requiereObservaciones === 'true') {
      if (informaObservacionesDiv) informaObservacionesDiv.style.display = '';
      if (observacionesInput) observacionesInput.required = true;
    } else {
      if (informaObservacionesDiv) informaObservacionesDiv.style.display = 'none';
      if (observacionesInput) observacionesInput.required = false;
    }
  };

  const limpiarNomina = (estado) => {
    const { nominaSelect, tipoNovedadInput, informaHorasDiv, informaGuardiasDiv, fechaHorasInput, inicioInput, finInput, rowGuardiaParcial, inicioGuardiaParcial, finGuardiaParcial } = estado;
    if (!nominaSelect) return;
    nominaSelect.innerHTML = '<option value="">Seleccione una nómina...</option>';
    nominaSelect.value = '';
    nominaSelect.disabled = true;
    if (tipoNovedadInput) tipoNovedadInput.value = '';
    if (informaHorasDiv) informaHorasDiv.style.display = 'none';
    if (informaGuardiasDiv) informaGuardiasDiv.style.display = 'none';
    if (fechaHorasInput) { fechaHorasInput.required = false; fechaHorasInput.value = ''; }
    if (inicioInput) { inicioInput.required = false; inicioInput.value = ''; }
    if (finInput) { finInput.required = false; finInput.value = ''; }
    if (rowGuardiaParcial) rowGuardiaParcial.style.display = 'none';
    if (inicioGuardiaParcial) { inicioGuardiaParcial.required = false; inicioGuardiaParcial.value = ''; }
    if (finGuardiaParcial) { finGuardiaParcial.required = false; finGuardiaParcial.value = ''; }
  };

  const llenarNominasPorCategoria = (estado, categoriaId) => {
    const { nominaSelect, nominaTemplate } = estado;
    limpiarNomina(estado);
    if (!nominaSelect || !nominaTemplate || !categoriaId) return;
    Array.from(nominaTemplate.options).forEach((opcion) => {
      if (String(opcion.dataset.categoria) === String(categoriaId)) {
        const clon = document.createElement('option');
        clon.value = opcion.value;
        clon.textContent = opcion.textContent;
        if (opcion.dataset.horasmensuales) clon.dataset.horasmensuales = opcion.dataset.horasmensuales;
        if (opcion.dataset.haceguardiasdiurnas) clon.dataset.haceguardiasdiurnas = opcion.dataset.haceguardiasdiurnas;
        nominaSelect.appendChild(clon);
      }
    });
    if (nominaSelect.options.length > 1) {
      nominaSelect.disabled = false;
    }
  };

  const actualizarTipoGuardia = (estado) => {
    const { tipoGuardiaSelect, rowGuardiaParcial, inicioGuardiaParcial, finGuardiaParcial } = estado;
    if (!tipoGuardiaSelect || !rowGuardiaParcial) return;
    const esParcial = tipoGuardiaSelect.value === 'Parcial';
    rowGuardiaParcial.style.display = esParcial ? '' : 'none';
    if (inicioGuardiaParcial) {
      inicioGuardiaParcial.required = esParcial;
      if (!esParcial) inicioGuardiaParcial.value = '';
    }
    if (finGuardiaParcial) {
      finGuardiaParcial.required = esParcial;
      if (!esParcial) finGuardiaParcial.value = '';
    }
  };

  const actualizarCamposNomina = (estado) => {
    const { nominaSelect, informaHorasDiv, informaGuardiasDiv, tipoNovedadInput, fechaHorasInput, inicioInput, finInput, tipoGuardiaSelect } = estado;
    if (!nominaSelect) return;
    const opcion = nominaSelect.options[nominaSelect.selectedIndex];
    if (!opcion || !opcion.value) {
      if (informaHorasDiv) informaHorasDiv.style.display = 'none';
      if (informaGuardiasDiv) informaGuardiasDiv.style.display = 'none';
      if (tipoNovedadInput) tipoNovedadInput.value = '';
      if (fechaHorasInput) fechaHorasInput.required = false;
      if (inicioInput) inicioInput.required = false;
      if (finInput) finInput.required = false;
      actualizarTipoGuardia(estado);
      return;
    }
    const horasMensuales = parseInt(opcion.getAttribute('data-horasmensuales') || '0', 10);
    const haceGuardias = opcion.getAttribute('data-haceguardiasdiurnas');
    const esHoras = !Number.isNaN(horasMensuales) && horasMensuales > 0;

    if (esHoras) {
      if (informaHorasDiv) informaHorasDiv.style.display = '';
      if (informaGuardiasDiv) informaGuardiasDiv.style.display = 'none';
      if (tipoNovedadInput) tipoNovedadInput.value = 'horas';
      if (fechaHorasInput) fechaHorasInput.required = true;
      if (inicioInput) inicioInput.required = true;
      if (finInput) finInput.required = true;
    } else if (haceGuardias === '1' || haceGuardias === 'true') {
      if (informaHorasDiv) informaHorasDiv.style.display = 'none';
      if (informaGuardiasDiv) informaGuardiasDiv.style.display = '';
      if (tipoNovedadInput) tipoNovedadInput.value = 'guardia';
      if (fechaHorasInput) { fechaHorasInput.required = false; fechaHorasInput.value = ''; }
      if (inicioInput) { inicioInput.required = false; inicioInput.value = ''; }
      if (finInput) { finInput.required = false; finInput.value = ''; }
    } else {
      if (informaHorasDiv) informaHorasDiv.style.display = 'none';
      if (informaGuardiasDiv) informaGuardiasDiv.style.display = 'none';
      if (tipoNovedadInput) tipoNovedadInput.value = '';
      if (fechaHorasInput) { fechaHorasInput.required = false; fechaHorasInput.value = ''; }
      if (inicioInput) { inicioInput.required = false; inicioInput.value = ''; }
      if (finInput) { finInput.required = false; finInput.value = ''; }
    }
    actualizarTipoGuardia(estado);
  };

  const inicializar = () => {
    const estado = {
      form: document.getElementById('formNovedadSector'),
      motivoSelect: document.getElementById('Motivo'),
      informaReemplazoDiv: document.getElementById('InformaReemplazo'),
      informaObservacionesDiv: document.getElementById('InformaObservaciones'),
      reemplazoInput: document.getElementById('empleadoReemplazo'),
      observacionesInput: document.getElementById('Observaciones'),
      idPersonalSelect: document.getElementById('IdPersonal'),
      nominaSelect: document.getElementById('IdNomina'),
      nominaTemplate: document.getElementById('NominaTemplate'),
      informaHorasDiv: document.getElementById('informaHoras'),
      informaGuardiasDiv: document.getElementById('informaGuardias'),
      tipoNovedadInput: document.getElementById('TipoNovedad'),
      fechaHorasInput: document.getElementById('Fecha'),
      inicioInput: document.getElementById('Inicio'),
      finInput: document.getElementById('Fin'),
      tipoGuardiaSelect: document.getElementById('TipoGuardia'),
      rowGuardiaParcial: document.getElementById('rowGuardiaParcial'),
      inicioGuardiaParcial: document.getElementById('InicioGuardiaParcial'),
      finGuardiaParcial: document.getElementById('FinGuardiaParcial')
    };

    if (!estado.form) return;

    if (estado.motivoSelect) {
      estado.motivoSelect.addEventListener('change', () => actualizarCamposMotivo(estado));
    }

    if (estado.nominaSelect) {
      estado.nominaSelect.addEventListener('change', () => actualizarCamposNomina(estado));
    }

    if (estado.tipoGuardiaSelect) {
      estado.tipoGuardiaSelect.addEventListener('change', () => actualizarTipoGuardia(estado));
    }

    if (estado.idPersonalSelect) {
      estado.idPersonalSelect.addEventListener('change', () => {
        const opcion = estado.idPersonalSelect.options[estado.idPersonalSelect.selectedIndex];
        const categoria = opcion && opcion.value ? opcion.getAttribute('data-categoria') : '';
        llenarNominasPorCategoria(estado, categoria);
        actualizarCamposNomina(estado);
      });
    }

    estado.form.addEventListener('reset', () => {
      setTimeout(() => {
        if (estado.informaReemplazoDiv) estado.informaReemplazoDiv.style.display = 'none';
        if (estado.reemplazoInput) estado.reemplazoInput.required = false;
        if (estado.informaObservacionesDiv) estado.informaObservacionesDiv.style.display = 'none';
        if (estado.observacionesInput) estado.observacionesInput.required = false;
        limpiarNomina(estado);
      }, 0);
    });

    actualizarCamposMotivo(estado);
    limpiarNomina(estado);
    actualizarTipoGuardia(estado);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializar);
  } else {
    inicializar();
  }
})();
