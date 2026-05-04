/**
 * Demo temporaneo MediaPipe — Step 3 smoke test.
 *
 * Disegna i 478 landmark 3D come puntini per verificare visivamente che la
 * pipeline MediaPipe sia integrata correttamente. Sarà rimosso o sostituito
 * in Step 4 quando arriverà il vero sistema di plugin 3D.
 */

(function () {
   const DOT_RADIUS = 1.2;
   const DOT_COLOR = 'rgba(159, 122, 234, 0.85)';

   const canvas = document.getElementById('mesh3dOverlay');
   const overlayEl = document.getElementById('overlay');
   if (!canvas || !overlayEl || !window.Ghostati || !window.Ghostati.events) {
      console.warn('[mesh3d-demo] dipendenze mancanti, skip init');
      return;
   }
   const ctx = canvas.getContext('2d');

   function syncSize() {
      if (canvas.width !== overlayEl.width || canvas.height !== overlayEl.height) {
         canvas.width = overlayEl.width;
         canvas.height = overlayEl.height;
      }
   }
   function syncMirror() {
      const t = overlayEl.style.transform;
      if (canvas.style.transform !== t) canvas.style.transform = t;
   }

   Ghostati.events.addEventListener('landmarks3d', (e) => {
      const landmarks = e.detail && e.detail.landmarks;
      syncSize();
      syncMirror();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (!landmarks) return;

      ctx.fillStyle = DOT_COLOR;
      for (const pt of landmarks) {
         ctx.beginPath();
         ctx.arc(pt.x * canvas.width, pt.y * canvas.height, DOT_RADIUS, 0, Math.PI * 2);
         ctx.fill();
      }
   });
})();
