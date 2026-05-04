/**
 * ==Ghostyle3D==
 * @name         Wireframe
 * @version      1.1.0
 * @author       NINA
 * @description  Reticolo della tessellazione facciale MediaPipe (478 landmark) come prova della pipeline 3D.
 * ==/Ghostyle3D==
 *
 * Protocollo Ghostyle3D:
 *   onInit()                                     opzionale, una volta al caricamento
 *   onDraw3D(ctx, landmarks, video, params)      obbligatoria, ogni frame con volto rilevato
 *   onClear(ctx)                                 opzionale, alla disattivazione
 *   export const params = [...]                  opzionale, schema controlli UI
 *
 * I landmark sono 478 punti {x,y,z} normalizzati in [0,1] rispetto al frame video.
 */

export const params = [
   { name: 'lineWidth', type: 'range', label: 'Spessore linea',
     min: 0.2, max: 3, step: 0.1, default: 0.6 },
   { name: 'opacity',   type: 'range', label: 'Opacità',
     min: 0.05, max: 1, step: 0.01, default: 0.55 },
   { name: 'showOval',  type: 'bool',  label: 'Contorno volto',
     default: true }
];

export function onDraw3D(ctx, landmarks, video, params = {}) {
   const F = window.Ghostati && window.Ghostati.FaceLandmarker;
   if (!F || !F.FACE_LANDMARKS_TESSELATION) return;
   const w = ctx.canvas.width;
   const h = ctx.canvas.height;
   const opacity = params.opacity ?? 0.55;
   const lineWidth = params.lineWidth ?? 0.6;
   const showOval = params.showOval ?? true;

   ctx.strokeStyle = `rgba(159, 122, 234, ${opacity})`;
   ctx.lineWidth = lineWidth;
   for (const seg of F.FACE_LANDMARKS_TESSELATION) {
      const a = landmarks[seg.start];
      const b = landmarks[seg.end];
      if (!a || !b) continue;
      ctx.beginPath();
      ctx.moveTo(a.x * w, a.y * h);
      ctx.lineTo(b.x * w, b.y * h);
      ctx.stroke();
   }

   if (showOval && F.FACE_LANDMARKS_FACE_OVAL) {
      ctx.strokeStyle = `rgba(159, 122, 234, ${Math.min(1, opacity * 1.6)})`;
      ctx.lineWidth = lineWidth * 2.4;
      for (const seg of F.FACE_LANDMARKS_FACE_OVAL) {
         const a = landmarks[seg.start];
         const b = landmarks[seg.end];
         if (!a || !b) continue;
         ctx.beginPath();
         ctx.moveTo(a.x * w, a.y * h);
         ctx.lineTo(b.x * w, b.y * h);
         ctx.stroke();
      }
   }
}
