// SYNTHBOARD · Eurorack – Benutzeroberfläche (Spielbereiter Modularsynthesizer, Tastatur-Spiel, freies Patchen)
import { EurorackEngine, MACROS, MACRO_KEYS } from './engine.js';
import { SIGNAL_COLORS, clamp, dbToGain } from './modules.js';
import { buildDistantLights, buildStandardPatch, buildEmptyPatch } from './distantLights.js';
import { Knob } from '../ui/Knob.js';
import { t } from '../ui/i18n.js';

const LS_EURORACK_KEY = 'synthboard:eurorack:custom_patch_v2';
const NOTE_NAMES_DE = ['C', 'Cis', 'D', 'Dis', 'E', 'F', 'Fis', 'G', 'Gis', 'A', 'B', 'H'];

export function midiToNameDe(midi) {
  const m = Math.round(midi);
  const name = NOTE_NAMES_DE[((m % 12) + 12) % 12];
  const oct = Math.floor(m / 12) - 1;
  return `${name}${oct}`;
}

function fmtParam(p, v) {
  if (p.choices) {
    const hit = p.choices.find((c) => Math.abs(c[0] - v) < 0.01);
    if (hit) return hit[1];
  }
  switch (p.fmt) {
    case 'pct': return `${Math.round(v * 100)} %`;
    case 'hz': return v >= 1000 ? `${(v / 1000).toFixed(2)} kHz` : `${Math.round(v)} Hz`;
    case 's': return v < 0.1 ? `${Math.round(v * 1000)} ms` : `${v.toFixed(1)} s`;
    case 'cents': return `${v.toFixed(1)} ct`;
    case 'dbl': return v <= -59.5 ? '−∞ dB' : `${v > 0 ? '+' : ''}${v.toFixed(1)} dB`;
    case 'st': return `${v > 0 ? '+' : ''}${Math.round(v)} HT`;
    case 'int': return `${Math.round(v)}`;
    default: return Number(v).toFixed(2);
  }
}

function fmtTime(sec) {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

export class EurorackUI {
  constructor(hostEl, sharedCtx, sharedDest, options = {}) {
    this.hostEl = hostEl;
    this.ctx = sharedCtx;
    this.sharedDest = sharedDest;
    this.toast = options.toast || (() => {});
    this.ensureAudio = options.ensureAudio || (() => this.ctx.resume());

    // Ausgangs-Gain für A/B-Umschaltung zwischen Synthese-Rack und Referenz-Audio
    this.rackMonitorGain = this.ctx.createGain();
    this.rackMonitorGain.gain.value = 1;
    this.refMonitorGain = this.ctx.createGain();
    this.refMonitorGain.gain.value = 0;
    this.refTrimGain = this.ctx.createGain();
    this.refTrimGain.gain.value = 0.85;

    // Analyser für Spektral-/Pegelvergleich (Rack vs. Referenz)
    this.rackAnalyser = this.ctx.createAnalyser();
    this.rackAnalyser.fftSize = 1024;
    this.rackAnalyser.smoothingTimeConstant = 0.82;
    this.refAnalyser = this.ctx.createAnalyser();
    this.refAnalyser.fftSize = 1024;
    this.refAnalyser.smoothingTimeConstant = 0.82;

    this.rackMonitorGain.connect(this.sharedDest);
    this.rackMonitorGain.connect(this.rackAnalyser);
    this.refTrimGain.connect(this.refMonitorGain);
    this.refMonitorGain.connect(this.sharedDest);
    this.refTrimGain.connect(this.refAnalyser);

    this.engine = new EurorackEngine(this.ctx, this.rackMonitorGain);

    // Referenz-Audio-Status
    this.abSource = 'rack'; // 'rack' | 'ref'
    this.refBuffer = null;
    this.refSourceNode = null;
    this.refPlaying = false;
    this.refLoop = true;
    this.refLoopStart = 0;
    this.refLoopEnd = 30;
    this.refFileName = 'Keine Referenz geladen';
    this.showRefPanel = false;
    this.showMacroMap = false;
    this.cablesVisible = true;
    this.isDroneOn = false;
    this.octaveOffset = 0;
    this.activeKeys = new Set();

    // Kabel-Interaktion
    this.pendingJack = null; // { modId, portId, dir, sig, el }
    this.mousePos = { x: 0, y: 0 };
    this.selectedCableId = null;
    this.editingChordIdx = 0;

    // Aufnahme-Status
    this.recorder = null;
    this.recChunks = [];
    this.isRecording = false;

    // UI-Referenzen
    this.paramKnobs = new Map(); // `${modId}:${paramId}` -> { knob, valEl, wrapEl }
    this.macroKnobs = new Map(); // key -> { knob, valEl, autoBtn }
    this.jackEls = new Map();    // `${modId}:${portId}` -> HTMLElement

    this.init();
  }

  init() {
    let initial = null;
    try {
      const raw = localStorage.getItem(LS_EURORACK_KEY);
      if (raw) initial = JSON.parse(raw);
    } catch { /* ignore */ }

    // Standard-Start ist ein spielbereiter, freier Eurorack-Patch (kein automatischer 4-Min-Zwang)
    if (!initial || initial.format !== 'synthboard-eurorack') {
      initial = buildStandardPatch();
    }
    const res = this.engine.loadState(initial);
    if (!res.ok) {
      this.engine.loadState(buildStandardPatch());
    }

    this.render();
    this.setupKeyboardPlaying();
    this.engine.onChange = (reason) => this.handleEngineChange(reason);
    this.engine.onEnded = () => {
      this.toast('Automatischer Ablauf abgeschlossen');
      this.syncTransportUI();
    };

    this.startVisualLoop();
  }

  persistLocal() {
    try {
      localStorage.setItem(LS_EURORACK_KEY, JSON.stringify(this.engine.getState()));
    } catch { /* ignore */ }
  }

  setActiveView(active) {
    this.isActiveView = active;
    const now = this.ctx.currentTime;
    if (active) {
      window.scrollTo(0, 0);
      const wantRack = this.abSource === 'rack';
      this.rackMonitorGain.gain.setTargetAtTime(wantRack ? 1 : 0, now, 0.025);
      this.refMonitorGain.gain.setTargetAtTime(wantRack ? 0 : 1, now, 0.025);
      requestAnimationFrame(() => this.drawCables());
    } else {
      window.scrollTo(0, 0);
      // Beim Verlassen der Eurorack-Ansicht Ausgang stummschalten, ohne Engine neu zu starten
      this.rackMonitorGain.gain.setTargetAtTime(0, now, 0.025);
      this.refMonitorGain.gain.setTargetAtTime(0, now, 0.025);
    }
  }

  // ───────────────────────────── Haupt-Rendering ──
  render() {
    this.hostEl.innerHTML = `
      <div class="er-shell" id="er-shell">
        <!-- Obere Werkzeug- und Transportleiste -->
        <header class="er-toolbar">
          <div class="er-toolbar-left">
            <div class="er-rack-badge">
              <span class="er-led" id="er-audio-led"></span>
              <div class="er-rack-titles">
                <span class="er-rack-eyebrow">VIRTUELLES EURORACK</span>
                <strong class="er-rack-name" id="er-rack-name">${this.engine.name}</strong>
              </div>
            </div>

            <button class="er-btn er-btn-audio" id="er-btn-audio" title="Browser-Audiofreigabe aktivieren">
              <span class="er-dot"></span>
              <span id="er-audio-txt">Audio aktivieren</span>
            </button>

            <div class="er-transport-group" role="group" aria-label="Eurorack Transport">
              <button class="er-btn er-btn-primary" id="er-btn-play" title="Wiedergabe starten">
                <svg viewBox="0 0 16 16" width="11" height="11" fill="currentColor"><path d="M3 2.5l10 5.5-10 5.5V2.5z"/></svg>
                <span>Play</span>
              </button>
              <button class="er-btn" id="er-btn-pause" title="Wiedergabe pausieren (Position bleibt erhalten)">
                <svg viewBox="0 0 16 16" width="11" height="11" fill="currentColor"><path d="M3.5 2.5h3v11h-3v-11zm6 0h3v11h-3v-11z"/></svg>
                <span>Pause</span>
              </button>
              <button class="er-btn" id="er-btn-stop" title="Stopp & zurück zum Anfang (Hall klingt aus)">
                <svg viewBox="0 0 16 16" width="11" height="11" fill="currentColor"><rect x="3" y="3" width="10" height="10" rx="1"/></svg>
                <span>Stop</span>
              </button>
            </div>

            <div class="er-patch-select-box" title="Patch-Auswahl: Standard-Patch, leeres Rack oder Vorlage">
              <span class="er-patch-lbl">PATCH:</span>
              <select id="er-patch-select" class="er-patch-select">
                <option value="standard" ${this.engine.name === 'Eurorack Standard' ? 'selected' : ''}>Standard-Patch (Spielbereit)</option>
                <option value="empty" ${this.engine.name.includes('Leeres') ? 'selected' : ''}>Leeres Rack (Tabula Rasa)</option>
                <option value="distant_lights" ${this.engine.name === 'Distant Lights' ? 'selected' : ''}>Distant Lights (Vorlage)</option>
              </select>
            </div>

            <div class="er-mode-switch" role="group" aria-label="Spielmodus">
              <button class="er-mode-btn ${this.engine.mode === 'manual' ? 'active' : ''}" data-mode="manual" id="er-mode-manual" title="Freies modulares Spielen & Schrauben ohne Automations-Zwang">
                Manuell
              </button>
              <button class="er-mode-btn ${this.engine.mode === 'auto' ? 'active' : ''}" data-mode="auto" id="er-mode-auto" title="4-minütiger automatischer Aufbau über 60 Takte">
                Auto (4:04)
              </button>
            </div>

            <button class="er-btn ${this.isDroneOn ? 'on' : ''}" id="er-btn-drone" title="Dauerton / Gate halten (zum direkten Einstellen und Sound-Schrauben)">
              <span>${this.isDroneOn ? 'Drone: EIN' : 'Drone: AUS'}</span>
            </button>

            <div class="er-bpm-box" title="Tempo in BPM">
              <span class="er-bpm-lbl">BPM</span>
              <input type="number" id="er-bpm-input" class="er-bpm-input" min="30" max="200" value="${this.engine.bpm}" />
            </div>

            <div class="er-vol-box" title="Eurorack Gesamtlautstärke (synchronisiert mit dem MIXER-Master)">
              <span class="er-vol-lbl">LAUTSTÄRKE</span>
              <input type="range" id="er-toolbar-vol" class="er-vol-slider" min="0" max="1" step="0.01" value="${this.engine.modules.get('mixer')?.values?.master ?? 0.8}" />
              <span class="er-vol-val" id="er-toolbar-vol-val">${Math.round((this.engine.modules.get('mixer')?.values?.master ?? 0.8) * 100)} %</span>
            </div>
          </div>

          <div class="er-toolbar-right">
            <button class="er-btn" id="er-btn-unpatch" title="Alle Patch-Kabel abziehen und Rack leeren">
              <span>Kabel abziehen</span>
            </button>
            <button class="er-btn" id="er-btn-ab-panel" title="Referenzvergleich (A/B) öffnen oder schließen">
              <span>A/B Vergleich</span>
            </button>
            <button class="er-btn er-btn-cables on" id="er-btn-cables" title="Patch-Kabel ein-/ausblenden">
              <span>Kabel</span>
            </button>
            <button class="er-btn" id="er-btn-reset" title="Standard-Patch wiederherstellen">
              <span>Reset</span>
            </button>
            <button class="er-btn" id="er-btn-save" title="Rack als JSON-Datei speichern">
              <span>Speichern</span>
            </button>
            <button class="er-btn" id="er-btn-load" title="Gespeichertes Rack aus JSON-Datei laden">
              <span>Laden</span>
            </button>
            <button class="er-btn er-btn-rec" id="er-btn-rec" title="Audioausgabe des Racks mitschneiden">
              <span class="er-rec-dot"></span>
              <span id="er-rec-txt">Aufnahme</span>
            </button>
            <input type="file" id="er-file-load" accept="application/json,.json" hidden />
          </div>
        </header>

        <!-- Zeitleiste / Ablauf & Aktiver Ton -->
        <section class="er-timeline-bar" aria-label="Musikalischer Ablauf">
          <div class="er-time-readout">
            <span class="er-time-clock" id="er-time-clock">${this.engine.mode === 'manual' ? 'FREIES SPIEL' : '00:00 / 04:04'}</span>
            <span class="er-time-bar" id="er-time-bar">${this.engine.mode === 'manual' ? 'Tastatur: [A–K] spielen · [X/C] Oktave' : 'Takt 1 / 60 · 4/4'}</span>
          </div>

          <div class="er-section-badge" id="er-section-badge">${this.engine.mode === 'manual' ? (this.isDroneOn ? 'Drone aktiv (Dauerton)' : 'Modus: Manuelles Spielen') : 'Abschnitt: Beginn'}</div>

          <div class="er-scrubber-wrap" id="er-scrubber-wrap" title="Klicken, um zu einer Taktposition im 4-Minuten-Aufbau zu springen">
            <div class="er-scrubber-sections" id="er-scrubber-sections"></div>
            <div class="er-scrubber-fill" id="er-scrubber-fill"></div>
            <div class="er-scrubber-head" id="er-scrubber-head"></div>
          </div>

          <div class="er-chord-live-box">
            <span class="er-chord-live-lbl">TON / AKKORD:</span>
            <strong class="er-chord-live-name" id="er-chord-live-name">Hm</strong>
            <span class="er-chord-live-notes" id="er-chord-live-notes">H3 · D4 · Fis4 · H4 · Bass H1</span>
          </div>
        </section>

        <!-- Einklappbares Referenzvergleich-Deck (A/B) außerhalb des physischen Racks -->
        <div class="er-ab-card hidden" id="er-ab-card">
          <div class="er-card-header">
            <div class="er-card-title-group">
              <span class="er-section-dot er-dot-blue"></span>
              <h2 class="er-card-title">REFERENZVERGLEICH (A / B)</h2>
              <span class="er-ab-active-pill" id="er-ab-active-pill">HÖRBAR: RACK (SYNTHESE)</span>
            </div>
            <div class="er-card-actions">
              <button class="er-mini-btn" id="er-btn-load-ref">Referenz-Audiodatei laden…</button>
              <input type="file" id="er-ref-file-input" accept="audio/*" hidden />
            </div>
          </div>

          <div class="er-ab-body">
            <div class="er-ab-controls">
              <div class="er-ab-switch-group" role="group" aria-label="A/B Hörvergleich">
                <button class="er-ab-switch-btn active" id="er-ab-btn-rack" data-src="rack">
                  A · RACK (SYNTHESE)
                </button>
                <button class="er-ab-switch-btn" id="er-ab-btn-ref" data-src="ref">
                  B · REFERENZ (DATEI)
                </button>
              </div>

              <div class="er-ref-transport">
                <button class="er-mini-btn" id="er-ref-play-btn" disabled>Referenz Start/Stopp</button>
                <label class="er-ref-field">
                  <span>Loop Start (s)</span>
                  <input type="number" id="er-ref-loop-start" min="0" step="1" value="0" />
                </label>
                <label class="er-ref-field">
                  <span>Ende (s)</span>
                  <input type="number" id="er-ref-loop-end" min="1" step="1" value="30" />
                </label>
                <label class="er-ref-chk">
                  <input type="checkbox" id="er-ref-loop-chk" checked />
                  <span>Schleife</span>
                </label>
                <div class="er-ref-gain-wrap">
                  <div id="er-ref-gain-knob" data-knob-size="sm" data-knob-color="cyan"></div>
                  <span class="er-ref-gain-lbl" id="er-ref-gain-val">Ref 85 %</span>
                </div>
              </div>
              <div class="er-ref-status" id="er-ref-status">
                Lade „By the Kiss“ (oder die isolierte „Sonstige“-Spur) als lokale Audiodatei für direkten, pegelgleichen A/B-Vergleich.
              </div>
            </div>

            <div class="er-ab-Analyzer">
              <canvas id="er-ab-canvas" width="320" height="86" aria-label="Spektral- und Pegelvergleich"></canvas>
              <div class="er-ab-legend">
                <span class="er-leg-rack">■ Synthese-Rack</span>
                <span class="er-leg-ref">■ Referenz-Audio</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Hinweis-Banner für CV-Kabel-Tiefe oder Warnungen -->
        <div class="er-cable-inspector hidden" id="er-cable-inspector"></div>

        <!-- Work-in-Progress & Community-Eurorack-Karussell -->
        <div class="er-carousel-bar" id="er-carousel-bar">
          <div class="er-wip-notice">
            <span class="er-wip-badge">WORK IN PROGRESS</span>
            <span class="er-wip-text">${t(
              'Der Eurorack-Bereich befindet sich noch in Entwicklung – reiche gerne eigene Euroracks per Pull Request ein!',
              'Eurorack mode is still in development – feel free to submit your own Eurorack racks via Pull Request!'
            )}</span>
            <a class="er-wip-link" href="https://github.com/Terclean/SYNTHBOARD" target="_blank" rel="noopener noreferrer">${t('Auf GitHub einreichen ↗', 'Submit on GitHub ↗')}</a>
          </div>
          <div class="er-carousel-nav">
            <button type="button" class="er-car-arrow" id="er-car-prev" title="${t('Vorheriges Case', 'Previous Case')}">◀</button>
            <div class="er-car-pills" id="er-car-pills">
              <button type="button" class="er-car-pill active" data-case-idx="0">01 · Distant Lights (Live)</button>
              <button type="button" class="er-car-pill" data-case-idx="1">02 · West-Coast Skiff (WIP)</button>
              <button type="button" class="er-car-pill" data-case-idx="2">03 · Techno 104HP (WIP)</button>
              <button type="button" class="er-car-pill" data-case-idx="3">04 · Community Slot (WIP)</button>
            </div>
            <button type="button" class="er-car-arrow" id="er-car-next" title="${t('Nächstes Case', 'Next Case')}">▶</button>
          </div>
        </div>

        <!-- Physische WIP-Platzhalter-Cases (Karussell-Ansicht) -->
        <div class="er-wip-case-view hidden" id="er-wip-case-view"></div>

        <!-- Zweizeiliges Eurorack-Gehäuse mit Walnussholz-Seitenteilen und Performance-Konsole -->
        <div class="er-case-assembly" id="er-case-assembly">
          <div class="er-wood-cheek er-wood-left" title="Massives Walnussholz-Seitenteil"></div>

          <div class="er-case-core">
            <div class="er-cabinet-wrap" id="er-cabinet-wrap">
              <canvas class="er-patch-canvas" id="er-patch-canvas"></canvas>
              <div class="er-cabinet" id="er-cabinet"></div>
            </div>

            <!-- Untere Gehäuse-Performance-Leiste: 5 große Hardware-Makros -->
            <footer class="er-performance-console" id="er-performance-console">
              <div class="er-perf-console-header">
                <span class="er-screw"></span>
                <div class="er-perf-brand">
                  <span class="er-perf-led"></span>
                  <strong class="er-perf-title">PERFORMANCE CONTROLS</strong>
                  <span class="er-perf-sub">Echtzeit-Klangformung für den 4-Minuten-Aufbau</span>
                </div>
                <div class="er-perf-actions">
                  <button type="button" class="er-mini-btn" id="er-btn-macro-map" title="Parameter-Zuordnung der 5 Makros anzeigen">Zuordnung anzeigen</button>
                  <button type="button" class="er-mini-btn" id="er-btn-reengage-all" title="Alle Makros wieder an die 4-Minuten-Automation übergeben">Alle auf Automation</button>
                </div>
                <span class="er-screw"></span>
              </div>
              <div class="er-macros-grid" id="er-macros-grid"></div>
              <div class="er-macro-map-drawer hidden" id="er-macro-map-drawer"></div>
            </footer>
          </div>

          <div class="er-wood-cheek er-wood-right" title="Massives Walnussholz-Seitenteil"></div>
        </div>
      </div>
    `;

    this.renderTimelineSections();
    this.renderMacros();
    this.renderCabinet();
    this.setupRefComparison();
    this.bindToolbarEvents();
    this.syncAllUI();
  }

  renderTimelineSections() {
    const host = this.hostEl.querySelector('#er-scrubber-sections');
    if (!host) return;
    const total = this.engine.arrangement.totalBars || 60;
    host.innerHTML = (this.engine.arrangement.sections || []).map((s) => {
      const left = (s.startBar / total) * 100;
      const width = (s.bars / total) * 100;
      return `<div class="er-scrub-sec" style="left:${left}%;width:${width}%"><span>${s.name} (T.${s.startBar + 1})</span></div>`;
    }).join('');
  }

  renderMacros() {
    const grid = this.hostEl.querySelector('#er-macros-grid');
    const drawer = this.hostEl.querySelector('#er-macro-map-drawer');
    if (!grid) return;
    grid.innerHTML = '';
    this.macroKnobs.clear();

    for (const key of MACRO_KEYS) {
      const def = MACROS[key];
      const cell = document.createElement('div');
      cell.className = 'er-macro-cell';
      cell.innerHTML = `
        <div class="er-macro-top">
          <span class="er-macro-name">${def.label}</span>
          <button class="er-macro-auto-tag" data-macro="${key}" title="Klicken, um Automation für ${def.label} wieder zu aktivieren">AUTO</button>
        </div>
        <div class="er-macro-knob-host" data-knob-color="amber"></div>
        <div class="er-macro-val">${Math.round((this.engine.macros[key] ?? 0.5) * 100)} %</div>
      `;
      grid.appendChild(cell);

      const knobHost = cell.querySelector('.er-macro-knob-host');
      const valEl = cell.querySelector('.er-macro-val');
      const autoBtn = cell.querySelector('.er-macro-auto-tag');

      const knob = new Knob(knobHost, {
        min: 0,
        max: 1,
        step: 0.01,
        value: this.engine.macros[key] ?? 0.5,
        defaultValue: 0.5,
        onChange: (v) => {
          this.engine.setMacro(key, v, true);
          valEl.textContent = `${Math.round(v * 100)} %`;
          this.syncModuleKnobsFromEngine();
          this.syncMacroAutoTags();
          this.persistLocal();
        },
      });

      autoBtn.addEventListener('click', () => {
        this.engine.reengage(key);
        this.syncMacroAutoTags();
        this.syncModuleKnobsFromEngine();
      });

      this.macroKnobs.set(key, { knob, valEl, autoBtn });
    }

    if (drawer) {
      drawer.innerHTML = MACRO_KEYS.map((key) => {
        const m = MACROS[key];
        const items = m.targets.map((t) => `<span class="er-map-chip">${t.mod}.${t.param}: ${t.info}</span>`).join('');
        return `<div class="er-map-row"><strong>${m.label}:</strong> ${items}</div>`;
      }).join('');
    }
  }

  renderCabinet() {
    const cab = this.hostEl.querySelector('#er-cabinet');
    if (!cab) return;
    cab.innerHTML = '';
    this.paramKnobs.clear();
    this.jackEls.clear();

    const rowTitles = [
      'REIHE 1 · HARMONIE · POLYPHONER ENSEMBLE-OSZILLATOR · STEREOFILTER · SÄTTIGUNG · HÜLLKURVE · VCA',
      'REIHE 2 · LANGSAME MODULATION (LFO 1 & 2) · ENSEMBLE / CHORUS · DUNKLER STEREOHALL · BASS · TEXTUR · MIXER',
    ];

    this.engine.layout.forEach((rowIds, rowIdx) => {
      const rowSec = document.createElement('section');
      rowSec.className = 'er-row';
      rowSec.innerHTML = `
        <div class="er-row-rail top-rail">
          <div class="er-rail-screw-strip"></div>
          <span class="er-row-label">${rowTitles[rowIdx] || `REIHE ${rowIdx + 1}`}</span>
          <span class="er-signal-legend">
            <i style="background:${SIGNAL_COLORS.audio}"></i>Audio
            <i style="background:${SIGNAL_COLORS.cv}"></i>CV
            <i style="background:${SIGNAL_COLORS.pitch}"></i>Pitch
            <i style="background:${SIGNAL_COLORS.gate}"></i>Gate
          </span>
        </div>
        <div class="er-row-modules"></div>
        <div class="er-row-rail bottom-rail">
          <div class="er-rail-screw-strip"></div>
        </div>
      `;
      const modsHost = rowSec.querySelector('.er-row-modules');
      let totalHpInRow = 0;
      rowIds.forEach((id) => {
        const mod = this.engine.modules.get(id);
        if (!mod) return;
        const card = this.buildModuleCard(mod);
        totalHpInRow += Number(card.dataset.hp || 16);
        modsHost.appendChild(card);
      });

      // Blindplatte (Blank Panel) für freie Eurorack-TEs (128 HP Zielbreite)
      const targetHp = 128;
      const freeHp = targetHp - totalHpInRow;
      if (freeHp > 0) {
        const blank = document.createElement('article');
        blank.className = 'er-module er-blank-panel';
        blank.dataset.hp = freeHp;
        blank.innerHTML = `
          <header class="er-mod-header">
            <span class="er-screw er-screw-tl"></span>
            <div class="er-mod-titles">
              <span class="er-blank-brand">SYNTHBOARD</span>
              <span class="er-blank-sub">BLANK ${freeHp} HP</span>
            </div>
            <span class="er-hp-badge">${freeHp} HP</span>
            <span class="er-screw er-screw-tr"></span>
          </header>
          <div class="er-blank-art">
            <svg class="er-blank-nebula-svg" viewBox="0 0 100 200">
              <defs>
                <radialGradient id="blankGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.25"/>
                  <stop offset="60%" stop-color="#a855f7" stop-opacity="0.1"/>
                  <stop offset="100%" stop-color="#000" stop-opacity="0"/>
                </radialGradient>
              </defs>
              <circle cx="50" cy="100" r="45" fill="url(#blankGlow)" />
              <circle cx="50" cy="100" r="42" class="er-orbit-ring" />
              <ellipse cx="50" cy="100" rx="46" ry="18" transform="rotate(-25 50 100)" class="er-orbit-ring" />
              <circle cx="50" cy="100" r="26" class="er-orbit-ring-inner" />
              <!-- Constellation Lines -->
              <polyline points="28,55 50,42 74,68 64,115 36,132 28,55" class="er-constellation-line" />
              <line x1="50" y1="42" x2="64" y2="115" class="er-constellation-line-dim" />
              <!-- Stars -->
              <circle cx="50" cy="42" r="2.2" class="er-orbit-star gold" />
              <circle cx="28" cy="55" r="1.6" class="er-orbit-star cyan" />
              <circle cx="74" cy="68" r="2.0" class="er-orbit-star gold" />
              <circle cx="64" cy="115" r="1.8" class="er-orbit-star cyan" />
              <circle cx="36" cy="132" r="1.6" class="er-orbit-star gold" />
              <circle cx="82" cy="148" r="1.2" class="er-orbit-star" />
              <circle cx="18" cy="105" r="1.0" class="er-orbit-star" />
              <!-- Technical Inscription -->
              <text x="50" y="165" text-anchor="middle" class="er-blank-coords">RA 19h 50m · DEC +08° 52'</text>
              <text x="50" y="177" text-anchor="middle" class="er-blank-title">DISTANT LIGHTS</text>
            </svg>
          </div>
          <footer class="er-mod-jacks">
            <span class="er-screw er-screw-bl"></span>
            <span class="er-screw er-screw-br"></span>
          </footer>
        `;
        modsHost.appendChild(blank);
      }

      cab.appendChild(rowSec);
    });

    requestAnimationFrame(() => this.drawCables());
  }

  buildModuleCard(mod) {
    const M = mod.meta;
    const card = document.createElement('article');
    card.className = `er-module er-mod-${M.type}`;
    card.dataset.modId = mod.id;

    const hpWidths = {
      harmony: 32,
      ensemble_osc: 26,
      filter: 16,
      saturation: 12,
      envelope: 14,
      vca: 12,
      lfo: 14,
      chorus: 16,
      reverb: 18,
      bass: 20,
      texture: 14,
      mixer: 24,
    };
    const hp = hpWidths[M.type] || 16;
    card.dataset.hp = hp;

    const titleText = mod.title || M.title;
    card.innerHTML = `
      <header class="er-mod-header">
        <span class="er-screw er-screw-tl" title="Montageschraube M3"></span>
        <div class="er-mod-titles">
          <h3 class="er-mod-title">${titleText}</h3>
          <span class="er-mod-sub">${M.subtitle}</span>
        </div>
        <span class="er-hp-badge">${hp} HP</span>
        <span class="er-screw er-screw-tr" title="Montageschraube M3"></span>
      </header>
      <div class="er-mod-body"></div>
      <footer class="er-mod-jacks">
        <span class="er-screw er-screw-bl" title="Montageschraube M3"></span>
        <div class="er-jacks-inner"></div>
        <span class="er-screw er-screw-br" title="Montageschraube M3"></span>
      </footer>
    `;

    const body = card.querySelector('.er-mod-body');
    const jacksInner = card.querySelector('.er-jacks-inner');

    // Spezialbereich für HARMONIE / VOICING
    if (M.type === 'harmony') {
      body.appendChild(this.buildHarmonyCustomUI(mod));
    }

    // Regler & Schalter für alle Parameter
    const controlsGrid = document.createElement('div');
    controlsGrid.className = 'er-controls-grid';

    for (const p of M.params) {
      const key = `${mod.id}:${p.id}`;
      const val = mod.values[p.id] ?? p.value;

      if (p.toggle) {
        // Robuster Hardware-Kippschalter
        const wrap = document.createElement('div');
        wrap.className = 'er-toggle-cell';
        const isOn = val >= 0.5;
        wrap.innerHTML = `
          <span class="er-ctrl-label">${p.label}</span>
          <button class="er-hw-switch ${isOn ? 'is-on' : 'is-off'}" type="button" role="switch" aria-checked="${isOn}">
            <span class="er-switch-plate">
              <span class="er-switch-bat"></span>
            </span>
            <span class="er-switch-led ${isOn ? 'on' : ''}"></span>
          </button>
          <span class="er-ctrl-val er-switch-txt">${isOn ? 'AN' : 'AUS'}</span>
        `;
        const btn = wrap.querySelector('.er-hw-switch');
        const txt = wrap.querySelector('.er-switch-txt');
        const led = wrap.querySelector('.er-switch-led');
        btn.addEventListener('click', () => {
          const next = (mod.values[p.id] ?? p.value) >= 0.5 ? 0 : 1;
          this.engine.setParam(mod.id, p.id, next);
          const nextOn = next >= 0.5;
          btn.classList.toggle('is-on', nextOn);
          btn.classList.toggle('is-off', !nextOn);
          btn.setAttribute('aria-checked', String(nextOn));
          led.classList.toggle('on', nextOn);
          txt.textContent = nextOn ? 'AN' : 'AUS';
          this.persistLocal();
        });
        controlsGrid.appendChild(wrap);
        this.paramKnobs.set(key, { toggleBtn: btn, ledEl: led, txtEl: txt, def: p, mod });
      } else if (p.choices) {
        // Hardware-Drehstufenschalter / Rotary Selector
        const wrap = document.createElement('div');
        wrap.className = 'er-rotary-cell';
        const currentChoiceIdx = Math.max(0, p.choices.findIndex(([v]) => Math.abs(v - val) < 0.01));
        const activeChoice = p.choices[currentChoiceIdx] || p.choices[0];

        wrap.innerHTML = `
          <span class="er-ctrl-label">${p.label}</span>
          <div class="er-rotary-dial" tabindex="0" role="button" aria-label="${p.label}" title="${p.label}: Klick oder Scrollen zum Umschalten">
            <svg class="er-rotary-dots-svg" viewBox="0 0 36 36">
              ${p.choices.map((_, i) => {
                const count = p.choices.length;
                const angle = -135 + (i / Math.max(1, count - 1)) * 270;
                const rad = (angle - 90) * (Math.PI / 180);
                const cx = (18 + 14 * Math.cos(rad)).toFixed(1);
                const cy = (18 + 14 * Math.sin(rad)).toFixed(1);
                return `<circle cx="${cx}" cy="${cy}" r="1.5" class="er-rotary-dot-led ${i === currentChoiceIdx ? 'active' : ''}" data-idx="${i}" />`;
              }).join('')}
            </svg>
            <div class="er-rotary-knob">
              <span class="er-rotary-notch"></span>
            </div>
          </div>
          <div class="er-encoder-display" title="Aktive Einstellung · Klick zum Weiterschalten">
            <span class="er-enc-val">${activeChoice[1]}</span>
          </div>
        `;

        const dial = wrap.querySelector('.er-rotary-dial');
        const knobEl = wrap.querySelector('.er-rotary-knob');
        const dispEl = wrap.querySelector('.er-encoder-display');
        const dispVal = wrap.querySelector('.er-enc-val');
        const dotLeds = wrap.querySelectorAll('.er-rotary-dot-led');

        const updateRotaryVisuals = (idx) => {
          const count = p.choices.length;
          const angleStep = 270 / Math.max(1, count - 1);
          const deg = -135 + idx * angleStep;
          if (knobEl) knobEl.style.transform = `rotate(${deg}deg)`;
          if (dispVal) dispVal.textContent = p.choices[idx][1];
          dotLeds.forEach((dot, i) => dot.classList.toggle('active', i === idx));
        };

        updateRotaryVisuals(currentChoiceIdx);

        const cycleChoice = (delta = 1) => {
          const cur = p.choices.findIndex(([v]) => Math.abs(v - (mod.values[p.id] ?? p.value)) < 0.01);
          const nextIdx = (cur + delta + p.choices.length) % p.choices.length;
          const nextVal = p.choices[nextIdx][0];
          this.engine.setParam(mod.id, p.id, nextVal);
          updateRotaryVisuals(nextIdx);
          this.updateLiveChordReadout();
          this.persistLocal();
        };

        dial.addEventListener('click', (e) => {
          e.stopPropagation();
          cycleChoice(1);
        });

        dispEl.addEventListener('click', (e) => {
          e.stopPropagation();
          cycleChoice(1);
        });

        dial.addEventListener('wheel', (e) => {
          e.preventDefault();
          cycleChoice(e.deltaY > 0 ? 1 : -1);
        }, { passive: false });

        dial.addEventListener('keydown', (e) => {
          if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
            e.preventDefault();
            cycleChoice(1);
          } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
            e.preventDefault();
            cycleChoice(-1);
          }
        });

        controlsGrid.appendChild(wrap);
        this.paramKnobs.set(key, { updateRotary: updateRotaryVisuals, def: p, mod });
      } else {
        // Klassischer Eurorack-Drehregler mit gedruckter Skala
        const wrap = document.createElement('div');
        wrap.className = 'er-knob-cell';
        wrap.innerHTML = `
          <div class="er-knob-scale">
            <svg class="er-scale-svg" viewBox="0 0 54 54">
              <circle cx="27" cy="27" r="23" class="er-scale-track" />
              <circle cx="27" cy="27" r="23" class="er-scale-arc" />
            </svg>
            <div class="er-knob-mount" data-knob-size="sm" data-knob-color="dark"></div>
          </div>
          <span class="er-ctrl-label">${p.label}</span>
          <span class="er-ctrl-val">${fmtParam(p, val)}</span>
        `;
        const mount = wrap.querySelector('.er-knob-mount');
        const valEl = wrap.querySelector('.er-ctrl-val');
        const scaleArc = wrap.querySelector('.er-scale-arc');

        const updateScaleVisual = (norm) => {
          if (!scaleArc) return;
          const circumference = 2 * Math.PI * 23 * 0.75; // 270 deg
          const stroke = clamp(norm, 0, 1) * circumference;
          scaleArc.style.strokeDasharray = `${stroke} ${circumference}`;
        };

        const knob = new Knob(mount, {
          min: p.min,
          max: p.max,
          step: p.step ?? (p.max - p.min) / 200,
          value: val,
          defaultValue: p.value,
          logarithmic: !!p.log,
          onChange: (v) => {
            this.engine.setParam(mod.id, p.id, v);
            valEl.textContent = fmtParam(p, mod.values[p.id]);
            const norm = (v - p.min) / Math.max(1e-6, p.max - p.min);
            updateScaleVisual(norm);
            if (mod.id === 'mixer' && p.id === 'master') {
              const vs = this.hostEl.querySelector('#er-toolbar-vol');
              const vv = this.hostEl.querySelector('#er-toolbar-vol-val');
              if (vs) vs.value = String(v);
              if (vv) vv.textContent = `${Math.round(v * 100)} %`;
            }
            this.syncMacroAutoTags();
            this.persistLocal();
          },
        });

        updateScaleVisual((val - p.min) / Math.max(1e-6, p.max - p.min));
        controlsGrid.appendChild(wrap);
        this.paramKnobs.set(key, { knob, valEl, updateScaleVisual, def: p, mod });
      }
    }

    body.appendChild(controlsGrid);

    // Spezialbereich für MIXER (Stereo-Pegelanzeige + Clipping + Schutz-Status)
    if (M.type === 'mixer') {
      const meterBox = document.createElement('div');
      meterBox.className = 'er-mixer-meter';
      meterBox.innerHTML = `
        <div class="er-meter-row">
          <span class="er-meter-ch">L</span>
          <div class="er-meter-track"><div class="er-meter-bar" id="er-meter-l"></div></div>
        </div>
        <div class="er-meter-row">
          <span class="er-meter-ch">R</span>
          <div class="er-meter-track"><div class="er-meter-bar" id="er-meter-r"></div></div>
        </div>
        <div class="er-meter-status-row">
          <span class="er-meter-db" id="er-meter-db">−∞ dBFS</span>
          <span class="er-clip-badge" id="er-clip-badge">LIMITER OK</span>
        </div>
      `;
      body.appendChild(meterBox);
    }

    // Ein- und Ausgangsbuchsen rendern
    for (const j of M.jacks) {
      const jackBtn = document.createElement('button');
      jackBtn.type = 'button';
      jackBtn.className = `er-jack er-jack-${j.dir} er-sig-${j.sig} ${j.fixed ? 'er-jack-fixed' : ''}`;
      jackBtn.dataset.modId = mod.id;
      jackBtn.dataset.portId = j.id;
      jackBtn.dataset.dir = j.dir;
      jackBtn.dataset.sig = j.sig;
      jackBtn.title = j.fixed
        ? 'Fest verdrahteter Master-Ausgang'
        : `${j.dir === 'out' ? 'Ausgang' : 'Eingang'} (${j.sig.toUpperCase()}): Klick zum Verbinden · Rechtsklick zum Lösen`;
      jackBtn.innerHTML = `
        <span class="er-jack-bezel">
          <span class="er-jack-socket" style="border-color:${SIGNAL_COLORS[j.sig] || '#888'}">
            <span class="er-jack-barrel">
              <span class="er-jack-core"></span>
            </span>
          </span>
        </span>
        <span class="er-jack-lbl">${j.label}</span>
      `;

      if (!j.fixed) {
        jackBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.handleJackClick(mod.id, j, jackBtn);
        });
        jackBtn.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.handleJackRightClick(mod.id, j);
        });
      }

      jackBtn.addEventListener('mouseenter', () => {
        this.hoveredJackKey = `${mod.id}:${j.id}`;
        this.drawCables();
      });
      jackBtn.addEventListener('mouseleave', () => {
        if (this.hoveredJackKey === `${mod.id}:${j.id}`) {
          this.hoveredJackKey = null;
          this.drawCables();
        }
      });

      jacksInner.appendChild(jackBtn);
      this.jackEls.set(`${mod.id}:${j.id}`, jackBtn);
    }

    return card;
  }

  buildHarmonyCustomUI(mod) {
    const wrap = document.createElement('div');
    wrap.className = 'er-harmony-editor';

    const renderHarmonyInner = () => {
      const activeIdx = clamp(this.editingChordIdx, 0, mod.chords.length - 1);
      const chord = mod.chords[activeIdx];
      const soundingNotes = mod.notesOf(activeIdx).map(midiToNameDe).join(' · ');
      const bassNote = midiToNameDe(mod.rootOf(activeIdx));

      wrap.innerHTML = `
        <div class="er-chord-tabs">
          ${mod.chords.map((c, i) => `
            <button type="button" class="er-chord-tab ${i === activeIdx ? 'editing' : ''} ${i === mod.cur && mod.sounding ? 'sounding' : ''}" data-cidx="${i}">
              <span class="er-ct-name">${c.name}</span>
              <span class="er-ct-bars">${c.bars}T</span>
            </button>
          `).join('')}
          <button type="button" class="er-hold-btn ${mod.hold ? 'on' : ''}" id="er-btn-hold" title="Aktuellen Akkord dauerhaft zum Klangvergleich halten">
            ${mod.hold ? 'HALTEN AKTIV' : 'Halten'}
          </button>
        </div>

        <div class="er-voicing-row">
          ${[0, 1, 2, 3].map((vi) => `
            <label class="er-voice-input">
              <span>St.${vi + 1} (${midiToNameDe(chord.notes[vi] + mod.values.lage)})</span>
              <input type="number" min="36" max="84" value="${chord.notes[vi]}" data-v-idx="${vi}" />
            </label>
          `).join('')}
          <label class="er-voice-input">
            <span>Bass (${bassNote})</span>
            <input type="number" min="24" max="55" value="${chord.bass}" data-bass-edit="1" />
          </label>
        </div>

        <div class="er-harmony-readout" id="er-harmony-readout">
          Noten: <strong>${soundingNotes}</strong> · Bass: <strong>${bassNote}</strong>
        </div>
      `;

      wrap.querySelectorAll('.er-chord-tab').forEach((btn) => {
        btn.addEventListener('click', async () => {
          await this.ensureAudio();
          const idx = Number(btn.dataset.cidx);
          this.editingChordIdx = idx;
          if (mod.hold) {
            this.engine.holdChord(idx);
          } else if (!this.engine.playing) {
            mod.playChord(idx, this.ctx.currentTime + 0.01);
          }
          renderHarmonyInner();
          this.updateLiveChordReadout();
        });
      });

      const holdBtn = wrap.querySelector('#er-btn-hold');
      holdBtn?.addEventListener('click', async () => {
        await this.ensureAudio();
        this.engine.setHold(!mod.hold, this.editingChordIdx);
        renderHarmonyInner();
        this.updateLiveChordReadout();
      });

      wrap.querySelectorAll('input[data-v-idx]').forEach((inp) => {
        inp.addEventListener('change', () => {
          const vi = Number(inp.dataset.vIdx);
          chord.notes[vi] = clamp(Math.round(Number(inp.value) || 60), 36, 84);
          if (mod.sounding && mod.cur === activeIdx) mod.playChord(activeIdx, this.ctx.currentTime + 0.01);
          renderHarmonyInner();
          this.updateLiveChordReadout();
          this.persistLocal();
        });
      });

      const bassInp = wrap.querySelector('input[data-bass-edit]');
      bassInp?.addEventListener('change', () => {
        chord.bass = clamp(Math.round(Number(bassInp.value) || 36), 24, 55);
        if (mod.sounding && mod.cur === activeIdx) mod.playChord(activeIdx, this.ctx.currentTime + 0.01);
        renderHarmonyInner();
        this.updateLiveChordReadout();
        this.persistLocal();
      });
    };

    this.refreshHarmonyUI = renderHarmonyInner;
    renderHarmonyInner();
    return wrap;
  }

  // ───────────────────────────── Verkabelung & Interaktion ──
  handleJackClick(modId, jackDef, jackEl) {
    if (!this.pendingJack) {
      // Wenn auf einen belegten Eingang geklickt wird und dieser ein CV-Kabel hat -> CV-Tiefe-Inspektor zeigen
      const existingIn = jackDef.dir === 'in'
        ? this.engine.cables.find((c) => c.toId === modId && c.toPort === jackDef.id)
        : null;
      if (existingIn && existingIn.signal === 'cv') {
        this.openCableInspector(existingIn);
      }

      this.pendingJack = { modId, portId: jackDef.id, dir: jackDef.dir, sig: jackDef.sig, el: jackEl };
      jackEl.classList.add('is-pending');
      this.highlightCompatibleJacks(this.pendingJack);
      return;
    }

    // Gleiche Buchse nochmal geklickt -> abbrechen
    if (this.pendingJack.modId === modId && this.pendingJack.portId === jackDef.id) {
      this.clearPendingJack();
      return;
    }

    const a = this.pendingJack;
    const b = { modId, portId: jackDef.id, dir: jackDef.dir, sig: jackDef.sig };
    const from = a.dir === 'out' ? a : b;
    const to = a.dir === 'in' ? a : b;

    const res = this.engine.connect(from.modId, from.portId, to.modId, to.portId, 1);
    this.clearPendingJack();

    if (!res.ok) {
      this.toast(res.error);
      return;
    }

    this.toast(`Verbunden: ${from.modId}.${from.portId} → ${to.modId}.${to.portId}`);
    if (res.cable?.signal === 'cv') {
      this.openCableInspector(res.cable);
    }
    this.drawCables();
    this.persistLocal();
  }

  handleJackRightClick(modId, jackDef) {
    this.clearPendingJack();
    const hits = this.engine.cables.filter((c) =>
      (jackDef.dir === 'in' && c.toId === modId && c.toPort === jackDef.id) ||
      (jackDef.dir === 'out' && c.fromId === modId && c.fromPort === jackDef.id)
    );
    if (!hits.length) {
      this.toast('An dieser Buchse ist kein Kabel gesteckt.');
      return;
    }
    hits.forEach((c) => this.engine.disconnect(c.id));
    this.closeCableInspector();
    this.toast(`Kabel an ${modId}.${jackDef.id} gelöst`);
    this.drawCables();
    this.persistLocal();
  }

  highlightCompatibleJacks(src) {
    this.jackEls.forEach((el) => {
      const dir = el.dataset.dir;
      const sig = el.dataset.sig;
      const modId = el.dataset.modId;
      const compatible = dir !== src.dir && sig === src.sig && modId !== src.modId && !el.classList.contains('er-jack-fixed');
      el.classList.toggle('is-compatible', compatible);
    });
  }

  clearPendingJack() {
    this.pendingJack = null;
    this.jackEls.forEach((el) => {
      el.classList.remove('is-pending', 'is-compatible');
    });
    this.drawCables();
  }

  openCableInspector(cable) {
    const box = this.hostEl.querySelector('#er-cable-inspector');
    if (!box) return;
    this.selectedCableId = cable.id;
    box.classList.remove('hidden');
    box.innerHTML = `
      <span class="er-ci-title">CV-Kabel: <strong>${cable.fromId}:${cable.fromPort} → ${cable.toId}:${cable.toPort}</strong></span>
      <label class="er-ci-slider">
        <span>Modulationsstärke</span>
        <input type="range" id="er-ci-depth" min="0" max="2" step="0.02" value="${cable.depth}" />
        <strong id="er-ci-depth-val">${Math.round(cable.depth * 100)} %</strong>
      </label>
      <button type="button" class="er-mini-btn er-btn-danger" id="er-ci-remove">Kabel abziehen</button>
      <button type="button" class="er-mini-btn" id="er-ci-close">Schließen</button>
    `;
    const slider = box.querySelector('#er-ci-depth');
    const valEl = box.querySelector('#er-ci-depth-val');
    slider?.addEventListener('input', () => {
      const d = Number(slider.value);
      this.engine.setCableDepth(cable.id, d);
      if (valEl) valEl.textContent = `${Math.round(d * 100)} %`;
      this.persistLocal();
    });
    box.querySelector('#er-ci-remove')?.addEventListener('click', () => {
      this.engine.disconnect(cable.id);
      this.closeCableInspector();
      this.drawCables();
      this.persistLocal();
    });
    box.querySelector('#er-ci-close')?.addEventListener('click', () => this.closeCableInspector());
  }

  closeCableInspector() {
    this.selectedCableId = null;
    this.hostEl.querySelector('#er-cable-inspector')?.classList.add('hidden');
  }

  drawCables() {
    const canvas = this.hostEl.querySelector('#er-patch-canvas');
    const wrap = this.hostEl.querySelector('#er-cabinet-wrap');
    if (!canvas || !wrap) return;

    const rect = wrap.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== Math.round(rect.width * dpr) || canvas.height !== Math.round(rect.height * dpr)) {
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
    }

    const ctx = canvas.getContext('2d');
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, rect.width, rect.height);

    // Belegte Buchsen markieren
    const connectedPorts = new Set();
    this.engine.cables.forEach((c) => {
      connectedPorts.add(`${c.fromId}:${c.fromPort}`);
      connectedPorts.add(`${c.toId}:${c.toPort}`);
    });
    this.jackEls.forEach((el, key) => {
      el.classList.toggle('is-connected', connectedPorts.has(key));
    });

    if (!this.cablesVisible) {
      ctx.restore();
      return;
    }

    const portCenter = (key) => {
      const el = this.jackEls.get(key);
      if (!el) return null;
      const sock = el.querySelector('.er-jack-socket') || el;
      const r = sock.getBoundingClientRect();
      return {
        x: r.left - rect.left + r.width / 2,
        y: r.top - rect.top + r.height / 2,
      };
    };

    for (const c of this.engine.cables) {
      const fromKey = `${c.fromId}:${c.fromPort}`;
      const toKey = `${c.toId}:${c.toPort}`;
      const p1 = portCenter(fromKey);
      const p2 = portCenter(toKey);
      if (!p1 || !p2) continue;

      const isHovered = this.hoveredJackKey && (fromKey === this.hoveredJackKey || toKey === this.hoveredJackKey);
      const isDimmed = this.hoveredJackKey && !isHovered;

      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const isCrossRow = Math.abs(p2.y - p1.y) > 60;
      const color = SIGNAL_COLORS[c.signal] || '#6f9bd1';

      let cp1x, cp1y, cp2x, cp2y;

      if (isCrossRow) {
        // Verbindung zwischen Reihe 1 und Reihe 2 (z. B. VCA -> Chorus, LFO -> Osc)
        const yTop = Math.min(p1.y, p2.y);
        const yBottom = Math.max(p1.y, p2.y);
        const yDiff = yBottom - yTop;

        if (p1.y < p2.y) {
          cp1x = p1.x + (p2.x - p1.x) * 0.2;
          cp1y = p1.y + yDiff * 0.45;
          cp2x = p2.x - (p2.x - p1.x) * 0.2;
          cp2y = p2.y - yDiff * 0.45;
        } else {
          cp1x = p1.x - (p1.x - p2.x) * 0.2;
          cp1y = p1.y - yDiff * 0.45;
          cp2x = p2.x + (p1.x - p2.x) * 0.2;
          cp2y = p2.y + yDiff * 0.45;
        }
      } else {
        // Verbindung innerhalb derselben Reihe: Sanfter Durchhang innerhalb der Buchsenleiste
        const sag = Math.min(9, 3 + dist * 0.03);
        cp1x = p1.x + (p2.x - p1.x) * 0.25;
        cp1y = Math.max(p1.y, p2.y) + sag;
        cp2x = p1.x + (p2.x - p1.x) * 0.75;
        cp2y = Math.max(p1.y, p2.y) + sag;
      }

      // 1. Weicher Kabelschatten auf die Frontplatten
      ctx.beginPath();
      ctx.moveTo(p1.x + 2, p1.y + 4);
      ctx.bezierCurveTo(cp1x + 2, cp1y + 5, cp2x + 2, cp2y + 5, p2.x + 2, p2.y + 4);
      ctx.strokeStyle = isDimmed ? 'rgba(0, 0, 0, 0.15)' : 'rgba(0, 0, 0, 0.45)';
      ctx.lineWidth = isHovered ? 4.8 : 3.6;
      ctx.stroke();

      // 2. Elastisches gummiertes Patchkabel
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
      ctx.strokeStyle = color;
      ctx.lineWidth = (c.id === this.selectedCableId || isHovered) ? 3.8 : 2.5;
      ctx.globalAlpha = isDimmed ? 0.22 : (isHovered ? 1 : 0.92);
      ctx.stroke();

      // 3. Subtiler Lichtreflex entlang des Kabels
      ctx.beginPath();
      ctx.moveTo(p1.x - 0.5, p1.y - 0.5);
      ctx.bezierCurveTo(cp1x - 0.5, cp1y - 0.5, cp2x - 0.5, cp2y - 0.5, p2.x - 0.5, p2.y - 0.5);
      ctx.strokeStyle = isDimmed ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = 0.8;
      ctx.stroke();

      // 4. Echte 3,5mm Klinkenstecker-Hülsen an Start- und Zielbuchse
      [p1, p2].forEach((p) => {
        ctx.globalAlpha = isDimmed ? 0.3 : 1;
        // Rändelmutter / Metall-Hülse
        ctx.fillStyle = '#1c1f24';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 5.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Farbige Knickschutztülle
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3.2, 0, Math.PI * 2);
        ctx.fill();

        // Glanzpunkt
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(p.x - 1, p.y - 1, 1, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    ctx.restore();
  }

  // ───────────────────────────── Referenzvergleich A/B ──
  setupRefComparison() {
    const gainHost = this.hostEl.querySelector('#er-ref-gain-knob');
    const gainVal = this.hostEl.querySelector('#er-ref-gain-val');
    if (gainHost) {
      new Knob(gainHost, {
        min: 0,
        max: 1.5,
        step: 0.01,
        value: 0.85,
        defaultValue: 0.85,
        onChange: (v) => {
          this.refTrimGain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.03);
          if (gainVal) gainVal.textContent = `Ref ${Math.round(v * 100)} %`;
        },
      });
    }

    const fileInp = this.hostEl.querySelector('#er-ref-file-input');
    this.hostEl.querySelector('#er-btn-load-ref')?.addEventListener('click', () => fileInp?.click());
    fileInp?.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      await this.loadReferenceAudioFile(file);
      fileInp.value = '';
    });

    this.hostEl.querySelectorAll('.er-ab-switch-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        await this.ensureAudio();
        this.setAbSource(btn.dataset.src);
      });
    });

    const playBtn = this.hostEl.querySelector('#er-ref-play-btn');
    playBtn?.addEventListener('click', async () => {
      await this.ensureAudio();
      if (this.refPlaying) this.stopReferencePlayback();
      else this.startReferencePlayback();
    });

    const startInp = this.hostEl.querySelector('#er-ref-loop-start');
    const endInp = this.hostEl.querySelector('#er-ref-loop-end');
    const loopChk = this.hostEl.querySelector('#er-ref-loop-chk');

    const updateLoopParams = () => {
      const maxDur = this.refBuffer ? this.refBuffer.duration : 300;
      this.refLoopStart = clamp(Number(startInp?.value) || 0, 0, Math.max(0, maxDur - 0.5));
      this.refLoopEnd = clamp(Number(endInp?.value) || 30, this.refLoopStart + 0.5, maxDur);
      this.refLoop = !!loopChk?.checked;
      if (this.refSourceNode) {
        this.refSourceNode.loop = this.refLoop;
        this.refSourceNode.loopStart = this.refLoopStart;
        this.refSourceNode.loopEnd = this.refLoopEnd;
      }
    };

    startInp?.addEventListener('change', updateLoopParams);
    endInp?.addEventListener('change', updateLoopParams);
    loopChk?.addEventListener('change', updateLoopParams);
  }

  async loadReferenceAudioFile(file) {
    const statusEl = this.hostEl.querySelector('#er-ref-status');
    try {
      if (statusEl) statusEl.textContent = `Dekodiere „${file.name}“…`;
      const buf = await file.arrayBuffer();
      const audioBuf = await this.ctx.decodeAudioData(buf);
      this.stopReferencePlayback();
      this.refBuffer = audioBuf;
      this.refFileName = file.name;
      this.refLoopStart = 0;
      this.refLoopEnd = Math.min(30, Math.floor(audioBuf.duration));

      const startInp = this.hostEl.querySelector('#er-ref-loop-start');
      const endInp = this.hostEl.querySelector('#er-ref-loop-end');
      const playBtn = this.hostEl.querySelector('#er-ref-play-btn');
      if (startInp) startInp.value = String(this.refLoopStart);
      if (endInp) endInp.value = String(this.refLoopEnd);
      if (playBtn) playBtn.disabled = false;
      if (statusEl) {
        statusEl.textContent = `Geladen: ${file.name} (${fmtTime(audioBuf.duration)} · ${(audioBuf.sampleRate / 1000).toFixed(1)} kHz)`;
      }
      this.toast(`Referenz geladen: ${file.name}`);
    } catch (err) {
      if (statusEl) statusEl.textContent = `Fehler beim Dekodieren: ${err.message || err}`;
      this.toast('Referenzdatei konnte nicht gelesen werden.');
    }
  }

  startReferencePlayback() {
    if (!this.refBuffer) return;
    this.stopReferencePlayback();
    const src = this.ctx.createBufferSource();
    src.buffer = this.refBuffer;
    src.loop = this.refLoop;
    src.loopStart = this.refLoopStart;
    src.loopEnd = Math.min(this.refBuffer.duration, Math.max(this.refLoopStart + 0.5, this.refLoopEnd));
    src.connect(this.refTrimGain);
    src.onended = () => {
      if (this.refSourceNode === src) {
        this.refPlaying = false;
        this.refSourceNode = null;
        this.updateRefPlayButton();
      }
    };
    src.start(0, this.refLoopStart);
    this.refSourceNode = src;
    this.refPlaying = true;
    this.updateRefPlayButton();
  }

  stopReferencePlayback() {
    if (this.refSourceNode) {
      try { this.refSourceNode.stop(); } catch { /* ignore */ }
      try { this.refSourceNode.disconnect(); } catch { /* ignore */ }
      this.refSourceNode = null;
    }
    this.refPlaying = false;
    this.updateRefPlayButton();
  }

  updateRefPlayButton() {
    const btn = this.hostEl.querySelector('#er-ref-play-btn');
    if (btn) btn.textContent = this.refPlaying ? 'Referenz Stopp' : 'Referenz Start';
  }

  setAbSource(src) {
    this.abSource = src === 'ref' ? 'ref' : 'rack';
    const now = this.ctx.currentTime;
    const isRack = this.abSource === 'rack';
    this.rackMonitorGain.gain.setTargetAtTime(isRack ? 1 : 0, now, 0.02);
    this.refMonitorGain.gain.setTargetAtTime(isRack ? 0 : 1, now, 0.02);

    if (!isRack && this.refBuffer && !this.refPlaying) {
      this.startReferencePlayback();
    }

    this.hostEl.querySelector('#er-ab-btn-rack')?.classList.toggle('active', isRack);
    this.hostEl.querySelector('#er-ab-btn-ref')?.classList.toggle('active', !isRack);
    const pill = this.hostEl.querySelector('#er-ab-active-pill');
    if (pill) {
      pill.textContent = isRack ? 'HÖRBAR: RACK (SYNTHESE)' : 'HÖRBAR: REFERENZ (DATEI)';
      pill.classList.toggle('is-ref', !isRack);
    }
  }

  // ───────────────────────────── Toolbar-Events ──
  bindToolbarEvents() {
    // Audio aktivieren
    this.hostEl.querySelector('#er-btn-audio')?.addEventListener('click', async () => {
      await this.ensureAudio();
      this.syncAudioStatus();
      this.toast('Audio-Engine aktiv');
    });

    // Play / Pause / Stop
    this.hostEl.querySelector('#er-btn-play')?.addEventListener('click', async () => {
      await this.ensureAudio();
      this.engine.play();
      this.syncTransportUI();
    });

    this.hostEl.querySelector('#er-btn-pause')?.addEventListener('click', () => {
      this.engine.pause();
      this.syncTransportUI();
    });

    this.hostEl.querySelector('#er-btn-stop')?.addEventListener('click', () => {
      this.engine.stop();
      this.syncTransportUI();
    });

    // Modus: Automatischer Aufbau (4:04) vs. Manuell
    this.hostEl.querySelectorAll('.er-mode-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.mode;
        this.engine.setMode(mode);
        this.syncTransportUI();
        this.syncMacroAutoTags();
        this.persistLocal();
      });
    });

    // Patch-Auswahl (Standard, Leer oder Distant Lights)
    this.hostEl.querySelector('#er-patch-select')?.addEventListener('change', (e) => {
      const val = e.target.value;
      if (val === 'empty') {
        this.engine.loadState(buildEmptyPatch());
      } else if (val === 'distant_lights') {
        this.engine.loadState(buildDistantLights());
      } else {
        this.engine.loadState(buildStandardPatch());
      }
      this.closeCableInspector();
      this.renderCabinet();
      this.syncAllUI();
      this.persistLocal();
      this.toast(`Patch geladen: ${this.engine.name}`);
    });

    // Drone (Dauerton) umschalten zum freien Schrauben
    this.hostEl.querySelector('#er-btn-drone')?.addEventListener('click', (e) => {
      this.isDroneOn = !this.isDroneOn;
      const h = this.engine.modules.get('harmony');
      if (h) {
        h.hold = this.isDroneOn;
        if (this.isDroneOn) {
          h.setGate(true, this.ctx.currentTime);
          h.playChord(h.holdIdx, this.ctx.currentTime);
        } else {
          h.setGate(false, this.ctx.currentTime);
        }
      }
      e.currentTarget.classList.toggle('on', this.isDroneOn);
      e.currentTarget.querySelector('span').textContent = this.isDroneOn ? 'Drone: EIN' : 'Drone: AUS';
      this.toast(this.isDroneOn ? 'Drone aktiviert (Dauerton aktiv)' : 'Drone deaktiviert');
    });

    // Alle Kabel abziehen (Unpatch)
    this.hostEl.querySelector('#er-btn-unpatch')?.addEventListener('click', () => {
      this.engine.disconnectAll();
      this.closeCableInspector();
      this.drawCables();
      this.persistLocal();
      this.toast('Alle Kabel abgezogen');
    });

    // BPM
    const bpmInp = this.hostEl.querySelector('#er-bpm-input');
    bpmInp?.addEventListener('change', () => {
      this.engine.setBpm(Number(bpmInp.value));
      bpmInp.value = String(this.engine.bpm);
      this.persistLocal();
    });

    // Lautstärke in der Toolbar (synchronisiert mit Mixer Master)
    const volSlider = this.hostEl.querySelector('#er-toolbar-vol');
    const volVal = this.hostEl.querySelector('#er-toolbar-vol-val');
    volSlider?.addEventListener('input', () => {
      const v = Number(volSlider.value);
      this.engine.setParam('mixer', 'master', v);
      if (volVal) volVal.textContent = `${Math.round(v * 100)} %`;
      this.syncModuleKnobsFromEngine();
      this.persistLocal();
    });

    // Zeitleiste Scrubber (Klick zum Springen)
    const scrubWrap = this.hostEl.querySelector('#er-scrubber-wrap');
    scrubWrap?.addEventListener('click', (e) => {
      const r = scrubWrap.getBoundingClientRect();
      const ratio = clamp((e.clientX - r.left) / Math.max(1, r.width), 0, 1);
      const targetBar = ratio * (this.engine.arrangement.totalBars || 60);
      this.engine.seek(targetBar);
      this.syncTransportUI();
    });

    // Makro-Zuordnung ein-/ausblenden
    this.hostEl.querySelector('#er-btn-macro-map')?.addEventListener('click', () => {
      this.showMacroMap = !this.showMacroMap;
      this.hostEl.querySelector('#er-macro-map-drawer')?.classList.toggle('hidden', !this.showMacroMap);
    });

    // Alle Makros auf Automation zurücksetzen
    this.hostEl.querySelector('#er-btn-reengage-all')?.addEventListener('click', () => {
      MACRO_KEYS.concat(['build', 'bass']).forEach((k) => this.engine.reengage(k));
      this.syncMacroAutoTags();
      this.syncModuleKnobsFromEngine();
      this.toast('Alle Spuren folgen wieder dem 4-Minuten-Aufbau');
    });

    // Referenzvergleich-Deck ein-/ausblenden
    this.hostEl.querySelector('#er-btn-ab-panel')?.addEventListener('click', (e) => {
      this.showRefPanel = !this.showRefPanel;
      this.hostEl.querySelector('#er-ab-card')?.classList.toggle('hidden', !this.showRefPanel);
      e.currentTarget.classList.toggle('active', this.showRefPanel);
      setTimeout(() => this.drawCables(), 30);
    });

    // Kabel ein-/ausblenden
    this.hostEl.querySelector('#er-btn-cables')?.addEventListener('click', (e) => {
      this.cablesVisible = !this.cablesVisible;
      e.currentTarget.classList.toggle('on', this.cablesVisible);
      this.drawCables();
    });

    // Standard-Patch wiederherstellen
    this.hostEl.querySelector('#er-btn-reset')?.addEventListener('click', () => {
      this.engine.loadState(buildStandardPatch());
      this.closeCableInspector();
      this.renderCabinet();
      this.syncAllUI();
      this.persistLocal();
      this.toast('Standard-Patch wiederhergestellt');
    });

    // Rack speichern (JSON-Export)
    this.hostEl.querySelector('#er-btn-save')?.addEventListener('click', () => {
      const state = this.engine.getState();
      this.persistLocal();
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(this.engine.name || 'distant-lights').toLowerCase().replace(/\s+/g, '-')}.eurorack.json`;
      a.click();
      URL.revokeObjectURL(url);
      this.toast('Eurorack-Patch als JSON exportiert');
    });

    // Rack laden (JSON-Import)
    const fileLoad = this.hostEl.querySelector('#er-file-load');
    this.hostEl.querySelector('#er-btn-load')?.addEventListener('click', () => fileLoad?.click());
    fileLoad?.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        if (file.size > 2 * 1024 * 1024) {
          throw new Error('Datei ist zu groß (maximal 2 MiB erlaubt).');
        }
        const text = await file.text();
        const data = JSON.parse(text);
        const res = this.engine.loadState(data);
        if (!res.ok) {
          this.toast(`Laden abgelehnt: ${res.error}`);
        } else {
          this.renderCabinet();
          this.syncAllUI();
          this.persistLocal();
          if (res.warnings?.length) {
            this.toast(`Geladen mit ${res.warnings.length} Hinweis(en): ${res.warnings[0]}`);
          } else {
            this.toast(`Rack „${this.engine.name}“ geladen`);
          }
        }
      } catch (err) {
        this.toast(`Ungültige JSON-Datei: ${err.message || err}`);
      }
      fileLoad.value = '';
    });

    // Audio-Aufnahme
    this.hostEl.querySelector('#er-btn-rec')?.addEventListener('click', async () => {
      await this.ensureAudio();
      this.toggleRecording();
    });

    window.addEventListener('resize', () => {
      if (this.isActiveView) this.drawCables();
    });

    // Eurorack-Karussell Navigation
    this.carouselIndex = this.carouselIndex || 0;
    this.hostEl.querySelector('#er-car-prev')?.addEventListener('click', () => {
      this.setCarouselCase((this.carouselIndex + 3) % 4);
    });
    this.hostEl.querySelector('#er-car-next')?.addEventListener('click', () => {
      this.setCarouselCase((this.carouselIndex + 1) % 4);
    });
    this.hostEl.querySelectorAll('.er-car-pill').forEach((btn) => {
      btn.addEventListener('click', () => this.setCarouselCase(Number(btn.dataset.caseIdx)));
    });
    this.setCarouselCase(this.carouselIndex);
  }

  setCarouselCase(idx) {
    this.carouselIndex = idx;
    const caseEl = this.hostEl.querySelector('#er-case-assembly');
    const wipEl = this.hostEl.querySelector('#er-wip-case-view');
    this.hostEl.querySelectorAll('.er-car-pill').forEach((p) => {
      p.classList.toggle('active', Number(p.dataset.caseIdx) === idx);
    });

    if (idx === 0) {
      caseEl?.classList.remove('hidden');
      wipEl?.classList.add('hidden');
      requestAnimationFrame(() => this.drawCables());
      return;
    }

    caseEl?.classList.add('hidden');
    if (!wipEl) return;
    wipEl.classList.remove('hidden');

    const cases = {
      1: {
        name: 'West-Coast Skiff · 3U 84HP',
        wood: '#92400e',
        panel: '#e2e8f0',
        ink: '#0f172a',
        modules: [
          { title: 'COMPLEX OSC', hp: '18HP', knobs: ['FREQ', 'TIMBRE', 'FOLD', 'MOD'], jacks: 6 },
          { title: 'DUAL LPG', hp: '10HP', knobs: ['CUTOFF', 'RES', 'VCA'], jacks: 4 },
          { title: 'RANDOM SOURCE', hp: '14HP', knobs: ['RATE', 'SLEW', 'STEP'], jacks: 5 },
          { title: 'SPRING VERB', hp: '12HP', knobs: ['MIX', 'DRIVE', 'TONE'], jacks: 4 },
        ],
      },
      2: {
        name: 'Techno & Industrial · 6U 104HP',
        wood: '#1e293b',
        panel: '#111827',
        ink: '#f8fafc',
        modules: [
          { title: 'EUCLID TRIG', hp: '16HP', knobs: ['STEPS', 'HITS', 'ROT'], jacks: 6 },
          { title: 'FM PERC', hp: '14HP', knobs: ['PITCH', 'MOD', 'DECAY', 'SNAP'], jacks: 5 },
          { title: 'ACID BASS', hp: '18HP', knobs: ['CUTOFF', 'RES', 'ENV', 'ACC'], jacks: 5 },
          { title: 'WAVE SHAPER', hp: '12HP', knobs: ['DRIVE', 'FOLD', 'MIX'], jacks: 4 },
        ],
      },
      3: {
        name: 'Community Eurorack · Open Slot',
        wood: '#78350f',
        panel: '#1e293b',
        ink: '#cbd5e1',
        modules: [
          { title: 'OPEN 16HP', hp: '16HP', knobs: ['PARAM 1', 'PARAM 2'], jacks: 4, blank: true },
          { title: 'YOUR MODULE', hp: '20HP', knobs: ['CV A', 'CV B', 'OUT'], jacks: 5, blank: true },
          { title: 'OPEN 18HP', hp: '18HP', knobs: ['IN', 'MIX'], jacks: 4, blank: true },
        ],
      },
    };

    const spec = cases[idx] || cases[1];
    wipEl.innerHTML = `
      <div class="er-wip-hardware" style="--wip-wood:${spec.wood};--wip-panel:${spec.panel};--wip-ink:${spec.ink}">
        <div class="er-wood-cheek er-wood-left"></div>
        <div class="er-wip-rack-body">
          <div class="er-wip-rail er-wip-rail-top">
            <span>${spec.name}</span>
            <span class="er-wip-tag">PLACEHOLDER CASE</span>
          </div>
          <div class="er-wip-modules-row">
            ${spec.modules.map((m) => `
              <div class="er-wip-mod ${m.blank ? 'is-blank' : ''}">
                <div class="er-wip-screws"><i></i><i></i></div>
                <div class="er-wip-mod-title">${m.title} <small>${m.hp}</small></div>
                <div class="er-wip-knobs">
                  ${m.knobs.map((k) => `<div class="er-wip-knob"><span></span><small>${k}</small></div>`).join('')}
                </div>
                <div class="er-wip-jacks">
                  ${Array.from({ length: m.jacks }).map(() => `<span class="er-wip-jack"></span>`).join('')}
                </div>
                <div class="er-wip-screws"><i></i><i></i></div>
              </div>
            `).join('')}
          </div>
          <div class="er-wip-rail er-wip-rail-bottom">
            <span class="er-wip-footer-txt">WORK IN PROGRESS · ${t(
              'Reiche gerne dein eigenes Eurorack via GitHub Pull Request ein!',
              'Submit your own Eurorack via GitHub Pull Request!'
            )}</span>
          </div>
        </div>
        <div class="er-wood-cheek er-wood-right"></div>
      </div>
    `;
  }

  fitToScreen() {
    window.scrollTo(0, 0);
    requestAnimationFrame(() => this.drawCables());
    this.toast('Eurorack: Alles im Blick');
  }

  toggleRecording() {
    const btn = this.hostEl.querySelector('#er-btn-rec');
    const txt = this.hostEl.querySelector('#er-rec-txt');
    if (this.isRecording && this.recorder) {
      this.recorder.stop();
      this.isRecording = false;
      btn?.classList.remove('is-recording');
      if (txt) txt.textContent = 'Aufnahme';
      return;
    }

    try {
      const streamDest = this.ctx.createMediaStreamDestination();
      this.rackMonitorGain.connect(streamDest);
      this.recChunks = [];
      const rec = new MediaRecorder(streamDest.stream);
      rec.ondataavailable = (ev) => { if (ev.data.size > 0) this.recChunks.push(ev.data); };
      rec.onstop = () => {
        try { this.rackMonitorGain.disconnect(streamDest); } catch { /* ignore */ }
        const blob = new Blob(this.recChunks, { type: rec.mimeType || 'audio/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `distant-lights-${Date.now()}.webm`;
        a.click();
        URL.revokeObjectURL(url);
        this.toast('Audio-Aufnahme gespeichert');
      };
      rec.start();
      this.recorder = rec;
      this.isRecording = true;
      btn?.classList.add('is-recording');
      if (txt) txt.textContent = 'Stopp REC';
      this.toast('Eurorack-Aufnahme läuft…');
    } catch (err) {
      this.toast(`Aufnahme im Browser nicht verfügbar: ${err.message || err}`);
    }
  }

  // ───────────────────────────── Synchronisation Engine ↔ UI ──
  handleEngineChange(reason) {
    if (reason === 'transport' || reason === 'mode' || reason === 'bpm') {
      this.syncTransportUI();
    }
    if (reason === 'macro' || reason === 'lane' || reason === 'load') {
      this.syncMacrosFromEngine();
      this.syncModuleKnobsFromEngine();
      this.syncMacroAutoTags();
    }
    if (reason === 'hold') {
      this.refreshHarmonyUI?.();
      this.updateLiveChordReadout();
    }
    if (reason === 'cables' || reason === 'load') {
      this.drawCables();
    }
  }

  syncAllUI() {
    const nameEl = this.hostEl.querySelector('#er-rack-name');
    if (nameEl) nameEl.textContent = this.engine.name;
    const patchSel = this.hostEl.querySelector('#er-patch-select');
    if (patchSel) {
      if (this.engine.name === 'Distant Lights') patchSel.value = 'distant_lights';
      else if (this.engine.name.includes('Leeres')) patchSel.value = 'empty';
      else patchSel.value = 'standard';
    }
    const droneBtn = this.hostEl.querySelector('#er-btn-drone');
    if (droneBtn) {
      droneBtn.classList.toggle('on', !!this.isDroneOn);
      const span = droneBtn.querySelector('span');
      if (span) span.textContent = this.isDroneOn ? 'Drone: EIN' : 'Drone: AUS';
    }

    this.syncAudioStatus();
    this.syncTransportUI();
    this.syncMacrosFromEngine();
    this.syncModuleKnobsFromEngine();
    this.syncMacroAutoTags();
    this.refreshHarmonyUI?.();
    this.updateLiveChordReadout();
    this.drawCables();
  }

  // ───────────────────────────── Freies Tastatur-Spielen (Musical Typing) ──
  setupKeyboardPlaying() {
    const KEY_NOTE_MAP = {
      KeyA: 60, // C4
      KeyW: 61, // C#4
      KeyS: 62, // D4
      KeyE: 63, // D#4
      KeyD: 64, // E4
      KeyF: 65, // F4
      KeyT: 66, // F#4
      KeyG: 67, // G4
      KeyZ: 68, // G#4
      KeyY: 68, // G#4 (US layout)
      KeyH: 69, // A4
      KeyU: 70, // A#4
      KeyJ: 71, // H4
      KeyK: 72, // C5
      KeyO: 73, // C#5
      KeyL: 74, // D5
    };

    window.addEventListener('keydown', async (e) => {
      if (!this.isActiveView) return;
      if (e.target.closest('input, textarea, select')) return;
      if (e.repeat) return;

      if (e.code === 'KeyX') {
        this.octaveOffset = Math.max(-24, (this.octaveOffset || 0) - 12);
        this.toast(`Oktave: ${this.octaveOffset > 0 ? '+' : ''}${this.octaveOffset / 12}`);
        return;
      }
      if (e.code === 'KeyC' && !e.ctrlKey && !e.metaKey) {
        this.octaveOffset = Math.min(24, (this.octaveOffset || 0) + 12);
        this.toast(`Oktave: ${this.octaveOffset > 0 ? '+' : ''}${this.octaveOffset / 12}`);
        return;
      }

      const baseNote = KEY_NOTE_MAP[e.code];
      if (baseNote !== undefined) {
        await this.ensureAudio();
        const note = baseNote + (this.octaveOffset || 0);
        this.activeKeys.add(e.code);
        this.engine.playNote(note);
        this.updateLiveNoteDisplay(note);
      }
    });

    window.addEventListener('keyup', (e) => {
      if (!this.isActiveView) return;
      if (this.activeKeys.has(e.code)) {
        this.activeKeys.delete(e.code);
        if (this.activeKeys.size === 0 && !this.isDroneOn) {
          this.engine.stopNote();
        }
      }
    });
  }

  updateLiveNoteDisplay(note) {
    const nameEl = this.hostEl.querySelector('#er-chord-live-name');
    const notesEl = this.hostEl.querySelector('#er-chord-live-notes');
    if (nameEl) nameEl.textContent = midiToNameDe(note);
    if (notesEl) {
      const freq = (440 * Math.pow(2, (note - 69) / 12)).toFixed(1);
      notesEl.textContent = `Ton ${midiToNameDe(note)} · ${freq} Hz · MIDI ${note}`;
    }
  }

  syncAudioStatus() {
    const running = this.ctx.state === 'running';
    const led = this.hostEl.querySelector('#er-audio-led');
    const btn = this.hostEl.querySelector('#er-btn-audio');
    const txt = this.hostEl.querySelector('#er-audio-txt');
    led?.classList.toggle('on', running);
    btn?.classList.toggle('on', running);
    if (txt) txt.textContent = running ? 'Audio aktiv' : 'Audio aktivieren';
  }

  syncTransportUI() {
    const playBtn = this.hostEl.querySelector('#er-btn-play');
    playBtn?.classList.toggle('is-playing', this.engine.playing);
    this.hostEl.querySelector('#er-mode-auto')?.classList.toggle('active', this.engine.mode === 'auto');
    this.hostEl.querySelector('#er-mode-manual')?.classList.toggle('active', this.engine.mode === 'manual');
    const bpmInp = this.hostEl.querySelector('#er-bpm-input');
    if (bpmInp && document.activeElement !== bpmInp) bpmInp.value = String(this.engine.bpm);
    const nameEl = this.hostEl.querySelector('#er-rack-name');
    if (nameEl) nameEl.textContent = this.engine.name;
  }

  syncMacrosFromEngine() {
    for (const [key, ref] of this.macroKnobs.entries()) {
      const v = this.engine.macros[key] ?? 0.5;
      if (!ref.knob.isDragging) ref.knob.setValue(v, false);
      ref.valEl.textContent = `${Math.round(v * 100)} %`;
    }
  }

  syncModuleKnobsFromEngine() {
    for (const [, item] of this.paramKnobs.entries()) {
      const val = item.mod.values[item.def.id];
      if (item.knob && !item.knob.isDragging) {
        item.knob.setValue(val, false);
        item.valEl.textContent = fmtParam(item.def, val);
      } else if (item.toggleBtn) {
        const isOn = val >= 0.5;
        item.toggleBtn.classList.toggle('is-on', isOn);
        item.toggleBtn.classList.toggle('is-off', !isOn);
        item.ledEl?.classList.toggle('on', isOn);
        if (item.txtEl) item.txtEl.textContent = isOn ? 'AN' : 'AUS';
      } else if (item.updateRotary) {
        const idx = Math.max(0, item.def.choices.findIndex(([v]) => Math.abs(v - val) < 0.01));
        item.updateRotary(idx);
      }
    }
    const mixer = this.engine.modules.get('mixer');
    if (mixer) {
      const vs = this.hostEl.querySelector('#er-toolbar-vol');
      const vv = this.hostEl.querySelector('#er-toolbar-vol-val');
      const mv = mixer.values.master ?? 0.8;
      if (vs) vs.value = String(mv);
      if (vv) vv.textContent = `${Math.round(mv * 100)} %`;
    }
  }

  syncMacroAutoTags() {
    for (const [key, ref] of this.macroKnobs.entries()) {
      const isAuto = this.engine.mode === 'auto' && this.engine.laneAuto[key] !== false;
      ref.autoBtn.classList.toggle('is-auto', isAuto);
      ref.autoBtn.textContent = isAuto ? 'AUTO' : 'MANUELL ↺';
    }
  }

  updateLiveChordReadout() {
    const h = this.engine.modules.get('harmony');
    if (!h) return;
    const vis = this.engine.visual();
    const idx = clamp(vis.chordIdx ?? h.cur, 0, h.chords.length - 1);
    const ch = h.chords[idx];
    const notesStr = h.notesOf(idx).map(midiToNameDe).join(' · ');
    const bassStr = midiToNameDe(h.rootOf(idx));

    const nameEl = this.hostEl.querySelector('#er-chord-live-name');
    const notesEl = this.hostEl.querySelector('#er-chord-live-notes');
    if (nameEl) nameEl.textContent = `${ch.name}${h.hold ? ' (HALTEN)' : ''}`;
    if (notesEl) notesEl.textContent = `${notesStr} · Bass ${bassStr}`;
  }

  // ───────────────────────────── Visuelle Schleife (UI getrennt vom Audio-Timing) ──
  startVisualLoop() {
    const freqBufRack = new Uint8Array(this.rackAnalyser.frequencyBinCount);
    const freqBufRef = new Uint8Array(this.refAnalyser.frequencyBinCount);

    const step = () => {
      requestAnimationFrame(step);
      if (!this.isActiveView) return;

      this.syncAudioStatus();
      const vis = this.engine.visual();
      const totalSec = this.engine.totalSec;
      const totalBars = vis.totalBars || 60;

      // Zeitanzeige & Fortschrittsbalken
      const clockEl = this.hostEl.querySelector('#er-time-clock');
      const barEl = this.hostEl.querySelector('#er-time-bar');
      const secEl = this.hostEl.querySelector('#er-section-badge');
      const fillEl = this.hostEl.querySelector('#er-scrubber-fill');
      const headEl = this.hostEl.querySelector('#er-scrubber-head');

      if (clockEl) {
        clockEl.textContent = this.engine.mode === 'auto'
          ? `${fmtTime(vis.pos)} / ${fmtTime(totalSec)}`
          : 'FREIES SPIEL';
      }
      if (barEl) {
        barEl.textContent = this.engine.mode === 'auto'
          ? `Takt ${Math.min(totalBars, Math.floor(vis.bar) + 1)} / ${totalBars} · ${this.engine.beatsPerBar}/4`
          : 'Tastatur: [A–K] spielen · [X/C] Oktave';
      }
      if (secEl) {
        secEl.textContent = this.engine.mode === 'auto'
          ? `Abschnitt: ${vis.section?.name || (vis.ended ? 'Ende' : 'Beginn')}`
          : (this.isDroneOn ? 'Drone aktiv (Dauerton)' : 'Modus: Manuelles Spielen');
      }

      const pct = clamp((vis.bar / totalBars) * 100, 0, 100);
      if (fillEl) fillEl.style.width = `${pct}%`;
      if (headEl) headEl.style.left = `${pct}%`;

      if (this.engine.playing && this.engine.mode === 'auto') {
        this.syncMacrosFromEngine();
        this.syncModuleKnobsFromEngine();
      }
      this.updateLiveChordReadout();

      // Mixer-Spitzenpegelanzeige
      const mixer = this.engine.modules.get('mixer');
      if (mixer) {
        const m = mixer.meter();
        const barL = this.hostEl.querySelector('#er-meter-l');
        const barR = this.hostEl.querySelector('#er-meter-r');
        const dbEl = this.hostEl.querySelector('#er-meter-db');
        const clipEl = this.hostEl.querySelector('#er-clip-badge');

        const lPct = clamp(Math.pow(m.l, 0.5) * 100, 0, 100);
        const rPct = clamp(Math.pow(m.r, 0.5) * 100, 0, 100);
        if (barL) barL.style.width = `${lPct}%`;
        if (barR) barR.style.width = `${rPct}%`;

        const peak = Math.max(m.l, m.r);
        const db = peak <= 1e-4 ? '−∞ dBFS' : `${(20 * Math.log10(peak)).toFixed(1)} dBFS`;
        if (dbEl) dbEl.textContent = db;
        if (clipEl) {
          clipEl.textContent = m.clip ? 'CLIP' : 'OK';
          clipEl.classList.toggle('is-clip', m.clip);
        }
      }

      // Spektralvergleich im A/B-Deck
      if (this.showRefPanel) {
        const abCanvas = this.hostEl.querySelector('#er-ab-canvas');
        if (abCanvas) {
          this.rackAnalyser.getByteFrequencyData(freqBufRack);
          this.refAnalyser.getByteFrequencyData(freqBufRef);
          this.drawAbSpectrum(abCanvas, freqBufRack, freqBufRef);
        }
      }
    };
    requestAnimationFrame(step);
  }

  drawAbSpectrum(canvas, rackData, refData) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = '#111214';
    ctx.fillRect(0, 0, w, h);

    const bands = 32;
    const barW = w / bands;

    for (let i = 0; i < bands; i++) {
      // Logarithmische Bandzuordnung für 20 Hz … 8 kHz
      const idx0 = Math.floor(Math.pow(i / bands, 1.8) * 180);
      const idx1 = Math.max(idx0 + 1, Math.floor(Math.pow((i + 1) / bands, 1.8) * 180));
      let sumRack = 0, sumRef = 0;
      for (let b = idx0; b < idx1; b++) {
        sumRack += rackData[b] || 0;
        sumRef += refData[b] || 0;
      }
      const vRack = (sumRack / ((idx1 - idx0) * 255)) * (h - 8);
      const vRef = (sumRef / ((idx1 - idx0) * 255)) * (h - 8);

      const x = i * barW;
      // Synthese-Balken (Orange)
      ctx.fillStyle = 'rgba(240, 120, 50, 0.78)';
      ctx.fillRect(x + 1, h - vRack, barW * 0.45, vRack);

      // Referenz-Balken (Blau)
      ctx.fillStyle = 'rgba(111, 155, 209, 0.78)';
      ctx.fillRect(x + 1 + barW * 0.45, h - vRef, barW * 0.45, vRef);
    }
  }
}

