// Controla la visibilidad de campos según el ítem seleccionado al agregar manualmente.
(function(){
  const ocultarCampos = (agrupaciones) => {
    agrupaciones.forEach(([wrapper, input]) => {
      if (!wrapper) return;
      wrapper.classList.add('d-none');
      if (input) {
        input.value = '';
        input.disabled = true;
        input.required = false;
      }
    });
  };

  const mostrarCampo = (wrapper, input) => {
    if (!wrapper || !input) return;
    wrapper.classList.remove('d-none');
    input.disabled = false;
    input.required = true;
  };

  const cargarBandera = async (selector) => {
    try {
      const respuesta = await fetch(`/nominaValorizada/nomina/${encodeURIComponent(selector.value)}`);
      if (!respuesta.ok) throw new Error('No fue posible obtener la información del ítem.');
      return respuesta.json();
    } catch (error) {
      console.error(error);
      return null;
    }
  };

  const actualizarVisibilidad = async (estado) => {
    const { selNomina, wraps } = estado;
    if (!selNomina || !selNomina.value) {
      ocultarCampos(wraps);
      return;
    }
    const flags = await cargarBandera(selNomina);
    if (!flags) {
      ocultarCampos(wraps);
      return;
    }
    const {
      wrapSueldo,
      wrapGD,
      wrapGN,
      wrapGP,
      inputSueldo,
      inputGD,
      inputGN,
      inputGP
    } = estado;

    ocultarCampos(wraps);
    if (flags.InformaValorSueldoBasico) {
      mostrarCampo(wrapSueldo, inputSueldo);
    }
    if (flags.HaceGuardiasDiurnas) {
      mostrarCampo(wrapGD, inputGD);
    }
    if (flags.HaceGuardiasNocturnas) {
      mostrarCampo(wrapGN, inputGN);
    }
    if (flags.HaceGuardiasPasivas) {
      mostrarCampo(wrapGP, inputGP);
    }
  };

  const inicializar = () => {
    const estado = {
      selNomina: document.getElementById('idNomina'),
      wrapSueldo: document.getElementById('wrapSueldoBasico'),
      wrapGD: document.getElementById('wrapGD'),
      wrapGN: document.getElementById('wrapGN'),
      wrapGP: document.getElementById('wrapGP'),
      inputSueldo: document.getElementById('sueldoBasico'),
      inputGD: document.getElementById('guardiaDiurna'),
      inputGN: document.getElementById('guardiaNocturna'),
      inputGP: document.getElementById('guardiaPasiva')
    };

    estado.wraps = [
      [estado.wrapSueldo, estado.inputSueldo],
      [estado.wrapGD, estado.inputGD],
      [estado.wrapGN, estado.inputGN],
      [estado.wrapGP, estado.inputGP]
    ];

    if (!estado.selNomina) return;

    estado.selNomina.addEventListener('change', () => actualizarVisibilidad(estado));
    if (estado.selNomina.value) {
      actualizarVisibilidad(estado);
    } else {
      ocultarCampos(estado.wraps);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializar);
  } else {
    inicializar();
  }
})();
