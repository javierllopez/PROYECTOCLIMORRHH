// Lógica de validaciones y selección de nómina en la edición de personal (CSP-safe)
(function(){
  const qs = (s, r=document) => r.querySelector(s);
  const on = (el, ev, fn) => el && el.addEventListener(ev, fn);

  const validateAge = () => {
    const input = qs('#fechaNacimiento');
    if (!input) return;
    const fechaNacimiento = input.value;
    if (!fechaNacimiento) return;
    const birthDate = new Date(fechaNacimiento);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const md = today.getMonth() - birthDate.getMonth();
    if (md < 0 || (md === 0 && today.getDate() < birthDate.getDate())) age--;
    if (age < 18) {
      alert('El empleado debe ser mayor de 18 años.');
      input.value = '';
    }
  };

  const alertarCategoriaSinNomina = () => {
    const select = qs('#idCategoria');
    if (!select) return;
    const opt = select.options[select.selectedIndex];
    if (!opt) return;
    const idNomina = opt.getAttribute('data-nomina');
    if (!idNomina) {
      alert('La categoría seleccionada no tiene una nómina asociada.');
    }
  };

  const handleGrabar = (ev) => {
    const sel = qs('#idCategoria');
    if (!sel) return;
    const opt = sel.options[sel.selectedIndex];
    if (!opt) return;
    const idNomina = opt.getAttribute('data-nomina');
    if (!idNomina) {
      ev.preventDefault();
      const modalEl = qs('#modalNomina');
      if (!modalEl) return;
      const modal = new bootstrap.Modal(modalEl);
      modal.show();
    }
  };

  const confirmarNomina = () => {
    const combo = qs('#comboNomina');
    const valor = combo ? combo.value : '';
    if (!valor) { alert('Debe seleccionar una nómina.'); return; }
    const hidden = qs('#idNominaSeleccionada');
    if (hidden) hidden.value = valor;
    const modalEl = qs('#modalNomina');
    if (modalEl) {
      const modal = bootstrap.Modal.getInstance(modalEl);
      if (modal) modal.hide();
    }
    const form = qs('form');
    if (form) form.submit();
  };

  const init = () => {
    on(qs('#fechaNacimiento'), 'change', validateAge);
    on(qs('#idCategoria'), 'change', alertarCategoriaSinNomina);
    on(qs('#btnGrabar'), 'click', handleGrabar);
    on(qs('#btnConfirmarNomina'), 'click', confirmarNomina);
  };

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); } else { init(); }
})();
