// Normaliza la carga del campo período (mm/yyyy) en la consulta de liquidaciones.
(function(){
  const clampMes = (mm) => {
    let n = parseInt(mm, 10);
    if (Number.isNaN(n)) return '';
    if (n < 1) n = 1;
    if (n > 12) n = 12;
    return String(n).padStart(2, '0');
  };

  const formatear = (texto) => {
    const digitos = String(texto || '').replace(/\D+/g, '').slice(0, 6);
    const mesRaw = digitos.slice(0, 2);
    const anio = digitos.slice(2, 6);
    const mes = mesRaw.length === 2 ? clampMes(mesRaw) : mesRaw;
    return anio ? `${mes}/${anio}` : mes;
  };

  const mapearCaret = (formateado, cantidadDigitos) => {
    if (!cantidadDigitos) return 0;
    let consumidos = 0;
    for (let i = 0; i < formateado.length; i++) {
      if (/\d/.test(formateado[i])) {
        consumidos++;
        if (consumidos === cantidadDigitos) return i + 1;
      }
    }
    return formateado.length;
  };

  const inicializar = () => {
    const input = document.getElementById('periodo');
    if (!input) return;

    const onInput = (evento) => {
      const el = evento.target;
      const inicio = el.selectionStart || 0;
      const sinFormato = el.value || '';
      const digitosPrevios = sinFormato.slice(0, inicio).replace(/\D+/g, '').length;
      const valorFormateado = formatear(sinFormato);
      el.value = valorFormateado;
      let posicion = mapearCaret(valorFormateado, digitosPrevios);
      if (posicion > valorFormateado.length) posicion = valorFormateado.length;
      el.setSelectionRange(posicion, posicion);
    };

    const onKeyDown = (evento) => {
      const permitidos = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Home', 'End'];
      if (permitidos.includes(evento.key)) return;
      if (!/^[0-9]$/.test(evento.key)) evento.preventDefault();
    };

    const onPaste = (evento) => {
      evento.preventDefault();
      const texto = (evento.clipboardData || window.clipboardData).getData('text');
      const formato = formatear(texto);
      input.value = formato;
      const fin = formato.length;
      input.setSelectionRange(fin, fin);
    };

    input.addEventListener('keydown', onKeyDown);
    input.addEventListener('input', onInput);
    input.addEventListener('paste', onPaste);

    if (input.value) {
      input.value = formatear(input.value);
      const fin = input.value.length;
      input.setSelectionRange(fin, fin);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializar);
  } else {
    inicializar();
  }
})();
