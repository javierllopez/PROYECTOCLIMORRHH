/**
 * Delegación para encabezados de Tabla sin inline JS (CSP friendly)
 * Funcionalidades:
 * - Ordenar: clic en <a class="ordenar-<tabla>" data-campo="i">
 * - Filtro: en el dropdown, botones .aplicar-filtro-<tabla> y .limpiar-filtro-<tabla>
 * Requiere contenedor <tr class="encabezado-container" data-tabla data-ruta>
 */
(function(){
  function ready(fn){
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
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
  function contenedorEncabezadoDe(el){
    let n = el;
    while (n && n !== document && n !== document.body){
      if (n.classList && n.classList.contains('encabezado-container')) return n;
      n = n.parentElement;
    }
    return null;
  }
  function extraerTablaDesdeClase(el, prefijo){
    for (const cls of el.classList){
      if (cls.startsWith(prefijo)) return cls.substring(prefijo.length);
    }
    return '';
  }
  ready(function(){
    document.addEventListener('click', async function(e){
      const aOrden = e.target.closest('a[class*="ordenar-"]');
      if (aOrden){
        e.preventDefault();
        const campo = Number(aOrden.getAttribute('data-campo'));
        const tr = contenedorEncabezadoDe(aOrden);
        const tabla = (tr && tr.getAttribute('data-tabla')) || extraerTablaDesdeClase(aOrden, 'ordenar-');
        const ruta = (tr && tr.getAttribute('data-ruta')) || ('/' + tabla);
        if (!Number.isFinite(campo) || !tabla) return;
        try {
          const r = await postJSON(ruta + '/ordenar', { campo, tabla });
          if (r.ok) window.location.href = ruta; else window.location.reload();
        } catch { window.location.reload(); }
        return;
      }
      const btnAplicar = e.target.closest('button[class*="aplicar-filtro-"]');
      if (btnAplicar){
        e.preventDefault();
        const campo = Number(btnAplicar.getAttribute('data-campo'));
        const tr = contenedorEncabezadoDe(btnAplicar);
        const tabla = (tr && tr.getAttribute('data-tabla')) || extraerTablaDesdeClase(btnAplicar, 'aplicar-filtro-');
        const ruta = (tr && tr.getAttribute('data-ruta')) || ('/' + tabla);
        if (!Number.isFinite(campo) || !tabla) return;
        // Buscar el input dentro del mismo dropdown/form donde está el botón
        const form = btnAplicar.closest('form');
        const input = form ? form.querySelector('.input-filtro-' + tabla) : (tr ? tr.querySelector('.input-filtro-' + tabla) : null);
        const valor = input ? input.value : '';
        try {
          const r = await postJSON(ruta + '/filtrar', { i: campo, filtro: valor, tabla });
          if (r.ok) window.location.href = ruta; else window.location.reload();
        } catch { window.location.reload(); }
        return;
      }
      const btnLimpiar = e.target.closest('button[class*="limpiar-filtro-"]');
      if (btnLimpiar){
        e.preventDefault();
        const campo = Number(btnLimpiar.getAttribute('data-campo'));
        const tr = contenedorEncabezadoDe(btnLimpiar);
        const tabla = (tr && tr.getAttribute('data-tabla')) || extraerTablaDesdeClase(btnLimpiar, 'limpiar-filtro-');
        const ruta = (tr && tr.getAttribute('data-ruta')) || ('/' + tabla);
        if (!Number.isFinite(campo) || !tabla) return;
        // Limpio el input visualmente también (UX)
        const form = btnLimpiar.closest('form');
        const input = form ? form.querySelector('.input-filtro-' + tabla) : null;
        if (input) input.value = '';
        try {
          const r = await postJSON(ruta + '/filtrar', { i: campo, filtro: '', tabla });
          if (r.ok) window.location.href = ruta; else window.location.reload();
        } catch { window.location.reload(); }
        return;
      }
    }, false);
  });
})();
