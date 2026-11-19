// SYNTHBOARD – Zweisprachige UI-Übersetzung (Deutsch / Englisch) für alle Seiten & Unterseiten

const LS_LANG = 'synthboard:lang';
let currentLang = (() => {
  try {
    const saved = localStorage.getItem(LS_LANG);
    return saved === 'de' ? 'de' : 'en';
  } catch {
    return 'en';
  }
})();

const listeners = new Set();

export function getLang() {
  return currentLang;
}

export function t(de, en) {
  return currentLang === 'en' ? en : de;
}

export function onLangChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function setLang(lang) {
  const next = lang === 'en' ? 'en' : 'de';
  if (next === currentLang) return;
  currentLang = next;
  try {
    localStorage.setItem(LS_LANG, next);
  } catch { /* ignore */ }
  if (typeof document !== 'undefined') {
    document.documentElement.lang = next;
    applyTranslations(document);
  }
  listeners.forEach((fn) => {
    try { fn(next); } catch { /* ignore */ }
  });
}

// Exakte Text-, Titel- & Placeholder-Übersetzungen (DE -> EN)
const DICT = {
  // Navigation & Topbar-Menüs
  'SYNTHBOARD · Modulares Musikstudio': 'SYNTHBOARD · Modular Music Studio',
  'Datei': 'File',
  'Bearbeiten': 'Edit',
  'Ansicht': 'View',
  'Hilfe': 'Help',
  'Neues Board': 'New Board',
  'Patch speichern': 'Save Patch',
  'Als Kopie speichern…': 'Save as Copy…',
  'Board-Galerie öffnen': 'Open Board Gallery',
  'Importieren (JSON)…': 'Import (JSON)…',
  'Exportieren (JSON)': 'Export (JSON)',
  'Board löschen…': 'Delete Board…',
  'Speicher komplett bereinigen…': 'Clear All Storage…',
  'Alle Kabel entfernen': 'Remove All Cables',
  'Alle Patchkabel abziehen': 'Unplug All Patch Cables',
  'Live-Controls leeren': 'Clear Live Controls',
  'Virtuelles Eurorack öffnen': 'Open Virtual Eurorack',
  'Klassisches Studio öffnen': 'Open Classic Studio',
  'Modul-Bibliothek': 'Module Library',
  'Performance-Board': 'Performance Board',
  'Patch-Kabel anzeigen': 'Show Patch Cables',
  'Patchkabel einblenden': 'Show Patch Cables',
  'Kabel': 'Cables',
  'Vergrößern': 'Zoom In',
  'Verkleinern': 'Zoom Out',
  'Zoom zurücksetzen': 'Reset Zoom',
  'Auf Bildschirm einpassen': 'Fit to Screen',
  'Alles auf einen Blick': 'Fit All in View',
  'ALLES IM BLICK': 'FIT VIEW',
  'Studio-Handbuch': 'Studio Manual',
  'Handbuch': 'Manual',
  '📖 Handbuch': '📖 Manual',
  'Interaktive Tutorials': 'Interactive Tutorials',
  'Info-Tooltips ein/aus': 'Toggle Info Tooltips',
  'Info-Tooltips umschalten': 'Toggle Info Tooltips',
  'Handbuch & Signalfluss': 'Manual & Signal Flow',
  'Alle Module (Lexikon)': 'All Modules (Encyclopedia)',
  'Patch-Kabel-Guide': 'Patch Cable Guide',
  'Studio-Analyzer Großansicht': 'Studio Analyzer Pop-Out',
  'Sprache: DE / EN': 'Language: DE / EN',
  'Community & Top Tracks öffnen': 'Open Community & Top Tracks',
  'Audio → Synth Analyzer öffnen': 'Open Audio → Synth Analyzer',
  'Audio → Synth Analyzer…': 'Audio → Synth Analyzer…',
  'Klänge': 'Sounds',
  'Shift + Klick': 'Shift + Click',
  'auf beliebige Regler im Rack, um sie hier live zu spielen.': 'on any knob in the rack to play it live here.',
  'Klick ruft Preset ab · Tasten': 'Click recalls preset · Keys',

  // Transport & Master
  'AN': 'ON',
  'AUS': 'OFF',
  'Audio aktiv': 'Audio active',
  'Audio pausiert': 'Audio paused',
  'Audio pausiert – Klicken oder [Space] zum Starten': 'Audio paused – Click or [Space] to start',
  'Audio unterbrochen – Klicken zum Fortsetzen': 'Audio interrupted – Click to resume',

  // Bibliothek-Sidebar
  'BIBLIOTHEK': 'LIBRARY',
  'MODUL-BIBLIOTHEK': 'MODULE LIBRARY',
  'Module suchen…': 'Search modules…',
  'Module suchen… [ESC]': 'Search modules… [ESC]',
  'Module suchen... [ESC]': 'Search modules... [ESC]',
  'Steuerung': 'Control',
  'Steuerung & Rhythmus': 'Control & Rhythm',
  'Instrumente': 'Instruments',
  'Instrumente & Klangquellen': 'Instruments & Sound Sources',
  'Effekte': 'Effects',
  'Master-Effekte': 'Master Effects',
  'Alle': 'All',
  '– noch keine gespeichert –': '– none saved yet –',
  'Aktueller Patch': 'Current Patch',
  'Patch wählen': 'Select Patch',
  'Entfernen': 'Remove',
  'Klicken, um Board zu wechseln': 'Click to switch board',
  'Klicken: Auswählen & mit Pfeiltasten drehen · Shift+Klick: Als Live-Control zuweisen': 'Click: select & turn with arrow keys · Shift+Click: assign to Live Controls',
  'Bibliothek schließen [Taste B]': 'Close library [Key B]',
  'Bibliothek öffnen [Taste B]': 'Open library [Key B]',
  'Performance-Board schließen [Taste P]': 'Close Performance Board [Key P]',
  'Performance-Board öffnen [Taste P]': 'Open Performance Board [Key P]',

  // Alle 35 Modul-Titel & Beschreibungen
  'Macro & Szene': 'Macro & Scene',
  'Drone Maschine': 'Drone Machine',
  'Noise Textur': 'Noise Texture',
  'Zentrales musikalisches Timing (BPM, Swing & Sync)': 'Central musical timing (BPM, Swing & Sync)',
  'Teilt Clock-Impulse für unterschiedlich schnelle Stimmen': 'Divides clock pulses into rhythmic subdivisions for multiple voices',
  'Mathematisch verteilte Rhythmen (z. B. 5 Hits auf 16 Steps)': 'Mathematically distributed rhythms (e.g. 5 hits across 16 steps)',
  'Lässt Schläge mit einstellbarer Wahrscheinlichkeit durch': 'Passes or routes incoming triggers with adjustable probability',
  'Generative Melodieführung (Schrittweite, Loop-Gedächtnis & Mutation)': 'Generative melody generator (step size, loop memory & mutation)',
  'Quantisiert Noten und CVs harmonisch auf Grundton & Skala': 'Harmonically quantizes notes and CVs to root key & scale',
  'Sanft fließende Modulationsspannung (CV) für Filter & Klänge': 'Smoothly drifting modulation voltage (CV) for filters & voices',
  'Zentraler Szenen- & Generativ-Direktor (Dichte, Variation, Bewegung, Seed)': 'Central scene & generative director (Density, Variation, Motion, Seed)',
  'Flexible Ambient-Hüllkurve & Funktionsgenerator (0.05s–60s)': 'Flexible ambient envelope & function generator (0.01s–180s)',
  'Dämpfen, Invertieren (-100%..+100%) & CV-Offset/Mischer': 'Attenuate, invert (-100%..+100%) & offset/sum CV signals',
  'A/B Gate Router, Flip-Flop Latch & Boolean Gate Combiner': 'A/B Gate Router, Flip-Flop Latch & Boolean Gate Combiner',
  'Automatisches Umschalten der 5 Performance-Snapshots per Patchkabel oder Song-Ablaufplan (Takte pro Slot)': 'Automatic switching of the 5 Performance Snapshots via patch cable or Song Mode (bars per slot)',
  'Melodische Ostinati & Arpeggios aus polyphonen Akkorden': 'Melodic ostinatos & arpeggios driven by polyphonic chords',
  'Harmonischer Akkord-Sequencer mit polyphonem Smooth Voice Leading, gleitenden Tonhöhen und integriertem Ambient-Pad': 'Harmonic chord sequencer with polyphonic smooth voice leading, pitch glide & built-in ambient pad',
  'Akustische Solo-Violine: Physical Modeling mit Bogenreibung, Holzformanten, Vibrato & Artikulationen': 'Acoustic solo violin: physical modeling with bow friction, wood body formants, vibrato & articulations',
  'Warmes Filz-Klavier: intimer Saitenanschlag, Melodien & interaktive Klaviatur': 'Warm felt piano: intimate hammer attack, expressive melodies & interactive keyboard',
  '6 endlose Drone-Stimmen (Solar-42-Stil)': '6 endless analog drone voices (Solar-42 style)',
  'Akkustisch-organischer Zupfklang (Harfe / Kalimba / Bell)': 'Acoustic-organic plucked string voice (Harp / Kalimba / Bell)',
  '2-Operator FM-Klangsynthese für metallische Bells & Gongs': '2-operator FM synthesis for metallic bells, chimes & gongs',
  'Warmer analoger Sub-Bass mit Filter-Hüllkurve & Sättigung': 'Warm analog sub-bass with resonant filter envelope & saturation',
  '4 analoge Drum-Stimmen (Kick, Snare, Hi-Hat, Percussion) mit Trigger-Inputs': '4 analog drum voices (Kick, Snare, Hi-Hat, Percussion) with discrete trigger inputs',
  'Spielbarer Poly-Synth (Maus, Touch oder Tastatur A–#)': 'Playable polyphonic synth (mouse, touch, or computer keyboard A–#)',
  '8-Step Melodie-Sequencer mit eigener Stimme': '8-step melodic sequencer with built-in synth voice',
  'Rauschen, Wind & Vinyl-Knistern': 'Filtered pink/white/tape noise, wind swells & vinyl crackle',
  'Vielseitige Stimme: Analog, Wavetable, FM & Rauschen – von dunklen Flächen bis zu Zupfklängen': 'Versatile morphing voice: Analog, Wavetable, FM & Noise – from dark pads to plucks',
  'Frei formbare Drum-Stimme: Kick, Tom, Snare, Hat & Glocke aus Körper, Rauschen, Metall und Transient': 'Sculptable percussion voice: Kick, Tom, Snare, Hat & Bell from body, noise, metal & transient',
  'Gestimmte Resonanzen: aus Impulsen und Rauschen werden Saiten, Glocken, Holz und schwebende Drones': 'Tuned modal resonators: turns impulses and noise into strings, bells, wood & floating drones',
  'Drone aus bis zu 32 beweglichen Teiltönen – Scatter streut, Gather sammelt sie zum harmonischen Klang': 'Drone of up to 32 moving partials – Scatter disperses, Gather converges them into pure harmony',
  '24dB Filter mit Drive & LFO-Sweep': '24dB resonant filter with saturation drive & LFO sweep',
  'Breiter Stereo-Chorus / Ensemble': 'Wide stereo chorus & analog ensemble',
  'Lautstärke-Pulsieren & Auto-Panning': 'Rhythmic amplitude pulsing & stereo auto-panning',
  'Sättigung, Bitcrush & Tape-Leiern': 'Warm tape saturation, bitcrusher & vintage wow/flutter',
  'Analoges Echo mit Ping-Pong & Tape-Wobble': 'Stereo & ping-pong delay with analog filtering & tape modulation',
  'Großer, stabiler Hall (Convolution) bis 15 s': 'Lush algorithmic/convolution ambient hall reverb up to 15 s',
  'Echtzeit-Granular-Synthese & Shimmer': 'Real-time granular cloud texture & pitch-shifted shimmer',

  // Alle 15 Vorlagen (Namen, Kategorien & Beschreibungen)
  'Leeres Board (Tabula Rasa)': 'Blank Board (Tabula Rasa)',
  'Start Here – Erster Ton': 'Start Here – First Sound',
  'Somnus (Schlaf & Traumdrift)': 'Somnus (Sleep & Dream Drift)',
  'Einstieg & Lernen': 'Getting Started',
  'Piano & Melodie': 'Piano & Melody',
  'Beruhigung & Schlaf': 'Calm & Sleep',
  'Piano & Neoklassik': 'Piano & Neoclassical',
  'Streicher & Kammermusik': 'Strings & Chamber',
  'Generatives Ambient': 'Generative Ambient',
  'Eigener Aufbau': 'Custom Build',
  'Übersichtlicher 4-Modul-Einstieg: Ein warmes Drone-Pad wird rhythmisch von einem Slope Generator moduliert und in Hall gebettet.': 'Clean 4-module starter patch: a warm drone pad modulated rhythmically by a Slope Generator into lush reverb.',
  'Atmendes Felt Piano mit Arpeggiator, Chord Glide, Solo Violin, Drone-Fundament und 5 morphbaren Performance-Snapshots.': 'Breathing Felt Piano with Arpeggiator, Chord Glide, Solo Violin, drone foundation, and 5 morphable Performance Snapshots.',
  'Beruhigende Delta-Wellen-Frequenzen, sanfter Tri-Drone, gefiltertes rosa Rauschen, samtige Keys und 12s Raumhall.': 'Soothing delta-wave frequencies, gentle triangle drone, filtered pink noise, velvety keys, and 12s space reverb.',
  'Schwebendes Solar-Akkord-Cluster mit analoger Schwebung, Slow-Random Filteratmung und weiten Stereo-Echos.': 'Floating Solar chord cluster with analog beating, Slow Random filter breathing, and wide stereo echoes.',
  'Sanfte, langsam atmende Moll-Akkorde mit warmem Pink-Noise-Regen und gedämpftem Filz-Klavier.': 'Gentle, slow-breathing minor chords layered with warm pink-noise rain and muffled felt piano.',
  'Endlose 6-stimmige Analog-Drone kombiniert mit 18 schwebenden Spectral-Swarm-Teiltönen und Granular-Shimmer.': 'Endless 6-voice analog drone combined with 18 floating Spectral Swarm partials and granular shimmer.',
  'Warmes Filz-Klavier im Ólafur-Arnalds-Stil mit polyphoner Chord-Arp-Kette und sanftem Tape-Delay.': 'Intimate Ólafur Arnalds-inspired felt piano driven by a polyphonic Chord Arp chain and warm tape delay.',
  'Ausdrucksstarke Solo-Violine mit Bogen-Atmung, sanftem Vibrato, Filz-Klavier und tiefem Cello-Fundament.': 'Expressive solo violin with bow breathing, gentle vibrato, felt piano, and deep cello foundation.',
  'Euklidische Polyrhythmen aus Analog-Drums, Hybrid-Percussion und gestimmtem Resonator-Holz.': 'Euclidean polyrhythms weaving analog drums, hybrid percussion, and tuned modal wood resonators.',
  'Entspannte 78-BPM-Chillhop-Beats mit jazzigen Akkorden, warmem Vinyl-Knistern und sanftem Tape-Wobble.': 'Laid-back 78 BPM chillhop beats with jazzy chords, warm vinyl crackle, and gentle tape wobble.',
  'Sich endlos weiterentwickelnde Zupf-Melodien in Hirajoshi-Skala mit Granular-Cloud-Shimmer.': 'Endlessly evolving plucked melodies in the Hirajoshi scale bathed in granular cloud shimmer.',
  'Schwerer 68-BPM-Halftime-Groove mit dunklen Orgel-Pads, drückendem 808-Sub und Sidechain-Pumping.': 'Heavy 68 BPM halftime groove with dark organ pads, booming 808 sub-bass, and sidechain pumping.',
  'Monumentaler Filmscore-Aufbau mit tiefen Brass-Drones, langsamem Filter-Swell und wuchtigen Taiko-Trommeln.': 'Monumental film score build with deep brass drones, slow filter swells, and thunderous taiko drums.',
  'Treibender 108-BPM-80er-Groove mit rollendem Achtel-Bass, breitem Stereo-Chorus und schimmernder Lead-Sequenz.': 'Driving 108 BPM 80s groove with rolling 8th-note bass, wide stereo chorus, and shimmering lead sequence.',
  'Völlig freie Arbeitsfläche ohne Module und Kabel zum eigenen Rack-Aufbau von Grund auf.': 'Completely blank workspace without modules or cables to build your own modular rack from scratch.',

  // Modul-Parameter, Optionen & Auswahlwerte
  'Schritt': 'Step Size',
  'Umfang': 'Range',
  'Glättung': 'Smooth',
  'Tiefe': 'Depth',
  'Dichte': 'Density',
  'Bewegung': 'Motion',
  'Kurve': 'Curve',
  'Skala A': 'Scale A',
  'Skala B': 'Scale B',
  'Schwelle': 'Threshold',
  'Oktaven': 'Octaves',
  'Gate-Länge': 'Gate Len',
  'Akzent alle': 'Accent Every',
  'Klangfarbe': 'Timbre',
  'Schwebung': 'Detune',
  'Bogendruck': 'Bow Press',
  'Finger-Glide': 'Glide',
  'Holzkorpus': 'Wood Body',
  'Bogenstrich': 'Bow Attack',
  'Ausklang': 'Release',
  'Filz-Dämpfung': 'Felt Mute',
  'Brillanz': 'Brilliance',
  'Resonanz': 'Resonance',
  'Hammer-Klick': 'Hammer Click',
  'Grundton': 'Root Note',
  'Dämpfung': 'Damping',
  'Oberton': 'Harmonics',
  'Helligkeit': 'Brightness',
  'Rauheit': 'Roughness',
  'Verstimmung': 'Detune',
  'Stimmen': 'Voices',
  'Sprung': 'Leap',
  'Tonhöhe': 'Pitch',
  'Körper': 'Body',
  'Tonabfall': 'Pitch Drop',
  'Rauschen': 'Noise',
  'Anschlag': 'Strike',
  'Länge': 'Length',
  'Verzerrung': 'Drive',
  'Größe': 'Size',
  'Anschlagpos.': 'Strike Pos',
  'Verteilung': 'Spread',
  'Resonanzen': 'Modes',
  'Teiltöne': 'Partials',
  'Unharmonik': 'Inharmonic',
  'Streuung': 'Scatter',
  'Zusammenhalt': 'Cohesion',
  'Hüllkurve': 'Decay',
  'LFO Tiefe': 'LFO Depth',
  'Textur': 'Texture',
  'Tonart': 'Key',
  'Skala': 'Scale',
  'Oktave': 'Octave',
  'Modus': 'Mode',
  'Muster': 'Pattern',
  'Stimmführung': 'Voice Leading',
  'Raster': 'Clock Div',
  'Spielweise': 'Articulation',
  'Stimmung': 'Register',
  'Akkord': 'Chord',
  'Welle': 'Waveform',
  'Tonart-Sync': 'Scale Lock',
  'Polyphonie': 'Polyphony',
  'Farbe': 'Color',
  'Quelle': 'Source',
  'Notenlänge': 'Hold',
  'Anregung': 'Exciter',
  'Typ': 'Type',
  'Form': 'Shape',
  '▶ Läuft': '▶ Running',
  '■ Pause': '■ Paused',
  'Moll Penta': 'Minor Penta',
  'Dur Penta': 'Major Penta',
  'Dorisch': 'Dorian',
  'Moll': 'Minor',
  'Dur': 'Major',
  'Okt 1': 'Oct 1',
  'Okt 2': 'Oct 2',
  'Okt 3': 'Oct 3',
  'Okt 4': 'Oct 4',
  'Okt 5': 'Oct 5',
  'Gleitend': 'Smooth',
  'Stufig (S&H)': 'Stepped (S&H)',
  '🔄 Zyklisch (LFO)': '🔄 Cyclic (LFO)',
  '⚡ Trigger AD': '⚡ Trigger AD',
  '🚪 Gate ASR': '🚪 Gate ASR',
  '🚀 One-Shot Auto': '🚀 One-Shot Auto',
  'Up (Aufwärts)': 'Up',
  'Down (Abwärts)': 'Down',
  'Up-Down (Pendel)': 'Up-Down',
  'Converge (Zusammenlauf)': 'Converge',
  'Root-Pulse (Anker)': 'Root-Pulse',
  'Random (Zufall)': 'Random',
  'Grundstellung': 'Root Position',
  '1 Stimme (Mono)': '1 Voice (Mono)',
  '2 Stimmen': '2 Voices',
  '3 Stimmen': '3 Voices',
  '4 Stimmen': '4 Voices',
  '5 Stimmen': '5 Voices',
  '6 Stimmen': '6 Voices',
  'Arco (Gestrichen)': 'Arco (Bowed)',
  'Pizzicato (Gezupft)': 'Pizzicato (Plucked)',
  'Sul Tasto (Sanft)': 'Sul Tasto (Soft)',
  'Tremolo (Zitternd)': 'Tremolo',
  'Bratsche / Cello (-1 Okt)': 'Viola / Cello (-1 Oct)',
  'Violine Original (C3–A6)': 'Violin Standard (C3–A6)',
  'Flageolett / Hoch (+1 Okt)': 'Harmonics / High (+1 Oct)',
  'Okt 2 (Tief)': 'Oct 2 (Deep)',
  'Okt 3 (Warm)': 'Oct 3 (Warm)',
  'Okt 4 (Hell)': 'Oct 4 (Bright)',
  'Solo (1 Note)': 'Single Note',
  'Oktave (+12)': 'Octave (+12)',
  'Quinte (+7)': 'Fifth (+7)',
  'Moll 9 (Ambient)': 'Minor 9 (Ambient)',
  'Dur maj7': 'Major 7',
  'Sus 2 (Sphärisch)': 'Sus 2 (Airy)',
  'Quinten': 'Fifths',
  'Moll 9': 'Minor 9',
  'Adaptiv (bei Pitch-In)': 'Adaptive (Pitch-In)',
  'Fest': 'Fixed',
  'Weiß': 'White',
  'Rot (Brown)': 'Red (Brown)',
  'Tonband (Tape)': 'Tape',
  'Impuls': 'Impulse',
  'Dauer': 'Continuous',
  'Partikel': 'Particles',
  '+1 Oktave (Oct Up)': '+1 Octave (Oct Up)',
  '+Quinte (Fifth Up)': '+Fifth (Fifth Up)',
  'Dual Shimmer (+1 Okt & +Quinte)': 'Dual Shimmer (+1 Oct & +Fifth)',
  '-1 Oktave (Oct Down)': '-1 Octave (Oct Down)',
  '❄ Freeze (Eingefroren)': '❄ Freeze (Locked)',

  // Performance-Sidebar & Scope
  'GRUNDTON': 'PITCH',
  'KLANGFARBE': 'TIMBRE',
  'MODUS': 'MODE',
  'Shift + Klick auf beliebige Regler im Rack, um sie hier live zu spielen.': 'Shift + Click any knob in the rack to play it live here.',
  'Klick ruft Preset ab · Tasten': 'Click recalls preset · Keys',
  'Freier Live-Slot': 'Free Live Slot',
  'PRESET SLOTS (1–5)': 'PRESET SLOTS (1–5)',
  'Speichern auf': 'Save to',
  'Blöcke wählen': 'Select modules',
  'Alle Blöcke': 'All modules',
  'Nur Stimmen/Piano': 'Voices / Piano only',
  'Nur Effekte': 'Effects only',
  'Blöcke für Preset-Slots auswählen': 'Select modules for preset slots',
  'Wähle, von welchen Blöcken die Reglerstände gespeichert und geswitcht werden sollen:': 'Choose which modules are stored and morphed by preset slots:',
  'Fertig': 'Done',
  '6: Direkt': '6: Direct',
  'Takte S1': 'Bars S1',
  'Takte S2': 'Bars S2',
  'Takte S3': 'Bars S3',
  'Takte S4': 'Bars S4',
  'Takte S5': 'Bars S5',
  'Song-Ablauf': 'Song Mode',
  'Ende': 'End Mode',
  'Aus': 'Off',
  'An': 'On',
  'SONG: AUS': 'SONG: OFF',
  'SONG: WARTET AUF BAR': 'SONG: WAITING FOR BAR',

  // Workspace HUD
  'Frei': 'Free',
  'Alles anzeigen': 'Fit all',
  'Freie Positionen': 'Free positions',
  'Fokussieren': 'Focus',

  // Patch-Auswahl & Modulkarten
  'Neues Board (ungespeichert)': 'New Board (unsaved)',
  'Meine Patches': 'My Patches',
  'Studio-Vorlagen': 'Studio Templates',
  'KANALZUG · PAN & AUX SENDS': 'CHANNEL STRIP · PAN & AUX SENDS',
  'EINGÄNGE': 'INPUTS',
  'AUSGÄNGE': 'OUTPUTS',
  'AKTIVER PERFORMANCE SNAPSHOT': 'ACTIVE PERFORMANCE SNAPSHOT',
  'Stimme': 'Voice',
  'Klangquelle': 'Instrument',
  'Effekt': 'Effect',
  'KABEL': 'CABLES',
  'OHNE KABEL': 'NO CABLES',
  'Nach links': 'Move left',
  'Nach rechts': 'Move right',
  'Modul minimieren': 'Collapse module',
  'Modul vergrößern': 'Expand module',
  'Modul-Info & Handbuch': 'Module Info & Manual',
  'An / Aus': 'On / Off',
  'Modul anfassen zum Verschieben · Doppelklick: Ein-/ausklappen': 'Drag module to move · Double-click: collapse/expand',
  'Modul anfassen zum Verschieben': 'Drag module to move',
  'Speicher komplett leeren (alle Boards löschen)...': 'Clear storage (delete all boards)...',

  // Eurorack-Unterseite
  'VIRTUELLES EURORACK': 'VIRTUAL EURORACK',
  'Audio aktivieren': 'Enable Audio',
  'Audio aktiv ✓': 'Audio active ✓',
  'Manuell': 'Manual',
  'Auto (4:04)': 'Auto (4:04)',
  'Drone: EIN': 'Drone: ON',
  'Drone: AUS': 'Drone: OFF',
  'LAUTSTÄRKE': 'VOLUME',
  'Kabel abziehen': 'Unpatch All',
  'A/B Vergleich': 'A/B Compare',
  'Speichern': 'Save',
  'Laden': 'Load',
  'Aufnahme': 'Record',
  'Zurücksetzen': 'Reset',
  'Standard-Patch (Spielbereit)': 'Standard Patch (Ready to Play)',
  'Leeres Rack (Tabula Rasa)': 'Empty Rack (Blank)',
  'Distant Lights (Vorlage)': 'Distant Lights (Template)',
  'MAKROS': 'MACROS',
  'AUTOMATION': 'AUTOMATION',

  // ManualModal
  '⬇ PDF / Druck': '⬇ PDF / Print',
  '🤖 KI-Referenz (.md)': '🤖 AI Reference (.md)',
  '📋 Aktuelles Rack + KI-Doku (.md)': '📋 Current Rack + AI Docs (.md)',
  'Grundprinzip & Signalfluss': 'Core Principles & Signal Flow',
  'Bedienung & Performance': 'Operation & Performance',
  'Die Bausteine': 'Building Blocks',
  '5 Beispiel-Racks mit Schaltplänen': '5 Example Racks with Patch Diagrams',
  '▶ Direkt ins Rack laden': '▶ Load into Rack',
  'Alle Kategorien': 'All Categories',

  // InfoSystem / Guide Modal
  'Board-Galerie': 'Board Gallery',
  'Tutorials': 'Tutorials',
  'Modul-Lexikon': 'Module Lexicon',
  'Signalfluss & Kabel': 'Signal Flow & Cables',
  '⚡ Jetzt im Board testen': '⚡ Test in Board',
  '✓ Im Rack aktiv!': '✓ Active in Rack!',
  '⚡ Beispiel anhören': '⚡ Audition Example',
  '⚡ Verbinden': '⚡ Connect',
  '✓ Verbunden!': '✓ Connected!',
  'Schließen': 'Close',
};

const REVERSE_DICT = Object.fromEntries(Object.entries(DICT).map(([de, en]) => [en, de]));

function translateString(str) {
  if (!str) return str;
  const trimmed = str.trim();
  if (!trimmed) return str;
  if (currentLang === 'en') {
    const hit = DICT[trimmed];
    return hit ? str.replace(trimmed, hit) : str;
  }
  const rev = REVERSE_DICT[trimmed];
  return rev ? str.replace(trimmed, rev) : str;
}

export function tr(str) {
  return translateString(str);
}

/** Übersetzt alle passenden Textknoten und Attribute im gegebenen DOM-Teilbaum */
export function applyTranslations(root = document) {
  if (!root || typeof document === 'undefined' || !document.createTreeWalker) return;

  const targetRoot = root === document ? document.body : root;
  if (!targetRoot) return;

  // 1. Textknoten
  const walker = document.createTreeWalker(targetRoot, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    const parent = node.parentElement;
    if (!parent || parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE') continue;
    const translated = translateString(node.nodeValue);
    if (translated !== node.nodeValue) {
      node.nodeValue = translated;
    }
  }

  // 2. Attribute (placeholder, title, aria-label)
  targetRoot.querySelectorAll?.('[placeholder], [title], [aria-label]').forEach((el) => {
    for (const attr of ['placeholder', 'title', 'aria-label']) {
      const val = el.getAttribute(attr);
      if (!val) continue;
      const tr = translateString(val);
      if (tr !== val) el.setAttribute(attr, tr);
    }
  });

  // 3. Sprach-Toggle-Button & Dokumenttitel aktualisieren
  if (typeof document !== 'undefined') {
    document.title = currentLang === 'en'
      ? 'SYNTHBOARD · Modular Music Studio'
      : 'SYNTHBOARD · Modulares Musikstudio';
  }
  const langBtn = document.getElementById('btn-lang-toggle');
  if (langBtn) {
    const codeEl = langBtn.querySelector('.lang-code');
    if (codeEl) codeEl.textContent = currentLang === 'en' ? 'EN' : 'DE';
    else langBtn.textContent = currentLang === 'en' ? 'EN' : 'DE';
    langBtn.title = currentLang === 'en' ? 'Switch language to German (DE)' : 'Sprache auf Englisch umschalten (EN)';
    langBtn.classList.toggle('is-en', currentLang === 'en');
  }
}
