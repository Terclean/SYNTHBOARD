// SYNTHBOARD – Modulares Rack: UI-Controller & Patchbay-Host
import { RackEngine, MODULES, TEMPLATES } from './modules/index.js';
import { Knob } from './ui/Knob.js';
import { Oscilloscope } from './ui/Oscilloscope.js';
import { PatchBay } from './ui/PatchBay.js';
import { InfoSystem } from './ui/InfoSystem.js';

const LS_BOARDS = 'synthboard:boards';
const LS_AUTO = 'synthboard:autosave';
const $ = (s) => document.querySelector(s);

const engine = new RackEngine();
let current = { kind: 'tpl', key: 'generative' }; // Standard: Generatives Showcase
let dirty = false;

// ───────────────────────── Hilfen ──
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function fmt(p, v) {
  switch (p.fmt) {
    case 'pct': return `${Math.round(v * 100)}%`;
    case 'hz': return v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v < 10 ? `${v.toFixed(2)} Hz` : `${Math.round(v)} Hz`;
    case 's': return v < 1 ? `${Math.round(v * 1000)} ms` : `${v.toFixed(1)} s`;
    case 'cents': return `${Math.round(v)} ct`;
    case 'bpm': return `${Math.round(v)} BPM`;
    case 'int': return `${Math.round(v)}`;
    default: return v.toFixed(1);
  }
}

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
}

const loadBoards = () => { try { return JSON.parse(localStorage.getItem(LS_BOARDS)) || {}; } catch { return {}; } };
const storeBoards = (b) => localStorage.setItem(LS_BOARDS, JSON.stringify(b));

let autoTimer;
function persist() {
  clearTimeout(autoTimer);
  autoTimer = setTimeout(() => {
    localStorage.setItem(LS_AUTO, JSON.stringify({ current, dirty, state: engine.getState() }));
  }, 250);
}

function setDirty(v) {
  dirty = v;
  $('#dirty-dot').classList.toggle('on', v);
  persist();
}
const changed = () => setDirty(true);

// ───────────────────────── Audio-Start ──
async function startAudio() {
  await engine.resume();
  updateStatus();
}

function updateStatus() {
  const running = engine.ctx.state === 'running';
  $('#start-overlay').classList.toggle('hidden', running);
  $('#btn-power').classList.toggle('on', running);
  $('#btn-power .txt').textContent = running ? 'AN' : 'AUS';
  $('#status-led').classList.toggle('on', running);
  const n = engine.controls.length + engine.sources.length + engine.effects.length;
  $('#status-text').textContent = running
    ? `Audio aktiv · ${engine.ctx.sampleRate / 1000} kHz · ${n} Module`
    : 'Audio pausiert';
}

engine.ctx.addEventListener('statechange', updateStatus);
$('#btn-start').addEventListener('click', startAudio);
window.addEventListener('pointerdown', () => { if (engine.ctx.state === 'suspended' && !$('#btn-power').dataset.userPaused) startAudio(); }, { capture: true });

$('#btn-power').addEventListener('click', async (e) => {
  e.stopPropagation();
  if (engine.ctx.state === 'running') {
    $('#btn-power').dataset.userPaused = '1';
    await engine.ctx.suspend();
  } else {
    delete $('#btn-power').dataset.userPaused;
    await engine.resume();
  }
  updateStatus();
});

$('#btn-record').addEventListener('click', async () => {
  await startAudio();
  const btn = $('#btn-record');
  if (engine.recorder) { engine.stopRecording(); return; }
  engine.startRecording(() => { btn.classList.remove('rec'); btn.querySelector('.txt').textContent = 'REC'; toast('Aufnahme gespeichert ✓'); });
  btn.classList.add('rec');
  btn.querySelector('.txt').textContent = 'STOP';
});

const masterKnob = new Knob($('#knob-master'), {
  min: 0, max: 1, value: 0.8,
  onChange: (v) => { engine.setMaster(v); changed(); },
});

new Oscilloscope($('#scope'), engine.analyser).start();

// ───────────────────────── PatchBay (Kabel) & Info ──
const patchCanvas = $('#patch-canvas');
const patchBay = new PatchBay(patchCanvas, engine, { onModified: changed });
const infoSystem = new InfoSystem(engine, patchBay);

$('#btn-cables').addEventListener('click', () => {
  const vis = patchBay.toggleVisible();
  $('#btn-cables').classList.toggle('on', vis);
  $('#btn-cables .txt').textContent = vis ? 'KABEL' : 'OHNE KABEL';
  toast(vis ? '🔌 Patch-Kabel sichtbar' : '🙈 Patch-Kabel ausgeblendet');
});

engine.onRecover = () => { renderRack(); toast('⚠️ Audio-Überlauf erkannt – Rack wurde neu gestartet'); };

// ───────────────────────── Bibliothek ──
function renderLibrary() {
  const html = (cat) => Object.values(MODULES).filter((M) => M.category === cat).map((M) => `
    <button class="lib-item" draggable="true" data-type="${M.type}" style="--mod-color:${M.color}" title="${esc(M.description)}">
      <span class="lib-icon">${M.icon}</span>
      <span class="lib-text"><b>${esc(M.title)}</b><small>${esc(M.description)}</small></span>
      <span class="lib-add">＋</span>
    </button>`).join('');

  $('#lib-controls').innerHTML = html('control');
  $('#lib-sources').innerHTML = html('source');
  $('#lib-effects').innerHTML = html('effect');

  document.querySelectorAll('.lib-item').forEach((el) => {
    el.addEventListener('click', () => addModule(el.dataset.type));
    el.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('application/x-module-type', el.dataset.type);
      e.dataTransfer.effectAllowed = 'copy';
      document.body.classList.add(`dragging-${MODULES[el.dataset.type].category}`);
    });
    el.addEventListener('dragend', clearDragState);
  });
}

function addModule(type, index = -1) {
  const mod = engine.add(type, {}, index);
  if (!mod) return;
  renderRack(mod.id);
  changed();
  toast(`${mod.meta.icon} ${mod.meta.title} hinzugefügt`);
}

// ───────────────────────── Rack Rendering ──
function renderRack(highlightId) {
  const ctrlEl = $('#rack-controls');
  const srcEl = $('#rack-sources');
  const fxEl = $('#rack-effects');

  ctrlEl.innerHTML = '';
  srcEl.innerHTML = '';
  fxEl.innerHTML = '';

  // 1. Steuerung & Generatoren
  if (!engine.controls.length) {
    ctrlEl.innerHTML = '<div class="empty">Noch keine Steuerung – füge links z.&nbsp;B. eine <b>Master Clock</b> oder einen <b>Euclidean Rhythm</b> hinzu.</div>';
  }
  engine.controls.forEach((m) => ctrlEl.appendChild(createCard(m)));

  // 2. Klangquellen & Instrumente
  if (!engine.sources.length) {
    srcEl.innerHTML = '<div class="empty">Noch keine Klangquelle – füge links z.&nbsp;B. einen <b>Pluck Synth</b>, <b>Analog Bass</b> oder <b>Drum Rack</b> hinzu.</div>';
  }
  engine.sources.forEach((m) => srcEl.appendChild(createCard(m)));

  // 3. Effektkette
  fxEl.appendChild(Object.assign(document.createElement('div'), { className: 'chain-pin', innerHTML: '<span>QUELLEN</span>' }));
  engine.effects.forEach((m, i) => {
    fxEl.appendChild(Object.assign(document.createElement('div'), { className: 'chain-arrow', textContent: '➜' }));
    fxEl.appendChild(createCard(m, i));
  });
  if (!engine.effects.length) {
    fxEl.appendChild(Object.assign(document.createElement('div'), { className: 'chain-arrow', textContent: '➜' }));
    fxEl.appendChild(Object.assign(document.createElement('div'), { className: 'empty empty-inline', innerHTML: 'Keine Effekte – das Signal geht direkt zum Master.' }));
  }
  fxEl.appendChild(Object.assign(document.createElement('div'), { className: 'chain-arrow', textContent: '➜' }));
  fxEl.appendChild(Object.assign(document.createElement('div'), { className: 'chain-pin out', innerHTML: '<span>MASTER</span>' }));

  // Kabel-Verbindungen visuell synchronisieren
  setTimeout(() => patchBay.syncPatchedClasses(), 20);

  if (highlightId) {
    const card = document.querySelector(`.module-card[data-id="${highlightId}"]`);
    if (card) { card.classList.add('just-added'); card.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' }); }
  }
  updateStatus();
}

function createCard(mod, fxIndex = -1) {
  const M = mod.meta;
  const isFx = M.category === 'effect';
  const isCtrl = M.category === 'control';
  const card = document.createElement('article');
  card.className = `module-card is-${M.category}${mod.enabled ? '' : ' bypassed'}`;
  card.dataset.id = mod.id;
  card.style.setProperty('--mod-color', M.color);

  const subTitle = isFx ? `FX ${fxIndex + 1}` : isCtrl ? 'Steuerung' : 'Stimme';

  card.innerHTML = `
    <header class="mod-head" ${isFx ? 'draggable="true"' : ''}>
      ${isFx ? '<span class="grip" title="Ziehen zum Umsortieren">⋮⋮</span>' : ''}
      <span class="mod-icon">${M.icon}</span>
      <div class="mod-titles"><h3>${esc(M.title)}</h3><small>${subTitle}</small></div>
      <div class="mod-actions">
        ${isFx ? `<button class="icon-btn mv-left" title="Nach links" ${fxIndex === 0 ? 'disabled' : ''}>◀</button>
                  <button class="icon-btn mv-right" title="Nach rechts" ${fxIndex === engine.effects.length - 1 ? 'disabled' : ''}>▶</button>` : ''}
        <button class="icon-btn mod-info-btn" title="Modul-Info &amp; Handbuch">?</button>
        <button class="icon-btn power" title="${isFx ? 'Bypass' : 'An / Aus'}"><span class="pled"></span></button>
        <button class="icon-btn remove" title="Entfernen">✕</button>
      </div>
    </header>

    ${M.jacks?.length ? `
      <div class="mod-patchbay-strip">
        ${M.jacks.map((j) => `
          <div class="jack-socket-wrap ${j.type} sig-${j.signal}">
            <span class="jack-lbl">${esc(j.label)}</span>
            <div class="hw-jack" data-port-id="${j.id}">
              <span class="jack-bezel"></span>
              <span class="jack-hole"></span>
              <span class="jack-led"></span>
            </div>
          </div>`).join('')}
      </div>` : ''}

    ${M.options.length ? `<div class="mod-options">${M.options.map((o) => `
      <label class="opt"><span>${esc(o.label)}</span>
        <select class="select select-sm" data-opt="${o.id}">${o.choices.map(([v, l]) => `<option value="${v}" ${String(mod.values[o.id]) === String(v) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>
      </label>`).join('')}</div>` : ''}
    <div class="mod-knobs"></div>
    <div class="mod-extra"></div>`;

  // Hardware Jacks in PatchBay registrieren
  if (M.jacks?.length) {
    card.querySelectorAll('.hw-jack[data-port-id]').forEach((jackEl) => {
      const portId = jackEl.dataset.portId;
      const j = M.jacks.find((x) => x.id === portId);
      if (j) {
        patchBay.registerJack(jackEl, mod.id, j.id, j.type, j.signal, j.label);
      }
    });
  }

  // Regler
  const knobsEl = card.querySelector('.mod-knobs');
  M.params.forEach((p) => {
    const cell = document.createElement('div');
    cell.className = 'knob-cell';
    cell.innerHTML = `<div class="knob-host" data-knob-color="mod" data-knob-size="med"></div><span class="k-label">${esc(p.label)}</span><span class="k-val"></span>`;
    knobsEl.appendChild(cell);
    const valEl = cell.querySelector('.k-val');
    const knob = new Knob(cell.querySelector('.knob-host'), {
      min: p.min, max: p.max, value: mod.values[p.id], logarithmic: !!p.log,
      onChange: (v) => { mod.setParam(p.id, v); valEl.textContent = fmt(p, v); changed(); },
    });
    valEl.textContent = fmt(p, mod.values[p.id]);
    cell.addEventListener('dblclick', () => knob.setValue(p.value, true));
  });

  // Optionen
  card.querySelectorAll('select[data-opt]').forEach((sel) => {
    const o = M.options.find((x) => x.id === sel.dataset.opt);
    sel.addEventListener('change', () => {
      const v = typeof o.value === 'number' ? Number(sel.value) : sel.value;
      mod.setParam(o.id, v);
      changed();
    });
  });

  mod.renderExtra(card.querySelector('.mod-extra'), { changed });

  // Aktionen
  card.querySelector('.mod-info-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    infoSystem.openGuide('tab-modules');
    infoSystem.renderGuideModulesList('all', M.title);
  });
  card.querySelector('.power').addEventListener('click', () => {
    mod.setEnabled(!mod.enabled);
    card.classList.toggle('bypassed', !mod.enabled);
    changed();
  });
  card.querySelector('.remove').addEventListener('click', () => {
    card.classList.add('removing');
    patchBay.unregisterModuleJacks(mod.id);
    setTimeout(() => { engine.remove(mod.id); renderRack(); changed(); }, 180);
  });
  card.querySelector('.mv-left')?.addEventListener('click', () => { engine.moveEffect(mod.id, fxIndex - 1); renderRack(); changed(); });
  card.querySelector('.mv-right')?.addEventListener('click', () => { engine.moveEffect(mod.id, fxIndex + 1); renderRack(); changed(); });

  if (isFx) {
    const head = card.querySelector('.mod-head');
    head.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('application/x-module-id', mod.id);
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setDragImage(card, 40, 20);
      requestAnimationFrame(() => card.classList.add('drag-src'));
      document.body.classList.add('dragging-effect');
    });
    head.addEventListener('dragend', clearDragState);
  }
  return card;
}

// ───────────────────────── Drag & Drop ──
function clearDragState() {
  document.body.classList.remove('dragging-control', 'dragging-source', 'dragging-effect');
  document.querySelectorAll('.drop-before, .drag-src').forEach((el) => el.classList.remove('drop-before', 'drag-src'));
  document.querySelectorAll('.zone-body').forEach((z) => z.classList.remove('drop-end', 'drop-target'));
}

function dropIndex(e) {
  const cards = [...$('#rack-effects').querySelectorAll('.module-card')];
  for (let i = 0; i < cards.length; i++) {
    const r = cards[i].getBoundingClientRect();
    if (e.clientY < r.top || (e.clientY <= r.bottom && e.clientX < r.left + r.width / 2)) return i;
  }
  return cards.length;
}

function setupDropZones() {
  const ctrlEl = $('#rack-controls');
  const srcEl = $('#rack-sources');
  const fxEl = $('#rack-effects');
  const isOurs = (e) => e.dataTransfer.types.includes('application/x-module-type') || e.dataTransfer.types.includes('application/x-module-id');

  // Controls Drop Zone
  ctrlEl.addEventListener('dragover', (e) => {
    if (!e.dataTransfer.types.includes('application/x-module-type')) return;
    e.preventDefault();
    ctrlEl.classList.add('drop-target');
  });
  ctrlEl.addEventListener('dragleave', (e) => { if (!ctrlEl.contains(e.relatedTarget)) clearDragState(); });
  ctrlEl.addEventListener('drop', (e) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('application/x-module-type');
    clearDragState();
    if (type) addModule(type);
  });

  // Sources Drop Zone
  srcEl.addEventListener('dragover', (e) => {
    if (!e.dataTransfer.types.includes('application/x-module-type')) return;
    e.preventDefault();
    srcEl.classList.add('drop-target');
  });
  srcEl.addEventListener('dragleave', (e) => { if (!srcEl.contains(e.relatedTarget)) clearDragState(); });
  srcEl.addEventListener('drop', (e) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('application/x-module-type');
    clearDragState();
    if (type) addModule(type);
  });

  // Effects Drop Zone
  fxEl.addEventListener('dragover', (e) => {
    if (!isOurs(e)) return;
    e.preventDefault();
    const cards = [...fxEl.querySelectorAll('.module-card')];
    const idx = dropIndex(e);
    cards.forEach((c, i) => c.classList.toggle('drop-before', i === idx));
    fxEl.classList.toggle('drop-end', idx === cards.length);
    fxEl.classList.add('drop-target');
  });
  fxEl.addEventListener('dragleave', (e) => { if (!fxEl.contains(e.relatedTarget)) clearDragState(); });
  fxEl.addEventListener('drop', (e) => {
    e.preventDefault();
    const idx = dropIndex(e);
    const type = e.dataTransfer.getData('application/x-module-type');
    const id = e.dataTransfer.getData('application/x-module-id');
    clearDragState();
    if (type) {
      if (MODULES[type].category === 'effect') addModule(type, idx); else addModule(type);
    } else if (id) {
      const from = engine.effects.findIndex((m) => m.id === id);
      engine.moveEffect(id, from < idx ? idx - 1 : idx);
      renderRack();
      changed();
    }
  });
}

// ───────────────────────── Boards Verwaltung ──
function populateBoards() {
  const boards = loadBoards();
  const sel = $('#board-select');
  const mine = Object.keys(boards).sort((a, b) => a.localeCompare(b));
  sel.innerHTML = `
    ${current.kind === 'new' ? '<option value="new:" selected>✎ Neues Board (ungespeichert)</option>' : ''}
    <optgroup label="Meine Boards">${mine.length ? mine.map((n) => `<option value="my:${esc(n)}">${esc(n)}</option>`).join('') : '<option disabled>– noch keine gespeichert –</option>'}</optgroup>
    <optgroup label="Vorlagen">${Object.entries(TEMPLATES).map(([k, t]) => `<option value="tpl:${k}">${esc(t.name)}</option>`).join('')}</optgroup>`;
  if (current.kind !== 'new') sel.value = `${current.kind}:${current.key}`;
  $('#btn-delete').disabled = current.kind !== 'my';
}

function loadBoard(kind, key) {
  const state = kind === 'tpl' ? TEMPLATES[key]?.state : loadBoards()[key];
  if (!state) return;
  engine.load(structuredClone(state));
  masterKnob.setValue(engine.masterValue);
  current = { kind, key };
  renderRack();
  populateBoards();
  setDirty(false);
}

function confirmDiscard() {
  return !dirty || confirm('Ungespeicherte Änderungen am aktuellen Board verwerfen?');
}

$('#board-select').addEventListener('change', (e) => {
  const [kind, ...rest] = e.target.value.split(':');
  if (kind === 'new') return;
  if (!confirmDiscard()) { populateBoards(); return; }
  loadBoard(kind, rest.join(':'));
});

function saveAs() {
  const boards = loadBoards();
  const suggestion = current.kind === 'my' ? `${current.key} (Kopie)` : current.kind === 'tpl' ? `Mein ${TEMPLATES[current.key].name.replace(/^\S+\s/, '')}` : 'Mein Board';
  const name = prompt('Name für dein Board:', suggestion)?.trim();
  if (!name) return;
  if (boards[name] && !confirm(`„${name}“ existiert schon. Überschreiben?`)) return;
  boards[name] = engine.getState();
  storeBoards(boards);
  current = { kind: 'my', key: name };
  populateBoards();
  setDirty(false);
  toast(`💾 „${name}“ gespeichert`);
}

$('#btn-save').addEventListener('click', () => {
  if (current.kind !== 'my') return saveAs();
  const boards = loadBoards();
  boards[current.key] = engine.getState();
  storeBoards(boards);
  setDirty(false);
  toast(`💾 „${current.key}“ gespeichert`);
});

$('#btn-save-as').addEventListener('click', saveAs);

$('#btn-new').addEventListener('click', () => {
  if (!confirmDiscard()) return;
  engine.load({ master: engine.masterValue, modules: [], cables: [] });
  current = { kind: 'new', key: '' };
  renderRack();
  populateBoards();
  setDirty(false);
  toast('Leeres Board – füge links Module hinzu');
});

$('#btn-delete').addEventListener('click', () => {
  if (current.kind !== 'my' || !confirm(`Board „${current.key}“ wirklich löschen?`)) return;
  const boards = loadBoards();
  delete boards[current.key];
  storeBoards(boards);
  toast('Board gelöscht');
  loadBoard('tpl', 'generative');
});

$('#btn-export').addEventListener('click', () => {
  const name = current.kind === 'my' ? current.key : current.kind === 'tpl' ? TEMPLATES[current.key].name : 'Neues Board';
  const blob = new Blob([JSON.stringify({ name, state: engine.getState() }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${name.replace(/[^\wäöüÄÖÜß -]/g, '').trim() || 'board'}.synthboard.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
});

$('#btn-import').addEventListener('click', () => $('#file-import').click());
$('#file-import').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const state = data.state || data;
    if (!Array.isArray(state.modules)) throw new Error('Kein gültiges Board');
    const boards = loadBoards();
    let name = (data.name || file.name.replace(/\..*$/, '')).trim();
    while (boards[name]) name += ' (Import)';
    boards[name] = state;
    storeBoards(boards);
    if (!confirmDiscard()) { populateBoards(); return; }
    loadBoard('my', name);
    toast(`⇧ „${name}“ importiert`);
  } catch (err) {
    toast(`Import fehlgeschlagen: ${err.message}`);
  }
});

// ───────────────────────── Tastatur ──
const isTyping = (el) => el && (el.tagName === 'INPUT' && el.type !== 'range') || el?.tagName === 'TEXTAREA' || el?.tagName === 'SELECT';
window.addEventListener('keydown', (e) => {
  if (e.repeat || e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
  if (e.key.toLowerCase() === 'c') {
    const vis = patchBay.toggleVisible();
    $('#btn-cables').classList.toggle('on', vis);
    $('#btn-cables .txt').textContent = vis ? 'KABEL' : 'OHNE KABEL';
    toast(vis ? '🔌 Patch-Kabel sichtbar' : '🙈 Patch-Kabel ausgeblendet');
    return;
  }
  let handled = false;
  engine.sources.forEach((m) => { if (m.handleKey?.(e.key, true)) handled = true; });
  if (handled) { e.preventDefault(); if (engine.ctx.state === 'suspended') startAudio(); }
});
window.addEventListener('keyup', (e) => engine.sources.forEach((m) => m.handleKey?.(e.key, false)));
window.addEventListener('blur', () => engine.sources.forEach((m) => m.active && [...m.active.keys()].forEach((d) => m.noteOff(d))));

// ───────────────────────── Initialisierung ──
function boot() {
  renderLibrary();
  setupDropZones();
  let auto = null;
  try { auto = JSON.parse(localStorage.getItem(LS_AUTO)); } catch { /* ignore */ }
  if (auto?.state?.modules) {
    engine.load(auto.state);
    masterKnob.setValue(engine.masterValue);
    current = auto.current || { kind: 'tpl', key: 'generative' };
    if (current.kind === 'my' && !loadBoards()[current.key]) current = { kind: 'new', key: '' };
    renderRack();
    populateBoards();
    setDirty(!!auto.dirty);
  } else {
    loadBoard('tpl', 'generative');
  }
  updateStatus();
}

boot();
