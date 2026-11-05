// SYNTHBOARD – Interaktives Info-, Tutorial- & Handbuch-System
// Verwaltet dynamische Infoboxen/Tooltips für Buchsen, Regler und Module
// sowie das interaktive Tutorial- und Modulations-Center für alle neuen Features.

import { SIGNAL_COLORS } from '../modules/patchSystem.js';
import { MODULES, TEMPLATES } from '../modules/index.js';

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
  'slow_random:trigIn': { name: 'S&H Clock Eingang', desc: 'Taktimpuls für die Sample & Hold Stufe: Tastet das Rauschen ab und hält den Wert.' },
  'slow_random:cvOut': { name: 'Glatter LFO CV', desc: 'Organisch driftende Steuerspannung. Perfekt für Filter Cutoff, Delay-Pitch-Warble oder Granular-Position.' },
  'slow_random:invOut': { name: 'Invertierter LFO CV', desc: 'Gegenläufige Steuerspannung für komplementäre Filter- oder Lautstärkebewegungen.' },

  // Macro Controller
  'macro_controller:densityCv': { name: 'Dichte CV', desc: 'Steuerspannung der Dichte-Achse für generative Klangdichte.' },
  'macro_controller:variationCv': { name: 'Variation CV', desc: 'Steuerspannung der Variations-Achse für musikalische Abwechslung.' },
  'macro_controller:motionCv': { name: 'Bewegung CV', desc: 'Steuerspannung der Bewegungs-Achse für räumliche und tonale Drift.' },

  // Slope Generator
  'slope_generator:trigIn': { name: 'Trigger Eingang', desc: 'Löst die Rise/Fall-Hüllkurve einmalig aus.' },
  'slope_generator:gateIn': { name: 'Gate Eingang', desc: 'Hält die Hüllkurve im Attack-Sustain-Release Modus oben, solange der Gate aktiv ist.' },
  'slope_generator:modRise': { name: 'Rise CV Eingang', desc: 'Moduliert die Anstiegszeit (0.05s bis 60s) dynamisch von außen.' },
  'slope_generator:modFall': { name: 'Fall CV Eingang', desc: 'Moduliert die Abfallzeit (0.05s bis 60s) dynamisch von außen.' },
  'slope_generator:envOut': { name: 'Hüllkurve Ausgang', desc: 'Gibt die positive Hüllkurve (0.0 bis 1.0) nach Skalierung und Offset aus. Ideal für bis zu 60s lange Ambient-Swells!' },
  'slope_generator:invOut': { name: 'Invertierter Ausgang', desc: 'Gibt die umgekehrte Hüllkurve (1.0 bis 0.0) aus – perfekt für Sidechain-Ducking ohne Kompressor!' },
  'slope_generator:eocOut': { name: 'End-Of-Cycle Trigger', desc: 'Sendet einen Trigger-Puls, sobald die Hüllkurve fertig abgeklungen ist. Ermöglicht Kaskaden mehrerer Hüllkurven!' },

  // Attenuverter & Offset
  'attenuverter:inA': { name: 'Eingang A', desc: 'Eingehendes CV-Signal für Kanal A.' },
  'attenuverter:outA': { name: 'Ausgang A', desc: 'Skalierter, invertierter (-100%..+100%) und offset-verschobener Ausgang A.' },
  'attenuverter:inB': { name: 'Eingang B', desc: 'Eingehendes CV-Signal für Kanal B.' },
  'attenuverter:outB': { name: 'Ausgang B', desc: 'Skalierter Ausgang B.' },
  'attenuverter:sumOut': { name: 'Summen-Ausgang', desc: 'Mischung aus Ausgang A + Ausgang B.' },

  // Drone
  'drone:gateIn': { name: 'Gate / Swell In', desc: 'Triggert ein sanftes Anschwellen der Drone-Akkorde.' },
  'drone:pitchIn': { name: 'Pitch CV', desc: 'Stimmt den Grundton des 6-stimmigen Drones.' },
  'drone:vcaCv': { name: 'VCA CV', desc: 'Moduliert die Gesamtlautstärke der Drone-Maschine.' },
  'drone:panCv': { name: 'Pan CV', desc: 'Verschiebt die Drone stufenlos im Stereofeld.' },
  'drone:cvFm': { name: 'FM CV', desc: 'Moduliert die Schwebung und Frequenzmodulation der Drone-Oszillatoren.' },
  'drone:cvTone': { name: 'Tone CV', desc: 'Moduliert die Filteröffnung und Helligkeit der Drone.' },

  // Keys
  'keys:gateIn': { name: 'Gate Eingang', desc: 'Triggert Notenanschläge der Keys-Stimme.' },
  'keys:pitchIn': { name: 'Pitch CV Eingang', desc: 'Steuert die Tonhöhe (1V/Okt Standard).' },
  'keys:vcaCv': { name: 'VCA CV', desc: 'Moduliert die Gesamtlautstärke der Poly-Keys.' },
  'keys:panCv': { name: 'Pan CV', desc: 'Stereo-Pan Modulation für schwebende Tasten.' },
  'keys:modCutoff': { name: 'Filter CV', desc: 'Öffnet oder schließt dynamisch das Tiefpassfilter der Tastenstimme.' },

  // Sequencer
  'sequencer:clockIn': { name: 'Clock Eingang', desc: 'Taktet den 8-Schritt-Sequenzer weiter.' },
  'sequencer:gateOut': { name: 'Gate Ausgang', desc: 'Gibt Gates der aktiven Sequenzer-Schritte aus.' },
  'sequencer:pitchOut': { name: 'Pitch CV Ausgang', desc: 'Gibt die Tonhöhen der einzelnen Sequenzer-Schritte im 1V/Okt Format aus.' },

  // Pluck Synth
  'pluck:gateIn': { name: 'Gate Eingang', desc: 'Löst das akustische Anzupfen der Saite / Klangstäbe aus.' },
  'pluck:pitchIn': { name: 'Pitch CV Eingang', desc: 'Bestimmt die Tonhöhe der gezupften Saite.' },
  'pluck:vcaCv': { name: 'VCA CV', desc: 'Lautstärke-Steuerspannung für Ducking oder Swells.' },
  'pluck:panCv': { name: 'Pan CV', desc: 'Stereo-Panoramamodulation für Harfen-Stereobreite.' },
  'pluck:modCutoff': { name: 'Filter CV', desc: 'Moduliert die Dämpfung und Helligkeit des Saitenklangs.' },

  // FM Voice
  'fm_voice:gateIn': { name: 'Gate Eingang', desc: 'Startet den Anschlag der FM-Operatoren.' },
  'fm_voice:pitchIn': { name: 'Pitch CV Eingang', desc: 'Bestimmt die Grundfrequenz der FM-Stimme.' },
  'fm_voice:vcaCv': { name: 'VCA CV', desc: 'Moduliert die Gesamtlautstärke der FM-Stimme.' },
  'fm_voice:panCv': { name: 'Pan CV', desc: 'Stereoposition im Mix.' },
  'fm_voice:modIndex': { name: 'FM Mod CV', desc: 'Moduliert den FM-Index (metallische Brillanz & Obertöne) in Echtzeit.' },

  // Bass Synth
  'bass:gateIn': { name: 'Gate Eingang', desc: 'Löst den Attack-Punch der Bass-Hüllkurve aus.' },
  'bass:pitchIn': { name: 'Pitch CV Eingang', desc: 'Steuert die Tonhöhe des analogen Bass-Synthesizers.' },
  'bass:vcaCv': { name: 'VCA CV', desc: 'Moduliert die Lautstärke der Bassline.' },
  'bass:panCv': { name: 'Pan CV', desc: 'Stereo-Panoramamodulation.' },
  'bass:modCutoff': { name: 'Cutoff CV', desc: 'Moduliert die saftige Filterresonanz des Acid-Filters.' },

  // Drum Rack
  'drum_rack:trigKick': { name: 'Kick Trigger', desc: 'Triggert die tiefe analoge Bass-Drum.' },
  'drum_rack:trigSnare': { name: 'Snare Trigger', desc: 'Triggert die knackige Snare mit Rausch-Teppich.' },
  'drum_rack:trigHat': { name: 'Hi-Hat Trigger', desc: 'Triggert die metallische Hi-Hat.' },
  'drum_rack:trigPerc': { name: 'Percussion Trigger', desc: 'Triggert den resonanten Rimshot / Holz-Percussion-Klang.' },
  'drum_rack:vcaCv': { name: 'VCA CV', desc: 'Moduliert die Gesamtlautstärke des Drum Racks (z. B. für Fades oder Ducking).' },
  'drum_rack:panCv': { name: 'Pan CV', desc: 'Stereo-Panoramamodulation.' },

  // Morph Voice
  'morph_voice:gateIn': { name: 'Gate Eingang', desc: 'Startet den Hüllkurvenverlauf der Morph Voice (Attack bis Release).' },
  'morph_voice:pitchIn': { name: 'Pitch CV', desc: 'Bestimmt die Grundtonhöhe der Multiquellen-Stimme (1V/Okt).' },
  'morph_voice:jumpIn': { name: 'Jump Trigger', desc: 'Wählt per Zufall eine neue Wellenformposition auf der Wavetable-Achse.' },
  'morph_voice:morphCv': { name: 'Morph CV', desc: 'Fährt stufenlos durch die 8 Wellenformen (Analog ➜ Vokal ➜ Glocke ➜ Digitalmetall).' },
  'morph_voice:timbreCv': { name: 'Helligkeit CV', desc: 'Moduliert die dynamische Filter-Eckfrequenz & Brillanz.' },
  'morph_voice:envCv': { name: 'Hüllkurvenzeit CV', desc: 'Skaliert Attack- und Release-Zeiten dynamisch in Echtzeit (kurz & perkussiv bis ultralang).' },
  'morph_voice:vcaCv': { name: 'VCA CV', desc: 'Lautstärkesteuerung für Swells und Dynamik.' },
  'morph_voice:panCv': { name: 'Pan CV', desc: 'Stereo-Panoramamodulation.' },
  'morph_voice:mutateIn': { name: 'Mutation Trigger', desc: 'Würfelt alle ungesperrten Klangparameter neu aus.' },

  // Hybrid Percussion
  'hybrid_perc:gateIn': { name: 'Trigger Eingang', desc: 'Löst den transienten Percussion-Schlag aus.' },
  'hybrid_perc:pitchIn': { name: 'Pitch CV', desc: 'Steuert die Basistonhöhe des Klangkörpers (1V/Okt).' },
  'hybrid_perc:timbreCv': { name: 'Material CV', desc: 'Blendet zwischen tiefem Fell/Körper und metallisch-glockigem Obertonklang um.' },
  'hybrid_perc:lengthCv': { name: 'Length CV', desc: 'Verkürzt oder verlängert den Ausklang (Ausschwingzeit von 20ms Klick bis 2s Grollen).' },
  'hybrid_perc:vcaCv': { name: 'VCA CV', desc: 'Lautstärkesteuerung der Perkussion.' },
  'hybrid_perc:panCv': { name: 'Pan CV', desc: 'Stereoposition im Raum.' },
  'hybrid_perc:mutateIn': { name: 'Mutation Trigger', desc: 'Würfelt Trommelcharakter neu (Körper, Material, Drop, Rauschen).' },

  // Resonator Garden
  'resonator_garden:gateIn': { name: 'Anregung / Gate', desc: 'Regt die 6 gestimmten Resonanzkörper mit einem Impuls oder Rauschstoß an.' },
  'resonator_garden:pitchIn': { name: 'Pitch CV', desc: 'Stimmt die Grundresonanzfrequenz des Instruments.' },
  'resonator_garden:materialCv': { name: 'Material CV', desc: 'Wechselt fließend zwischen harmonischen Saiten und unharmonischem Metall/Stäben.' },
  'resonator_garden:dampCv': { name: 'Dämpfung CV', desc: 'Dämpft hohe Obertöne schneller ab (hohe Dämpfung = Holz; niedrige = singende Glocke).' },
  'resonator_garden:vcaCv': { name: 'VCA CV', desc: 'Dynamische Gesamtlautstärke.' },
  'resonator_garden:panCv': { name: 'Pan CV', desc: 'Stereo-Panorama-Bewegung.' },
  'resonator_garden:mutateIn': { name: 'Mutation Trigger', desc: 'Erzeugt neue Resonanzverhältnisse und Dämpfungskombinationen.' },

  // Spectral Swarm
  'spectral_swarm:gateIn': { name: 'Gate / Burst', desc: 'Löst im Partikelmodus einen Schwarm kleiner Teiltöne aus; im Dronemodus einen Akzent.' },
  'spectral_swarm:pitchIn': { name: 'Pitch CV', desc: 'Stimmt die gemeinsame Basisfrequenz des Obertontonschwarms.' },
  'spectral_swarm:scatterIn': { name: 'Scatter Trigger', desc: 'Verteilt alle 32 Teiltöne wild in Frequenz, Raum und Bewegung.' },
  'spectral_swarm:gatherIn': { name: 'Gather Trigger', desc: 'Zieht alle gestreuten Teiltöne wieder zu einem harmonischen Akkord zusammen.' },
  'spectral_swarm:cohesionCv': { name: 'Zusammenhalt CV', desc: '100% = reiner Kirchenorgel-Akkord; 0% = geisterhafte Dissonanz & Schwebungs-Cluster.' },
  'spectral_swarm:vcaCv': { name: 'VCA CV', desc: 'Gesamtlautstärke des Schwarms.' },
  'spectral_swarm:panCv': { name: 'Pan CV', desc: 'Stereo-Panoramabewegung.' },
  'spectral_swarm:mutateIn': { name: 'Mutation Trigger', desc: 'Verändert Unharmonik, Streuung und Helligkeit.' },

  // Filter Effekt
  'filter:cvCutoff': { name: 'Cutoff CV', desc: 'Moduliert die Filterfrequenz von außen (z. B. durch Slow Random oder LFO).' },

  // Delay Effekt
  'delay:cvTime': { name: 'Time CV', desc: 'Moduliert die Verzögerungszeit des Tape Delays für echtes Tonband-Leiern & Pitch Warble.' },
};

// Beschreibungen für Regler
export const KNOB_HELP = {
  rise: 'Anstiegszeit (Attack) der Hüllkurve von 0.05 Sekunden bis zu 60 Sekunden für ultralange Ambient-Swells.',
  fall: 'Abfallzeit (Decay/Release) der Hüllkurve von 0.05 Sekunden bis zu 60 Sekunden.',
  scale: 'Attenuverter-Regler (-100% bis +100%). Invertiert und dämpft das Signal stufenlos.',
  scalea: 'Dämpfungs- und Invertierungs-Regler für Kanal A (-100% bis +100%).',
  scaleb: 'Dämpfungs- und Invertierungs-Regler für Kanal B (-100% bis +100%).',
  offset: 'Gleichspannungs-Offset (-1.0 bis +1.0) zur Nullpunkt-Verschiebung.',
  offseta: 'Gleichspannungs-Offset für Kanal A.',
  offsetb: 'Gleichspannungs-Offset für Kanal B.',
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
  motion: 'Sanfte Wind- und Meeresrauschen-Schwankungen des Rauschgenerators oder Teilchenbewegung.',
  morph: 'Wavetable-Morph-Position: Fährt stufenlos zwischen warmen analogen Wellen, Vokalen, Metall und digitalen Strukturen.',
  formant: 'Mischung vokalähnlicher Formanten (Chöre und sprechende Obertöne).',
  rough: 'Analoge Rauheit und Sättigungsobertöne.',
  material: 'Klangkörper-Material: Harmonische Saiten vs. unharmonisches Metall oder Holz.',
  body: 'Tiefton-Resonanzkörper für Punch und Wärme.',
  drop: 'Tonhöhenabfall (Pitch Drop) beim Anschlag für druckvolle Kicks und Toms.',
  snap: 'Transienten-Anschlagsklick für maximale Durchsetzungskraft im Mix.',
  density: 'Dichte der Granular-Körner oder rhythmischen Schläge.',
  scatter: 'Streuung der Körner in der Zeit bzw. Frequenzabweichung der Teiltöne.',
  cohesion: 'Zusammenhalt der Obertöne: 1.0 = reiner Akkord/Orgel, 0.0 = schwebender Cluster.',
  inharm: 'Unharmonische Frequenzverhältnisse für metallische Science-Fiction-Flächen.',
  mutation: 'Stärke der zufälligen Klangveränderung (gesperrte Parameter mit 🔒 bleiben unverändert).',
  velsens: 'Velocity-Empfindlichkeit: Bestimmt, wie stark Tasten- und Kabelanschläge Klang und Lautstärke formen.',
};

// ─────────────────────────────────────────────────────────────
// PRAXIS-BEISPIELE FÜR ALLE 30 MODULE DES SYNTHBOARDS
// ─────────────────────────────────────────────────────────────
export const MODULE_EXAMPLES = {
  // Steuerung & Generatoren
  master_clock: {
    desc: 'Taktzentrale: Gibt ein präzises 1/16-Metrum aus, um Rhythmen und Instrumente im Gleichschritt zu halten.',
    wiring: 'Master Clock (Clock 1/16) ➔ Euclidean (Clock In) & Clock Divider (Clock In)',
    recipe: {
      name: 'Master Clock Sync & Beats',
      modules: ['master_clock', 'clock_divider', 'drum_rack', 'reverb'],
      cables: [
        { from: 'master_clock:clockOut', to: 'clock_divider:clockIn', color: '#06b6d4' },
        { from: 'clock_divider:outA', to: 'drum_rack:trigKick', color: '#fbbf24' },
        { from: 'clock_divider:outB', to: 'drum_rack:trigSnare', color: '#fbbf24' },
      ],
      params: { master_clock: { tempo: 102 } },
    },
  },
  clock_divider: {
    desc: 'Teilt den Master-Takt in Halbe (/2), Viertel (/4) und Ganze (/8) für strukturierte Beats.',
    wiring: 'Clock In von Master Clock ➔ Ausgang /4 an Kick, Ausgang /8 an Snare',
    recipe: {
      name: 'Clock Divider 4-on-the-Floor Beat',
      modules: ['master_clock', 'clock_divider', 'drum_rack', 'bass'],
      cables: [
        { from: 'master_clock:clockOut', to: 'clock_divider:clockIn', color: '#06b6d4' },
        { from: 'clock_divider:outB', to: 'drum_rack:trigKick', color: '#fbbf24' },
        { from: 'clock_divider:outC', to: 'drum_rack:trigSnare', color: '#fbbf24' },
        { from: 'clock_divider:outB', to: 'bass:gateIn', color: '#fbbf24' },
      ],
      params: { master_clock: { tempo: 110 } },
    },
  },
  euclidean: {
    desc: 'Erzeugt afrikanische & lateinamerikanische Polyrhythmen nach mathematischer Formel.',
    wiring: 'Euclidean (Gate Out) ➔ Pluck Synth (Gate In)',
    recipe: {
      name: 'Euclidean Zupfmuster (7 Steps / 3 Hits)',
      modules: ['master_clock', 'euclidean', 'pluck', 'reverb'],
      cables: [
        { from: 'master_clock:clockOut', to: 'euclidean:clockIn', color: '#06b6d4' },
        { from: 'euclidean:gateOut', to: 'pluck:gateIn', color: '#fbbf24' },
      ],
      params: { euclidean: { steps: 7, pulses: 3 }, master_clock: { tempo: 96 } },
    },
  },
  probability_gate: {
    desc: 'Lässt Taktimpulse nach einer Wahrscheinlichkeit (z. B. 65%) durch – für lebendige, unvorhersehbare Rhythmen.',
    wiring: 'Clock ➔ Probability Gate (Gate In) ➔ Gate A an Hi-Hat',
    recipe: {
      name: 'Probabilistischer Hi-Hat Groove',
      modules: ['master_clock', 'probability_gate', 'drum_rack'],
      cables: [
        { from: 'master_clock:clockOut', to: 'probability_gate:gateIn', color: '#06b6d4' },
        { from: 'probability_gate:gateA', to: 'drum_rack:trigHat', color: '#fbbf24' },
      ],
      params: { probability_gate: { probA: 0.6 } },
    },
  },
  random_walk: {
    desc: 'Macht mit jedem Taktschritt einen zufälligen Tonschritt nach oben oder unten (Melodie driftet nie zu weit weg).',
    wiring: 'Random Walk (Pitch Out) ➔ Pluck Synth (Pitch In) & (Gate Out) ➔ (Gate In)',
    recipe: {
      name: 'Generative Random Walk Harfe',
      modules: ['master_clock', 'euclidean', 'random_walk', 'pluck', 'delay', 'reverb'],
      cables: [
        { from: 'master_clock:clockOut', to: 'euclidean:clockIn', color: '#06b6d4' },
        { from: 'euclidean:gateOut', to: 'random_walk:clockIn', color: '#fbbf24' },
        { from: 'random_walk:pitchOut', to: 'pluck:pitchIn', color: '#a855f7' },
        { from: 'random_walk:gateOut', to: 'pluck:gateIn', color: '#fbbf24' },
      ],
      params: { pluck: { tone: 1800, decay: 0.8 } },
    },
  },
  scale_quantizer: {
    desc: 'Zwingt frei schwebende Spannungen (z. B. von LFOs oder Rauschen) exakt in harmonische Skalen (Moll, Dur, Pentatonik).',
    wiring: 'Slow Random CV ➔ Scale Quantizer (Pitch In) ➔ Quantizer Pitch Out an Keys',
    recipe: {
      name: 'Quantisierte LFO-Tonleiter',
      modules: ['slow_random', 'scale_quantizer', 'keys', 'reverb'],
      cables: [
        { from: 'slow_random:cvOut', to: 'scale_quantizer:pitchIn', color: '#a855f7' },
        { from: 'scale_quantizer:pitchOut', to: 'keys:pitchIn', color: '#a855f7' },
        { from: 'scale_quantizer:gateOut', to: 'keys:gateIn', color: '#fbbf24' },
      ],
      params: { slow_random: { rate: 0.3 } },
    },
  },
  slow_random: {
    desc: 'Sanft driftende Steuerspannung: Lässt Filter, Delays oder Resonatoren wie Meereswellen atmen.',
    wiring: 'Slow Random (CV Out) ➔ Analog Filter (Cutoff CV)',
    recipe: {
      name: 'Atmendes Analogfilter',
      modules: ['drone', 'slow_random', 'filter', 'delay', 'reverb'],
      cables: [
        { from: 'slow_random:cvOut', to: 'filter:cvCutoff', color: '#10b981' },
      ],
      params: { slow_random: { rate: 0.08, depth: 0.75 }, filter: { cutoff: 1200, reso: 3.5 } },
    },
  },
  macro_controller: {
    desc: 'Drei globale Steuerachsen (Dichte, Variation, Bewegung) für händische Performance.',
    wiring: 'Macro Dichte CV ➔ Spectral Swarm (VCA CV) & Bewegung CV ➔ Filter Cutoff',
    recipe: {
      name: 'Macro Performance Steuerung',
      modules: ['macro_controller', 'spectral_swarm', 'filter', 'reverb'],
      cables: [
        { from: 'macro_controller:densityCv', to: 'spectral_swarm:vcaCv', color: '#10b981' },
        { from: 'macro_controller:motionCv', to: 'filter:cvCutoff', color: '#10b981' },
      ],
      params: { macro_controller: { density: 0.7, motion: 0.6 } },
    },
  },
  slope_generator: {
    desc: 'Bis zu 60s langer Rise/Fall Ambient-Swell und umgekehrtes Ducking (Sidechain).',
    wiring: 'Slope ENV OUT ➔ Drone (VCA CV) & Slope INV OUT ➔ Pluck (VCA CV)',
    recipe: {
      name: 'Slope Generator Swell & Ducking',
      modules: ['slope_generator', 'drone', 'pluck', 'reverb'],
      cables: [
        { from: 'slope_generator:envOut', to: 'drone:vcaCv', color: '#10b981' },
        { from: 'slope_generator:invOut', to: 'pluck:vcaCv', color: '#10b981' },
      ],
      params: { slope_generator: { mode: 'loop', rise: 8, fall: 16 } },
    },
  },
  attenuverter: {
    desc: 'Bändigt zu wilde Steuerspannungen feinfühlig ab (-100% bis +100%) oder kehrt sie um.',
    wiring: 'Slow Random CV ➔ Attenuverter IN A ➔ OUT A (Scale 20%) ➔ Keys (Cutoff CV)',
    recipe: {
      name: 'Attenuverter Feindosierung',
      modules: ['slow_random', 'attenuverter', 'keys', 'filter'],
      cables: [
        { from: 'slow_random:cvOut', to: 'attenuverter:inA', color: '#10b981' },
        { from: 'attenuverter:outA', to: 'filter:cvCutoff', color: '#10b981' },
      ],
      params: { attenuverter: { scaleA: 0.22 } },
    },
  },

  // Klangquellen & Instrumente
  drone: {
    desc: 'Sechsstimmiger Akkord-Cluster mit Schwebung, FM-Modulation und tiefem Sub-Bass.',
    wiring: 'Slope Generator ENV OUT ➔ Drone VCA CV (Reverb Send auf 80%)',
    recipe: {
      name: 'Tiefe Kosmos-Drone',
      modules: ['slope_generator', 'drone', 'delay', 'reverb'],
      cables: [
        { from: 'slope_generator:envOut', to: 'drone:vcaCv', color: '#10b981' },
      ],
      params: { slope_generator: { mode: 'loop', rise: 10, fall: 20 }, drone: { spread: 12, fm: 0.15 } },
    },
  },
  pluck: {
    desc: 'Akustisch gezupfte Saiten, Harfen und Kalimbas im Karplus-Strong Stil.',
    wiring: 'Euclidean Gate ➔ Pluck Gate, Random Walk ➔ Pluck Pitch',
    recipe: {
      name: 'Kristalline Harfen-Melodien',
      modules: ['master_clock', 'euclidean', 'random_walk', 'pluck', 'delay', 'reverb'],
      cables: [
        { from: 'master_clock:clockOut', to: 'euclidean:clockIn', color: '#06b6d4' },
        { from: 'euclidean:gateOut', to: 'random_walk:clockIn', color: '#fbbf24' },
        { from: 'random_walk:pitchOut', to: 'pluck:pitchIn', color: '#a855f7' },
        { from: 'euclidean:gateOut', to: 'pluck:gateIn', color: '#fbbf24' },
      ],
      params: { pluck: { decay: 0.9, tone: 2200 } },
    },
  },
  fm_voice: {
    desc: '2-Operator FM-Synthese für metallische Glocken, Gongs und schneidende Obertöne.',
    wiring: 'Sequencer Pitch ➔ FM Voice Pitch In, Slow Random ➔ FM Mod Index',
    recipe: {
      name: 'Metallische FM-Glocken',
      modules: ['master_clock', 'sequencer', 'slow_random', 'fm_voice', 'delay', 'reverb'],
      cables: [
        { from: 'master_clock:clockOut', to: 'sequencer:clockIn', color: '#06b6d4' },
        { from: 'sequencer:pitchOut', to: 'fm_voice:pitchIn', color: '#a855f7' },
        { from: 'sequencer:gateOut', to: 'fm_voice:gateIn', color: '#fbbf24' },
        { from: 'slow_random:cvOut', to: 'fm_voice:modIndex', color: '#10b981' },
      ],
      params: { fm_voice: { ratio: 2.0, index: 2.5, decay: 1.4 } },
    },
  },
  bass: {
    desc: 'Analoger Acid-Bass mit quietschender Resonanz und tiefem Sub-Bass.',
    wiring: 'Clock Divider /4 ➔ Bass Gate In, Slow Random ➔ Bass Cutoff CV',
    recipe: {
      name: 'Acid 303 Bassline',
      modules: ['master_clock', 'clock_divider', 'slow_random', 'bass', 'filter', 'delay'],
      cables: [
        { from: 'master_clock:clockOut', to: 'clock_divider:clockIn', color: '#06b6d4' },
        { from: 'clock_divider:outB', to: 'bass:gateIn', color: '#fbbf24' },
        { from: 'slow_random:cvOut', to: 'bass:modCutoff', color: '#10b981' },
      ],
      params: { bass: { cutoff: 520, reso: 5.5, env: 0.6 } },
    },
  },
  drum_rack: {
    desc: 'Vierstimmige analoge Beatbox mit Kick, Snare, Hi-Hat und Wood-Rimshot.',
    wiring: 'Clock Divider /4 ➔ Kick, /8 ➔ Snare, /2 ➔ Hi-Hat',
    recipe: {
      name: 'Solider Drum Rack Beat',
      modules: ['master_clock', 'clock_divider', 'drum_rack', 'reverb'],
      cables: [
        { from: 'master_clock:clockOut', to: 'clock_divider:clockIn', color: '#06b6d4' },
        { from: 'clock_divider:outA', to: 'drum_rack:trigHat', color: '#fbbf24' },
        { from: 'clock_divider:outB', to: 'drum_rack:trigKick', color: '#fbbf24' },
        { from: 'clock_divider:outC', to: 'drum_rack:trigSnare', color: '#fbbf24' },
      ],
      params: { master_clock: { tempo: 114 } },
    },
  },
  keys: {
    desc: 'Warmer mehrstimmiger Synthesizer für Pads und Melodien (auch per Computertastatur A-K spielbar).',
    wiring: 'Random Walk ➔ Keys Pitch In, Slow Random ➔ Keys Filter CV',
    recipe: {
      name: 'Poly Keys Traumakkorde',
      modules: ['master_clock', 'euclidean', 'random_walk', 'keys', 'chorus', 'reverb'],
      cables: [
        { from: 'master_clock:clockOut', to: 'euclidean:clockIn', color: '#06b6d4' },
        { from: 'euclidean:gateOut', to: 'keys:gateIn', color: '#fbbf24' },
        { from: 'random_walk:pitchOut', to: 'keys:pitchIn', color: '#a855f7' },
      ],
      params: { keys: { attack: 0.4, release: 2.2, cutoff: 1400 } },
    },
  },
  sequencer: {
    desc: '8-Schritt Analog-Sequenzer mit Tonhöhen, Gate-Wahrscheinlichkeit und Steps.',
    wiring: 'Clock ➔ Sequencer Clock In ➔ Sequencer Pitch Out an Pluck Pitch',
    recipe: {
      name: '8-Step Sequencer Melodie',
      modules: ['master_clock', 'sequencer', 'pluck', 'delay', 'reverb'],
      cables: [
        { from: 'master_clock:clockOut', to: 'sequencer:clockIn', color: '#06b6d4' },
        { from: 'sequencer:pitchOut', to: 'pluck:pitchIn', color: '#a855f7' },
        { from: 'sequencer:gateOut', to: 'pluck:gateIn', color: '#fbbf24' },
      ],
      params: { master_clock: { tempo: 104 } },
    },
  },
  noise: {
    desc: 'Analoges Meeresrauschen, Wind und Vinyl-Knistern mit Bandpass-Filterung.',
    wiring: 'Slow Random CV ➔ Noise Tone CV (Atmende Rauschwelle)',
    recipe: {
      name: 'Atmende Meeresrausch-Welle',
      modules: ['slow_random', 'noise', 'reverb'],
      cables: [
        { from: 'slow_random:cvOut', to: 'noise:cvTone', color: '#10b981' },
      ],
      params: { noise: { color: 'pink', motion: 0.7, level: 0.25 }, slow_random: { rate: 0.05 } },
    },
  },
  morph_voice: {
    desc: 'Multiquellen-Wavetable-Stimme mit 8 Wellenformen (Analog, Vokal, Glocke, Metall).',
    wiring: 'Slope Generator ENV OUT ➔ Morph Voice MORPH CV',
    recipe: {
      name: 'Morphing Wavetable Voice',
      modules: ['slope_generator', 'morph_voice', 'delay', 'reverb'],
      cables: [
        { from: 'slope_generator:envOut', to: 'morph_voice:morphCv', color: '#10b981' },
      ],
      params: { slope_generator: { mode: 'loop', rise: 4, fall: 8 }, morph_voice: { morph: 0.3 } },
    },
  },
  hybrid_perc: {
    desc: 'Druckvolle Perkussion mit Sub-Pitch-Drop, Klick-Snap und Materialmix.',
    wiring: 'Clock Divider /4 ➔ Hybrid Perc Gate, Slow Random ➔ Material CV',
    recipe: {
      name: 'Hybrid Drum Groove',
      modules: ['master_clock', 'clock_divider', 'slow_random', 'hybrid_perc', 'delay'],
      cables: [
        { from: 'master_clock:clockOut', to: 'clock_divider:clockIn', color: '#06b6d4' },
        { from: 'clock_divider:outB', to: 'hybrid_perc:gateIn', color: '#fbbf24' },
        { from: 'slow_random:cvOut', to: 'hybrid_perc:timbreCv', color: '#10b981' },
      ],
      params: { hybrid_perc: { body: 0.8, snap: 0.45, drop: 0.6 } },
    },
  },
  resonator_garden: {
    desc: '6 modale Resonanzkörper (Saiten, Klangschalen, Holzstäbe).',
    wiring: 'Euclidean Gate ➔ Resonator Garden Gate, Slow Random ➔ Damp CV',
    recipe: {
      name: 'Resonator Gamelan Garten',
      modules: ['master_clock', 'euclidean', 'slow_random', 'resonator_garden', 'reverb'],
      cables: [
        { from: 'master_clock:clockOut', to: 'euclidean:clockIn', color: '#06b6d4' },
        { from: 'euclidean:gateOut', to: 'resonator_garden:gateIn', color: '#fbbf24' },
        { from: 'slow_random:cvOut', to: 'resonator_garden:dampCv', color: '#10b981' },
      ],
      params: { resonator_garden: { material: 0.55, modes: 8, decay: 2.6 } },
    },
  },
  spectral_swarm: {
    desc: '32 wandernde Teiltöne mit Schwarm-Kohäsion (Dissonanz vs. Orgelakkord).',
    wiring: 'Slope Generator ENV OUT ➔ Spectral Swarm COHESION CV',
    recipe: {
      name: 'Spectral Swarm Kohäsion',
      modules: ['slope_generator', 'spectral_swarm', 'reverb'],
      cables: [
        { from: 'slope_generator:envOut', to: 'spectral_swarm:cohesionCv', color: '#10b981' },
      ],
      params: { slope_generator: { mode: 'loop', rise: 6, fall: 14 }, spectral_swarm: { count: 18 } },
    },
  },

  // Stereo-Effektkette
  filter: {
    desc: 'Moog-Style 24dB Filter mit Resonanz und Sättigung.',
    wiring: 'Drone ➔ Filter, Slow Random CV ➔ Filter CUTOFF CV',
    recipe: {
      name: 'Resonanter Moog-Filter Sweep',
      modules: ['drone', 'slow_random', 'filter', 'delay'],
      cables: [
        { from: 'slow_random:cvOut', to: 'filter:cvCutoff', color: '#10b981' },
      ],
      params: { filter: { cutoff: 1400, reso: 4.8, drive: 0.2 } },
    },
  },
  chorus: {
    desc: 'BBD Analog-Chorus für breite Stereofelder und sanfte Schwebung.',
    wiring: 'Keys ➔ Chorus (Rate 0.2 Hz, Depth 50%) ➔ Reverb',
    recipe: {
      name: 'Breiter Vintage Stereo-Chorus',
      modules: ['keys', 'chorus', 'reverb'],
      cables: [],
      params: { chorus: { rate: 0.15, depth: 0.55, mix: 0.45 } },
    },
  },
  tremolo: {
    desc: 'Rhythmische Lautstärkemodulation für Surf- und Vintage Rhodes-Vibes.',
    wiring: 'Keys ➔ Tremolo (Depth 65%, Rate 4 Hz) ➔ Delay',
    recipe: {
      name: 'Rhodes Surf-Tremolo',
      modules: ['keys', 'tremolo', 'delay', 'reverb'],
      cables: [],
      params: { tremolo: { rate: 3.5, depth: 0.65 } },
    },
  },
  lofi: {
    desc: 'Bitcrusher, Samplerate-Reduktion und Vinyl-Knistern für nostalgische Kassettenklänge.',
    wiring: 'Keys ➔ Lo-Fi Bitcrusher (Bits 10, Crush 4) ➔ Delay',
    recipe: {
      name: 'Nostalgischer Kassetten Lo-Fi',
      modules: ['keys', 'lofi', 'delay', 'reverb'],
      cables: [],
      params: { lofi: { bits: 10, crush: 4, drive: 0.35, mix: 0.7 } },
    },
  },
  delay: {
    desc: 'Tape Delay mit Wow & Flutter, Stereo Ping-Pong und Pitch Warble.',
    wiring: 'Pluck ➔ Tape Delay, Slow Random CV ➔ Delay TIME CV',
    recipe: {
      name: 'Tape Delay mit Pitch-Warble',
      modules: ['pluck', 'slow_random', 'delay', 'reverb'],
      cables: [
        { from: 'slow_random:cvOut', to: 'delay:cvTime', color: '#10b981' },
      ],
      params: { delay: { feedback: 0.55, time: 0.45, mix: 0.45 } },
    },
  },
  reverb: {
    desc: 'Riesiger Shimmer- und Dream-Hallraum mit bis zu 20s Nachhallzeit.',
    wiring: 'Drone Reverb-Send auf 75% ➔ Ambient Reverb',
    recipe: {
      name: 'Endloser Shimmer-Traumhall',
      modules: ['drone', 'reverb'],
      cables: [],
      params: { reverb: { decay: 14.0, mix: 0.6, damp: 0.4 } },
    },
  },
};

export class InfoSystem {
  constructor(engine, patchBay, options = {}) {
    this.engine = engine;
    this.patchBay = patchBay;
    this.options = options;
    this.onRackModified = options.onRackModified || null;
    this.onToast = options.onToast || null;
    this.onStartAudio = options.onStartAudio || null;
    this.enabled = localStorage.getItem('synthboard:infoboxes') !== 'false';

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
    if (this.patchBay?.activeDrag) return;

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

    if (top < 10) {
      top = rect.bottom + 8;
    }

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
        this.notify(state ? '💡 Infoboxen aktiviert' : '💡 Infoboxen deaktiviert');
      });
    }

    // Handbuch / Guide Button
    const btnGuide = document.querySelector('#btn-guide');
    if (btnGuide) {
      btnGuide.addEventListener('click', () => this.openGuide('tab-tutorials'));
    }

    // Footer Guide Link
    const footerGuide = document.querySelector('#btn-guide-footer');
    if (footerGuide) {
      footerGuide.addEventListener('click', (e) => {
        e.preventDefault();
        this.openGuide('tab-tutorials');
      });
    }

    // Keyboard Shortcuts: 'i' für Info-Toggle, 'h' für Handbuch, 't' für Tutorials
    window.addEventListener('keydown', (e) => {
      const isTyping = (el) => el && ((el.tagName === 'INPUT' && el.type !== 'range') || el?.tagName === 'TEXTAREA' || el?.tagName === 'SELECT');
      if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;

      const k = e.key.toLowerCase();
      if (k === 'i') {
        e.preventDefault();
        this.toggle();
      } else if (k === 'h' || e.key === '?') {
        e.preventDefault();
        this.openGuide('tab-cables');
      } else if (k === 't') {
        e.preventDefault();
        this.openGuide('tab-tutorials');
      } else if (k === 'g') {
        e.preventDefault();
        this.openGuide('tab-green-guide');
      } else if (k === 'v') {
        e.preventDefault();
        this.openGuide('tab-boards');
      } else if (e.key === 'Escape' && this.guideModalEl.classList.contains('open')) {
        this.closeGuide();
      }
    });

    // Globale Delegation für Buchsen, Regler und Module
    document.addEventListener('mouseover', (e) => {
      if (!this.enabled || this.patchBay?.activeDrag) return;

      const jackEl = e.target.closest('.hw-jack, .jack-socket-wrap');
      if (jackEl) {
        const actualJack = jackEl.classList.contains('hw-jack') ? jackEl : jackEl.querySelector('.hw-jack');
        if (actualJack) this.handleJackHover(actualJack);
        return;
      }

      const infoBtn = e.target.closest('.mod-info-btn');
      if (infoBtn) {
        const card = infoBtn.closest('.module-card');
        if (card) this.handleModuleHover(card, infoBtn);
        return;
      }

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

  notify(msg) {
    if (this.onToast) {
      this.onToast(msg);
    } else {
      const toast = document.querySelector('#toast');
      if (toast) {
        toast.textContent = msg;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 2200);
      }
    }
  }

  getGreenJackTips(modType, portId, isOut) {
    if (isOut) {
      switch (`${modType}:${portId}`) {
        case 'slope_generator:envOut':
          return '💡 <b>Wohin stecken?</b> In <code>Drone: VCA CV</code>, <code>Morph Voice: MORPH CV</code> oder <code>Filter: CUTOFF CV</code>.<br><b>Was verändert sich?</b> Bis zu 60s langer, majestätischer Ambient-Swell!';
        case 'slope_generator:invOut':
          return '💡 <b>Wohin stecken?</b> In <code>Pluck: VCA CV</code> oder <code>Drum: VCA CV</code>.<br><b>Was verändert sich?</b> Automatisches Ducking: Begleittöne werden dezent leiser, solange die Klangfläche anschwillt!';
        case 'slow_random:cvOut':
          return '💡 <b>Wohin stecken?</b> In <code>Filter: CUTOFF CV</code>, <code>Delay: TIME CV</code> oder <code>Morph Voice: MORPH CV</code>.<br><b>Was verändert sich?</b> Sanfte Meereswellen-Atmung oder analoges Vintage-Bandleiern!';
        case 'attenuverter:outA':
        case 'attenuverter:outB':
        case 'attenuverter:sumOut':
          return '💡 <b>Wohin stecken?</b> In jeden grünen Modulations-Eingang.<br><b>Was verändert sich?</b> Bändigt zu wilde LFOs auf feine Nuancen oder invertiert die Bewegung!';
        default:
          return '💡 <b>Tipp:</b> Verbinde diesen grünen Steuerspannungs-Ausgang mit einem grünen Modulations-Eingang eines Instruments oder Effekts.';
      }
    } else {
      switch (`${modType}:${portId}`) {
        case 'filter:cvCutoff':
          return '💡 <b>Woher nehmen?</b> Aus <code>Slow Random: CV OUT</code> oder <code>Slope Generator: ENV OUT</code>.<br><b>Was verändert sich?</b> Das Filter öffnet und schließt sich sanft wie das Atmen des Meeres!';
        case 'delay:cvTime':
          return '💡 <b>Woher nehmen?</b> Aus <code>Slow Random: CV OUT</code>.<br><b>Was verändert sich?</b> Erzeugt wehmütiges Lo-Fi Band-Leiern (Tape Pitch Flutter) wie eine alte Kassette!';
        case 'morph_voice:morphCv':
          return '💡 <b>Woher nehmen?</b> Aus <code>Slope Generator: ENV OUT</code> oder <code>Slow Random: CV OUT</code>.<br><b>Was verändert sich?</b> Fährt stufenlos von warmer Sinuswelle über Chöre zu schneidendem Metall!';
        case 'hybrid_perc:timbreCv':
          return '💡 <b>Woher nehmen?</b> Aus <code>Slow Random: CV OUT</code> oder <code>Slope Generator: ENV OUT</code>.<br><b>Was verändert sich?</b> Trommel schlägt mal wie Holz und mal wie eine schwere Metallglocke!';
        case 'resonator_garden:materialCv':
          return '💡 <b>Woher nehmen?</b> Aus <code>Slow Random: CV OUT</code> oder <code>Slope Generator: ENV OUT</code>.<br><b>Was verändert sich?</b> Schwingt zwischen weichen Cellosaiten, Marimbastäben und Glockenspiel!';
        case 'resonator_garden:dampCv':
          return '💡 <b>Woher nehmen?</b> Aus <code>Slope Generator: INV OUT</code>.<br><b>Was verändert sich?</b> Wechselt zwischen trocken gedämpftem Holz und sekundenlang nachsingenden Klangschalen!';
        case 'spectral_swarm:cohesionCv':
          return '💡 <b>Woher nehmen?</b> Aus <code>Slow Random: CV OUT</code> oder <code>Slope Generator: ENV OUT</code>.<br><b>Was verändert sich?</b> Hält alle 32 Teiltöne als Kirchenorgel-Akkord zusammen (100%) oder zerstreut sie in chaotische Cluster (0%)!';
        default:
          if (portId === 'vcaCv') {
            return '💡 <b>Woher nehmen?</b> Aus <code>Slope Generator: ENV OUT</code> (Swell) oder <code>INV OUT</code> (Ducking).<br><b>Was verändert sich?</b> Formt die Lautstärke dieser Stimme dynamisch.';
          } else if (portId === 'panCv') {
            return '💡 <b>Woher nehmen?</b> Aus <code>Slow Random: CV OUT</code>.<br><b>Was verändert sich?</b> Lässt den Sound langsam zwischen linkem und rechtem Lautsprecher hin- und herwandern.';
          }
          return '💡 <b>Tipp:</b> Empfängt stufenlose Steuerspannung, um diesen Parameter automatisch zu modulieren.';
      }
    }
  }

  handleJackHover(jackEl) {
    const key = jackEl.dataset.jackKey;
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
      mod: 'Modulation CV (Steuerspannung)',
      clock: 'Clock / Sync (Takt)',
      audio: 'Audiosignal',
    };
    const sigName = sigNames[jMeta.signal] || jMeta.signal.toUpperCase();

    // Aktive Verbindungen
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

    const lookupKey = `${mod.meta.type}:${portId}`;
    const specificHelp = JACK_HELP[lookupKey]?.desc || `Überträgt ein ${sigName}-Signal für ${mod.meta.title}.`;

    // Spezieller grüner Modulations-Tipp
    let greenTipHtml = '';
    if (jMeta.signal === 'mod') {
      const tipText = this.getGreenJackTips(mod.meta.type, portId, jMeta.type === 'out');
      greenTipHtml = `
        <div class="info-green-tips">
          <div class="green-tip-title">🟢 Modulations-Partner &amp; Klangwirkung:</div>
          <div class="green-tip-body">${tipText}</div>
        </div>
      `;
    }

    const html = `
      <div class="info-badge-row">
        <span class="info-badge ${jMeta.type}">${typeLabel}</span>
        <span class="info-badge sig" style="background:${sigColor}22; color:${sigColor}; border-color:${sigColor}55;">${sigName}</span>
      </div>
      <div class="info-title">${mod.meta.title} · <b>${jMeta.label}</b></div>
      <div class="info-desc">${specificHelp}</div>
      ${greenTipHtml}
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

    const normKey = labelText.toLowerCase().replace(/[^a-z]/g, '');
    let desc = KNOB_HELP[normKey];
    if (!desc) {
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

  // ───────────────────────── Handbuch & Tutorial Modal ──
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
              <h2>SYNTHBOARD Studio Handbuch &amp; Tutorials</h2>
              <p>Modulare Synthese, Live-Beispiele für jedes Tool &amp; Grüne Modulations-Kabel erklärt</p>
            </div>
          </div>
          <button class="guide-close" title="Schließen [Esc]">✕</button>
        </header>

        <nav class="guide-tabs">
          <button class="guide-tab-btn active" data-tab="tab-boards">🎛️ Vorlagen &amp; Boards</button>
          <button class="guide-tab-btn" data-tab="tab-tutorials">🎓 Modul-Tutorials (Mit Beispielen)</button>
          <button class="guide-tab-btn" data-tab="tab-green-guide">🟢 Grüne Buchsen &amp; Modulation</button>
          <button class="guide-tab-btn" data-tab="tab-cables">🔌 Patch-Kabel Basics</button>
          <button class="guide-tab-btn" data-tab="tab-zones">🎛️ Die 3 Rack-Zonen</button>
          <button class="guide-tab-btn" data-tab="tab-modules">📚 Modul-Lexikon (30 Module)</button>
          <button class="guide-tab-btn" data-tab="tab-recipes">⚡ Schnelleinstieg &amp; Rezepte</button>
        </nav>

        <main class="guide-body">
          <!-- TAB 0: BEISPIEL-BOARDS GALERIE -->
          <section id="tab-boards" class="guide-tab-pane active">
            <div class="green-guide-intro">
              <h3>🎛️ Boards &amp; Vorlagen</h3>
              <p>Jedes dieser Boards ist ein <b>vollständig aufgebautes und verdrahtetes modulares Synthesizer-Rack</b> für verschiedene Genres und Klangwelten – von meditativer Zen-Klangkunst über kosmische Granular-Wolken bis zu treibendem Berlin-School-Sequencer und Cyberpunk-Glitch. Klicke auf <i>„⚡ Dieses Board laden &amp; abspielen“</i>, um das gesamte Rack sofort zu starten!</p>
            </div>

            <div id="boards-container" class="boards-grid">
              <!-- Dynamisch durch renderBoardsGallery befüllt -->
            </div>
          </section>

          <!-- TAB 1: MODUL-TUTORIALS -->
          <section id="tab-tutorials" class="guide-tab-pane">
            <div class="green-guide-intro">
              <h3>🎓 Interaktive Mini-Tutorials &amp; Beispiele für alle großen Tools</h3>
              <p>Zu jedem großen Modul gibt es hier eine Erklärung und ein <b>konkretes klingendes Praxis-Beispiel</b>. Du erfährst genau, welche grünen Buchsen existieren, wo du sie reinsteckst und was sich dadurch am Klang verändert. Klicke auf <i>„⚡ Jetzt im Board testen“</i>, um jedes Beispiel mit einem Klick live im Rack anzuhören!</p>
            </div>

            <div id="tutorials-container" class="tut-grid">
              <!-- Dynamisch durch renderTutorials befüllt -->
            </div>
          </section>

          <!-- TAB 2: GRÜNE BUCHSEN GUIDE -->
          <section id="tab-green-guide" class="guide-tab-pane">
            <div class="green-guide-intro">
              <h3>🟢 Der ultimative Guide: Welche grünen Dinger kann man wo reinstecken?</h3>
              <p>In der modularen Synthese steht <b>Grün für Modulations-CV (Control Voltage / Steuerspannung)</b>. Im Gegensatz zu Gold (Trigger/Gate = Anschlag) oder Lila (Pitch = Notenhöhe) überträgt ein grünes Kabel eine <b>fließende Bewegung</b> – wie ein unsichtbarer Roboter, der für dich stufenlos Regler dreht!</p>
              
              <div class="green-rules-grid">
                <div class="green-rule-card">
                  <h5>1. Die grüne Grundregel</h5>
                  <p><b>Grüner Ausgang (OUT) ➜ Grüner Eingang (IN)</b>. Der Ausgang sendet eine Schwingung (z. B. LFO oder Hüllkurve), der Eingang moduliert damit Filter, Klangfarbe oder Dichte.</p>
                </div>
                <div class="green-rule-card">
                  <h5>2. Verzweigen ist Trumpf (Multiple)</h5>
                  <p>Du kannst denselben grünen Ausgang an <b>beliebig viele</b> grüne Eingänge gleichzeitig anschließen. So atmen mehrere Instrumente im selben organischen Takt!</p>
                </div>
                <div class="green-rule-card">
                  <h5>3. Modulationstiefe dosieren</h5>
                  <p>Klicke auf das Kabel oder nutze das Zwischenmodul <b>Attenuverter</b>, um die Modulationsstärke von zarten 5% bis zu extremen 100% einzustellen oder umzukehren.</p>
                </div>
              </div>
            </div>

            <h4 style="margin-top:24px; margin-bottom:8px; font-family:var(--font-display); letter-spacing:0.5px; color:#a7f3d0;">
              ⚡ Die 10 besten grünen Patch-Verbindungen (Mit 1 Klick ausprobieren)
            </h4>
            <p style="font-size:0.82rem; color:var(--text-dim); margin-bottom:14px;">Wähle eine Verbindung aus der Tabelle: Klicke auf <b>„⚡ Verbinden“</b>, um die Buchsen live im aktuellen Rack zu patchen und sofort den Unterschied zu hören!</p>

            <div id="green-matrix-container" class="green-matrix-table">
              <!-- Dynamisch durch renderGreenGuide befüllt -->
            </div>
          </section>

          <!-- TAB 3: KABEL BASICS -->
          <section id="tab-cables" class="guide-tab-pane">
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
              <div class="sig-row" style="border-left: 4px solid #10b981;">
                <span class="sig-pill" style="background:#10b98122; color:#10b981;">MODULATION (Grün)</span>
                <div class="sig-details">
                  <b>Fließende Steuerspannung (CV)</b> · Langsame Schwingungen von LFOs, Rauschgeneratoren oder Makro-Reglern. Moduliert Filter-Cutoff, Delay-Zeit, Oberton-Morphing oder Hall.
                </div>
              </div>

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
            </div>
          </section>

          <!-- TAB 4: ZONEN -->
          <section id="tab-zones" class="guide-tab-pane">
            <div class="guide-hero">
              <h3>Die 3 Rack-Zonen und der Signalfluss</h3>
              <p>SYNTHBOARD kombiniert freies modulares Kabel-Patching mit einer strukturierten Studio-Architektur inklusive getrenntem Stereo-Aux-Routing (Delay/Reverb Send) und frei sortierbarer Effektkette.</p>
            </div>

            <div class="zones-explainer">
              <div class="zone-box ctrl-border">
                <div class="zone-badge">Zone 1 (Oben)</div>
                <h4>🧠 Steuerung &amp; Generatoren</h4>
                <p>Master Clock, Clock Divider, Scene Conductor, Euklidische Rhythmen, Random Walk, Scale Quantizer, Slow Random, Slope Generator, Attenuverter und Macro Controller.</p>
                <div class="zone-note">Hier entsteht die musikalische Intelligenz: Takt, Zufall, Melodie und dynamische Modulationen werden über Kabel an die Instrumente weitergegeben.</div>
              </div>

              <div class="zone-connector">⬇ Steuer- &amp; Modulations-Impulse fließen per Kabel nach unten</div>

              <div class="zone-box src-border">
                <div class="zone-badge">Zone 2 (Mitte)</div>
                <h4>🔊 Klangquellen &amp; Instrumente</h4>
                <p>Morph Voice, Granular Cloud, Spectral Swarm, Resonator Garden, Hybrid Percussion, Drone Machine, Pluck Synth, FM Voice, Analog Bass, Drum Rack, Poly Keys.</p>
                <div class="zone-note">Jede Stimme besitzt einen eigenen Channel-Strip mit Pan, Delay Send und Reverb Send. Trockene Sounds bleiben punchy, während Drones tief im Hallraum schweben.</div>
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

          <!-- TAB 5: MODUL-LEXIKON -->
          <section id="tab-modules" class="guide-tab-pane">
            <div class="module-search-bar">
              <input type="text" id="guide-module-search" placeholder="🔍 Modul oder Funktion suchen (z. B. Granular, Slope, Resonator, Conductor)..." />
              <div class="filter-pills">
                <button class="pill active" data-cat="all">Alle</button>
                <button class="pill" data-cat="control">Steuerung</button>
                <button class="pill" data-cat="source">Klangquellen</button>
                <button class="pill" data-cat="effect">Effekte</button>
              </div>
            </div>

            <div id="guide-modules-list" class="guide-modules-list">
              <!-- Dynamisch befüllt aus MODULES mit Praxis-Beispielen -->
            </div>
          </section>

          <!-- TAB 6: REZEPTE & SCHNELLEINSTIEG -->
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
                  <li>Verbinde <code>Slow Random: CV OUT</code> ➜ <code>Filter: CUTOFF CV</code></li>
                  <li>Drehe am Slow Random den Regler <i>Rate</i> auf ca. 0.1 Hz und <i>Tiefe</i> auf 70%.</li>
                  <li>Das Filter atmet nun langsam wie eine Meereswelle.</li>
                </ol>
              </div>

              <div class="recipe-card" style="border-color: #8b5cf666;">
                <div class="recipe-tag" style="background: #8b5cf622; color: #a78bfa;">Rezept 4 · 40s Ambient Swell</div>
                <h4>Langsamer Drone-Swell &amp; Getrennte Sends</h4>
                <p>Erzeugt ein 40 Sekunden langes Anschwellen der Drone mit getrenntem Hall-Send, während Bass und Drums trocken bleiben.</p>
                <ol class="recipe-steps">
                  <li>Füge <b>Slope Generator</b> und <b>Drone Machine</b> hinzu.</li>
                  <li>Setze den Slope Generator auf Modus <code>loop</code>, <i>Rise</i> auf 12s und <i>Fall</i> auf 30s.</li>
                  <li>Verbinde <code>Slope Generator: ENV OUT</code> ➜ <code>Drone Machine: VCA CV</code>.</li>
                  <li>Stelle an der Drone Machine den <b>REVERB-Send</b> auf 70% und <b>DELAY-Send</b> auf 40%.</li>
                  <li>Die Drone schwillt sanft an und taucht tief in den Hallraum ab, während andere Stimmen präzise im Mix stehen.</li>
                </ol>
              </div>
            </div>

            <h3 style="margin-top:28px; margin-bottom:12px;">Hilfreiche Tastatur-Shortcuts</h3>
            <div class="shortcuts-grid">
              <div class="sc-item"><kbd>T</kbd><span>Modul-Tutorials &amp; Beispiele öffnen</span></div>
              <div class="sc-item"><kbd>G</kbd><span>Grüne Buchsen Guide öffnen</span></div>
              <div class="sc-item"><kbd>H</kbd> oder <kbd>?</kbd><span>Handbuch öffnen</span></div>
              <div class="sc-item"><kbd>I</kbd><span>Infoboxen an- / ausschalten</span></div>
              <div class="sc-item"><kbd>C</kbd><span>Kabel ein- / ausblenden</span></div>
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

    // Boards-Galerie, Tutorials, Green Guide & Modul-Lexikon rendern
    this.renderBoardsGallery();
    this.renderTutorials();
    this.renderGreenGuide();
    this.renderGuideModulesList();
    this.setupGuideSearch();
  }

  // ───────────────────────── Tutorial Content ──
  getTutorialData() {
    return [
      {
        id: 'tut-morph',
        title: 'Morph Voice: 8-facher Wavetable & Analog/Vokal/Metall',
        icon: '🧬',
        color: '#8b5cf6',
        badge: 'Multiquellen-Oszillator',
        desc: 'Die <b>Morph Voice</b> ist ein klanglich extrem vielseitiger Synthesizer. Er morpht nahtlos durch 8 Welten: Analogsäge, Dreieck, Rechteck, Vokalchor („Aah/Ooh“), Glockenspektrum, Transienten-Rauschen, FM-Metall und digitale Glitch-Artefakte.',
        greenJacks: [
          { id: 'morphCv', type: 'in', label: 'MORPH CV', desc: 'Fährt stufenlos durch die 8 Wellenformen.' },
          { id: 'timbreCv', type: 'in', label: 'TIMBRE CV', desc: 'Moduliert die Filter-Eckfrequenz und Brillanz.' },
          { id: 'envCv', type: 'in', label: 'ENV CV', desc: 'Skaliert Attack- und Release-Zeiten dynamisch in Echtzeit.' },
          { id: 'vcaCv', type: 'in', label: 'VCA CV', desc: 'Lautstärkesteuerung für Swells und Akzente.' },
        ],
        scheme: {
          fromMod: 'slope_generator',
          fromPort: 'envOut',
          fromLbl: 'Slope Generator: ENV OUT',
          toMod: 'morph_voice',
          toPort: 'morphCv',
          toLbl: 'Morph Voice: MORPH CV',
          sonicEffect: '<b>Hörbare Auswirkung:</b> Bei jedem Ton schwillt der Klang von einer reinen, warmen Sinuswelle über sprechende Vokalchöre zu scharfen Obertönen an – lebendiges Sounddesign wie bei teuren Modular-Wavetables!',
        },
        recipe: {
          name: 'Morphing Wavetable Voice',
          modules: ['master_clock', 'euclidean', 'random_walk', 'slope_generator', 'morph_voice', 'reverb'],
          cables: [
            { from: 'master_clock:clockOut', to: 'euclidean:clockIn', color: '#06b6d4' },
            { from: 'euclidean:gateOut', to: 'morph_voice:gateIn', color: '#fbbf24' },
            { from: 'euclidean:gateOut', to: 'random_walk:clockIn', color: '#fbbf24' },
            { from: 'random_walk:pitchOut', to: 'morph_voice:pitchIn', color: '#a855f7' },
            { from: 'euclidean:gateOut', to: 'slope_generator:trigIn', color: '#fbbf24' },
            { from: 'slope_generator:envOut', to: 'morph_voice:morphCv', color: '#10b981' },
          ],
          params: { slope_generator: { rise: 0.3, fall: 1.2 } },
        },
      },
      {
        id: 'tut-perc',
        title: 'Hybrid Percussion: Body, Snap, Metall & Ausklang',
        icon: '🥁',
        color: '#f97316',
        badge: 'Perkussions-Synthesizer',
        desc: '<b>Hybrid Percussion</b> erzeugt druckvolle Bässe, Kicks, Toms und Glitch-Percussion mit 4 Schichten: Tiefer Resonanz-Körper mit Tonhöhenabfall (Pitch Drop), Klick-Snap für Attack, physikalisches Material und Rauschen.',
        greenJacks: [
          { id: 'timbreCv', type: 'in', label: 'MATERIAL CV', desc: 'Blendet zwischen tiefem Holz/Fell und metallisch-schepperndem Amboss um.' },
          { id: 'lengthCv', type: 'in', label: 'LENGTH CV', desc: 'Verkürzt oder verlängert den Ausklang (von 20ms Klick bis zu 2s Grollen).' },
          { id: 'vcaCv', type: 'in', label: 'VCA CV', desc: 'Lautstärkesteuerung der Perkussion.' },
        ],
        scheme: {
          fromMod: 'slow_random',
          fromPort: 'cvOut',
          fromLbl: 'Slow Random: CV OUT',
          toMod: 'hybrid_perc',
          toPort: 'timbreCv',
          toLbl: 'Hybrid Percussion: MATERIAL CV',
          sonicEffect: '<b>Hörbare Auswirkung:</b> Jeder einzelne Schlag bekommt einen anderen physikalischen Charakter: Ein Schlag klingt wie ein dumpfer Holzblock, der nächste wie ein harter Schlag auf einen Metallkanister!',
        },
        recipe: {
          name: 'Dynamic Percussion Shifter',
          modules: ['master_clock', 'clock_divider', 'slow_random', 'hybrid_perc', 'delay'],
          cables: [
            { from: 'master_clock:clockOut', to: 'clock_divider:clockIn', color: '#06b6d4' },
            { from: 'clock_divider:outB', to: 'hybrid_perc:gateIn', color: '#fbbf24' },
            { from: 'slow_random:cvOut', to: 'hybrid_perc:timbreCv', color: '#10b981' },
          ],
          params: { hybrid_perc: { body: 0.8, snap: 0.45, drop: 0.6 } },
        },
      },
      {
        id: 'tut-resonator',
        title: 'Resonator Garden: 6 Physikalische Resonanzkörper',
        icon: '🌺',
        color: '#10b981',
        badge: 'Modale Synthese & Akustik',
        desc: 'Der <b>Resonator Garden</b> simuliert 6 miteinander gekoppelte physikalische Resonanzkörper (wie Harfensaiten, Marimbastäbe, Glasröhren oder tibetische Klangschalen). Jeder Impuls bringt sie harmonisch oder unharmonisch zum Klingen.',
        greenJacks: [
          { id: 'materialCv', type: 'in', label: 'MATERIAL CV', desc: 'Formt die Resonanzen zwischen schwingenden Saiten, Holz und Glockenspiel.' },
          { id: 'dampCv', type: 'in', label: 'DAMP CV', desc: 'Dämpfung: Hohe Werte klingen trocken wie Holz; niedrige Werte singen wie Glocken.' },
          { id: 'vcaCv', type: 'in', label: 'VCA CV', desc: 'Gesamtlautstärke der Resonanzen.' },
        ],
        scheme: {
          fromMod: 'slow_random',
          fromPort: 'cvOut',
          fromLbl: 'Slow Random: CV OUT',
          toMod: 'resonator_garden',
          toPort: 'dampCv',
          toLbl: 'Resonator Garden: DAMP CV',
          sonicEffect: '<b>Hörbare Auswirkung:</b> Das Instrument wechselt organisch zwischen kurzen, perkussiven Holztönen und sekundenlang schwebenden, meditativen Klangschalen-Resonanzen.',
        },
        recipe: {
          name: 'Acoustic Resonator Garden',
          modules: ['master_clock', 'euclidean', 'slow_random', 'resonator_garden', 'reverb'],
          cables: [
            { from: 'master_clock:clockOut', to: 'euclidean:clockIn', color: '#06b6d4' },
            { from: 'euclidean:gateOut', to: 'resonator_garden:gateIn', color: '#fbbf24' },
            { from: 'slow_random:cvOut', to: 'resonator_garden:dampCv', color: '#10b981' },
          ],
          params: { resonator_garden: { material: 0.55, modes: 8, decay: 2.6 } },
        },
      },
      {
        id: 'tut-swarm',
        title: 'Spectral Swarm: 32 Teiltöne & Schwarmsynthese',
        icon: '🐝',
        color: '#eab308',
        badge: 'Additive Schwarmsynthese',
        desc: 'Der <b>Spectral Swarm</b> steuert 32 autonome Sinus-Oszillatoren (Partials), die sich wie ein Vogelschwarm verhalten. Sie können eng im Chor zusammenfliegen (Akkord) oder sich wild in Frequenz und Raum verstreuen.',
        greenJacks: [
          { id: 'cohesionCv', type: 'in', label: 'COHESION CV', desc: '100% = reiner Kirchenorgel-Akkord; 0% = geisterhafte Dissonanz & Schwebungs-Cluster.' },
          { id: 'vcaCv', type: 'in', label: 'VCA CV', desc: 'Lautstärkesteuerung für Swells und Flächen.' },
        ],
        scheme: {
          fromMod: 'slope_generator',
          fromPort: 'envOut',
          fromLbl: 'Slope Generator: ENV OUT',
          toMod: 'spectral_swarm',
          toPort: 'cohesionCv',
          toLbl: 'Spectral Swarm: COHESION CV',
          sonicEffect: '<b>Hörbare Auswirkung:</b> Ein chaotisch flirrender, unheimlicher Cluster zieht sich über Sekunden wie durch Zauberhand zu einem strahlenden, sakralen Dur-Akkord zusammen!',
        },
        recipe: {
          name: 'Spectral Swarm Cohesion',
          modules: ['slope_generator', 'spectral_swarm', 'reverb'],
          cables: [
            { from: 'slope_generator:envOut', to: 'spectral_swarm:cohesionCv', color: '#10b981' },
          ],
          params: {
            slope_generator: { mode: 'loop', rise: 6, fall: 14 },
            spectral_swarm: { count: 18, inharm: 0.3, motion: 0.3 },
          },
        },
      },
      {
        id: 'tut-slope',
        title: 'Slope Generator: 0.05s bis 60s Rise/Fall & Inverted Ducking',
        icon: '📐',
        color: '#6366f1',
        badge: 'Funktionsgenerator & Hüllkurve',
        desc: 'Der <b>Slope Generator</b> erzeugt organische Anstiegs- (Rise) und Abfallkurven (Fall) von ultrakurzen 50 ms bis zu gigantischen 60 Sekunden! Er läuft wahlweise als getriggerte Hüllkurve oder als endloser LFO.',
        greenJacks: [
          { id: 'envOut', type: 'out', label: 'ENV OUT', desc: 'Normale positive Hüllkurve (0.0 bis 1.0) für epische Ambient-Swells.' },
          { id: 'invOut', type: 'out', label: 'INV OUT', desc: 'Invertierte Hüllkurve (1.0 bis 0.0) für automatisches Sidechain-Ducking!' },
          { id: 'modRise', type: 'in', label: 'RISE CV', desc: 'Moduliert die Anstiegszeit dynamisch von außen.' },
          { id: 'modFall', type: 'in', label: 'FALL CV', desc: 'Moduliert die Abfallzeit dynamisch von außen.' },
        ],
        scheme: {
          fromMod: 'slope_generator',
          fromPort: 'invOut',
          fromLbl: 'Slope Generator: INV OUT',
          toMod: 'pluck',
          toPort: 'vcaCv',
          toLbl: 'Pluck Synth: VCA CV',
          sonicEffect: '<b>Hörbare Auswirkung:</b> Automatisches Ducking! Sobald deine große Drone- oder Pad-Fläche anschwillt, regelt das invertierte Signal die Zupfnoten oder Drums dezent leiser. So bleibt der Mix absolut transparent.',
        },
        recipe: {
          name: 'Slope Generator Ducking System',
          modules: ['slope_generator', 'drone', 'pluck', 'reverb'],
          cables: [
            { from: 'slope_generator:envOut', to: 'drone:vcaCv', color: '#10b981' },
            { from: 'slope_generator:invOut', to: 'pluck:vcaCv', color: '#10b981' },
          ],
          params: { slope_generator: { mode: 'loop', rise: 6, fall: 12 } },
        },
      },
      {
        id: 'tut-attenuverter',
        title: 'Attenuverter & Dual Offset: Steuerspannungen bändigen',
        icon: '⚖️',
        color: '#ec4899',
        badge: 'Spannungs-Werkzeug',
        desc: 'Der <b>Attenuverter</b> ist das Feinsteuer-Werkzeug im Modular-Rack. Er kann Steuerspannungen dämpfen (z. B. auf sanfte 10%), komplett auf den Kopf stellen (negative Invertierung -100%) und mit einem Gleichspannungs-Offset verschieben.',
        greenJacks: [
          { id: 'inA', type: 'in', label: 'IN A', desc: 'Eingang für Modulationsspannung A.' },
          { id: 'outA', type: 'out', label: 'OUT A', desc: 'Skalierter und versetzter Ausgang A.' },
          { id: 'sumOut', type: 'out', label: 'SUM OUT', desc: 'Summen-Ausgang (Kanal A + Kanal B zusammengemischt).' },
        ],
        scheme: {
          fromMod: 'slow_random',
          fromPort: 'cvOut',
          fromLbl: 'Slow Random: CV OUT',
          toMod: 'attenuverter',
          toPort: 'inA',
          toLbl: 'Attenuverter: IN A ➔ OUT A ➔ Filter',
          sonicEffect: '<b>Hörbare Auswirkung:</b> Wenn ein LFO das Filter zu weit aufreißt, drehst du am Attenuverter den Regler „Scale A“ auf 20%. Die Filteröffnung wird zu einem feinen, subtilen Glänzen gebändigt!',
        },
        recipe: {
          name: 'Attenuverted Subtle Filter Flutter',
          modules: ['slow_random', 'attenuverter', 'keys', 'filter'],
          cables: [
            { from: 'slow_random:cvOut', to: 'attenuverter:inA', color: '#10b981' },
            { from: 'attenuverter:outA', to: 'filter:cvCutoff', color: '#10b981' },
          ],
          params: { attenuverter: { scaleA: 0.25 } },
        },
      },
      {
        id: 'tut-drone',
        title: 'Drone Machine: 6 Oszillatoren, FM & Shimmer',
        icon: '🌌',
        color: '#6366f1',
        badge: 'Klangquelle & Soundscapes',
        desc: 'Die <b>Drone Machine</b> erzeugt monumentale, schwebende Akkord-Cluster mit 6 Oszillatoren, Schwebung, Sub-Bass und analoger Frequenzmodulation. Perfekt für Ambient und Filmmusik.',
        greenJacks: [
          { id: 'vcaCv', type: 'in', label: 'VCA CV', desc: 'Lautstärkesteuerung für Swells und Atem-Effekte.' },
          { id: 'cvTone', type: 'in', label: 'TONE CV', desc: 'Filteröffnung & Klangfarben-Modulation.' },
          { id: 'cvFm', type: 'in', label: 'FM CV', desc: 'Moduliert FM-Tiefe und Oberton-Schwebung.' },
        ],
        scheme: {
          fromMod: 'slow_random',
          fromPort: 'cvOut',
          fromLbl: 'Slow Random: CV OUT',
          toMod: 'drone',
          toPort: 'cvTone',
          toLbl: 'Drone Machine: TONE CV',
          sonicEffect: '<b>Hörbare Auswirkung:</b> Das Obertongewebe des Drones beginnt wie Sonnenstrahlen durch Nebel langsam auf- und abzuschwingen.',
        },
        recipe: {
          name: 'Evolving Drone Soundscape',
          modules: ['slow_random', 'drone', 'delay', 'reverb'],
          cables: [
            { from: 'slow_random:cvOut', to: 'drone:cvTone', color: '#10b981' },
          ],
          params: { drone: { spread: 14, fm: 0.12, tone: 950 } },
        },
      },
      {
        id: 'tut-pluck',
        title: 'Pluck Synth: Akustische Harfen & Kalimbas',
        icon: '🪕',
        color: '#10b981',
        badge: 'Physisches Saitenmodell',
        desc: 'Der <b>Pluck Synth</b> nutzt physikalische Saiten- und Stab-Simulation (Karplus-Strong). Jeder Anschlag klingt organisch hölzern, gläsern oder metallisch gezupft.',
        greenJacks: [
          { id: 'modCutoff', type: 'in', label: 'FILTER CV', desc: 'Moduliert die Zupfhärte und Dämpfung der Saite.' },
          { id: 'vcaCv', type: 'in', label: 'VCA CV', desc: 'Lautstärke für Ducking oder Akzente.' },
        ],
        scheme: {
          fromMod: 'random_walk',
          fromPort: 'pitchOut',
          fromLbl: 'Random Walk: PITCH',
          toMod: 'pluck',
          toPort: 'pitchIn',
          toLbl: 'Pluck Synth: PITCH IN',
          sonicEffect: '<b>Hörbare Auswirkung:</b> Erzeugt fließende, nie endende Harfenläufe, die sich musikalisch sinnvoll in der Tonleiter bewegen.',
        },
        recipe: {
          name: 'Generative Pluck Harp',
          modules: ['master_clock', 'euclidean', 'random_walk', 'pluck', 'delay', 'reverb'],
          cables: [
            { from: 'master_clock:clockOut', to: 'euclidean:clockIn', color: '#06b6d4' },
            { from: 'euclidean:gateOut', to: 'random_walk:clockIn', color: '#fbbf24' },
            { from: 'random_walk:pitchOut', to: 'pluck:pitchIn', color: '#a855f7' },
            { from: 'random_walk:gateOut', to: 'pluck:gateIn', color: '#fbbf24' },
          ],
          params: { pluck: { decay: 0.85, tone: 2200 } },
        },
      },
      {
        id: 'tut-bass',
        title: 'Analog Bass: Acid 303 & resonanter Filter-Punch',
        icon: '⚡',
        color: '#f59e0b',
        badge: 'Monophoner Bass-Synth',
        desc: 'Der <b>Analog Bass</b> liefert tief drückende Sub-Bässe und den legendären kreischenden Acid-Filter-Sound mit saftiger Selbstoszillation.',
        greenJacks: [
          { id: 'modCutoff', type: 'in', label: 'CUTOFF CV', desc: 'Moduliert die Filteröffnung von außen in Echtzeit.' },
          { id: 'vcaCv', type: 'in', label: 'VCA CV', desc: 'Lautstärke für dynamisches Spiel.' },
        ],
        scheme: {
          fromMod: 'slow_random',
          fromPort: 'cvOut',
          fromLbl: 'Slow Random: CV OUT',
          toMod: 'bass',
          toPort: 'modCutoff',
          toLbl: 'Analog Bass: CUTOFF CV',
          sonicEffect: '<b>Hörbare Auswirkung:</b> Das Filter quietscht und öffnet sich im Takt der LFO-Bewegung – unverfälschte 303-Atmosphäre!',
        },
        recipe: {
          name: 'Resonante 303 Bassline',
          modules: ['master_clock', 'clock_divider', 'slow_random', 'bass', 'delay'],
          cables: [
            { from: 'master_clock:clockOut', to: 'clock_divider:clockIn', color: '#06b6d4' },
            { from: 'clock_divider:outB', to: 'bass:gateIn', color: '#fbbf24' },
            { from: 'slow_random:cvOut', to: 'bass:modCutoff', color: '#10b981' },
          ],
          params: { bass: { cutoff: 450, reso: 6.0, env: 0.7 } },
        },
      },
      {
        id: 'tut-drums',
        title: 'Drum Rack: 4-Stimmige analoge Beatbox',
        icon: '🥁',
        color: '#ef4444',
        badge: 'Rhythmus-Zentrale',
        desc: 'Das <b>Drum Rack</b> vereint 4 klassische analoge Drum-Stimmen: Druckvolle Kick mit Bass-Drop, knackige Snare mit Rauschteppich, metallische Hi-Hat und Wood-Percussion.',
        greenJacks: [
          { id: 'vcaCv', type: 'in', label: 'VCA CV', desc: 'Gesamtlautstärke des Drum Racks für Beat-Fades.' },
          { id: 'panCv', type: 'in', label: 'PAN CV', desc: 'Stereo-Panoramabewegung.' },
        ],
        scheme: {
          fromMod: 'clock_divider',
          fromPort: 'outB',
          fromLbl: 'Clock Divider: /4',
          toMod: 'drum_rack',
          toPort: 'trigKick',
          toLbl: 'Drum Rack: KICK IN',
          sonicEffect: '<b>Hörbare Auswirkung:</b> Ein felsenfest getakteter 4-on-the-Floor Club-Beat mit sauber getrennter Snare auf Schlag 2 und 4.',
        },
        recipe: {
          name: 'Solid Clock-Divided Beat',
          modules: ['master_clock', 'clock_divider', 'drum_rack', 'reverb'],
          cables: [
            { from: 'master_clock:clockOut', to: 'clock_divider:clockIn', color: '#06b6d4' },
            { from: 'clock_divider:outB', to: 'drum_rack:trigKick', color: '#fbbf24' },
            { from: 'clock_divider:outC', to: 'drum_rack:trigSnare', color: '#fbbf24' },
            { from: 'clock_divider:outA', to: 'drum_rack:trigHat', color: '#fbbf24' },
          ],
          params: { master_clock: { tempo: 112 } },
        },
      },
    ];
  }

  // ───────────────────────── Green Matrix Data ──
  getGreenMatrixData() {
    return [
      {
        fromMod: 'slow_random',
        fromPort: 'cvOut',
        fromName: 'Slow Random LFO',
        fromJack: 'CV OUT',
        toMod: 'filter',
        toPort: 'cvCutoff',
        toName: 'Analog Filter',
        toJack: 'CUTOFF CV',
        effect: '<b>Sanfte Filter-Atmung:</b> Lässt den gesamten Frequenzbereich wie ruhige Meereswellen auf- und absteigen.',
        params: { slow_random: { rate: 0.08, depth: 0.7 } },
      },
      {
        fromMod: 'slope_generator',
        fromPort: 'envOut',
        fromName: 'Slope Generator',
        fromJack: 'ENV OUT',
        toMod: 'drone',
        toPort: 'vcaCv',
        toName: 'Drone Machine',
        toJack: 'VCA CV',
        effect: '<b>40-Sekunden Ambient-Swell:</b> Ein gigantisches, minutenlanges Anwachsen der Akkorde bis zum strahlenden Höhepunkt.',
        params: { slope_generator: { mode: 'loop', rise: 12, fall: 25 } },
      },
      {
        fromMod: 'slope_generator',
        fromPort: 'invOut',
        fromName: 'Slope Generator',
        fromJack: 'INV OUT',
        toMod: 'pluck',
        toPort: 'vcaCv',
        toName: 'Pluck Synth',
        toJack: 'VCA CV',
        effect: '<b>Sidechain-Ducking (Gegenbewegung):</b> Zupftöne treten leise zurück, während die Drone-Fläche anschwillt.',
        params: { slope_generator: { mode: 'loop', rise: 8, fall: 16 } },
      },
      {
        fromMod: 'slope_generator',
        fromPort: 'envOut',
        fromName: 'Slope Generator',
        fromJack: 'ENV OUT',
        toMod: 'spectral_swarm',
        toPort: 'cohesionCv',
        toName: 'Spectral Swarm',
        toJack: 'COHESION CV',
        effect: '<b>Schwarm-Bändigung:</b> Zieht 32 chaotisch flirrende Teiltöne zu einem strahlenden Kirchenorgel-Akkord zusammen.',
        params: { slope_generator: { mode: 'loop', rise: 6, fall: 14 } },
      },
      {
        fromMod: 'slow_random',
        fromPort: 'cvOut',
        fromName: 'Slow Random LFO',
        fromJack: 'CV OUT',
        toMod: 'delay',
        toPort: 'cvTime',
        toName: 'Tape Delay',
        toJack: 'TIME CV',
        effect: '<b>Vintage Band-Leiern (Pitch Warble):</b> Erzeugt das typische, wehmütige Lo-Fi Kassetten-Leiern alter Tonbänder.',
        params: { delay: { mix: 0.4, feedback: 0.5 } },
      },
      {
        fromMod: 'slow_random',
        fromPort: 'cvOut',
        fromName: 'Slow Random LFO',
        fromJack: 'CV OUT',
        toMod: 'resonator_garden',
        toPort: 'dampCv',
        toName: 'Resonator Garden',
        toJack: 'DAMP CV',
        effect: '<b>Resonanz-Dämpfung:</b> Wechselt zwischen trocken gedämpften Holzstäben und sekundenlang nachsingenden Klangschalen.',
        params: { resonator_garden: { modes: 8, decay: 2.8 } },
      },
      {
        fromMod: 'slow_random',
        fromPort: 'cvOut',
        fromName: 'Slow Random LFO',
        fromJack: 'CV OUT',
        toMod: 'slope_generator',
        toPort: 'modRise',
        toName: 'Slope Generator',
        toJack: 'RISE CV',
        effect: '<b>Selbstmodulierende Hüllkurve:</b> Die Anstiegszeit variiert von Schlag zu Schlag selbstständig – unendliche Variation!',
        params: { slope_generator: { mode: 'loop' } },
      },
    ];
  }

  renderBoardsGallery() {
    const container = this.guideModalEl.querySelector('#boards-container');
    if (!container) return;

    const templatesList = Object.entries(TEMPLATES);
    container.innerHTML = templatesList.map(([key, t]) => {
      const moduleCount = t.state?.modules?.length || 0;
      const cableCount = t.state?.cables?.length || 0;
      const moduleNames = (t.state?.modules || []).map(m => MODULES[m.type]?.title || m.type);
      const uniqueNames = [...new Set(moduleNames)];
      const pillsHtml = uniqueNames.slice(0, 7).map(n => `<span class="b-mod-pill">${n}</span>`).join('') + (uniqueNames.length > 7 ? `<span class="b-mod-pill more">+${uniqueNames.length - 7} mehr</span>` : '');

      return `
        <article class="board-card" data-board-key="${key}">
          <header class="board-card-head">
            <div class="board-card-title-wrap">
              <h4>${t.name}</h4>
              <span class="board-card-badge">${t.category || 'Vorlage'}</span>
            </div>
          </header>
          <p class="board-card-desc">${t.description || 'Vollständig konfiguriertes Modular-Board mit speziellem Klangcharakter.'}</p>
          <div class="board-card-stats">
            <span>📦 ${moduleCount} Module</span>
            <span>🔌 ${cableCount} Patchkabel</span>
          </div>
          <div class="board-card-pills">
            ${pillsHtml}
          </div>
          <div class="board-card-action">
            <button class="btn-load-board" data-board-key="${key}">⚡ Dieses Board laden &amp; abspielen</button>
          </div>
        </article>
      `;
    }).join('');

    container.querySelectorAll('.btn-load-board').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.boardKey;
        this.options.onStartAudio?.();
        if (this.options.onLoadTemplate) {
          this.options.onLoadTemplate(key);
        }
        this.closeGuide();
        this.options.onToast?.(`Board geladen: ${TEMPLATES[key]?.name || key} ✓`);
      });
    });
  }

  renderTutorials() {
    const container = this.guideModalEl.querySelector('#tutorials-container');
    if (!container) return;

    const tuts = this.getTutorialData();
    container.innerHTML = tuts.map(t => {
      const jacksHtml = t.greenJacks.map(j => `
        <div class="green-jack-item">
          <span class="green-chip ${j.type}">${j.label}</span>
          <span>${j.desc}</span>
        </div>
      `).join('');

      return `
        <article class="tut-card" style="--tut-color:${t.color};" id="${t.id}">
          <header class="tut-head">
            <div class="tut-title-wrap">
              <span class="tut-icon">${t.icon}</span>
              <h4>${t.title}</h4>
            </div>
            <span class="tut-badge">${t.badge}</span>
          </header>

          <p class="tut-desc">${t.desc}</p>

          <div class="green-jacks-box">
            <div class="tut-section-lbl">🟢 Grüne Modulations-Buchsen dieses Moduls:</div>
            ${jacksHtml}
          </div>

          <div class="tut-patch-scheme">
            <div class="tut-section-lbl">🔌 Wo reinstecken &amp; was verändert sich?</div>
            <div class="scheme-cable">
              <span class="green-chip out">${t.scheme.fromLbl}</span>
              <span class="scheme-arrow">➔</span>
              <span class="green-chip in">${t.scheme.toLbl}</span>
            </div>
            <div class="sonic-effect">${t.scheme.sonicEffect}</div>
          </div>

          <div class="tut-action-bar">
            <button class="btn-auto-patch" data-tut-id="${t.id}">⚡ Jetzt im Board testen</button>
          </div>
        </article>
      `;
    }).join('');

    // Click-Handler für "Jetzt im Board testen"
    container.querySelectorAll('.btn-auto-patch').forEach(btn => {
      btn.addEventListener('click', () => {
        const tutId = btn.dataset.tutId;
        const tut = tuts.find(x => x.id === tutId);
        if (tut?.recipe) {
          this.applyTutorialPreset(tut.recipe);
          btn.classList.add('done');
          btn.innerHTML = '✓ Im Rack aktiv!';
          setTimeout(() => {
            btn.classList.remove('done');
            btn.innerHTML = '⚡ Jetzt im Board testen';
          }, 3000);
        }
      });
    });
  }

  renderGreenGuide() {
    const container = this.guideModalEl.querySelector('#green-matrix-container');
    if (!container) return;

    const matrix = this.getGreenMatrixData();
    container.innerHTML = matrix.map((row, idx) => `
      <div class="matrix-row">
        <div class="matrix-socket">
          <span class="m-mod">${row.fromName}</span>
          <span class="m-jack">🟢 ${row.fromJack} (OUT)</span>
        </div>
        <div class="matrix-arrow">➔</div>
        <div class="matrix-socket">
          <span class="m-mod">${row.toName}</span>
          <span class="m-jack">🟢 ${row.toJack} (IN)</span>
        </div>
        <div class="matrix-effect">${row.effect}</div>
        <div class="matrix-action">
          <button class="btn-auto-patch" data-matrix-idx="${idx}">⚡ Verbinden</button>
        </div>
      </div>
    `).join('');

    container.querySelectorAll('.btn-auto-patch').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.matrixIdx, 10);
        const row = matrix[idx];
        if (row) {
          this.connectGreenPair(row.fromMod, row.fromPort, row.toMod, row.toPort, row.params);
          btn.classList.add('done');
          btn.innerHTML = '✓ Verbunden!';
          setTimeout(() => {
            btn.classList.remove('done');
            btn.innerHTML = '⚡ Verbinden';
          }, 2500);
        }
      });
    });
  }

  connectGreenPair(fromModType, fromPort, toModType, toPort, params = {}) {
    // 1. Module sicherstellen
    let fromMod = this.engine.findByType(fromModType);
    if (!fromMod) fromMod = this.engine.add(fromModType);

    let toMod = this.engine.findByType(toModType);
    if (!toMod) toMod = this.engine.add(toModType);

    if (!fromMod || !toMod) {
      this.notify('Fehler beim Verbinden der Module');
      return;
    }

    // 2. Parameter setzen
    Object.entries(params).forEach(([mType, pObj]) => {
      const m = this.engine.findByType(mType);
      if (m) {
        Object.entries(pObj).forEach(([pKey, pVal]) => m.setParam?.(pKey, pVal));
        m.refreshKnobs?.();
      }
    });

    // 3. Grünes Kabel patchen
    this.engine.patchSystem.connect(fromMod.id, fromPort, toMod.id, toPort, '#10b981', 1);

    // 4. UI synchronisieren
    this.onRackModified?.();
    this.onStartAudio?.();

    // 5. Jacks optisch aufleuchten lassen
    setTimeout(() => {
      this.patchBay.flashJack(`${fromMod.id}:${fromPort}`);
      this.patchBay.flashJack(`${toMod.id}:${toPort}`);
    }, 80);

    const fromLabel = fromMod.meta.jacks?.find(j => j.id === fromPort)?.label || fromPort;
    const toLabel = toMod.meta.jacks?.find(j => j.id === toPort)?.label || toPort;
    this.notify(`🟢 Verbunden: ${fromMod.meta.title} (${fromLabel}) ➜ ${toMod.meta.title} (${toLabel})`);
  }

  applyTutorialPreset(recipe) {
    if (!recipe) return;

    // 1. Benötigte Module hinzufügen falls noch nicht im Rack
    (recipe.modules || []).forEach(type => {
      if (!this.engine.findByType(type)) {
        this.engine.add(type);
      }
    });

    // 2. Parameter einstellen
    if (recipe.params) {
      Object.entries(recipe.params).forEach(([type, pMap]) => {
        const m = this.engine.findByType(type);
        if (m) {
          Object.entries(pMap).forEach(([k, v]) => m.setParam?.(k, v));
          m.refreshKnobs?.();
        }
      });
    }

    // 3. Kabel patchen
    (recipe.cables || []).forEach(c => {
      const [fromType, fromPort] = c.from.split(':');
      const [toType, toPort] = c.to.split(':');
      const fromMod = this.engine.findByType(fromType);
      const toMod = this.engine.findByType(toType);
      if (fromMod && toMod) {
        this.engine.patchSystem.connect(fromMod.id, fromPort, toMod.id, toPort, c.color || '#10b981', 1);
      }
    });

    // 4. UI benachrichtigen
    this.onRackModified?.();
    this.onStartAudio?.();

    // 5. Kabel visuell flashen
    (recipe.cables || []).forEach(c => {
      const [fromType, fromPort] = c.from.split(':');
      const [toType, toPort] = c.to.split(':');
      const fromMod = this.engine.findByType(fromType);
      const toMod = this.engine.findByType(toType);
      if (fromMod && toMod) {
        setTimeout(() => {
          this.patchBay.flashJack(`${fromMod.id}:${fromPort}`);
          this.patchBay.flashJack(`${toMod.id}:${toPort}`);
        }, 120);
      }
    });

    this.notify(`⚡ Setup aktiviert: ${recipe.name}`);
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

      // Praxis-Beispiel für jedes Modul
      const ex = MODULE_EXAMPLES[M.type];
      const exHtml = ex ? `
        <div class="g-mod-example">
          <div class="g-mod-example-head">
            <span class="ex-lbl">💡 Praxis-Beispiel:</span>
            <button class="btn-example-load" data-mod-type="${M.type}">⚡ Beispiel anhören</button>
          </div>
          <p class="ex-text">${ex.desc}</p>
          <div class="ex-wiring"><b>Verdrahtung:</b> <code>${ex.wiring}</code></div>
        </div>
      ` : '';

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
          ${exHtml}
        </article>
      `;
    }).join('');

    // Click-Handler für die "⚡ Beispiel anhören" Buttons im Lexikon
    container.querySelectorAll('.btn-example-load').forEach(btn => {
      btn.addEventListener('click', () => {
        const mType = btn.dataset.modType;
        const ex = MODULE_EXAMPLES[mType];
        if (ex?.recipe) {
          this.applyTutorialPreset(ex.recipe);
          btn.classList.add('done');
          btn.innerHTML = '✓ Im Rack aktiv!';
          setTimeout(() => {
            btn.classList.remove('done');
            btn.innerHTML = '⚡ Beispiel anhören';
          }, 3000);
        }
      });
    });
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
