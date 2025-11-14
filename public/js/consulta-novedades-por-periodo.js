(function(){
  function normalizarPeriodo(valor){
    if (!valor) return '';
    const dig = String(valor).replace(/\D+/g, '').slice(0, 6); // mm yyyy -> 6 dígitos
    const m = dig.slice(0, 2);
    const y = dig.slice(2, 6);
    let mm = m;
    if (mm.length === 1 && Number(mm) > 1) {
      // si primer dígito >1, forzar 0+dig
      mm = '0' + mm;
    }
    if (mm.length === 2) {
      let n = Number(mm);
      if (n === 0) n = 1;
      if (n > 12) n = 12;
      mm = String(n).padStart(2, '0');
    }
    return y ? `${mm}/${y}` : mm;
  }

  function aplicarMascaraPeriodo(input){
    const actualizar = () => {
      const caretPos = input.selectionStart;
      const previo = input.value;
      const formateado = normalizarPeriodo(previo);
      input.value = formateado;
      // Posición de caret simple: ir al final para evitar cálculos complejos
      input.setSelectionRange(input.value.length, input.value.length);
    };
    input.addEventListener('input', actualizar);
    input.addEventListener('blur', () => {
      const v = input.value;
      // Validar formato final mm/aaaa
      if (!/^\d{2}\/\d{4}$/.test(v)) {
        input.value = '';
      } else {
        // validar mes 01..12
        const [mm, yyyy] = v.split('/').map(Number);
        if (mm < 1 || mm > 12 || yyyy < 1900) input.value = '';
      }
    });
  }

  function ready(fn){
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  ready(function(){
    const periodo = document.getElementById('periodo');
    if (periodo) aplicarMascaraPeriodo(periodo);

    const btnLimpiar = document.getElementById('btnLimpiar');
    if (btnLimpiar) btnLimpiar.addEventListener('click', function(){
      const f = document.getElementById('periodo');
      const g = document.getElementById('agruparPor');
      const h = document.getElementById('mostrarCantidad');
      if (f) f.value = '';
      if (g) g.value = 'sector';
      if (h) h.value = '5';
    });

    const btnBuscar = document.getElementById('btnBuscar');
    if (btnBuscar) btnBuscar.addEventListener('click', function(){
      const f = (document.getElementById('periodo')||{}).value || '';
      const agr = (document.getElementById('agruparPor')||{}).value || 'sector';
      const mos = (document.getElementById('mostrarCantidad')||{}).value || '5';
      if (!/^\d{2}\/\d{4}$/.test(f)) {
        try { Swal.fire('Atención', 'Ingresá un período válido (mm/aaaa).', 'warning'); } catch(_e) { alert('Ingresá un período válido (mm/aaaa).'); }
        return;
      }
      const qs = new URLSearchParams({ periodo: f, agrupar: agr, mostrar: mos }).toString();
      window.location.href = `/consultaNovedadesPorPeriodo/resultado?${qs}`;
    });
  });
})();
