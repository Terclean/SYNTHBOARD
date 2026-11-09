// SYNTHBOARD – Modulares Studio Rack: UI-Controller & Patchbay-Host
import { RackEngine, MODULES, TEMPLATES } from './modules/index.js';
import { Knob } from './ui/Knob.js';
import { Oscilloscope } from './ui/Oscilloscope.js';
import { PatchBay } from './ui/PatchBay.js';
import { InfoSystem } from './ui/InfoSystem.js';
import { SnapshotSystem } from './ui/SnapshotSystem.js';
import { FocusDock } from './ui/FocusDock.js';
import { getModuleIcon, ICONS } from './ui/icons.js';

const LS_BOARDS = 'synthboard:boards';
const LS_AUTO = 'synthboard:autosave';
const LS_PURGE_KEY = 'synthboard:purge_storage_v12';
const $ = (s) => document.querySelector(s);

const engine = new RackEngine();
let current = { kind: 'tpl', key: 'empty' }; // Standard: Leeres Board
let dirty = false;
let selectedModuleId = null;

// ───────────────────────── Hilfsfunktionen ──
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function fmt(p, v) {
  switch (p.fmt) {
    case 'pct': return `${Math.round(v * 100)}%`;
    case 'hz': return v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v < 10 ? `${v.toFixed(2)} Hz` : `${Math.round(v)} Hz`;
    case 's': return v < 1 ? `${Math.round(v * 1000)} ms` : `${v.toFixed(1)} s`;
    case 'cents': return `${Math.round(v)} ct`;
    case 'bpm': return `${Math.round(v)} BPM`;
    case 'int': return `${Math.round(v)}`;
    case 'st': return `${v > 0 ? '+' : ''}${Math.round(v)} st`;
    case 'gps': return `${v < 10 ? v.toFixed(1) : Math.round(v)}/s`;
    case 'sgn': return `${v > 0 ? '+' : ''}${Math.round(v * 100)}%`;
    case 'x': return `${v.toFixed(2)}×`;
    default: return v.toFixed(1);
  }
}

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
}

// Bereinigt Speicher automatisch von endlosen Import-Ketten
const loadBoards = () => {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_BOARDS)) || {};
    const sanitized = {};
    for (const [k, v] of Object.entries(raw)) {
      if (!k.includes('(Import) (Import)') && !k.startsWith('new3 (Import)')) {
        sanitized[k] = v;
      }
    }
    return sanitized;
  } catch {
    return {};
  }
};

const storeBoards = (b) => {
  try {
    localStorage.setItem(LS_BOARDS, JSON.stringify(b));
  } catch (err) {
    console.error('Speichern fehlgeschlagen:', err);
  }
};

let autoTimer;
function persist() {
  clearTimeout(autoTimer);
  autoTimer = setTimeout(() => {
    try {
      localStorage.setItem(LS_AUTO, JSON.stringify({ current, dirty, state: engine.getState() }));
    } catch { /* ignore */ }
  }, 250);
}

function setDirty(v) {
  dirty = v;
  $('#dirty-dot')?.classList.toggle('on', v);
  persist();
}
const changed = () => setDirty(true);

// ───────────────────────── Audio-Start & Transport ──
async function startAudio() {
  await engine.resume();
  updateStatus();
}

function updateStatus() {
  const running = engine.ctx.state === 'running';
  const btnPower = $('#btn-power');
  if (btnPower) {
    btnPower.classList.toggle('on', running);
    const txt = btnPower.querySelector('.txt');
    if (txt) txt.textContent = running ? 'AN' : 'AUS';
    btnPower.title = running ? 'Audio-Engine pausieren [Space]' : 'Audio-Engine starten [Space]';
  }
  $('#status-led')?.classList.toggle('on', running);
  const n = engine.controls.length + engine.sources.length + engine.effects.length;
  const statusTxt = $('#status-text');
  if (statusTxt) {
    statusTxt.textContent = running
      ? `Audio aktiv · ${engine.ctx.sampleRate / 1000} kHz · ${n} Module`
      : 'Audio pausiert';
  }
}

engine.ctx.addEventListener('statechange', updateStatus);

window.addEventListener('pointerdown', () => {
  if (engine.ctx.state === 'suspended' && !$('#btn-power')?.dataset.userPaused) startAudio();
}, { capture: true });

$('#btn-power')?.addEventListener('click', async (e) => {
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

$('#btn-record')?.addEventListener('click', async () => {
  await startAudio();
  const btn = $('#btn-record');
  if (!btn) return;
  if (engine.recorder) { engine.stopRecording(); return; }
  engine.startRecording(() => {
    btn.classList.remove('rec');
    const txt = btn.querySelector('.txt');
    if (txt) txt.textContent = 'REC';
    toast('Aufnahme gespeichert');
  });
  btn.classList.add('rec');
  const txt = btn.querySelector('.txt');
  if (txt) txt.textContent = 'STOP';
});

const masterKnob = new Knob($('#knob-master'), {
  min: 0, max: 1, value: 0.8,
  onChange: (v) => { engine.setMaster(v); changed(); },
});

new Oscilloscope($('#scope'), engine.analyser).start();

// ───────────────────────── PatchBay, FocusDock & SnapshotSystem ──
const patchCanvas = $('#patch-canvas');
const patchBay = new PatchBay(patchCanvas, engine, { onModified: changed });
const infoSystem = new InfoSystem(engine, patchBay, {
  onRackModified: () => {
    renderRack();
    changed();
  },
  onToast: (msg) => toast(msg),
  onStartAudio: () => startAudio(),
  onLoadTemplate: (key) => loadBoard('tpl', key),
});

const snapshotSystem = new SnapshotSystem(engine, {
  onToast: (msg) => toast(msg),
  onModified: changed,
});
engine.snapshotSystem = snapshotSystem;

const focusDock = new FocusDock($('#focus-dock'), {
  engine,
  onToast: (msg) => toast(msg),
  onModified: changed,
  onOpenSidebar: () => {
    setPerformanceBoardState(true);
  },
});
engine.focusDock = focusDock;

$('#btn-boards-gallery')?.addEventListener('click', () => infoSystem.openGuide('tab-boards'));
$('#btn-tutorials')?.addEventListener('click', () => infoSystem.openGuide('tab-tutorials'));
$('#btn-guide')?.addEventListener('click', () => infoSystem.openGuide('tab-guide'));
$('#btn-info')?.addEventListener('click', () => {
  const active = infoSystem.toggleTooltips();
  toast(active ? 'Info-Tooltips aktiviert' : 'Info-Tooltips deaktiviert');
});

$('#btn-cables')?.addEventListener('click', () => {
  const vis = patchBay.toggleVisible();
  $('#btn-cables').classList.toggle('on', vis);
  const txt = $('#btn-cables .txt');
  if (txt) txt.textContent = vis ? 'KABEL' : 'OHNE KABEL';
  toast(vis ? 'Patch-Kabel sichtbar' : 'Patch-Kabel ausgeblendet');
});

engine.onRecover = () => { renderRack(); toast('Audio-Überlauf erkannt – Rack neu gestartet'); };

// ───────────────────────── BPM Transport Sync ──
function syncTransportBpm() {
  const clock = engine.controls.find((m) => m.meta.type === 'master_clock');
  const bpmInput = $('#tempo-input');
  if (bpmInput && clock && typeof clock.values.tempo === 'number') {
    bpmInput.value = clock.values.tempo;
  }
}

function setRackBpm(val) {
  const clamped = Math.max(20, Math.min(300, Math.round(val)));
  const bpmInput = $('#tempo-input');
  if (bpmInput) bpmInput.value = clamped;
  const clock = engine.controls.find((m) => m.meta.type === 'master_clock');
  if (clock) {
    clock.setParam('tempo', clamped);
    clock.refreshKnobs?.();
    changed();
  }
}

$('#tempo-input')?.addEventListener('change', (e) => setRackBpm(e.target.value));
$('#btn-bpm-up')?.addEventListener('click', () => {
  const cur = parseInt($('#tempo-input')?.value, 10) || 120;
  setRackBpm(cur + 1);
});
$('#btn-bpm-down')?.addEventListener('click', () => {
  const cur = parseInt($('#tempo-input')?.value, 10) || 120;
  setRackBpm(cur - 1);
});

// ───────────────────────── Modulbibliothek ──
let currentLibFilter = 'all';
let libSearchQuery = '';

function renderLibrary() {
  const listEl = $('#lib-unified-list');
  const countBadge = $('#lib-count-badge');
  if (!listEl) return;

  const allMods = Object.values(MODULES);
  if (countBadge) countBadge.textContent = String(allMods.length);

  const filtered = allMods.filter((M) => {
    if (currentLibFilter !== 'all' && M.category !== currentLibFilter) return false;
    if (libSearchQuery) {
      const q = libSearchQuery.toLowerCase();
      const matchTitle = (M.title || '').toLowerCase().includes(q);
      const matchDesc = (M.description || '').toLowerCase().includes(q);
      const matchType = (M.type || '').toLowerCase().includes(q);
      if (!matchTitle && !matchDesc && !matchType) return false;
    }
    return true;
  });

  if (!filtered.length) {
    listEl.innerHTML = `<div class="lib-no-results" style="padding:16px;text-align:center;color:#64748b;font-size:0.8rem;">Keine Module für „${esc(libSearchQuery)}“ gefunden.</div>`;
    return;
  }

  listEl.innerHTML = filtered.map((M) => `
    <div class="lib-studio-row" draggable="true" data-type="${M.type}" style="--row-col:${M.color}" title="${esc(M.description)}">
      <span class="lib-row-icon">${getModuleIcon(M.type)}</span>
      <div class="lib-row-info">
        <span class="lib-row-title">${esc(M.title)}</span>
        <span class="lib-row-desc">${esc(M.description)}</span>
      </div>
      <button class="lib-row-add-btn" title="${esc(M.title)} zum Rack hinzufügen">＋</button>
    </div>
  `).join('');

  listEl.querySelectorAll('.lib-studio-row').forEach((el) => {
    el.addEventListener('click', () => addModule(el.dataset.type));
    el.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('application/x-module-type', el.dataset.type);
      e.dataTransfer.effectAllowed = 'copy';
      document.body.classList.add(`dragging-${MODULES[el.dataset.type]?.category || 'source'}`);
    });
    el.addEventListener('dragend', clearDragState);
  });
}

$('#lib-search')?.addEventListener('input', (e) => {
  libSearchQuery = e.target.value.trim();
  renderLibrary();
});
$('#lib-search')?.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    e.target.value = '';
    libSearchQuery = '';
    renderLibrary();
  }
});
document.querySelectorAll('.lib-filter-tabs .filter-tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.lib-filter-tabs .filter-tab').forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    currentLibFilter = tab.dataset.filter;
    renderLibrary();
  });
});

function addModule(type, index = -1) {
  const mod = engine.add(type, {}, index);
  if (!mod) return;
  renderRack(mod.id);
  selectModule(mod.id);
  changed();
  toast(`${mod.meta.title} hinzugefügt`);
}

// ───────────────────────── Rack Rendering & Drag and Drop ──
function renderRack(highlightId) {
  patchBay?.clearJacks();

  const rowControls = $('#rack-controls');
  const rowSources = $('#rack-sources');
  const rowEffects = $('#rack-effects');

  const countControls = $('#count-controls');
  const countSources = $('#count-sources');
  const countEffects = $('#count-effects');

  if (countControls) countControls.textContent = String(engine.controls.length);
  if (countSources) countSources.textContent = String(engine.sources.length);
  if (countEffects) countEffects.textContent = String(engine.effects.length);

  const allMods = [...engine.controls, ...engine.sources, ...engine.effects];

  // 1. Controls
  if (rowControls) {
    rowControls.innerHTML = '';
    if (!engine.controls.length) {
      rowControls.innerHTML = `
        <div class="rack-row-empty" data-category="control">
          <span class="row-empty-text">Keine Steuermodule im Rack – ziehe Clock, LFO oder Quantizer hierher</span>
        </div>`;
    } else {
      engine.controls.forEach((m, i) => rowControls.appendChild(createCard(m, i)));
    }
  }

  // 2. Sources
  if (rowSources) {
    rowSources.innerHTML = '';
    if (!engine.sources.length) {
      rowSources.innerHTML = `
        <div class="rack-row-empty" data-category="source">
          <span class="row-empty-text">Keine Instrumente im Rack – ziehe Chord Glide, Felt Piano oder Solo Violin hierher</span>
        </div>`;
    } else {
      engine.sources.forEach((m, i) => rowSources.appendChild(createCard(m, i)));
    }
  }

  // 3. Effects
  if (rowEffects) {
    rowEffects.innerHTML = '';
    if (!engine.effects.length) {
      rowEffects.innerHTML = `
        <div class="rack-row-empty" data-category="effect">
          <span class="row-empty-text">Keine Effekte im Rack – ziehe Filter, Reverb oder Delay hierher</span>
        </div>`;
    } else {
      engine.effects.forEach((m, i) => rowEffects.appendChild(createCard(m, i)));
    }
  }

  // Modulauswahl wiederherstellen oder erstes Modul wählen
  if (highlightId) {
    selectModule(highlightId);
    const card = document.querySelector(`.module-card[data-id="${highlightId}"]`);
    if (card) {
      card.classList.add('just-added');
      card.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }
  } else if (selectedModuleId && allMods.some((m) => m.id === selectedModuleId)) {
    selectModule(selectedModuleId);
  } else if (allMods.length) {
    selectModule(allMods[0].id);
  } else {
    selectModule(null);
  }

  // Kabel synchronisieren & neu zeichnen
  setTimeout(() => {
    patchBay.syncPatchedClasses?.();
    patchBay.render?.();
  }, 25);

  // Buttons zum Minimieren / Erweitern einer ganzen Reihe
  document.querySelectorAll('.row-fold-btn').forEach((btn) => {
    const cat = btn.dataset.rowCat;
    const list = cat === 'control' ? engine.controls
               : cat === 'source' ? engine.sources
               : engine.effects;
    const allCollapsed = list.length > 0 && list.every((m) => m.collapsed);
    btn.textContent = allCollapsed ? '▢ Erweitern' : '― Kompakt';
    btn.title = allCollapsed ? 'Alle Module in voller Größe anzeigen' : 'Alle Module zu kompakten Kacheln minimieren';
    btn.onclick = (e) => {
      e.stopPropagation();
      const shouldCollapse = !allCollapsed;
      list.forEach((m) => { m.collapsed = shouldCollapse; });
      renderRack();
      changed();
    };
  });

  snapshotSystem?.updateVisuals();
  focusDock?.updateRackBadges();
  updateStatus();
  syncTransportBpm();

  // Horizontales Scrollen per Mausrad auf den Rack-Schienen
  document.querySelectorAll('.rack-row-body').forEach((rowBody) => {
    rowBody.onwheel = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (rowBody.scrollWidth > rowBody.clientWidth && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        rowBody.scrollLeft += e.deltaY;
        patchBay.requestDraw?.();
      }
    };
  });
}

function createCard(mod, index = -1) {
  const M = mod.meta;
  const isFx = M.category === 'effect';
  const isCtrl = M.category === 'control';
  const card = document.createElement('article');
  card.className = `module-card is-${M.category}${mod.enabled ? '' : ' bypassed'}${mod.collapsed ? ' is-collapsed' : ''}${mod.id === selectedModuleId ? ' is-selected' : ''}`;
  card.dataset.id = mod.id;
  card.dataset.type = M.type;
  card.dataset.category = M.category;
  card.style.setProperty('--mod-color', M.color);

  const subTitle = isFx ? `FX ${index + 1}` : isCtrl ? 'Steuerung' : 'Stimme';

  card.innerHTML = `
    <header class="mod-head" draggable="true" title="Doppelklick: Modul ein-/ausklappen">
      <span class="mod-grip" title="Modul anfassen zum Verschieben">${ICONS.grip}</span>
      <span class="mod-icon">${getModuleIcon(M.type)}</span>
      <div class="mod-titles">
        <h3>${esc(M.title)}</h3>
        <small>${subTitle}</small>
      </div>
      <div class="mod-actions">
        ${isFx ? `<button class="icon-btn mv-left" title="Nach links" ${index === 0 ? 'disabled' : ''}>◀</button>
                  <button class="icon-btn mv-right" title="Nach rechts" ${index === engine.effects.length - 1 ? 'disabled' : ''}>▶</button>` : ''}
        <button class="icon-btn mod-min-btn" title="${mod.collapsed ? 'Modul vergrößern' : 'Modul minimieren'}">${mod.collapsed ? '▢' : '―'}</button>
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

    ${M.options?.length ? `<div class="mod-options">${M.options.map((o) => `
      <label class="opt"><span>${esc(o.label)}</span>
        <select class="select select-sm" data-opt="${o.id}">${o.choices.map(([v, l]) => `<option value="${v}" ${String(mod.values[o.id]) === String(v) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>
      </label>`).join('')}</div>` : ''}
    <div class="mod-knobs"></div>
    <div class="mod-extra"></div>
    ${!isFx && !isCtrl ? `
      <div class="mod-channel-strip">
        <div class="strip-header">
          <span class="strip-title">KANALZUG · PAN &amp; AUX SENDS</span>
        </div>
        <div class="strip-controls">
          <div class="strip-col">
            <span class="strip-lbl">PAN</span>
            <input type="range" class="strip-slider" data-strip="pan" min="-1" max="1" step="0.05" value="${mod.chPan ?? 0}" />
            <span class="strip-val" data-val="pan">${mod.chPan === 0 ? 'C' : mod.chPan < 0 ? Math.round(Math.abs(mod.chPan)*100)+'L' : Math.round(mod.chPan*100)+'R'}</span>
          </div>
          <div class="strip-col">
            <span class="strip-lbl">DELAY</span>
            <input type="range" class="strip-slider" data-strip="delay" min="0" max="1" step="0.02" value="${mod.chDelay ?? 0.15}" />
            <span class="strip-val" data-val="delay">${Math.round((mod.chDelay ?? 0.15)*100)}%</span>
          </div>
          <div class="strip-col">
            <span class="strip-lbl">REVERB</span>
            <input type="range" class="strip-slider" data-strip="reverb" min="0" max="1" step="0.02" value="${mod.chReverb ?? 0.35}" />
            <span class="strip-val" data-val="reverb">${Math.round((mod.chReverb ?? 0.35)*100)}%</span>
          </div>
        </div>
      </div>` : ''}`;

  const head = card.querySelector('.mod-head');

  // Auswahl-Klick auf Modul-Karte
  card.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button, select, input, .hw-jack, .knob-host')) return;
    selectModule(mod.id);
  });

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
  const knobRefs = [];
  M.params.forEach((p) => {
    const cell = document.createElement('div');
    cell.className = 'knob-cell';
    cell.dataset.modId = mod.id;
    cell.dataset.paramId = p.id;
    cell.title = 'Klicken: Auswählen & mit Pfeiltasten drehen · Shift+Klick: Als Live-Control zuweisen';
    cell.innerHTML = `<div class="knob-host" data-knob-color="mod" data-knob-size="med"></div><span class="k-label">${esc(p.label)}</span><span class="k-val"></span>`;
    knobsEl.appendChild(cell);
    const valEl = cell.querySelector('.k-val');

    const knobRefObj = { p, knob: null, valEl };

    const handleShiftClick = () => {
      focusDock.toggle({
        id: `${mod.id}:${p.id}`,
        modId: mod.id,
        paramId: p.id,
        modTitle: M.title,
        modColor: M.color,
        label: p.label,
        customLabel: null,
        paramDef: p,
        modRef: mod,
        getVal: () => mod.values[p.id],
        setVal: (v) => mod.setParam(p.id, v),
        fmtVal: (v) => fmt(p, v),
        origKnobRef: knobRefObj,
      });
    };

    const knob = new Knob(cell.querySelector('.knob-host'), {
      min: p.min,
      max: p.max,
      value: mod.values[p.id],
      defaultValue: p.value,
      logarithmic: !!p.log,
      onChange: (v) => {
        mod.setParam(p.id, v);
        valEl.textContent = fmt(p, v);
        focusDock.syncFromRack(mod.id, p.id, v);
        changed();
      },
      onShiftClick: () => handleShiftClick(),
      onFocus: () => {
        document.querySelectorAll('.knob-cell.is-focused').forEach((c) => c.classList.remove('is-focused'));
        cell.classList.add('is-focused');
      },
      onBlur: () => {
        cell.classList.remove('is-focused');
      },
    });

    knobRefObj.knob = knob;
    valEl.textContent = fmt(p, mod.values[p.id]);

    cell.addEventListener('click', (e) => {
      if (e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        handleShiftClick();
      } else {
        knob.focus();
      }
    });

    knobRefs.push(knobRefObj);
  });

  // Regler nachziehen bei interner Änderung
  mod.refreshKnobs = () => {
    knobRefs.forEach(({ p, knob, valEl }) => {
      knob.setValue(mod.values[p.id]);
      valEl.textContent = fmt(p, mod.values[p.id]);
      focusDock.syncFromRack(mod.id, p.id, mod.values[p.id]);
    });
    card.querySelectorAll('select[data-opt]').forEach((sel) => {
      sel.value = String(mod.values[sel.dataset.opt]);
    });
  };
  mod.notifyChanged = changed;

  // Optionen
  card.querySelectorAll('select[data-opt]').forEach((sel) => {
    const o = M.options?.find((x) => x.id === sel.dataset.opt);
    if (!o) return;
    sel.addEventListener('change', () => {
      const v = typeof o.value === 'number' ? Number(sel.value) : sel.value;
      mod.setParam(o.id, v);
      changed();
    });
  });

  mod.renderExtra?.(card.querySelector('.mod-extra'), { changed });

  // Kanalzug-Regler
  card.querySelectorAll('.strip-slider').forEach((slider) => {
    slider.addEventListener('input', (e) => {
      const type = e.target.dataset.strip;
      const val = parseFloat(e.target.value);
      const valEl = card.querySelector(`.strip-val[data-val="${type}"]`);
      if (type === 'pan') {
        mod.setChannelStrip({ pan: val });
        if (valEl) valEl.textContent = val === 0 ? 'C' : val < 0 ? `${Math.round(Math.abs(val) * 100)}L` : `${Math.round(val * 100)}R`;
      } else if (type === 'delay') {
        mod.setChannelStrip({ delay: val });
        if (valEl) valEl.textContent = `${Math.round(val * 100)}%`;
      } else if (type === 'reverb') {
        mod.setChannelStrip({ reverb: val });
        if (valEl) valEl.textContent = `${Math.round(val * 100)}%`;
      }
      changed();
    });
  });

  // Minimieren / Einklappen zu kompakter Kachel
  const minBtn = card.querySelector('.mod-min-btn');
  const toggleCollapse = (e) => {
    e?.stopPropagation();
    mod.collapsed = !mod.collapsed;
    card.classList.toggle('is-collapsed', mod.collapsed);
    if (minBtn) {
      minBtn.textContent = mod.collapsed ? '▢' : '―';
      minBtn.title = mod.collapsed ? 'Modul vergrößern' : 'Modul minimieren';
    }
    setTimeout(() => {
      patchBay.syncPatchedClasses?.();
      patchBay.render?.();
    }, 25);
    changed();
  };
  minBtn?.addEventListener('click', toggleCollapse);

  // Doppelklick auf Header schaltet Kompaktansicht um
  head.addEventListener('dblclick', (e) => {
    if (e.target.closest('button, input, select, .hw-jack, .knob-host')) return;
    toggleCollapse(e);
  });

  // Aktionen
  card.querySelector('.mod-info-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    infoSystem.openGuide('tab-modules');
    infoSystem.renderGuideModulesList('all', M.title);
  });
  card.querySelector('.power')?.addEventListener('click', () => {
    mod.setEnabled(!mod.enabled);
    card.classList.toggle('bypassed', !mod.enabled);
    changed();
    updateInspector();
  });
  card.querySelector('.remove')?.addEventListener('click', () => {
    removeModule(mod.id);
  });
  card.querySelector('.mv-left')?.addEventListener('click', () => {
    engine.moveEffect(mod.id, index - 1);
    renderRack();
    changed();
  });
  card.querySelector('.mv-right')?.addEventListener('click', () => {
    engine.moveEffect(mod.id, index + 1);
    renderRack();
    changed();
  });

  // ── Drag & Drop Anfasser (Grip) ──
  head?.addEventListener('dragstart', (e) => {
    e.dataTransfer.setData('application/x-module-id', mod.id);
    e.dataTransfer.setData('application/x-source-category', M.category);
    e.dataTransfer.effectAllowed = 'move';
    card.classList.add('drag-src');
    document.body.classList.add('dragging-mod');
  });
  head.addEventListener('dragend', () => {
    card.classList.remove('drag-src');
    clearDragState();
  });

  // Dragover auf Modulkarte
  card.addEventListener('dragover', (e) => {
    const isMove = e.dataTransfer.types.includes('application/x-module-id');
    const isNew = e.dataTransfer.types.includes('application/x-module-type');
    if (!isMove && !isNew) return;

    e.preventDefault();
    e.stopPropagation();

    const rect = card.getBoundingClientRect();
    const isBefore = e.clientX < (rect.left + rect.width / 2);

    document.querySelectorAll('.module-card').forEach((c) => {
      if (c !== card) c.classList.remove('drop-before', 'drop-after');
    });

    card.classList.toggle('drop-before', isBefore);
    card.classList.toggle('drop-after', !isBefore);
  });

  card.addEventListener('dragleave', (e) => {
    if (!card.contains(e.relatedTarget)) {
      card.classList.remove('drop-before', 'drop-after');
    }
  });

  card.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const isBefore = card.classList.contains('drop-before');
    card.classList.remove('drop-before', 'drop-after');
    clearDragState();

    const targetCategory = M.category;
    const rowList = targetCategory === 'control' ? engine.controls
                  : targetCategory === 'source' ? engine.sources
                  : engine.effects;
    const cardIdx = rowList.findIndex((m) => m.id === mod.id);
    let targetIdx = isBefore ? cardIdx : cardIdx + 1;

    const draggedModId = e.dataTransfer.getData('application/x-module-id');
    const newModType = e.dataTransfer.getData('application/x-module-type');

    if (draggedModId) {
      if (draggedModId === mod.id) return;
      engine.moveModule(draggedModId, targetCategory, targetIdx);
      renderRack(draggedModId);
      changed();
    } else if (newModType) {
      addModule(newModType, targetIdx);
    }
  });

  return card;
}

function removeModule(modId) {
  const card = document.querySelector(`.module-card[data-id="${modId}"]`);
  card?.classList.add('removing');
  focusDock?.onModuleRemoved(modId);
  patchBay.unregisterModuleJacks(modId);
  setTimeout(() => {
    engine.remove(modId);
    if (selectedModuleId === modId) selectedModuleId = null;
    renderRack();
    changed();
  }, 180);
}

// ───────────────────────── Modul-Auswahl & Inspektor ──
function selectModule(id) {
  selectedModuleId = id;
  document.querySelectorAll('.module-card').forEach((c) => {
    c.classList.toggle('is-selected', c.dataset.id === id);
  });
  patchBay.setSelectedModule(id);
  updateInspector();
}

function updateInspector() {
  const emptyEl = $('#insp-empty');
  const contentEl = $('#insp-content');

  if (!selectedModuleId) {
    emptyEl?.classList.remove('hidden');
    contentEl?.classList.add('hidden');
    const badge = $('#insp-badge');
    if (badge) {
      badge.textContent = 'Keine Auswahl';
      badge.style.borderColor = '';
      badge.style.color = '';
    }
    const icon = $('#insp-icon');
    if (icon) icon.innerHTML = '';
    const title = $('#insp-title');
    if (title) title.textContent = 'MODUL';
    return;
  }

  const mod = engine.get(selectedModuleId);
  if (!mod) {
    selectedModuleId = null;
    emptyEl?.classList.remove('hidden');
    contentEl?.classList.add('hidden');
    return;
  }

  emptyEl?.classList.add('hidden');
  contentEl?.classList.remove('hidden');

  const M = mod.meta;
  const icon = $('#insp-icon');
  if (icon) icon.innerHTML = getModuleIcon(M.type);
  const title = $('#insp-title');
  if (title) title.textContent = M.title.toUpperCase();

  const catNames = { control: 'Steuerung', source: 'Klangquelle', effect: 'Effekt' };
  const badge = $('#insp-badge');
  if (badge) {
    badge.textContent = catNames[M.category] || M.category;
    badge.style.borderColor = M.color;
    badge.style.color = M.color;
  }

  const desc = $('#insp-desc');
  if (desc) desc.textContent = M.description || 'Keine Beschreibung vorhanden.';

  // Schnell-Aktionen
  const btnPower = $('#insp-btn-power');
  if (btnPower) {
    btnPower.textContent = mod.enabled ? (M.category === 'effect' ? 'Bypass' : 'Ausschalten') : 'Einschalten';
    btnPower.onclick = () => {
      mod.setEnabled(!mod.enabled);
      const card = document.querySelector(`.module-card[data-id="${mod.id}"]`);
      card?.classList.toggle('bypassed', !mod.enabled);
      changed();
      updateInspector();
    };
  }

  const btnRemove = $('#insp-btn-remove');
  if (btnRemove) {
    btnRemove.onclick = () => removeModule(mod.id);
  }

  // Patch Matrix
  const matrixList = $('#insp-matrix-list');
  if (matrixList) {
    matrixList.innerHTML = '';
    const cables = engine.cables.filter((c) => c.from.startsWith(`${mod.id}:`) || c.to.startsWith(`${mod.id}:`));
    if (!cables.length) {
      matrixList.innerHTML = '<div class="insp-matrix-empty" style="padding:12px;color:#64748b;font-size:0.75rem;">Keine aktiven Patch-Kabel an diesem Modul.</div>';
    } else {
      cables.forEach((c) => {
        const isFrom = c.from.startsWith(`${mod.id}:`);
        const ownPortId = isFrom ? c.from.split(':')[1] : c.to.split(':')[1];
        const otherStr = isFrom ? c.to : c.from;
        const [otherModId, otherPortId] = otherStr.split(':');
        const otherMod = engine.get(otherModId);
        const ownJack = M.jacks?.find((j) => j.id === ownPortId);
        const otherJack = otherMod?.meta.jacks?.find((j) => j.id === otherPortId);

        const row = document.createElement('div');
        row.className = 'matrix-row';
        row.innerHTML = `
          <span class="matrix-dir ${isFrom ? 'out' : 'in'}">${isFrom ? 'OUT ➜' : 'IN ◀'}</span>
          <span class="matrix-jack-own" style="color: ${c.color || '#fff'}">${ownJack?.label || ownPortId}</span>
          <span class="matrix-peer">${otherMod ? `${getModuleIcon(otherMod.meta.type)} ${esc(otherMod.meta.title)}` : otherModId} [${otherJack?.label || otherPortId}]</span>
          <button class="matrix-btn-cut" title="Dieses Kabel trennen">✕</button>
        `;
        row.querySelector('.matrix-btn-cut').onclick = () => {
          engine.disconnect(c.from, c.to);
          patchBay.render();
          updateInspector();
          changed();
          toast('Kabel getrennt');
        };
        matrixList.appendChild(row);
      });
    }
  }
}

// ───────────────────────── Drag & Drop Zonen Setup ──
function clearDragState() {
  document.body.classList.remove('dragging-control', 'dragging-source', 'dragging-effect', 'dragging-mod');
  document.querySelectorAll('.drop-target').forEach((el) => el.classList.remove('drop-target'));
  document.querySelectorAll('.module-card').forEach((el) => el.classList.remove('drop-before', 'drop-after'));
}

function setupDropZones() {
  const rows = [
    { el: $('#rack-controls'), category: 'control' },
    { el: $('#rack-sources'), category: 'source' },
    { el: $('#rack-effects'), category: 'effect' },
  ];

  rows.forEach(({ el, category }) => {
    if (!el) return;
    el.addEventListener('dragover', (e) => {
      const isMove = e.dataTransfer.types.includes('application/x-module-id');
      const isNew = e.dataTransfer.types.includes('application/x-module-type');
      if (!isMove && !isNew) return;

      e.preventDefault();
      el.classList.add('drop-target');
    });

    el.addEventListener('dragleave', (e) => {
      if (!el.contains(e.relatedTarget)) {
        el.classList.remove('drop-target');
      }
    });

    el.addEventListener('drop', (e) => {
      e.preventDefault();
      el.classList.remove('drop-target');
      clearDragState();

      const draggedModId = e.dataTransfer.getData('application/x-module-id');
      const newModType = e.dataTransfer.getData('application/x-module-type');

      if (draggedModId) {
        engine.moveModule(draggedModId, category, -1);
        renderRack(draggedModId);
        changed();
      } else if (newModType) {
        addModule(newModType, -1);
      }
    });
  });
}

// ───────────────────────── Boards Verwaltung & Speicher ──
function populateBoards() {
  const boards = loadBoards();
  const sel = $('#board-select');
  if (!sel) return;
  const mine = Object.keys(boards).sort((a, b) => a.localeCompare(b));

  const options = [];
  if (current.kind === 'new') {
    options.push('<option value="new:" selected>Neues Board (ungespeichert)</option>');
  }

  options.push(`<optgroup label="Meine Patches">${mine.length ? mine.map((n) => `<option value="my:${esc(n)}">${esc(n)}</option>`).join('') : '<option disabled>– noch keine gespeichert –</option>'}</optgroup>`);

  options.push(`<optgroup label="Studio-Vorlagen">${Object.entries(TEMPLATES).map(([k, t]) => `<option value="tpl:${k}">${esc(t.name)}</option>`).join('')}</optgroup>`);

  if (mine.length > 0) {
    options.push('<option value="action:clear_all">Speicher komplett leeren (alle Boards löschen)...</option>');
  }

  sel.innerHTML = options.join('');

  const targetVal = current.kind === 'new' ? 'new:' : `${current.kind}:${current.key}`;
  const exists = Array.from(sel.options).some((o) => o.value === targetVal);

  if (!exists && targetVal) {
    // Falls Key z. B. durch Autosave oder Import noch nicht existiert, dynamisch hinzufügen damit Dropdown nie leer ist
    const fallbackLabel = current.key || (current.kind === 'new' ? 'Neues Board (ungespeichert)' : 'Aktueller Patch');
    const customOpt = document.createElement('option');
    customOpt.value = targetVal;
    customOpt.textContent = fallbackLabel;
    customOpt.selected = true;
    sel.prepend(customOpt);
  } else {
    sel.value = targetVal;
  }

  const activeLabel = sel.selectedOptions[0]?.textContent || (current.key || 'Patch wählen');
  const wrap = $('.patch-selector-wrap');
  if (wrap) wrap.title = `Aktiver Patch: ${activeLabel} (Klicken zum Wechseln)`;

  const btnDelete = $('#btn-delete');
  if (btnDelete) {
    btnDelete.disabled = current.kind !== 'my' && mine.length === 0;
    btnDelete.title = current.kind === 'my' ? `Board „${current.key}“ löschen` : mine.length > 0 ? 'Gespeicherte Boards löschen' : 'Speicher leeren';
  }
}

// Klick auf den gesamten Patch-Badge öffnet zuverlässig die Patch-Auswahl
$('.patch-selector-wrap')?.addEventListener('click', (e) => {
  const sel = $('#board-select');
  if (!sel) return;
  if (e.target !== sel) {
    sel.focus();
    if (typeof sel.showPicker === 'function') {
      try { sel.showPicker(); } catch (_) { sel.click(); }
    } else {
      sel.click();
    }
  }
});

function loadBoard(kind, key) {
  const state = kind === 'tpl' ? TEMPLATES[key]?.state : loadBoards()[key];
  if (!state) return;
  focusDock?.clear();
  engine.load(structuredClone(state));
  masterKnob.setValue(engine.masterValue);
  current = { kind, key };
  renderRack();
  snapshotSystem?.updateVisuals();
  populateBoards();
  setDirty(false);
  setTimeout(() => {
    fitZoomToScreen(false);
  }, 60);
}

function confirmDiscard() {
  return !dirty || confirm('Ungespeicherte Änderungen am aktuellen Board verwerfen?');
}

function clearEntireStorage() {
  if (confirm('Möchtest du wirklich deinen Speicher komplett leeren und alle gespeicherten Boards entfernen?')) {
    storeBoards({});
    try { localStorage.removeItem(LS_AUTO); } catch { /* ignore */ }
    toast('Speicher bereinigt: Alle Boards gelöscht');
    loadBoard('tpl', 'empty');
  }
}

$('#board-select')?.addEventListener('change', (e) => {
  const [kind, ...rest] = e.target.value.split(':');
  if (kind === 'new') return;
  if (kind === 'action' && rest[0] === 'clear_all') {
    clearEntireStorage();
    populateBoards();
    return;
  }
  if (!confirmDiscard()) { populateBoards(); return; }
  loadBoard(kind, rest.join(':'));
});

function saveAs() {
  const boards = loadBoards();
  const suggestion = current.kind === 'my' ? `${current.key} (Kopie)` : current.kind === 'tpl' ? `Mein ${TEMPLATES[current.key]?.name?.replace(/^\S+\s/, '') || 'Board'}` : 'Mein Board';
  const name = prompt('Name für dein Board:', suggestion)?.trim();
  if (!name) return;
  if (boards[name] && !confirm(`„${name}“ existiert schon. Überschreiben?`)) return;
  boards[name] = engine.getState();
  storeBoards(boards);
  current = { kind: 'my', key: name };
  populateBoards();
  setDirty(false);
  toast(`„${name}“ gespeichert`);
}

$('#btn-save')?.addEventListener('click', () => {
  if (current.kind !== 'my') return saveAs();
  const boards = loadBoards();
  boards[current.key] = engine.getState();
  storeBoards(boards);
  setDirty(false);
  toast(`„${current.key}“ gespeichert`);
});

$('#btn-save-as')?.addEventListener('click', saveAs);

$('#btn-new')?.addEventListener('click', () => {
  if (!confirmDiscard()) return;
  engine.load({ master: engine.masterValue, modules: [], cables: [] });
  current = { kind: 'new', key: '' };
  renderRack();
  populateBoards();
  setDirty(false);
  toast('Leeres Board – füge links Module hinzu');
});

$('#btn-delete')?.addEventListener('click', (e) => {
  const boards = loadBoards();
  const mine = Object.keys(boards);
  if (e.shiftKey || current.kind !== 'my') {
    clearEntireStorage();
    return;
  }
  if (confirm(`Möchtest du das Board „${current.key}“ löschen?`)) {
    delete boards[current.key];
    storeBoards(boards);
    toast(`Board „${current.key}“ gelöscht`);
    loadBoard('tpl', 'empty');
  }
});

$('#btn-export')?.addEventListener('click', () => {
  const name = current.kind === 'my' ? current.key : current.kind === 'tpl' ? (TEMPLATES[current.key]?.name || 'Board') : 'Neues Board';
  const blob = new Blob([JSON.stringify({ name, state: engine.getState() }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${name.replace(/[^\wäöüÄÖÜß -]/g, '').trim() || 'board'}.synthboard.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
});

$('#btn-import')?.addEventListener('click', () => $('#file-import')?.click());
$('#file-import')?.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const state = data.state || data;
    if (!Array.isArray(state.modules)) throw new Error('Kein gültiges Board');
    const boards = loadBoards();
    const baseName = (data.name || file.name.replace(/\..*$/, '')).trim();
    let name = baseName;
    if (boards[name]) {
      let counter = 2;
      while (boards[`${baseName} (${counter})`]) counter++;
      name = `${baseName} (${counter})`;
    }
    boards[name] = state;
    storeBoards(boards);
    if (!confirmDiscard()) { populateBoards(); return; }
    loadBoard('my', name);
    toast(`„${name}“ importiert`);
  } catch (err) {
    toast(`Import fehlgeschlagen: ${err.message}`);
  }
});

// ───────────────────────── Sidebar & Performance-Board Synchronisation ──
function setLibraryState(open) {
  const ws = $('#workspace');
  const btn = $('#btn-side-lib');
  const edgeTab = $('#btn-open-lib-edge');
  if (!ws) return;
  const isOpen = !!open;
  ws.classList.toggle('lib-collapsed', !isOpen);
  if (btn) {
    btn.classList.toggle('active', isOpen);
    btn.title = isOpen ? 'Bibliothek schließen [Taste B]' : 'Bibliothek öffnen [Taste B]';
  }
  if (edgeTab) {
    edgeTab.classList.toggle('hidden', isOpen);
  }
  try { localStorage.setItem('synthboard:lib_collapsed', isOpen ? '0' : '1'); } catch { /* ignore */ }
  setTimeout(() => { patchBay.updateSize?.(); patchBay.render?.(); }, 160);
}

function toggleLibrary(forced) {
  const ws = $('#workspace');
  if (!ws) return;
  const currentlyOpen = !ws.classList.contains('lib-collapsed');
  const target = typeof forced === 'boolean' ? forced : !currentlyOpen;
  setLibraryState(target);
}

function setPerformanceBoardState(open) {
  const ws = $('#workspace');
  const btn = $('#btn-toggle-perf-board');
  const edgeTab = $('#btn-open-perf-edge');
  if (!ws) return;
  const isOpen = !!open;
  ws.classList.toggle('perf-collapsed', !isOpen);
  if (btn) {
    btn.classList.toggle('active', isOpen);
    btn.title = isOpen ? 'Performance-Board schließen [Taste P]' : 'Performance-Board öffnen [Taste P]';
  }
  if (edgeTab) {
    edgeTab.classList.toggle('hidden', isOpen);
  }
  try { localStorage.setItem('synthboard:perf_collapsed', isOpen ? '0' : '1'); } catch { /* ignore */ }
  setTimeout(() => { patchBay.updateSize?.(); patchBay.render?.(); }, 160);
}

function togglePerformanceBoard(forced) {
  const ws = $('#workspace');
  if (!ws) return;
  const currentlyOpen = !ws.classList.contains('perf-collapsed');
  const target = typeof forced === 'boolean' ? forced : !currentlyOpen;
  setPerformanceBoardState(target);
}

$('#btn-side-lib')?.addEventListener('click', () => toggleLibrary());
$('#btn-toggle-lib')?.addEventListener('click', () => toggleLibrary());
$('#btn-close-lib')?.addEventListener('click', () => setLibraryState(false));
$('#btn-open-lib-edge')?.addEventListener('click', () => setLibraryState(true));

$('#btn-toggle-perf-board')?.addEventListener('click', () => togglePerformanceBoard());
$('#btn-toggle-perf')?.addEventListener('click', () => togglePerformanceBoard());
$('#btn-close-perf-board')?.addEventListener('click', () => setPerformanceBoardState(false));
$('#btn-open-perf-edge')?.addEventListener('click', () => setPerformanceBoardState(true));

// Edit Menu
$('#menu-disconnect-all')?.addEventListener('click', () => {
  if (!engine.cables.length) {
    toast('Keine Kabel vorhanden');
    return;
  }
  if (confirm(`Alle ${engine.cables.length} Patchkabel abziehen?`)) {
    engine.cables = [];
    patchBay.render();
    updateInspector();
    changed();
    toast('Alle Patchkabel abgezogen');
  }
});

$('#menu-clear-focus')?.addEventListener('click', () => {
  focusDock?.clear();
  toast('Live-Controls geleert');
});

// ───────────────────────── Zoom & Arbeitsbereich ──
const LS_ZOOM = 'synthboard:zoom_v2';
let currentZoom = 0.78; // Standard: 78% Übersicht, damit alle 3 Reihen & Module sofort sichtbar sind
try {
  const savedZoom = parseFloat(localStorage.getItem(LS_ZOOM));
  if (!isNaN(savedZoom) && savedZoom >= 0.45 && savedZoom <= 1.3) currentZoom = savedZoom;
} catch { /* ignore */ }

const rackWorkspaceEl = document.getElementById('rack-workspace');

function applyZoom(level, notify = false) {
  currentZoom = Math.max(0.45, Math.min(1.3, Math.round(level * 100) / 100));
  const rackMain = document.getElementById('rack-main');
  if (rackMain) {
    rackMain.style.zoom = currentZoom;
  }
  const valEl = document.getElementById('zoom-val');
  if (valEl) valEl.textContent = `${Math.round(currentZoom * 100)}%`;
  try { localStorage.setItem(LS_ZOOM, currentZoom); } catch { /* ignore */ }
  patchBay.updateSize?.();
  patchBay.render?.();
  if (notify) toast(`Zoom: ${Math.round(currentZoom * 100)}%`);
}

function fitZoomToScreen(notify = true) {
  const rackEl = document.querySelector('.rack');
  const ws = document.getElementById('rack-workspace');
  if (!ws || !rackEl) return;

  rackEl.style.zoom = '1';

  const availableH = ws.clientHeight - 36;
  const naturalH = rackEl.scrollHeight || 1000;

  let targetRatio = availableH / naturalH;
  targetRatio = Math.max(0.40, Math.min(1.05, Math.round(targetRatio * 100) / 100));

  applyZoom(targetRatio, false);
  if (notify) toast(`Studio-Übersicht: ${Math.round(targetRatio * 100)}% (Alles im Blick)`);
}

$('#btn-zoom-out')?.addEventListener('click', () => applyZoom(currentZoom - 0.1, true));
$('#btn-zoom-in')?.addEventListener('click', () => applyZoom(currentZoom + 0.1, true));
$('#btn-zoom-reset')?.addEventListener('click', () => applyZoom(1.0, true));
$('#btn-zoom-fit')?.addEventListener('click', () => fitZoomToScreen(true));
$('#btn-studio-overview')?.addEventListener('click', () => fitZoomToScreen(true));
$('#btn-toggle-overview')?.addEventListener('click', () => fitZoomToScreen(true));

// Sofortiges flüssiges Neuzeichnen der Patchkabel beim Scrollen im Rack
rackWorkspaceEl?.addEventListener('scroll', () => {
  patchBay.requestDraw?.();
}, { passive: true });

// Zoom per Cmd/Ctrl/Alt + Mausrad im Rack
rackWorkspaceEl?.addEventListener('wheel', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.05 : -0.05;
    applyZoom(currentZoom + delta);
  }
}, { passive: false });

// ───────────────────────── Tastatur & Eingabekontext ──
const isTyping = (el) => el && (el.tagName === 'INPUT' && el.type !== 'range') || el?.tagName === 'TEXTAREA' || el?.tagName === 'SELECT';

window.addEventListener('keydown', (e) => {
  if (isTyping(e.target)) return;

  if (e.code === 'Space') {
    e.preventDefault();
    $('#btn-power')?.click();
    return;
  }

  if ((e.key === 's' || e.key === 'S') && (e.metaKey || e.ctrlKey)) {
    e.preventDefault();
    $('#btn-save')?.click();
    return;
  }
  if ((e.key === 'n' || e.key === 'N') && (e.metaKey || e.ctrlKey)) {
    e.preventDefault();
    $('#btn-new')?.click();
    return;
  }

  // Zoom Shortcuts
  if ((e.key === '-' || e.key === '_') && (e.ctrlKey || e.metaKey || !e.shiftKey)) {
    e.preventDefault();
    applyZoom(currentZoom - 0.1, true);
    return;
  }
  if ((e.key === '+' || e.key === '=') && (e.ctrlKey || e.metaKey || !e.shiftKey)) {
    e.preventDefault();
    applyZoom(currentZoom + 0.1, true);
    return;
  }
  if (e.key === '0' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    applyZoom(1.0, true);
    return;
  }

  if (!e.metaKey && !e.ctrlKey && !e.altKey) {
    if (e.key.toLowerCase() === 'f' || e.key.toLowerCase() === 'o') {
      e.preventDefault();
      fitZoomToScreen(true);
      return;
    }
    if (e.key.toLowerCase() === 'b') {
      e.preventDefault();
      toggleLibrary();
      return;
    }
    if (e.key.toLowerCase() === 'p') {
      e.preventDefault();
      togglePerformanceBoard();
      return;
    }
    if (e.key.toLowerCase() === 'h') {
      e.preventDefault();
      infoSystem.openGuide('tab-guide');
      return;
    }
    if (e.key.toLowerCase() === 't') {
      e.preventDefault();
      infoSystem.openGuide('tab-tutorials');
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      selectModule(null);
      return;
    }
  }

  if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;

  if (e.key.toLowerCase() === 'c') {
    const vis = patchBay.toggleVisible();
    $('#btn-cables')?.classList.toggle('on', vis);
    const txt = $('#btn-cables .txt');
    if (txt) txt.textContent = vis ? 'KABEL' : 'OHNE KABEL';
    toast(vis ? 'Patch-Kabel sichtbar' : 'Patch-Kabel ausgeblendet');
    return;
  }

  // Instrument-Tasten spielen
  let handled = false;
  engine.sources.forEach((m) => { if (m.handleKey?.(e.key, true)) handled = true; });
  if (handled) { e.preventDefault(); if (engine.ctx.state === 'suspended') startAudio(); }
});

window.addEventListener('keyup', (e) => engine.sources.forEach((m) => m.handleKey?.(e.key, false)));
window.addEventListener('blur', () => engine.sources.forEach((m) => m.active && [...m.active.keys()].forEach((d) => m.noteOff(d))));

// ───────────────────────── Initialisierung ──
function boot() {
  // Einmalige automatische Bereinigung alter Import-Ketten & Reset auf sauberes System
  if (!localStorage.getItem(LS_PURGE_KEY)) {
    try {
      localStorage.removeItem(LS_BOARDS);
      localStorage.removeItem(LS_AUTO);
      localStorage.setItem(LS_PURGE_KEY, '1');
    } catch { /* ignore */ }
  }

  renderLibrary();
  setupDropZones();

  let auto = null;
  try { auto = JSON.parse(localStorage.getItem(LS_AUTO)); } catch { /* ignore */ }

  if (auto?.state?.modules) {
    engine.load(auto.state);
    masterKnob.setValue(engine.masterValue);
    current = auto.current || { kind: 'tpl', key: 'empty' };
    if (current.kind === 'my' && !loadBoards()[current.key]) current = { kind: 'new', key: '' };
    renderRack();
    populateBoards();
    setDirty(!!auto.dirty);
  } else {
    loadBoard('tpl', 'empty');
  }

  try {
    const libCollapsed = localStorage.getItem('synthboard:lib_collapsed') === '1';
    setLibraryState(!libCollapsed);

    const perfCollapsed = localStorage.getItem('synthboard:perf_collapsed') === '1';
    setPerformanceBoardState(!perfCollapsed);
  } catch { /* ignore */ }

  applyZoom(currentZoom);
  setTimeout(() => {
    fitZoomToScreen(false);
  }, 120);
  updateStatus();
}

boot();
