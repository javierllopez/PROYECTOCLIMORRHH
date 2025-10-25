'use strict';

(function(){
  function iniciar() {
    var datos = document.getElementById('datosImport');
    if (!datos) return;
    var trabajoId = datos.getAttribute('data-trabajo-id');
    if (!trabajoId) return;

    var estadoEl = document.getElementById('estado');
    var resEl = document.getElementById('resultado');
    var msgEl = document.getElementById('mensajeFinal');
    var errBox = document.getElementById('error');
    var errMsg = document.getElementById('mensajeError');

    async function poll() {
      try {
        var r = await fetch('/personal/importar/estado/' + encodeURIComponent(trabajoId) + '.json', { cache: 'no-store' });
        if (!r.ok) throw new Error('No se pudo consultar el estado.');
        var data = await r.json();
        if (data.estado === 'terminado') {
          if (estadoEl) estadoEl.classList.add('d-none');
          if (resEl) resEl.classList.remove('d-none');
          if (msgEl) msgEl.textContent = data.mensaje || 'Proceso finalizado.';
          return;
        }
        if (data.estado === 'error') {
          if (estadoEl) estadoEl.classList.add('d-none');
          if (errBox) errBox.classList.remove('d-none');
          if (errMsg) errMsg.textContent = data.error || 'Ocurrió un error durante la importación.';
          return;
        }
        setTimeout(poll, 2000);
      } catch (e) {
        setTimeout(poll, 3000);
      }
    }

    poll();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }
})();
