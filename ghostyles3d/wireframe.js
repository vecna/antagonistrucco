/**
 * ==Ghostyle3D==
 * @name         Wireframe
 * @version      1.0.0
 * @author       NINA
 * @description  Reticolo della tessellazione facciale MediaPipe (478 landmark) come prova della pipeline 3D.
 * ==/Ghostyle3D==
 *
 * Protocollo Ghostyle3D:
 *   onInit()                          opzionale, una volta al caricamento
 *   onDraw3D(ctx, landmarks, video)   obbligatoria, ogni frame con volto rilevato
 *   onClear(ctx)                      opzionale, alla disattivazione
 *
 * I landmark sono 478 punti {x,y,z} normalizzati in [0,1] rispetto al frame video.
 */

export function onDraw3D(ctx, landmarks, video) {
   const F = window.Ghostati && window.Ghostati.FaceLandmarker;
   if (!F || !F.FACE_LANDMARKS_TESSELATION) return;
   const w = ctx.canvas.width;
   const h = ctx.canvas.height;
   ctx.strokeStyle = 'rgba(159, 122, 234, 0.55)';
   ctx.lineWidth = 0.6;
   for (const seg of F.FACE_LANDMARKS_TESSELATION) {
      const a = landmarks[seg.start];
      const b = landmarks[seg.end];
      if (!a || !b) continue;
      ctx.beginPath();
      ctx.moveTo(a.x * w, a.y * h);
      ctx.lineTo(b.x * w, b.y * h);
      ctx.stroke();
   }
}
