// Actualiza los badges del menú (mobile y desktop) según existan en el DOM.
// Compatible con CSP: sin inline ni uso de eval.

(function () {
  const mostrarCantidad = (elemento, cantidad) => {
    if (!elemento) return;
    if (cantidad > 0) {
      elemento.textContent = cantidad > 99 ? '99+' : String(cantidad);
      elemento.classList.remove('d-none');
    } else {
      elemento.classList.add('d-none');
    }
  };

  const obtenerCantidad = async (url) => {
    try {
      const respuesta = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        cache: 'no-store',
        credentials: 'same-origin'
      });
      if (!respuesta.ok) return 0;
      const datos = await respuesta.json();
      return Number(datos.cantidad) || 0;
    } catch (error) {
      return 0;
    }
  };

  const actualizarBadges = async () => {
    const badgeAutorizarMobile = document.getElementById('badge-autorizar-horas-mobile');
    const badgeAutorizarDesktop = document.getElementById('badge-autorizar-horas-desktop');
    if (badgeAutorizarMobile || badgeAutorizarDesktop) {
      const cantidadAutorizar = await obtenerCantidad('/autorizarHoras/pendientes');
      mostrarCantidad(badgeAutorizarMobile, cantidadAutorizar);
      mostrarCantidad(badgeAutorizarDesktop, cantidadAutorizar);
    }

    const badgeNovedadesMobile = document.getElementById('badge-novedades-mobile');
    const badgeNovedadesDesktop = document.getElementById('badge-novedades-desktop');
    if (badgeNovedadesMobile || badgeNovedadesDesktop) {
      const cantidadNovedades = await obtenerCantidad('/novedades/pendientes');
      mostrarCantidad(badgeNovedadesMobile, cantidadNovedades);
      mostrarCantidad(badgeNovedadesDesktop, cantidadNovedades);
    }
  };

  const iniciar = () => {
    actualizarBadges();
    setInterval(actualizarBadges, 60000);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }
})();
