// Muestra mensajes y confirmaciones usando SweetAlert2 leyendo datos embebidos en el DOM

//const { database } = require("../../claves");

// Espera elementos opcionales con IDs: flash-mensaje, flash-confirmar con atributos data-*
(function(){
  const run = () => {
    try {
      const msgEl = document.getElementById('flash-mensaje');
      if (msgEl) {
        const title = msgEl.getAttribute('data-title') || '';
        const text = msgEl.getAttribute('data-text') || '';
        const icon = msgEl.getAttribute('data-icon') || 'info';
        if (window.Swal) { Swal.fire({ title, text, icon }); }
      }
      const confEl = document.getElementById('flash-confirmar');
      if (confEl) {
        const title = confEl.getAttribute('data-title') || '';
        const text = confEl.getAttribute('data-text') || '';
        const icon = confEl.getAttribute('data-icon') || 'question';
        const okUrl = confEl.getAttribute('data-ok') || '';
        console.log('Confirmar URL:', confEl);
        if (window.Swal) {
          Swal.fire({
            title,
            text,
            icon,
            showCancelButton: true,
            confirmButtonText: 'Aceptar',
            cancelButtonText: 'Cancelar'
          }).then(res => {
            if (res.isConfirmed && okUrl) { window.location.href = okUrl; }
          });
        }
      }
    } catch(e) { /* noop */ }
  };
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', run); } else { run(); }
})();
