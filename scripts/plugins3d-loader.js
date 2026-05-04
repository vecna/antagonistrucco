/**
 * Loader e UI dei Ghostyle 3D — add-on per ghostati.html
 *
 * Carica plugin 3D dichiarati in `ghostylist3d.json`, genera bottoni in
 * #ghostyles3dContainer (drawer impostazioni), gestisce attivazione/
 * disattivazione e instrada gli eventi `landmarks3d` di MediaPipe sul
 * plugin attivo. Convive con i Ghostyle 2D dell'engine senza interferire
 * (canvas e loop di inferenza separati).
 *
 * Protocollo plugin (vedi ghostyles3d/wireframe.js):
 *   export function onInit() { ... }                    opzionale
 *   export function onDraw3D(ctx, landmarks, video) {}  obbligatoria
 *   export function onClear(ctx) { ... }                opzionale
 *
 * Eventi emessi:
 *   effectChanged3d  { active, previous }
 */

(function () {
   const canvas = document.getElementById('mesh3dOverlay');
   const overlayEl = document.getElementById('overlay');
   const container = document.getElementById('ghostyles3dContainer');
   const video = document.getElementById('video');
   if (!canvas || !overlayEl || !container || !video) {
      console.warn('[plugins3d] elementi DOM mancanti, skip init');
      return;
   }
   if (!window.Ghostati || !window.Ghostati.events) {
      console.warn('[plugins3d] Ghostati.events non disponibile, skip init');
      return;
   }
   const ctx = canvas.getContext('2d');
   const events = Ghostati.events;
   const loaded = new Map();   // id -> {id, name, module, url}
   let active = null;

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
   function clearCanvas() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
   }

   async function loadPlugin(url, expectedName) {
      const id = url.split('/').pop().replace('.js', '');
      try {
         Ghostati.log(`Caricamento plugin 3D da ${url}...`, 'plugins3d');
         const txtRes = await fetch(url);
         if (!txtRes.ok) throw new Error(`HTTP ${txtRes.status}`);
         const text = await txtRes.text();
         const nameMatch = text.match(/@name\s+(.+)/);
         const name = nameMatch ? nameMatch[1].trim() : (expectedName || id);
         const module = await import(url);
         loaded.set(id, { id, name, module, url });
         if (typeof module.onInit === 'function') {
            try { module.onInit(); }
            catch (e) { console.error(`[plugins3d] onInit di '${name}':`, e); }
         }
         renderButton(id, name);
         Ghostati.log(`Plugin 3D '${name}' caricato.`, 'plugins3d');
      } catch (err) {
         console.error('[plugins3d] errore caricamento:', err);
         Ghostati.log(`Impossibile caricare plugin 3D ${expectedName || id}: ${err.message}`, 'plugins3d');
      }
   }

   function renderButton(id, name) {
      const btn = document.createElement('button');
      btn.className = 'preview-btn';
      btn.textContent = name;
      btn.dataset.effect3d = id;
      btn.onclick = () => toggleActive(id, btn);
      container.appendChild(btn);
   }

   function activatePlugin(id, button) {
      const previous = active;
      if (previous) {
         const prev = loaded.get(previous);
         if (prev && typeof prev.module.onClear === 'function') {
            try { prev.module.onClear(ctx); } catch (e) { console.error(e); }
         }
      }
      active = id;
      container.querySelectorAll('.preview-btn').forEach(b =>
         b.classList.toggle('active', b === button)
      );
      events.dispatchEvent(new CustomEvent('effectChanged3d', {
         detail: { active, previous }
      }));
      Ghostati.log(`Plugin 3D attivo: ${loaded.get(id).name}`, 'plugins3d');
   }

   function deactivate() {
      if (!active) return;
      const previous = active;
      const entry = loaded.get(previous);
      if (entry && typeof entry.module.onClear === 'function') {
         try { entry.module.onClear(ctx); } catch (e) { console.error(e); }
      }
      active = null;
      container.querySelectorAll('.preview-btn').forEach(b => b.classList.remove('active'));
      clearCanvas();
      events.dispatchEvent(new CustomEvent('effectChanged3d', {
         detail: { active: null, previous }
      }));
      Ghostati.log('Plugin 3D disattivato.', 'plugins3d');
   }

   function toggleActive(id, button) {
      if (active === id) {
         deactivate();
         return;
      }
      activatePlugin(id, button);
   }

   events.addEventListener('landmarks3d', (e) => {
      const landmarks = e.detail && e.detail.landmarks;
      syncSize();
      syncMirror();
      clearCanvas();
      if (!active || !landmarks) return;
      const entry = loaded.get(active);
      if (!entry || typeof entry.module.onDraw3D !== 'function') return;
      try {
         ctx.save();
         entry.module.onDraw3D(ctx, landmarks, video);
         ctx.restore();
      } catch (err) {
         console.error(`[plugins3d] onDraw3D errore in ${entry.name}:`, err);
      }
   });

   // Bootstrap
   (async () => {
      const relurl = window.location.pathname.split('/').slice(0, -1).join('/');
      const manifestUrl = relurl + '/ghostylist3d.json';
      try {
         const res = await fetch(manifestUrl);
         if (!res.ok) throw new Error(`HTTP ${res.status}`);
         const list = await res.json();
         for (const item of list) {
            const effectiveUrl = relurl + '/' + item.url;
            await loadPlugin(effectiveUrl, item.name);
         }
      } catch (err) {
         console.error('[plugins3d] errore lettura manifest:', err);
         Ghostati.log(`Errore lettura ${manifestUrl}: ${err.message}`, 'plugins3d');
      }
   })();
})();
