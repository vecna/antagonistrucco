/**
 * Bbox match-state overlay — add-on per ghostati.html
 *
 * Disegna una bounding box attorno al volto rilevato, colorata in base
 * all'ultimo stato di match calcolato dall'engine (matched/eluded/unknown).
 * Reagisce a Ghostati.events. Non modifica l'engine.
 *
 * Convenzione cromatica: rosso = identificato, verde = eluso, grigio = ignoto.
 */

(function () {
   const COLORS = {
      matched: 'rgba(255, 122, 122, 0.95)',
      eluded:  'rgba(61, 220, 151, 0.95)',
      unknown: 'rgba(170, 180, 195, 0.85)'
   };
   const LINE_WIDTH = 2.6;

   const canvas = document.getElementById('bboxOverlay');
   const overlayEl = document.getElementById('overlay');
   if (!canvas || !overlayEl || !window.Ghostati || !window.Ghostati.events) {
      console.warn('[bbox-overlay] dipendenze mancanti, skip init');
      return;
   }
   const ctx = canvas.getContext('2d');
   let lastMatchState = 'unknown';

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

   function clearBbox() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
   }

   function extractBox(resized) {
      // detectSingleFace() solo: result.box
      // detectSingleFace().withFaceLandmarks(): result.detection.box
      return (resized.detection && resized.detection.box) || resized.box;
   }

   Ghostati.events.addEventListener('detection', (e) => {
      const result = e.detail && e.detail.result;
      syncSize();
      syncMirror();
      clearBbox();
      if (!result) return;

      const resized = faceapi.resizeResults(result, {
         width: canvas.width,
         height: canvas.height
      });
      const box = extractBox(resized);
      if (!box) return;

      ctx.save();
      ctx.lineWidth = LINE_WIDTH;
      ctx.strokeStyle = COLORS[lastMatchState] || COLORS.unknown;
      ctx.strokeRect(box.x, box.y, box.width, box.height);
      ctx.restore();
   });

   Ghostati.events.addEventListener('matchStateChanged', (e) => {
      if (e.detail && e.detail.state) lastMatchState = e.detail.state;
   });

   Ghostati.events.addEventListener('dbChanged', (e) => {
      if (e.detail && e.detail.count === 0) lastMatchState = 'unknown';
   });
})();
