// Manejo de Items de nómina en categoría (CSP-safe)
(function(){
  let items = [];
  const qs = (s, r=document) => r.querySelector(s);
  const qsa = (s, r=document) => [...r.querySelectorAll(s)];

  const renderFila = (item) => {
    const table = qs('#tablaItems');
    if (!table) return;
    const row = table.insertRow();
    const cell1 = row.insertCell(0);
    const cell2 = row.insertCell(1);
    cell2.className = 'text-center';

    cell1.textContent = item.itemDescripcion;
    // Crear botón sin onclick inline
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-danger btn-sm rounded-circle eliminar-item';
    btn.setAttribute('data-id', item.itemId);
    btn.innerHTML = '<i class="bi-trash-fill"></i>';
    cell2.appendChild(btn);
  };

  const cargarInicial = () => {
    const tpl = qs('#items-habilitados-json');
    if (tpl) {
      try { items = JSON.parse(tpl.textContent||'[]'); } catch(e) { items = []; }
      items.forEach(renderFila);
    } else {
      items = [];
    }
    const hidden = qs('#Items');
    if (hidden) hidden.value = JSON.stringify(items);
  };

  const agregarItem = () => {
    const select = qs('#itemNominaSelect');
    if (!select) return;
    const opt = select.options[select.selectedIndex];
    if (!opt) return;
    const item = { itemId: opt.value, itemDescripcion: opt.text };
    if (items.some(i => String(i.itemId) === String(item.itemId))) {
      alert('El item ya está en la lista.');
      return;
    }
    items.push(item);
    renderFila(item);
    const hidden = qs('#Items');
    if (hidden) hidden.value = JSON.stringify(items);
    const modalEl = qs('#addItemModal');
    if (modalEl) {
      const modal = bootstrap.Modal.getInstance(modalEl);
      if (modal) modal.hide();
    }
  };

  const eliminarItem = (itemId, btnEl) => {
    items = items.filter(i => String(i.itemId) !== String(itemId));
    const row = btnEl.closest('tr');
    if (row && row.parentNode) row.parentNode.removeChild(row);
    const hidden = qs('#Items');
    if (hidden) hidden.value = JSON.stringify(items);
  };

  const delegarEventos = () => {
    const cont = document;
    cont.addEventListener('click', (ev) => {
      const target = ev.target.closest('.eliminar-item');
      if (target) {
        const id = target.getAttribute('data-id');
        eliminarItem(id, target);
      }
    });
    const addBtn = qs('#addItemButton');
    if (addBtn) addBtn.addEventListener('click', agregarItem);
  };

  const init = () => { cargarInicial(); delegarEventos(); };
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); } else { init(); }
})();
