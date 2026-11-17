// SYNTHBOARD – Schlichtes, visuelles Studio-Handbuch (In-App + Druck/PDF & HTML-Export)
// Ausschließlich echte deutsche UI-Bezeichnungen – keinerlei interne Code-IDs im Handbuch-Text.
import { MODULES } from '../modules/index.js';
import { applyTranslations, onLangChange, t } from './i18n.js';

const SIG_COLORS = {
  clock: '#06b6d4',
  gate: '#d97706',
  pitch: '#9333ea',
  mod: '#059669',
  audio: '#2563eb',
};

/** Kompaktes Inline-SVG für eine Modul-Bausteinkarte */
function renderModuleSvg(accent, title, knobs = [], jacks = []) {
  const knobEls = knobs.slice(0, 3).map((k, idx) => {
    const cx = 32 + idx * 46;
    const angle = k.angle ?? (-40 + idx * 35);
    const rad = ((angle - 90) * Math.PI) / 180;
    const px = cx + Math.cos(rad) * 7;
    const py = 44 + Math.sin(rad) * 7;
    return `
      <circle cx="${cx}" cy="44" r="10" fill="#1e293b" stroke="#475569" stroke-width="1.5"/>
      <line x1="${cx}" y1="44" x2="${px.toFixed(1)}" y2="${py.toFixed(1)}" stroke="${accent}" stroke-width="2" stroke-linecap="round"/>
      <text x="${cx}" y="64" text-anchor="middle" font-size="7" font-family="JetBrains Mono, monospace" fill="#475569">${k.label}</text>
      ${k.sweet ? `<text x="${cx}" y="73" text-anchor="middle" font-size="6.5" font-weight="700" font-family="JetBrains Mono, monospace" fill="${accent}">${k.sweet}</text>` : ''}
    `;
  }).join('');

  const jackEls = jacks.slice(0, 4).map((j, idx) => {
    const cx = 24 + idx * 38;
    const col = SIG_COLORS[j.sig] || '#64748b';
    return `
      <circle cx="${cx}" cy="92" r="5" fill="#0f172a" stroke="${col}" stroke-width="2"/>
      <circle cx="${cx}" cy="92" r="1.8" fill="${j.dir === 'out' ? col : '#334155'}"/>
      <text x="${cx}" y="106" text-anchor="middle" font-size="6.2" font-weight="700" font-family="JetBrains Mono, monospace" fill="#334155">${j.label}</text>
    `;
  }).join('');

  return `
    <svg viewBox="0 0 160 116" class="man-mod-svg" aria-hidden="true">
      <rect x="2" y="2" width="156" height="112" rx="8" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.2"/>
      <rect x="2" y="2" width="156" height="20" rx="8" fill="#0f172a"/>
      <rect x="2" y="14" width="156" height="8" fill="#0f172a"/>
      <circle cx="13" cy="12" r="3" fill="${accent}"/>
      <text x="22" y="15" font-size="8.5" font-weight="700" font-family="Inter, sans-serif" fill="#f8fafc">${title}</text>
      ${knobEls}
      <line x1="10" y1="79" x2="150" y2="79" stroke="#e2e8f0" stroke-width="1"/>
      ${jackEls}
    </svg>
  `;
}

/** Schaltplan-SVG für die 5 Beispiel-Racks */
function renderPatchDiagramSvg(nodes, cables) {
  const nodeMap = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const maxY = Math.max(...nodes.map((n) => n.y)) + 68;

  const cablePaths = cables.map((c) => {
    const from = nodeMap[c.from];
    const to = nodeMap[c.to];
    if (!from || !to) return '';
    const x1 = from.x + (c.fx ?? 118);
    const y1 = from.y + (c.fy ?? 26);
    const x2 = to.x + (c.tx ?? 0);
    const y2 = to.y + (c.ty ?? 26);
    const dx = Math.abs(x2 - x1) * 0.45 + 24;
    const col = SIG_COLORS[c.sig] || '#64748b';
    const d = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
    const lx = (x1 + x2) / 2;
    const ly = (y1 + y2) / 2 - 5;
    return `
      <path d="${d}" fill="none" stroke="${col}" stroke-width="2.2" stroke-linecap="round" opacity="0.88"/>
      <circle cx="${x1}" cy="${y1}" r="3.5" fill="${col}"/>
      <circle cx="${x2}" cy="${y2}" r="3.5" fill="#ffffff" stroke="${col}" stroke-width="2"/>
      ${c.label ? `<rect x="${lx - 32}" y="${ly - 7}" width="64" height="12" rx="3" fill="#ffffff" stroke="${col}" stroke-width="0.8" opacity="0.95"/>
      <text x="${lx}" y="${ly + 1.5}" text-anchor="middle" font-size="6.5" font-weight="700" font-family="JetBrains Mono, monospace" fill="#0f172a">${c.label}</text>` : ''}
    `;
  }).join('');

  const nodeBoxes = nodes.map((n) => {
    const bg = n.cat === 'control' ? '#eef2ff' : n.cat === 'effect' ? '#f0fdf4' : '#fffbeb';
    const border = n.cat === 'control' ? '#818cf8' : n.cat === 'effect' ? '#34d399' : '#fbbf24';
    const tag = n.cat === 'control' ? 'STEUERUNG' : n.cat === 'effect' ? 'EFFEKT' : 'INSTRUMENT';
    return `
      <g>
        <rect x="${n.x}" y="${n.y}" width="118" height="48" rx="6" fill="${bg}" stroke="${border}" stroke-width="1.5"/>
        <text x="${n.x + 8}" y="${n.y + 13}" font-size="6" font-weight="700" font-family="JetBrains Mono, monospace" fill="#64748b">${tag}</text>
        <text x="${n.x + 8}" y="${n.y + 27}" font-size="9.5" font-weight="700" font-family="Inter, sans-serif" fill="#0f172a">${n.title}</text>
        <text x="${n.x + 8}" y="${n.y + 39}" font-size="7" font-family="Inter, sans-serif" fill="#475569">${n.sub || ''}</text>
      </g>
    `;
  }).join('');

  return `
    <svg viewBox="0 0 640 ${maxY}" class="man-patch-svg" aria-label="Patch-Schaltplan">
      <rect x="0" y="0" width="640" height="${maxY}" rx="8" fill="#ffffff" stroke="#e2e8f0" stroke-width="1"/>
      ${nodeBoxes}
      ${cablePaths}
    </svg>
  `;
}

const MODULE_CARDS = {
  control: [
    {
      title: 'Master Clock',
      accent: '#06b6d4',
      purpose: 'Der zentrale Herzschlag. Bestimmt das Tempo (BPM) und den Swing für das gesamte Studio.',
      patch: '1/16 ➔ Euclidean · CLOCK',
      knobs: [{ label: 'Tempo', sweet: '90 BPM', angle: -10 }, { label: 'Swing', sweet: '12%', angle: -65 }],
      jacks: [{ label: '1/16', sig: 'clock', dir: 'out' }, { label: '1/4', sig: 'clock', dir: 'out' }, { label: '1 BAR', sig: 'clock', dir: 'out' }, { label: 'RESET', sig: 'gate', dir: 'out' }],
    },
    {
      title: 'Euclidean Rhythm',
      accent: '#f59e0b',
      purpose: 'Verteilt Schläge mathematisch gleichmäßig auf Taktschritte – ideal für organische Grooves und Polyrhythmik.',
      patch: 'TRIG ➔ Pluck Synth · GATE',
      knobs: [{ label: 'Steps', sweet: '16', angle: 60 }, { label: 'Hits', sweet: '5', angle: -20 }, { label: 'Rotate', sweet: '0', angle: -110 }],
      jacks: [{ label: 'CLOCK', sig: 'clock', dir: 'in' }, { label: 'RESET', sig: 'gate', dir: 'in' }, { label: 'TRIG', sig: 'gate', dir: 'out' }, { label: 'OFF-BEAT', sig: 'gate', dir: 'out' }],
    },
    {
      title: 'Probability Gate',
      accent: '#ec4899',
      purpose: 'Lässt Trigger nur mit einstellbarer Wahrscheinlichkeit durch – macht starre Patterns lebendig.',
      patch: 'PASSED ➔ Hybrid Perc · GATE',
      knobs: [{ label: 'Chance', sweet: '65%', angle: 20 }, { label: 'Burst', sweet: '1x', angle: -90 }],
      jacks: [{ label: 'TRIG IN', sig: 'gate', dir: 'in' }, { label: 'PASSED', sig: 'gate', dir: 'out' }, { label: 'DROPPED', sig: 'gate', dir: 'out' }],
    },
    {
      title: 'Random Walk & Quantizer',
      accent: '#10b981',
      purpose: 'Erzeugt sanft wandernde Melodien und rastet sie über den Scale Quantizer exakt auf eine Tonart ein.',
      patch: 'PITCH OUT ➔ Instrument · PITCH',
      knobs: [{ label: 'Step-Weite', sweet: '35%', angle: -30 }, { label: 'Zentrum', sweet: '50%', angle: 0 }],
      jacks: [{ label: 'CLOCK', sig: 'clock', dir: 'in' }, { label: 'CV IN', sig: 'pitch', dir: 'in' }, { label: 'PITCH OUT', sig: 'pitch', dir: 'out' }, { label: 'TRIG OUT', sig: 'gate', dir: 'out' }],
    },
    {
      title: 'Slow Random',
      accent: '#10b981',
      purpose: 'Langsame, organische Modulationswellen (wie Wind oder Atmung) für Filter, Filz-Dämpfung oder Panorama.',
      patch: 'CV OUT ➔ Filter · CUTOFF CV',
      knobs: [{ label: 'Rate', sweet: '0.12 Hz', angle: -60 }, { label: 'Glättung', sweet: '1.2 s', angle: 10 }, { label: 'Tiefe', sweet: '70%', angle: 40 }],
      jacks: [{ label: 'S&H CLOCK', sig: 'gate', dir: 'in' }, { label: 'CV OUT', sig: 'mod', dir: 'out' }, { label: 'INV CV', sig: 'mod', dir: 'out' }],
    },
    {
      title: 'Slope Generator',
      accent: '#eab308',
      purpose: 'Flexible Hüllkurve von 0.05s bis 60s. Ideal für langsame Swells, Sidechain-Ducking und Ablauf-Kaskaden.',
      patch: 'INV OUT ➔ Bass · VCA CV (Ducking)',
      knobs: [{ label: 'Rise', sweet: '3.5 s', angle: -20 }, { label: 'Fall', sweet: '6.0 s', angle: 25 }, { label: 'Kurve', sweet: '60%', angle: 15 }],
      jacks: [{ label: 'TRIG IN', sig: 'gate', dir: 'in' }, { label: 'ENV OUT', sig: 'mod', dir: 'out' }, { label: 'EOR OUT', sig: 'gate', dir: 'out' }, { label: 'EOF OUT', sig: 'gate', dir: 'out' }],
    },
    {
      title: 'CV Logic & Switch',
      accent: '#0284c7',
      purpose: 'Weiche, Flip-Flop-Schalter und Gate-Kombinierer. Entscheidet per Steuerspannung, wohin Rhythmen fließen.',
      patch: 'PASS A / INV B ➔ Zwei Instrumente',
      knobs: [{ label: 'Schwelle', sweet: '50%', angle: 0 }],
      jacks: [{ label: 'GATE IN', sig: 'gate', dir: 'in' }, { label: 'CTRL CV', sig: 'mod', dir: 'in' }, { label: 'PASS A', sig: 'gate', dir: 'out' }, { label: 'LATCH CV', sig: 'mod', dir: 'out' }],
    },
    {
      title: 'Snapshot Controller',
      accent: '#f97316',
      purpose: 'Schaltet deine 5 gespeicherten Performance-Snapshots automatisch per Patchkabel um – inkl. Morph-Übergang.',
      patch: 'Master Clock · 1 BAR ➔ NEXT',
      knobs: [],
      jacks: [{ label: 'SLOT 1', sig: 'gate', dir: 'in' }, { label: 'SLOT 2', sig: 'gate', dir: 'in' }, { label: 'NEXT', sig: 'gate', dir: 'in' }, { label: 'RESET', sig: 'gate', dir: 'in' }],
    },
    {
      title: 'Chord Arpeggiator',
      accent: '#818cf8',
      purpose: 'Zerlegt polyphone Akkorde (z. B. von Chord Glide) im Takt in treibende, filmische Ostinati.',
      patch: 'PITCH OUT & GATE OUT ➔ Felt Piano',
      knobs: [{ label: 'Oktaven', sweet: '2', angle: 0 }, { label: 'Gate-Länge', sweet: '65%', angle: 20 }, { label: 'Dichte', sweet: '90%', angle: 75 }],
      jacks: [{ label: 'CLOCK', sig: 'clock', dir: 'in' }, { label: 'POLY PITCH', sig: 'pitch', dir: 'in' }, { label: 'GATE OUT', sig: 'gate', dir: 'out' }, { label: 'PITCH OUT', sig: 'pitch', dir: 'out' }],
    },
  ],
  source: [
    {
      title: 'Chord Glide',
      accent: '#a855f7',
      purpose: 'Polyphoner Stimmführungs-Synthesizer. Verbindet Akkorde mit minimalen Ton-Sprüngen und sendet sie weiter.',
      patch: 'POLY PITCH ➔ Chord Arpeggiator',
      knobs: [{ label: 'Glide', sweet: '0.4 s', angle: -30 }, { label: 'Cutoff', sweet: '1.8 kHz', angle: 10 }, { label: 'Warmth', sweet: '65%', angle: 30 }],
      jacks: [{ label: 'CLOCK', sig: 'clock', dir: 'in' }, { label: 'POLY PITCH', sig: 'pitch', dir: 'out' }, { label: 'ROOT PITCH', sig: 'pitch', dir: 'out' }, { label: 'CHORD TRIG', sig: 'gate', dir: 'out' }],
    },
    {
      title: 'Felt Piano',
      accent: '#f59e0b',
      purpose: 'Intimes, mechanisches Filzklavier mit Holzresonanz und Hammer-Geräusch im Stil von Nils Frahm.',
      patch: 'Slow Random ➔ FILZ CV',
      knobs: [{ label: 'Anschlag', sweet: '70%', angle: 35 }, { label: 'Ausklang', sweet: '3.0 s', angle: 20 }, { label: 'Korpus', sweet: '60%', angle: 15 }],
      jacks: [{ label: 'GATE', sig: 'gate', dir: 'in' }, { label: 'PITCH', sig: 'pitch', dir: 'in' }, { label: 'FILZ CV', sig: 'mod', dir: 'in' }, { label: 'VCA CV', sig: 'mod', dir: 'in' }],
    },
    {
      title: 'Solo Violin',
      accent: '#e11d48',
      purpose: 'Ausdrucksstarke Streicherstimme mit Bogen-Reibung, Fingervibrato und Legato-Lagenwechseln.',
      patch: 'Slow Random ➔ BOW CV',
      knobs: [{ label: 'Bogen', sweet: '55%', angle: 10 }, { label: 'Vibrato', sweet: '45%', angle: -10 }, { label: 'Glide', sweet: '180 ms', angle: -35 }],
      jacks: [{ label: 'BOW GATE', sig: 'gate', dir: 'in' }, { label: 'PITCH', sig: 'pitch', dir: 'in' }, { label: 'BOW CV', sig: 'mod', dir: 'in' }, { label: 'VCA CV', sig: 'mod', dir: 'in' }],
    },
    {
      title: 'Drone Maschine',
      accent: '#6366f1',
      purpose: '6-stimmiger Akkord-Teppich mit analoger Verstimmung und Schwebung für tiefe Ambient-Flächen.',
      patch: 'Slope Generator · ENV OUT ➔ VCA CV',
      knobs: [{ label: 'Tone', sweet: '650 Hz', angle: -40 }, { label: 'Detune', sweet: '14 ct', angle: -15 }, { label: 'Drift', sweet: '65%', angle: 25 }],
      jacks: [{ label: 'PITCH', sig: 'pitch', dir: 'in' }, { label: 'TONE CV', sig: 'mod', dir: 'in' }, { label: 'VCA CV', sig: 'mod', dir: 'in' }, { label: 'PAN CV', sig: 'mod', dir: 'in' }],
    },
    {
      title: 'Pluck Synth',
      accent: '#14b8a6',
      purpose: 'Akustisch-organischer Zupfklang zwischen Harfe, Kalimba und gläserner Glocke.',
      patch: 'Euclidean · TRIG ➔ GATE',
      knobs: [{ label: 'Dämpfung', sweet: '2.8 kHz', angle: 15 }, { label: 'Decay', sweet: '1.2 s', angle: 0 }, { label: 'Oberton', sweet: '60%', angle: 20 }],
      jacks: [{ label: 'GATE', sig: 'gate', dir: 'in' }, { label: 'PITCH', sig: 'pitch', dir: 'in' }, { label: 'FILTER CV', sig: 'mod', dir: 'in' }, { label: 'VCA CV', sig: 'mod', dir: 'in' }],
    },
    {
      title: 'Bass Synth & Drum Rack',
      accent: '#ef4444',
      purpose: 'Sattes Analog-Fundament (303/Subbass) und 5-teilige Synthesizer-Drums für treibende Grooves.',
      patch: 'Chord Glide · ROOT PITCH ➔ Bass · PITCH',
      knobs: [{ label: 'Cutoff', sweet: '420 Hz', angle: -55 }, { label: 'Reso', sweet: '4.5', angle: 5 }, { label: 'Sub', sweet: '60%', angle: 15 }],
      jacks: [{ label: 'GATE', sig: 'gate', dir: 'in' }, { label: 'PITCH', sig: 'pitch', dir: 'in' }, { label: 'CUTOFF CV', sig: 'mod', dir: 'in' }, { label: 'VCA CV', sig: 'mod', dir: 'in' }],
    },
    {
      title: 'Resonator & Spectral Swarm',
      accent: '#38bdf8',
      purpose: 'Klangkörper-Resonanzen und schimmernde Partikel-Wolken für cineastische Texturen.',
      patch: 'Probability Gate · PASSED ➔ GATE',
      knobs: [{ label: 'Material', sweet: '55%', angle: 10 }, { label: 'Dämpfung', sweet: '40%', angle: -20 }, { label: 'Streuung', sweet: '70%', angle: 40 }],
      jacks: [{ label: 'GATE', sig: 'gate', dir: 'in' }, { label: 'PITCH', sig: 'pitch', dir: 'in' }, { label: 'MATERIAL CV', sig: 'mod', dir: 'in' }, { label: 'MUTATE', sig: 'gate', dir: 'in' }],
    },
  ],
  effect: [
    {
      title: 'Granular Cloud',
      accent: '#c084fc',
      purpose: 'Echtzeit-Granular-Synthese & Shimmer (+1 Oktave / +Quinte). Verwandelt einzelne Töne in weite Film-Wolken.',
      patch: 'Channel Send / Insert ➔ Granular Cloud',
      knobs: [{ label: 'Grain-Size', sweet: '0.14 s', angle: -15 }, { label: 'Textur', sweet: '65%', angle: 30 }, { label: 'Feedback', sweet: '50%', angle: 15 }],
      jacks: [{ label: 'FREEZE', sig: 'gate', dir: 'in' }, { label: 'MIX CV', sig: 'mod', dir: 'in' }, { label: 'TEXTURE CV', sig: 'mod', dir: 'in' }],
    },
    {
      title: 'Stereo Delay',
      accent: '#ffcc4d',
      purpose: 'Analoges Echo und Ping-Pong-Delay mit einstellbarer Filterdumpfheit und Tonband-Drift.',
      patch: 'Kanalzug Delay-Send aufdrehen',
      knobs: [{ label: 'Time', sweet: '0.42 s', angle: -10 }, { label: 'Feedback', sweet: '50%', angle: 0 }, { label: 'Tone', sweet: '2.4 kHz', angle: -20 }],
      jacks: [{ label: 'TIME CV', sig: 'mod', dir: 'in' }],
    },
    {
      title: 'Ambient Reverb',
      accent: '#6ee7a8',
      purpose: 'Riesiger Stereo-Raumhall (bis 15 Sekunden) für endlose, schwebende Klangräume.',
      patch: 'Kanalzug Reverb-Send aufdrehen',
      knobs: [{ label: 'Decay', sweet: '7.5 s', angle: 35 }, { label: 'Dämpfung', sweet: '45%', angle: -10 }, { label: 'Mix', sweet: '45%', angle: -15 }],
      jacks: [{ label: 'MIX CV', sig: 'mod', dir: 'in' }],
    },
    {
      title: 'Analog Filter & Lo-Fi',
      accent: '#ff5d73',
      purpose: '24-dB-Filter mit Röhrensättigung sowie Vintage-Kassettenleiern (Wow & Flutter) für analoge Wärme.',
      patch: 'Slow Random · CV OUT ➔ CUTOFF CV',
      knobs: [{ label: 'Cutoff', sweet: '2.2 kHz', angle: 10 }, { label: 'Drive', sweet: '25%', angle: -40 }, { label: 'Wobble', sweet: '35%', angle: -20 }],
      jacks: [{ label: 'CUTOFF CV', sig: 'mod', dir: 'in' }],
    },
  ],
};

const EXAMPLE_RACKS = [
  {
    id: 'rack1_drone',
    title: '1. Atmendes Drone-Pad (Einstieg in Modulation)',
    summary: 'Ein tiefer, lebendiger Ambient-Teppich, der alle 10 Sekunden sanft an- und abschwillt, während das Filter langsam atmet.',
    steps: [
      'Stelle bei der Drone Maschine den Grundton auf A1, den Akkord auf Quinten und aktiviere die Stimmen 1, 3 und 5.',
      'Stelle den Slope Generator auf Zyklisch (LFO) mit Rise 4.5s und Fall 6.0s.',
      'Verbinde ENV OUT mit VCA CV der Drone (steuert das langsame An- und Abschwellen).',
      'Verbinde Slow Random CV OUT mit TONE CV der Drone und drehe den Reverb-Send im Kanalzug auf 65%.',
    ],
    diagram: renderPatchDiagramSvg(
      [
        { id: 'slope', title: 'Slope Generator', sub: 'Zyklisch · 4.5s / 6s', cat: 'control', x: 24, y: 20 },
        { id: 'slow', title: 'Slow Random', sub: 'Gleitend · 0.08 Hz', cat: 'control', x: 24, y: 92 },
        { id: 'drone', title: 'Drone Maschine', sub: 'A1 Quinten · Rev 65%', cat: 'source', x: 255, y: 56 },
        { id: 'chorus', title: 'Chorus', sub: 'Breite 55%', cat: 'effect', x: 485, y: 20 },
        { id: 'reverb', title: 'Ambient Reverb', sub: 'Decay 9.0 s', cat: 'effect', x: 485, y: 92 },
      ],
      [
        { from: 'slope', to: 'drone', fx: 118, fy: 26, tx: 0, ty: 18, sig: 'mod', label: 'ENV ➔ VCA' },
        { from: 'slow', to: 'drone', fx: 118, fy: 26, tx: 0, ty: 34, sig: 'mod', label: 'CV ➔ TONE' },
        { from: 'drone', to: 'chorus', fx: 118, fy: 18, tx: 0, ty: 24, sig: 'audio' },
        { from: 'drone', to: 'reverb', fx: 118, fy: 34, tx: 0, ty: 24, sig: 'audio' },
      ]
    ),
    state: {
      master: 0.78,
      modules: [
        { id: 'sg1', type: 'slope_generator', values: { mode: 'loop', rise: 4.5, fall: 6.0, curve: 0.35, scale: 1, offset: 0 } },
        { id: 'sr1', type: 'slow_random', values: { mode: 'smooth', rate: 0.08, smooth: 1.8, depth: 0.55 } },
        { id: 'dr1', type: 'drone', values: { root: 33, chord: 'fifth', wave: 'triangle', level: 0.75, tone: 680, detune: 14, sub: 0.4, fm: 0.05, drift: 0.65 }, extra: { voices: [true, false, true, false, true, false], chDelay: 0.25, chReverb: 0.65 } },
        { id: 'ch1', type: 'chorus', values: { rate: 0.18, depth: 0.55, mix: 0.4 } },
        { id: 'rv1', type: 'reverb', values: { decay: 9.0, damp: 0.45, predelay: 0.04, tone: 4200, mix: 0.55 } },
      ],
      cables: [
        { from: 'sg1:envOut', to: 'dr1:vcaCv', depth: 0.9 },
        { from: 'sr1:cvOut', to: 'dr1:cvTone', depth: 0.65 },
      ],
    },
  },
  {
    id: 'rack2_pluck',
    title: '2. Generatives Euklid-Pluck (Rhythmus & Quantizer)',
    summary: 'Ein sich selbst spielender Harfen-Groove in japanischer Hirajoshi-Stimmung mit Ping-Pong-Echos.',
    steps: [
      'Master Clock (88 BPM) taktet sowohl Euclidean Rhythm (5 Hits auf 16 Steps) als auch Random Walk.',
      'Random Walk erzeugt rohe Tonhöhen und schickt sie in den Scale Quantizer (Skala: Hirajoshi).',
      'Euclidean TRIG löst den Pluck Synth aus; die quantisierte Tonhöhe geht an Pluck PITCH.',
      'Slow Random moduliert über FILTER CV die Helligkeit der Zupftöne.',
    ],
    diagram: renderPatchDiagramSvg(
      [
        { id: 'clk', title: 'Master Clock', sub: '88 BPM · Swing 14%', cat: 'control', x: 20, y: 56 },
        { id: 'euc', title: 'Euclidean', sub: '16 Steps · 5 Hits', cat: 'control', x: 185, y: 18 },
        { id: 'rw', title: 'Random Walk', sub: 'Step 35%', cat: 'control', x: 185, y: 92 },
        { id: 'qt', title: 'Scale Quantizer', sub: 'Hirajoshi · A', cat: 'control', x: 345, y: 92 },
        { id: 'plk', title: 'Pluck Synth', sub: 'Harfe · Delay 50%', cat: 'source', x: 500, y: 56 },
      ],
      [
        { from: 'clk', to: 'euc', fx: 118, fy: 18, tx: 0, ty: 24, sig: 'clock', label: '1/16' },
        { from: 'clk', to: 'rw', fx: 118, fy: 34, tx: 0, ty: 24, sig: 'clock', label: '1/8' },
        { from: 'rw', to: 'qt', fx: 118, fy: 24, tx: 0, ty: 24, sig: 'pitch', label: 'PITCH' },
        { from: 'euc', to: 'plk', fx: 118, fy: 24, tx: 0, ty: 16, sig: 'gate', label: 'TRIG ➔ GATE' },
        { from: 'qt', to: 'plk', fx: 118, fy: 24, tx: 0, ty: 34, sig: 'pitch', label: 'PITCH OUT' },
      ]
    ),
    state: {
      master: 0.8,
      modules: [
        { id: 'mc1', type: 'master_clock', values: { tempo: 88, swing: 0.14, running: 1 } },
        { id: 'eu1', type: 'euclidean', values: { steps: 16, pulses: 5, rotation: 0 } },
        { id: 'rw1', type: 'random_walk', values: { stepSize: 0.35, center: 0.5, scale: 'hirajoshi', root: 9 } },
        { id: 'qt1', type: 'quantizer', values: { scale: 'hirajoshi', root: 9 } },
        { id: 'sr2', type: 'slow_random', values: { mode: 'smooth', rate: 0.15, smooth: 1.0, depth: 0.7 } },
        { id: 'pl1', type: 'pluck', values: { level: 0.78, tone: 3400, damp: 1.25, bright: 0.7, body: 0.5 }, extra: { chDelay: 0.5, chReverb: 0.45 } },
        { id: 'dl1', type: 'delay', values: { mode: 'pingpong', time: 0.42, feedback: 0.52, tone: 2400, mod: 0.25, mix: 0.42 } },
        { id: 'rv2', type: 'reverb', values: { decay: 6.5, damp: 0.45, predelay: 0.03, tone: 5500, mix: 0.42 } },
      ],
      cables: [
        { from: 'mc1:clockOut', to: 'eu1:clockIn' },
        { from: 'mc1:div2Out', to: 'rw1:clockIn' },
        { from: 'rw1:pitchOut', to: 'qt1:pitchIn' },
        { from: 'eu1:trigOut', to: 'pl1:gateIn' },
        { from: 'qt1:pitchOut', to: 'pl1:pitchIn' },
        { from: 'sr2:cvOut', to: 'pl1:modCutoff', depth: 0.75 },
      ],
    },
  },
  {
    id: 'rack3_cinematic',
    title: '3. Cinematic Ostinato & Shimmer',
    summary: 'Ein episches Hans-Zimmer-Arrangement: Chord Glide liefert Harmonien, der Chord Arpeggiator formt treibende Filzklavier-Ostinati und Granular Cloud legt +1 Oktave Shimmer darüber.',
    steps: [
      'Master Clock (92 BPM) schickt 1 BAR an Chord Glide und 1/16-Takt an den Chord Arpeggiator.',
      'Chord Glide sendet seine polyphonen Akkorde (POLY PITCH) in den Chord Arpeggiator und den tiefen Grundton (ROOT PITCH) an den Bass.',
      'Der Chord Arpeggiator spielt im Muster Up-Down (2 Oktaven) direkt in Felt Piano GATE & PITCH.',
      'Granular Cloud hebt den Klang in der Effektkette um +1 Oktave mit 50% Feedback an.',
    ],
    diagram: renderPatchDiagramSvg(
      [
        { id: 'mc', title: 'Master Clock', sub: '92 BPM', cat: 'control', x: 16, y: 56 },
        { id: 'cg', title: 'Chord Glide', sub: 'Em → C → G → D', cat: 'source', x: 165, y: 18 },
        { id: 'arp', title: 'Chord Arpeggiator', sub: 'Up-Down · 2 Okt', cat: 'control', x: 325, y: 18 },
        { id: 'fp', title: 'Felt Piano', sub: 'Filz 65%', cat: 'source', x: 485, y: 18 },
        { id: 'bs', title: 'Bass Synth', sub: 'Grundton-Fundament', cat: 'source', x: 325, y: 92 },
        { id: 'gc', title: 'Granular Cloud', sub: '+1 Okt Shimmer', cat: 'effect', x: 485, y: 92 },
      ],
      [
        { from: 'mc', to: 'cg', fx: 118, fy: 18, tx: 0, ty: 24, sig: 'clock', label: '1 BAR' },
        { from: 'mc', to: 'arp', fx: 118, fy: 34, tx: 0, ty: 36, sig: 'clock', label: '1/16' },
        { from: 'cg', to: 'arp', fx: 118, fy: 18, tx: 0, ty: 18, sig: 'pitch', label: 'POLY PITCH' },
        { from: 'cg', to: 'bs', fx: 118, fy: 36, tx: 0, ty: 24, sig: 'pitch', label: 'ROOT' },
        { from: 'arp', to: 'fp', fx: 118, fy: 24, tx: 0, ty: 24, sig: 'gate', label: 'GATE+PITCH' },
        { from: 'fp', to: 'gc', fx: 59, fy: 48, tx: 59, ty: 0, sig: 'audio' },
      ]
    ),
    state: {
      master: 0.78,
      modules: [
        { id: 'mc3', type: 'master_clock', values: { tempo: 92, swing: 0.05, running: 1 } },
        { id: 'cg3', type: 'chord_glide', values: { level: 0.42, cutoff: 1400, glide: 0.45, warmth: 0.65 } },
        { id: 'arp3', type: 'chord_arp', values: { pattern: 'updown', octaves: 2, gateLen: 0.65, density: 0.95, accentEvery: 4 } },
        { id: 'fp3', type: 'felt_piano', values: { level: 0.8, felt: 0.65, decay: 2.6, color: 3200, body: 0.6, hammer: 0.35 }, extra: { chDelay: 0.35, chReverb: 0.55 } },
        { id: 'bs3', type: 'bass', values: { level: 0.55, cutoff: 340, reso: 2.0, sub: 0.7, decay: 0.8 }, extra: { chReverb: 0.15 } },
        { id: 'gc3', type: 'granular_cloud', values: { pitchMode: 'octUp', size: 0.14, texture: 0.65, feedback: 0.5, freeze: 0, mix: 0.38 } },
        { id: 'rv3', type: 'reverb', values: { decay: 7.5, damp: 0.45, predelay: 0.04, tone: 5200, mix: 0.42 } },
      ],
      cables: [
        { from: 'mc3:barOut', to: 'cg3:clockIn' },
        { from: 'mc3:clockOut', to: 'arp3:clockIn' },
        { from: 'cg3:pitchOut', to: 'arp3:pitchIn' },
        { from: 'cg3:rootOut', to: 'bs3:pitchIn' },
        { from: 'arp3:gateOut', to: 'fp3:gateIn' },
        { from: 'arp3:pitchOut', to: 'fp3:pitchIn' },
        { from: 'cg3:gateOut', to: 'bs3:gateIn' },
      ],
    },
  },
  {
    id: 'rack4_cascade',
    title: '4. Automatische Regie-Kaskade (Logik & Snapshots)',
    summary: 'Das Rack dirigiert sich selbst: Eine Hüllkurve triggert am Ende ihres Abfalls (EOF) über CV Logic & Switch das nächste Instrument und wechselt im Takt zwischen Szenen.',
    steps: [
      'Master Clock · 1 BAR triggert den Slope Generator und schaltet alle paar Takte über Snapshot Controller · NEXT weiter.',
      'Am Ende der Abfallphase sendet Slope Generator · EOF OUT einen Impuls in CV Logic & Switch · GATE IN.',
      'Slow Random steuert CTRL CV: Je nach Spannung geht das Gate an Felt Piano (PASS A) oder Resonator Garden (INV B).',
    ],
    diagram: renderPatchDiagramSvg(
      [
        { id: 'mc', title: 'Master Clock', sub: '80 BPM · 1 BAR', cat: 'control', x: 16, y: 56 },
        { id: 'sg', title: 'Slope Generator', sub: 'Trigger AD · EOF', cat: 'control', x: 165, y: 20 },
        { id: 'ls', title: 'CV Logic & Switch', sub: 'A/B Gate Router', cat: 'control', x: 325, y: 20 },
        { id: 'sc', title: 'Snapshot Controller', sub: 'Auto-Wechsel', cat: 'control', x: 165, y: 92 },
        { id: 'fp', title: 'Felt Piano', sub: 'Pfad A', cat: 'source', x: 485, y: 18 },
        { id: 'rg', title: 'Resonator Garden', sub: 'Pfad B', cat: 'source', x: 485, y: 92 },
      ],
      [
        { from: 'mc', to: 'sg', fx: 118, fy: 18, tx: 0, ty: 24, sig: 'clock', label: '1 BAR' },
        { from: 'mc', to: 'sc', fx: 118, fy: 36, tx: 0, ty: 24, sig: 'clock', label: 'NEXT' },
        { from: 'sg', to: 'ls', fx: 118, fy: 24, tx: 0, ty: 24, sig: 'gate', label: 'EOF OUT' },
        { from: 'ls', to: 'fp', fx: 118, fy: 18, tx: 0, ty: 24, sig: 'gate', label: 'PASS A' },
        { from: 'ls', to: 'rg', fx: 118, fy: 34, tx: 0, ty: 24, sig: 'gate', label: 'INV B' },
      ]
    ),
    state: {
      master: 0.78,
      modules: [
        { id: 'mc4', type: 'master_clock', values: { tempo: 80, swing: 0.08, running: 1 } },
        { id: 'sg4', type: 'slope_generator', values: { mode: 'trig', rise: 0.8, fall: 1.8, curve: 0.5, scale: 1, offset: 0 } },
        { id: 'sr4', type: 'slow_random', values: { mode: 'smooth', rate: 0.2, smooth: 0.9, depth: 0.9 } },
        { id: 'ls4', type: 'logic_switch', values: { thresh: 0.5 } },
        { id: 'sc4', type: 'snapshot_ctrl', values: {} },
        { id: 'fp4', type: 'felt_piano', values: { level: 0.78, felt: 0.65, decay: 2.8, color: 2800 }, extra: { chReverb: 0.55 } },
        { id: 'rg4', type: 'resonator_garden', values: { level: 0.72, material: 0.55, damp: 0.4 }, extra: { chDelay: 0.45, chReverb: 0.6 } },
        { id: 'rv4', type: 'reverb', values: { decay: 7.0, damp: 0.45, predelay: 0.03, tone: 5000, mix: 0.45 } },
      ],
      cables: [
        { from: 'mc4:div4Out', to: 'sg4:trigIn' },
        { from: 'mc4:barOut', to: 'sc4:nextIn' },
        { from: 'sg4:eofOut', to: 'ls4:gateIn' },
        { from: 'sr4:cvOut', to: 'ls4:ctrlCv' },
        { from: 'ls4:passOut', to: 'fp4:gateIn' },
        { from: 'ls4:invPassOut', to: 'rg4:gateIn' },
      ],
    },
  },
  {
    id: 'rack5_techno',
    title: '5. Warehouse Techno (Sidechain-Ducking & Acid-Sequenz)',
    summary: 'Treibende 128-BPM-Bassline mit Pump-Effekt: Eine schnelle Viertel-Hüllkurve drückt die Bass-Lautstärke bei jedem Kick-Schlag weg.',
    steps: [
      'Master Clock (128 BPM) sendet 1/4-Schläge an Drum Rack · GATE und an Slope Generator · TRIG IN (Trigger AD, kurzes Rise 0.05s, Fall 0.35s).',
      'Slope Generator · INV OUT geht in Bass Synth · VCA CV – das erzeugt den typischen Sidechain-Pumpeffekt.',
      'Step Sequencer spielt 16tel-Noten in den Bass Synth; Analog Filter formt den Druck.',
    ],
    diagram: renderPatchDiagramSvg(
      [
        { id: 'mc', title: 'Master Clock', sub: '128 BPM', cat: 'control', x: 16, y: 56 },
        { id: 'sq', title: 'Step Sequencer', sub: '8-Step Acid-Linie', cat: 'source', x: 175, y: 18 },
        { id: 'sg', title: 'Slope Generator', sub: 'Sidechain · 0.35s', cat: 'control', x: 175, y: 92 },
        { id: 'bs', title: 'Bass Synth', sub: 'Reso 6.5 · Sub 70%', cat: 'source', x: 345, y: 56 },
        { id: 'dr', title: 'Drum Rack', sub: '4/4 Kick & Hats', cat: 'source', x: 495, y: 18 },
        { id: 'flt', title: 'Analog Filter', sub: 'Drive 45%', cat: 'effect', x: 495, y: 92 },
      ],
      [
        { from: 'mc', to: 'sq', fx: 118, fy: 18, tx: 0, ty: 24, sig: 'clock', label: '1/16' },
        { from: 'mc', to: 'sg', fx: 118, fy: 34, tx: 0, ty: 24, sig: 'clock', label: '1/4' },
        { from: 'sq', to: 'bs', fx: 118, fy: 24, tx: 0, ty: 18, sig: 'pitch', label: 'GATE+PITCH' },
        { from: 'sg', to: 'bs', fx: 118, fy: 24, tx: 0, ty: 36, sig: 'mod', label: 'INV ➔ VCA' },
        { from: 'mc', to: 'dr', fx: 118, fy: 18, tx: 0, ty: 24, sig: 'gate', label: '1/4 KICK' },
        { from: 'bs', to: 'flt', fx: 118, fy: 24, tx: 0, ty: 24, sig: 'audio' },
      ]
    ),
    state: {
      master: 0.82,
      modules: [
        { id: 'mc5', type: 'master_clock', values: { tempo: 128, swing: 0.04, running: 1 } },
        { id: 'sq5', type: 'sequencer', values: { running: 1, scale: 'minor', root: 9 } },
        { id: 'sg5', type: 'slope_generator', values: { mode: 'trig', rise: 0.05, fall: 0.35, curve: 0.4, scale: 1, offset: 0 } },
        { id: 'bs5', type: 'bass', values: { level: 0.85, cutoff: 480, reso: 6.5, sub: 0.75, decay: 0.28 }, extra: { chDelay: 0.2, chReverb: 0.1 } },
        { id: 'dr5', type: 'drum_rack', values: { level: 0.85, kick: 0.9, snare: 0.4, hat: 0.65 }, extra: { chReverb: 0.12 } },
        { id: 'fl5', type: 'filter', values: { ftype: 'lowpass', cutoff: 3400, reso: 2.0, drive: 0.45, lfoRate: 0.25, lfoDepth: 0.15 } },
        { id: 'dl5', type: 'delay', values: { mode: 'stereo', time: 0.35, feedback: 0.4, tone: 1800, mod: 0.1, mix: 0.28 } },
      ],
      cables: [
        { from: 'mc5:clockOut', to: 'sq5:clockIn' },
        { from: 'sq5:gateOut', to: 'bs5:gateIn' },
        { from: 'sq5:pitchOut', to: 'bs5:pitchIn' },
        { from: 'mc5:div4Out', to: 'sg5:trigIn' },
        { from: 'sg5:invOut', to: 'bs5:vcaCv', depth: 0.85 },
        { from: 'mc5:div4Out', to: 'dr5:gateIn' },
      ],
    },
  },
];

export class ManualModal {
  constructor({ onLoadRackState, onToast, onStartAudio, getCurrentState } = {}) {
    this.onLoadRackState = onLoadRackState;
    this.onToast = onToast;
    this.onStartAudio = onStartAudio;
    this.getCurrentState = getCurrentState || null;
    this.el = null;
    this.activeCat = 'all';
    this.createModal();
    onLangChange(() => this.refreshLanguage());
  }

  refreshLanguage() {
    if (!this.el) return;
    this.el.innerHTML = this.buildModalHtml();
    this.bindModalEvents();
    applyTranslations(this.el);
  }

  createModal() {
    const modal = document.createElement('div');
    modal.id = 'manual-modal';
    modal.className = 'manual-modal hidden';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-label', t('SYNTHBOARD Studio-Handbuch', 'SYNTHBOARD Studio Manual'));
    modal.innerHTML = this.buildModalHtml();
    document.body.appendChild(modal);
    this.el = modal;

    this.bindModalEvents();

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !this.el.classList.contains('hidden')) {
        this.close();
      }
    });
  }

  bindModalEvents() {
    const modal = this.el;
    if (!modal) return;

    modal.querySelector('#man-close-btn')?.addEventListener('click', () => this.close());
    modal.addEventListener('click', (e) => {
      if (e.target === modal) this.close();
    });

    // Kategorie-Filter in "Die Bausteine"
    modal.querySelectorAll('.man-cat-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        modal.querySelectorAll('.man-cat-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const cat = btn.dataset.cat;
        modal.querySelectorAll('.man-cat-section').forEach((sec) => {
          sec.classList.toggle('hidden', cat !== 'all' && sec.dataset.cat !== cat);
        });
      });
    });

    // Beispiel-Racks direkt ins Studio laden
    modal.querySelectorAll('.man-load-rack-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const rack = EXAMPLE_RACKS.find((r) => r.id === btn.dataset.rackId);
        if (!rack) return;
        this.onStartAudio?.();
        this.onLoadRackState?.(structuredClone(rack.state), rack.title);
        this.close();
        this.onToast?.(`Beispiel-Rack „${rack.title}“ geladen`);
      });
    });

    // Download / PDF Druckansicht / KI-Referenz (.md)
    modal.querySelector('#man-download-pdf')?.addEventListener('click', () => this.openPrintView());
    modal.querySelector('#man-download-html')?.addEventListener('click', () => this.downloadStandaloneHtml());
    modal.querySelector('#man-download-ai-md')?.addEventListener('click', () => this.downloadAiReferenceMd());
    modal.querySelector('#man-download-rack-md')?.addEventListener('click', () => this.downloadCurrentRackForAiMd());
  }

  open() {
    this.el?.classList.remove('hidden');
    if (this.el) applyTranslations(this.el);
  }

  close() {
    this.el?.classList.add('hidden');
  }

  toggle() {
    if (this.el?.classList.contains('hidden')) this.open();
    else this.close();
  }

  buildSignalFlowSvg() {
    return `
      <svg viewBox="0 0 760 220" class="man-flow-svg" aria-label="SYNTHBOARD Signalfluss">
        <rect x="0" y="0" width="760" height="220" rx="12" fill="#ffffff" stroke="#e2e8f0" stroke-width="1.2"/>

        <!-- Ebene 1: Steuerung -->
        <rect x="20" y="24" width="205" height="172" rx="10" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.2"/>
        <text x="34" y="46" font-size="9" font-weight="700" font-family="JetBrains Mono, monospace" fill="#0284c7">1 · STEUERUNG</text>
        <text x="34" y="64" font-size="11" font-weight="700" font-family="Inter, sans-serif" fill="#0f172a">Takt, Logik &amp; Bewegung</text>
        <rect x="34" y="78" width="177" height="26" rx="5" fill="#ecfeff" stroke="#06b6d4" stroke-width="1"/>
        <text x="44" y="95" font-size="9.5" font-weight="600" fill="#0e7490">Master Clock · Divider · Arpeggiator</text>
        <rect x="34" y="112" width="177" height="26" rx="5" fill="#fffbeb" stroke="#d97706" stroke-width="1"/>
        <text x="44" y="129" font-size="9.5" font-weight="600" fill="#b45309">Euclidean · Prob Gate · CV Logic</text>
        <rect x="34" y="146" width="177" height="26" rx="5" fill="#ecfdf5" stroke="#059669" stroke-width="1"/>
        <text x="44" y="163" font-size="9.5" font-weight="600" fill="#047857">Slow Random · Slope Generator</text>

        <!-- Ebene 2: Klangquellen -->
        <rect x="275" y="24" width="215" height="172" rx="10" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.2"/>
        <text x="289" y="46" font-size="9" font-weight="700" font-family="JetBrains Mono, monospace" fill="#9333ea">2 · KLANGQUELLEN</text>
        <text x="289" y="64" font-size="11" font-weight="700" font-family="Inter, sans-serif" fill="#0f172a">Instrumente &amp; Kanalzug</text>
        <rect x="289" y="78" width="187" height="58" rx="5" fill="#ffffff" stroke="#cbd5e1" stroke-width="1"/>
        <text x="299" y="95" font-size="9.5" font-weight="700" fill="#0f172a">Chord Glide · Felt Piano · Violin</text>
        <text x="299" y="110" font-size="9.5" font-weight="700" fill="#0f172a">Drone · Pluck · Bass · Drum Rack</text>
        <text x="299" y="125" font-size="8.5" fill="#64748b">Resonator · Swarm · Morph · Noise</text>
        <rect x="289" y="144" width="187" height="36" rx="5" fill="#f1f5f9" stroke="#94a3b8" stroke-width="1"/>
        <text x="299" y="159" font-size="8.5" font-weight="700" fill="#334155">INTEGRIERTER KANALZUG</text>
        <text x="299" y="172" font-size="8" fill="#475569">Pan · Delay-Send · Reverb-Send</text>

        <!-- Ebene 3: Master Effekte -->
        <rect x="540" y="24" width="200" height="172" rx="10" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.2"/>
        <text x="554" y="46" font-size="9" font-weight="700" font-family="JetBrains Mono, monospace" fill="#2563eb">3 · MASTER-EFFEKTE</text>
        <text x="554" y="64" font-size="11" font-weight="700" font-family="Inter, sans-serif" fill="#0f172a">Klangformung &amp; Raum</text>
        <rect x="554" y="78" width="172" height="34" rx="5" fill="#eff6ff" stroke="#3b82f6" stroke-width="1"/>
        <text x="564" y="93" font-size="9" font-weight="700" fill="#1d4ed8">Insert-Kette</text>
        <text x="564" y="105" font-size="8" fill="#1e40af">Filter · Chorus · Lo-Fi · Granular Cloud</text>
        <rect x="554" y="120" width="172" height="34" rx="5" fill="#f0fdf4" stroke="#10b981" stroke-width="1"/>
        <text x="564" y="135" font-size="9" font-weight="700" fill="#047857">Aux-Sends (Raum)</text>
        <text x="564" y="147" font-size="8" fill="#065f46">Stereo Delay · Ambient Reverb</text>
        <rect x="554" y="162" width="172" height="22" rx="4" fill="#0f172a"/>
        <text x="640" y="176" text-anchor="middle" font-size="8.5" font-weight="700" font-family="JetBrains Mono, monospace" fill="#f8fafc">MASTER LIMITER &amp; SCOPE</text>

        <!-- Verbindungen 1 -> 2 -->
        <path d="M 225 91 C 250 91, 250 91, 275 91" fill="none" stroke="#06b6d4" stroke-width="2.5"/>
        <path d="M 225 125 C 250 125, 250 110, 275 110" fill="none" stroke="#d97706" stroke-width="2.5"/>
        <path d="M 225 159 C 250 159, 250 132, 275 132" fill="none" stroke="#059669" stroke-width="2.5"/>
        <polygon points="275,91 268,87 268,95" fill="#06b6d4"/>
        <polygon points="275,110 268,106 268,114" fill="#d97706"/>
        <polygon points="275,132 268,128 268,136" fill="#059669"/>

        <!-- Verbindungen 2 -> 3 -->
        <path d="M 490 110 C 515 110, 515 95, 540 95" fill="none" stroke="#2563eb" stroke-width="3"/>
        <path d="M 490 162 C 515 162, 515 137, 540 137" fill="none" stroke="#2563eb" stroke-width="2.2" stroke-dasharray="4 3"/>
        <polygon points="540,95 533,91 533,99" fill="#2563eb"/>
        <polygon points="540,137 533,133 533,141" fill="#2563eb"/>
      </svg>
    `;
  }

  buildBodyHtml() {
    const renderCards = (cat) => MODULE_CARDS[cat].map((m) => `
      <article class="man-mod-card">
        <div class="man-mod-svg-wrap">${renderModuleSvg(m.accent, m.title, m.knobs, m.jacks)}</div>
        <div class="man-mod-info">
          <h4>${m.title}</h4>
          <p class="man-mod-purpose">${m.purpose}</p>
          <div class="man-mod-patch">
            <span class="man-patch-lbl">${t('TYPISCHES PATCH:', 'TYPICAL PATCH:')}</span>
            <span class="man-patch-val">${m.patch}</span>
          </div>
        </div>
      </article>
    `).join('');

    const racksHtml = EXAMPLE_RACKS.map((r) => `
      <article class="man-rack-card">
        <div class="man-rack-head">
          <div>
            <h4>${r.title}</h4>
            <p>${r.summary}</p>
          </div>
          <button type="button" class="man-load-rack-btn no-print" data-rack-id="${r.id}">${t('▶ Direkt ins Rack laden', '▶ Load into Rack')}</button>
        </div>
        <div class="man-rack-diagram">${r.diagram}</div>
        <ol class="man-rack-steps">
          ${r.steps.map((s) => `<li>${s}</li>`).join('')}
        </ol>
      </article>
    `).join('');

    return `
      <div class="man-content">
        <!-- 1. Grundprinzip & Signalfluss -->
        <section class="man-section">
          <div class="man-sec-num">01</div>
          <h2>${t('Grundprinzip &amp; Signalfluss', 'Core Principles &amp; Signal Flow')}</h2>
          <p class="man-lead">${t(
            'SYNTHBOARD funktioniert wie ein echtes Modular-Studio: Oben entstehen Takt und Bewegung, in der Mitte spielen die Instrumente, und rechts veredeln Effekte den Gesamtklang.',
            'SYNTHBOARD works like a hardware modular studio: clock and modulation originate at the top, instruments generate sound in the middle, and master effects shape the final mix on the right.'
          )}</p>
          ${this.buildSignalFlowSvg()}
          <div class="man-cable-legend">
            <div class="man-leg-item"><span class="man-dot" style="background:#06b6d4"></span><strong>Clock (Cyan)</strong><span>${t('Takt &amp; Tempo', 'Timing &amp; Tempo')}</span></div>
            <div class="man-leg-item"><span class="man-dot" style="background:#d97706"></span><strong>Gate (Gold)</strong><span>${t('Noten-Start &amp; Trigger', 'Note Triggers &amp; Gates')}</span></div>
            <div class="man-leg-item"><span class="man-dot" style="background:#9333ea"></span><strong>Pitch (${t('Violett', 'Violet')})</strong><span>${t('Tonhöhen &amp; Akkorde', 'Pitch &amp; Chords')}</span></div>
            <div class="man-leg-item"><span class="man-dot" style="background:#059669"></span><strong>Modulation (${t('Grün', 'Green')})</strong><span>${t('Bewegte Regler (CV)', 'Animated Knobs (CV)')}</span></div>
            <div class="man-leg-item"><span class="man-dot" style="background:#2563eb"></span><strong>Audio (${t('Blau', 'Blue')})</strong><span>${t('Hörbarer Klangweg', 'Audible Signal Path')}</span></div>
          </div>
        </section>

        <!-- 2. Bedienung & Performance -->
        <section class="man-section">
          <div class="man-sec-num">02</div>
          <h2>${t('Bedienung &amp; Performance', 'Operation &amp; Performance')}</h2>
          <div class="man-ops-grid">
            <div class="man-op-card">
              <div class="man-op-tag">${t('DREHREGLER', 'KNOBS')}</div>
              <h4>${t('Präzise Klangformung', 'Precise Sound Shaping')}</h4>
              <p>${t(
                'Regler senkrecht ziehen oder mit dem Mausrad drehen. <strong>Doppelklick</strong> setzt jeden Regler sofort auf seinen Werkswert zurück. Über ein gestecktes Kabel-Badge lässt sich die Modulationsstärke (0–200%) direkt einstellen.',
                'Drag knobs vertically or use the mouse wheel. <strong>Double-click</strong> resets any knob to its default value. Dragging a modulation cable badge adjusts modulation depth (0–200%).'
              )}</p>
            </div>
            <div class="man-op-card">
              <div class="man-op-tag">${t('SHIFT + KLICK', 'SHIFT + CLICK')}</div>
              <h4>5-Slot Focus-Dock</h4>
              <p>${t(
                'Halte <strong>Shift</strong> gedrückt und klicke auf bis zu 5 beliebige Regler im Rack. Sie landen rechts im Performance-Board als Live-Controls und lassen sich blitzschnell per Maus oder Pfeiltasten steuern.',
                'Hold <strong>Shift</strong> and click up to 5 knobs anywhere in the rack to pin them into the right-hand Performance Board as Live Controls.'
              )}</p>
            </div>
            <div class="man-op-card">
              <div class="man-op-tag">${t('TASTEN 1–5 &amp; 6–8', 'KEYS 1–5 &amp; 6–8')}</div>
              <h4>Performance-Snapshots</h4>
              <p>${t(
                'Speichere bis zu 5 komplette Regler-Szenen auf den Slots <strong>1–5</strong>. Mit den Morph-Tasten <strong>6 (Direkt)</strong>, <strong>7 (Glide)</strong> und <strong>8 (Slow)</strong> blendet SYNTHBOARD alle Parameter weich ineinander über.',
                'Store up to 5 complete parameter scenes in slots <strong>1–5</strong>. Use speed keys <strong>6 (Direct)</strong>, <strong>7 (Glide)</strong>, and <strong>8 (Slow)</strong> to morph smoothly between scenes.'
              )}</p>
            </div>
          </div>
        </section>

        <!-- 3. Die Bausteine -->
        <section class="man-section">
          <div class="man-sec-num">03</div>
          <div class="man-sec-head-row">
            <h2>${t('Die Bausteine', 'Building Blocks')}</h2>
            <div class="man-cat-tabs no-print">
              <button type="button" class="man-cat-btn active" data-cat="all">${t('Alle', 'All')}</button>
              <button type="button" class="man-cat-btn" data-cat="control">${t('Steuerung', 'Control')}</button>
              <button type="button" class="man-cat-btn" data-cat="source">${t('Instrumente', 'Instruments')}</button>
              <button type="button" class="man-cat-btn" data-cat="effect">${t('Effekte', 'Effects')}</button>
            </div>
          </div>

          <div class="man-cat-section" data-cat="control">
            <h3 class="man-cat-title">${t('Steuerung &amp; Rhythmus', 'Control &amp; Rhythm')}</h3>
            <div class="man-mod-grid">${renderCards('control')}</div>
          </div>

          <div class="man-cat-section" data-cat="source">
            <h3 class="man-cat-title">${t('Instrumente &amp; Klangquellen', 'Instruments &amp; Sound Sources')}</h3>
            <div class="man-mod-grid">${renderCards('source')}</div>
          </div>

          <div class="man-cat-section" data-cat="effect">
            <h3 class="man-cat-title">${t('Master-Effekte', 'Master Effects')}</h3>
            <div class="man-mod-grid">${renderCards('effect')}</div>
          </div>
        </section>

        <!-- 4. 5 Beispiel-Racks -->
        <section class="man-section">
          <div class="man-sec-num">04</div>
          <h2>${t('5 Beispiel-Racks mit Schaltplänen', '5 Example Racks with Patch Diagrams')}</h2>
          <p class="man-lead">${t(
            'Jeder dieser fünf Aufbauten zeigt ein konkretes Klangkonzept. Klicke auf <strong>Direkt ins Rack laden</strong>, um den Patch sofort anzuhören und weiterzuentwickeln.',
            'Each of these five setups demonstrates a distinct sound design concept. Click <strong>Load into Rack</strong> to audition and customize it immediately.'
          )}</p>
          <div class="man-racks-list">
            ${racksHtml}
          </div>
        </section>
      </div>
    `;
  }

  buildModalHtml() {
    return `
      <div class="man-dialog">
        <header class="man-header no-print">
          <div class="man-brand">
            <span class="man-brand-badge">SYNTHBOARD</span>
            <h1>Studio-Handbuch</h1>
          </div>
          <div class="man-header-actions">
            <button type="button" id="man-download-ai-md" class="man-btn-secondary" title="Komplette technische KI-Referenz als Markdown (.md) herunterladen">🤖 KI-Referenz (.md)</button>
            <button type="button" id="man-download-rack-md" class="man-btn-secondary" title="KI-Referenz + aktuelles Rack als JSON in einer .md-Datei herunterladen">📋 Aktuelles Rack + KI-Doku (.md)</button>
            <button type="button" id="man-download-pdf" class="man-btn-primary" title="Öffnet die druckfertige PDF-Ansicht">⬇ PDF / Druck</button>
            <button type="button" id="man-download-html" class="man-btn-secondary" title="Eigenständige HTML-Datei speichern">HTML</button>
            <button type="button" id="man-close-btn" class="man-close-btn" title="Schließen [Esc]">✕</button>
          </div>
        </header>
        <div class="man-scroll-area">
          ${this.buildBodyHtml()}
        </div>
      </div>
    `;
  }

  getStandaloneDocumentHtml() {
    return `<!doctype html>
<html lang="de">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>SYNTHBOARD · Studio-Handbuch</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; padding: 32px; font-family: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif; color: #0f172a; background: #ffffff; line-height: 1.5; }
  .doc-title { border-bottom: 2px solid #0f172a; padding-bottom: 16px; margin-bottom: 32px; display: flex; justify-content: space-between; align-items: baseline; }
  .doc-title h1 { margin: 0; font-size: 28px; letter-spacing: -0.02em; }
  .doc-title span { font-family: monospace; font-size: 12px; color: #64748b; }
  .man-content { max-width: 960px; margin: 0 auto; }
  .man-section { margin-bottom: 48px; page-break-inside: avoid; }
  .man-sec-num { font-family: monospace; font-size: 11px; font-weight: 700; color: #64748b; letter-spacing: 0.1em; }
  h2 { margin: 4px 0 12px; font-size: 22px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; }
  h3 { margin: 24px 0 12px; font-size: 15px; color: #334155; text-transform: uppercase; letter-spacing: 0.05em; }
  .man-lead { color: #475569; font-size: 14px; margin-bottom: 18px; }
  .man-flow-svg, .man-patch-svg { width: 100%; height: auto; display: block; margin: 12px 0; }
  .man-cable-legend { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 14px; }
  .man-leg-item { display: flex; align-items: center; gap: 8px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px 10px; font-size: 12px; }
  .man-dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
  .man-ops-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
  .man-op-card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; background: #f8fafc; }
  .man-op-tag { font-family: monospace; font-size: 10px; font-weight: 700; color: #0284c7; margin-bottom: 4px; }
  .man-op-card h4 { margin: 0 0 6px; font-size: 14px; }
  .man-op-card p { margin: 0; font-size: 12.5px; color: #475569; }
  .man-mod-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; }
  .man-mod-card { display: flex; gap: 12px; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; background: #ffffff; page-break-inside: avoid; }
  .man-mod-svg-wrap { width: 145px; flex-shrink: 0; }
  .man-mod-svg { width: 100%; height: auto; display: block; }
  .man-mod-info h4 { margin: 0 0 6px; font-size: 14px; }
  .man-mod-purpose { margin: 0 0 8px; font-size: 12px; color: #475569; }
  .man-mod-patch { background: #f1f5f9; border-radius: 4px; padding: 5px 8px; font-size: 11px; }
  .man-patch-lbl { font-family: monospace; font-size: 9.5px; font-weight: 700; color: #64748b; display: block; }
  .man-patch-val { font-family: monospace; font-weight: 700; color: #0f172a; }
  .man-rack-card { border: 1px solid #cbd5e1; border-radius: 10px; padding: 16px; margin-bottom: 20px; page-break-inside: avoid; }
  .man-rack-head h4 { margin: 0 0 4px; font-size: 16px; }
  .man-rack-head p { margin: 0 0 10px; font-size: 13px; color: #475569; }
  .man-rack-steps { margin: 10px 0 0; padding-left: 20px; font-size: 12.5px; color: #334155; }
  .man-rack-steps li { margin-bottom: 4px; }
  .no-print { display: none !important; }
  @media print {
    body { padding: 0; }
    .man-section { page-break-after: auto; }
  }
</style>
</head>
<body>
  <div class="man-content">
    <div class="doc-title">
      <h1>SYNTHBOARD · Studio-Handbuch</h1>
      <span>Visuelle Anleitung &amp; Schaltpläne</span>
    </div>
    ${this.buildBodyHtml()}
  </div>
</body>
</html>`;
  }

  openPrintView() {
    const html = this.getStandaloneDocumentHtml();
    const win = window.open('', '_blank', 'width=1024,height=800');
    if (win) {
      win.document.open();
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => {
        try { win.print(); } catch { /* ignore */ }
      }, 250);
    } else {
      // Fallback: Download wenn Popups blockiert sind
      this.downloadStandaloneHtml();
      this.onToast?.('Popup blockiert – Handbuch als HTML heruntergeladen');
    }
  }

  downloadStandaloneHtml() {
    const html = this.getStandaloneDocumentHtml();
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'SYNTHBOARD-Handbuch.html';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    this.onToast?.('Handbuch als SYNTHBOARD-Handbuch.html gespeichert');
  }

  buildAiReferenceMarkdown() {
    const lines = [];
    lines.push('# SYNTHBOARD – Technische KI-Referenz (JSON-Spec & Echte Modul-IDs)');
    lines.push('');
    lines.push('Diese Datei wurde direkt aus den laufenden `MODULES`-Definitionen von SYNTHBOARD generiert.');
    lines.push('');
    lines.push('## 1. JSON-Preset-Spezifikation (`version: 2`)');
    lines.push('');
    lines.push('```json');
    lines.push('{');
    lines.push('  "name": "Mein Cinematic Patch",');
    lines.push('  "state": {');
    lines.push('    "version": 2,');
    lines.push('    "master": 0.82,');
    lines.push('    "modules": [');
    lines.push('      {');
    lines.push('        "id": "clk1",');
    lines.push('        "type": "master_clock",');
    lines.push('        "enabled": true,');
    lines.push('        "values": { "tempo": 96, "swing": 0.08 },');
    lines.push('        "pos": { "x": 80, "y": 80 }');
    lines.push('      }');
    lines.push('    ],');
    lines.push('    "cables": [');
    lines.push('      { "from": "clk1:1/16", "to": "euc1:clockIn", "depth": 1.0 }');
    lines.push('    ],');
    lines.push('    "snapshots": {');
    lines.push('      "activeSlot": 1,');
    lines.push('      "currentSpeed": 8,');
    lines.push('      "slots": {');
    lines.push('        "1": { "name": "Intro", "values": { "chord_glide": { "cutoff": 700, "level": 0.45 } } },');
    lines.push('        "2": { "name": "Drop", "values": { "chord_glide": { "cutoff": 2400, "level": 0.8 } } }');
    lines.push('      }');
    lines.push('    }');
    lines.push('  }');
    lines.push('}');
    lines.push('```');
    lines.push('');
    lines.push('- **Wichtig:** `snapshots` wird sowohl unter `data.snapshots` als auch unter `data.state.snapshots` erkannt.');
    lines.push('- Partielle `values` pro Snapshot-Slot (nur geänderte Parameter pro Modul-`id` oder Modul-`type`) werden beim Import automatisch mit den Basiswerten aller geladenen Module aufgefüllt.');
    lines.push('');
    lines.push('## 2. Verifizierte Jack- & Parameter-Hinweise (`patchSystem.js` & Aliase)');
    lines.push('');
    lines.push('- `euclidean`: Ausgänge `trigOut` (TRIG), `invOut` (INV). Eingänge: `clockIn`, `resetIn`.');
    lines.push('- `prob_gate`: Eingänge `trigIn` (TRIG IN), `probCv` (PROB CV). Ausgänge: `trigOut` (PASSED), `altOut` (SKIPPED).');
    lines.push('- `slow_random`: Ausgänge `cvOut` (CV OUT, Alias `modOut`), `invOut` (INV CV).');
    lines.push('- `pluck`: Filter-Cutoff-Modulation heißt `modCutoff` (`mod` IN).');
    lines.push('- `noise`: Parameter `ftype` (Filtertyp) und `color` (Klangfarbe).');
    lines.push('- `slope_generator`: `mode` ist `"loop"` | `"trig"` | `"gate"`. Ausgänge: `envOut`, `invOut`, `eofOut` (End-of-Fall Gate). **Wichtig:** `curve` liegt strikt im Bereich `[0, 1]` (keine negativen Werte wie `-0.2` für exponentielle/logarithmische Kurven verwenden).');
    lines.push('- **Zeit-Einheiten in Sekunden:** Parameter wie `chorus.delay`, `reverb.predelay` und `delay.time` müssen immer in **Sekunden** (z. B. `0.018` statt `18` ms) angegeben werden.');
    lines.push('- **Parameter-Ablage:** Alle Regler und Optionen gehören gemeinsam in `values` (falls dennoch `options` separat übergeben wird, führt der Importer beide Objekte automatisch zusammen).');
    lines.push('');
    lines.push('## 3. Best-Practice-Rezepte für KIs');
    lines.push('');
    lines.push('- **Sidechain-Ducking:** `master_clock:1/4` -> `slope_generator:trigIn` (`mode: "trig"`), `slope_generator:invOut` -> `instrument:vcaCv` (mit negativem oder passendem `depth`).');
    lines.push('- **Kaskadierende Trigger-Ketten:** `slope_generator:eofOut` -> `next_slope:trigIn` (löst am Ende der Fall-Phase das nächste Modul aus).');
    lines.push('- **A/B-Gate-Routing:** `logic_switch` mit `gateIn` + `ctrlCv` (z. B. von `slow_random:cvOut`) verteilt Triggers dynamisch auf `passOut` vs. `invPassOut`.');
    lines.push('- **Polyphone Harmonie-Kette:** `chord_glide:pitchOut` -> `chord_arp:pitchIn`, `chord_arp:pitchOut` -> `felt_piano:pitchIn` (oder `pluck:pitchIn`), `chord_arp:gateOut` -> `felt_piano:gateIn`.');
    lines.push('- **Performance-Automation:** `clock_divider:barOut` -> `snapshot_ctrl:nextIn` schaltet automatisch durch die 5 Performance-Snapshots.');
    lines.push('');
    lines.push(`## 4. Alle ${Object.keys(MODULES).length} Module (Exakte Code-IDs)`);
    lines.push('');

    const byCat = { control: [], source: [], effect: [] };
    for (const [type, def] of Object.entries(MODULES)) {
      const bucket = byCat[def.category] || byCat.control;
      bucket.push([type, def]);
    }

    const catNames = {
      control: 'Steuerung & Rhythmus (`control`)',
      source: 'Instrumente & Klangquellen (`source`)',
      effect: 'Master-Effekte (`effect`)',
    };

    for (const catKey of ['control', 'source', 'effect']) {
      lines.push(`### ${catNames[catKey]}`);
      lines.push('');
      for (const [type, def] of byCat[catKey]) {
        lines.push(`#### ${def.title} (\`${type}\`)`);
        if (def.description) lines.push(`- *${def.description}*`);
        if (def.params?.length) {
          const pStr = def.params
            .map((p) => `\`${p.id}\` (${p.min}..${p.max}, default \`${p.value}\`)`)
            .join(', ');
          lines.push(`- **Params (\`values\`):** ${pStr}`);
        }
        if (def.options?.length) {
          const oStr = def.options
            .map((o) => `\`${o.id}\` [${o.choices.map((c) => `\`${c[0]}\``).join(' | ')}] (default \`${o.value}\`)`)
            .join(', ');
          lines.push(`- **Options (\`values\`):** ${oStr}`);
        }
        if (def.jacks?.length) {
          const ins = def.jacks.filter((j) => j.type === 'in').map((j) => `\`${j.id}\` (${j.signal}, "${j.label}")`).join(', ');
          const outs = def.jacks.filter((j) => j.type === 'out').map((j) => `\`${j.id}\` (${j.signal}, "${j.label}")`).join(', ');
          if (ins) lines.push(`- **Inputs:** ${ins}`);
          if (outs) lines.push(`- **Outputs:** ${outs}`);
        }
        lines.push('');
      }
    }

    return lines.join('\n');
  }

  downloadMarkdownFile(filename, content) {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  downloadAiReferenceMd() {
    const md = this.buildAiReferenceMarkdown();
    this.downloadMarkdownFile('SYNTHBOARD_AI_REFERENCE.md', md);
    this.onToast?.('KI-Referenz als SYNTHBOARD_AI_REFERENCE.md heruntergeladen');
  }

  downloadCurrentRackForAiMd() {
    const refMd = this.buildAiReferenceMarkdown();
    const state = this.getCurrentState ? this.getCurrentState() : null;
    const rackSection = [
      '',
      '---',
      '',
      '## 5. Aktuell geladenes Rack (JSON-Export)',
      '',
      '```json',
      JSON.stringify({ name: 'Aktuelles SYNTHBOARD Rack', state }, null, 2),
      '```',
      '',
    ].join('\n');

    this.downloadMarkdownFile('SYNTHBOARD_RACK_AND_AI_DOC.md', refMd + rackSection);
    this.onToast?.('Aktuelles Rack + KI-Doku als SYNTHBOARD_RACK_AND_AI_DOC.md heruntergeladen');
  }
}
