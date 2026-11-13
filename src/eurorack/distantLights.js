// SYNTHBOARD · Eurorack – Rack „Distant Lights“ (vorkonfiguriert, verkabelt, mit 4-Minuten-Aufbau)
//
// HERKUNFT DER WERTE (siehe Bedienanleitung): Die Startbereiche stammen aus der Aufgabenstellung
// und aus der Messung des Referenz-Vollmixes (Pegelverlauf, Bandverteilung, Spektralpeaks).
// Es sind eigene gestalterische Entscheidungen – KEINE Originaleinstellungen von M83.
import { STATE_FORMAT, STATE_VERSION, MACROS } from './engine.js';
import { DEFAULT_CHORDS } from './modules.js';

const MACRO_START = { bright: 0.5, width: 0.75, motion: 0.35, density: 0.5, space: 0.35 };

function chordPlan() {
  // 15 Akkorde à 4 Takte = 60 Takte: Hm G D A | Hm G D A | Hm G D A | G D Hm
  const seq = [0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3, 1, 2, 0];
  return seq.map((chord) => ({ chord, bars: 4 }));
}

export function buildDistantLights() {
  const values = {
    harmony: { lage: 0 },
    osc: { wave: 0, glide: 1.6, register: 0, level: 1, voices: 4 },
    filter: { res: 2, mod: 0.7 },
    sat: { on: 1 },
    env: { attack: 2.8, sustain: 1, release: 6 },
    vca: { level: -8 },
    lfo1: { rate: 0.06, offset: 0, shape: 0 },
    lfo2: { rate: 0.09, offset: 0.5, shape: 2 },
    chorus: { rate: 0.13, depth: 0.8 },
    reverb: { decay: 5.5, damp: 0.6, predelay: 0.045 },
    bass: { wave: 0, glide: 1.2, attack: 3, release: 5, register: 0, level: 0.8 },
    tex: { tone: 900, level: 0.6 },
    mixer: { core: 0.85, tex: 0, rev: 0.9, bass: -14, bassMute: 1, master: 0.8, protect: 1 },
  };
  // Makrowerte in die zugeordneten Parameter einschreiben → gespeicherter Zustand ist konsistent
  for (const [key, m] of Object.entries(MACROS)) {
    for (const t of m.targets) values[t.mod][t.param] = t.fn(MACRO_START[key]);
  }

  const mk = (id, type, extra) => ({ id, type, values: values[id], ...(extra ? { extra } : {}) });
  const modules = [
    mk('harmony', 'harmony', { chords: DEFAULT_CHORDS.map((c) => ({ ...c, notes: [...c.notes] })), hold: false, holdIdx: 0 }),
    mk('osc', 'ensemble_osc'), mk('filter', 'filter'), mk('sat', 'saturation'),
    mk('env', 'envelope'), mk('vca', 'vca'),
    mk('lfo1', 'lfo'), mk('lfo2', 'lfo'), mk('chorus', 'chorus'), mk('reverb', 'reverb'),
    mk('bass', 'bass'), mk('tex', 'texture'), mk('mixer', 'mixer'),
  ];

  const cable = (from, to, depth = 1) => ({ from, to, depth });
  const cables = [
    cable('harmony:pitchOut', 'osc:pitchIn'),
    cable('harmony:gateOut', 'env:gateIn'),
    cable('harmony:rootOut', 'bass:pitchIn'),
    cable('harmony:gateOut', 'bass:gateIn'),
    cable('osc:out', 'filter:in'),
    cable('filter:out', 'sat:in'),
    cable('sat:out', 'vca:in'),
    cable('env:out', 'vca:cv'),
    cable('vca:out', 'chorus:in'),
    cable('chorus:out', 'mixer:coreIn'),
    cable('chorus:out', 'reverb:in'),
    cable('reverb:out', 'mixer:revIn'),
    cable('bass:out', 'mixer:bassIn'),
    cable('tex:out', 'mixer:texIn'),
    cable('lfo1:out', 'filter:cutoffCv', 1),
    cable('lfo2:out', 'chorus:moveCv', 1),
  ];

  // Aufbau über 60 Takte bei 59 BPM (≈ 4:04). Werte: dB (build, bass) bzw. 0…1 (Makros).
  const lanes = {
    build: { label: 'Aufbau', unit: 'dB', points: [[0, -50, 'smooth'], [10, -38, 'smooth'], [24, -22, 'smooth'], [38, -9, 'linear'], [52, -8, 'smooth'], [58, -45, 'linear'], [60, -60, 'hold']] },
    bass: { label: 'Bass', unit: 'dB', points: [[0, -60, 'hold'], [28, -60, 'smooth'], [36, -16, 'smooth'], [46, -11, 'hold'], [52, -11, 'smooth'], [58, -45, 'linear'], [60, -60, 'hold']] },
    bright: { label: 'Helligkeit', unit: '', points: [[0, 0.25, 'smooth'], [12, 0.38, 'smooth'], [24, 0.5, 'smooth'], [38, 0.64, 'smooth'], [52, 0.55, 'smooth'], [60, 0.2, 'hold']] },
    width: { label: 'Breite', unit: '', points: [[0, 0.35, 'smooth'], [12, 0.5, 'smooth'], [24, 0.7, 'smooth'], [38, 0.9, 'smooth'], [52, 0.8, 'smooth'], [60, 0.5, 'hold']] },
    motion: { label: 'Bewegung', unit: '', points: [[0, 0.25, 'smooth'], [24, 0.4, 'smooth'], [38, 0.55, 'smooth'], [60, 0.3, 'hold']] },
    density: { label: 'Dichte', unit: '', points: [[0, 0.2, 'smooth'], [12, 0.3, 'smooth'], [24, 0.55, 'smooth'], [38, 0.8, 'smooth'], [52, 0.6, 'smooth'], [60, 0.3, 'hold']] },
    space: { label: 'Raum', unit: '', points: [[0, 0.25, 'smooth'], [24, 0.4, 'smooth'], [38, 0.55, 'smooth'], [52, 0.6, 'smooth'], [60, 0.75, 'hold']] },
  };

  return {
    format: STATE_FORMAT,
    version: STATE_VERSION,
    name: 'Distant Lights',
    bpm: 59,
    beatsPerBar: 4,
    mode: 'auto',
    autoBass: true,
    macros: { ...MACRO_START },
    arrangement: {
      totalBars: 60,
      gateOffBar: 57,
      chordPlan: chordPlan(),
      sections: [
        { name: 'Beginn', startBar: 0, bars: 12 },
        { name: 'Öffnung', startBar: 12, bars: 12 },
        { name: 'Verdichtung', startBar: 24, bars: 14 },
        { name: 'Höhepunkt', startBar: 38, bars: 14 },
        { name: 'Ausklang', startBar: 52, bars: 8 },
      ],
      lanes,
    },
    layout: [
      ['harmony', 'osc', 'filter', 'sat', 'env', 'vca'],
      ['lfo1', 'lfo2', 'chorus', 'reverb', 'bass', 'tex', 'mixer'],
    ],
    modules,
    cables,
  };
}

/** Klassischer spielbereiter Eurorack-Grundpatch (Freies Spiel, ohne 4-Minuten-Zwang) */
export function buildStandardPatch() {
  const values = {
    harmony: { lage: 0 },
    osc: { wave: 0, glide: 0.15, register: 0, level: 1, voices: 4, detune: 5, drift: 2, spread: 0.6, osc3: 0.5 },
    filter: { cutoff: 2200, res: 1.6, mod: 0.4 },
    sat: { on: 1, drive: 0.15 },
    env: { attack: 0.05, sustain: 1, release: 1.0 },
    vca: { level: 0 },
    lfo1: { rate: 0.4, offset: 0, shape: 0, depth: 0.25 },
    lfo2: { rate: 0.15, offset: 0, shape: 1, depth: 0.2 },
    chorus: { rate: 0.2, depth: 0.6, mix: 0.3 },
    reverb: { decay: 3.5, damp: 0.5, predelay: 0.02, tone: 2400, send: 0.3 },
    bass: { wave: 0, glide: 0.15, attack: 0.04, release: 0.8, register: 0, level: 0.85 },
    tex: { tone: 1000, level: 0 },
    mixer: { core: 0.85, tex: 0, rev: 0.7, bass: -6, bassMute: 0, master: 0.8, protect: 1 },
  };

  const mk = (id, type, extra) => ({ id, type, values: values[id], ...(extra ? { extra } : {}) });
  const modules = [
    mk('harmony', 'harmony', { chords: DEFAULT_CHORDS.map((c) => ({ ...c, notes: [...c.notes] })), hold: false, holdIdx: 0 }),
    mk('osc', 'ensemble_osc'), mk('filter', 'filter'), mk('sat', 'saturation'),
    mk('env', 'envelope'), mk('vca', 'vca'),
    mk('lfo1', 'lfo'), mk('lfo2', 'lfo'), mk('chorus', 'chorus'), mk('reverb', 'reverb'),
    mk('bass', 'bass'), mk('tex', 'texture'), mk('mixer', 'mixer'),
  ];

  const cable = (from, to, depth = 1) => ({ from, to, depth });
  const cables = [
    cable('harmony:pitchOut', 'osc:pitchIn'),
    cable('harmony:gateOut', 'env:gateIn'),
    cable('harmony:rootOut', 'bass:pitchIn'),
    cable('harmony:gateOut', 'bass:gateIn'),
    cable('osc:out', 'filter:in'),
    cable('filter:out', 'sat:in'),
    cable('sat:out', 'vca:in'),
    cable('env:out', 'vca:cv'),
    cable('vca:out', 'chorus:in'),
    cable('chorus:out', 'mixer:coreIn'),
    cable('chorus:out', 'reverb:in'),
    cable('reverb:out', 'mixer:revIn'),
    cable('bass:out', 'mixer:bassIn'),
    cable('lfo1:out', 'filter:cutoffCv', 1),
  ];

  return {
    format: STATE_FORMAT,
    version: STATE_VERSION,
    name: 'Eurorack Standard',
    bpm: 120,
    beatsPerBar: 4,
    mode: 'manual',
    autoBass: false,
    macros: { bright: 0.5, width: 0.6, motion: 0.25, density: 0.4, space: 0.3 },
    arrangement: {
      totalBars: 9999,
      gateOffBar: 9999,
      chordPlan: [{ chord: 0, bars: 4 }],
      sections: [],
      lanes: {},
    },
    layout: [
      ['harmony', 'osc', 'filter', 'sat', 'env', 'vca'],
      ['lfo1', 'lfo2', 'chorus', 'reverb', 'bass', 'tex', 'mixer'],
    ],
    modules,
    cables,
  };
}

/** Leeres Rack zum freien Selbstverkabeln (alle 13 Module ohne Kabel) */
export function buildEmptyPatch() {
  const patch = buildStandardPatch();
  patch.name = 'Leeres Rack (Tabula Rasa)';
  patch.cables = [];
  return patch;
}

