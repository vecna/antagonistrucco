/**
 * Bbox match-state overlay — add-on per ghostati.html
 *
 * Disegna una bounding box attorno al volto rilevato, colorata in base
 * all'ultimo stato di match calcolato dall'engine (matched/eluded/unknown).
 * Affianca le metriche correnti: detection score (live), distanza live e
 * distanza post-makeup dall'ultimo trigger ("trova faccia"/"verifica efficacia").
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
   const LABEL_FONT = '13px ui-monospace, SFMono-Regular, Menlo, monospace';
   const LABEL_PADDING = 4;
   const LABEL_GAP = 6;

   const canvas = document.getElementById('bboxOverlay');
   const overlayEl = document.getElementById('overlay');
   if (!canvas || !overlayEl || !window.Ghostati || !window.Ghostati.events) {
      console.warn('[bbox-overlay] dipendenze mancanti, skip init');
      return;
   }
   const ctx = canvas.getContext('2d');
   let lastMatchState = 'unknown';
   let lastLiveMinDist = null;
   let lastObfMinDist = null;

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

   function extractScore(result) {
      // Stessa dualità di extractBox: con landmarks lo score sta in result.detection.
      if (result.detection && typeof result.detection.score === 'number') return result.detection.score;
      if (typeof result.score === 'number') return result.score;
      return null;
   }

   function fmt(value, digits) {
      return (typeof value === 'number' && Number.isFinite(value)) ? value.toFixed(digits) : '—';
   }

   // Le label vengono "smirrorate" (lo specchio è applicato all'intero canvas via
   // CSS), così leggono dritte anche con webcam in modalità mirror.
   function drawLabels(box, score) {
      const lines = [
         `score ${fmt(score, 2)}`,
         `live  ${fmt(lastLiveMinDist, 3)}`,
         `post  ${fmt(lastObfMinDist, 3)}`
      ];

      ctx.save();
      ctx.font = LABEL_FONT;
      ctx.textBaseline = 'top';
      const lineHeight = 16;
      const widths = lines.map(t => ctx.measureText(t).width);
      const blockW = Math.max(...widths) + LABEL_PADDING * 2;
      const blockH = lineHeight * lines.length + LABEL_PADDING * 2;

      const aboveY = box.y - blockH - LABEL_GAP;
      const belowY = box.y + box.height + LABEL_GAP;
      const top = aboveY >= 0 ? aboveY : belowY;
      let left = box.x;
      if (left + blockW > canvas.width) left = canvas.width - blockW;
      if (left < 0) left = 0;

      // Smirror del solo blocco label se il canvas è specchiato.
      const mirrored = (canvas.style.transform || '').includes('scaleX(-1)');
      if (mirrored) {
         ctx.translate(canvas.width, 0);
         ctx.scale(-1, 1);
         left = canvas.width - left - blockW;
      }

      ctx.fillStyle = 'rgba(12, 14, 22, 0.78)';
      ctx.fillRect(left, top, blockW, blockH);

      ctx.fillStyle = COLORS[lastMatchState] || COLORS.unknown;
      lines.forEach((t, i) => {
         ctx.fillText(t, left + LABEL_PADDING, top + LABEL_PADDING + i * lineHeight);
      });
      ctx.restore();
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

      drawLabels(box, extractScore(result));
   });

   Ghostati.events.addEventListener('matchStateChanged', (e) => {
      if (!e.detail) return;
      if (e.detail.state) lastMatchState = e.detail.state;
      // scan/save non portano distanze: aggiorno solo quando le chiavi sono presenti.
      if ('liveMinDist' in e.detail) lastLiveMinDist = e.detail.liveMinDist;
      if ('obfMinDist' in e.detail) lastObfMinDist = e.detail.obfMinDist;
   });

   Ghostati.events.addEventListener('dbChanged', (e) => {
      if (e.detail && e.detail.count === 0) {
         lastMatchState = 'unknown';
         lastLiveMinDist = null;
         lastObfMinDist = null;
      }
   });
})();
