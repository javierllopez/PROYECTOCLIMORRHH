// Manejador genérico de descargas de PDFs (CSP-safe)
(function(){
  async function descargar(baseUrl, sugerido, defaultName) {
    const nombre = (sugerido || '').trim();
    const filename = nombre || defaultName;
    const resp = await fetch(baseUrl, { method: 'GET' });
    if (!resp.ok) throw new Error('No se pudo generar el PDF.');
    const blob = await resp.blob();

    if (window.showSaveFilePicker && window.isSecureContext) {
      const handle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [{ description: 'Archivo PDF', accept: { 'application/pdf': ['.pdf'] } }]
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    }

    const urlBlob = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = urlBlob;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(urlBlob);
  }

  function setup(){
    document.addEventListener('click', async (e) => {
      const btn = e.target.closest('button[data-export-url]');
      if (!btn) return;
      e.preventDefault();
      const url = btn.getAttribute('data-export-url');
      const name = btn.getAttribute('data-export-name');
      try {
        // Distinguir por título para default; si no, usar nombre genérico
        const card = btn.closest('.card');
        const title = card ? card.querySelector('.card-header h5, .card-title, h5')?.textContent || '' : '';
        const def = /Recibos/i.test(title) ? 'recibos.pdf' : 'liquidacion.pdf';
        await descargar(url, name, def);
      } catch (err) {
        console.error(err);
        alert('No fue posible descargar el PDF. Intentá nuevamente.');
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup);
  } else { setup(); }
})();
