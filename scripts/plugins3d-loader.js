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
 *   export function onInit() { ... }                              opzionale
 *   export function onDraw3D(ctx, landmarks, video, params) {}    obbligatoria
 *   export function onClear(ctx) { ... }                          opzionale
 *   export const params = [...]                                   opzionale
 *
 * Schema params (opt-in nel modulo del plugin):
 *   [
 *     { name, type: 'range',  label?, min, max, step?, default },
 *     { name, type: 'bool',   label?, default },
 *     { name, type: 'select', label?, options:[], default }
 *   ]
 * Se il plugin non dichiara `params`, il 4° arg di onDraw3D è {}.
 *
 * Eventi emessi:
 *   effectChanged3d  { active, previous }
 */

(function () {
   const canvas = document.getElementById('mesh3dOverlay');
   const overlayEl = document.getElementById('overlay');
   const container = document.getElementById('ghostyles3dContainer');
   const panel = document.getElementById('plugin3dParamsPanel');
   const video = document.getElementById('video');
   if (!canvas || !overlayEl || !container || !panel || !video) {
      console.warn('[plugins3d] elementi DOM mancanti, skip init');
      return;
   }
   if (!window.Ghostati || !window.Ghostati.events) {
      console.warn('[plugins3d] Ghostati.events non disponibile, skip init');
      return;
   }
   const ctx = canvas.getContext('2d');
   const events = Ghostati.events;
   const loaded = new Map();      // id -> {id, name, module, url}
   const paramValues = new Map(); // id -> {paramName: currentValue}
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
         initParamsFromModule(id, module);
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

   function initParamsFromModule(id, module) {
      if (!Array.isArray(module.params) || module.params.length === 0) return;
      const values = {};
      for (const p of module.params) values[p.name] = p.default;
      paramValues.set(id, values);
   }

   function syncPanelHeightVar() {
      // Aggiorna --pp-h così la logbox sale di altrettanto via CSS calc()
      const h = panel.classList.contains('visible') ? panel.offsetHeight + 12 : 0;
      document.documentElement.style.setProperty('--pp-h', h + 'px');
   }

   function renderParamsPanel(id) {
      panel.innerHTML = '';
      const entry = loaded.get(id);
      if (!entry || !Array.isArray(entry.module.params) || entry.module.params.length === 0) {
         panel.classList.remove('visible');
         panel.setAttribute('aria-hidden', 'true');
         syncPanelHeightVar();
         return;
      }
      const title = document.createElement('div');
      title.className = 'pp-title';
      title.textContent = `Parametri — ${entry.name}`;
      panel.appendChild(title);
      for (const p of entry.module.params) {
         const row = createParamRow(id, p);
         if (row) panel.appendChild(row);
      }
      panel.classList.add('visible');
      panel.setAttribute('aria-hidden', 'false');
      // L'altezza è disponibile dopo il reflow → richiedi un frame
      requestAnimationFrame(syncPanelHeightVar);
   }

   function hideParamsPanel() {
      panel.classList.remove('visible');
      panel.setAttribute('aria-hidden', 'true');
      panel.innerHTML = '';
      syncPanelHeightVar();
   }

   function createParamRow(pluginId, p) {
      const values = paramValues.get(pluginId);
      if (!values) return null;
      const row = document.createElement('div');
      row.className = 'pp-row';

      const label = document.createElement('label');
      label.className = 'pp-label';
      label.textContent = p.label || p.name;
      row.appendChild(label);

      const ctrlWrap = document.createElement('div');
      ctrlWrap.className = 'pp-control';

      if (p.type === 'range') {
         const input = document.createElement('input');
         input.type = 'range';
         input.min = String(p.min);
         input.max = String(p.max);
         input.step = String(p.step || 0.01);
         input.value = String(values[p.name]);
         const valueLabel = document.createElement('span');
         valueLabel.className = 'pp-value';
         const fmt = (v) => (Number(p.step) >= 1 ? String(v) : Number(v).toFixed(2));
         valueLabel.textContent = fmt(values[p.name]);
         input.addEventListener('input', () => {
            const v = parseFloat(input.value);
            values[p.name] = v;
            valueLabel.textContent = fmt(v);
         });
         ctrlWrap.appendChild(input);
         row.appendChild(ctrlWrap);
         row.appendChild(valueLabel);
      } else if (p.type === 'bool') {
         const input = document.createElement('input');
         input.type = 'checkbox';
         input.checked = Boolean(values[p.name]);
         input.addEventListener('input', () => {
            values[p.name] = input.checked;
         });
         ctrlWrap.appendChild(input);
         row.appendChild(ctrlWrap);
      } else if (p.type === 'select') {
         const select = document.createElement('select');
         for (const opt of (p.options || [])) {
            const o = document.createElement('option');
            o.value = String(opt);
            o.textContent = String(opt);
            if (opt === values[p.name]) o.selected = true;
            select.appendChild(o);
         }
         select.addEventListener('input', () => {
            values[p.name] = select.value;
         });
         ctrlWrap.appendChild(select);
         row.appendChild(ctrlWrap);
      } else {
         console.warn(`[plugins3d] tipo param sconosciuto: ${p.type}`);
         return null;
      }
      return row;
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
      renderParamsPanel(id);
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
      hideParamsPanel();
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
         entry.module.onDraw3D(ctx, landmarks, video, paramValues.get(active) || {});
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
