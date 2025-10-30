'use strict';

(function(){
  function iniciar(){
    var datos = document.getElementById('datosNovedades');
    if(!datos) return;
    var trabajoId = datos.getAttribute('data-trabajo-id');
    if(!trabajoId) return;

    var estadoEl = document.getElementById('estado');
    var resEl = document.getElementById('resultado');
    var msgEl = document.getElementById('mensajeFinal');
    var errBox = document.getElementById('error');
    var errMsg = document.getElementById('mensajeError');
    var listaColumnas = document.getElementById('listaColumnas');
    var ejemploFilas = document.getElementById('ejemploFilas');
  var insHistorico = document.getElementById('insHistorico');
  var listaOmitidos = document.getElementById('listaOmitidos');
  var hs50Val = document.getElementById('hs50Validas');
  var hs50Inv = document.getElementById('hs50Invalidas');
  var hs100Val = document.getElementById('hs100Validas');
  var hs100Inv = document.getElementById('hs100Invalidas');

    async function poll(){
      try {
        var r = await fetch('/novedades/importar/api/estado/' + encodeURIComponent(trabajoId), {
          cache: 'no-store',
          credentials: 'same-origin'
        });
        console.log('Respuesta estado importación novedades:', r.url, r.status);
        // Si hubo redirección (sesión o permisos), corto el polling
        if (r.redirected || (r.status >= 300 && r.status < 400)) {
          if (estadoEl) estadoEl.classList.add('d-none');
          if (errBox) errBox.classList.remove('d-none');
          if (errMsg) errMsg.textContent = 'La solicitud fue redirigida. Posible sesión vencida o permisos insuficientes.';
          return;
        }
        if (r.status === 401) {
          // sesión expirada
          if (estadoEl) estadoEl.classList.add('d-none');
          if (errBox) errBox.classList.remove('d-none');
          if (errMsg) errMsg.textContent = 'Tu sesión expiró. Iniciá sesión nuevamente para ver el estado.';
          return;
        }
        if (r.status === 403) {
          if (estadoEl) estadoEl.classList.add('d-none');
          if (errBox) errBox.classList.remove('d-none');
          if (errMsg) errMsg.textContent = 'No tenés permisos para ver este proceso.';
          return;
        }
        var ct = r.headers.get('content-type') || '';
        if(!r.ok || ct.indexOf('application/json') === -1) {
          if (estadoEl) estadoEl.classList.add('d-none');
          if (errBox) errBox.classList.remove('d-none');
          if (errMsg) errMsg.textContent = 'No se pudo consultar el estado (respuesta no JSON).';
          return;
        }
        var data = await r.json();
        if (data.estado === 'terminado') {
          if (estadoEl) estadoEl.classList.add('d-none');
          if (resEl) resEl.classList.remove('d-none');
          if (msgEl) msgEl.textContent = data.mensaje || 'Proceso finalizado.';
          // Resumen insertados/omitidos
          if (typeof data.insertadosHistorico === 'number' && insHistorico) {
            insHistorico.textContent = String(data.insertadosHistorico);
          }
          if (data.omitidosPorMotivo && listaOmitidos) {
            listaOmitidos.innerHTML = '';
            var claves = Object.keys(data.omitidosPorMotivo || {});
            if (claves.length === 0) {
              var li0 = document.createElement('li');
              li0.textContent = 'Ninguno';
              listaOmitidos.appendChild(li0);
            } else {
              claves.forEach(function(k){
                var li = document.createElement('li');
                li.textContent = k + ': ' + data.omitidosPorMotivo[k];
                listaOmitidos.appendChild(li);
              });
            }
          }
          // Validación de horas
          if (hs50Val) hs50Val.textContent = String(data.horas50Validas || 0);
          if (hs50Inv) hs50Inv.textContent = String(data.horas50Invalidas || 0);
          if (hs100Val) hs100Val.textContent = String(data.horas100Validas || 0);
          if (hs100Inv) hs100Inv.textContent = String(data.horas100Invalidas || 0);
          // Detalle columnas
          if (Array.isArray(data.columnas) && listaColumnas) {
            listaColumnas.innerHTML = '';
            data.columnas.forEach(function(c){
              var li = document.createElement('li');
              li.textContent = c;
              listaColumnas.appendChild(li);
            });
          }
          // Muestra de filas
          if (Array.isArray(data.ejemploFilas) && ejemploFilas) {
            try {
              ejemploFilas.textContent = JSON.stringify(data.ejemploFilas, null, 2);
            } catch(_) {
              ejemploFilas.textContent = '' + data.ejemploFilas;
            }
          }
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
        // Error de red: reintento simple
        setTimeout(poll, 3000);
      }
    }

    poll();
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }
})();
