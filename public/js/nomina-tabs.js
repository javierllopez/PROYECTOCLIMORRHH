// Maneja el cambio de período dentro de la pestaña de nómina valorizada.
(function(){
  const redirigir = (select) => {
    const destino = select && select.value ? `/nomina/2/${select.value}` : null;
    if (destino) {
      window.location.href = destino;
    }
  };

  const inicializar = () => {
    const selectorPeriodo = document.getElementById('periodoNomina');
    if (!selectorPeriodo) return;
    selectorPeriodo.addEventListener('change', () => redirigir(selectorPeriodo));
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializar);
  } else {
    inicializar();
  }
})();
