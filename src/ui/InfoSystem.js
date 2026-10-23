// SYNTHBOARD – Interaktives Info- & Handbuch-System
// Verwaltet dynamische Infoboxen/Tooltips für Buchsen, Regler und Module
// sowie das vollumfängliche interaktive Erklärungs- und Patch-Handbuch.

import { SIGNAL_COLORS } from '../modules/patchSystem.js';
import { MODULES } from '../modules/index.js';

// Beschreibungen für Buchsen & Signale
export const JACK_HELP = {
  // Master Clock
  'master_clock:clockOut': { name: 'Clock 1/16', desc: 'Gibt kontinuierliche Sechzehntel-Taktimpulse aus. Perfekt für Sequenzer und Drum-Trigger.' },
  'master_clock:div2Out': { name: 'Clock 1/8', desc: 'Gibt Achtel-Taktimpulse aus (halbe Geschwindigkeit).' },
  'master_clock:div4Out': { name: 'Clock 1/4', desc: 'Gibt Viertel-Taktimpulse aus (idealer Metronom-Puls).' },
  'master_clock:barOut': { name: '1 Bar', desc: 'Gibt einmal pro 4/4-Takt einen Impuls aus. Ideal für Takt-Resets oder langsame Akkordwechsel.' },
  'master_clock:resetOut': { name: 'Reset Out', desc: 'Sendet einen Reset-Impuls beim Starten oder bei Taktanfang.' },

  // Clock Divider
  'clock_divider:clockIn': { name: 'Clock Eingang', desc: 'Empfängt den Master-Taktimpuls, der in verschiedene Teiler zerlegt wird.' },
  'clock_divider:resetIn': { name: 'Reset Eingang', desc: 'Setzt alle internen Teilerzähler synchron auf 0 zurück.' },
  'clock_divider:outA': { name: 'Teiler Ausgang A', desc: 'Gibt den durch Regler A eingestellten Teiler-Takt aus (z. B. /1, /2, /4).' },
  'clock_divider:outB': { name: 'Teiler Ausgang B', desc: 'Gibt den durch Regler B eingestellten Teiler-Takt aus.' },
  'clock_divider:outC': { name: 'Teiler Ausgang C', desc: 'Gibt den durch Regler C eingestellten Teiler-Takt aus.' },
  'clock_divider:outD': { name: 'Teiler Ausgang D', desc: 'Gibt den durch Regler D eingestellten Teiler-Takt aus.' },

  // Euclidean
  'euclidean:clockIn': { name: 'Clock Eingang', desc: 'Schreitet mit jedem Taktimpuls einen Schritt im mathematischen Rhythmus voran.' },
  'euclidean:resetIn': { name: 'Reset Eingang', desc: 'Setzt das Muster sofort auf Schritt 1 zurück.' },
  'euclidean:gateOut': { name: 'Gate Ausgang', desc: 'Sendet rhythmische Trigger-Impulse nach dem Björklund-Algorithmus (z. B. an Drum Rack oder Pluck).' },
  'euclidean:accentOut': { name: 'Akzent Ausgang', desc: 'Sendet einen betonten Impuls auf dem allerersten Schlag des Rhythmus.' },

  // Probability Gate
  'probability_gate:gateIn': { name: 'Gate Eingang', desc: 'Eingehende Impulse werden probabilistisch (wie ein Würfelwurf) weitergeleitet.' },
  'probability_gate:gateA': { name: 'Ausgang A', desc: 'Gibt den Impuls mit Wahrscheinlichkeit P(A) aus.' },
  'probability_gate:gateB': { name: 'Ausgang B', desc: 'Gibt den Impuls mit Wahrscheinlichkeit P(B) aus.' },
  'probability_gate:altOut': { name: 'Alternierender Ausgang', desc: 'Schaltet bei jedem erfolgreichen Trigger abwechselnd zwischen zwei Wegen hin und her.' },

  // Random Walk
  'random_walk:clockIn': { name: 'Step Eingang', desc: 'Macht bei jedem Taktimpuls einen zufälligen Tonschritt nach oben oder unten.' },
  'random_walk:resetIn': { name: 'Reset Eingang', desc: 'Setzt die Melodie zurück auf den gewählten Grundton.' },
  'random_walk:pitchOut': { name: 'Pitch CV Ausgang', desc: '1V/Okt Notenspannung. Verbinde dies mit dem PITCH IN eines Instruments!' },
  'random_walk:gateOut': { name: 'Gate Ausgang', desc: 'Gibt bei jedem Tonhöhenwechsel einen Trigger-Impuls aus.' },

  // Scale Quantizer
  'scale_quantizer:pitchIn': { name: 'Unquantisierte CV', desc: 'Empfängt frei schwebende Spannungen (z. B. von LFOs oder Rauschen).' },
  'scale_quantizer:clockIn': { name: 'Latch Trigger', desc: 'Friert den Tonhöhenwert taktgenau ein.' },
  'scale_quantizer:pitchOut': { name: 'Quantisierte Pitch CV', desc: 'Gibt den Ton exakt eingerastet auf die gewählte Skala (z. B. Moll/Dur/Dorisch) aus.' },
  'scale_quantizer:gateOut': { name: 'Gate Ausgang', desc: 'Sendet einen Anschlag-Trigger bei jedem neu erkannten Notensprung.' },

  // Slow Random
  'slow_random:clockIn': { name: 'S&H Clock Eingang', desc: 'Taktimpuls für die Sample & Hold Stufe: Tastet das Rauschen ab und hält den Wert.' },
  'slow_random:modOut': { name: 'Glatter LFO CV', desc: 'Organisch driftende Steuerspannung. Perfekt für Filter Cutoff oder Hall-Größe.' },
  'slow_random:shOut': { name: 'Sample & Hold CV', desc: 'Stufenförmige Zufallsspannung für rhythmische Roboter-Modulationen.' },

  // Macro Controller
  'macro_controller:macro1Out': { name: 'Macro 1 CV', desc: 'Steuerspannung für Regler 1. Kann an beliebige Modulations-Eingänge gepatcht werden.' },
  'macro_controller:macro2Out': { name: 'Macro 2 CV', desc: 'Steuerspannung für Regler 2.' },
  'macro_controller:macro3Out': { name: 'Macro 3 CV', desc: 'Steuerspannung für Regler 3.' },
  'macro_controller:morphOut': { name: 'Morph CV', desc: 'Überblendet fließend zwischen verschiedenen Modulationszuständen.' },

  // Drone
  'drone:gateIn': { name: 'Gate / Swell In', desc: 'Triggert ein sanftes Anschwellen der Drone-Akkorde.' },
  'drone:modCutoff': { name: 'Filter CV', desc: 'Moduliert die Klangfarbe / Filter-Eckfrequenz des Drones.' },
  'drone:modSpread': { name: 'Spread CV', desc: 'Moduliert die harmonische Verstimmung und Schwebung der 6 Oszillatoren.' },

  // Keys
  'keys:gateIn': { name: 'Gate Eingang', desc: 'Triggert Notenanschläge der Keys-Stimme.' },
  'keys:pitchIn': { name: 'Pitch CV Eingang', desc: 'Steuert die Tonhöhe (1V/Okt Standard).' },
  'keys:modCutoff': { name: 'Filter CV', desc: 'Öffnet oder schließt dynamisch das Tiefpassfilter der Tastenstimme.' },

  // Sequencer
  'sequencer:clockIn': { name: 'Clock Eingang', desc: 'Taktet den 8-Schritt-Sequenzer weiter.' },
  'sequencer:gateOut': { name: 'Gate Ausgang', desc: 'Gibt Gates der aktiven Sequenzer-Schritte aus.' },
  'sequencer:pitchOut': { name: 'Pitch CV Ausgang', desc: 'Gibt die Tonhöhen der einzelnen Sequenzer-Schritte im 1V/Okt Format aus.' },

  // Pluck Synth
  'pluck:gateIn': { name: 'Gate Eingang', desc: 'Löst das akustische Anzupfen der Saite / Klangstäbe aus.' },
  'pluck:pitchIn': { name: 'Pitch CV Eingang', desc: 'Bestimmt die Tonhöhe der gezupften Saite.' },
  'pluck:modCutoff': { name: 'Filter CV', desc: 'Moduliert die Dämpfung und Helligkeit des Saitenklangs.' },

  // FM Voice
  'fm_voice:gateIn': { name: 'Gate Eingang', desc: 'Startet den Anschlag der FM-Operatoren.' },
  'fm_voice:pitchIn': { name: 'Pitch CV Eingang', desc: 'Bestimmt die Grundfrequenz der FM-Stimme.' },
  'fm_voice:modIndex': { name: 'FM Index CV', desc: 'Moduliert den Obertongehalt und die metallische Brillanz in Echtzeit.' },

  // Bass Synth
  'bass:gateIn': { name: 'Gate Eingang', desc: 'Löst den Attack-Punch der Bass-Hüllkurve aus.' },
  'bass:pitchIn': { name: 'Pitch CV Eingang', desc: 'Steuert die Tonhöhe des analogen Bass-Synthesizers.' },
  'bass:modCutoff': { name: 'Cutoff CV', desc: 'Moduliert die saftige Filterresonanz des Acid-Filters.' },

  // Drum Rack
  'drum_rack:kickIn': { name: 'Kick Trigger', desc: 'Triggert die tiefe analoge Bass-Drum.' },
  'drum_rack:snareIn': { name: 'Snare Trigger', desc: 'Triggert die knackige Snare mit Rausch-Teppich.' },
  'drum_rack:hhIn': { name: 'Hi-Hat Trigger', desc: 'Triggert die metallische Hi-Hat.' },
  'drum_rack:percIn': { name: 'Percussion Trigger', desc: 'Triggert den resonanten Rimshot / Holz-Percussion-Klang.' },

  // Filter Effekt
  'filter:cvCutoff': { name: 'Cutoff CV', desc: 'Moduliert die Filterfrequenz von außen (z. B. durch Slow Random oder LFO).' },

  // Delay Effekt
  'delay:cvTime': { name: 'Time CV', desc: 'Moduliert die Verzögerungszeit des Tape Delays für Tape-Pitch-Warble.' },
};

// Beschreibungen für Regler
export const KNOB_HELP = {
  tempo: 'Regelt das Master-Tempo in BPM (Beats per Minute). Hält alle Rhythmen und Sequenzen im gemeinsamen Takt.',
  swing: 'Verschiebt ungerade Sechzehntel-Noten leicht nach hinten für einen lebendigen, jazzigen Groove.',
  steps: 'Anzahl der Schritte im Zyklus (z. B. 8 oder 16 Steps).',
  pulses: 'Anzahl der gleichmäßig im Zyklus verteilten rhythmischen Schläge (Björklund-Algorithmus).',
  rotate: 'Verschiebt den Startpunkt des Rhythmus um eine definierte Anzahl von Schritten im Kreis.',
  cutoff: 'Eckfrequenz des Filters in Hz. Bestimmt, ab welcher Frequenz Obertöne abgeschnitten werden.',
  reso: 'Filter-Resonanz. Betont Frequenzen nahe der Grenzfrequenz und erzeugt den typischen Synthie-Pfeifklang.',
  drive: 'Analoge Sättigung & Röhrenwärme. Färbt das Signal mit harmonischen Obertönen ein.',
  attack: 'Anstiegszeit vom Moment des Tastendrucks bis zur vollen Lautstärke.',
  decay: 'Abklingzeit des Tons nach dem ersten Anschlag.',
  release: 'Ausklingzeit des Tons, nachdem die Taste oder das Gate losgelassen wurde.',
  feedback: 'Rückkopplung des Delays. Bestimmt, wie viele Echos ertönen, bevor sie verstummen.',
  time: 'Verzögerungszeit zwischen den Echo-Wiederholungen.',
  rate: 'Geschwindigkeit der rhythmischen oder tonalen Oszillation (LFO).',
  depth: 'Intensität der Modulation – wie stark der Zielwert schwankt.',
  mix: 'Mischverhältnis zwischen unbearbeitetem Originalsignal (Dry) und dem Effektsignal (Wet).',
  spread: 'Stereoverbreiterung und gegenseitige harmonische Verstimmung von Oszillatoren.',
  ratio: 'Frequenzverhältnis zwischen Träger- und Modulator-Oszillator bei FM-Synthese.',
  index: 'FM-Modulationstiefe. Höhere Werte erzeugen scharfe, metallische und glockenartige Obertöne.',
  crackle: 'Intensität des analogen Vinyl-Knisterns und Staub-Rauschens.',
  motion: 'Sanfte Wind- und Meeresrauschen-Schwankungen des Rauschgenerators.',
};

export class InfoSystem {
  constructor(engine, patchBay) {
    this.engine = engine;
    this.patchBay = patchBay;
    this.enabled = localStorage.getItem('synthboard:infoboxes') !== 'false'; // Standard: aktiviert

    this.tooltipEl = null;
    this.guideModalEl = null;
    this.currentHoverEl = null;
    this.hideTimeout = null;

    this.initDom();
    this.bindEvents();
    this.updateToggleState();
  }

  initDom() {
    // 1. Floating Tooltip Element
    this.tooltipEl = document.createElement('div');
    this.tooltipEl.id = 'synth-infobox';
    this.tooltipEl.className = 'synth-infobox';
    this.tooltipEl.setAttribute('role', 'tooltip');
    this.tooltipEl.setAttribute('aria-hidden', 'true');
    document.body.appendChild(this.tooltipEl);

    // 2. Erklärungs- & Handbuch-Modal
    this.createGuideModal();
  }

  toggle() {
    this.enabled = !this.enabled;
    localStorage.setItem('synthboard:infoboxes', String(this.enabled));
    this.updateToggleState();
    this.hideTooltip();
    return this.enabled;
  }

  updateToggleState() {
    const btn = document.querySelector('#btn-info');
    if (btn) {
      btn.classList.toggle('on', this.enabled);
      const txt = btn.querySelector('.txt');
      if (txt) txt.textContent = this.enabled ? 'INFO: AN' : 'INFO: AUS';
    }
    document.body.classList.toggle('infoboxes-enabled', this.enabled);
  }

  showTooltip(targetEl, contentHtml, borderColor = null) {
    if (!this.enabled) return;
    if (this.patchBay?.activeDrag) return; // Nicht anzeigen während Kabel gezogen werden

    clearTimeout(this.hideTimeout);
    this.currentHoverEl = targetEl;

    this.tooltipEl.innerHTML = contentHtml;
    this.tooltipEl.style.setProperty('--info-accent', borderColor || 'var(--accent)');
    this.tooltipEl.classList.add('visible');
    this.tooltipEl.setAttribute('aria-hidden', 'false');

    this.positionTooltip(targetEl);
  }

  positionTooltip(targetEl) {
    const rect = targetEl.getBoundingClientRect();
    const ttRect = this.tooltipEl.getBoundingClientRect();
    const margin = 12;

    let top = rect.top - ttRect.height - 8;
    let left = rect.left + rect.width / 2 - ttRect.width / 2;

    // Wenn oben nicht genug Platz ist, unterhalb platzieren
    if (top < 10) {
      top = rect.bottom + 8;
    }

    // Horizontal im Viewport halten
    if (left < margin) left = margin;
    if (left + ttRect.width > window.innerWidth - margin) {
      left = window.innerWidth - margin - ttRect.width;
    }

    this.tooltipEl.style.top = `${Math.round(top)}px`;
    this.tooltipEl.style.left = `${Math.round(left)}px`;
  }

  hideTooltip() {
    this.currentHoverEl = null;
    if (this.tooltipEl) {
      this.tooltipEl.classList.remove('visible');
      this.tooltipEl.setAttribute('aria-hidden', 'true');
    }
  }

  bindEvents() {
    // Info-Toggle Button in der Topbar
    const btnInfo = document.querySelector('#btn-info');
    if (btnInfo) {
      btnInfo.addEventListener('click', () => {
        const state = this.toggle();
        const toast = document.querySelector('#toast');
        if (toast) {
          toast.textContent = state ? '💡 Infoboxen aktiviert' : '💡 Infoboxen deaktiviert';
          toast.classList.add('show');
          setTimeout(() => toast.classList.remove('show'), 2000);
        }
      });
    }

    // Handbuch / Guide Button
    const btnGuide = document.querySelector('#btn-guide');
    if (btnGuide) {
      btnGuide.addEventListener('click', () => this.openGuide());
    }

    // Footer Guide Link
    const footerGuide = document.querySelector('#btn-guide-footer');
    if (footerGuide) {
      footerGuide.addEventListener('click', (e) => {
        e.preventDefault();
        this.openGuide();
      });
    }

    // Keyboard Shortcuts: 'i' für Info-Toggle, 'h' für Handbuch
    window.addEventListener('keydown', (e) => {
      const isTyping = (el) => el && ((el.tagName === 'INPUT' && el.type !== 'range') || el?.tagName === 'TEXTAREA' || el?.tagName === 'SELECT');
      if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key.toLowerCase() === 'i') {
        e.preventDefault();
        this.toggle();
      } else if (e.key.toLowerCase() === 'h' || e.key === '?') {
        e.preventDefault();
        this.openGuide();
      } else if (e.key === 'Escape' && this.guideModalEl.classList.contains('open')) {
        this.closeGuide();
      }
    });

    // Globale Delegation für Buchsen, Regler und Module
    document.addEventListener('mouseover', (e) => {
      if (!this.enabled || this.patchBay?.activeDrag) return;

      // 1. Jack (Buchse)
      const jackEl = e.target.closest('.hw-jack, .jack-socket-wrap');
      if (jackEl) {
        const actualJack = jackEl.classList.contains('hw-jack') ? jackEl : jackEl.querySelector('.hw-jack');
        if (actualJack) this.handleJackHover(actualJack);
        return;
      }

      // 2. Modul-Info Button
      const infoBtn = e.target.closest('.mod-info-btn');
      if (infoBtn) {
        const card = infoBtn.closest('.module-card');
        if (card) this.handleModuleHover(card, infoBtn);
        return;
      }

      // 3. Knob (Regler)
      const knobCell = e.target.closest('.knob-cell');
      if (knobCell) {
        this.handleKnobHover(knobCell);
        return;
      }
    });

    document.addEventListener('mouseout', (e) => {
      if (!this.currentHoverEl) return;
      if (e.target.closest('.hw-jack, .jack-socket-wrap, .mod-info-btn, .knob-cell')) {
        this.hideTimeout = setTimeout(() => this.hideTooltip(), 60);
      }
    });
  }

  handleJackHover(jackEl) {
    const key = jackEl.dataset.jackKey; // `${moduleId}:${portId}`
    if (!key) return;
    const [modId, portId] = key.split(':');
    const mod = this.engine.find(modId);
    if (!mod) return;

    const jMeta = mod.meta.jacks?.find((j) => j.id === portId);
    if (!jMeta) return;

    const typeLabel = jMeta.type === 'out' ? 'AUSGANG (OUT)' : 'EINGANG (IN)';
    const sigColor = SIGNAL_COLORS[jMeta.signal] || '#fbbf24';
    const sigNames = {
      gate: 'Gate / Trigger (Impuls)',
      pitch: 'Pitch CV (Tonhöhe 1V/Okt)',
      mod: 'Modulation CV (LFO/Spannung)',
      clock: 'Clock / Sync (Takt)',
      audio: 'Audiosignal',
    };
    const sigName = sigNames[jMeta.signal] || jMeta.signal.toUpperCase();

    // Suche Verbindungen
    const conns = this.engine.patchSystem.getConnections();
    const activeConns = conns.filter(c =>
      (jMeta.type === 'out' && c.fromModuleId === modId && c.fromPortId === portId) ||
      (jMeta.type === 'in' && c.toModuleId === modId && c.toPortId === portId)
    );

    let statusText = '';
    if (activeConns.length > 0) {
      const targets = activeConns.map(c => {
        const otherId = jMeta.type === 'out' ? c.toModuleId : c.fromModuleId;
        const otherPort = jMeta.type === 'out' ? c.toPortId : c.fromPortId;
        const otherMod = this.engine.find(otherId);
        return `<b>${otherMod?.meta.title || otherId}</b> (${otherPort})`;
      }).join(', ');
      statusText = `<div class="info-conn-state connected">🔌 Verbunden mit: ${targets}<br><small>Rechtsklick auf Buchse trennt Kabel</small></div>`;
    } else {
      statusText = `<div class="info-conn-state empty">⚪ Nicht verbunden<br><small>Klicke &amp; ziehe zu einem ${jMeta.type === 'out' ? 'Eingang' : 'Ausgang'}</small></div>`;
    }

    // Spezifische Buchsen-Erklärung aus Wörterbuch oder generisch
    const lookupKey = `${mod.meta.type}:${portId}`;
    const specificHelp = JACK_HELP[lookupKey]?.desc || `Überträgt ein ${sigName}-Signal für ${mod.meta.title}.`;

    const html = `
      <div class="info-badge-row">
        <span class="info-badge ${jMeta.type}">${typeLabel}</span>
        <span class="info-badge sig" style="background:${sigColor}22; color:${sigColor}; border-color:${sigColor}55;">${sigName}</span>
      </div>
      <div class="info-title">${mod.meta.title} · <b>${jMeta.label}</b></div>
      <div class="info-desc">${specificHelp}</div>
      ${statusText}
    `;

    this.showTooltip(jackEl, html, sigColor);
  }

  handleKnobHover(knobCell) {
    const labelEl = knobCell.querySelector('.k-label');
    const valEl = knobCell.querySelector('.k-val');
    if (!labelEl) return;

    const labelText = labelEl.textContent.trim();
    const valText = valEl ? valEl.textContent.trim() : '';

    // Such-Key normalisieren
    const normKey = labelText.toLowerCase()
      .replace(/[^a-z]/g, '');

    let desc = KNOB_HELP[normKey];
    if (!desc) {
      // Fallbacks
      if (normKey.includes('cut')) desc = KNOB_HELP.cutoff;
      else if (normKey.includes('res')) desc = KNOB_HELP.reso;
      else if (normKey.includes('vol') || normKey.includes('level')) desc = 'Regelt die Ausgabelautstärke dieses Moduls.';
      else if (normKey.includes('decay') || normKey.includes('damp')) desc = KNOB_HELP.decay;
      else if (normKey.includes('att')) desc = KNOB_HELP.attack;
      else if (normKey.includes('rel')) desc = KNOB_HELP.release;
      else desc = `Steuert den Parameter „${labelText}“. Doppelklick setzt auf Standardwert zurück.`;
    }

    const html = `
      <div class="info-title">Regler: <b>${labelText}</b> <span class="info-val-badge">${valText}</span></div>
      <div class="info-desc">${desc}</div>
      <div class="info-hint"><small>Tipp: Ziehen zum Einstellen · Doppelklick für Standard</small></div>
    `;

    this.showTooltip(knobCell, html, 'var(--accent)');
  }

  handleModuleHover(card, btn) {
    const modId = card.dataset.id;
    const mod = this.engine.find(modId);
    if (!mod) return;
    const M = mod.meta;

    const catLabels = {
      control: 'Steuerung & Generatoren',
      source: 'Klangquelle & Stimme',
      effect: 'Effektkette',
    };

    const jackList = (M.jacks || []).map(j => {
      const col = SIGNAL_COLORS[j.signal] || '#aaa';
      return `<span class="info-pill" style="border-left: 3px solid ${col};">${j.type.toUpperCase()}: ${j.label}</span>`;
    }).join('');

    const html = `
      <div class="info-badge-row">
        <span class="info-badge ${M.category}">${catLabels[M.category] || M.category}</span>
      </div>
      <div class="info-title">${M.icon} <b>${M.title}</b></div>
      <div class="info-desc">${M.description}</div>
      ${jackList ? `<div class="info-jacks-preview"><b>Patch-Buchsen:</b><div class="pills-wrap">${jackList}</div></div>` : ''}
    `;

    this.showTooltip(btn, html, M.color);
  }

  // ───────────────────────── Handbuch / Erklärungs-Modal ──
  createGuideModal() {
    this.guideModalEl = document.createElement('div');
    this.guideModalEl.id = 'guide-modal';
    this.guideModalEl.className = 'guide-modal';
    this.guideModalEl.innerHTML = `
      <div class="guide-backdrop"></div>
      <div class="guide-window">
        <header class="guide-header">
          <div class="guide-title-wrap">
            <span class="guide-logo">⚡</span>
            <div>
              <h2>SYNTHBOARD Studio Handbuch</h2>
              <p>Modulare Synthese, Patch-Kabel &amp; Modul-Lexikon leicht verständlich erklärt</p>
            </div>
          </div>
          <button class="guide-close" title="Handbuch schließen [Esc]">✕</button>
        </header>

        <nav class="guide-tabs">
          <button class="guide-tab-btn active" data-tab="tab-cables">🔌 Kabel verbinden</button>
          <button class="guide-tab-btn" data-tab="tab-zones">🎛️ Die 3 Rack-Zonen</button>
          <button class="guide-tab-btn" data-tab="tab-modules">📚 Modul-Lexikon</button>
          <button class="guide-tab-btn" data-tab="tab-recipes">⚡ Schnelleinstieg &amp; Rezepte</button>
        </nav>

        <main class="guide-body">
          <!-- TAB 1: KABEL & PATCHING -->
          <section id="tab-cables" class="guide-tab-pane active">
            <div class="guide-hero">
              <h3>So verbindest du modulare Patch-Kabel</h3>
              <p>In SYNTHBOARD kannst du Steuersignale frei wie bei einem echten modularen Eurorack-Synthesizer verdrahten. Jedes Kabel transportiert musikalische Signale von einer Buchse zur nächsten.</p>
            </div>

            <div class="guide-steps-grid">
              <div class="guide-step-card">
                <div class="step-num">1</div>
                <h4>Kabel ziehen</h4>
                <p>Klicke mit der linken Maustaste auf eine beliebige <b>Buchse</b> (Eingang oder Ausgang) und halte die Taste gedrückt. Ziehe das Kabel zur gewünschten Zielbuchse und lasse los.</p>
              </div>

              <div class="guide-step-card">
                <div class="step-num">2</div>
                <h4>Kabel trennen</h4>
                <p>Mache einen <b>Rechtsklick</b> auf eine belegte Buchse, um die Verbindung sofort zu kappen. Alternativ kannst du auf das Kabelende klicken und ins Leere fallen lassen.</p>
              </div>

              <div class="guide-step-card">
                <div class="step-num">3</div>
                <h4>Eurorack-Regel</h4>
                <p><b>Ausgänge (OUT)</b> können ihr Signal an beliebig viele Eingänge verzweigen (Multiple). <b>Eingänge (IN)</b> empfangen immer genau 1 Signal zur selben Zeit.</p>
              </div>

              <div class="guide-step-card">
                <div class="step-num">4</div>
                <h4>Kabel ausblenden</h4>
                <p>Mit dem <b>KABEL</b>-Button oben rechts kannst du alle Verbindungskabel temporär unsichtbar schalten, wenn dir das Board zu voll wird. Der Ton läuft ununterbrochen weiter!</p>
              </div>
            </div>

            <h3 style="margin-top:28px; margin-bottom:12px;">Die 4 Signaltypen &amp; Kabelfarben</h3>
            <div class="signal-types-table">
              <div class="sig-row" style="border-left: 4px solid #06b6d4;">
                <span class="sig-pill" style="background:#06b6d422; color:#06b6d4;">CLOCK (Cyan)</span>
                <div class="sig-details">
                  <b>Takt &amp; Gleichlauf</b> · Kontinuierliche Taktschläge (1/16, 1/8, Viertel). Hält Master Clock, Clock Divider, Sequenzer und Euklidische Rhythmen synchron zusammen.
                </div>
              </div>

              <div class="sig-row" style="border-left: 4px solid #fbbf24;">
                <span class="sig-pill" style="background:#fbbf2422; color:#fbbf24;">GATE / TRIGGER (Gold)</span>
                <div class="sig-details">
                  <b>Anschlag &amp; Rhythmus</b> · Kurze Impulsstöße. Löst Töne in Instrumenten aus (z. B. Pluck Synth, Keys, FM Voice oder Kick/Snare im Drum Rack).
                </div>
              </div>

              <div class="sig-row" style="border-left: 4px solid #a855f7;">
                <span class="sig-pill" style="background:#a855f722; color:#a855f7;">PITCH CV (Lila)</span>
                <div class="sig-details">
                  <b>Tonhöhe &amp; Melodie (1V/Okt)</b> · Überträgt musikalische Tonhöhen. Kommt von Sequenzer, Random Walk oder Scale Quantizer und steuert die Notenhöhe in Klangerzeugern.
                </div>
              </div>

              <div class="sig-row" style="border-left: 4px solid #10b981;">
                <span class="sig-pill" style="background:#10b98122; color:#10b981;">MODULATION (Grün)</span>
                <div class="sig-details">
                  <b>Fließende Steuerspannung</b> · Langsame Schwingungen von LFOs, Rauschgeneratoren oder Makro-Reglern. Moduliert Filter-Cutoff, Delay-Zeit oder Hall.
                </div>
              </div>
            </div>
          </section>

          <!-- TAB 2: ZONEN -->
          <section id="tab-zones" class="guide-tab-pane">
            <div class="guide-hero">
              <h3>Die 3 Rack-Zonen und der Signalfluss</h3>
              <p>SYNTHBOARD kombiniert das Beste aus zwei Welten: Freies modulares Kabel-Patching für Modulation und Rhythmus, plus eine intuitive Audiokette mit automatischem Mixing.</p>
            </div>

            <div class="zones-explainer">
              <div class="zone-box ctrl-border">
                <div class="zone-badge">Zone 1 (Oben)</div>
                <h4>🧠 Steuerung &amp; Generatoren</h4>
                <p>Master Clock, Clock Divider, Euklidische Rhythmen, Wahrscheinlichkeits-Gates, Random Walk, Scale Quantizer, Slow Random und Macro Controller.</p>
                <div class="zone-note">Hier entsteht die musikalische Intelligenz: Takt, Zufall, Melodie und dynamische Modulationen werden über Kabel an die Instrumente weitergegeben.</div>
              </div>

              <div class="zone-connector">⬇ Steuer- &amp; Gate-Impulse fließen per Kabel nach unten</div>

              <div class="zone-box src-border">
                <div class="zone-badge">Zone 2 (Mitte)</div>
                <h4>🔊 Klangquellen &amp; Instrumente</h4>
                <p>Drone Machine, Pluck Synth, FM Voice, Analog Bass, Drum Rack, Poly Keys, Sequencer, Noise Generator.</p>
                <div class="zone-note">Alle Klangquellen laufen parallel und erzeugen Sound, sobald sie über Kabel oder Tastatur angetriggert werden. Ihre Audiosignale werden automatisch sauber auf den gemeinsamen Quellen-Bus gemischt.</div>
              </div>

              <div class="zone-connector">⬇ Audiosignal fließt als Stereo-Summe in die Effektkette</div>

              <div class="zone-box fx-border">
                <div class="zone-badge">Zone 3 (Unten)</div>
                <h4>✨ Die Effektkette (Serieller Signalfluss)</h4>
                <p>Filter ➜ Chorus ➜ Tremolo ➜ Lo-Fi Bitcrusher ➜ Tape Delay ➜ Ambient Reverb ➜ Master Limiter.</p>
                <div class="zone-note">Das Signal durchwandert die Effekte von links nach rechts. Du kannst Module per Drag &amp; Drop oder mit den ◀ ▶ Pfeilen beliebig vertauschen, um neue Klanglandschaften zu formen.</div>
              </div>
            </div>
          </section>

          <!-- TAB 3: MODUL-LEXIKON -->
          <section id="tab-modules" class="guide-tab-pane">
            <div class="module-search-bar">
              <input type="text" id="guide-module-search" placeholder="🔍 Modul oder Funktion suchen (z. B. Clock, Bass, Reverb, Euclidean)..." />
              <div class="filter-pills">
                <button class="pill active" data-cat="all">Alle (18)</button>
                <button class="pill" data-cat="control">Steuerung (8)</button>
                <button class="pill" data-cat="source">Klangquellen (8)</button>
                <button class="pill" data-cat="effect">Effekte (6)</button>
              </div>
            </div>

            <div id="guide-modules-list" class="guide-modules-list">
              <!-- Dynamisch befüllt aus MODULES -->
            </div>
          </section>

          <!-- TAB 4: REZEPTE & SCHNELLEINSTIEG -->
          <section id="tab-recipes" class="guide-tab-pane">
            <div class="guide-hero">
              <h3>Praxis-Rezepte zum schnellen Nachbauen</h3>
              <p>Verbinde Module nach diesen einfachen Schemata, um sofort packende musikalische Ergebnisse zu erzielen:</p>
            </div>

            <div class="recipes-grid">
              <div class="recipe-card">
                <div class="recipe-tag">Rezept 1 · Ambient &amp; Dream</div>
                <h4>Organische Zupf-Melodien</h4>
                <p>Erzeugt endlose, meditative Harfen- und Kalimba-Muster, die nie gleich klingen.</p>
                <ol class="recipe-steps">
                  <li>Füge <b>Master Clock</b>, <b>Euclidean Rhythm</b>, <b>Random Walk</b> und <b>Pluck Synth</b> hinzu.</li>
                  <li>Verbinde <code>Master Clock: 1/16</code> ➜ <code>Euclidean: CLOCK</code></li>
                  <li>Verbinde <code>Euclidean: GATE</code> ➜ <code>Random Walk: STEP</code></li>
                  <li>Verbinde <code>Random Walk: PITCH CV</code> ➜ <code>Pluck: PITCH</code></li>
                  <li>Verbinde <code>Euclidean: GATE</code> ➜ <code>Pluck: GATE</code></li>
                  <li>Stelle Delay und Reverb in der Effektkette an für weite Räume!</li>
                </ol>
              </div>

              <div class="recipe-card">
                <div class="recipe-tag">Rezept 2 · Beats &amp; Groove</div>
                <h4>Modularer Polyrhythmus</h4>
                <p>Treibt Drum Rack und Bassline mit ungeraden mathematischen Akzenten an.</p>
                <ol class="recipe-steps">
                  <li>Füge <b>Master Clock</b>, <b>Clock Divider</b>, <b>Euclidean</b> und <b>Drum Rack</b> hinzu.</li>
                  <li>Verbinde <code>Master Clock: 1/16</code> ➜ <code>Clock Divider: CLOCK</code></li>
                  <li>Verbinde <code>Clock Divider: /4</code> ➜ <code>Drum Rack: KICK</code> (Solider 4-on-the-Floor)</li>
                  <li>Verbinde <code>Clock Divider: /8</code> ➜ <code>Drum Rack: SNARE</code></li>
                  <li>Verbinde <code>Master Clock: 1/16</code> ➜ <code>Euclidean: CLOCK</code> (z. B. 7 Steps, 3 Hits)</li>
                  <li>Verbinde <code>Euclidean: GATE</code> ➜ <code>Drum Rack: HI-HAT</code></li>
                </ol>
              </div>

              <div class="recipe-card">
                <div class="recipe-tag">Rezept 3 · Sounddesign</div>
                <h4>Lebendige Filter-Sweeps</h4>
                <p>Haucht statischen Drones oder Synthesizern organisches Leben ein.</p>
                <ol class="recipe-steps">
                  <li>Füge <b>Slow Random</b> und <b>Analog Filter</b> hinzu.</li>
                  <li>Verbinde <code>Slow Random: SMOOTH CV</code> ➜ <code>Filter: CUTOFF CV</code></li>
                  <li>Drehe am Slow Random den Regler <i>Rate</i> auf ca. 0.1 Hz und <i>Tiefe</i> auf 70%.</li>
                  <li>Das Filter atmet nun langsam wie eine Meereswelle.</li>
                </ol>
              </div>
            </div>

            <h3 style="margin-top:28px; margin-bottom:12px;">Hilfreiche Tastatur-Shortcuts</h3>
            <div class="shortcuts-grid">
              <div class="sc-item"><kbd>I</kbd><span>Infoboxen an- / ausschalten</span></div>
              <div class="sc-item"><kbd>H</kbd> oder <kbd>?</kbd><span>Dieses Handbuch öffnen</span></div>
              <div class="sc-item"><kbd>A</kbd> – <kbd>K</kbd><span>Keys-Synthesizer auf Tastatur spielen</span></div>
              <div class="sc-item"><kbd>Esc</kbd><span>Handbuch oder Dialoge schließen</span></div>
              <div class="sc-item"><kbd>Doppelklick</kbd><span>Jeden Regler auf Standardwert zurücksetzen</span></div>
              <div class="sc-item"><kbd>Rechtsklick</kbd><span>Kabel von Buchse trennen</span></div>
            </div>
          </section>
        </main>
      </div>
    `;

    document.body.appendChild(this.guideModalEl);

    // Modal Events
    this.guideModalEl.querySelector('.guide-close').addEventListener('click', () => this.closeGuide());
    this.guideModalEl.querySelector('.guide-backdrop').addEventListener('click', () => this.closeGuide());

    // Tabs umschalten
    const tabBtns = this.guideModalEl.querySelectorAll('.guide-tab-btn');
    const panes = this.guideModalEl.querySelectorAll('.guide-tab-pane');
    tabBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        panes.forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        const targetPane = this.guideModalEl.querySelector(`#${btn.dataset.tab}`);
        if (targetPane) targetPane.classList.add('active');
      });
    });

    // Modul-Lexikon rendern & Suche
    this.renderGuideModulesList();
    this.setupGuideSearch();
  }

  renderGuideModulesList(filterCat = 'all', searchQuery = '') {
    const container = this.guideModalEl.querySelector('#guide-modules-list');
    if (!container) return;

    const query = searchQuery.trim().toLowerCase();
    const modules = Object.values(MODULES).filter(M => {
      if (filterCat !== 'all' && M.category !== filterCat) return false;
      if (!query) return true;
      return (
        M.title.toLowerCase().includes(query) ||
        M.description.toLowerCase().includes(query) ||
        M.category.toLowerCase().includes(query) ||
        (M.jacks || []).some(j => j.label.toLowerCase().includes(query) || j.signal.toLowerCase().includes(query))
      );
    });

    if (modules.length === 0) {
      container.innerHTML = '<div class="guide-empty-search">Kein Modul gefunden für diese Suche.</div>';
      return;
    }

    container.innerHTML = modules.map(M => {
      const jacksHtml = (M.jacks && M.jacks.length)
        ? `<div class="g-mod-jacks">
            <b>Buchsen:</b>
            <div class="g-jacks-row">
              ${M.jacks.map(j => {
                const col = SIGNAL_COLORS[j.signal] || '#aaa';
                return `<span class="g-jack-chip" style="border-color:${col}55;">
                  <span class="chip-dot" style="background:${col};"></span>
                  <span class="chip-type">${j.type.toUpperCase()}:</span>
                  <span class="chip-name">${j.label}</span>
                  <small>(${j.signal})</small>
                </span>`;
              }).join('')}
            </div>
           </div>`
        : '';

      const paramsHtml = (M.params && M.params.length)
        ? `<div class="g-mod-params">
            <b>Regler:</b> ${M.params.map(p => `<code>${p.label}</code>`).join(', ')}
           </div>`
        : '';

      return `
        <article class="g-mod-card" style="--card-color:${M.color};">
          <header class="g-mod-head">
            <span class="g-mod-icon">${M.icon}</span>
            <div class="g-mod-titles">
              <h4>${M.title}</h4>
              <span class="g-mod-cat">${M.category === 'control' ? 'Steuerung' : M.category === 'source' ? 'Klangquelle' : 'Effekt'}</span>
            </div>
          </header>
          <p class="g-mod-desc">${M.description}</p>
          ${paramsHtml}
          ${jacksHtml}
        </article>
      `;
    }).join('');
  }

  setupGuideSearch() {
    const searchInput = this.guideModalEl.querySelector('#guide-module-search');
    const pills = this.guideModalEl.querySelectorAll('.filter-pills .pill');
    let currentCat = 'all';

    pills.forEach(pill => {
      pill.addEventListener('click', () => {
        pills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        currentCat = pill.dataset.cat;
        this.renderGuideModulesList(currentCat, searchInput.value);
      });
    });

    searchInput.addEventListener('input', () => {
      this.renderGuideModulesList(currentCat, searchInput.value);
    });
  }

  openGuide(targetTab = null) {
    this.hideTooltip();
    this.guideModalEl.classList.add('open');
    if (targetTab) {
      const tabBtn = this.guideModalEl.querySelector(`.guide-tab-btn[data-tab="${targetTab}"]`);
      if (tabBtn) tabBtn.click();
    }
  }

  closeGuide() {
    this.guideModalEl.classList.remove('open');
  }
}
