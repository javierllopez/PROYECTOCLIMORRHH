// Inicialización global de tooltips de Bootstrap 5
// Requiere que bootstrap.bundle esté cargado previamente
(function(){
  const init = () => {
    const triggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    [...triggerList].forEach(el => { try { new bootstrap.Tooltip(el); } catch(e) { /* noop */ } });
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
