/**
 * Delegación de eventos para paginadores sin inline JS (compatible CSP)
 * Busca enlaces con clase `paginar-<tabla>` y data-page con el número de página destino.
 * Hace POST a `/<rutaConsulta>/paginar` y luego navega a la vista de esa ruta.
 *
 * Requiere que el servidor acepte POST en: `/<ruta>/paginar` y haga redirect a la lista.
 * Si la tabla usa `rutaConsulta` distinta del nombre, el servidor debe setear
 * un data-atributo en el contenedor: `data-ruta` en `.paginador-container[data-tabla][data-ruta]`.
 * Este script intenta inferir la ruta desde un contenedor cercano, y si no la encuentra,
 * usa el texto después de `paginar-` como fallback.
 */
(function(){
  function encontrarInfoPaginador(enlace){
    // Busca un contenedor cercano con data-tabla y data-ruta
    let nodo = enlace.parentElement;
    while (nodo && nodo !== document && nodo !== document.body){
      if (nodo.classList && nodo.classList.contains('paginador-container')){
        const tabla = nodo.getAttribute('data-tabla') || '';
        const ruta = nodo.getAttribute('data-ruta') || '';
        return { tabla, ruta };
      }
      nodo = nodo.parentElement;
    }
    return { tabla: '', ruta: '' };
  }

  async function postJSON(url, data){
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(data)
    });
    return resp;
  }

  function extraerNombreTablaDesdeClase(el){
    // Busca la primera clase que empiece con 'paginar-'
    for (const cls of el.classList){
      if (cls.startsWith('paginar-')){
        return cls.substring('paginar-'.length);
      }
    }
    return '';
  }

  async function manejarClick(e){
    const a = e.target.closest('a.page-link');
    if (!a) return;
    const nombreClaseTabla = extraerNombreTablaDesdeClase(a);
    if (!nombreClaseTabla) return;

    // Es un link de paginación manejado por nosotros
    e.preventDefault();

    const pagina = Number(a.getAttribute('data-page'));
    if (!Number.isFinite(pagina) || pagina < 1) return;

    const { tabla, ruta } = encontrarInfoPaginador(a);
    const nombreTabla = tabla || nombreClaseTabla;
    const rutaBase = ruta || '/' + nombreTabla;

    try {
      const r = await postJSON(rutaBase + '/paginar', { pagina, tabla: nombreTabla });
      // Si el servidor redirige, seguimos la redirección navegando a la lista base
      if (r.ok){
        // Algunos controladores hacen redirect en el POST. Si no, forzamos navegación
        window.location.href = rutaBase;
      } else {
        // fallback: recargar
        window.location.reload();
      }
    } catch(err){
      // fallback silencioso
      window.location.reload();
    }
  }

  function ready(fn){
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  ready(function(){
    // Delegación global en el documento para cualquier paginador renderizado
    document.addEventListener('click', manejarClick, false);
  });
})();
