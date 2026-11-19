// SYNTHBOARD – Modulares Studio Rack: UI-Controller & Patchbay-Host
import { RackEngine, MODULES, TEMPLATES } from './modules/index.js';
import { Knob } from './ui/Knob.js';
import { Oscilloscope } from './ui/Oscilloscope.js';
import { PatchBay } from './ui/PatchBay.js';
import { InfoSystem } from './ui/InfoSystem.js';
import { SnapshotSystem } from './ui/SnapshotSystem.js';
import { FocusDock } from './ui/FocusDock.js';
import { getModuleIcon, ICONS } from './ui/icons.js';
import { EurorackUI } from './eurorack/ui.js';
import { StudioWorkspace } from './ui/StudioWorkspace.js';
import { ManualModal } from './ui/ManualModal.js';
import { MAX_IMPORT_BYTES, validateFileSize, validateAndSanitizePatchState } from './modules/patchValidator.js';
import { getLang, setLang, onLangChange, applyTranslations, t, tr } from './ui/i18n.js';
import { CommunityModal } from './ui/CommunityModal.js';
import { decodePatchFromHash } from './ui/communityUtils.js';
import { AudioSynthAnalyzerModal } from './ui/AudioSynthAnalyzerModal.js';

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
  const ctxState = engine.ctx.state;
  const running = ctxState === 'running';
  const btnPower = $('#btn-power');
  if (btnPower) {
    btnPower.classList.toggle('on', running);
    const txt = btnPower.querySelector('.txt');
    if (txt) txt.textContent = running ? t('AN', 'ON') : t('AUS', 'OFF');
    btnPower.title = running
      ? t('Audio-Engine pausieren [Space]', 'Pause audio engine [Space]')
      : ctxState === 'interrupted'
        ? t('Audio unterbrochen – Klicken zum Fortsetzen', 'Audio interrupted – Click to resume')
        : t('Audio-Engine starten [Space]', 'Start audio engine [Space]');
  }
  $('#status-led')?.classList.toggle('on', running);
  const n = engine.controls.length + engine.sources.length + engine.effects.length;
  const statusTxt = $('#status-text');
  if (statusTxt) {
    statusTxt.textContent = running
      ? t(`Audio aktiv · ${engine.ctx.sampleRate / 1000} kHz · ${n} Module`, `Audio active · ${engine.ctx.sampleRate / 1000} kHz · ${n} modules`)
      : ctxState === 'interrupted'
        ? t('Audio unterbrochen – Klicken zum Fortsetzen', 'Audio interrupted – Click to resume')
        : t('Audio pausiert – Klicken oder [Space] zum Starten', 'Audio paused – Click or [Space] to start');
  }
}

engine.ctx.addEventListener('statechange', updateStatus);

window.addEventListener('pointerdown', () => {
  if ((engine.ctx.state === 'suspended' || engine.ctx.state === 'interrupted') && !$('#btn-power')?.dataset.userPaused) {
    startAudio();
  }
}, { capture: true });

$('#btn-power')?.addEventListener('click', async (e) => {
  e.stopPropagation();
  if (engine.ctx.state === 'running') {
    $('#btn-power').dataset.userPaused = '1';
    try {
      engine.masterGain.gain.setTargetAtTime(0, engine.ctx.currentTime, 0.015);
    } catch { /* ignore */ }
    setTimeout(async () => {
      if ($('#btn-power')?.dataset.userPaused && engine.ctx.state === 'running') {
        await engine.ctx.suspend();
        updateStatus();
      }
    }, 45);
  } else {
    delete $('#btn-power').dataset.userPaused;
    await engine.resume();
    engine.setMaster(engine.masterValue);
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

const scopeModeLabels = {
  wave: 'WAVE',
  fft: 'TIMBRE FFT (20Hz-16k)',
  xy: 'XY ORBIT / STEREO',
  '3d': '3D WATERFALL',
  radial: '3D RELIEF RING',
  sculpt: 'LIGHT SCULPT',
  chord: '3D CHORD VOICES',
};
const scope = new Oscilloscope($('#scope'), engine.analyser, {
  engine,
  analyserL: engine.analyserL,
  analyserR: engine.analyserR,
  initialMode: 'radial',
  onReadout: ({ peakDb, note, timbre }) => {
    const peakEl = $('#scope-ro-peak');
    const noteEl = $('#scope-ro-note');
    const timbreEl = $('#scope-ro-timbre');
    const perfTimbreEl = $('#perf-scope-timbre');
    if (peakEl) peakEl.textContent = peakDb <= -60 ? '-∞ dB' : `${peakDb.toFixed(1)} dB`;
    if (noteEl) noteEl.textContent = note || '—';
    if (timbre) {
      if (timbreEl) {
        timbreEl.textContent = timbre.label;
        timbreEl.style.color = timbre.color;
      }
      if (perfTimbreEl) {
        perfTimbreEl.textContent = timbre.label;
        perfTimbreEl.style.color = timbre.color;
      }
    }
  },
  onModeChange: (mode) => {
    document.querySelectorAll('.scope-pill[data-scope-mode]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.scopeMode === mode);
    });
    const modeEl = $('#scope-ro-mode');
    if (modeEl) modeEl.textContent = scopeModeLabels[mode] || mode.toUpperCase();
  },
});
if ($('#perf-scope-canvas')) {
  scope.registerCanvas('perf', $('#perf-scope-canvas'));
  $('#perf-scope-canvas')?.addEventListener('click', () => scope.cycleMode());
}
scope.start();
if (engine.patchSystem) {
  engine.patchSystem.onMusicalEvent = (ev) => scope.pushMusicalEvent(ev);
}

$('#scope')?.addEventListener('click', () => scope.cycleMode());
document.querySelectorAll('.scope-pill[data-scope-mode]').forEach((btn) => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const targetMode = btn.dataset.scopeMode;
    scope.directorMode = false;
    if (targetMode === 'xy' && scope.mode === 'xy') {
      scope.toggleXySubMode();
    } else {
      scope.setMode(targetMode);
    }
  });
});

const scopePopout = $('#scope-popout');
const scopePopoutCanvas = $('#scope-popout-canvas');
const setScopePopoutOpen = (open) => {
  if (!scopePopout) return;
  scopePopout.classList.toggle('hidden', !open);
  scope.setPopoutCanvas(open ? scopePopoutCanvas : null);
  $('#btn-scope-expand')?.classList.toggle('active', open);
};
$('#btn-scope-expand')?.addEventListener('click', (e) => {
  e.stopPropagation();
  const isHidden = scopePopout?.classList.contains('hidden');
  setScopePopoutOpen(Boolean(isHidden));
});
$('#btn-scope-close')?.addEventListener('click', () => setScopePopoutOpen(false));
scopePopoutCanvas?.addEventListener('click', () => scope.cycleMode());

// Synchronisierter Audio+Video-Export für Popout-Visualizer (inkl. 2-Minuten-Clip-Limit)
let clipRecorder = null;
let clipMaxTimer = null;
$('#btn-scope-clip')?.addEventListener('click', async (e) => {
  e.stopPropagation();
  const btn = $('#btn-scope-clip');
  if (!btn || !scopePopoutCanvas) return;

  if (clipRecorder && clipRecorder.state === 'recording') {
    clipRecorder.stop();
    return;
  }

  if (typeof scopePopoutCanvas.captureStream !== 'function' || typeof MediaRecorder === 'undefined') {
    toast(t('Video-Export wird von diesem Browser nicht unterstützt.', 'Video export is not supported in this browser.'));
    return;
  }

  await startAudio();
  const videoStream = scopePopoutCanvas.captureStream(30);
  const audioDest = engine.ctx.createMediaStreamDestination();
  engine.limiter.connect(audioDest);
  const combined = new MediaStream([
    ...videoStream.getVideoTracks(),
    ...audioDest.stream.getAudioTracks(),
  ]);

  const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
    ? 'video/webm;codecs=vp9,opus'
    : 'video/webm';
  const chunks = [];
  const rec = new MediaRecorder(combined, { mimeType: mime });
  clipRecorder = rec;

  rec.ondataavailable = (ev) => {
    if (ev.data && ev.data.size > 0) chunks.push(ev.data);
  };
  rec.onstop = () => {
    clearTimeout(clipMaxTimer);
    clipMaxTimer = null;
    scope.directorMode = false;
    try { engine.limiter.disconnect(audioDest); } catch { /* ignore */ }
    videoStream.getTracks().forEach((tr) => tr.stop());
    btn.classList.remove('is-recording');
    btn.textContent = 'CLIP';
    clipRecorder = null;

    if (!chunks.length) return;
    const blob = new Blob(chunks, { type: mime });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `synthboard-light-sculpture-${Date.now()}.webm`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast(t('Audio+Video-Clip gespeichert (.webm)', 'Audio+Video clip saved (.webm)'));
  };

  scope.directorMode = true;
  rec.start(250);
  btn.classList.add('is-recording');
  btn.textContent = '■ STOP';
  clipMaxTimer = setTimeout(() => {
    if (clipRecorder && clipRecorder.state === 'recording') clipRecorder.stop();
  }, 120000);
});

// ───────────────────────── Globaler Tab-Switch & Offscreen-Sleep ──
document.addEventListener('visibilitychange', () => {
  const hidden = document.hidden;
  scope.setPaused(hidden);
  if (!hidden) {
    engine.controls?.forEach((m) => m._resumePlayhead?.());
    patchBay?.requestDraw?.();
  }
});

const canvasModuleTypes = new Set(['chord_glide', 'euclidean', 'resonator_garden', 'spectral_swarm']);
const cardVisibilityObserver = typeof IntersectionObserver !== 'undefined'
  ? new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const modId = entry.target?.dataset?.id;
        if (!modId) continue;
        const mod = [...engine.controls, ...engine.sources, ...engine.effects].find((m) => m.id === modId);
        if (mod) mod._isOffscreen = !entry.isIntersecting;
      }
    }, { rootMargin: '120px' })
  : null;

// ───────────────────────── Community & Leaderboard ──
const loadExternalRackState = (state, title) => {
  const validated = validateAndSanitizePatchState({ version: 2, name: title || state?.name || 'Custom Patch', state });
  if (!validated.ok) {
    toast(`${t('Laden fehlgeschlagen', 'Load failed')}: ${validated.error}`);
    return false;
  }
  focusDock?.clear();
  normalizePatchState(validated.state);
  engine.load(validated.state, validated.name);
  masterKnob.setValue(engine.masterValue);
  current = { kind: 'new', key: validated.name };
  renderRack();
  populateBoards();
  snapshotSystem?.updateVisuals();
  changed();
  setTimeout(() => {
    fitZoomToScreen(false);
  }, 60);
  return true;
};

const communityModal = new CommunityModal({
  engine,
  getCurrentState: () => engine.getState(),
  getSavedBoards: () => loadBoards(),
  onOpenRackState: (state, title) => loadExternalRackState(state, title),
  onToast: (msg) => toast(msg),
  onStartAudio: () => startAudio(),
});

$('#btn-community-topbar')?.addEventListener('click', () => communityModal.open('leaderboard'));

// ───────────────────────── Audio -> Synth Track Analyzer ──
const audioAnalyzerModal = new AudioSynthAnalyzerModal({
  onToast: (msg) => toast(msg),
  onApplyBpm: (bpm) => setRackBpm(bpm),
});
$('#btn-analyzer-topbar')?.addEventListener('click', () => audioAnalyzerModal.open());
$('#btn-menu-track-analyzer')?.addEventListener('click', () => audioAnalyzerModal.open());

// ───────────────────────── ManualModal ─────────────────────────
const manualModal = new ManualModal({
  getCurrentState: () => engine.getState(),
  onLoadRackState: (state, title) => {
    loadExternalRackState(state, title || state?.name || 'Example Rack');
  },
  onToast: (msg) => toast(msg),
  onStartAudio: () => startAudio(),
});

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
  onLoadRackState: (state, title) => loadExternalRackState(state, title || state?.name || 'Tutorial Patch'),
  onOpenManual: () => manualModal.open(),
});

const snapshotSystem = new SnapshotSystem(engine, {
  onToast: (msg) => toast(msg),
  onModified: changed,
  onSlotTrigger: (slotNum) => {
    scope.onArrangementSlot(slotNum);
  },
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

const workspace = new StudioWorkspace({
  viewportEl: $('#rack-workspace'),
  worldEl: $('#workspace-world'),
  engine,
  patchBay,
  onToast: (msg) => toast(msg),
  onModified: () => changed(),
  onSelectModule: (id) => selectModule(id),
  onAddModuleAt: (type, pos) => addModule(type, pos),
});
engine.workspace = workspace;

$('#btn-boards-gallery')?.addEventListener('click', () => { infoSystem.openGuide('tab-boards'); applyTranslations(document); });
$('#btn-tutorials')?.addEventListener('click', () => { infoSystem.openGuide('tab-tutorials'); applyTranslations(document); });
$('#btn-guide')?.addEventListener('click', () => { manualModal.open(); applyTranslations(document.getElementById('manual-modal')); });
$('#btn-lang-toggle')?.addEventListener('click', () => {
  setLang(getLang() === 'de' ? 'en' : 'de');
});
$('#btn-lang-menu')?.addEventListener('click', () => {
  setLang(getLang() === 'de' ? 'en' : 'de');
});
$('#btn-overview-menu')?.addEventListener('click', () => {
  $('#btn-studio-overview')?.click();
});
$('#btn-scope-menu')?.addEventListener('click', () => {
  const isHidden = scopePopout?.classList.contains('hidden');
  setScopePopoutOpen(Boolean(isHidden));
});

onLangChange(() => {
  renderLibrary();
  populateBoards();
  renderRack();
  updateStatus();
  snapshotSystem?.updateVisuals();
  focusDock?.render?.();
  if (eurorackUI) {
    eurorackUI.render();
    eurorackUI.renderCabinet?.();
    eurorackUI.syncAllUI?.();
  }
  applyTranslations(document);
});
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
      const matchTitle = (M.title || '').toLowerCase().includes(q) || tr(M.title || '').toLowerCase().includes(q);
      const matchDesc = (M.description || '').toLowerCase().includes(q) || tr(M.description || '').toLowerCase().includes(q);
      const matchType = (M.type || '').toLowerCase().includes(q);
      if (!matchTitle && !matchDesc && !matchType) return false;
    }
    return true;
  });

  if (!filtered.length) {
    listEl.innerHTML = `<div class="lib-no-results" style="padding:16px;text-align:center;color:#64748b;font-size:0.8rem;">${t(`Keine Module für „${esc(libSearchQuery)}“ gefunden.`, `No modules found for "${esc(libSearchQuery)}".`)}</div>`;
    return;
  }

  listEl.innerHTML = filtered.map((M) => {
    const modTitle = tr(M.title);
    const modDesc = tr(M.description);
    const addHint = t(`${modTitle} zum Rack hinzufügen`, `Add ${modTitle} to rack`);
    return `
    <div class="lib-studio-row" draggable="true" data-type="${M.type}" style="--row-col:${M.color}" title="${esc(modDesc)}">
      <span class="lib-row-icon">${getModuleIcon(M.type)}</span>
      <div class="lib-row-info">
        <span class="lib-row-title">${esc(modTitle)}</span>
        <span class="lib-row-desc">${esc(modDesc)}</span>
      </div>
      <button class="lib-row-add-btn" title="${esc(addHint)}">＋</button>
    </div>
  `;
  }).join('');

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

function addModule(type, posOrIndex = -1) {
  const isPos = posOrIndex && typeof posOrIndex === 'object' && posOrIndex.x !== undefined;
  const initData = isPos ? { pos: { x: posOrIndex.x, y: posOrIndex.y } } : {};
  const idx = isPos ? -1 : (typeof posOrIndex === 'number' ? posOrIndex : -1);
  const mod = engine.add(type, initData, idx);
  if (!mod) return;
  if (isPos) {
    mod.pos = { x: posOrIndex.x, y: posOrIndex.y };
  }
  renderRack(mod.id);
  selectModule(mod.id);
  changed();
  toast(`${mod.meta.title} hinzugefügt`);
}

// ───────────────────────── Rack Rendering & Workspace Integration ──
function renderRack(highlightId) {
  // Live-Positionen vor dem Neuaufbau auf die Module zurückschreiben
  workspace?.cards?.forEach((c) => {
    if (c.mod) c.mod.pos = { x: Math.round(c.x), y: Math.round(c.y) };
  });

  patchBay?.clearJacks();
  workspace?.clear();
  cardVisibilityObserver?.disconnect();

  const countControls = $('#count-controls');
  const countSources = $('#count-sources');
  const countEffects = $('#count-effects');

  if (countControls) countControls.textContent = String(engine.controls.length);
  if (countSources) countSources.textContent = String(engine.sources.length);
  if (countEffects) countEffects.textContent = String(engine.effects.length);

  const allMods = [...engine.controls, ...engine.sources, ...engine.effects];

  allMods.forEach((m, i) => {
    const fxIdx = m.meta?.category === 'effect' ? engine.effects.indexOf(m) : i;
    const card = createCard(m, fxIdx);
    workspace?.registerCard(m, card, m.pos);
    if (cardVisibilityObserver && canvasModuleTypes.has(m.meta?.type)) {
      cardVisibilityObserver.observe(card);
    }
  });

  if (workspace?.hasOverlappingCards?.()) {
    workspace.rearrangeAuto(false);
  }

  // Modulauswahl wiederherstellen oder erstes Modul wählen
  if (highlightId) {
    selectModule(highlightId);
    const card = document.querySelector(`.module-card[data-id="${highlightId}"]`);
    if (card) {
      card.classList.add('just-added');
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
    patchBay?.syncPatchedClasses?.();
    patchBay?.requestDraw?.();
  }, 25);

  snapshotSystem?.updateVisuals();
  focusDock?.updateRackBadges();
  updateStatus();
  syncTransportBpm();
  applyTranslations(document);
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

  const subTitle = isFx ? `FX ${index + 1}` : isCtrl ? t('Steuerung', 'Control') : t('Stimme', 'Voice');

  card.innerHTML = `
    <header class="mod-head" title="${t('Modul anfassen zum Verschieben · Doppelklick: Ein-/ausklappen', 'Drag module to move · Double-click: collapse/expand')}">
      <span class="mod-grip" title="${t('Modul anfassen zum Verschieben', 'Drag module to move')}">${ICONS.grip}</span>
      <span class="mod-icon">${getModuleIcon(M.type)}</span>
      <div class="mod-titles">
        <h3>${esc(M.title)}</h3>
        <small>${subTitle}</small>
      </div>
      <div class="mod-actions">
        ${isFx ? `<button class="icon-btn mv-left" title="${t('Nach links', 'Move left')}" ${index === 0 ? 'disabled' : ''}>◀</button>
                  <button class="icon-btn mv-right" title="${t('Nach rechts', 'Move right')}" ${index === engine.effects.length - 1 ? 'disabled' : ''}>▶</button>` : ''}
        <button class="icon-btn mod-min-btn" title="${mod.collapsed ? t('Modul vergrößern', 'Expand module') : t('Modul minimieren', 'Collapse module')}">${mod.collapsed ? '▢' : '―'}</button>
        <button class="icon-btn mod-info-btn" title="${t('Modul-Info & Handbuch', 'Module Info & Manual')}">?</button>
        <button class="icon-btn power" title="${isFx ? 'Bypass' : t('An / Aus', 'On / Off')}"><span class="pled"></span></button>
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
    if (p.hiddenUi) return;
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
      const val = mod.values[p.id];
      if (val !== undefined) {
        knob.setValue(val);
        valEl.textContent = fmt(p, val);
        focusDock.syncFromRack(mod.id, p.id, val);
      }
    });
    card.querySelectorAll('select[data-opt]').forEach((sel) => {
      if (mod.values[sel.dataset.opt] !== undefined) {
        sel.value = String(mod.values[sel.dataset.opt]);
      }
    });
    card.querySelectorAll('.strip-slider').forEach((slider) => {
      const type = slider.dataset.strip;
      const valEl = card.querySelector(`.strip-val[data-val="${type}"]`);
      if (type === 'pan') {
        const v = mod.chPan ?? 0;
        slider.value = String(v);
        if (valEl) valEl.textContent = Math.abs(v) < 0.01 ? 'C' : v < 0 ? `${Math.round(Math.abs(v) * 100)}L` : `${Math.round(v * 100)}R`;
      } else if (type === 'delay') {
        const v = mod.chDelay ?? 0;
        slider.value = String(v);
        if (valEl) valEl.textContent = `${Math.round(v * 100)}%`;
      } else if (type === 'reverb') {
        const v = mod.chReverb ?? 0;
        slider.value = String(v);
        if (valEl) valEl.textContent = `${Math.round(v * 100)}%`;
      }
    });
    card.classList.toggle('is-off', !mod.enabled);
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
    const curIdx = engine.effects.indexOf(mod);
    if (curIdx > 0) engine.moveEffect(mod.id, curIdx - 1);
    renderRack();
    changed();
  });
  card.querySelector('.mv-right')?.addEventListener('click', () => {
    const curIdx = engine.effects.indexOf(mod);
    if (curIdx >= 0 && curIdx < engine.effects.length - 1) engine.moveEffect(mod.id, curIdx + 1);
    renderRack();
    changed();
  });

  return card;
}

function removeModule(modId) {
  const card = document.querySelector(`.module-card[data-id="${modId}"]`);
  card?.classList.add('removing');
  focusDock?.onModuleRemoved(modId);
  patchBay.unregisterModuleJacks(modId);
  setTimeout(() => {
    // Live-Positionen aller verbleibenden Module bewahren
    workspace?.cards?.forEach((c) => {
      if (c.mod) c.mod.pos = { x: Math.round(c.x), y: Math.round(c.y) };
    });

    engine.remove(modId);
    workspace?.unregisterCard(modId);

    const countControls = $('#count-controls');
    const countSources = $('#count-sources');
    const countEffects = $('#count-effects');
    if (countControls) countControls.textContent = String(engine.controls.length);
    if (countSources) countSources.textContent = String(engine.sources.length);
    if (countEffects) countEffects.textContent = String(engine.effects.length);

    engine.effects.forEach((fx, idx) => {
      const fxCard = workspace?.cards?.get(fx.id)?.el || fx.cardEl;
      if (!fxCard) return;
      const sub = fxCard.querySelector('.mod-titles small');
      if (sub) sub.textContent = `FX ${idx + 1}`;
      const mvL = fxCard.querySelector('.mv-left');
      const mvR = fxCard.querySelector('.mv-right');
      if (mvL) mvL.disabled = idx === 0;
      if (mvR) mvR.disabled = idx === engine.effects.length - 1;
    });

    const allMods = [...engine.controls, ...engine.sources, ...engine.effects];
    if (selectedModuleId === modId) {
      selectedModuleId = allMods.length ? allMods[0].id : null;
    }
    selectModule(selectedModuleId);

    patchBay?.syncPatchedClasses?.();
    patchBay?.requestDraw?.();
    snapshotSystem?.updateVisuals();
    focusDock?.updateRackBadges();
    updateStatus();
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
    options.push(`<option value="new:" selected>${esc(t('Neues Board (ungespeichert)', 'New Board (unsaved)'))}</option>`);
  }

  options.push(`<optgroup label="${esc(t('Meine Patches', 'My Patches'))}">${mine.length ? mine.map((n) => `<option value="my:${esc(n)}">${esc(tr(n))}</option>`).join('') : `<option disabled>${esc(t('– noch keine gespeichert –', '– none saved yet –'))}</option>`}</optgroup>`);

  options.push(`<optgroup label="${esc(t('Studio-Vorlagen', 'Studio Templates'))}">${Object.entries(TEMPLATES).map(([k, tpl]) => `<option value="tpl:${k}">${esc(tr(tpl.name))}</option>`).join('')}</optgroup>`);

  if (mine.length > 0) {
    options.push(`<option value="action:clear_all">${esc(t('Speicher komplett leeren (alle Boards löschen)...', 'Clear storage (delete all boards)...'))}</option>`);
  }

  sel.innerHTML = options.join('');

  const targetVal = current.kind === 'new' ? 'new:' : `${current.kind}:${current.key}`;
  const exists = Array.from(sel.options).some((o) => o.value === targetVal);

  if (!exists && targetVal) {
    // Falls Key z. B. durch Autosave oder Import noch nicht existiert, dynamisch hinzufügen damit Dropdown nie leer ist
    const fallbackLabel = tr(current.key) || (current.kind === 'new' ? t('Neues Board (ungespeichert)', 'New Board (unsaved)') : t('Aktueller Patch', 'Current Patch'));
    const customOpt = document.createElement('option');
    customOpt.value = targetVal;
    customOpt.textContent = fallbackLabel;
    customOpt.selected = true;
    sel.prepend(customOpt);
  } else {
    sel.value = targetVal;
  }

  const activeLabel = sel.selectedOptions[0]?.textContent || (tr(current.key) || t('Patch wählen', 'Select Patch'));
  const wrap = $('.patch-selector-wrap');
  if (wrap) wrap.title = t(`Aktiver Patch: ${activeLabel} (Klicken zum Wechseln)`, `Active patch: ${activeLabel} (Click to switch)`);

  const btnDelete = $('#btn-delete');
  if (btnDelete) {
    btnDelete.disabled = current.kind !== 'my' && mine.length === 0;
    btnDelete.title = current.kind === 'my'
      ? t(`Board „${current.key}“ löschen`, `Delete board "${current.key}"`)
      : mine.length > 0
        ? t('Gespeicherte Boards löschen', 'Delete saved boards')
        : t('Speicher leeren', 'Clear storage');
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
  const boardName = kind === 'tpl' ? (TEMPLATES[key]?.name || key) : key;
  focusDock?.clear();
  const cloned = structuredClone(state);
  normalizePatchState(cloned);
  engine.load(cloned, boardName);
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
  return !dirty || confirm(t('Ungespeicherte Änderungen am aktuellen Board verwerfen?', 'Discard unsaved changes to the current board?'));
}

function clearEntireStorage() {
  if (confirm(t('Möchtest du wirklich deinen Speicher komplett leeren und alle gespeicherten Boards entfernen?', 'Do you really want to clear all storage and delete all saved boards?'))) {
    storeBoards({});
    try { localStorage.removeItem(LS_AUTO); } catch { /* ignore */ }
    toast(t('Speicher bereinigt: Alle Boards gelöscht', 'Storage cleared: all boards deleted'));
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
  const suggestion = current.kind === 'my'
    ? `${current.key} ${t('(Kopie)', '(Copy)')}`
    : current.kind === 'tpl'
      ? `${t('Mein', 'My')} ${TEMPLATES[current.key]?.name?.replace(/^\S+\s/, '') || 'Board'}`
      : t('Mein Board', 'My Board');
  const name = prompt(t('Name für dein Board:', 'Name for your board:'), suggestion)?.trim();
  if (!name) return;
  if (boards[name] && !confirm(t(`„${name}“ existiert schon. Überschreiben?`, `"${name}" already exists. Overwrite?`))) return;
  engine.boardName = name;
  boards[name] = { ...engine.getState(), version: 2, name };
  storeBoards(boards);
  current = { kind: 'my', key: name };
  populateBoards();
  setDirty(false);
  toast(t(`„${name}“ gespeichert`, `"${name}" saved`));
}

$('#btn-save')?.addEventListener('click', () => {
  if (current.kind !== 'my') return saveAs();
  const boards = loadBoards();
  engine.boardName = current.key;
  boards[current.key] = { ...engine.getState(), version: 2, name: current.key };
  storeBoards(boards);
  setDirty(false);
  toast(t(`„${current.key}“ gespeichert`, `"${current.key}" saved`));
});

$('#btn-save-as')?.addEventListener('click', saveAs);

$('#btn-new')?.addEventListener('click', () => {
  if (!confirmDiscard()) return;
  const name = t('Neues Board', 'New Board');
  engine.load({ version: 2, name, master: engine.masterValue, modules: [], cables: [] }, name);
  current = { kind: 'new', key: '' };
  renderRack();
  populateBoards();
  setDirty(false);
  toast(t('Leeres Board – füge links Module hinzu', 'Blank board – add modules from the left library'));
});

$('#btn-delete')?.addEventListener('click', (e) => {
  const boards = loadBoards();
  if (e.shiftKey || current.kind !== 'my') {
    clearEntireStorage();
    return;
  }
  if (confirm(t(`Möchtest du das Board „${current.key}“ löschen?`, `Delete board "${current.key}"?`))) {
    delete boards[current.key];
    storeBoards(boards);
    toast(t(`Board „${current.key}“ gelöscht`, `Board "${current.key}" deleted`));
    loadBoard('tpl', 'empty');
  }
});

$('#btn-export')?.addEventListener('click', () => {
  const name = current.kind === 'my'
    ? current.key
    : current.kind === 'tpl'
      ? (TEMPLATES[current.key]?.name || 'Board')
      : (engine.boardName || t('Neues Board', 'New Board'));
  const state = { ...engine.getState(), version: 2, name };
  const blob = new Blob([JSON.stringify({ version: 2, name, state }, null, 2)], { type: 'application/json' });
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
    const sizeCheck = validateFileSize(file.size, MAX_IMPORT_BYTES);
    if (!sizeCheck.ok) throw new Error(sizeCheck.error);

    const rawText = await file.text();
    let data;
    try {
      data = JSON.parse(rawText);
    } catch {
      throw new Error(t('Ungültiges JSON-Format.', 'Invalid JSON format.'));
    }

    const fallbackName = file.name.replace(/\.[^.]+$/, '').trim() || t('Importiertes Board', 'Imported Board');
    const validated = validateAndSanitizePatchState(data, { fallbackName });
    if (!validated.ok) throw new Error(validated.error);

    const state = validated.state;
    normalizePatchState(state);

    if (!confirmDiscard()) return;

    const boards = loadBoards();
    const baseName = validated.name;
    let name = baseName;
    if (boards[name]) {
      let counter = 2;
      while (boards[`${baseName} (${counter})`]) counter++;
      name = `${baseName} (${counter})`;
    }
    boards[name] = { ...state, version: 2, name };
    storeBoards(boards);
    loadBoard('my', name);
    toast(t(`„${name}“ importiert`, `"${name}" imported`));
  } catch (err) {
    toast(`${t('Import fehlgeschlagen', 'Import failed')}: ${err.message}`);
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
let currentZoom = 0.85;
try {
  const savedZoom = parseFloat(localStorage.getItem(LS_ZOOM));
  if (!isNaN(savedZoom) && savedZoom >= 0.25 && savedZoom <= 2.4) currentZoom = savedZoom;
} catch { /* ignore */ }

const rackWorkspaceEl = document.getElementById('rack-workspace');

function applyZoom(level, notify = false) {
  if (workspace) {
    workspace.zoom = Math.max(workspace.minZoom, Math.min(workspace.maxZoom, Math.round(level * 100) / 100));
    workspace.updateWorldTransform();
    currentZoom = workspace.zoom;
  } else {
    currentZoom = Math.max(0.25, Math.min(2.4, Math.round(level * 100) / 100));
  }
  const valEl = document.getElementById('zoom-val');
  if (valEl) valEl.textContent = `${Math.round(currentZoom * 100)}%`;
  try { localStorage.setItem(LS_ZOOM, currentZoom); } catch { /* ignore */ }
  patchBay?.requestDraw?.();
  if (notify) toast(`Zoom: ${Math.round(currentZoom * 100)}%`);
}

function fitZoomToScreen(notify = true) {
  if (activeMainView === 'eurorack') {
    eurorackUI?.fitToScreen?.();
    return;
  }
  workspace?.fitAll(true);
  if (notify) toast('Studio-Übersicht: Alles im Blick');
}

$('#btn-zoom-out')?.addEventListener('click', () => workspace?.zoomRelative(-0.15));
$('#btn-zoom-in')?.addEventListener('click', () => workspace?.zoomRelative(0.15));
$('#btn-zoom-reset')?.addEventListener('click', () => workspace?.resetZoom());
$('#btn-zoom-fit')?.addEventListener('click', () => fitZoomToScreen(true));
$('#btn-studio-overview')?.addEventListener('click', () => fitZoomToScreen(true));
$('#btn-overview')?.addEventListener('click', () => fitZoomToScreen(true));
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
    if (e.key.toLowerCase() === 'e') {
      e.preventDefault();
      switchMainView(activeMainView === 'eurorack' ? 'studio' : 'eurorack');
      return;
    }
    if (e.key.toLowerCase() === 'f' || e.key.toLowerCase() === 'o') {
      e.preventDefault();
      fitZoomToScreen(true);
      return;
    }
    if (e.key.toLowerCase() === 'z') {
      e.preventDefault();
      workspace?.focusSelected();
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
function normalizePatchState(state) {
  if (!state || !Array.isArray(state.modules)) return state;
  for (const mod of state.modules) {
    if (mod.type === 'chord_glide') {
      mod.values = mod.values || {};
      mod.extra = mod.extra || {};

      if (mod.values.filter !== undefined) {
        mod.values.cutoff = Number(mod.values.filter);
        delete mod.values.filter;
      }

      if (Array.isArray(mod.extra.steps) && mod.extra.steps.length === 4) {
        const s = mod.extra.steps;
        const isTargetProg =
          s[0]?.root === 9 && s[0]?.type === 'm7' &&
          s[1]?.root === 5 && s[1]?.type === 'maj7' &&
          s[2]?.root === 0 && s[2]?.type === 'maj7' &&
          s[3]?.root === 7 && (s[3]?.type === 'add9' || s[3]?.type === 'sus4');

        if (isTargetProg) {
          s.forEach((step) => { step.bars = 2; });
          mod.values.cutoff = 1500;
          mod.values.voiceLeading = 1;
          mod.extra.voiceLeading = 1;
        }
      }
    }
  }

  // Kabel bereinigen: Keine Duplikate auf denselben Eingang zulassen (erstes definiertes Kabel hat Vorrang)
  if (Array.isArray(state.cables)) {
    const occupiedInputs = new Set();
    state.cables = state.cables.filter((c) => {
      if (!c || !c.from || !c.to) return false;
      const toKey = String(c.to).trim().toLowerCase();
      if (occupiedInputs.has(toKey)) return false;
      occupiedInputs.add(toKey);
      return true;
    });
  }

  // Snapshots normalisieren & partielle Slot-Definitionen mit Basis-Modulwerten auffüllen
  if (state.snapshots && typeof state.snapshots === 'object' && state.snapshots.slots) {
    normalizeSnapshots(state);
  }

  return state;
}

function normalizeSnapshots(state) {
  const snaps = state.snapshots;
  if (!snaps || typeof snaps !== 'object' || !snaps.slots) return;

  // Basis-Abbild aller Module im Patch berechnen (Defaults aus MODULES + mod.values)
  const baseModules = state.modules.map((mod, idx) => {
    const def = MODULES[mod.type];
    const baseValues = {};
    def?.params?.forEach((p) => { baseValues[p.id] = p.value; });
    def?.options?.forEach((o) => { baseValues[o.id] = o.value; });
    Object.assign(baseValues, mod.values || {});

    const modId = mod.id || `mod_${idx + 1}`;
    return {
      id: modId,
      type: mod.type,
      title: def?.title || mod.type,
      values: baseValues,
      enabled: mod.enabled !== undefined ? Boolean(mod.enabled) : true,
      channelStrip: {
        chPan: mod.chPan ?? 0,
        chDelay: mod.chDelay ?? 0,
        chReverb: mod.chReverb ?? 0,
        chLevel: mod.chLevel ?? 0.8,
      },
      extra: mod.extra ? structuredClone(mod.extra) : null,
      paramIds: new Set([
        ...(def?.params?.map((p) => p.id) || []),
        ...(def?.options?.map((o) => o.id) || []),
      ]),
    };
  });

  const normalizedSlots = { 1: null, 2: null, 3: null, 4: null, 5: null };
  const stripKeys = new Set(['chPan', 'chDelay', 'chReverb', 'chLevel', 'pan', 'delay', 'reverb']);
  const metaKeys = new Set(['type', 'title', 'enabled', 'channelStrip', 'extra', 'values']);

  for (const slotKey of ['1', '2', '3', '4', '5']) {
    const rawSlot = snaps.slots[slotKey] ?? snaps.slots[Number(slotKey)] ?? null;
    if (!rawSlot || typeof rawSlot !== 'object') {
      normalizedSlots[slotKey] = null;
      continue;
    }

    const rawMap = rawSlot.snapshot || rawSlot.values || rawSlot.modules || rawSlot;
    if (!rawMap || typeof rawMap !== 'object') {
      normalizedSlots[slotKey] = null;
      continue;
    }

    const rawKeys = Object.keys(rawMap);
    const fullSnapshot = {};

    for (const base of baseModules) {
      // Override per exakter ID, case-insensitiver ID oder Modul-Type finden
      let override = rawMap[base.id];
      if (!override) {
        const lowerId = base.id.toLowerCase();
        const matchedKey = rawKeys.find((k) => k.toLowerCase() === lowerId);
        if (matchedKey) override = rawMap[matchedKey];
      }
      if (!override && rawMap[base.type]) {
        override = rawMap[base.type];
      }

      const mergedValues = { ...base.values };
      const mergedStrip = { ...base.channelStrip };
      let mergedEnabled = base.enabled;
      let mergedExtra = base.extra ? structuredClone(base.extra) : null;

      if (override && typeof override === 'object') {
        if (typeof override.enabled === 'boolean') {
          mergedEnabled = override.enabled;
        }
        if (override.channelStrip && typeof override.channelStrip === 'object') {
          Object.assign(mergedStrip, override.channelStrip);
        }
        if (override.extra && typeof override.extra === 'object') {
          mergedExtra = structuredClone(override.extra);
        }

        const paramSource = (override.values && typeof override.values === 'object')
          ? override.values
          : override;

        for (const [k, v] of Object.entries(paramSource)) {
          if (metaKeys.has(k)) continue;
          if (stripKeys.has(k) && !base.paramIds.has(k)) {
            if (k === 'pan' || k === 'chPan') mergedStrip.chPan = Number(v);
            else if (k === 'delay' || k === 'chDelay') mergedStrip.chDelay = Number(v);
            else if (k === 'reverb' || k === 'chReverb') mergedStrip.chReverb = Number(v);
            else if (k === 'chLevel') mergedStrip.chLevel = Number(v);
          } else {
            mergedValues[k] = v;
          }
        }
      }

      fullSnapshot[base.id] = {
        type: base.type,
        title: base.title,
        values: mergedValues,
        enabled: mergedEnabled,
        channelStrip: mergedStrip,
        extra: mergedExtra,
      };
    }

    normalizedSlots[slotKey] = {
      savedAt: rawSlot.savedAt || Date.now(),
      moduleCount: Object.keys(fullSnapshot).length,
      filter: rawSlot.filter || 'all',
      snapshot: fullSnapshot,
    };
    if (rawSlot.name || rawSlot.label) {
      normalizedSlots[slotKey].name = rawSlot.name || rawSlot.label;
    }
  }

  snaps.slots = normalizedSlots;
  const parsedActive = Number(snaps.activeSlot);
  snaps.activeSlot = (parsedActive >= 1 && parsedActive <= 5) ? parsedActive : null;
  const parsedSpeed = Number(snaps.currentSpeed);
  snaps.currentSpeed = (parsedSpeed === 6 || parsedSpeed === 7 || parsedSpeed === 8) ? parsedSpeed : 7;
}

// ── Virtuelles Eurorack („Distant Lights“) & Hauptnavigation (Top-Level) ──
const LS_ACTIVE_VIEW = 'synthboard:active_main_view';
let eurorackUI = null;
let activeMainView = 'studio';

function ensureEurorackUI() {
  const eurorackHost = $('#eurorack-view');
  if (!eurorackHost) return null;
  if (!eurorackUI) {
    try {
      eurorackUI = new EurorackUI(eurorackHost, engine.ctx, engine.masterGain, {
        toast,
        ensureAudio: startAudio,
      });
    } catch (err) {
      console.error('Fehler bei EurorackUI-Initialisierung:', err);
    }
  }
  return eurorackUI;
}

function switchMainView(view) {
  try {
    activeMainView = view === 'eurorack' ? 'eurorack' : 'studio';
    const isEuro = activeMainView === 'eurorack';
    const eurorackHost = $('#eurorack-view');
    const ws = $('#workspace');
    const pc = $('#patch-canvas');

    try { localStorage.setItem(LS_ACTIVE_VIEW, activeMainView); } catch { /* ignore */ }
    if (window.history?.replaceState) {
      const targetHash = isEuro ? '#eurorack' : '';
      if (window.location.hash !== targetHash) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search + targetHash);
      }
    }

    if (isEuro) {
      ensureEurorackUI();
    }

    window.scrollTo(0, 0);
    document.body.classList.toggle('view-eurorack', isEuro);

    $('#btn-nav-studio')?.classList.toggle('active', !isEuro);
    $('#btn-nav-eurorack')?.classList.toggle('active', isEuro);

    if (ws) {
      ws.classList.toggle('hidden', isEuro);
      ws.style.display = isEuro ? 'none' : '';
    }
    if (pc) {
      pc.classList.toggle('hidden', isEuro);
      pc.style.display = isEuro ? 'none' : '';
    }
    if (eurorackHost) {
      eurorackHost.classList.toggle('hidden', !isEuro);
      eurorackHost.style.display = isEuro ? 'flex' : 'none';
    }

    // Offene Dropdown-Menüs schließen
    document.querySelectorAll('.menu-item.is-open').forEach((m) => m.classList.remove('is-open'));

    // Doppelte Audioausgabe verhindern, ohne den AudioContext oder das Rack neu zu starten
    try { engine.setStudioActive(!isEuro); } catch { /* ignore */ }
    try { eurorackUI?.setActiveView(isEuro); } catch (e) { console.warn(e); }

    if (!isEuro) {
      requestAnimationFrame(() => patchBay?.draw());
    } else {
      requestAnimationFrame(() => eurorackUI?.drawCables());
    }
  } catch (err) {
    console.error('Fehler beim Ansichtswechsel:', err);
  }
}

// Navigation & DAW-Menüleiste sofort und ausfallsicher binden
$('#btn-nav-studio')?.addEventListener('click', () => switchMainView('studio'));
$('#btn-nav-eurorack')?.addEventListener('click', () => switchMainView('eurorack'));
$('#btn-menu-eurorack')?.addEventListener('click', () => switchMainView('eurorack'));
$('#btn-menu-studio')?.addEventListener('click', () => switchMainView('studio'));

// DAW-Dropdown-Menüs stabil machen (bleiben bei Hover & Klick zuverlässig offen, schließen erst mit Verzögerung)
document.querySelectorAll('.daw-menubar .menu-item').forEach((item) => {
  let closeTimer = null;
  const openMenu = () => {
    clearTimeout(closeTimer);
    document.querySelectorAll('.daw-menubar .menu-item').forEach((other) => {
      if (other !== item) other.classList.remove('is-open');
    });
    item.classList.add('is-open');
  };
  const scheduleClose = () => {
    clearTimeout(closeTimer);
    closeTimer = setTimeout(() => {
      if (!item.dataset.pinned) {
        item.classList.remove('is-open');
      }
    }, 320);
  };

  item.addEventListener('mouseenter', openMenu);
  item.addEventListener('mouseleave', scheduleClose);

  const btn = item.querySelector('.menu-btn');
  btn?.addEventListener('click', (e) => {
    e.stopPropagation();
    clearTimeout(closeTimer);
    const wasPinned = item.dataset.pinned === '1';
    document.querySelectorAll('.daw-menubar .menu-item').forEach((other) => {
      delete other.dataset.pinned;
      other.classList.remove('is-open');
    });
    if (!wasPinned) {
      item.dataset.pinned = '1';
      item.classList.add('is-open');
    }
  });

  item.querySelectorAll('.menu-action').forEach((act) => {
    act.addEventListener('click', () => {
      clearTimeout(closeTimer);
      delete item.dataset.pinned;
      item.classList.remove('is-open');
    });
  });
});

document.addEventListener('click', (e) => {
  if (!e.target.closest('.daw-menubar')) {
    document.querySelectorAll('.daw-menubar .menu-item').forEach((item) => {
      delete item.dataset.pinned;
      item.classList.remove('is-open');
    });
  }
});

function boot() {
  // Einmalige automatische Bereinigung alter Import-Ketten & Reset auf sauberes System
  if (!localStorage.getItem(LS_PURGE_KEY)) {
    try {
      localStorage.removeItem(LS_BOARDS);
      localStorage.removeItem(LS_AUTO);
      localStorage.setItem(LS_PURGE_KEY, '1');
    } catch { /* ignore */ }
  }

  // Gespeicherte Boards in localStorage normalisieren (2 Takte, 1,5 kHz, Stimmführung aktiv)
  try {
    const savedBoards = loadBoards();
    let boardsUpdated = false;
    for (const [k, bState] of Object.entries(savedBoards)) {
      if (bState?.modules) {
        normalizePatchState(bState);
        boardsUpdated = true;
      }
    }
    if (boardsUpdated) storeBoards(savedBoards);
  } catch { /* ignore */ }

  renderLibrary();
  setupDropZones();

  let auto = null;
  try { auto = JSON.parse(localStorage.getItem(LS_AUTO)); } catch { /* ignore */ }

  if (auto?.state?.modules) {
    normalizePatchState(auto.state);
    engine.load(auto.state);
    masterKnob.setValue(engine.masterValue);
    current = auto.current || { kind: 'tpl', key: 'empty' };
    if (current.kind === 'my' && !loadBoards()[current.key]) current = { kind: 'new', key: '' };
    renderRack();
    populateBoards();
    setDirty(!!auto.dirty);
    // Aktualisierten Zustand zurückschreiben, damit Export & Reload konsistent sind
    try {
      localStorage.setItem(LS_AUTO, JSON.stringify({ state: engine.getState(), current, dirty: !!auto.dirty }));
      if (current.kind === 'my' && current.key) {
        const b = loadBoards();
        if (b[current.key]) {
          b[current.key] = engine.getState();
          storeBoards(b);
        }
      }
    } catch { /* ignore */ }
  } else {
    // Erster Start: „Start Here“-Lernpatch laden für sofortigen Einstieg
    loadBoard('tpl', 'start_here');
    toast(t('Start Here geladen · Klicke irgendwo oder auf AN für Audio (Space: Start/Stop, MASTER rechts)', 'Start Here loaded · Click anywhere or ON for audio (Space: Start/Stop, MASTER right)'));
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

  // EurorackUI vorab initialisieren & zuletzt geöffnete Ansicht (Eurorack oder Studio) wiederherstellen
  const ui = ensureEurorackUI();
  applyTranslations(document);
  let savedView = 'studio';
  try {
    if (window.location?.hash === '#eurorack' || localStorage.getItem(LS_ACTIVE_VIEW) === 'eurorack') {
      savedView = 'eurorack';
    }
  } catch { /* ignore */ }

  if (savedView === 'eurorack') {
    switchMainView('eurorack');
  } else {
    ui?.setActiveView(false);
  }

  // Geteilten Patch aus URL-Hash (#p=...) laden, falls vorhanden
  if (window.location?.hash?.startsWith('#p=')) {
    decodePatchFromHash(window.location.hash)
      .then((payload) => {
        if (payload?.state && loadExternalRackState(payload.state, payload.name || 'Shared Rack')) {
          toast(`${t('Geteiltes Rack geladen', 'Shared rack loaded')}: ${payload.name || 'Shared Rack'}`);
        }
      })
      .catch(() => {});
  }
}

boot();
