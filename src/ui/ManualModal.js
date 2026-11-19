// SYNTHBOARD – Visual Studio Manual (In-App + Print/PDF, HTML & AI Markdown Export)
// Fully bilingual (EN / DE) and aligned with exact UI labels & canonical JSON spec (version + name).
import { MODULES } from '../modules/index.js';
import { applyTranslations, getLang, onLangChange, t } from './i18n.js';

const SIG_COLORS = {
  clock: '#06b6d4',
  gate: '#d97706',
  pitch: '#9333ea',
  mod: '#059669',
  audio: '#2563eb',
};

/** Compact inline SVG for a module overview card */
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

/** Patch diagram SVG for the 5 example racks */
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
    const tag = n.cat === 'control'
      ? t('STEUERUNG', 'CONTROL')
      : n.cat === 'effect'
        ? t('EFFEKT', 'EFFECT')
        : 'VOICE';
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
    <svg viewBox="0 0 640 ${maxY}" class="man-patch-svg" aria-label="${t('Patch-Schaltplan', 'Patch Diagram')}">
      <rect x="0" y="0" width="640" height="${maxY}" rx="8" fill="#ffffff" stroke="#e2e8f0" stroke-width="1"/>
      ${nodeBoxes}
      ${cablePaths}
    </svg>
  `;
}

function getModuleCards() {
  return {
    control: [
      {
        title: 'Master Clock',
        accent: '#06b6d4',
        purpose: t(
          'Der zentrale Herzschlag. Bestimmt Tempo (BPM), Swing und Takt-Resets für das gesamte Studio.',
          'The central studio heartbeat. Controls master tempo (BPM), swing, and bar resets across all modules.'
        ),
        patch: '1/16 -> Euclidean · CLOCK',
        knobs: [{ label: 'Tempo', sweet: '90 BPM', angle: -10 }, { label: 'Swing', sweet: '12%', angle: -65 }],
        jacks: [{ label: '1/16', sig: 'clock', dir: 'out' }, { label: '1/4', sig: 'clock', dir: 'out' }, { label: '1 BAR', sig: 'clock', dir: 'out' }, { label: 'RESET', sig: 'gate', dir: 'out' }],
      },
      {
        title: 'Euclidean Rhythm',
        accent: '#f59e0b',
        purpose: t(
          'Verteilt Schläge mathematisch gleichmäßig auf Taktschritte – ideal für organische Grooves und Polyrhythmik.',
          'Distributes hits evenly across step cycles using the Björklund algorithm for organic grooves and polyrhythms.'
        ),
        patch: 'TRIG -> Pluck Synth · GATE',
        knobs: [{ label: 'Steps', sweet: '16', angle: 60 }, { label: 'Hits', sweet: '5', angle: -20 }, { label: 'Rotate', sweet: '0', angle: -110 }],
        jacks: [{ label: 'CLOCK', sig: 'clock', dir: 'in' }, { label: 'RESET', sig: 'gate', dir: 'in' }, { label: 'TRIG', sig: 'gate', dir: 'out' }, { label: 'INV', sig: 'gate', dir: 'out' }],
      },
      {
        title: 'Probability Gate',
        accent: '#ec4899',
        purpose: t(
          'Lässt Trigger nur mit einstellbarer Wahrscheinlichkeit durch – macht starre Patterns lebendig.',
          'Routes triggers probabilistically between Passed and Skipped outputs to keep patterns evolving.'
        ),
        patch: 'PASSED -> Hybrid Perc · GATE',
        knobs: [{ label: 'Chance', sweet: '65%', angle: 20 }, { label: 'Burst', sweet: '1x', angle: -90 }],
        jacks: [{ label: 'TRIG IN', sig: 'gate', dir: 'in' }, { label: 'PASSED', sig: 'gate', dir: 'out' }, { label: 'SKIPPED', sig: 'gate', dir: 'out' }],
      },
      {
        title: 'Random Walk & Quantizer',
        accent: '#10b981',
        purpose: t(
          'Erzeugt sanft wandernde Melodien und rastet sie über den Scale Quantizer exakt auf eine Tonart ein.',
          'Generates bounded melodic movement and locks pitches cleanly into a musical scale via Scale Quantizer.'
        ),
        patch: 'PITCH OUT -> Instrument · PITCH',
        knobs: [{ label: 'Step', sweet: '2', angle: -30 }, { label: 'Range', sweet: '2', angle: 0 }],
        jacks: [{ label: 'CLOCK', sig: 'clock', dir: 'in' }, { label: 'CV IN', sig: 'pitch', dir: 'in' }, { label: 'PITCH OUT', sig: 'pitch', dir: 'out' }, { label: 'GATE OUT', sig: 'gate', dir: 'out' }],
      },
      {
        title: 'Slow Random',
        accent: '#10b981',
        purpose: t(
          'Langsame, organische Modulationswellen (wie Wind oder Atmung) für Filter, Filz-Dämpfung oder Panorama.',
          'Slow organic modulation waveforms (like tide or breath) for filter cutoff, felt damping, or stereo pan.'
        ),
        patch: 'CV OUT -> Filter · CUTOFF CV',
        knobs: [{ label: 'Rate', sweet: '0.12 Hz', angle: -60 }, { label: 'Smooth', sweet: '1.2 s', angle: 10 }, { label: 'Depth', sweet: '70%', angle: 40 }],
        jacks: [{ label: 'TRIG', sig: 'gate', dir: 'in' }, { label: 'CV OUT', sig: 'mod', dir: 'out' }, { label: 'INV CV', sig: 'mod', dir: 'out' }],
      },
      {
        title: 'Slope Generator',
        accent: '#eab308',
        purpose: t(
          'Flexible Hüllkurve von 0.01s bis 180s. Ideal für lange Swells, Sidechain-Ducking und Ablauf-Kaskaden.',
          'Flexible function generator from 0.01s to 180s for epic ambient swells, sidechain ducking, and trigger cascades.'
        ),
        patch: 'INV OUT -> Bass · VCA CV',
        knobs: [{ label: 'Rise', sweet: '3.5 s', angle: -20 }, { label: 'Fall', sweet: '6.0 s', angle: 25 }, { label: 'Curve', sweet: '60%', angle: 15 }],
        jacks: [{ label: 'TRIG IN', sig: 'gate', dir: 'in' }, { label: 'ENV OUT', sig: 'mod', dir: 'out' }, { label: 'EOR OUT', sig: 'gate', dir: 'out' }, { label: 'EOF OUT', sig: 'gate', dir: 'out' }],
      },
      {
        title: 'CV Logic & Switch',
        accent: '#0284c7',
        purpose: t(
          'Weiche, Flip-Flop-Schalter und Gate-Kombinierer. Entscheidet per Steuerspannung, wohin Rhythmen fließen.',
          'Voltage-controlled A/B gate router, toggle latch, and Boolean logic combiner.'
        ),
        patch: 'PASS A / INV B -> 2 Voices',
        knobs: [{ label: 'Thresh', sweet: '50%', angle: 0 }],
        jacks: [{ label: 'GATE IN', sig: 'gate', dir: 'in' }, { label: 'CTRL CV', sig: 'mod', dir: 'in' }, { label: 'PASS A', sig: 'gate', dir: 'out' }, { label: 'LATCH CV', sig: 'mod', dir: 'out' }],
      },
      {
        title: 'Snapshot Controller',
        accent: '#f97316',
        purpose: t(
          'Schaltet Performance-Snapshots taktgenau um – inklusive eigenem Song-Ablaufplan mit individueller Taktzahl je Slot.',
          'Automates Performance Snapshots by bar count – includes built-in Song Mode with individual bar counts per slot (1–5).'
        ),
        patch: 'Master Clock · 1 BAR -> BAR IN',
        knobs: [{ label: 'Bars S1', sweet: '8', angle: -20 }, { label: 'Bars S2', sweet: '16', angle: 30 }],
        jacks: [{ label: 'BAR IN', sig: 'clock', dir: 'in' }, { label: 'NEXT', sig: 'gate', dir: 'in' }, { label: 'SLOT 1', sig: 'gate', dir: 'in' }, { label: 'RESET', sig: 'gate', dir: 'in' }],
      },
      {
        title: 'Chord Arpeggiator',
        accent: '#818cf8',
        purpose: t(
          'Zerlegt polyphone Akkorde (z. B. von Chord Glide) im Takt in treibende, filmische Ostinati.',
          'Slices polyphonic chords from Chord Glide into rhythmic, multi-octave cinematic ostinatos.'
        ),
        patch: 'PITCH OUT & GATE OUT -> Felt Piano',
        knobs: [{ label: 'Octaves', sweet: '2', angle: 0 }, { label: 'GateLen', sweet: '65%', angle: 20 }, { label: 'Density', sweet: '90%', angle: 75 }],
        jacks: [{ label: 'CLOCK', sig: 'clock', dir: 'in' }, { label: 'POLY PITCH', sig: 'pitch', dir: 'in' }, { label: 'GATE OUT', sig: 'gate', dir: 'out' }, { label: 'PITCH OUT', sig: 'pitch', dir: 'out' }],
      },
    ],
    source: [
      {
        title: 'Chord Glide',
        accent: '#a855f7',
        purpose: t(
          'Polyphoner Stimmführungs-Synthesizer. Verbindet Akkorde mit minimalen Ton-Sprüngen und sendet sie weiter.',
          'Polyphonic voice-leading synth & harmonic brain. Smoothly glides chords and feeds Arps and Bass.'
        ),
        patch: 'POLY PITCH -> Chord Arpeggiator',
        knobs: [{ label: 'Glide', sweet: '0.4 s', angle: -30 }, { label: 'Cutoff', sweet: '1.8 kHz', angle: 10 }, { label: 'Detune', sweet: '10 ct', angle: 20 }],
        jacks: [{ label: 'CLOCK', sig: 'clock', dir: 'in' }, { label: 'POLY PITCH', sig: 'pitch', dir: 'out' }, { label: 'ROOT PITCH', sig: 'pitch', dir: 'out' }, { label: 'CHORD TRIG', sig: 'gate', dir: 'out' }],
      },
      {
        title: 'Felt Piano',
        accent: '#f59e0b',
        purpose: t(
          'Intimes, mechanisches Filzklavier mit Holzresonanz und Hammer-Geräusch im Stil von Nils Frahm.',
          'Intimate felt piano with mechanical hammer noise and resonant wood body.'
        ),
        patch: 'Slow Random -> FELT CV',
        knobs: [{ label: 'Felt', sweet: '70%', angle: 35 }, { label: 'Decay', sweet: '3.0 s', angle: 20 }, { label: 'Body', sweet: '60%', angle: 15 }],
        jacks: [{ label: 'GATE', sig: 'gate', dir: 'in' }, { label: 'PITCH', sig: 'pitch', dir: 'in' }, { label: 'FELT CV', sig: 'mod', dir: 'in' }, { label: 'VCA CV', sig: 'mod', dir: 'in' }],
      },
      {
        title: 'Solo Violin',
        accent: '#e11d48',
        purpose: t(
          'Ausdrucksstarke Streicherstimme mit Bogen-Reibung, Fingervibrato und Legato-Lagenwechseln.',
          'Expressive bowed solo string engine with rosin texture, finger vibrato, and legato portamento.'
        ),
        patch: 'Slow Random -> BOW CV',
        knobs: [{ label: 'Bow', sweet: '55%', angle: 10 }, { label: 'Vibrato', sweet: '45%', angle: -10 }, { label: 'Glide', sweet: '180 ms', angle: -35 }],
        jacks: [{ label: 'BOW GATE', sig: 'gate', dir: 'in' }, { label: 'PITCH', sig: 'pitch', dir: 'in' }, { label: 'BOW CV', sig: 'mod', dir: 'in' }, { label: 'VCA CV', sig: 'mod', dir: 'in' }],
      },
      {
        title: 'Drone Machine',
        accent: '#6366f1',
        purpose: t(
          '6-stimmiger Akkord-Teppich mit analoger Verstimmung und Schwebung für tiefe Ambient-Flächen.',
          '6-voice harmonic cluster engine with sub-bass, FM, and analog drift for lush ambient textures.'
        ),
        patch: 'Slope Generator · ENV OUT -> VCA CV',
        knobs: [{ label: 'Tone', sweet: '650 Hz', angle: -40 }, { label: 'Detune', sweet: '14 ct', angle: -15 }, { label: 'Drift', sweet: '65%', angle: 25 }],
        jacks: [{ label: 'PITCH', sig: 'pitch', dir: 'in' }, { label: 'TONE CV', sig: 'mod', dir: 'in' }, { label: 'VCA CV', sig: 'mod', dir: 'in' }, { label: 'PAN CV', sig: 'mod', dir: 'in' }],
      },
      {
        title: 'Pluck Synth',
        accent: '#14b8a6',
        purpose: t(
          'Akustisch-organischer Zupfklang zwischen Harfe, Kalimba und gläserner Glocke.',
          'Organic acoustic string model spanning harp, kalimba, and crystalline glass plucks.'
        ),
        patch: 'Euclidean · TRIG -> GATE',
        knobs: [{ label: 'Tone', sweet: '2.8 kHz', angle: 15 }, { label: 'Damp', sweet: '1.2 s', angle: 0 }, { label: 'Bright', sweet: '60%', angle: 20 }],
        jacks: [{ label: 'GATE', sig: 'gate', dir: 'in' }, { label: 'PITCH', sig: 'pitch', dir: 'in' }, { label: 'FILTER CV', sig: 'mod', dir: 'in' }, { label: 'VCA CV', sig: 'mod', dir: 'in' }],
      },
      {
        title: 'Bass Synth & Drum Rack',
        accent: '#ef4444',
        purpose: t(
          'Sattes Analog-Fundament (303/Subbass) und 4-teilige Synthesizer-Drums für treibende Grooves.',
          'Punchy 303/sub bass engine paired with 4 synthesized drum channels for tight grooves.'
        ),
        patch: 'Chord Glide · ROOT -> Bass · PITCH',
        knobs: [{ label: 'Cutoff', sweet: '420 Hz', angle: -55 }, { label: 'Reso', sweet: '4.5', angle: 5 }, { label: 'Sub', sweet: '60%', angle: 15 }],
        jacks: [{ label: 'GATE', sig: 'gate', dir: 'in' }, { label: 'PITCH', sig: 'pitch', dir: 'in' }, { label: 'CUTOFF CV', sig: 'mod', dir: 'in' }, { label: 'VCA CV', sig: 'mod', dir: 'in' }],
      },
      {
        title: 'Resonator & Spectral Swarm',
        accent: '#38bdf8',
        purpose: t(
          'Klangkörper-Resonanzen und 32 schimmernde additive Partials für cineastische Texturen.',
          '6 coupled modal resonators and a 32-partial additive swarm for atmospheric and experimental textures.'
        ),
        patch: 'Probability Gate · PASSED -> GATE',
        knobs: [{ label: 'Material', sweet: '55%', angle: 10 }, { label: 'Damp', sweet: '40%', angle: -20 }, { label: 'Scatter', sweet: '70%', angle: 40 }],
        jacks: [{ label: 'GATE', sig: 'gate', dir: 'in' }, { label: 'PITCH', sig: 'pitch', dir: 'in' }, { label: 'MATERIAL CV', sig: 'mod', dir: 'in' }, { label: 'MUTATE', sig: 'gate', dir: 'in' }],
      },
    ],
    effect: [
      {
        title: 'Granular Cloud',
        accent: '#c084fc',
        purpose: t(
          'Echtzeit-Granular-Synthese & Shimmer (+1 Oktave / +Quinte). Verwandelt einzelne Töne in weite Film-Wolken.',
          'Real-time stereo microsound granular engine & pitch shimmer (+1 Oct / +5th) with freeze buffer.'
        ),
        patch: 'Freeze / Mix CV Modulation',
        knobs: [{ label: 'Size', sweet: '0.14 s', angle: -15 }, { label: 'Texture', sweet: '65%', angle: 30 }, { label: 'Feedback', sweet: '50%', angle: 15 }],
        jacks: [{ label: 'FREEZE', sig: 'gate', dir: 'in' }, { label: 'MIX CV', sig: 'mod', dir: 'in' }, { label: 'TEXTURE CV', sig: 'mod', dir: 'in' }],
      },
      {
        title: 'Stereo Delay',
        accent: '#ffcc4d',
        purpose: t(
          'Analoges Echo und Ping-Pong-Delay mit Warmth-Filterung und Tonband-Drift.',
          'Analog stereo and ping-pong echo with tone shaping and wow/flutter tape modulation.'
        ),
        patch: 'Channel Delay Send -> Delay',
        knobs: [{ label: 'Time', sweet: '0.42 s', angle: -10 }, { label: 'Feedback', sweet: '50%', angle: 0 }, { label: 'Tone', sweet: '2.4 kHz', angle: -20 }],
        jacks: [{ label: 'TIME CV', sig: 'mod', dir: 'in' }],
      },
      {
        title: 'Ambient Reverb',
        accent: '#6ee7a8',
        purpose: t(
          'Warmer Stereo-Raumhall (bis 15 Sekunden) für tiefe, unaufdringliche Klangräume.',
          'Lush warm hall reverb (up to 15s) with smooth high-frequency damping and pre-delay.'
        ),
        patch: 'Channel Reverb Send -> Reverb',
        knobs: [{ label: 'Decay', sweet: '7.5 s', angle: 35 }, { label: 'Damp', sweet: '45%', angle: -10 }, { label: 'Mix', sweet: '45%', angle: -15 }],
        jacks: [{ label: 'MIX CV', sig: 'mod', dir: 'in' }],
      },
      {
        title: 'Analog Filter & Lo-Fi',
        accent: '#ff5d73',
        purpose: t(
          '24-dB-Filter mit weicher Soft-Clip-Sättigung sowie Vintage-Kassettenleiern für analoge Wärme.',
          'Oversampled 24 dB filter with tanh warmth plus vintage cassette wow/flutter modulation.'
        ),
        patch: 'Slow Random · CV OUT -> CUTOFF CV',
        knobs: [{ label: 'Cutoff', sweet: '2.2 kHz', angle: 10 }, { label: 'Drive', sweet: '20%', angle: -40 }, { label: 'Wobble', sweet: '30%', angle: -20 }],
        jacks: [{ label: 'CUTOFF CV', sig: 'mod', dir: 'in' }],
      },
    ],
  };
}

function getExampleRacks() {
  return [
    {
      id: 'rack1_drone',
      title: t('1. Atmendes Drone-Pad (Einstieg in Modulation)', '1. Breathing Drone Pad (Modulation Basics)'),
      summary: t(
        'Ein tiefer, lebendiger Ambient-Teppich, der alle 10 Sekunden sanft an- und abschwillt, während das Filter langsam atmet.',
        'A warm ambient pad that swells softly every 10 seconds while Slow Random animates harmonic brightness.'
      ),
      steps: [
        t('Stelle bei der Drone Maschine den Grundton auf A1 (33), Akkord „Quinten“ und aktiviere Stimmen 1, 3, 5.', 'On Drone Machine set Root to A1 (33), Chord to Fifths, and enable voices 1, 3, and 5.'),
        t('Setze den Slope Generator auf Zyklisch (Loop) mit Rise 4.5s und Fall 6.0s.', 'Set Slope Generator to Loop mode with Rise 4.5s and Fall 6.0s.'),
        t('Verbinde ENV OUT mit VCA CV der Drone (steuert das langsame An- und Abschwellen).', 'Connect ENV OUT to Drone VCA CV for slow organic swells.'),
        t('Verbinde Slow Random CV OUT mit TONE CV der Drone und drehe den Reverb-Send auf 65%.', 'Connect Slow Random CV OUT to Drone TONE CV and raise channel Reverb Send to 65%.'),
      ],
      diagram: renderPatchDiagramSvg(
        [
          { id: 'slope', title: 'Slope Generator', sub: t('Zyklisch · 4.5s / 6s', 'Loop · 4.5s / 6s'), cat: 'control', x: 24, y: 20 },
          { id: 'slow', title: 'Slow Random', sub: t('Gleitend · 0.08 Hz', 'Smooth · 0.08 Hz'), cat: 'control', x: 24, y: 92 },
          { id: 'drone', title: 'Drone Machine', sub: 'A1 Fifths · Rev 65%', cat: 'source', x: 255, y: 56 },
          { id: 'chorus', title: 'Chorus', sub: t('Breite 55%', 'Depth 55%'), cat: 'effect', x: 485, y: 20 },
          { id: 'reverb', title: 'Ambient Reverb', sub: 'Decay 9.0 s', cat: 'effect', x: 485, y: 92 },
        ],
        [
          { from: 'slope', to: 'drone', fx: 118, fy: 26, tx: 0, ty: 18, sig: 'mod', label: 'ENV -> VCA' },
          { from: 'slow', to: 'drone', fx: 118, fy: 26, tx: 0, ty: 34, sig: 'mod', label: 'CV -> TONE' },
          { from: 'drone', to: 'chorus', fx: 118, fy: 18, tx: 0, ty: 24, sig: 'audio' },
          { from: 'drone', to: 'reverb', fx: 118, fy: 34, tx: 0, ty: 24, sig: 'audio' },
        ]
      ),
      state: {
        version: 2,
        name: '01 · Breathing Drone Pad',
        master: 0.78,
        modules: [
          { id: 'sg1', type: 'slope_generator', pos: { x: 60, y: 60 }, values: { mode: 'loop', rise: 4.5, fall: 6.0, curve: 0.35, scale: 1, offset: 0 } },
          { id: 'sr1', type: 'slow_random', pos: { x: 340, y: 60 }, values: { mode: 'smooth', rate: 0.08, smooth: 1.8, depth: 0.55 } },
          { id: 'dr1', type: 'drone', pos: { x: 60, y: 340 }, chDelay: 0.25, chReverb: 0.65, values: { root: 33, chord: 'fifths', wave: 'triangle', level: 0.75, tone: 680, detune: 14, sub: 0.4, fm: 0.05, drift: 0.65 }, extra: { voices: [true, false, true, false, true, false] } },
          { id: 'ch1', type: 'chorus', pos: { x: 60, y: 640 }, values: { rate: 0.18, depth: 0.55, mix: 0.4 } },
          { id: 'rv1', type: 'reverb', pos: { x: 340, y: 640 }, values: { decay: 9.0, damp: 0.55, predelay: 0.04, tone: 2800, mix: 0.55 } },
        ],
        cables: [
          { from: 'sg1:envOut', to: 'dr1:vcaCv', depth: 0.9 },
          { from: 'sr1:cvOut', to: 'dr1:cvTone', depth: 0.65 },
        ],
      },
    },
    {
      id: 'rack2_pluck',
      title: t('2. Generatives Euklid-Pluck (Rhythmus & Quantizer)', '2. Generative Euclidean Pluck (Rhythm & Quantizer)'),
      summary: t(
        'Ein sich selbst spielender Harfen-Groove in japanischer Hirajoshi-Stimmung mit Ping-Pong-Echos.',
        'A self-playing generative harp groove tuned to the Japanese Hirajoshi scale with stereo ping-pong delay.'
      ),
      steps: [
        t('Master Clock (88 BPM) taktet sowohl Euclidean Rhythm (5 Hits auf 16 Steps) als auch Random Walk.', 'Master Clock (88 BPM) drives Euclidean Rhythm (5 hits / 16 steps) and Random Walk.'),
        t('Random Walk erzeugt rohe Tonhöhen und schickt sie in den Scale Quantizer (Skala: Hirajoshi).', 'Random Walk sends stepped notes into Scale Quantizer (scale locked to Hirajoshi).'),
        t('Euclidean TRIG löst den Pluck Synth aus; die quantisierte Tonhöhe geht an Pluck PITCH.', 'Euclidean TRIG fires Pluck Synth while quantized pitch enters Pluck PITCH.'),
        t('Slow Random moduliert über FILTER CV die Helligkeit der Zupftöne.', 'Slow Random continuously modulates Pluck Filter CV for expressive pluck timbre.'),
      ],
      diagram: renderPatchDiagramSvg(
        [
          { id: 'clk', title: 'Master Clock', sub: '88 BPM · Swing 14%', cat: 'control', x: 20, y: 56 },
          { id: 'euc', title: 'Euclidean', sub: '16 Steps · 5 Hits', cat: 'control', x: 185, y: 18 },
          { id: 'rw', title: 'Random Walk', sub: 'Step 1 · Range 2', cat: 'control', x: 185, y: 92 },
          { id: 'qt', title: 'Scale Quantizer', sub: 'Hirajoshi · A', cat: 'control', x: 345, y: 92 },
          { id: 'plk', title: 'Pluck Synth', sub: 'Harp · Delay 50%', cat: 'source', x: 500, y: 56 },
        ],
        [
          { from: 'clk', to: 'euc', fx: 118, fy: 18, tx: 0, ty: 24, sig: 'clock', label: '1/16' },
          { from: 'clk', to: 'rw', fx: 118, fy: 34, tx: 0, ty: 24, sig: 'clock', label: '1/8' },
          { from: 'rw', to: 'qt', fx: 118, fy: 24, tx: 0, ty: 24, sig: 'pitch', label: 'PITCH' },
          { from: 'euc', to: 'plk', fx: 118, fy: 24, tx: 0, ty: 16, sig: 'gate', label: 'TRIG -> GATE' },
          { from: 'qt', to: 'plk', fx: 118, fy: 24, tx: 0, ty: 34, sig: 'pitch', label: 'PITCH OUT' },
        ]
      ),
      state: {
        version: 2,
        name: '02 · Generative Euclidean Pluck',
        master: 0.8,
        modules: [
          { id: 'mc1', type: 'master_clock', pos: { x: 60, y: 60 }, values: { tempo: 88, swing: 0.14, running: 1 } },
          { id: 'eu1', type: 'euclidean', pos: { x: 300, y: 60 }, values: { steps: 16, pulses: 5, rotation: 0 } },
          { id: 'rw1', type: 'random_walk', pos: { x: 540, y: 60 }, values: { stepSize: 1, range: 2, scale: 'hirajoshi', key: 9 } },
          { id: 'qt1', type: 'quantizer', pos: { x: 780, y: 60 }, values: { scale: 'hirajoshi', key: 9 } },
          { id: 'sr2', type: 'slow_random', pos: { x: 1020, y: 60 }, values: { mode: 'smooth', rate: 0.15, smooth: 1.0, depth: 0.7 } },
          { id: 'pl1', type: 'pluck', pos: { x: 60, y: 340 }, chDelay: 0.5, chReverb: 0.45, values: { level: 0.78, tone: 3400, damp: 1.25, bright: 0.7, body: 0.5 } },
          { id: 'dl1', type: 'delay', pos: { x: 60, y: 640 }, values: { mode: 'pingpong', time: 0.42, feedback: 0.52, tone: 2400, mod: 0.25, mix: 0.42 } },
          { id: 'rv2', type: 'reverb', pos: { x: 340, y: 640 }, values: { decay: 6.5, damp: 0.55, predelay: 0.03, tone: 2900, mix: 0.42 } },
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
      title: t('3. Cinematic Ostinato & Shimmer', '3. Cinematic Ostinato & Shimmer'),
      summary: t(
        'Ein episches Filmscore-Arrangement: Chord Glide liefert Harmonien, der Chord Arpeggiator formt treibende Filzklavier-Ostinati und Granular Cloud legt +1 Oktave Shimmer darüber.',
        'A film-score rig: Chord Glide provides harmonic movement, Chord Arpeggiator drives Felt Piano ostinatos, and Granular Cloud adds octave shimmer.'
      ),
      steps: [
        t('Master Clock (92 BPM) schickt 1 BAR an Chord Glide und 1/16-Takt an den Chord Arpeggiator.', 'Master Clock (92 BPM) sends 1 BAR to Chord Glide and 1/16 clock to Chord Arpeggiator.'),
        t('Chord Glide sendet polyphone Akkorde (POLY PITCH) in den Arpeggiator und den Grundton (ROOT PITCH) an den Bass.', 'Chord Glide sends POLY PITCH to the Arpeggiator and ROOT PITCH to Analog Bass.'),
        t('Der Chord Arpeggiator spielt im Muster Up-Down (2 Oktaven) direkt in Felt Piano GATE & PITCH.', 'Chord Arpeggiator drives Felt Piano in Up-Down mode across 2 octaves.'),
        t('Granular Cloud hebt den Klang in der Effektkette um +1 Oktave mit 50% Feedback an.', 'Granular Cloud layers an octave-up shimmer cloud across the stereo output.'),
      ],
      diagram: renderPatchDiagramSvg(
        [
          { id: 'mc', title: 'Master Clock', sub: '92 BPM', cat: 'control', x: 16, y: 56 },
          { id: 'cg', title: 'Chord Glide', sub: 'Em -> C -> G -> D', cat: 'source', x: 165, y: 18 },
          { id: 'arp', title: 'Chord Arpeggiator', sub: 'Up-Down · 2 Oct', cat: 'control', x: 325, y: 18 },
          { id: 'fp', title: 'Felt Piano', sub: 'Felt 65%', cat: 'source', x: 485, y: 18 },
          { id: 'bs', title: 'Bass Synth', sub: 'Root Foundation', cat: 'source', x: 325, y: 92 },
          { id: 'gc', title: 'Granular Cloud', sub: '+1 Oct Shimmer', cat: 'effect', x: 485, y: 92 },
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
        version: 2,
        name: '03 · Cinematic Ostinato & Shimmer',
        master: 0.78,
        modules: [
          { id: 'mc3', type: 'master_clock', pos: { x: 60, y: 60 }, values: { tempo: 92, swing: 0.05, running: 1 } },
          { id: 'arp3', type: 'chord_arp', pos: { x: 340, y: 60 }, values: { pattern: 'updown', octaves: 2, gateLen: 0.65, density: 0.95, accentEvery: 4 } },
          { id: 'cg3', type: 'chord_glide', pos: { x: 60, y: 340 }, values: { level: 0.42, cutoff: 1400, glide: 0.45, detune: 10 } },
          { id: 'fp3', type: 'felt_piano', pos: { x: 360, y: 340 }, chDelay: 0.35, chReverb: 0.55, values: { level: 0.8, felt: 0.65, decay: 2.6, color: 3000, body: 0.6, hammer: 0.3 } },
          { id: 'bs3', type: 'bass', pos: { x: 660, y: 340 }, chReverb: 0.15, values: { level: 0.55, cutoff: 340, reso: 2.0, sub: 0.7, decay: 0.8 } },
          { id: 'gc3', type: 'granular_cloud', pos: { x: 60, y: 640 }, values: { pitchMode: 'octUp', size: 0.14, texture: 0.65, feedback: 0.5, freeze: 0, mix: 0.38 } },
          { id: 'rv3', type: 'reverb', pos: { x: 340, y: 640 }, values: { decay: 7.5, damp: 0.52, predelay: 0.04, tone: 2900, mix: 0.42 } },
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
      title: t('4. Automatische Regie-Kaskade (Logik & Snapshots)', '4. Generative Conductor Cascade (Logic & Snapshots)'),
      summary: t(
        'Das Rack dirigiert sich selbst: Eine Hüllkurve triggert am Ende ihres Abfalls (EOF) über CV Logic & Switch das nächste Instrument und wechselt im Takt zwischen Szenen.',
        'Self-conducting rack: Slope EOF triggers route alternately via CV Logic & Switch while Snapshot Controller evolves song phases.'
      ),
      steps: [
        t('Master Clock · 1 BAR triggert den Slope Generator und steuert den Snapshot Controller · BAR IN.', 'Master Clock triggers Slope Generator (1/4) and drives Snapshot Controller (BAR IN).'),
        t('Am Ende der Abfallphase sendet Slope Generator · EOF OUT einen Impuls in CV Logic & Switch · GATE IN.', 'When Slope finishes falling, EOF OUT fires a pulse into CV Logic & Switch GATE IN.'),
        t('Slow Random steuert CTRL CV: Je nach Spannung geht das Gate an Felt Piano (PASS A) oder Resonator Garden (INV B).', 'Slow Random steers CTRL CV: gates alternate dynamically between Felt Piano (PASS A) and Resonator Garden (INV B).'),
      ],
      diagram: renderPatchDiagramSvg(
        [
          { id: 'mc', title: 'Master Clock', sub: '80 BPM · 1 BAR', cat: 'control', x: 16, y: 56 },
          { id: 'sg', title: 'Slope Generator', sub: 'Trigger AD · EOF', cat: 'control', x: 165, y: 20 },
          { id: 'ls', title: 'CV Logic & Switch', sub: 'A/B Gate Router', cat: 'control', x: 325, y: 20 },
          { id: 'sc', title: 'Snapshot Controller', sub: 'Auto Scene Flow', cat: 'control', x: 165, y: 92 },
          { id: 'fp', title: 'Felt Piano', sub: 'Path A', cat: 'source', x: 485, y: 18 },
          { id: 'rg', title: 'Resonator Garden', sub: 'Path B', cat: 'source', x: 485, y: 92 },
        ],
        [
          { from: 'mc', to: 'sg', fx: 118, fy: 18, tx: 0, ty: 24, sig: 'clock', label: '1/4 TRIG' },
          { from: 'mc', to: 'sc', fx: 118, fy: 36, tx: 0, ty: 24, sig: 'clock', label: 'BAR IN' },
          { from: 'sg', to: 'ls', fx: 118, fy: 24, tx: 0, ty: 24, sig: 'gate', label: 'EOF OUT' },
          { from: 'ls', to: 'fp', fx: 118, fy: 18, tx: 0, ty: 24, sig: 'gate', label: 'PASS A' },
          { from: 'ls', to: 'rg', fx: 118, fy: 34, tx: 0, ty: 24, sig: 'gate', label: 'INV B' },
        ]
      ),
      state: {
        version: 2,
        name: '04 · Generative Conductor Cascade',
        master: 0.78,
        modules: [
          { id: 'mc4', type: 'master_clock', pos: { x: 60, y: 60 }, values: { tempo: 80, swing: 0.08, running: 1 } },
          { id: 'sg4', type: 'slope_generator', pos: { x: 300, y: 60 }, values: { mode: 'trig', rise: 0.6, fall: 1.4, curve: 0.5, scale: 1, offset: 0 } },
          { id: 'sr4', type: 'slow_random', pos: { x: 540, y: 60 }, values: { mode: 'smooth', rate: 0.2, smooth: 0.9, depth: 0.9 } },
          { id: 'ls4', type: 'logic_switch', pos: { x: 780, y: 60 }, values: { thresh: 0.5 } },
          { id: 'sc4', type: 'snapshot_ctrl', pos: { x: 1020, y: 60 }, values: { autoRun: 1, loop: 1, bars1: 4, bars2: 4, bars3: 0, bars4: 0, bars5: 0 } },
          { id: 'fp4', type: 'felt_piano', pos: { x: 60, y: 340 }, chReverb: 0.55, values: { level: 0.78, felt: 0.65, decay: 2.8, color: 2600 } },
          { id: 'rg4', type: 'resonator_garden', pos: { x: 360, y: 340 }, chDelay: 0.45, chReverb: 0.6, values: { level: 0.72, material: 0.55, damp: 0.4 } },
          { id: 'rv4', type: 'reverb', pos: { x: 60, y: 640 }, values: { decay: 7.0, damp: 0.55, predelay: 0.03, tone: 2800, mix: 0.45 } },
        ],
        cables: [
          { from: 'mc4:div4Out', to: 'sg4:trigIn' },
          { from: 'mc4:barOut', to: 'sc4:barIn' },
          { from: 'sg4:eofOut', to: 'ls4:gateIn' },
          { from: 'sr4:cvOut', to: 'ls4:ctrlCv' },
          { from: 'ls4:passOut', to: 'fp4:gateIn' },
          { from: 'ls4:invPassOut', to: 'rg4:gateIn' },
        ],
      },
    },
    {
      id: 'rack5_techno',
      title: t('5. Warehouse Techno (Sidechain-Ducking & Acid-Sequenz)', '5. Warehouse Techno (Sidechain Ducking & Acid Line)'),
      summary: t(
        'Treibende 128-BPM-Bassline mit Pump-Effekt: Eine schnelle Viertel-Hüllkurve drückt die Bass-Lautstärke bei jedem Kick-Schlag weg.',
        'Driving 128 BPM techno rack: Slope INV OUT ducks the 303 bassline cleanly on every 1/4 kick transient.'
      ),
      steps: [
        t('Master Clock (128 BPM) sendet 1/4-Schläge an Drum Rack · KICK IN und Slope Generator · TRIG IN (Trigger AD, Rise 0.02s, Fall 0.32s).', 'Master Clock (128 BPM) triggers Drum Rack KICK IN and Slope TRIG IN on every 1/4 beat.'),
        t('Slope Generator · INV OUT geht in Bass Synth · VCA CV – das erzeugt den Sidechain-Pumpeffekt.', 'Slope Generator INV OUT patches into Analog Bass VCA CV for crisp sidechain ducking.'),
        t('Step Sequencer spielt 16tel-Noten in den Bass Synth; Analog Filter verdichtet den Mix.', 'Step Sequencer sequences 16th-note acid lines through a softly saturated Analog Filter.'),
      ],
      diagram: renderPatchDiagramSvg(
        [
          { id: 'mc', title: 'Master Clock', sub: '128 BPM', cat: 'control', x: 16, y: 56 },
          { id: 'sq', title: 'Step Sequencer', sub: '8-Step Acid Line', cat: 'source', x: 175, y: 18 },
          { id: 'sg', title: 'Slope Generator', sub: 'Sidechain · 0.32s', cat: 'control', x: 175, y: 92 },
          { id: 'bs', title: 'Bass Synth', sub: 'Reso 5.5 · Sub 75%', cat: 'source', x: 345, y: 56 },
          { id: 'dr', title: 'Drum Rack', sub: '4/4 Kick & Hats', cat: 'source', x: 495, y: 18 },
          { id: 'flt', title: 'Analog Filter', sub: 'Drive 18%', cat: 'effect', x: 495, y: 92 },
        ],
        [
          { from: 'mc', to: 'sq', fx: 118, fy: 18, tx: 0, ty: 24, sig: 'clock', label: '1/16' },
          { from: 'mc', to: 'sg', fx: 118, fy: 34, tx: 0, ty: 24, sig: 'clock', label: '1/4' },
          { from: 'sq', to: 'bs', fx: 118, fy: 24, tx: 0, ty: 18, sig: 'pitch', label: 'GATE+PITCH' },
          { from: 'sg', to: 'bs', fx: 118, fy: 24, tx: 0, ty: 36, sig: 'mod', label: 'INV -> VCA' },
          { from: 'mc', to: 'dr', fx: 118, fy: 18, tx: 0, ty: 24, sig: 'gate', label: '1/4 KICK' },
          { from: 'bs', to: 'flt', fx: 118, fy: 24, tx: 0, ty: 24, sig: 'audio' },
        ]
      ),
      state: {
        version: 2,
        name: '05 · Warehouse Techno Sidechain',
        master: 0.82,
        modules: [
          { id: 'mc5', type: 'master_clock', pos: { x: 60, y: 60 }, values: { tempo: 128, swing: 0.04, running: 1 } },
          { id: 'sg5', type: 'slope_generator', pos: { x: 300, y: 60 }, values: { mode: 'trig', rise: 0.02, fall: 0.32, curve: 0.4, scale: 1, offset: 0 } },
          { id: 'sq5', type: 'sequencer', pos: { x: 60, y: 340 }, values: { level: 0.35, scale: 'minor', key: 9, decay: 0.25, cutoff: 1400 } },
          { id: 'bs5', type: 'bass', pos: { x: 360, y: 340 }, chDelay: 0.2, chReverb: 0.1, values: { level: 0.82, cutoff: 460, reso: 5.5, sub: 0.75, decay: 0.28 } },
          { id: 'dr5', type: 'drum_rack', pos: { x: 660, y: 340 }, chReverb: 0.12, values: { level: 0.86, kDecay: 0.45, sSnap: 0.78, hDecay: 0.08 } },
          { id: 'fl5', type: 'filter', pos: { x: 60, y: 640 }, values: { ftype: 'lowpass', cutoff: 3400, reso: 1.8, drive: 0.18, lfoRate: 0.25, lfoDepth: 0.12 } },
          { id: 'dl5', type: 'delay', pos: { x: 340, y: 640 }, values: { mode: 'stereo', time: 0.35, feedback: 0.4, tone: 1800, mod: 0.1, mix: 0.28 } },
        ],
        cables: [
          { from: 'mc5:clockOut', to: 'sq5:clockIn' },
          { from: 'sq5:gateOut', to: 'bs5:gateIn' },
          { from: 'sq5:pitchOut', to: 'bs5:pitchIn' },
          { from: 'mc5:div4Out', to: 'sg5:trigIn' },
          { from: 'sg5:invOut', to: 'bs5:vcaCv', depth: 0.85 },
          { from: 'mc5:div4Out', to: 'dr5:trigKick' },
          { from: 'mc5:div2Out', to: 'dr5:trigHat' },
        ],
      },
    },
  ];
}

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

    const racks = getExampleRacks();
    modal.querySelectorAll('.man-load-rack-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const rack = racks.find((r) => r.id === btn.dataset.rackId);
        if (!rack) return;
        this.onStartAudio?.();
        this.onLoadRackState?.(structuredClone(rack.state), rack.state?.name || rack.title);
        this.close();
        this.onToast?.(t(`Beispiel-Rack „${rack.title}“ geladen`, `Loaded example rack "${rack.title}"`));
      });
    });

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
      <svg viewBox="0 0 760 220" class="man-flow-svg" aria-label="${t('SYNTHBOARD Signalfluss', 'SYNTHBOARD Signal Flow')}">
        <rect x="0" y="0" width="760" height="220" rx="12" fill="#ffffff" stroke="#e2e8f0" stroke-width="1.2"/>

        <!-- Layer 1: Control -->
        <rect x="20" y="24" width="205" height="172" rx="10" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.2"/>
        <text x="34" y="46" font-size="9" font-weight="700" font-family="JetBrains Mono, monospace" fill="#0284c7">${t('1 · STEUERUNG', '1 · CONTROL')}</text>
        <text x="34" y="64" font-size="11" font-weight="700" font-family="Inter, sans-serif" fill="#0f172a">${t('Takt, Logik &amp; Bewegung', 'Clock, Logic &amp; Motion')}</text>
        <rect x="34" y="78" width="177" height="26" rx="5" fill="#ecfeff" stroke="#06b6d4" stroke-width="1"/>
        <text x="44" y="95" font-size="9.5" font-weight="600" fill="#0e7490">Master Clock · Divider · Arp</text>
        <rect x="34" y="112" width="177" height="26" rx="5" fill="#fffbeb" stroke="#d97706" stroke-width="1"/>
        <text x="44" y="129" font-size="9.5" font-weight="600" fill="#b45309">Euclidean · Prob Gate · CV Logic</text>
        <rect x="34" y="146" width="177" height="26" rx="5" fill="#ecfdf5" stroke="#059669" stroke-width="1"/>
        <text x="44" y="163" font-size="9.5" font-weight="600" fill="#047857">Slow Random · Slope Generator</text>

        <!-- Layer 2: Voices -->
        <rect x="275" y="24" width="215" height="172" rx="10" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.2"/>
        <text x="289" y="46" font-size="9" font-weight="700" font-family="JetBrains Mono, monospace" fill="#9333ea">${t('2 · KLANGQUELLEN', '2 · SOUND SOURCES')}</text>
        <text x="289" y="64" font-size="11" font-weight="700" font-family="Inter, sans-serif" fill="#0f172a">${t('Instrumente &amp; Kanalzug', 'Instruments &amp; Channel Strip')}</text>
        <rect x="289" y="78" width="187" height="58" rx="5" fill="#ffffff" stroke="#cbd5e1" stroke-width="1"/>
        <text x="299" y="95" font-size="9.5" font-weight="700" fill="#0f172a">Chord Glide · Felt Piano · Violin</text>
        <text x="299" y="110" font-size="9.5" font-weight="700" fill="#0f172a">Drone · Pluck · Bass · Drum Rack</text>
        <text x="299" y="125" font-size="8.5" fill="#64748b">Resonator · Swarm · Morph · Noise</text>
        <rect x="289" y="144" width="187" height="36" rx="5" fill="#f1f5f9" stroke="#94a3b8" stroke-width="1"/>
        <text x="299" y="159" font-size="8.5" font-weight="700" fill="#334155">${t('INTEGRIERTER KANALZUG', 'INTEGRATED CHANNEL STRIP')}</text>
        <text x="299" y="172" font-size="8" fill="#475569">Pan · Delay Send · Reverb Send</text>

        <!-- Layer 3: Master Effects -->
        <rect x="540" y="24" width="200" height="172" rx="10" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.2"/>
        <text x="554" y="46" font-size="9" font-weight="700" font-family="JetBrains Mono, monospace" fill="#2563eb">${t('3 · MASTER-EFFEKTE', '3 · MASTER EFFECTS')}</text>
        <text x="554" y="64" font-size="11" font-weight="700" font-family="Inter, sans-serif" fill="#0f172a">${t('Klangformung &amp; Raum', 'Tone Shaping &amp; Space')}</text>
        <rect x="554" y="78" width="172" height="34" rx="5" fill="#eff6ff" stroke="#3b82f6" stroke-width="1"/>
        <text x="564" y="93" font-size="9" font-weight="700" fill="#1d4ed8">${t('Insert-Kette', 'Insert Chain')}</text>
        <text x="564" y="105" font-size="8" fill="#1e40af">Filter · Chorus · Lo-Fi · Granular Cloud</text>
        <rect x="554" y="120" width="172" height="34" rx="5" fill="#f0fdf4" stroke="#10b981" stroke-width="1"/>
        <text x="564" y="135" font-size="9" font-weight="700" fill="#047857">${t('Aux-Sends (Raum)', 'Aux Sends (Space)')}</text>
        <text x="564" y="147" font-size="8" fill="#065f46">Stereo Delay · Ambient Reverb</text>
        <rect x="554" y="162" width="172" height="22" rx="4" fill="#0f172a"/>
        <text x="640" y="176" text-anchor="middle" font-size="8.5" font-weight="700" font-family="JetBrains Mono, monospace" fill="#f8fafc">MASTER LIMITER &amp; SCOPE</text>

        <path d="M 225 91 C 250 91, 250 91, 275 91" fill="none" stroke="#06b6d4" stroke-width="2.5"/>
        <path d="M 225 125 C 250 125, 250 110, 275 110" fill="none" stroke="#d97706" stroke-width="2.5"/>
        <path d="M 225 159 C 250 159, 250 132, 275 132" fill="none" stroke="#059669" stroke-width="2.5"/>
        <polygon points="275,91 268,87 268,95" fill="#06b6d4"/>
        <polygon points="275,110 268,106 268,114" fill="#d97706"/>
        <polygon points="275,132 268,128 268,136" fill="#059669"/>

        <path d="M 490 110 C 515 110, 515 95, 540 95" fill="none" stroke="#2563eb" stroke-width="3"/>
        <path d="M 490 162 C 515 162, 515 137, 540 137" fill="none" stroke="#2563eb" stroke-width="2.2" stroke-dasharray="4 3"/>
        <polygon points="540,95 533,91 533,99" fill="#2563eb"/>
        <polygon points="540,137 533,133 533,141" fill="#2563eb"/>
      </svg>
    `;
  }

  buildBodyHtml() {
    const cards = getModuleCards();
    const racks = getExampleRacks();

    const renderCards = (cat) => cards[cat].map((m) => `
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

    const racksHtml = racks.map((r) => `
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

    const jsonSpecExample = `{
  "version": 2,
  "name": "Cosmic Strings & Felt Piano",
  "state": {
    "version": 2,
    "name": "Cosmic Strings & Felt Piano",
    "master": 0.82,
    "modules": [
      {
        "id": "clk1",
        "type": "master_clock",
        "enabled": true,
        "pos": { "x": 60, "y": 60 },
        "values": { "tempo": 84, "swing": 0.05, "running": 1 }
      }
    ],
    "cables": [
      { "from": "clk1:barOut", "to": "snap1:barIn", "depth": 1 }
    ],
    "snapshots": {
      "activeSlot": 1,
      "currentSpeed": 7,
      "slots": {
        "1": { "name": "Intro", "values": { "felt_piano": { "color": 1600 } } },
        "2": { "name": "Peak", "values": { "felt_piano": { "color": 3200 } } }
      }
    }
  }
}`;

    return `
      <div class="man-content">
        <!-- 1. Signal Flow -->
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

        <!-- 2. Operation & Performance -->
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
              <h4>5-Slot Focus Dock</h4>
              <p>${t(
                'Halte <strong>Shift</strong> gedrückt und klicke auf bis zu 5 beliebige Regler im Rack. Sie landen rechts im Performance-Board als Live-Controls und lassen sich blitzschnell per Maus oder Pfeiltasten steuern.',
                'Hold <strong>Shift</strong> and click up to 5 knobs anywhere in the rack to pin them into the right-hand Performance Board as Live Controls.'
              )}</p>
            </div>
            <div class="man-op-card">
              <div class="man-op-tag">${t('TASTEN 1–5 &amp; 6–8', 'KEYS 1–5 &amp; 6–8')}</div>
              <h4>Performance Snapshots &amp; Song Mode</h4>
              <p>${t(
                'Speichere bis zu 5 komplette Regler-Szenen auf den Slots <strong>1–5</strong>. Mit <strong>6 (Direkt)</strong>, <strong>7 (Glide)</strong> und <strong>8 (Slow)</strong> blendest du weich über – oder nutzt den <strong>Snapshot Controller</strong> mit <code>barIn</code> + <code>bars1..5</code> als automatischen Song-Ablaufplan.',
                'Store up to 5 parameter scenes in slots <strong>1–5</strong>. Morph with <strong>6 (Direct)</strong>, <strong>7 (Glide)</strong>, and <strong>8 (Slow)</strong> – or automate different bar lengths per slot (<code>bars1..5</code> + <code>barIn</code>) inside <strong>Snapshot Controller</strong>.'
              )}</p>
            </div>
          </div>
        </section>

        <!-- 3. Building Blocks -->
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

        <!-- 4. 5 Example Racks -->
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

        <!-- 5. JSON Format & Patch Specification -->
        <section class="man-section">
          <div class="man-sec-num">05</div>
          <h2>${t('JSON-Format &amp; Patch-Spezifikation (version &amp; name)', 'JSON Format &amp; Patch Specification (version &amp; name)')}</h2>
          <p class="man-lead">${t(
            'Jede exportierte oder von einer KI generierte SYNTHBOARD-JSON-Datei muss zwingend <strong><code>"version": 2</code></strong> und <strong><code>"name": "..."</code></strong> (sowohl auf oberster Ebene als auch innerhalb von <code>state</code>) angeben. Alle Kabel nutzen die kanonischen Buchsen-IDs (z. B. <code>clk1:barOut</code>, <code>euc1:trigOut</code>, <code>div1:div4Out</code>).',
            'Every exported or AI-authored SYNTHBOARD JSON patch must always specify <strong><code>"version": 2</code></strong> and <strong><code>"name": "..."</code></strong> (both at top level and inside <code>state</code>). All cables use canonical jack IDs such as <code>clk1:barOut</code>, <code>euc1:trigOut</code>, and <code>div1:div4Out</code>.'
          )}</p>
          <pre class="man-json-pre"><code>${jsonSpecExample}</code></pre>
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
            <h1>${t('Studio-Handbuch', 'Studio Manual')}</h1>
          </div>
          <div class="man-header-actions">
            <button type="button" id="man-download-ai-md" class="man-btn-secondary" title="${t('Komplette technische KI-Referenz als Markdown (.md) herunterladen', 'Download complete technical AI reference as Markdown (.md)')}">${t('🤖 KI-Referenz (.md)', '🤖 AI Reference (.md)')}</button>
            <button type="button" id="man-download-rack-md" class="man-btn-secondary" title="${t('KI-Referenz + aktuelles Rack als JSON in einer .md-Datei herunterladen', 'Download AI reference + current rack JSON in a .md file')}">${t('📋 Aktuelles Rack + KI-Doku (.md)', '📋 Current Rack + AI Docs (.md)')}</button>
            <button type="button" id="man-download-pdf" class="man-btn-primary" title="${t('Öffnet die druckfertige PDF-Ansicht', 'Opens print-ready PDF view')}">${t('⬇ PDF / Druck', '⬇ PDF / Print')}</button>
            <button type="button" id="man-download-html" class="man-btn-secondary" title="${t('Eigenständige HTML-Datei speichern', 'Save standalone HTML manual')}">HTML</button>
            <button type="button" id="man-close-btn" class="man-close-btn" title="${t('Schließen [Esc]', 'Close [Esc]')}">✕</button>
          </div>
        </header>
        <div class="man-scroll-area">
          ${this.buildBodyHtml()}
        </div>
      </div>
    `;
  }

  getStandaloneDocumentHtml() {
    const langAttr = getLang() === 'en' ? 'en' : 'de';
    return `<!doctype html>
<html lang="${langAttr}">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>${t('SYNTHBOARD · Studio-Handbuch', 'SYNTHBOARD · Studio Manual')}</title>
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
  .man-json-pre { background: #0f172a; color: #e2e8f0; border-radius: 8px; padding: 14px 16px; font-family: monospace; font-size: 12px; overflow-x: auto; }
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
      <h1>${t('SYNTHBOARD · Studio-Handbuch', 'SYNTHBOARD · Studio Manual')}</h1>
      <span>${t('Visuelle Anleitung, Schaltpläne & JSON-Spec (v2)', 'Visual Guide, Patch Diagrams & JSON Spec (v2)')}</span>
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
      this.downloadStandaloneHtml();
      this.onToast?.(t('Popup blockiert – Handbuch als HTML heruntergeladen', 'Popup blocked – downloaded manual as HTML'));
    }
  }

  downloadStandaloneHtml() {
    const html = this.getStandaloneDocumentHtml();
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = getLang() === 'en' ? 'SYNTHBOARD-Manual.html' : 'SYNTHBOARD-Handbuch.html';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    this.onToast?.(t('Handbuch als HTML gespeichert', 'Manual saved as HTML'));
  }

  buildAiReferenceMarkdown() {
    const en = getLang() === 'en';
    const lines = [];
    lines.push(en
      ? '# SYNTHBOARD – Technical AI Reference (JSON Spec & Exact Module IDs)'
      : '# SYNTHBOARD – Technische KI-Referenz (JSON-Spec & Echte Modul-IDs)');
    lines.push('');
    lines.push(en
      ? 'Generated directly from SYNTHBOARD’s active `MODULES` registry.'
      : 'Diese Datei wurde direkt aus den laufenden `MODULES`-Definitionen von SYNTHBOARD generiert.');
    lines.push('');
    lines.push(en
      ? '## 1. JSON Preset Specification (`version: 2` & `name` always required)'
      : '## 1. JSON-Preset-Spezifikation (`version: 2` & `name` immer erforderlich)');
    lines.push('');
    lines.push(en
      ? '- **Mandatory top-level & state fields:** Always include both `"version": 2` and `"name": "<Patch Title>"` at top level and inside `state` so importers, board dropdowns, and community tools identify the patch cleanly.'
      : '- **Pflichtfelder auf Root- & `state`-Ebene:** Gib immer sowohl `"version": 2` als auch `"name": "<Patch-Name>"` auf Root-Ebene und in `state` an, damit Importer, Patch-Auswahl und Community-Tools den Patch sauber erkennen.');
    lines.push('');
    lines.push('```json');
    lines.push('{');
    lines.push('  "version": 2,');
    lines.push('  "name": "My Cinematic Patch",');
    lines.push('  "state": {');
    lines.push('    "version": 2,');
    lines.push('    "name": "My Cinematic Patch",');
    lines.push('    "master": 0.82,');
    lines.push('    "modules": [');
    lines.push('      {');
    lines.push('        "id": "clk1",');
    lines.push('        "type": "master_clock",');
    lines.push('        "enabled": true,');
    lines.push('        "values": { "tempo": 96, "swing": 0.08, "running": 1 },');
    lines.push('        "pos": { "x": 80, "y": 80 }');
    lines.push('      }');
    lines.push('    ],');
    lines.push('    "cables": [');
    lines.push('      { "from": "clk1:clockOut", "to": "euc1:clockIn", "depth": 1.0 }');
    lines.push('    ],');
    lines.push('    "snapshots": {');
    lines.push('      "activeSlot": 1,');
    lines.push('      "currentSpeed": 7,');
    lines.push('      "slots": {');
    lines.push('        "1": { "name": "Intro", "values": { "chord_glide": { "cutoff": 700, "level": 0.45 } } },');
    lines.push('        "2": { "name": "Drop", "values": { "chord_glide": { "cutoff": 2400, "level": 0.8 } } }');
    lines.push('      }');
    lines.push('    }');
    lines.push('  }');
    lines.push('}');
    lines.push('```');
    lines.push('');
    lines.push(en
      ? '- `snapshots` is supported under both `data.snapshots` and `data.state.snapshots`.'
      : '- **Wichtig:** `snapshots` wird sowohl unter `data.snapshots` als auch unter `data.state.snapshots` erkannt.');
    lines.push(en
      ? '- Partial parameter overrides per snapshot slot are automatically merged with base module defaults.'
      : '- Partielle `values` pro Snapshot-Slot (nur geänderte Parameter pro Modul-`id` oder Modul-`type`) werden beim Import automatisch mit den Basiswerten aller geladenen Module aufgefüllt.');
    lines.push('');
    lines.push(en
      ? '## 2. Verified Canonical Jacks & Parameters (`patchSystem.js`)'
      : '## 2. Verifizierte Jack- & Parameter-Hinweise (`patchSystem.js` & Aliase)');
    lines.push('');
    lines.push('- `euclidean`: outputs `trigOut`, `invOut`; inputs `clockIn`, `resetIn`.');
    lines.push('- `prob_gate`: inputs `trigIn`; outputs `trigOut` (PASSED), `altOut` (SKIPPED).');
    lines.push('- `slow_random`: outputs `cvOut` (`CV OUT`), `invOut` (`INV CV`); input `trigIn`.');
    lines.push('- `pluck`: filter cutoff modulation jack is `modCutoff` (`mod` IN).');
    lines.push('- `noise`: options `ftype` (`lowpass|bandpass|highpass`) and `color` (`pink|white|red|tape`).');
    lines.push('- `slope_generator`: `mode` is `"loop"` | `"trig"` | `"gate"` | `"oneshot"`; `sustainHold: 0 | 1`, `rise`/`fall` `0.01..180` s. Outputs: `envOut`, `invOut`, `eorOut`, `eofOut`, `eocOut`. Strict range `curve: 0..1`.');
    lines.push('- `keys` & `morph_voice`: both support `glide` (`0..5` s) and `glideCv`. `keys` also supports `polyphony` (`"poly"` | `"mono"` | `"legato"`) and 12 keys `0..11`.');
    lines.push('- `sequencer`: supports `s1`..`s8` (`-12..24`) or `steps: [...]`, `g1`..`g8` (`0=Rest, 1=Trig, 2=Tie`) or `gates: [...]`, `glide` (`0..2.5` s), `key: 0..11`.');
    lines.push('- `chord_glide`: supports `key` (`0..11`), `scale` (`"minor"` | `"major"` | `"dorian"` | `"minorPenta"` | `"majorPenta"`), `progression`, `clockDiv` (`1|4|8|16|32|64|128`), `voiceCount` (`1..6`), `cutoff` (`60..12000`).');
    lines.push('- `drone`: `root` (`24..48`), `pitchIn`, `scaleLock: 1` (`key` + `scale`).');
    lines.push('- `random_walk`: `octave` (`24|36|48|60|72`), `glide` (`0..3` s).');
    lines.push(en
      ? '- **Time units in seconds:** Parameters like `chorus.delay`, `reverb.predelay`, and `delay.time` must always be in seconds (`0.018`, not `18` ms).'
      : '- **Zeit-Einheiten in Sekunden:** Parameter wie `chorus.delay`, `reverb.predelay` und `delay.time` müssen immer in **Sekunden** (z. B. `0.018` statt `18` ms) angegeben werden.');
    lines.push('');
    lines.push(en ? '## 3. Best-Practice Recipes for AI Agents' : '## 3. Best-Practice-Rezepte für KIs');
    lines.push('');
    lines.push('- **Sidechain Ducking:** `master_clock:div4Out` -> `slope_generator:trigIn` (`mode: "trig"`), `slope_generator:invOut` -> `instrument:vcaCv`.');
    lines.push('- **Cascading Triggers:** `slope_generator:eofOut` -> `next_slope:trigIn`.');
    lines.push('- **A/B Gate Routing:** `logic_switch` (`gateIn` + `ctrlCv`) alternates triggers between `passOut` and `invPassOut`.');
    lines.push('- **Polyphonic Harmony Chain:** `chord_glide:pitchOut` -> `chord_arp:pitchIn`, `chord_arp:pitchOut` -> `felt_piano:pitchIn`, `chord_arp:gateOut` -> `felt_piano:gateIn`.');
    lines.push('- **Song Mode (variable bar counts per part):** `master_clock:barOut` -> `snapshot_ctrl:barIn` with `values: { autoRun: 1, loop: 0|1, bars1: 8, bars2: 8, bars3: 16, bars4: 16, bars5: 8 }` (`0` skips slot).');
    lines.push('- **Audio → Synth Analyzer:** Topbar `Analyzer` (`File -> Audio -> Synth Analyzer…`) extracts `BPM`, `Halftime`, `root:0..11` chords, `Cutoff ~Hz`, `Energy %`, and `DROP` timestamps locally via Web Audio API.');
    lines.push('');
    lines.push(en
      ? `## 4. All ${Object.keys(MODULES).length} Modules (Exact IDs)`
      : `## 4. Alle ${Object.keys(MODULES).length} Module (Exakte Code-IDs)`);
    lines.push('');

    const byCat = { control: [], source: [], effect: [] };
    for (const [type, def] of Object.entries(MODULES)) {
      const bucket = byCat[def.category] || byCat.control;
      bucket.push([type, def]);
    }

    const catNames = {
      control: en ? 'Control & Rhythm (`control`)' : 'Steuerung & Rhythmus (`control`)',
      source: en ? 'Instruments & Sound Sources (`source`)' : 'Instrumente & Klangquellen (`source`)',
      effect: en ? 'Master Effects (`effect`)' : 'Master-Effekte (`effect`)',
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
    this.onToast?.(t('KI-Referenz als SYNTHBOARD_AI_REFERENCE.md heruntergeladen', 'Downloaded SYNTHBOARD_AI_REFERENCE.md'));
  }

  downloadCurrentRackForAiMd() {
    const refMd = this.buildAiReferenceMarkdown();
    const rawState = this.getCurrentState ? this.getCurrentState() : { modules: [], cables: [] };
    const patchName = rawState?.name || t('Aktuelles SYNTHBOARD Rack', 'Current SYNTHBOARD Rack');
    const state = { ...rawState, version: 2, name: patchName };
    const payload = { version: 2, name: patchName, state };
    const rackSection = [
      '',
      '---',
      '',
      t('## 5. Aktuell geladenes Rack (JSON-Export)', '## 5. Currently Loaded Rack (JSON Export)'),
      '',
      '```json',
      JSON.stringify(payload, null, 2),
      '```',
      '',
    ].join('\n');

    this.downloadMarkdownFile('SYNTHBOARD_RACK_AND_AI_DOC.md', refMd + rackSection);
    this.onToast?.(t('Aktuelles Rack + KI-Doku als SYNTHBOARD_RACK_AND_AI_DOC.md heruntergeladen', 'Downloaded SYNTHBOARD_RACK_AND_AI_DOC.md'));
  }
}
