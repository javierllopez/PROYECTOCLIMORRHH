// Maneja la barra de progreso simulada al enviar formularios de mapeo de importación.
(function(){
  const mostrarProgreso = (formulario) => {
    if (formulario.dataset.progressShown === 'true') return;
    const contenedor = document.createElement('div');
    contenedor.className = 'progress mt-4';
    contenedor.innerHTML = '<div class="progress-bar progress-bar-striped progress-bar-animated" role="progressbar" style="width: 100%">Importando...</div>';
    formulario.parentNode.insertBefore(contenedor, formulario.nextSibling);
    formulario.dataset.progressShown = 'true';
  };

  const mostrarOverlay = (formulario) => {
    const overlaySelector = formulario.dataset.overlayTarget;
    if (overlaySelector) {
      const overlay = document.querySelector(overlaySelector);
      if (overlay) {
        overlay.style.display = overlay.dataset.display || 'flex';
      }
    }
    const blurSelector = formulario.dataset.blurTarget;
    if (blurSelector) {
      const elementoParaBlur = document.querySelector(blurSelector);
      if (elementoParaBlur) {
        elementoParaBlur.classList.add('blur-on-import');
      }
    }
  };

  const inicializar = () => {
    const formularios = document.querySelectorAll('.form-mapeo-importacion');
    formularios.forEach((formulario) => {
      formulario.addEventListener('submit', () => {
        mostrarOverlay(formulario);
        if (formulario.dataset.progress !== 'false') {
          mostrarProgreso(formulario);
        }
      }, { once: true });
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializar);
  } else {
    inicializar();
  }
})();
