/**
 * Ghostyle3D UV renderer — modulo condiviso per tutti i plugin 3D.
 *
 * I plugin 3D devono solo:
 *   - dichiarare `params` (schema controlli UI)
 *   - implementare `paintUV(ctx, paramsValues)` che disegna in spazio UV su un
 *     canvas quadrato `textureSize × textureSize` (default 256)
 *   - opzionalmente esportare `textureSize` (numero) per scegliere la
 *     risoluzione della texture
 *
 * Il framework si occupa di:
 *   - caricare `data/face_canonical_uv.json` (lazy, una volta)
 *   - mantenere una cache della texture per (plugin, hash dei params), così
 *     `paintUV` viene chiamato solo quando i parametri cambiano
 *   - per ogni frame, calcolare l'affine UV→screen di ciascuno dei 906
 *     triangoli della mesh canonica, fare clip + setTransform + drawImage
 *
 * TODO backface culling: i triangoli del lato non visibile (volto di profilo)
 * vengono attualmente disegnati. Un primo tentativo basato sul confronto del
 * segno del det in spazio UV vs screen ha azzerato il rendering — la
 * convenzione di orientamento dei triangoli MediaPipe canonical mesh va
 * verificata sperimentalmente prima di reintrodurre il check.
 *
 * Esposto come `window.Ghostati.UvRenderer.render(module, ctx, landmarks, params)`.
 */

(function () {
   const UV_PATH = (() => {
      const rel = window.location.pathname.split('/').slice(0, -1).join('/');
      return rel + '/data/face_canonical_uv.json';
   })();

   let UV_DATA = null;
   let loadPromise = null;

   function ensureLoaded() {
      if (UV_DATA || loadPromise) return loadPromise;
      loadPromise = fetch(UV_PATH)
         .then(r => {
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            return r.json();
         })
         .then(d => {
            UV_DATA = d;
            if (window.Ghostati && Ghostati.log) {
               Ghostati.log(`UV map caricata (${d.numLandmarks} landmark, ${d.numTriangles} triangoli)`, 'uv-renderer');
            }
         })
         .catch(err => {
            console.error('[uv-renderer] errore caricamento UV:', err);
            if (window.Ghostati && Ghostati.log) {
               Ghostati.log('Errore caricamento UV map: ' + err.message, 'uv-renderer');
            }
            loadPromise = null;
         });
      return loadPromise;
   }

   // Cache: ogni modulo plugin ha la sua entry { canvas, key, size }.
   // WeakMap così non trattiene il modulo se viene scaricato (futuro hot-reload).
   const cache = new WeakMap();

   function hashParams(params) {
      // Stringificazione deterministica: chiavi ordinate, valori numerici troncati.
      const keys = Object.keys(params || {}).sort();
      const parts = [];
      for (const k of keys) {
         const v = params[k];
         if (typeof v === 'number') parts.push(`${k}:${v.toFixed(6)}`);
         else parts.push(`${k}:${JSON.stringify(v)}`);
      }
      return parts.join('|');
   }

   function ensureTexture(module, params) {
      const size = (typeof module.textureSize === 'number' && module.textureSize > 0)
         ? Math.round(module.textureSize)
         : 256;
      const key = `${size}#${hashParams(params)}`;
      let entry = cache.get(module);
      if (!entry || entry.key !== key || entry.size !== size) {
         if (!entry) {
            const c = document.createElement('canvas');
            c.width = size;
            c.height = size;
            entry = { canvas: c, ctx: c.getContext('2d'), key: '', size };
            cache.set(module, entry);
         } else if (entry.size !== size) {
            entry.canvas.width = size;
            entry.canvas.height = size;
            entry.size = size;
         }
         entry.ctx.clearRect(0, 0, size, size);
         try {
            module.paintUV(entry.ctx, params);
         } catch (err) {
            console.error('[uv-renderer] paintUV errore:', err);
         }
         entry.key = key;
      }
      return entry;
   }

   function render(module, ctx, landmarks, params) {
      if (!module || typeof module.paintUV !== 'function') return;
      if (!UV_DATA) { ensureLoaded(); return; }
      if (!landmarks || !ctx) return;

      const tex = ensureTexture(module, params || {});
      const texSize = tex.size;
      const w = ctx.canvas.width;
      const h = ctx.canvas.height;
      const uv = UV_DATA.uv;
      const tri = UV_DATA.triangles;

      for (let i = 0; i < tri.length; i++) {
         const t = tri[i];
         const ia = t[0], ib = t[1], ic = t[2];
         const la = landmarks[ia], lb = landmarks[ib], lc = landmarks[ic];
         if (!la || !lb || !lc) continue;
         const ua = uv[ia], ub = uv[ib], uc = uv[ic];
         if (!ua || !ub || !uc) continue;

         const tAx = ua[0] * texSize, tAy = ua[1] * texSize;
         const tBx = ub[0] * texSize, tBy = ub[1] * texSize;
         const tCx = uc[0] * texSize, tCy = uc[1] * texSize;
         const sAx = la.x * w, sAy = la.y * h;
         const sBx = lb.x * w, sBy = lb.y * h;
         const sCx = lc.x * w, sCy = lc.y * h;

         // Affine 3-point: M tale che M*(t_i) = s_i per i in {A,B,C}
         const det = (tAx - tCx) * (tBy - tCy) - (tBx - tCx) * (tAy - tCy);
         if (Math.abs(det) < 1e-6) continue;

         const inv = 1 / det;
         const m11 = ((sAx - sCx) * (tBy - tCy) - (sBx - sCx) * (tAy - tCy)) * inv;
         const m12 = ((sBx - sCx) * (tAx - tCx) - (sAx - sCx) * (tBx - tCx)) * inv;
         const m13 = sCx - m11 * tCx - m12 * tCy;
         const m21 = ((sAy - sCy) * (tBy - tCy) - (sBy - sCy) * (tAy - tCy)) * inv;
         const m22 = ((sBy - sCy) * (tAx - tCx) - (sAy - sCy) * (tBx - tCx)) * inv;
         const m23 = sCy - m21 * tCx - m22 * tCy;

         ctx.save();
         ctx.beginPath();
         ctx.moveTo(sAx, sAy);
         ctx.lineTo(sBx, sBy);
         ctx.lineTo(sCx, sCy);
         ctx.closePath();
         ctx.clip();
         // Canvas setTransform(a,b,c,d,e,f) usa la matrice [a c e; b d f; 0 0 1]
         ctx.setTransform(m11, m21, m12, m22, m13, m23);
         ctx.drawImage(tex.canvas, 0, 0);
         ctx.restore();
      }
   }

   function ensureNamespace() {
      if (!window.Ghostati) window.Ghostati = {};
      window.Ghostati.UvRenderer = { render, ensureLoaded };
   }
   ensureNamespace();
})();
