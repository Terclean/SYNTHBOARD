// SYNTHBOARD – Interactive Info, Tutorial & Studio Guide System
// Fully bilingual (EN / DE), aligned with SYNTHBOARD Studio hardware styling,
// canonical jack IDs, and versioned JSON patch presets (version: 2 + name).

import { SIGNAL_COLORS } from '../modules/patchSystem.js';
import { MODULES, TEMPLATES } from '../modules/index.js';
import { applyTranslations, getLang, onLangChange, t, tr } from './i18n.js';

function getJackHelpMap() {
  return {
    // Master Clock
    'master_clock:clockOut': {
      name: 'Clock 1/16',
      desc: t('Gibt kontinuierliche Sechzehntel-Taktimpulse aus. Ideal für Sequenzer, Arps und Drum-Trigger.', 'Outputs continuous 16th-note clock pulses. Ideal for sequencers, arpeggiators, and triggers.'),
    },
    'master_clock:div2Out': {
      name: 'Clock 1/8',
      desc: t('Gibt Achtel-Taktimpulse aus (halbe Sechzehntel-Geschwindigkeit).', 'Outputs 8th-note clock pulses (half 16th-note rate).'),
    },
    'master_clock:div4Out': {
      name: 'Clock 1/4',
      desc: t('Gibt Viertel-Taktimpulse aus – perfekter Four-on-the-Floor oder Sidechain-Puls.', 'Outputs quarter-note pulses – ideal for four-on-the-floor kicks or sidechain pumping.'),
    },
    'master_clock:barOut': {
      name: '1 Bar',
      desc: t('Gibt einmal pro 4/4-Takt einen Impuls aus. Ideal für Akkordwechsel und Snapshot Controller BAR IN.', 'Fires once per 4/4 bar. Essential for Chord Glide progressions and Snapshot Controller BAR IN.'),
    },
    'master_clock:resetOut': {
      name: 'Reset Out',
      desc: t('Sendet beim Starten der Clock einen Reset-Impuls an Sequenzer und Teiler.', 'Sends a sync reset pulse whenever playback starts.'),
    },

    // Clock Divider
    'clock_divider:clockIn': {
      name: 'CLOCK IN',
      desc: t('Empfängt den Master-Takt und teilt ihn in /2, /3, /4, /8 und /16 auf.', 'Receives master clock ticks and divides them into /2, /3, /4, /8, and /16 outputs.'),
    },
    'clock_divider:resetIn': {
      name: 'RESET IN',
      desc: t('Setzt alle internen Teilerzähler synchron auf Schritt 1 zurück.', 'Resets all division counters synchronously back to beat 1.'),
    },
    'clock_divider:div2Out': { name: '/2 (1/8)', desc: t('Achtel-Taktteiler für Hi-Hats, Basslines oder Arps.', '8th-note division for hi-hats, basslines, or arps.') },
    'clock_divider:div3Out': { name: '/3 (Triol)', desc: t('Triolischer Taktteiler (Polyrhythmik gegen 4/4).', 'Triplet division for polymetric phrasing over 4/4.') },
    'clock_divider:div4Out': { name: '/4 (1/4)', desc: t('Viertel-Taktteiler für Kicks oder Sidechain-Hüllkurven.', 'Quarter-note division for kicks or sidechain envelopes.') },
    'clock_divider:div8Out': { name: '/8 (1/2)', desc: t('Halbe Noten – ideal für Snares auf Schlag 2/4 oder Phrasenwechsel.', 'Half-note division for snares or melodic phrase changes.') },
    'clock_divider:div16Out': { name: '/16 (1 Bar)', desc: t('Ein Impuls pro vollem 4/4-Takt.', 'One pulse per complete 4/4 bar.') },

    // Euclidean
    'euclidean:clockIn': { name: 'CLOCK IN', desc: t('Schreitet mit jedem Taktimpuls einen Schritt im Muster voran.', 'Advances the Euclidean pattern by one step per incoming clock pulse.') },
    'euclidean:resetIn': { name: 'RESET IN', desc: t('Setzt das Muster sofort auf Schritt 1 zurück.', 'Resets step pointer immediately to step 1.') },
    'euclidean:trigOut': { name: 'TRIG OUT', desc: t('Sendet rhythmische Treffer nach dem Björklund-Algorithmus.', 'Outputs rhythmic hit triggers distributed by the Björklund algorithm.') },
    'euclidean:invOut': { name: 'INV OUT', desc: t('Komplementär-Ausgang: Feuert exakt auf den Pausen des Hauptmusters.', 'Complementary output: fires strictly on the rests between main hits.') },

    // Probability Gate
    'prob_gate:trigIn': { name: 'TRIG IN', desc: t('Eingehende Trigger werden per Wahrscheinlichkeit (Chance) weitergeleitet.', 'Incoming triggers are routed probabilistically based on the Chance control.') },
    'prob_gate:trigOut': { name: 'PASSED OUT', desc: t('Feuert, wenn der Trigger den Wahrscheinlichkeitstest besteht.', 'Fires when the incoming trigger passes the probability roll.') },
    'prob_gate:altOut': { name: 'SKIPPED OUT', desc: t('Feuert alternativ, wenn der Hauptweg übersprungen wurde (ideal für zweite Stimmen).', 'Alternative output firing whenever the main branch is skipped.') },

    // Random Walk
    'random_walk:clockIn': { name: 'CLOCK IN', desc: t('Macht pro Taktimpuls einen gebundenen Notenschritt.', 'Advances one scale-bound melodic step per clock trigger.') },
    'random_walk:resetIn': { name: 'RESET IN', desc: t('Setzt die Melodie zurück auf den Grundton.', 'Returns sequence immediately to the root pitch.') },
    'random_walk:pitchOut': { name: 'PITCH OUT', desc: t('1V/Okt Tonhöhe in der gewählten Tonleiter.', '1V/Oct pitch CV locked to the selected scale.') },
    'random_walk:gateOut': { name: 'GATE OUT', desc: t('Trigger-Impuls zu jeder neuen Note.', 'Gate trigger emitted on every step.') },

    // Quantizer
    'quantizer:pitchIn': { name: 'PITCH IN', desc: t('Empfängt freie Steuerspannung oder Roh-Melodien.', 'Accepts unquantized pitch CV or modulation waves.') },
    'quantizer:trigIn': { name: 'TRIG IN', desc: t('Rastet den Tonhöhenwert exakt im Takt ein.', 'Samples and quantizes incoming pitch synchronously on clock.') },
    'quantizer:pitchOut': { name: 'PITCH OUT', desc: t('Skalenrein eingerastete 1V/Okt Tonhöhe.', 'Scale-locked 1V/Oct pitch CV.') },
    'quantizer:gateOut': { name: 'GATE OUT', desc: t('Gibt bei jedem erkannten Notenwechsel einen Gate-Impuls aus.', 'Fires a trigger whenever the quantized note changes.') },

    // Slow Random
    'slow_random:trigIn': { name: 'S&H CLOCK', desc: t('Im Stepped-Modus tastet jeder Trigger einen neuen Zufallswert ab.', 'In stepped mode, samples a new random voltage on each trigger.') },
    'slow_random:cvOut': { name: 'CV OUT', desc: t('Organisch driftende Steuerspannung für Filter, Felt, Bow oder Delay.', 'Slow organic LFO CV for filters, felt hammer, bow pressure, or tape wobble.') },
    'slow_random:invOut': { name: 'INV OUT', desc: t('Gegenläufige Steuerspannung für Balance- und Stereo-Bewegungen.', 'Inverted modulation voltage for complementary stereo or filter sweeps.') },

    // Macro
    'macro:densityCv': { name: 'DENSITY CV', desc: t('Steuerspannung für Klangdichte und Arpeggio-/Schwarm-Fülle.', 'Performance macro voltage mapped to density parameters.') },
    'macro:variationCv': { name: 'VARIATION CV', desc: t('Steuerspannung für Timbre-Abwechslung.', 'Performance macro voltage mapped to tonal variation.') },
    'macro:motionCv': { name: 'MOTION CV', desc: t('Steuerspannung für Bewegung, Cutoff und Raumtiefe.', 'Performance macro voltage mapped to modulation depth or stereo motion.') },

    // Slope Generator
    'slope_generator:trigIn': { name: 'TRIG IN', desc: t('Löst einen Rise/Fall-Zyklus im Trigger-Modus aus.', 'Triggers a single Rise/Fall envelope cycle.') },
    'slope_generator:gateIn': { name: 'GATE IN', desc: t('Hält den Scheitelpunkt im Gate-Modus, solange das Gate anliegt.', 'Holds sustain peak while Gate remains high in Gate ASR mode.') },
    'slope_generator:modRise': { name: 'RISE CV', desc: t('Moduliert die Anstiegszeit (0.01s–180s) dynamisch.', 'Modulates rise time (0.01s–180s) externally.') },
    'slope_generator:modFall': { name: 'FALL CV', desc: t('Moduliert die Abfallzeit (0.01s–180s) dynamisch.', 'Modulates fall time (0.01s–180s) externally.') },
    'slope_generator:envOut': { name: 'ENV OUT', desc: t('Positive Hüllkurve (0.0 bis 1.0) für Swells und Filterfahrten.', 'Positive envelope CV (0.0–1.0) for swells and filter arcs.') },
    'slope_generator:invOut': { name: 'INV OUT', desc: t('Invertierte Hüllkurve (1.0 bis 0.0) – perfekt für Sidechain-Ducking.', 'Inverted envelope CV (1.0–0.0) for pump-free or techno sidechain ducking.') },
    'slope_generator:eorOut': { name: 'EOR OUT', desc: t('Trigger am Ende der Anstiegsphase (End of Rise).', 'Gate trigger emitted when the rise stage hits peak.') },
    'slope_generator:eofOut': { name: 'EOF OUT', desc: t('Trigger am Ende der Abfallphase (End of Fall) für Ablauf-Kaskaden.', 'Gate trigger emitted when the fall stage returns to zero – builds trigger cascades.') },
    'slope_generator:eocOut': { name: 'EOC OUT', desc: t('Trigger am kompletten Zyklus-Ende.', 'Gate pulse fired upon full cycle completion.') },

    // Attenuverter
    'attenuverter:inA': { name: 'IN A', desc: t('CV-Eingang für Kanal A.', 'Control voltage input for channel A.') },
    'attenuverter:outA': { name: 'OUT A', desc: t('Skalierter, invertierter (-100%..+100%) und offset-verschobener Ausgang A.', 'Attenuverted (-100% to +100%) and offset-shifted CV output A.') },
    'attenuverter:inB': { name: 'IN B', desc: t('CV-Eingang für Kanal B.', 'Control voltage input for channel B.') },
    'attenuverter:outB': { name: 'OUT B', desc: t('Skalierter und verschobener Ausgang B.', 'Attenuverted and offset-shifted CV output B.') },
    'attenuverter:sumOut': { name: 'SUM OUT', desc: t('Misch-Ausgang aus Kanal A + Kanal B.', 'Summing node combining channel A + channel B voltages.') },

    // CV Logic & Switch
    'logic_switch:gateIn': { name: 'GATE IN', desc: t('Eingehender Trigger für die A/B-Weiche.', 'Trigger stream routed between PASS A and INV B.') },
    'logic_switch:ctrlCv': { name: 'CTRL CV', desc: t('Entscheidungsspannung: >= Schwelle -> PASS A, darunter -> INV B.', 'Control voltage: >= threshold routes gates to PASS A, below routes to INV B.') },
    'logic_switch:passOut': { name: 'PASS A', desc: t('Aktiver Weichen-Ausgang oberhalb des Schwellenwerts.', 'Active gate output when CTRL CV exceeds threshold.') },
    'logic_switch:invPassOut': { name: 'INV B', desc: t('Alternativer Weichen-Ausgang unterhalb des Schwellenwerts.', 'Alternate gate output when CTRL CV is below threshold.') },
    'logic_switch:toggleIn': { name: 'TOGGLE IN', desc: t('Schaltet das interne Flip-Flop mit jedem Trigger zwischen 0 und 1 um.', 'Toggles internal latch state between 0.0 and 1.0 on each trigger.') },
    'logic_switch:resetIn': { name: 'RESET IN', desc: t('Setzt den Flip-Flop-Zustand auf 0 zurück.', 'Resets latch state immediately to 0.') },
    'logic_switch:stateOut': { name: 'LATCH CV', desc: t('Gibt den aktuellen Flip-Flop-Status (0.0 oder 1.0) als Modulations-CV aus.', 'Outputs held flip-flop state (0.0 or 1.0) as modulation CV.') },
    'logic_switch:in1': { name: 'IN 1', desc: t('Gate-Eingang 1 für AND / OR Verknüpfung.', 'Logic gate input 1 for Boolean AND / OR combiners.') },
    'logic_switch:in2': { name: 'IN 2', desc: t('Gate-Eingang 2 für AND / OR Verknüpfung.', 'Logic gate input 2 for Boolean AND / OR combiners.') },
    'logic_switch:andOut': { name: 'AND OUT', desc: t('Feuert nur, wenn IN 1 und IN 2 gleichzeitig anliegen.', 'Fires only when both IN 1 and IN 2 are high simultaneously.') },
    'logic_switch:orOut': { name: 'OR OUT', desc: t('Feuert, sobald mindestens einer von IN 1 oder IN 2 triggert.', 'Fires whenever either IN 1 or IN 2 is active.') },

    // Snapshot Controller
    'snapshot_ctrl:barIn': { name: 'BAR IN', desc: t('Takt-Eingang für den Song-Ablaufplan (bars1..bars5). Empfängt idealerweise Master Clock: BAR OUT.', 'Bar counter input for automatic Song Mode progression (bars1..bars5). Patch from Master Clock BAR OUT.') },
    'snapshot_ctrl:slot1In': { name: 'SLOT 1', desc: t('Springt per Trigger direkt auf Performance-Slot 1.', 'Triggers immediate morph/switch to Performance Slot 1.') },
    'snapshot_ctrl:slot2In': { name: 'SLOT 2', desc: t('Springt per Trigger direkt auf Performance-Slot 2.', 'Triggers immediate morph/switch to Performance Slot 2.') },
    'snapshot_ctrl:slot3In': { name: 'SLOT 3', desc: t('Springt per Trigger direkt auf Performance-Slot 3.', 'Triggers immediate morph/switch to Performance Slot 3.') },
    'snapshot_ctrl:slot4In': { name: 'SLOT 4', desc: t('Springt per Trigger direkt auf Performance-Slot 4.', 'Triggers immediate morph/switch to Performance Slot 4.') },
    'snapshot_ctrl:slot5In': { name: 'SLOT 5', desc: t('Springt per Trigger direkt auf Performance-Slot 5.', 'Triggers immediate morph/switch to Performance Slot 5.') },
    'snapshot_ctrl:nextIn': { name: 'NEXT', desc: t('Schaltet zyklisch zum nächsten belegten Slot weiter.', 'Cycles to the next populated snapshot slot.') },
    'snapshot_ctrl:resetIn': { name: 'RESET', desc: t('Setzt Song-Ablaufplan & Zähler sofort zurück auf Slot 1.', 'Resets song arrangement bar counter immediately back to Slot 1.') },

    // Chord Arpeggiator
    'chord_arp:clockIn': { name: 'CLOCK IN', desc: t('Taktet jede Arpeggio-Note im Rhythmus.', 'Steps the arpeggiator note output per clock tick.') },
    'chord_arp:resetIn': { name: 'RESET IN', desc: t('Startet das Arpeggio-Muster am Taktanfang neu.', 'Resets arpeggio pattern step counter to step 1.') },
    'chord_arp:pitchIn': { name: 'POLY PITCH', desc: t('Empfängt das Akkord-Voicing direkt von Chord Glide PITCH OUT.', 'Receives polyphonic chord note voicings directly from Chord Glide PITCH OUT.') },
    'chord_arp:gateOut': { name: 'GATE OUT', desc: t('Gibt für jede Arpeggio-Note ein exakt geformtes Gate aus.', 'Outputs rhythmic note gates shaped by Gate Length and Density.') },
    'chord_arp:pitchOut': { name: 'PITCH OUT', desc: t('Gibt die aktuelle Einzelnote der zerlegten Harmonie aus.', 'Outputs individual pitch CV steps cycling through the chord notes.') },
    'chord_arp:accentOut': { name: 'ACCENT OUT', desc: t('Sendet alle N Schritte einen Betont-Trigger.', 'Outputs an accent trigger every N notes for secondary drums or percussion.') },

    // Chord Glide
    'chord_glide:clockIn': { name: 'CLOCK IN', desc: t('Taktet die Akkordfolge automatisch im Tempo weiter.', 'Clocks chord progression stepping automatically.') },
    'chord_glide:resetIn': { name: 'RESET IN', desc: t('Springt zurück zum ersten Akkord der Progression.', 'Resets chord progression back to bar 1 chord 1.') },
    'chord_glide:nextTrig': { name: 'NEXT CHORD', desc: t('Manueller/rhythmischer Weiterschalt-Trigger zum nächsten Akkord.', 'Advances manually or rhythmically to the next chord on every pulse.') },
    'chord_glide:transposeCv': { name: 'TRANSPOSE CV', desc: t('Verschiebt alle Akkordstimmen nach 1V/Okt.', 'Transposes all chord voicings dynamically via 1V/Oct CV.') },
    'chord_glide:glideCv': { name: 'GLIDE CV', desc: t('Moduliert die Portamento-Gleitzeit zwischen Akkorden.', 'Modulates chord voice-leading glide time in real time.') },
    'chord_glide:cutoffCv': { name: 'CUTOFF CV', desc: t('Moduliert die Filteröffnung des integrierten Poly-Pads.', 'Modulates filter cutoff of the built-in lush poly pad.') },
    'chord_glide:vcaCv': { name: 'VCA CV', desc: t('Moduliert die Gesamtlautstärke (Swells oder Sidechain).', 'Controls overall pad VCA level for swells or ducking.') },
    'chord_glide:panCv': { name: 'PAN CV', desc: t('Bewegt das Akkord-Pad weich im Stereopanorama.', 'Modulates stereo pan position smoothly.') },
    'chord_glide:pitchOut': { name: 'POLY PITCH', desc: t('Sendet komplette mehrstimmige Akkord-Noten an Felt Piano, Keys oder Chord Arp.', 'Broadcasts polyphonic chord voicings to Felt Piano, Touch Keys, or Chord Arp.') },
    'chord_glide:rootOut': { name: 'ROOT PITCH', desc: t('Sendet exakt den tiefsten Grundton an Analog Bass oder Drone.', 'Sends the fundamental root pitch cleanly to Analog Bass or Drone Machine.') },
    'chord_glide:gateOut': { name: 'CHORD TRIG', desc: t('Feuert bei jedem Akkordwechsel einen Anschlag-Impuls.', 'Emits a trigger gate on each chord transition.') },

    // Felt Piano
    'felt_piano:gateIn': { name: 'GATE IN', desc: t('Löst Filzhammer-Anschlag, Holzresonanz und Sustain-Ausklingkurve aus.', 'Triggers felt hammer attack, body resonance, and piano string decay.') },
    'felt_piano:pitchIn': { name: 'PITCH IN', desc: t('Empfängt einzelne Noten (Arp/Sequencer) oder volle Akkorde (Chord Glide).', 'Accepts single notes (Arp/Sequencer) or full polyphonic chords (Chord Glide).') },
    'felt_piano:vcaCv': { name: 'VCA CV', desc: t('Steuert Anschlag- und Ausklangdynamik.', 'Modulates piano VCA dynamics.') },
    'felt_piano:feltCv': { name: 'FELT CV', desc: t('Moduliert die Wärme der Filzdämpfung zwischen samtig-intim und offen-klar.', 'Modulates felt damper depth dynamically from muffled felt to bright concert tone.') },
    'felt_piano:panCv': { name: 'PAN CV', desc: t('Bewegt das Klavier subtil im Stereobild.', 'Modulates stereo image placement.') },

    // Solo Violin
    'violin:gateIn': { name: 'BOW GATE', desc: t('Startet den Bogenstrich (Arco/Sul Tasto) oder das Pizzicato-Zupfen.', 'Initiates bowed sustain (Arco/Sul Tasto) or plucked Pizzicato excitation.') },
    'violin:pitchIn': { name: 'PITCH IN', desc: t('Steuert die Tonhöhe mit organischem Griffbrett-Legato.', 'Controls violin pitch with expressive fingerboard legato slide.') },
    'violin:bowCv': { name: 'BOW CV', desc: t('Moduliert den Bogen-Anpressdruck für lebendige Streicher-Atmung.', 'Modulates bow pressure and rosin harmonic bite like human phrasing.') },
    'violin:vibratoCv': { name: 'VIBRATO CV', desc: t('Dosiert die Tiefe des Fingervibratos.', 'Modulates finger vibrato depth during sustained notes.') },
    'violin:glideCv': { name: 'GLIDE CV', desc: t('Verändert die Lagenwechsel-Gleitzeit auf der Saite.', 'Modulates portamento glide speed between pitch shifts.') },
    'violin:vcaCv': { name: 'VCA CV', desc: t('Steuert dynamische Streicher-Crescendi.', 'Shapes dynamic string crescendos and swells.') },
    'violin:panCv': { name: 'PAN CV', desc: t('Stereoposition im Kammermusik-Raum.', 'Stereo imaging modulation.') },

    // Drone
    'drone:pitchIn': { name: 'PITCH IN', desc: t('Transponiert alle 6 Oszillatoren (mit Scale Lock bleibt die Tonart rein).', 'Transposes all 6 oscillators (with Scale Lock enabled, intervals adapt diatonically).') },
    'drone:vcaCv': { name: 'VCA CV', desc: t('Formt langsame Drone-Swells oder Lautstärkefades.', 'Shapes long drone swells or fades.') },
    'drone:panCv': { name: 'PAN CV', desc: t('Stereopanorama-Drift.', 'Stereo pan drift.') },
    'drone:cvFm': { name: 'FM CV', desc: t('Moduliert Frequenzmodulation & Oberton-Bewegung.', 'Modulates inter-voice FM shimmer and harmonic richness.') },
    'drone:cvTone': { name: 'TONE CV', desc: t('Steuert das Tiefpassfilter der 6-stimmigen Drone.', 'Modulates warm lowpass filter cutoff across the 6 oscillators.') },

    // Pluck Synth
    'pluck:gateIn': { name: 'GATE IN', desc: t('Zupft die virtuelle Saite / Kalimba-Zunge an.', 'Plucks the Karplus-Strong physical string / lamella model.') },
    'pluck:pitchIn': { name: 'PITCH IN', desc: t('Bestimmt die Notenhöhe in 1V/Okt.', '1V/Oct note pitch input.') },
    'pluck:vcaCv': { name: 'VCA CV', desc: t('Dynamik- und Ducking-Eingang.', 'VCA dynamics and sidechain ducking CV.') },
    'pluck:panCv': { name: 'PAN CV', desc: t('Stereo-Breitenbewegung.', 'Stereo panning modulation.') },
    'pluck:modCutoff': { name: 'FILTER CV', desc: t('Moduliert die Anschlagshärte und Saitendämpfung.', 'Modulates pluck brightness and string damping.') },

    // FM Voice
    'fm_voice:gateIn': { name: 'GATE IN', desc: t('Triggert den 2-Operator FM-Klang.', 'Triggers the 2-operator FM envelope.') },
    'fm_voice:pitchIn': { name: 'PITCH IN', desc: t('Bestimmt Träger- und Modulatorfrequenz.', 'Sets carrier/modulator base frequency.') },
    'fm_voice:vcaCv': { name: 'VCA CV', desc: t('Lautstärke-Modulation.', 'VCA amplitude modulation.') },
    'fm_voice:panCv': { name: 'PAN CV', desc: t('Stereo-Panorama.', 'Stereo pan modulation.') },
    'fm_voice:modIndex': { name: 'INDEX CV', desc: t('Moduliert den FM-Index von glockenklar zu komplex-metallisch.', 'Modulates FM index between warm electric piano tines and metallic bells.') },

    // Bass
    'bass:gateIn': { name: 'GATE IN', desc: t('Triggert die Filter- & Verstärker-Hüllkurve.', 'Triggers bass envelope punch.') },
    'bass:pitchIn': { name: 'PITCH IN', desc: t('Steuert die Bass-Tonhöhe (ideal von Chord Glide ROOT OUT).', 'Controls bass pitch (pairs tightly with Chord Glide ROOT PITCH).') },
    'bass:vcaCv': { name: 'VCA CV', desc: t('Sidechain-Ducking & Lautstärkeführung.', 'VCA input ideal for Slope INV OUT sidechain ducking.') },
    'bass:panCv': { name: 'PAN CV', desc: t('Stereo-Panning (Sub meist zentriert halten).', 'Stereo pan modulation.') },
    'bass:modCutoff': { name: 'CUTOFF CV', desc: t('Moduliert das resonante 24dB Bassfilter.', 'Modulates resonant lowpass filter cutoff.') },

    // Drum Rack
    'drum_rack:trigKick': { name: 'KICK IN', desc: t('Triggert die analoge Sub-Bass-Kick.', 'Triggers punchy analog kick drum.') },
    'drum_rack:trigSnare': { name: 'SNARE IN', desc: t('Triggert Snare + Rausch-Teppich.', 'Triggers crisp analog snare drum.') },
    'drum_rack:trigHat': { name: 'HAT IN', desc: t('Triggert metallische Hi-Hat.', 'Triggers metallic hi-hat.') },
    'drum_rack:trigPerc': { name: 'PERC IN', desc: t('Triggert gestimmte Wood-/Rim-Percussion.', 'Triggers pitched wood/rim percussion.') },
    'drum_rack:vcaCv': { name: 'VCA CV', desc: t('Steuert den gesamten Drum-Bus-Pegel.', 'Modulates overall drum kit level.') },
    'drum_rack:panCv': { name: 'PAN CV', desc: t('Stereo-Panning.', 'Stereo kit panning.') },

    // Touch Keys & Sequencer & Noise
    'keys:gateIn': { name: 'GATE IN', desc: t('Triggert Noten in den Poly/Legato Touch Keys.', 'Triggers Touch Keys envelopes.') },
    'keys:pitchIn': { name: 'PITCH IN', desc: t('1V/Okt oder polyphone Akkord-Noten.', '1V/Oct or polyphonic chord pitch input.') },
    'keys:glideCv': { name: 'GLIDE CV', desc: t('Moduliert Portamento/Legato-Gleitzeit.', 'Modulates legato portamento time.') },
    'keys:vcaCv': { name: 'VCA CV', desc: t('Lautstärke-CV.', 'VCA level modulation.') },
    'keys:panCv': { name: 'PAN CV', desc: t('Stereo-Panning.', 'Stereo pan modulation.') },
    'keys:gateOut': { name: 'KBD GATE OUT', desc: t('Gibt Tastendrücke (A–K) als Gate an andere Module weiter.', 'Outputs keyboard A–K note gates to drive external rack modules.') },
    'keys:pitchOut': { name: 'KBD PITCH OUT', desc: t('Gibt gespielte Tasten-Tonhöhen per 1V/Okt aus.', 'Outputs played keyboard pitch CV to drive external modules.') },
    'sequencer:clockIn': { name: 'CLOCK IN', desc: t('Taktet die 8 Sequenzer-Schritte weiter.', 'Clocks the 8-step sequencer.') },
    'sequencer:gateOut': { name: 'GATE OUT', desc: t('Gibt die aktiven Step-Gates weiter.', 'Outputs active step gates (respecting Ties/Rests and Chance).') },
    'sequencer:pitchOut': { name: 'PITCH OUT', desc: t('Sendet die programmierten Notenhöhen weiter.', 'Outputs programmed quantized step pitches.') },
    'noise:vcaCv': { name: 'VCA CV', desc: t('Moduliert Regen-, Wind- oder Vinyl-Lautstärke.', 'Modulates ambient noise level.') },
    'noise:panCv': { name: 'PAN CV', desc: t('Stereo-Raumbewegung für Wind & Regen.', 'Stereo movement for rain, wind, or tape texture.') },
    'noise:cvTone': { name: 'TONE CV', desc: t('Steuert Filterbewegung des Rauschens.', 'Modulates noise filter cutoff dynamically.') },

    // Morph Voice, Hybrid Perc, Resonator Garden, Spectral Swarm
    'morph_voice:gateIn': { name: 'GATE IN', desc: t('Startet Hüllkurve & Hold-Phase.', 'Triggers envelope and hold stage.') },
    'morph_voice:pitchIn': { name: 'PITCH IN', desc: t('1V/Okt Notenhöhe.', '1V/Oct pitch input.') },
    'morph_voice:jumpIn': { name: 'JUMP TRIG', desc: t('Springt per Trigger an eine neue Wavetable-Morph-Position.', 'Randomizes wavetable morph position on every trigger.') },
    'morph_voice:glideCv': { name: 'GLIDE CV', desc: t('Moduliert Portamento-Zeit.', 'Modulates glide time.') },
    'morph_voice:morphCv': { name: 'MORPH CV', desc: t('Fährt stufenlos durch 8 Wellenform-Welten.', 'Sweeps seamlessly through 8 analog, vocal, bell & digital waves.') },
    'morph_voice:timbreCv': { name: 'TIMBRE CV', desc: t('Moduliert Brillanz und Obertongehalt.', 'Modulates harmonic brilliance and cutoff.') },
    'morph_voice:envCv': { name: 'ENV CV', desc: t('Skaliert Attack- & Release-Zeiten in Echtzeit.', 'Scales attack and release durations dynamically.') },
    'morph_voice:vcaCv': { name: 'VCA CV', desc: t('Lautstärke-Modulation.', 'VCA amplitude modulation.') },
    'morph_voice:panCv': { name: 'PAN CV', desc: t('Stereo-Panorama.', 'Stereo pan CV.') },
    'morph_voice:mutateIn': { name: 'MUTATE TRIG', desc: t('Mutiert ungesperrte Klangparameter.', 'Mutates all unlocked timbre parameters.') },

    'hybrid_perc:gateIn': { name: 'GATE IN', desc: t('Löst den mehrschichtigen Drum-Schlag aus.', 'Triggers multi-layer sub/transient percussion.') },
    'hybrid_perc:pitchIn': { name: 'PITCH IN', desc: t('Stimmt den Trommelkörper per 1V/Okt.', 'Pitches body oscillator via 1V/Oct.') },
    'hybrid_perc:timbreCv': { name: 'MATERIAL CV', desc: t('Morphing zwischen Holz/Fell und Metallkörper.', 'Morphs drum body between wood membrane and metallic anvil.') },
    'hybrid_perc:lengthCv': { name: 'LENGTH CV', desc: t('Variiert den Ausklang dynamisch pro Schlag.', 'Modulates tail decay length per hit.') },
    'hybrid_perc:vcaCv': { name: 'VCA CV', desc: t('Dynamik-Steuerspannung.', 'VCA amplitude modulation.') },
    'hybrid_perc:panCv': { name: 'PAN CV', desc: t('Stereo-Panorama.', 'Stereo panning.') },
    'hybrid_perc:mutateIn': { name: 'MUTATE TRIG', desc: t('Würfelt neue Trommel-Charaktere aus.', 'Mutates unlocked drum parameters.') },

    'resonator_garden:gateIn': { name: 'GATE IN', desc: t('Regt die 6 physikalischen Resonanzkörper an.', 'Excites the 6 modal resonator bodies.') },
    'resonator_garden:pitchIn': { name: 'PITCH IN', desc: t('Stimmt die Grundresonanz der Körper.', 'Tunes base harmonic pitch.') },
    'resonator_garden:materialCv': { name: 'MATERIAL CV', desc: t('Wandelt zwischen Saite, Holz und Metall-Glocke.', 'Morphs modal tuning from strings to marimba wood and bells.') },
    'resonator_garden:dampCv': { name: 'DAMP CV', desc: t('Dämpft hohe Moden (Holz) oder öffnet lange Sing-Resonanzen.', 'Damps upper partials (dry wood) or opens long singing chimes.') },
    'resonator_garden:vcaCv': { name: 'VCA CV', desc: t('Gesamtlautstärke.', 'VCA modulation.') },
    'resonator_garden:panCv': { name: 'PAN CV', desc: t('Stereo-Bewegung.', 'Stereo modulation.') },
    'resonator_garden:mutateIn': { name: 'MUTATE TRIG', desc: t('Generiert neue Resonator-Geometrien.', 'Mutates resonator geometry and ratios.') },

    'spectral_swarm:gateIn': { name: 'GATE IN', desc: t('Triggert Partikel-Bursts oder Drone-Akzente.', 'Triggers particle bursts or harmonic swarm accents.') },
    'spectral_swarm:pitchIn': { name: 'PITCH IN', desc: t('Stimmt die Basis-Teiltonreihe.', 'Sets base harmonic pitch of the 32 partials.') },
    'spectral_swarm:scatterIn': { name: 'SCATTER TRIG', desc: t('Verstreut alle 32 Partials im Frequenzspektrum.', 'Scatters partials across frequency and stereo space.') },
    'spectral_swarm:gatherIn': { name: 'GATHER TRIG', desc: t('Zieht alle Partials harmonisch zusammen.', 'Pulls scattered partials into pure harmonic alignment.') },
    'spectral_swarm:cohesionCv': { name: 'COHESION CV', desc: t('Steuert Schwarm-Zusammenhalt zwischen Cluster und Orgel-Akkord.', 'Morphs cohesion between chaotic cluster and pure organ chord.') },
    'spectral_swarm:vcaCv': { name: 'VCA CV', desc: t('Lautstärke-Steuerspannung.', 'Swarm VCA CV.') },
    'spectral_swarm:panCv': { name: 'PAN CV', desc: t('Stereo-Breiten-Modulation.', 'Stereo dispersion CV.') },
    'spectral_swarm:mutateIn': { name: 'MUTATE TRIG', desc: t('Mutiert Schwarm-Verhalten.', 'Mutates unlocked swarm parameters.') },

    // Effects
    'filter:cvCutoff': { name: 'CUTOFF CV', desc: t('Moduliert die 24dB Tiefpass/Bandpass/Hochpass-Grenzfrequenz.', 'Modulates oversampled filter cutoff frequency smoothly.') },
    'delay:cvTime': { name: 'TIME CV', desc: t('Moduliert Delay-Zeit für subtiles Tape-Warble.', 'Modulates delay time for lush tape pitch drift.') },
    'reverb:cvMix': { name: 'MIX CV', desc: t('Steuert den Hallanteil dynamisch per CV.', 'Modulates wet reverb mix dynamically via CV.') },
    'granular_cloud:freezeIn': { name: 'FREEZE TRIG', desc: t('Friert den aktuellen Audiopuffer als endlosen Teppich ein.', 'Latches granular buffer freeze on trigger/gate.') },
    'granular_cloud:cvMix': { name: 'MIX CV', desc: t('Moduliert das Dry/Wet-Verhältnis der Granular-Wolke.', 'Modulates granular wet shimmer mix smoothly.') },
    'granular_cloud:cvTexture': { name: 'TEXTURE CV', desc: t('Moduliert Grain-Streuung und Stereowolke.', 'Modulates grain scatter jitter and cloud width.') },
  };
}

function getKnobHelpMap() {
  return {
    rise: t('Anstiegszeit (Attack) der Hüllkurve von 0.01s bis 180s für langsame Ambient-Swells.', 'Envelope rise (attack) time from 0.01s to 180s for extended ambient swells.'),
    fall: t('Abfallzeit (Decay/Release) der Hüllkurve von 0.01s bis 180s.', 'Envelope fall (decay/release) time from 0.01s to 180s.'),
    scale: t('Skalierungsfaktor (-100% bis +100%): Dämpft oder invertiert das Steuersignal.', 'Attenuverter scale (-100% to +100%): attenuates or inverts CV polarity.'),
    scalea: t('Attenuverter Kanal A (-100% bis +100%).', 'Channel A scale & polarity (-100% to +100%).'),
    scaleb: t('Attenuverter Kanal B (-100% bis +100%).', 'Channel B scale & polarity (-100% to +100%).'),
    offset: t('Gleichspannungs-Offset (-1.0 bis +1.0).', 'DC offset shift (-1.0 to +1.0).'),
    tempo: t('Master-Tempo in BPM (40–200) für alle Clocks, Sequenzer und Arpeggiatoren.', 'Master tempo in BPM (40–200) keeping clocks, sequencers, and arps in tight sync.'),
    swing: t('Verschiebt ungerade Sechzehntel für organischen Groove.', 'Delays off-beat 16ths for human pocket and swing feel.'),
    steps: t('Schrittanzahl pro Taktzyklus (1–16).', 'Cycle step count (1–16).'),
    pulses: t('Anzahl gleichmäßig verteilter Schläge im Zyklus.', 'Number of evenly spaced hits inside the step cycle.'),
    rotation: t('Dreht das rhythmische Muster schrittweise im Kreis.', 'Rotates pattern start step forward through the cycle.'),
    cutoff: t('Grenzfrequenz des Filters in Hz – steuert Wärme vs. Brillanz.', 'Filter cutoff frequency in Hz – controls warmth vs. brightness.'),
    reso: t('Betont Frequenzen direkt um die Grenzfrequenz (Filter-Resonanz).', 'Emphasizes frequencies right around cutoff for vocal or 303 character.'),
    drive: t('Weiche oversampelte Sättigung (Soft-Clip Wärme).', 'Soft oversampled tanh warmth and harmonic saturation.'),
    attack: t('Einschwingzeit bis zur vollen Lautstärke.', 'Time for voice amplitude to reach peak level.'),
    decay: t('Abklingzeit nach dem ersten Anschlag.', 'Decay tail length after note strike.'),
    release: t('Ausklingzeit nach Loslassen von Taste oder Gate.', 'Release fade duration after gate closes.'),
    feedback: t('Rückkopplung der Echos bzw. Granular-Loops.', 'Feedback recirculation amount for Echo or Granular loops.'),
    time: t('Verzögerungszeit in Sekunden.', 'Delay line time in seconds.'),
    rate: t('Geschwindigkeit des LFO / der Modulation.', 'Modulation rate in Hz.'),
    depth: t('Intensität der Modulation (Auslenkung).', 'Modulation depth / excursion intensity.'),
    mix: t('Verhältnis zwischen Originalsignal (Dry) und Effekt (Wet).', 'Dry/Wet effect blend ratio.'),
    detune: t('Sanfte Verstimmung zwischen Stimmen für analoge Breite.', 'Fine analog pitch detune across stacked voices for stereo richness.'),
    felt: t('Stärke des Klavier-Filzes zwischen gedämpft-warm und offen.', 'Felt hammer damping depth from intimate muted warmth to open tone.'),
    bow: t('Anpressdruck des Violinenbogens (Obertöne & Kolophonium-Textur).', 'Violin bow pressure shaping harmonic bite and rosin breath.'),
    bars1: t('Taktzahl für Performance-Slot 1 im Song-Ablaufplan (0 = überspringen).', 'Bar count held in Slot 1 during Song Mode (0 = skip slot).'),
    bars2: t('Taktzahl für Performance-Slot 2 im Song-Ablaufplan.', 'Bar count held in Slot 2 during Song Mode.'),
    bars3: t('Taktzahl für Performance-Slot 3 im Song-Ablaufplan.', 'Bar count held in Slot 3 during Song Mode.'),
    bars4: t('Taktzahl für Performance-Slot 4 im Song-Ablaufplan.', 'Bar count held in Slot 4 during Song Mode.'),
    bars5: t('Taktzahl für Performance-Slot 5 im Song-Ablaufplan.', 'Bar count held in Slot 5 during Song Mode.'),
    cohesion: t('Schwarm-Kohäsion: 1.0 = reiner Orgelakkord, 0.0 = Cluster-Wolke.', 'Swarm cohesion: 1.0 = pure chord alignment, 0.0 = wandering cloud.'),
  };
}

function getModuleExamples() {
  return {
    master_clock: {
      desc: t('Taktzentrale: Gibt ein präzises 1/16-, 1/8-, 1/4- und 1-Bar-Metrum an das Rack aus.', 'Master heartbeat: emits tight 1/16, 1/8, 1/4, and 1 Bar sync pulses.'),
      wiring: 'Master Clock (clockOut) -> Clock Divider (clockIn) -> Drum Rack',
      recipe: {
        name: 'Master Clock Sync & Beats',
        modules: ['master_clock', 'clock_divider', 'drum_rack', 'reverb'],
        cables: [
          { from: 'master_clock:clockOut', to: 'clock_divider:clockIn', color: '#06b6d4' },
          { from: 'clock_divider:div4Out', to: 'drum_rack:trigKick', color: '#fbbf24' },
          { from: 'clock_divider:div8Out', to: 'drum_rack:trigSnare', color: '#fbbf24' },
          { from: 'clock_divider:div2Out', to: 'drum_rack:trigHat', color: '#fbbf24' },
        ],
        params: { master_clock: { tempo: 102 } },
      },
    },
    clock_divider: {
      desc: t('Teilt den Master-Takt sauber in /2, /3 (Triolen), /4, /8 und /16 auf.', 'Divides master clock into /2, /3 triplets, /4, /8, and /16 timing lanes.'),
      wiring: 'Master Clock (clockOut) -> Clock Divider -> /4 Kick, /8 Snare',
      recipe: {
        name: 'Clock Divider 4-on-the-Floor',
        modules: ['master_clock', 'clock_divider', 'drum_rack', 'bass'],
        cables: [
          { from: 'master_clock:clockOut', to: 'clock_divider:clockIn', color: '#06b6d4' },
          { from: 'clock_divider:div4Out', to: 'drum_rack:trigKick', color: '#fbbf24' },
          { from: 'clock_divider:div8Out', to: 'drum_rack:trigSnare', color: '#fbbf24' },
          { from: 'clock_divider:div2Out', to: 'bass:gateIn', color: '#fbbf24' },
        ],
        params: { master_clock: { tempo: 110 } },
      },
    },
    euclidean: {
      desc: t('Erzeugt mathematisch balancierte Polyrhythmen mit komplementärem INV OUT.', 'Generates balanced Björklund polyrhythms plus inverse rest triggers.'),
      wiring: 'Euclidean (trigOut) -> Pluck Synth (gateIn)',
      recipe: {
        name: 'Euclidean Harp Pattern (7/3)',
        modules: ['master_clock', 'euclidean', 'pluck', 'reverb'],
        cables: [
          { from: 'master_clock:clockOut', to: 'euclidean:clockIn', color: '#06b6d4' },
          { from: 'euclidean:trigOut', to: 'pluck:gateIn', color: '#fbbf24' },
        ],
        params: { euclidean: { steps: 7, pulses: 3 }, master_clock: { tempo: 96 } },
      },
    },
    prob_gate: {
      desc: t('Leitet Trigger nach Zufallswahrscheinlichkeit an PASSED oder SKIPPED weiter.', 'Branches incoming triggers stochastically between PASSED and SKIPPED.'),
      wiring: 'Master Clock -> Probability Gate -> PASSED / SKIPPED -> Drum Rack',
      recipe: {
        name: 'Probabilistic Hat Groove',
        modules: ['master_clock', 'prob_gate', 'drum_rack'],
        cables: [
          { from: 'master_clock:clockOut', to: 'prob_gate:trigIn', color: '#06b6d4' },
          { from: 'prob_gate:trigOut', to: 'drum_rack:trigHat', color: '#fbbf24' },
          { from: 'prob_gate:altOut', to: 'drum_rack:trigPerc', color: '#fbbf24' },
        ],
        params: { prob_gate: { chance: 0.62 } },
      },
    },
    random_walk: {
      desc: t('Erzeugt schrittweise wandernde Melodien innerhalb einer gewählten Tonleiter.', 'Generates bounded step-by-step melodic contours in any scale.'),
      wiring: 'Random Walk (pitchOut/gateOut) -> Pluck Synth (pitchIn/gateIn)',
      recipe: {
        name: 'Generative Random Walk Harp',
        modules: ['master_clock', 'euclidean', 'random_walk', 'pluck', 'delay', 'reverb'],
        cables: [
          { from: 'master_clock:clockOut', to: 'euclidean:clockIn', color: '#06b6d4' },
          { from: 'euclidean:trigOut', to: 'random_walk:clockIn', color: '#fbbf24' },
          { from: 'random_walk:pitchOut', to: 'pluck:pitchIn', color: '#a855f7' },
          { from: 'random_walk:gateOut', to: 'pluck:gateIn', color: '#fbbf24' },
        ],
        params: { pluck: { tone: 2200, damp: 1.1 } },
      },
    },
    quantizer: {
      desc: t('Rastet frei schwebende Spannungen taktgenau in harmonische Skalen ein.', 'Locks raw modulation voltages into pure musical scales on clock.'),
      wiring: 'Slow Random (cvOut) -> Scale Quantizer -> Touch Keys',
      recipe: {
        name: 'Quantized LFO Melody',
        modules: ['master_clock', 'slow_random', 'quantizer', 'keys', 'reverb'],
        cables: [
          { from: 'slow_random:cvOut', to: 'quantizer:pitchIn', color: '#a855f7' },
          { from: 'master_clock:div4Out', to: 'quantizer:trigIn', color: '#06b6d4' },
          { from: 'quantizer:pitchOut', to: 'keys:pitchIn', color: '#a855f7' },
          { from: 'quantizer:gateOut', to: 'keys:gateIn', color: '#fbbf24' },
        ],
        params: { slow_random: { rate: 0.35 } },
      },
    },
    slow_random: {
      desc: t('Organisch driftender LFO für Filteratmung, Tape-Drift oder Panning.', 'Smooth organic drift LFO for breathing filters, felt tone, and delay.'),
      wiring: 'Slow Random (cvOut) -> Analog Filter (cvCutoff)',
      recipe: {
        name: 'Breathing Analog Filter',
        modules: ['drone', 'slow_random', 'filter', 'reverb'],
        cables: [{ from: 'slow_random:cvOut', to: 'filter:cvCutoff', color: '#10b981' }],
        params: { slow_random: { rate: 0.08, depth: 0.75 }, filter: { cutoff: 1200, reso: 2.5 } },
      },
    },
    macro: {
      desc: t('Drei Performance-Regler (Density, Variation, Motion) steuern mehrere Ziele simultan.', 'Three tactile performance axes controlling density, variation, and motion.'),
      wiring: 'Macro (densityCv/motionCv) -> Spectral Swarm / Filter',
      recipe: {
        name: 'Macro Performance Desk',
        modules: ['macro', 'spectral_swarm', 'filter', 'reverb'],
        cables: [
          { from: 'macro:densityCv', to: 'spectral_swarm:vcaCv', color: '#10b981' },
          { from: 'macro:motionCv', to: 'filter:cvCutoff', color: '#10b981' },
        ],
        params: { macro: { density: 0.7, motion: 0.6 } },
      },
    },
    slope_generator: {
      desc: t('0.01s–180s Rise/Fall Hüllkurve mit EOR/EOF Triggern & invertiertem Ducking.', '0.01s–180s function generator with EOR/EOF cascade triggers and inverse ducking.'),
      wiring: 'Slope (envOut) -> Drone (vcaCv), Slope (invOut) -> Pluck (vcaCv)',
      recipe: {
        name: 'Slope Swell & Inverse Ducking',
        modules: ['slope_generator', 'drone', 'pluck', 'reverb'],
        cables: [
          { from: 'slope_generator:envOut', to: 'drone:vcaCv', color: '#10b981' },
          { from: 'slope_generator:invOut', to: 'pluck:vcaCv', color: '#10b981' },
        ],
        params: { slope_generator: { mode: 'loop', rise: 8, fall: 16 } },
      },
    },
    attenuverter: {
      desc: t('Dämpft, invertiert (-100%..+100%) und summiert Steuerspannungen feinfühlig.', 'Scales, inverts (-100%..+100%), offsets, and sums two modulation lanes.'),
      wiring: 'Slow Random -> Attenuverter (inA -> outA @ 22%) -> Filter',
      recipe: {
        name: 'Attenuverted Subtle Filter Glow',
        modules: ['slow_random', 'attenuverter', 'keys', 'filter'],
        cables: [
          { from: 'slow_random:cvOut', to: 'attenuverter:inA', color: '#10b981' },
          { from: 'attenuverter:outA', to: 'filter:cvCutoff', color: '#10b981' },
        ],
        params: { attenuverter: { scaleA: 0.22 } },
      },
    },
    logic_switch: {
      desc: t('Spannungsgesteuerte A/B-Gateweiche, Flip-Flop Latch und Boolean AND/OR.', 'Voltage-controlled A/B gate router, flip-flop latch, and Boolean combiners.'),
      wiring: 'Clock (clockOut) -> Logic Switch -> PASS A / INV B -> 2 Voices',
      recipe: {
        name: 'Voltage-Switched Voice Alternation',
        modules: ['master_clock', 'slow_random', 'logic_switch', 'pluck', 'fm_voice', 'reverb'],
        cables: [
          { from: 'master_clock:div2Out', to: 'logic_switch:gateIn', color: '#fbbf24' },
          { from: 'slow_random:cvOut', to: 'logic_switch:ctrlCv', color: '#10b981' },
          { from: 'logic_switch:passOut', to: 'pluck:gateIn', color: '#fbbf24' },
          { from: 'logic_switch:invPassOut', to: 'fm_voice:gateIn', color: '#fbbf24' },
        ],
      },
    },
    snapshot_ctrl: {
      desc: t('Automatisierter Song-Ablaufplan (bars1..5) und taktgenauer Snapshot-Umschalter.', 'Automated Song Mode (bars1..5) and bar-synced Snapshot slot sequencer.'),
      wiring: 'Master Clock (barOut) -> Snapshot Controller (barIn)',
      recipe: {
        name: 'Automated Snapshot Progression',
        modules: ['master_clock', 'snapshot_ctrl', 'chord_glide', 'reverb'],
        cables: [
          { from: 'master_clock:clockOut', to: 'chord_glide:clockIn', color: '#06b6d4' },
          { from: 'master_clock:barOut', to: 'snapshot_ctrl:barIn', color: '#06b6d4' },
        ],
        params: { snapshot_ctrl: { autoRun: 1, loop: 1, bars1: 2, bars2: 2, bars3: 4 } },
      },
    },
    chord_arp: {
      desc: t('Arpeggiert polyphone Akkorde von Chord Glide im Takt zu treibenden Ostinati.', 'Slices polyphonic chords from Chord Glide into tight multi-octave ostinatos.'),
      wiring: 'Chord Glide (pitchOut) -> Chord Arp -> Felt Piano',
      recipe: {
        name: 'Cinematic Piano Arpeggio',
        modules: ['master_clock', 'clock_divider', 'chord_glide', 'chord_arp', 'felt_piano', 'reverb'],
        cables: [
          { from: 'master_clock:clockOut', to: 'clock_divider:clockIn', color: '#06b6d4' },
          { from: 'master_clock:clockOut', to: 'chord_glide:clockIn', color: '#06b6d4' },
          { from: 'clock_divider:div2Out', to: 'chord_arp:clockIn', color: '#06b6d4' },
          { from: 'chord_glide:pitchOut', to: 'chord_arp:pitchIn', color: '#a855f7' },
          { from: 'chord_arp:pitchOut', to: 'felt_piano:pitchIn', color: '#a855f7' },
          { from: 'chord_arp:gateOut', to: 'felt_piano:gateIn', color: '#fbbf24' },
        ],
        params: { chord_glide: { level: 0.25 }, felt_piano: { level: 0.8, felt: 0.72 } },
      },
    },
    chord_glide: {
      desc: t('Polyphone Stimmführung mit minimalem Stimmweg, Poly-Pitch und Root-Out.', 'Polyphonic voice-leading synthesizer broadcasting POLY PITCH and ROOT PITCH.'),
      wiring: 'Master Clock -> Chord Glide -> Poly Pitch / Root Pitch',
      recipe: {
        name: 'Warm Voice-Leading Chords',
        modules: ['master_clock', 'chord_glide', 'reverb'],
        cables: [{ from: 'master_clock:clockOut', to: 'chord_glide:clockIn', color: '#06b6d4' }],
        params: { chord_glide: { level: 0.75, glide: 1.4, cutoff: 1400, voiceLeading: 1 } },
      },
    },
    felt_piano: {
      desc: t('Intimes, mechanisches Filzklavier mit weicher Dämpfung und Holzkorpus.', 'Intimate felt piano with warm mechanical hammer thump and wooden body.'),
      wiring: 'Chord Glide / Arp -> Felt Piano (pitchIn/gateIn)',
      recipe: {
        name: 'Intimate Felt Piano Flow',
        modules: ['master_clock', 'chord_glide', 'chord_arp', 'felt_piano', 'slow_random', 'reverb'],
        cables: [
          { from: 'master_clock:clockOut', to: 'chord_glide:clockIn', color: '#06b6d4' },
          { from: 'master_clock:div2Out', to: 'chord_arp:clockIn', color: '#06b6d4' },
          { from: 'chord_glide:pitchOut', to: 'chord_arp:pitchIn', color: '#a855f7' },
          { from: 'chord_arp:pitchOut', to: 'felt_piano:pitchIn', color: '#a855f7' },
          { from: 'chord_arp:gateOut', to: 'felt_piano:gateIn', color: '#fbbf24' },
          { from: 'slow_random:cvOut', to: 'felt_piano:feltCv', color: '#10b981' },
        ],
        params: { chord_glide: { level: 0.22 }, felt_piano: { level: 0.8, felt: 0.78 } },
      },
    },
    violin: {
      desc: t('Physikalisch angelehnte Solo-Violine mit Bogen-Druck, Vibrato & Legato-Glide.', 'Expressive solo violin with bow pressure modulation, vibrato, and legato slide.'),
      wiring: 'Sequencer -> Violin (pitchIn/gateIn), Slope -> BOW CV',
      recipe: {
        name: 'Lyrical Bowed Solo Violin',
        modules: ['master_clock', 'clock_divider', 'sequencer', 'violin', 'slope_generator', 'reverb'],
        cables: [
          { from: 'master_clock:clockOut', to: 'clock_divider:clockIn', color: '#06b6d4' },
          { from: 'clock_divider:div8Out', to: 'sequencer:clockIn', color: '#06b6d4' },
          { from: 'sequencer:pitchOut', to: 'violin:pitchIn', color: '#a855f7' },
          { from: 'sequencer:gateOut', to: 'violin:gateIn', color: '#fbbf24' },
          { from: 'slope_generator:envOut', to: 'violin:bowCv', color: '#10b981' },
        ],
        params: { sequencer: { level: 0 }, violin: { articulation: 'sultasto', bow: 0.45 } },
      },
    },
    drone: {
      desc: t('Sechsstimmiger Akkord-Cluster mit Sub, FM und weicher Analogschwebung.', 'Six-oscillator harmonic cluster with sub reinforcement, FM, and analog drift.'),
      wiring: 'Slope Generator (envOut) -> Drone (vcaCv)',
      recipe: {
        name: 'Deep Analog Cosmos Drone',
        modules: ['slope_generator', 'drone', 'delay', 'reverb'],
        cables: [{ from: 'slope_generator:envOut', to: 'drone:vcaCv', color: '#10b981' }],
        params: { slope_generator: { mode: 'loop', rise: 10, fall: 20 }, drone: { detune: 12, fm: 0.1 } },
      },
    },
    pluck: {
      desc: t('Organisch gezupfte Saiten, Harfen und Kalimbas nach Karplus-Strong.', 'Karplus-Strong physical string plucks spanning harp, koto, and kalimba.'),
      wiring: 'Euclidean (trigOut) -> Pluck (gateIn), Random Walk -> Pluck (pitchIn)',
      recipe: {
        name: 'Crystalline Harp Plucks',
        modules: ['master_clock', 'euclidean', 'random_walk', 'pluck', 'delay', 'reverb'],
        cables: [
          { from: 'master_clock:clockOut', to: 'euclidean:clockIn', color: '#06b6d4' },
          { from: 'euclidean:trigOut', to: 'random_walk:clockIn', color: '#fbbf24' },
          { from: 'random_walk:pitchOut', to: 'pluck:pitchIn', color: '#a855f7' },
          { from: 'euclidean:trigOut', to: 'pluck:gateIn', color: '#fbbf24' },
        ],
        params: { pluck: { tone: 2400, damp: 1.2 } },
      },
    },
    fm_voice: {
      desc: t('2-Operator FM-Synthese für kristalline Glocken, E-Pianos und Gongs.', '2-operator FM voice for crystalline bells, tines, and metallic gongs.'),
      wiring: 'Sequencer -> FM Voice, Slow Random -> INDEX CV',
      recipe: {
        name: 'Dynamic FM Bells',
        modules: ['master_clock', 'sequencer', 'slow_random', 'fm_voice', 'delay', 'reverb'],
        cables: [
          { from: 'master_clock:clockOut', to: 'sequencer:clockIn', color: '#06b6d4' },
          { from: 'sequencer:pitchOut', to: 'fm_voice:pitchIn', color: '#a855f7' },
          { from: 'sequencer:gateOut', to: 'fm_voice:gateIn', color: '#fbbf24' },
          { from: 'slow_random:cvOut', to: 'fm_voice:modIndex', color: '#10b981' },
        ],
        params: { fm_voice: { ratio: 2.0, index: 2.2, decay: 1.5 } },
      },
    },
    bass: {
      desc: t('Druckvoller Analog- und Acid-Subbass mit resonanter Filter-Hüllkurve.', 'Punchy analog & acid 303 bass synth with deep sub oscillator.'),
      wiring: 'Clock Divider (/4) -> Bass (gateIn), Slow Random -> CUTOFF CV',
      recipe: {
        name: 'Acid 303 Bassline',
        modules: ['master_clock', 'clock_divider', 'slow_random', 'bass', 'filter', 'delay'],
        cables: [
          { from: 'master_clock:clockOut', to: 'clock_divider:clockIn', color: '#06b6d4' },
          { from: 'clock_divider:div4Out', to: 'bass:gateIn', color: '#fbbf24' },
          { from: 'slow_random:cvOut', to: 'bass:modCutoff', color: '#10b981' },
        ],
        params: { bass: { cutoff: 480, reso: 5.0, env: 0.6 } },
      },
    },
    drum_rack: {
      desc: t('Vierstimmige Analog-Drumbox (Kick, Snare, Hat, Perc) mit separaten Triggern.', 'Four-voice analog drum machine (Kick, Snare, Hat, Perc) with discrete trigger jacks.'),
      wiring: 'Clock Divider (/4 Kick, /8 Snare, /2 Hat) -> Drum Rack',
      recipe: {
        name: 'Classic 4-on-the-Floor Drum Rack',
        modules: ['master_clock', 'clock_divider', 'drum_rack', 'reverb'],
        cables: [
          { from: 'master_clock:clockOut', to: 'clock_divider:clockIn', color: '#06b6d4' },
          { from: 'clock_divider:div2Out', to: 'drum_rack:trigHat', color: '#fbbf24' },
          { from: 'clock_divider:div4Out', to: 'drum_rack:trigKick', color: '#fbbf24' },
          { from: 'clock_divider:div8Out', to: 'drum_rack:trigSnare', color: '#fbbf24' },
        ],
        params: { master_clock: { tempo: 114 } },
      },
    },
    keys: {
      desc: t('Warmer Poly/Mono/Legato-Synth – auch direkt per Tastatur A–K spielbar.', 'Warm poly/mono/legato synth playable directly via keyboard keys A–K or CV.'),
      wiring: 'Euclidean -> Keys (gateIn), Random Walk -> Keys (pitchIn)',
      recipe: {
        name: 'Legato & Poly Dream Keys',
        modules: ['master_clock', 'euclidean', 'random_walk', 'keys', 'chorus', 'reverb'],
        cables: [
          { from: 'master_clock:clockOut', to: 'euclidean:clockIn', color: '#06b6d4' },
          { from: 'euclidean:trigOut', to: 'keys:gateIn', color: '#fbbf24' },
          { from: 'random_walk:pitchOut', to: 'keys:pitchIn', color: '#a855f7' },
        ],
        params: { keys: { attack: 0.35, release: 2.2, cutoff: 1400 } },
      },
    },
    sequencer: {
      desc: t('8-Step-Melodie-Sequenzer mit Ties, Pausen, Probability & Glide.', '8-step melodic sequencer with step gates (Rest/Trig/Tie), probability, and glide.'),
      wiring: 'Master Clock -> Sequencer -> Pitch/Gate Out -> Pluck Synth',
      recipe: {
        name: '8-Step Melodic Line',
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
      desc: t('Organisches Pink/Red/Tape-Rauschen, Regen und feines Vinyl-Knistern.', 'Organic pink/red/tape texture noise, gentle rainfall, and vinyl crackle.'),
      wiring: 'Slow Random (cvOut) -> Noise (cvTone)',
      recipe: {
        name: 'Breathing Ocean Rain & Tape',
        modules: ['slow_random', 'noise', 'reverb'],
        cables: [{ from: 'slow_random:cvOut', to: 'noise:cvTone', color: '#10b981' }],
        params: { noise: { color: 'pink', motion: 0.7, level: 0.22 }, slow_random: { rate: 0.05 } },
      },
    },
    morph_voice: {
      desc: t('8-fach morphbarer Oszillator von Analogsäge über Vokalchor zu FM-Metall.', 'Morphing multi-source voice gliding through analog, formant choir, bell, and FM spectra.'),
      wiring: 'Slope Generator (envOut) -> Morph Voice (morphCv)',
      recipe: {
        name: 'Morphing Wavetable Choir',
        modules: ['slope_generator', 'morph_voice', 'delay', 'reverb'],
        cables: [{ from: 'slope_generator:envOut', to: 'morph_voice:morphCv', color: '#10b981' }],
        params: { slope_generator: { mode: 'loop', rise: 4, fall: 8 }, morph_voice: { morph: 0.3 } },
      },
    },
    hybrid_perc: {
      desc: t('Perkussions-Synthesizer aus Sub-Body, Pitch-Drop, Snap und Material.', 'Hybrid percussion engine layering sub punch, transient snap, pitch drop, and metallic noise.'),
      wiring: 'Clock Divider (/4) -> Hybrid Perc, Slow Random -> MATERIAL CV',
      recipe: {
        name: 'Morphing Hybrid Drums',
        modules: ['master_clock', 'clock_divider', 'slow_random', 'hybrid_perc', 'delay'],
        cables: [
          { from: 'master_clock:clockOut', to: 'clock_divider:clockIn', color: '#06b6d4' },
          { from: 'clock_divider:div4Out', to: 'hybrid_perc:gateIn', color: '#fbbf24' },
          { from: 'slow_random:cvOut', to: 'hybrid_perc:timbreCv', color: '#10b981' },
        ],
        params: { hybrid_perc: { body: 0.8, snap: 0.45, drop: 0.6 } },
      },
    },
    resonator_garden: {
      desc: t('6 physikalische Modal-Resonanzkörper von Holz-Marimba bis Klangschale.', '6 modal acoustic resonators morphing from marimba wood to singing bowls.'),
      wiring: 'Euclidean (trigOut) -> Resonator Garden, Slow Random -> DAMP CV',
      recipe: {
        name: 'Modal Resonator Chimes',
        modules: ['master_clock', 'euclidean', 'slow_random', 'resonator_garden', 'reverb'],
        cables: [
          { from: 'master_clock:clockOut', to: 'euclidean:clockIn', color: '#06b6d4' },
          { from: 'euclidean:trigOut', to: 'resonator_garden:gateIn', color: '#fbbf24' },
          { from: 'slow_random:cvOut', to: 'resonator_garden:dampCv', color: '#10b981' },
        ],
        params: { resonator_garden: { material: 0.55, modes: 8, decay: 2.6 } },
      },
    },
    spectral_swarm: {
      desc: t('32 autonome Sinus-Teiltöne zwischen Wolken-Cluster und sakralem Akkord.', '32 autonomous sine partials swarming between dissonant mist and sacred organ chords.'),
      wiring: 'Slope Generator (envOut) -> Spectral Swarm (cohesionCv)',
      recipe: {
        name: 'Spectral Swarm Cohesion',
        modules: ['slope_generator', 'spectral_swarm', 'reverb'],
        cables: [{ from: 'slope_generator:envOut', to: 'spectral_swarm:cohesionCv', color: '#10b981' }],
        params: { slope_generator: { mode: 'loop', rise: 6, fall: 14 }, spectral_swarm: { count: 18 } },
      },
    },
    filter: {
      desc: t('24dB Analog-Filter mit sanftem Soft-Clip-Drive und interner Nachglättung.', 'Oversampled 24dB analog filter with smooth tanh warmth and post-drive tame LPF.'),
      wiring: 'Slow Random (cvOut) -> Analog Filter (cvCutoff)',
      recipe: {
        name: 'Warm Moog Filter Sweep',
        modules: ['drone', 'slow_random', 'filter', 'reverb'],
        cables: [{ from: 'slow_random:cvOut', to: 'filter:cvCutoff', color: '#10b981' }],
        params: { filter: { cutoff: 1400, reso: 2.4, drive: 0.14 } },
      },
    },
    chorus: {
      desc: t('Warmer Stereo-BBD-Chorus für breite Synth-Flächen.', 'Lush stereo BBD chorus adding analog width and movement.'),
      wiring: 'Keys -> Stereo Chorus -> Ambient Reverb',
      recipe: {
        name: 'Wide Vintage Stereo Chorus',
        modules: ['keys', 'chorus', 'reverb'],
        cables: [],
        params: { chorus: { rate: 0.18, depth: 0.55, mix: 0.45 } },
      },
    },
    tremolo: {
      desc: t('Rhythmische Amplituden- & Autopan-Modulation für Keys und Gitarren-Vibes.', 'Rhythmic amplitude & stereo autopan modulator for vintage electric keys.'),
      wiring: 'Keys -> Tremolo / Pan -> Delay -> Reverb',
      recipe: {
        name: 'Vintage Rhodes Tremolo',
        modules: ['keys', 'tremolo', 'delay', 'reverb'],
        cables: [],
        params: { tremolo: { rate: 3.5, depth: 0.65, pan: 0.6 } },
      },
    },
    lofi: {
      desc: t('Kassetten-Wow & Flutter, warme Bandsättigung und optionaler Bitcrush.', 'Cassette tape wow & flutter, warm tanh saturation, and clean 16-bit bypass.'),
      wiring: 'Chord Glide -> Lo-Fi Tape -> Reverb',
      recipe: {
        name: 'Nostalgic Tape Wobble',
        modules: ['chord_glide', 'lofi', 'reverb'],
        cables: [],
        params: { lofi: { bits: 16, drive: 0.16, tone: 3200, wobble: 0.28 } },
      },
    },
    delay: {
      desc: t('Warm gefiltertes Stereo- und Ping-Pong-Delay mit modulierbarer Time CV.', 'Warm filtered stereo & ping-pong echo with TIME CV modulation for tape pitch warble.'),
      wiring: 'Slow Random (cvOut) -> Stereo Delay (cvTime)',
      recipe: {
        name: 'Tape Echo Pitch Warble',
        modules: ['master_clock', 'euclidean', 'pluck', 'slow_random', 'delay', 'reverb'],
        cables: [
          { from: 'master_clock:clockOut', to: 'euclidean:clockIn', color: '#06b6d4' },
          { from: 'euclidean:trigOut', to: 'pluck:gateIn', color: '#fbbf24' },
          { from: 'slow_random:cvOut', to: 'delay:cvTime', color: '#10b981' },
        ],
        params: { delay: { feedback: 0.52, time: 0.42, tone: 2200, mix: 0.42 } },
      },
    },
    reverb: {
      desc: t('Samtiger Stereo-Hallraum bis 15s mit gedämpftem Hochton-Air.', 'Warm hall reverb up to 15s decay with natural damped high-frequency rolloff.'),
      wiring: 'Drone / Piano Reverb Send -> Ambient Reverb',
      recipe: {
        name: 'Warm Ambient Cathedral',
        modules: ['drone', 'reverb'],
        cables: [],
        params: { reverb: { decay: 11.0, mix: 0.58, damp: 0.62, tone: 2600 } },
      },
    },
    granular_cloud: {
      desc: t('Echtzeit-Stereo-Granularwolke mit Oktav-/Quint-Shimmer & Freeze-Puffer.', 'Real-time microsound granular cloud with octave/fifth shimmer and latched buffer freeze.'),
      wiring: 'Slope Generator (envOut) -> Granular Cloud (cvMix)',
      recipe: {
        name: 'Auto-Breathing Shimmer Cloud',
        modules: ['slope_generator', 'felt_piano', 'granular_cloud', 'reverb'],
        cables: [
          { from: 'slope_generator:envOut', to: 'granular_cloud:cvMix', color: '#10b981' },
        ],
        params: { granular_cloud: { pitchMode: 'octUp', texture: 0.7, feedback: 0.45 } },
      },
    },
  };
}

export class InfoSystem {
  constructor(engine, patchBay, options = {}) {
    this.engine = engine;
    this.patchBay = patchBay;
    this.options = options;
    this.onRackModified = options.onRackModified || null;
    this.onToast = options.onToast || null;
    this.onStartAudio = options.onStartAudio || null;
    this.onLoadTemplate = options.onLoadTemplate || null;
    this.onLoadRackState = options.onLoadRackState || null;
    this.onOpenManual = options.onOpenManual || null;
    this.enabled = localStorage.getItem('synthboard:infoboxes') !== 'false';

    this.tooltipEl = null;
    this.guideModalEl = null;
    this.currentHoverEl = null;
    this.hideTimeout = null;
    this.activeTabId = 'tab-boards';
    this.activeTutCat = 'all';

    this.initDom();
    this.bindEvents();
    this.updateToggleState();
    onLangChange(() => this.refreshGuideLanguage());
  }

  initDom() {
    this.tooltipEl = document.createElement('div');
    this.tooltipEl.id = 'synth-infobox';
    this.tooltipEl.className = 'synth-infobox';
    this.tooltipEl.setAttribute('role', 'tooltip');
    this.tooltipEl.setAttribute('aria-hidden', 'true');
    document.body.appendChild(this.tooltipEl);

    this.createGuideModal();
  }

  toggle() {
    this.enabled = !this.enabled;
    localStorage.setItem('synthboard:infoboxes', String(this.enabled));
    this.updateToggleState();
    this.hideTooltip();
    return this.enabled;
  }

  toggleTooltips() {
    return this.toggle();
  }

  updateToggleState() {
    const btn = document.querySelector('#btn-info');
    if (btn) {
      btn.classList.toggle('on', this.enabled);
      const txt = btn.querySelector('.txt');
      if (txt) txt.textContent = this.enabled ? t('INFO: AN', 'INFO: ON') : t('INFO: AUS', 'INFO: OFF');
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

    if (top < 10) top = rect.bottom + 8;
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
    const btnInfo = document.querySelector('#btn-info');
    if (btnInfo) {
      btnInfo.addEventListener('click', () => {
        const state = this.toggle();
        this.notify(state ? t('Infoboxen aktiviert', 'Tooltips enabled') : t('Infoboxen deaktiviert', 'Tooltips disabled'));
      });
    }

    const btnGuide = document.querySelector('#btn-guide');
    if (btnGuide) {
      btnGuide.addEventListener('click', () => {
        if (this.onOpenManual) this.onOpenManual();
        else this.openGuide('tab-tutorials');
      });
    }

    const footerGuide = document.querySelector('#btn-guide-footer');
    if (footerGuide) {
      footerGuide.addEventListener('click', (e) => {
        e.preventDefault();
        if (this.onOpenManual) this.onOpenManual();
        else this.openGuide('tab-tutorials');
      });
    }

    window.addEventListener('keydown', (e) => {
      const isTyping = (el) => el && ((el.tagName === 'INPUT' && el.type !== 'range') || el?.tagName === 'TEXTAREA' || el?.tagName === 'SELECT');
      if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;

      const k = e.key.toLowerCase();
      if (k === 'i') {
        e.preventDefault();
        this.toggle();
      } else if (k === 'h' || e.key === '?') {
        e.preventDefault();
        if (this.onOpenManual) this.onOpenManual();
        else this.openGuide('tab-cables');
      } else if (k === 't') {
        e.preventDefault();
        this.openGuide('tab-tutorials');
      } else if (k === 'g') {
        e.preventDefault();
        this.openGuide('tab-green-guide');
      } else if (k === 'v') {
        e.preventDefault();
        this.openGuide('tab-boards');
      } else if (e.key === 'Escape' && this.guideModalEl?.classList.contains('open')) {
        this.closeGuide();
      }
    });

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
          return t(
            '<b>Wohin patchen?</b> In <code>Drone: TONE CV</code>, <code>Morph Voice: MORPH CV</code> oder <code>Granular Cloud: MIX CV</code>.<br><b>Wirkung:</b> Langsame, musikalische Swells bis 180s.',
            '<b>Patch target:</b> <code>Drone: TONE CV</code>, <code>Morph Voice: MORPH CV</code>, or <code>Granular Cloud: MIX CV</code>.<br><b>Result:</b> Smooth organic swells up to 180s.'
          );
        case 'slope_generator:invOut':
          return t(
            '<b>Wohin patchen?</b> In <code>Bass: VCA CV</code> oder <code>Pluck: VCA CV</code>.<br><b>Wirkung:</b> Sofortiges Sidechain-Ducking beim Kick oder Pad-Swell.',
            '<b>Patch target:</b> <code>Bass: VCA CV</code> or <code>Pluck: VCA CV</code>.<br><b>Result:</b> Instant rhythmic sidechain ducking.'
          );
        case 'slow_random:cvOut':
          return t(
            '<b>Wohin patchen?</b> In <code>Filter: CUTOFF CV</code>, <code>Delay: TIME CV</code> oder <code>Felt Piano: FELT CV</code>.<br><b>Wirkung:</b> Organische Meeres-Atmung & lebendige Nuancen.',
            '<b>Patch target:</b> <code>Filter: CUTOFF CV</code>, <code>Delay: TIME CV</code>, or <code>Felt Piano: FELT CV</code>.<br><b>Result:</b> Subtle organic breathing & humanization.'
          );
        case 'attenuverter:outA':
        case 'attenuverter:outB':
        case 'attenuverter:sumOut':
          return t(
            '<b>Wohin patchen?</b> In jeden grünen Modulations-Eingang.<br><b>Wirkung:</b> Bändigt starke LFOs auf zarte 10–25% oder kehrt die Richtung um.',
            '<b>Patch target:</b> Any green modulation CV input.<br><b>Result:</b> Tames extreme LFOs to delicate 10–25% nuances or flips polarity.'
          );
        default:
          return t(
            'Verbinde diesen grünen CV-Ausgang mit einem grünen Modulations-Eingang, um Regler automatisch zu bewegen.',
            'Connect this green CV output to any green modulation input to animate knobs hands-free.'
          );
      }
    }

    switch (`${modType}:${portId}`) {
      case 'filter:cvCutoff':
        return t('<b>Quelle:</b> <code>Slow Random: CV OUT</code> oder <code>Slope: ENV OUT</code> bewegt die Grenzfrequenz fließend.', '<b>Source:</b> <code>Slow Random: CV OUT</code> or <code>Slope: ENV OUT</code> sweeps filter cutoff smoothly.');
      case 'delay:cvTime':
        return t('<b>Quelle:</b> <code>Slow Random: CV OUT</code> erzeugt subtiles Tape-Pitch-Warble.', '<b>Source:</b> <code>Slow Random: CV OUT</code> introduces vintage tape wow & pitch warble.');
      case 'felt_piano:feltCv':
        return t('<b>Quelle:</b> <code>Slow Random: CV OUT</code> lässt den Klavier-Filz dynamisch weicher und offener atmen.', '<b>Source:</b> <code>Slow Random: CV OUT</code> shifts felt hammer warmth dynamically across notes.');
      case 'violin:bowCv':
        return t('<b>Quelle:</b> <code>Slope: ENV OUT</code> oder <code>Slow Random: CV OUT</code> steuert den Bogen-Anpressdruck.', '<b>Source:</b> <code>Slope: ENV OUT</code> or <code>Slow Random: CV OUT</code> modulates expressive bow pressure.');
      case 'morph_voice:morphCv':
        return t('<b>Quelle:</b> <code>Slope: ENV OUT</code> fährt nahtlos durch alle 8 Wellenformen.', '<b>Source:</b> <code>Slope: ENV OUT</code> morphs continuously across all 8 spectral worlds.');
      case 'hybrid_perc:timbreCv':
        return t('<b>Quelle:</b> <code>Slow Random: CV OUT</code> lässt jeden Trommelschlag zwischen Holz und Metall variieren.', '<b>Source:</b> <code>Slow Random: CV OUT</code> mutates each drum hit from wood membrane to metal.');
      case 'resonator_garden:materialCv':
      case 'resonator_garden:dampCv':
        return t('<b>Quelle:</b> <code>Slow Random: CV OUT</code> oder <code>Slope: INV OUT</code> variiert Resonanzkörper & Ausklang.', '<b>Source:</b> <code>Slow Random: CV OUT</code> or <code>Slope: INV OUT</code> shifts modal resonance & sustain.');
      case 'spectral_swarm:cohesionCv':
        return t('<b>Quelle:</b> <code>Slope: ENV OUT</code> zieht 32 chaotische Teiltöne zu einem reinen Akkord zusammen.', '<b>Source:</b> <code>Slope: ENV OUT</code> gathers 32 drifting partials into a pure harmonic chord.');
      case 'granular_cloud:cvMix':
      case 'granular_cloud:cvTexture':
        return t('<b>Quelle:</b> <code>Slope: ENV OUT</code> oder <code>Slow Random: INV OUT</code> lässt Shimmer-Wolken atmen.', '<b>Source:</b> <code>Slope: ENV OUT</code> or <code>Slow Random: INV OUT</code> swells granular shimmer density.');
      default:
        if (portId === 'vcaCv') {
          return t('<b>Quelle:</b> <code>Slope: ENV OUT</code> für Swells oder <code>Slope: INV OUT</code> für Sidechain-Ducking.', '<b>Source:</b> <code>Slope: ENV OUT</code> for swells or <code>Slope: INV OUT</code> for ducking.');
        }
        if (portId === 'panCv') {
          return t('<b>Quelle:</b> <code>Slow Random: CV OUT</code> für sanfte Stereo-Bewegung.', '<b>Source:</b> <code>Slow Random: CV OUT</code> drifts sound smoothly across stereo L/R.');
        }
        return t('Empfängt stufenlose Steuerspannung (Modulation CV) zur Automation dieses Parameters.', 'Receives continuous control voltage (CV) to animate this parameter automatically.');
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

    const jackHelp = getJackHelpMap();
    const typeLabel = jMeta.type === 'out' ? t('AUSGANG (OUT)', 'OUTPUT (OUT)') : t('EINGANG (IN)', 'INPUT (IN)');
    const sigColor = SIGNAL_COLORS[jMeta.signal] || '#fbbf24';
    const sigNames = {
      gate: t('Gate / Trigger (Impuls)', 'Gate / Trigger (Pulse)'),
      pitch: t('Pitch CV (Tonhöhe 1V/Okt)', 'Pitch CV (1V/Oct Note)'),
      mod: t('Modulation CV (Steuerspannung)', 'Modulation CV (Control Voltage)'),
      clock: t('Clock / Sync (Takt)', 'Clock / Sync (Timing)'),
      audio: t('Audiosignal', 'Audio Signal'),
    };
    const sigName = sigNames[jMeta.signal] || jMeta.signal.toUpperCase();

    const conns = this.engine.patchSystem.getConnections();
    const activeConns = conns.filter((c) => (
      (jMeta.type === 'out' && c.fromModuleId === modId && c.fromPortId === portId) ||
      (jMeta.type === 'in' && c.toModuleId === modId && c.toPortId === portId)
    ));

    let statusText = '';
    if (activeConns.length > 0) {
      const targets = activeConns.map((c) => {
        const otherId = jMeta.type === 'out' ? c.toModuleId : c.fromModuleId;
        const otherPort = jMeta.type === 'out' ? c.toPortId : c.fromPortId;
        const otherMod = this.engine.find(otherId);
        return `<b>${otherMod?.meta.title || otherId}</b> (${otherPort})`;
      }).join(', ');
      statusText = `<div class="info-conn-state connected">${t('Verbunden mit', 'Connected to')}: ${targets}<br><small>${t('Rechtsklick auf Buchse trennt Kabel', 'Right-click jack to unpatch')}</small></div>`;
    } else {
      statusText = `<div class="info-conn-state empty">${t('Nicht verbunden', 'Unpatched')}<br><small>${jMeta.type === 'out' ? t('Klicke & ziehe zu einem Eingang', 'Drag to any compatible input jack') : t('Klicke & ziehe von einem Ausgang hierher', 'Drag from a matching output jack')}</small></div>`;
    }

    const lookupKey = `${mod.meta.type}:${portId}`;
    const specificHelp = jackHelp[lookupKey]?.desc || t(`Überträgt ein ${sigName}-Signal für ${mod.meta.title}.`, `Carries a ${sigName} signal for ${mod.meta.title}.`);

    let greenTipHtml = '';
    if (jMeta.signal === 'mod') {
      const tipText = this.getGreenJackTips(mod.meta.type, portId, jMeta.type === 'out');
      greenTipHtml = `
        <div class="info-green-tips">
          <div class="green-tip-title">${t('CV-Partner & Klangwirkung', 'CV Partner & Sonic Effect')}</div>
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
    const knobHelp = getKnobHelpMap();

    const normKey = labelText.toLowerCase().replace(/[^a-z0-9]/g, '');
    let desc = knobHelp[normKey];
    if (!desc) {
      if (normKey.includes('cut')) desc = knobHelp.cutoff;
      else if (normKey.includes('res')) desc = knobHelp.reso;
      else if (normKey.includes('vol') || normKey.includes('level')) desc = t('Regelt die Ausgabelautstärke dieses Moduls.', 'Controls module output level.');
      else if (normKey.includes('decay') || normKey.includes('damp')) desc = knobHelp.decay;
      else if (normKey.includes('att')) desc = knobHelp.attack;
      else if (normKey.includes('rel')) desc = knobHelp.release;
      else desc = t(`Steuert „${labelText}“. Doppelklick setzt auf Standardwert zurück.`, `Controls "${labelText}". Double-click resets to default.`);
    }

    const html = `
      <div class="info-title">${t('Regler', 'Control')}: <b>${labelText}</b> <span class="info-val-badge">${valText}</span></div>
      <div class="info-desc">${desc}</div>
      <div class="info-hint"><small>${t('Ziehen zum Einstellen · Doppelklick für Standard · Shift+Klick für Live-Controls', 'Drag to adjust · Double-click resets · Shift+Click pins to Live Controls')}</small></div>
    `;

    this.showTooltip(knobCell, html, 'var(--accent)');
  }

  handleModuleHover(card, btn) {
    const modId = card.dataset.id;
    const mod = this.engine.find(modId);
    if (!mod) return;
    const M = mod.meta;

    const catLabels = {
      control: t('Steuerung & Generatoren', 'Control & Rhythm'),
      source: t('Klangquelle & Stimme', 'Instrument / Sound Source'),
      effect: t('Master-Effekt', 'Master Effect'),
    };

    const jackList = (M.jacks || []).map((j) => {
      const col = SIGNAL_COLORS[j.signal] || '#aaa';
      return `<span class="info-pill" style="border-left: 3px solid ${col};">${j.type.toUpperCase()}: ${j.label}</span>`;
    }).join('');

    const html = `
      <div class="info-badge-row">
        <span class="info-badge ${M.category}">${catLabels[M.category] || M.category}</span>
      </div>
      <div class="info-title"><b>${tr(M.title)}</b></div>
      <div class="info-desc">${tr(M.description)}</div>
      ${jackList ? `<div class="info-jacks-preview"><b>${t('Patch-Buchsen', 'Patch Jacks')}:</b><div class="pills-wrap">${jackList}</div></div>` : ''}
    `;

    this.showTooltip(btn, html, M.color);
  }

  // ───────────────────────── Modal Construction ──
  createGuideModal() {
    this.guideModalEl = document.createElement('div');
    this.guideModalEl.id = 'guide-modal';
    this.guideModalEl.className = 'guide-modal';
    this.renderGuideShell();
    document.body.appendChild(this.guideModalEl);
  }

  renderGuideShell() {
    if (!this.guideModalEl) return;
    const modCount = Object.keys(MODULES).length;
    const isTab = (id) => (this.activeTabId === id ? 'active' : '');

    this.guideModalEl.innerHTML = `
      <div class="guide-backdrop"></div>
      <div class="guide-window">
        <header class="guide-header">
          <div class="guide-title-wrap">
            <span class="guide-logo">SB</span>
            <div>
              <h2>${t('SYNTHBOARD Studio-Guide &amp; Interaktive Tutorials', 'SYNTHBOARD Studio Guide &amp; Interactive Tutorials')}</h2>
              <p>${t('Praxisnahe Patch-Tutorials, grüne CV-Modulationsmatrix &amp; komplette Modul-Referenz', 'In-depth modular patching tutorials, green CV modulation matrix &amp; complete module encyclopedia')}</p>
            </div>
          </div>
          <button type="button" class="guide-close" title="${t('Schließen [Esc]', 'Close [Esc]')}">✕</button>
        </header>

        <nav class="guide-tabs" role="tablist">
          <button type="button" class="guide-tab-btn ${isTab('tab-boards')}" data-tab="tab-boards">${t('Vorlagen &amp; Boards', 'Templates &amp; Boards')}</button>
          <button type="button" class="guide-tab-btn ${isTab('tab-tutorials')}" data-tab="tab-tutorials">${t('Modul-Tutorials (16)', 'Module Tutorials (16)')}</button>
          <button type="button" class="guide-tab-btn ${isTab('tab-green-guide')}" data-tab="tab-green-guide">${t('CV-Modulations-Matrix', 'CV Modulation Matrix')}</button>
          <button type="button" class="guide-tab-btn ${isTab('tab-cables')}" data-tab="tab-cables">${t('Kabel &amp; Signale', 'Cables &amp; Signals')}</button>
          <button type="button" class="guide-tab-btn ${isTab('tab-zones')}" data-tab="tab-zones">${t('Studio-Architektur', 'Rack Architecture')}</button>
          <button type="button" class="guide-tab-btn ${isTab('tab-modules')}" data-tab="tab-modules">${t(`Modul-Lexikon (${modCount})`, `Module Lexicon (${modCount})`)}</button>
          <button type="button" class="guide-tab-btn ${isTab('tab-recipes')}" data-tab="tab-recipes">${t('Rezepte &amp; Shortcuts', 'Recipes &amp; Shortcuts')}</button>
        </nav>

        <main class="guide-body">
          <!-- TAB 0: TEMPLATES & BOARDS -->
          <section id="tab-boards" class="guide-tab-pane ${isTab('tab-boards')}">
            <div class="green-guide-intro">
              <div class="intro-kicker">STUDIO BOARDS · VERSION 2</div>
              <h3>${t('Vorlagen &amp; Komplette Racks', 'Studio Templates &amp; Full Racks')}</h3>
              <p>${t(
                'Jedes Board ist ein vollständig verdrahtetes Modular-Instrument mit vorbereiteten Performance-Snapshots. Klicke auf <b>Board laden &amp; abspielen</b>, um sofort loszuhören oder darauf aufzubauen.',
                'Each template is a complete, pre-wired modular synth patch with Performance Snapshots. Click <b>Load &amp; Play Board</b> to audition and customize it immediately.'
              )}</p>
            </div>
            <div id="boards-container" class="boards-grid"></div>
          </section>

          <!-- TAB 1: MODULE TUTORIALS -->
          <section id="tab-tutorials" class="guide-tab-pane ${isTab('tab-tutorials')}">
            <div class="green-guide-intro">
              <div class="intro-kicker">HANDS-ON CURRICULUM · 16 MODULES</div>
              <h3>${t('Intensiv-Tutorials: Signalfluss, Buchsen &amp; Patch-Rezepte', 'In-Depth Tutorials: Signal Flow, Jacks &amp; Interactive Racks')}</h3>
              <p>${t(
                'Jede Lektion erklärt präzise, wie das Modul musikalisch funktioniert, welche Steuer- und Modulationsbuchsen zusammenwirken und welchen hörbaren Effekt jedes Kabel erzeugt. Lade entweder das saubere Tutorial-Rack direkt oder ergänze die Schaltung in dein laufendes Board.',
                'Every lesson breaks down the musical role of each module, its canonical jacks, actionable step-by-step knob settings, and audible modulation payoff. Load a clean isolated tutorial patch or splice the chain directly into your active board.'
              )}</p>
              <div class="tut-filter-row" id="tut-filter-row">
                <button type="button" class="pill ${this.activeTutCat === 'all' ? 'active' : ''}" data-tut-cat="all">${t('Alle (16)', 'All (16)')}</button>
                <button type="button" class="pill ${this.activeTutCat === 'harmony' ? 'active' : ''}" data-tut-cat="harmony">${t('Harmonie &amp; Tasten', 'Harmony &amp; Acoustic')}</button>
                <button type="button" class="pill ${this.activeTutCat === 'modulation' ? 'active' : ''}" data-tut-cat="modulation">${t('Modulation &amp; Logik', 'Modulation &amp; Logic')}</button>
                <button type="button" class="pill ${this.activeTutCat === 'rhythm' ? 'active' : ''}" data-tut-cat="rhythm">${t('Rhythmus &amp; Song Mode', 'Rhythm &amp; Song Mode')}</button>
                <button type="button" class="pill ${this.activeTutCat === 'texture' ? 'active' : ''}" data-tut-cat="texture">${t('Sounddesign &amp; FX', 'Sound Design &amp; FX')}</button>
              </div>
            </div>
            <div id="tutorials-container" class="tut-grid"></div>
          </section>

          <!-- TAB 2: CV MODULATION MATRIX -->
          <section id="tab-green-guide" class="guide-tab-pane ${isTab('tab-green-guide')}">
            <div class="green-guide-intro">
              <div class="intro-kicker">CONTROL VOLTAGE GUIDE</div>
              <h3>${t('Grüne CV-Buchsen richtig patchen', 'Mastering Green Modulation CV Jacks')}</h3>
              <p>${t(
                'Grüne Kabel übertragen <b>Steuerspannung (Control Voltage / CV)</b> – kontinuierliche Bewegungen wie LFOs oder Hüllkurven, die Regler automatisch und musikalisch mitbewegen.',
                'Green cables carry <b>Control Voltage (CV)</b> – continuous motion from LFOs and envelopes that turn filter, felt, bow, or delay knobs hands-free in real time.'
              )}</p>
              <div class="green-rules-grid">
                <div class="green-rule-card">
                  <h5>${t('1. Ausgang nach Eingang', '1. Green OUT to Green IN')}</h5>
                  <p>${t('<b>OUT</b> sendet eine Kurve (z. B. Slope ENV OUT), <b>IN</b> moduliert das Klangziel (z. B. Filter CUTOFF CV).', '<b>OUT</b> emits motion curves (e.g. Slope ENV OUT) and <b>IN</b> animates target tone controls (e.g. CUTOFF CV).')}</p>
                </div>
                <div class="green-rule-card">
                  <h5>${t('2. Ein Ausgang, viele Ziele', '2. Fan Out (Multiple)')}</h5>
                  <p>${t('Ein CV-Ausgang darf beliebig viele Eingänge gleichzeitig speisen, sodass Instrumente gemeinsam atmen.', 'One green CV output can drive multiple destinations at once so voices breathe together.')}</p>
                </div>
                <div class="green-rule-card">
                  <h5>${t('3. Stärke am Kabel dosieren', '3. Dial Cable Depth')}</h5>
                  <p>${t('Ziehe am kleinen Prozent-Badge direkt auf dem Kabel (0–200%) oder nutze den <b>Attenuverter</b> für subtile Nuancen.', 'Drag the percentage badge directly on any modulation cable (0–200%) or insert an <b>Attenuverter</b>.')}</p>
                </div>
              </div>
            </div>
            <h4 class="guide-subhead">${t('Die wichtigsten grünen Patch-Paare (1-Klick Live-Test)', 'Essential CV Pairs (1-Click Live Patch)')}</h4>
            <p class="guide-subdesc">${t('Klicke auf <b>Verbinden</b>, um das Paar live in dein aktuelles Rack zu patchen.', 'Click <b>Connect</b> to wire that modulation pair live into your active rack.')}</p>
            <div id="green-matrix-container" class="green-matrix-table"></div>
          </section>

          <!-- TAB 3: CABLES & SIGNALS -->
          <section id="tab-cables" class="guide-tab-pane ${isTab('tab-cables')}">
            <div class="guide-hero">
              <h3>${t('Modulares Patching in SYNTHBOARD', 'Modular Patching Essentials')}</h3>
              <p>${t(
                'Verbinde Steuersignale frei wie bei einem echten Eurorack. Jede Kabelfarbe steht für einen eindeutigen Signaltyp.',
                'Route timing, gates, pitch, and modulation freely like hardware Eurorack. Every cable color represents a distinct signal class.'
              )}</p>
            </div>
            <div class="guide-steps-grid">
              <div class="guide-step-card">
                <div class="step-num">1</div>
                <h4>${t('Kabel ziehen', 'Draw a Cable')}</h4>
                <p>${t('Klicke auf eine Ausgangs- oder Eingangsbuchse, halte gedrückt und ziehe zur Zielbuchse.', 'Click and drag from any output jack to a compatible input jack (or vice versa).')}</p>
              </div>
              <div class="guide-step-card">
                <div class="step-num">2</div>
                <h4>${t('Kabel trennen', 'Unpatch Cleanly')}</h4>
                <p>${t('Mache einen <b>Rechtsklick</b> auf eine belegte Buchse, um das Kabel sofort abzuziehen.', '<b>Right-click</b> any occupied jack to unplug cables immediately.')}</p>
              </div>
              <div class="guide-step-card">
                <div class="step-num">3</div>
                <h4>${t('Multiple vs. Eingang', 'Outputs vs Inputs')}</h4>
                <p>${t('<b>Ausgänge (OUT)</b> verzweigen beliebig oft. <b>Eingänge (IN)</b> nehmen genau 1 aktives Kabel entgegen.', '<b>Outputs (OUT)</b> fan out to many targets. <b>Inputs (IN)</b> accept one clean source at a time.')}</p>
              </div>
              <div class="guide-step-card">
                <div class="step-num">4</div>
                <h4>${t('Tiefe &amp; Sichtbarkeit', 'Depth &amp; Visibility')}</h4>
                <p>${t('Stelle die Modulationstiefe am Kabel-Badge ein oder blende Kabel per Taste <b>C</b> aus.', 'Adjust modulation depth directly on CV cable badges or toggle cable visibility with <b>C</b>.')}</p>
              </div>
            </div>

            <h3 class="guide-subhead">${t('Die 4 Signaltypen &amp; Kabelfarben', 'The 4 Patch Signal Types')}</h3>
            <div class="signal-types-table">
              <div class="sig-row" style="border-left: 4px solid #10b981;">
                <span class="sig-pill" style="background:#10b98122; color:#10b981;">MODULATION CV (GREEN)</span>
                <div class="sig-details">
                  <b>${t('Fließende Steuerspannung', 'Continuous Control Voltage')}</b> · ${t('LFOs, Hüllkurven, Makros für Filter Cutoff, Felt, Bow, Delay Time &amp; Cohesion.', 'Slow LFOs, envelopes, and macros driving Filter Cutoff, Felt, Bow Pressure, Delay Time &amp; Swarm Cohesion.')}
                </div>
              </div>
              <div class="sig-row" style="border-left: 4px solid #06b6d4;">
                <span class="sig-pill" style="background:#06b6d422; color:#06b6d4;">CLOCK / SYNC (CYAN)</span>
                <div class="sig-details">
                  <b>${t('Takt &amp; Song-Timing', 'Clock &amp; Bar Sync')}</b> · ${t('1/16, 1/8, 1/4 &amp; 1 Bar Impulse für Clock Divider, Sequenzer, Arp und Snapshot Song Mode.', '1/16, 1/8, 1/4 &amp; 1 Bar pulses syncing Dividers, Sequencers, Chord Glide, and Snapshot Song Mode.')}
                </div>
              </div>
              <div class="sig-row" style="border-left: 4px solid #fbbf24;">
                <span class="sig-pill" style="background:#fbbf2422; color:#fbbf24;">GATE / TRIGGER (AMBER)</span>
                <div class="sig-details">
                  <b>${t('Anschlag &amp; Auslöser', 'Note Gate &amp; Trigger')}</b> · ${t('Startet Noten, Drum-Hits, Hüllkurven oder Kaskaden-Logik (EOF / PASSED).', 'Fires note envelopes, drum hits, sample-and-hold clocks, and EOF/Logic cascade chains.')}
                </div>
              </div>
              <div class="sig-row" style="border-left: 4px solid #a855f7;">
                <span class="sig-pill" style="background:#a855f722; color:#a855f7;">PITCH CV (VIOLET)</span>
                <div class="sig-details">
                  <b>${t('Tonhöhe &amp; Harmonie (1V/Okt)', 'Pitch &amp; Chords (1V/Oct)')}</b> · ${t('Trägt Einzelnoten oder komplette polyphone Chord-Glide-Voicings zu Arps &amp; Stimmen.', 'Carries melodies, Bass roots, or full polyphonic Chord Glide voicings across instruments.')}
                </div>
              </div>
            </div>
          </section>

          <!-- TAB 4: STUDIO ARCHITECTURE -->
          <section id="tab-zones" class="guide-tab-pane ${isTab('tab-zones')}">
            <div class="guide-hero">
              <h3>${t('Die 3 Studio-Ebenen &amp; Aux-Routing', 'Three Studio Layers &amp; Aux Mixing')}</h3>
              <p>${t(
                'SYNTHBOARD kombiniert ein frei positionierbares Google-Maps-Rack mit getrenntem Stereo-Kanalzug (Pan, Delay Send, Reverb Send) und serieller Master-Effektkette.',
                'SYNTHBOARD pairs a free-canvas patch workspace with per-voice Channel Strips (Pan, Delay Send, Reverb Send) feeding a serial master insert chain + stereo aux sends.'
              )}</p>
            </div>
            <div class="zones-explainer">
              <div class="zone-box ctrl-border">
                <div class="zone-badge">${t('EBENE 1 · STEUERUNG', 'LAYER 1 · CONTROL')}</div>
                <h4>${t('Clocks, Sequenzer, Logik &amp; Song-Automation', 'Clocks, Sequencers, Logic &amp; Song Automation')}</h4>
                <p>Master Clock, Clock Divider, Euclidean Rhythm, Probability Gate, Random Walk, Scale Quantizer, Slow Random, Macro, Slope Generator, Attenuverter, CV Logic &amp; Switch, Snapshot Controller, Chord Arpeggiator.</p>
                <div class="zone-note">${t('Hier entstehen Puls, Melodie, Zufall, Dynamik und der taktgenaue Song-Ablaufplan.', 'Rhythmic pulse, melodies, probability, modulation curves, and Song Mode bar orchestration originate here.')}</div>
              </div>
              <div class="zone-connector">${t('CV-, Gate- &amp; Pitch-Kabel steuern alle Stimmen', 'Clock, Gate, Pitch &amp; CV cables drive instruments')}</div>
              <div class="zone-box src-border">
                <div class="zone-badge">${t('EBENE 2 · KLANGQUELLEN', 'LAYER 2 · VOICES')}</div>
                <h4>${t('Instrumente &amp; Integrierter Kanalzug', 'Instruments &amp; Per-Voice Channel Strip')}</h4>
                <p>Chord Glide, Solo Violin, Felt Piano, Drone Machine, Pluck Synth, FM Bell, Analog Bass, Drum Rack, Touch Keys, Step Sequencer, Noise Texture, Morph Voice, Hybrid Percussion, Resonator Garden, Spectral Swarm.</p>
                <div class="zone-note">${t('Unten an jedem Instrument sitzen PAN, DELAY SEND und REVERB SEND – so bleiben Kicks &amp; Bässe trocken und klar, während Chords und Strings weit im Hall schweben.', 'Every instrument has dedicated PAN, DELAY SEND, and REVERB SEND sliders so basses stay punchy and dry while pads bloom in space.')}</div>
              </div>
              <div class="zone-connector">${t('Stereo-Dry + Aux-Sends speisen Master-Effekte', 'Stereo Dry + Aux Sends feed Master Effects')}</div>
              <div class="zone-box fx-border">
                <div class="zone-badge">${t('EBENE 3 · MASTER-EFFEKTE', 'LAYER 3 · MASTER FX')}</div>
                <h4>${t('Serielle Insert-Kette &amp; Aux-Raum', 'Serial Inserts &amp; Spatial Aux Busses')}</h4>
                <p>Analog Filter · Chorus · Tremolo / Pan · Lo-Fi Tape · Granular Cloud · Aux Stereo Delay · Aux Ambient Reverb · Master Limiter.</p>
                <div class="zone-note">${t('Effekte lassen sich mit ◀ ▶ beliebig umsortieren. Übersampeltes Soft-Clipping sorgt automatisch für warme Höhen.', 'Reorder insert effects anytime with ◀ ▶ controls; oversampled tanh stages preserve warm analog highs.')}</div>
              </div>
            </div>
          </section>

          <!-- TAB 5: MODULE LEXICON -->
          <section id="tab-modules" class="guide-tab-pane ${isTab('tab-modules')}">
            <div class="module-search-bar">
              <input type="text" id="guide-module-search" placeholder="${t('Modul, Parameter oder Buchse suchen (z. B. barIn, feltCv, cohesion)...', 'Search modules, parameters, or jacks (e.g. barIn, feltCv, cohesion)...')}" />
              <div class="filter-pills">
                <button type="button" class="pill active" data-cat="all">${t('Alle', 'All')}</button>
                <button type="button" class="pill" data-cat="control">${t('Steuerung', 'Control')}</button>
                <button type="button" class="pill" data-cat="source">${t('Klangquellen', 'Instruments')}</button>
                <button type="button" class="pill" data-cat="effect">${t('Effekte', 'Effects')}</button>
              </div>
            </div>
            <div id="guide-modules-list" class="guide-modules-list"></div>
          </section>

          <!-- TAB 6: RECIPES & SHORTCUTS -->
          <section id="tab-recipes" class="guide-tab-pane ${isTab('tab-recipes')}">
            <div class="guide-hero">
              <h3>${t('Praxis-Rezepte &amp; Studio-Shortcuts', 'Quick Recipes &amp; Workflow Shortcuts')}</h3>
              <p>${t('Bewährte Signal-Schaltungen zum schnellen Nachbauen im freien Rack:', 'Proven hardware-inspired patching patterns you can wire up in seconds:')}</p>
            </div>
            <div class="recipes-grid">
              <div class="recipe-card">
                <div class="recipe-tag">RECIPE 01 · AMBIENT HARP</div>
                <h4>${t('Generative Hirajoshi-Harfe', 'Generative Hirajoshi Harp')}</h4>
                <p>${t('Endlose meditative Zupf-Melodien mit Ping-Pong-Echo.', 'Self-evolving plucks gliding smoothly through stereo ping-pong repeats.')}</p>
                <ol class="recipe-steps">
                  <li><code>master_clock:clockOut</code> -> <code>euclidean:clockIn</code> (16 Steps, 5 Hits)</li>
                  <li><code>euclidean:trigOut</code> -> <code>random_walk:clockIn</code> &amp; <code>pluck:gateIn</code></li>
                  <li><code>random_walk:pitchOut</code> -> <code>pluck:pitchIn</code> (Scale: Hirajoshi)</li>
                  <li>${t('Reverb &amp; Delay Send am Pluck auf 45% drehen.', 'Raise Pluck Delay &amp; Reverb sends to 45%.')}</li>
                </ol>
              </div>

              <div class="recipe-card">
                <div class="recipe-tag">RECIPE 02 · POLYRHYTHM</div>
                <h4>${t('Euklidischer Club-Groove', 'Euclidean Polyrhythm Kit')}</h4>
                <p>${t('Treibt Kick, Snare &amp; offbeat Hats aus Division und Euklidik.', 'Locks straight 4/4 foundations against odd polyrhythmic hi-hat accents.')}</p>
                <ol class="recipe-steps">
                  <li><code>master_clock:clockOut</code> -> <code>clock_divider:clockIn</code> &amp; <code>euclidean:clockIn</code></li>
                  <li><code>clock_divider:div4Out</code> -> <code>drum_rack:trigKick</code></li>
                  <li><code>clock_divider:div8Out</code> -> <code>drum_rack:trigSnare</code></li>
                  <li><code>euclidean:trigOut</code> (13 / 7) -> <code>drum_rack:trigHat</code></li>
                </ol>
              </div>

              <div class="recipe-card">
                <div class="recipe-tag">RECIPE 03 · SONG MODE</div>
                <h4>${t('Automatischer Part-Ablauf (8/8/16)', 'Automated Song Arrangement (8/8/16)')}</h4>
                <p>${t('Intro, Build-Up, Drop &amp; Breakdown exakt nach Taktzahl wechseln.', 'Advance Intro, Build-Up, Drop &amp; Breakdown hands-free with distinct bar counts.')}</p>
                <ol class="recipe-steps">
                  <li>${t('Lege Szenen auf <b>Preset Slots 1–5</b> ab.', 'Save scenes into <b>Preset Slots 1–5</b>.')}</li>
                  <li><code>master_clock:barOut</code> -> <code>snapshot_ctrl:barIn</code></li>
                  <li>${t('Stelle <code>autoRun: 1</code>, <code>bars1: 8</code>, <code>bars2: 8</code>, <code>bars3: 16</code> ein.', 'Set <code>autoRun: 1</code>, <code>bars1: 8</code>, <code>bars2: 8</code>, <code>bars3: 16</code>.')}</li>
                  <li>${t('<code>barsN = 0</code> überspringt den Slot; <code>loop</code> wählt Repeat vs. One-Shot.', 'Set <code>barsN = 0</code> to skip a slot; toggle <code>loop</code> for One-Shot vs Repeat.')}</li>
                </ol>
              </div>

              <div class="recipe-card">
                <div class="recipe-tag">RECIPE 04 · SIDECHAIN</div>
                <h4>${t('40s Swell &amp; Sub-Ducking', 'Sidechain Ducking &amp; Pad Swells')}</h4>
                <p>${t('Sauberer Mix durch gegenläufige Hüllkurven ohne Pumpen.', 'Keep low-end mixes transparent using opposite Slope polarity.')}</p>
                <ol class="recipe-steps">
                  <li><code>master_clock:div4Out</code> -> <code>slope_generator:trigIn</code> (Mode: <code>trig</code>)</li>
                  <li>Rise <code>0.02s</code>, Fall <code>0.32s</code></li>
                  <li><code>slope_generator:invOut</code> -> <code>bass:vcaCv</code> (Depth 85%)</li>
                  <li>${t('Oder im Loop-Modus (12s / 24s) <code>envOut</code> -> <code>drone:vcaCv</code>.', 'Or loop 12s / 24s <code>envOut</code> -> <code>drone:vcaCv</code> for ambient swells.')}</li>
                </ol>
              </div>
            </div>

            <h3 class="guide-subhead">${t('Tastatur-Shortcuts', 'Keyboard Shortcuts')}</h3>
            <div class="shortcuts-grid">
              <div class="sc-item"><kbd>Space</kbd><span>${t('Audio-Engine Start / Pause', 'Audio Engine On / Pause')}</span></div>
              <div class="sc-item"><kbd>1–5</kbd><span>${t('Performance-Snapshots abrufen', 'Recall Performance Snapshots')}</span></div>
              <div class="sc-item"><kbd>6–8</kbd><span>${t('Morph Speed: Direkt / Glide / Slow', 'Morph Speed: Direct / Glide / Slow')}</span></div>
              <div class="sc-item"><kbd>Shift+Click</kbd><span>${t('Regler in Live-Controls pinnen', 'Pin any knob to Live Controls')}</span></div>
              <div class="sc-item"><kbd>T</kbd><span>${t('Modul-Tutorials öffnen', 'Open Module Tutorials')}</span></div>
              <div class="sc-item"><kbd>G</kbd><span>${t('CV-Modulations-Matrix öffnen', 'Open CV Modulation Matrix')}</span></div>
              <div class="sc-item"><kbd>V</kbd><span>${t('Vorlagen &amp; Boards Galerie', 'Templates &amp; Boards Gallery')}</span></div>
              <div class="sc-item"><kbd>H</kbd><span>${t('Studio-Handbuch &amp; PDF-Export', 'Open Studio Manual &amp; PDF')}</span></div>
              <div class="sc-item"><kbd>C</kbd><span>${t('Patch-Kabel ein-/ausblenden', 'Toggle Patch Cables')}</span></div>
              <div class="sc-item"><kbd>O / F</kbd><span>${t('Alles im Blick / Auf Bildschirm einpassen', 'Overview / Fit Workspace')}</span></div>
              <div class="sc-item"><kbd>I</kbd><span>${t('Hover-Tooltips umschalten', 'Toggle Hover Info Tooltips')}</span></div>
              <div class="sc-item"><kbd>A–K</kbd><span>${t('Touch Keys live auf Tastatur spielen', 'Play Touch Keys on QWERTY keyboard')}</span></div>
            </div>
          </section>
        </main>
      </div>
    `;

    this.bindGuideModalEvents();
  }

  bindGuideModalEvents() {
    if (!this.guideModalEl) return;

    this.guideModalEl.querySelector('.guide-close')?.addEventListener('click', () => this.closeGuide());
    this.guideModalEl.querySelector('.guide-backdrop')?.addEventListener('click', () => this.closeGuide());

    const tabBtns = this.guideModalEl.querySelectorAll('.guide-tab-btn');
    const panes = this.guideModalEl.querySelectorAll('.guide-tab-pane');
    tabBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        this.activeTabId = btn.dataset.tab;
        tabBtns.forEach((b) => b.classList.remove('active'));
        panes.forEach((p) => p.classList.remove('active'));
        btn.classList.add('active');
        this.guideModalEl.querySelector(`#${btn.dataset.tab}`)?.classList.add('active');
      });
    });

    this.renderBoardsGallery();
    this.renderTutorials(this.activeTutCat);
    this.renderGreenGuide();
    this.renderGuideModulesList();
    this.setupGuideSearch();
    this.setupTutorialFilters();
  }

  refreshGuideLanguage() {
    if (!this.guideModalEl) return;
    const wasOpen = this.guideModalEl.classList.contains('open');
    this.renderGuideShell();
    this.updateToggleState();
    if (wasOpen) {
      this.guideModalEl.classList.add('open');
    }
    applyTranslations(this.guideModalEl);
  }

  // ───────────────────────── 16 Intensive Tutorials ──
  getTutorialData() {
    return [
      {
        id: 'tut-chord-glide',
        cat: 'harmony',
        badge: 'HARMONY ENGINE · SOURCE',
        color: '#a855f7',
        title: 'Chord Glide: Polyphonic Voice Leading & Harmonic Spine',
        desc: t(
          '<b>Chord Glide</b> ist das harmonische Rückgrat für Ambient, Cinematic und Electronica. Es verbindet Akkordwechsel über minimale Stimmabstände (Voice Leading) und gibt sowohl ein warmes Poly-Pad als auch <code>POLY PITCH</code> (für Felt Piano/Arps) und <code>ROOT PITCH</code> (für Bass/Drone) aus.',
          '<b>Chord Glide</b> is SYNTHBOARD’s harmonic brain. It voices chord progressions with smooth voice leading, plays an internal lush poly pad, and broadcasts both <code>POLY PITCH</code> (for Felt Piano &amp; Arps) and <code>ROOT PITCH</code> (for Bass &amp; Drone).'
        ),
        greenJacks: [
          { id: 'pitchOut', type: 'out', label: 'POLY PITCH', desc: t('Sendet alle Akkord-Stimmen polyphon an Felt Piano oder Chord Arp.', 'Broadcasts polyphonic chord voices to Felt Piano, Touch Keys, or Chord Arp.') },
          { id: 'rootOut', type: 'out', label: 'ROOT PITCH', desc: t('Sendet stets den tiefen Grundton exakt im Timing an Bass oder Drone.', 'Sends the lowest chord root pitch cleanly to Analog Bass or Drone.') },
          { id: 'cutoffCv', type: 'in', label: 'CUTOFF CV', desc: t('Lässt den warmen Tiefpass des Pads im Takt oder langsam atmen.', 'Modulates internal pad cutoff cleanly without harsh resonance spikes.') },
          { id: 'glideCv', type: 'in', label: 'GLIDE CV', desc: t('Variiert die Übergangs-Gleitzeit zwischen straff und traumwandlerisch.', 'Dynamically scales chord portamento glide duration.') },
        ],
        scheme: {
          fromLbl: 'Chord Glide: POLY & ROOT PITCH',
          toLbl: 'Chord Arp + Analog Bass',
          sonicEffect: t(
            '<b>Hörbares Ergebnis:</b> Bass, Pad und Melodie bleiben zu 100 % harmonisch synchron. Drehst du an Tonart oder Skala, transponiert das komplette Arrangement sofort falsche Töne weg.',
            '<b>Audible Payoff:</b> Pad, bassline, and piano arpeggios stay 100% locked in harmony. Changing Key, Scale, or Progression shifts the entire mix instantaneously.'
          ),
        },
        steps: [
          t('Stecke <code>master_clock:clockOut</code> in <code>chord_glide:clockIn</code> (Div 32 oder 64).', 'Patch <code>master_clock:clockOut</code> to <code>chord_glide:clockIn</code> (set Clock Div to 32 or 64).'),
          t('Aktiviere <b>Voice Leading</b> und setze <b>Glide</b> auf <code>0.6–1.8s</code>.', 'Enable <b>Voice Leading</b> and dial <b>Glide</b> between <code>0.6s</code> and <code>1.8s</code>.'),
          t('Patche <code>rootOut -> bass:pitchIn</code> für automatisch passende Bassnoten.', 'Route <code>rootOut -> bass:pitchIn</code> so your sub follows every chord change.'),
        ],
        proTip: t('Tipp: Drehe <code>Chord Glide: level</code> auf <code>0.25</code>, wenn es primär als unsichtbarer Harmoniedirigent für Felt Piano spielen soll.', 'Pro Tip: Lower <code>Chord Glide: level</code> to ~<code>0.25</code> when using it purely as an understated harmonic bed beneath Felt Piano.'),
        state: {
          version: 2,
          name: 'Tutorial 01 · Chord Glide Harmony Spine',
          master: 0.82,
          modules: [
            { id: 'clk1', type: 'master_clock', enabled: true, pos: { x: 60, y: 60 }, values: { tempo: 78, swing: 0.04, running: 1 } },
            { id: 'sr1', type: 'slow_random', enabled: true, pos: { x: 300, y: 60 }, values: { rate: 0.08, smooth: 2.0, depth: 0.55, mode: 'smooth' } },
            { id: 'cg1', type: 'chord_glide', enabled: true, pos: { x: 60, y: 340 }, chDelay: 0.25, chReverb: 0.55, values: { level: 0.68, glide: 1.4, cutoff: 1250, attack: 0.8, release: 3.5, detune: 10, key: 9, scale: 'minor', progression: 'vi_IV_I_V', voiceLeading: 1, voiceCount: 5, clockDiv: 32 } },
            { id: 'bs1', type: 'bass', enabled: true, pos: { x: 360, y: 340 }, chReverb: 0.1, values: { level: 0.62, cutoff: 340, reso: 1.4, env: 0.25, decay: 1.8, sub: 0.85 } },
            { id: 'rev1', type: 'reverb', enabled: true, pos: { x: 60, y: 640 }, values: { decay: 7.5, damp: 0.6, predelay: 0.03, tone: 2600, mix: 0.45 } },
          ],
          cables: [
            { from: 'clk1:clockOut', to: 'cg1:clockIn', color: '#06b6d4', depth: 1 },
            { from: 'sr1:cvOut', to: 'cg1:cutoffCv', color: '#10b981', depth: 0.45 },
            { from: 'cg1:rootOut', to: 'bs1:pitchIn', color: '#a855f7', depth: 1 },
            { from: 'cg1:gateOut', to: 'bs1:gateIn', color: '#fbbf24', depth: 1 },
          ],
        },
      },
      {
        id: 'tut-chord-arp',
        cat: 'harmony',
        badge: 'CONTROL · ARPEGGIATOR',
        color: '#818cf8',
        title: 'Chord Arpeggiator: Ostinatos & Polyphonic Voice Slicing',
        desc: t(
          'Der <b>Chord Arpeggiator</b> zerlegt eingehende Akkord-Voicings (z. B. von <code>Chord Glide</code>) rhythmisch im Takt über 1–3 Oktaven. Ideal für pulsierende Max-Richter-, Ólafur-Arnalds- oder Synthwave-Figuren.',
          '<b>Chord Arpeggiator</b> turns sustained harmonic chords from <code>Chord Glide</code> into rhythmic 1–3 octave ostinatos with dynamic probability density and accent pulses.'
        ),
        greenJacks: [
          { id: 'pitchIn', type: 'in', label: 'POLY PITCH', desc: t('Empfängt mehrstimmige Akkordnoten von Chord Glide.', 'Accepts polyphonic note arrays from Chord Glide PITCH OUT.') },
          { id: 'clockIn', type: 'in', label: 'CLOCK IN', desc: t('Bestimmt das Noten-Raster (1/8 von Divider oder 1/16 von Clock).', 'Drives step speed (e.g. 1/8 via Divider or 1/16 directly).') },
          { id: 'pitchOut', type: 'out', label: 'PITCH OUT', desc: t('Sendet die zerlegten Einzelnoten an Felt Piano, Pluck oder Keys.', 'Outputs arpeggiated single pitches to Felt Piano, Pluck, or Keys.') },
          { id: 'accentOut', type: 'out', label: 'ACCENT OUT', desc: t('Betonungs-Trigger alle N Steps für zweite Instrumente oder Rimshots.', 'Fires accent trigger every N notes for layered swells or percussion.') },
        ],
        scheme: {
          fromLbl: 'Chord Glide -> Chord Arp',
          toLbl: 'Felt Piano + Pluck (Accent)',
          sonicEffect: t(
            '<b>Hörbares Ergebnis:</b> Jeder Akkordwechsel von Chord Glide verwandelt sich live in fließende Neoklassik-Arpeggien; <b>Density &lt; 90%</b> streut geschmackvolle Pausen ein.',
            '<b>Audible Payoff:</b> Flowing Neo-Classical piano ripples follow chord transitions automatically while <b>Density &lt; 90%</b> adds natural human breathing room.'
          ),
        },
        steps: [
          t('Stecke <code>chord_glide:pitchOut -> chord_arp:pitchIn</code>.', 'Patch <code>chord_glide:pitchOut -> chord_arp:pitchIn</code>.'),
          t('Wähle Muster <code>updown</code> oder <code>converge</code> mit <code>octaves: 2</code>.', 'Select pattern <code>updown</code> or <code>converge</code> across <code>2 octaves</code>.'),
          t('Verbinde <code>pitchOut</code> &amp; <code>gateOut</code> mit <code>Felt Piano</code>.', 'Patch both <code>pitchOut</code> and <code>gateOut</code> into <code>Felt Piano</code>.'),
        ],
        proTip: t('Tipp: Nutze <code>accentOut</code>, um jeden 4. oder 6. Takt einen leisen Glockenton (FM Bell) mitzuspielen.', 'Pro Tip: Patch <code>accentOut</code> to <code>fm_voice:gateIn</code> to sparkle on every 4th step.'),
        state: {
          version: 2,
          name: 'Tutorial 02 · Chord Arpeggiator Ostinato',
          master: 0.84,
          modules: [
            { id: 'clk1', type: 'master_clock', enabled: true, pos: { x: 60, y: 60 }, values: { tempo: 84, swing: 0.06, running: 1 } },
            { id: 'div1', type: 'clock_divider', enabled: true, pos: { x: 280, y: 60 }, values: {} },
            { id: 'arp1', type: 'chord_arp', enabled: true, pos: { x: 500, y: 60 }, values: { octaves: 2, gateLen: 0.72, density: 0.86, accentEvery: 4, pattern: 'updown' } },
            { id: 'cg1', type: 'chord_glide', enabled: true, pos: { x: 60, y: 340 }, chReverb: 0.45, values: { level: 0.28, glide: 0.5, cutoff: 1050, key: 2, scale: 'minor', progression: 'i_VI_III_VII', voiceLeading: 1, clockDiv: 32 } },
            { id: 'piano1', type: 'felt_piano', enabled: true, pos: { x: 360, y: 340 }, chDelay: 0.3, chReverb: 0.5, values: { level: 0.8, felt: 0.72, decay: 3.4, color: 2400, body: 0.7, hammer: 0.25 } },
            { id: 'dly1', type: 'delay', enabled: true, pos: { x: 60, y: 640 }, values: { time: 0.357, feedback: 0.34, tone: 2200, mod: 0.16, mix: 0.26, mode: 'pingpong' } },
            { id: 'rev1', type: 'reverb', enabled: true, pos: { x: 340, y: 640 }, values: { decay: 6.2, damp: 0.58, predelay: 0.03, tone: 2900, mix: 0.42 } },
          ],
          cables: [
            { from: 'clk1:clockOut', to: 'div1:clockIn', color: '#06b6d4', depth: 1 },
            { from: 'clk1:clockOut', to: 'cg1:clockIn', color: '#06b6d4', depth: 1 },
            { from: 'div1:div2Out', to: 'arp1:clockIn', color: '#06b6d4', depth: 1 },
            { from: 'cg1:pitchOut', to: 'arp1:pitchIn', color: '#a855f7', depth: 1 },
            { from: 'arp1:pitchOut', to: 'piano1:pitchIn', color: '#a855f7', depth: 1 },
            { from: 'arp1:gateOut', to: 'piano1:gateIn', color: '#fbbf24', depth: 1 },
          ],
        },
      },
      {
        id: 'tut-felt-piano',
        cat: 'harmony',
        badge: 'ACOUSTIC VOICE · PIANO',
        color: '#f59e0b',
        title: 'Felt Piano: Mechanical Hammer Thump & Dynamic Felt CV',
        desc: t(
          'Das <b>Felt Piano</b> modelliert einen intimen Flügel mit Filztuch vor den Saiten: weicher Holzkorpus, hörbares Hammer-Klicken (<code>hammer</code>) und stufenlos modulierbare Filzdämpfung via <code>feltCv</code>.',
          '<b>Felt Piano</b> captures close-miked upright acoustics: muted hammer felt (<code>felt</code>), wooden resonance (<code>body</code>), subtle mechanical key noise (<code>hammer</code>), and continuous <code>feltCv</code> expression.'
        ),
        greenJacks: [
          { id: 'feltCv', type: 'in', label: 'FELT CV', desc: t('Variiert von Note zu Note, wie stark der Filz die Höhen dämpft.', 'Modulates hammer felt warmth smoothly between intimate muffled notes and open resonance.') },
          { id: 'vcaCv', type: 'in', label: 'VCA CV', desc: t('Steuert Phrasen-Lautstärke für sanfte Dynamik-Bögen.', 'Shapes overall piano dynamic phrasing and swells.') },
          { id: 'panCv', type: 'in', label: 'PAN CV', desc: t('Minimal eingesetzt verleiht PAN CV dem Klavier intime Nähe.', 'Adds gentle spatial movement when patched softly (15–25%).') },
        ],
        scheme: {
          fromLbl: 'Slow Random: CV OUT',
          toLbl: 'Felt Piano: FELT CV',
          sonicEffect: t(
            '<b>Hörbares Ergebnis:</b> Statt statischer Samples atmet jeder Anschlag wie von einer echten Pianistin – mal extrem warm und samtig, mal leicht aufgeklart.',
            '<b>Audible Payoff:</b> Instead of static sample loops, notes gently open and soften in warmth just like expressive live pedaling.'
          ),
        },
        steps: [
          t('Stelle <code>felt: 0.78</code>, <code>body: 0.72</code> und <code>hammer: 0.25</code> ein.', 'Dial <code>felt: 0.78</code>, <code>body: 0.72</code>, and <code>hammer: 0.25</code>.'),
          t('Verbinde <code>slow_random:cvOut -> felt_piano:feltCv</code> (Tiefe ca. 35%).', 'Patch <code>slow_random:cvOut -> felt_piano:feltCv</code> (~35% cable depth).'),
          t('Gib dem Klavier im Kanalzug <code>Delay 25%</code> &amp; <code>Reverb 45%</code>.', 'Mix <code>25% Delay</code> &amp; <code>45% Reverb</code> on the Felt Piano channel strip.'),
        ],
        proTip: t('Tipp: Mit <code>chord: "octave"</code> im Peak-Snapshot spielt jede einzelne Arpeggio-Note sofort majestätisch gedoppelt.', 'Pro Tip: Switch <code>chord</code> from <code>single</code> to <code>octave</code> in your climax Snapshot to double melody notes across two octaves.'),
        state: {
          version: 2,
          name: 'Tutorial 03 · Intimate Felt Piano',
          master: 0.84,
          modules: [
            { id: 'clk1', type: 'master_clock', enabled: true, pos: { x: 60, y: 60 }, values: { tempo: 72, swing: 0.05, running: 1 } },
            { id: 'rw1', type: 'random_walk', enabled: true, pos: { x: 280, y: 60 }, values: { stepSize: 2, range: 2, repeat: 8, mutation: 0.2, glide: 0, key: 2, scale: 'minor', octave: 48 } },
            { id: 'sr1', type: 'slow_random', enabled: true, pos: { x: 540, y: 60 }, values: { rate: 0.12, smooth: 2.0, depth: 0.55, mode: 'smooth' } },
            { id: 'piano1', type: 'felt_piano', enabled: true, pos: { x: 60, y: 340 }, chDelay: 0.25, chReverb: 0.5, values: { level: 0.82, felt: 0.78, decay: 4.0, color: 2200, body: 0.74, hammer: 0.26, octave: 48, chord: 'single', scale: 'minor' } },
            { id: 'dly1', type: 'delay', enabled: true, pos: { x: 60, y: 640 }, values: { time: 0.416, feedback: 0.34, tone: 2000, mod: 0.22, mix: 0.26, mode: 'pingpong' } },
            { id: 'rev1', type: 'reverb', enabled: true, pos: { x: 340, y: 640 }, values: { decay: 6.4, damp: 0.62, predelay: 0.03, tone: 2700, mix: 0.44 } },
          ],
          cables: [
            { from: 'clk1:div2Out', to: 'rw1:clockIn', color: '#06b6d4', depth: 1 },
            { from: 'rw1:pitchOut', to: 'piano1:pitchIn', color: '#a855f7', depth: 1 },
            { from: 'rw1:gateOut', to: 'piano1:gateIn', color: '#fbbf24', depth: 1 },
            { from: 'sr1:cvOut', to: 'piano1:feltCv', color: '#10b981', depth: 0.35 },
          ],
        },
      },
      {
        id: 'tut-solo-violin',
        cat: 'harmony',
        badge: 'EXPRESSIVE STRING · VOICE',
        color: '#e11d48',
        title: 'Solo Violin: Bow Pressure, Sul Tasto & Legato Phrasing',
        desc: t(
          'Die <b>Solo Violin</b> simuliert Bogenreibung, Ausdrucks-Vibrato und Griffbrett-Legato in 4 Artikulationen (<code>arco</code>, <code>sultasto</code>, <code>pizz</code>, <code>tremolo</code>). Durch Modulation von <code>bowCv</code> entsteht echte Bogen-Atmung.',
          '<b>Solo Violin</b> models bowed string phrasing across four articulations (<code>arco</code>, <code>sultasto</code>, <code>pizz</code>, <code>tremolo</code>). Patching <code>bowCv</code> breathes dynamic bow intensity into sustained phrases.'
        ),
        greenJacks: [
          { id: 'bowCv', type: 'in', label: 'BOW CV', desc: t('Steuert Bogendruck – mehr Druck bringt Kern und Ausdruck im Bogenstrich.', 'Modulates bow weight for expressive swells and lyrical dynamic phrasing.') },
          { id: 'vibratoCv', type: 'in', label: 'VIBRATO CV', desc: t('Blendet Fingervibrato bei langen Haltetönen langsam ein.', 'Gradually deepens finger vibrato over long held notes.') },
          { id: 'glideCv', type: 'in', label: 'GLIDE CV', desc: t('Variiert Griffbrett-Portamento bei Intervallsprüngen.', 'Modulates legato finger slide speed across wide intervals.') },
        ],
        scheme: {
          fromLbl: 'Slope Generator: ENV OUT',
          toLbl: 'Solo Violin: BOW CV & VIBRATO CV',
          sonicEffect: t(
            '<b>Hörbares Ergebnis:</b> Jeder Bogenstrich setzt weich über der Saite an (<code>sultasto</code>), schwillt mit warmem Vibrato zur Mitte an und klingt sanft in langen Kammer-Hall aus.',
            '<b>Audible Payoff:</b> Notes bow gently into tone, swell warmly at phrase peak with blossoming vibrato, and trail off into natural chamber reverb.'
          ),
        },
        steps: [
          t('Füttere <code>sequencer:clockIn</code> mit <code>clock_divider:div8Out</code> für getragene Linien.', 'Feed <code>sequencer:clockIn</code> from <code>clock_divider:div8Out</code> for lyrical slow bowing.'),
          t('Stelle an der Violine <code>articulation: "sultasto"</code>, <code>glide: 0.24</code> und <code>tone: 2400 Hz</code> ein.', 'Select <code>articulation: "sultasto"</code>, <code>glide: 0.24s</code>, and warm <code>tone: 2400 Hz</code>.'),
          t('Patche <code>slope_generator:envOut -> violin:bowCv</code> für lebendige Bogenführung.', 'Patch <code>slope_generator:envOut -> violin:bowCv</code> for continuous bow shaping.'),
        ],
        proTip: t('Tipp: Im Sequential-Kontext kannst du im Snapshot 3 auf <code>pizz</code> und Snapshot 4 auf <code>octave: 1</code> + <code>arco</code> wechseln.', 'Pro Tip: Pair Violin with a subtle Cello bass root from <code>chord_glide:rootOut -> bass:pitchIn</code> for string quartet depth.'),
        state: {
          version: 2,
          name: 'Tutorial 04 · Expressive Solo Violin',
          master: 0.84,
          modules: [
            { id: 'clk1', type: 'master_clock', enabled: true, pos: { x: 60, y: 60 }, values: { tempo: 74, swing: 0, running: 1 } },
            { id: 'div1', type: 'clock_divider', enabled: true, pos: { x: 280, y: 60 }, values: {} },
            { id: 'slp1', type: 'slope_generator', enabled: true, pos: { x: 520, y: 60 }, values: { rise: 6, fall: 10, curve: 0.55, scale: 0.65, offset: 0.25, mode: 'loop' } },
            { id: 'seq1', type: 'sequencer', enabled: true, pos: { x: 60, y: 340 }, values: { level: 0, glide: 0.22, s1: 0, s2: 4, s3: 7, s4: 5, s5: 4, s6: 2, s7: 3, s8: 0, g1: 1, g2: 2, g3: 1, g4: 2, g5: 1, g6: 1, g7: 2, g8: 2, division: 1, key: 2, scale: 'minor', octave: 60 } },
            { id: 'vln1', type: 'violin', enabled: true, pos: { x: 380, y: 340 }, chDelay: 0.22, chReverb: 0.52, values: { level: 0.74, bow: 0.44, vibrato: 0.48, glide: 0.24, tone: 2450, attack: 0.35, release: 2.2, articulation: 'sultasto', octave: 0 } },
            { id: 'rev1', type: 'reverb', enabled: true, pos: { x: 60, y: 640 }, values: { decay: 6.8, damp: 0.58, predelay: 0.03, tone: 2900, mix: 0.46 } },
          ],
          cables: [
            { from: 'clk1:clockOut', to: 'div1:clockIn', color: '#06b6d4', depth: 1 },
            { from: 'div1:div8Out', to: 'seq1:clockIn', color: '#06b6d4', depth: 1 },
            { from: 'seq1:pitchOut', to: 'vln1:pitchIn', color: '#a855f7', depth: 1 },
            { from: 'seq1:gateOut', to: 'vln1:gateIn', color: '#fbbf24', depth: 1 },
            { from: 'slp1:envOut', to: 'vln1:bowCv', color: '#10b981', depth: 0.45 },
          ],
        },
      },
      {
        id: 'tut-snapshot-song',
        cat: 'rhythm',
        badge: 'ARRANGEMENT · SONG MODE',
        color: '#f97316',
        title: 'Snapshot Controller: Automated Song Mode (Variable Bars)',
        desc: t(
          'Mit dem aufgerüsteten <b>Snapshot Controller</b> baust du komplette Song-Abläufe mit unterschiedlich langen Parts: Intro 2 Takte, Build-Up 4 Takte, Drop 8 Takte, Breakdown 4 Takte – gesteuert über <code>barIn</code>.',
          'Build complete multi-part song structures without manual clicking: <b>Snapshot Controller</b> counts incoming bars at <code>barIn</code> and transitions slots automatically according to <code>bars1..bars5</code>.'
        ),
        greenJacks: [
          { id: 'barIn', type: 'in', label: 'BAR IN', desc: t('Empfängt 1-Bar-Pulse von <code>master_clock:barOut</code> für den Song-Ablaufplan.', 'Receives 1-bar pulses from <code>master_clock:barOut</code> to drive Song Mode.') },
          { id: 'nextIn', type: 'in', label: 'NEXT', desc: t('Alternativer Trigger (falls man ohne Song Mode starr weiterschalten will).', 'Alternative fixed-interval step trigger when autoRun is off.') },
          { id: 'resetIn', type: 'in', label: 'RESET', desc: t('Springt per Trigger sofort wieder an den Song-Anfang (Slot 1).', 'Resets bar counter and recalls Slot 1 immediately.') },
          { id: 'slot1In', type: 'in', label: 'SLOT 1..5', desc: t('Direktwahl einzelner Performance-Szenen per Gate-Impuls.', 'Direct gate recall for individual performance slots 1–5.') },
        ],
        scheme: {
          fromLbl: 'Master Clock: BAR OUT',
          toLbl: 'Snapshot Controller: BAR IN',
          sonicEffect: t(
            '<b>Hörbares Ergebnis:</b> Sobald <code>autoRun: 1</code> aktiv ist, durchläuft das Rack selbstständig deinen Songplan; Slots mit <code>barsN: 0</code> werden automatisch übersprungen.',
            '<b>Audible Payoff:</b> With <code>autoRun: 1</code> enabled, your patch autonomously evolves through Intro, Drop, and Breakdown; any slot set to <code>0 bars</code> is skipped seamlessly.'
          ),
        },
        steps: [
          t('Speichere Szenen in Performance-Slots 1–5 rechts im Sidebar.', 'Store desired rack scenes in Performance Preset Slots 1–5 on the right sidebar.'),
          t('Verbinde <code>master_clock:barOut -> snapshot_ctrl:barIn</code>.', 'Patch <code>master_clock:barOut -> snapshot_ctrl:barIn</code>.'),
          t('Setze <code>autoRun: On</code>, stelle <code>bars1..bars5</code> (0 = Skip) &amp; wähle <code>Loop</code> vs <code>One-Shot</code>.', 'Turn <code>autoRun: On</code>, set exact bar lengths per slot (<code>0</code> skips), and pick <code>Loop</code> or <code>One-Shot</code>.'),
        ],
        proTip: t('Tipp: Dieses Tutorial-Board hat 3 vorkonfigurierte Slots (Intro 2 Bars -> Lift 2 Bars -> Drop 4 Bars) bereits eingebaut!', 'Pro Tip: This Tutorial Patch includes 3 live Snapshot scenes (Intro 2 bars -> Lift 2 bars -> Drop 4 bars) pre-wired so you hear Song Mode immediately.'),
        state: {
          version: 2,
          name: 'Tutorial 05 · Song Mode Arrangement',
          master: 0.84,
          modules: [
            { id: 'clk1', type: 'master_clock', enabled: true, pos: { x: 60, y: 60 }, values: { tempo: 108, swing: 0.04, running: 1 } },
            { id: 'div1', type: 'clock_divider', enabled: true, pos: { x: 280, y: 60 }, values: {} },
            { id: 'snap1', type: 'snapshot_ctrl', enabled: true, pos: { x: 520, y: 60 }, values: { autoRun: 1, loop: 1, bars1: 2, bars2: 2, bars3: 4, bars4: 0, bars5: 0 } },
            { id: 'cg1', type: 'chord_glide', enabled: true, pos: { x: 60, y: 340 }, chReverb: 0.35, values: { level: 0.56, glide: 0.25, cutoff: 1400, key: 9, scale: 'minor', progression: 'vi_IV_I_V', voiceLeading: 1, clockDiv: 32 } },
            { id: 'bs1', type: 'bass', enabled: true, pos: { x: 360, y: 340 }, values: { level: 0.72, cutoff: 420, reso: 2.2, env: 0.5, decay: 0.28, sub: 0.7 } },
            { id: 'drm1', type: 'drum_rack', enabled: true, pos: { x: 640, y: 340 }, values: { level: 0.85, kDecay: 0.36, sSnap: 0.82, hDecay: 0.07 } },
            { id: 'rev1', type: 'reverb', enabled: true, pos: { x: 60, y: 640 }, values: { decay: 4.0, damp: 0.58, predelay: 0.02, tone: 2800, mix: 0.32 } },
          ],
          cables: [
            { from: 'clk1:clockOut', to: 'div1:clockIn', color: '#06b6d4', depth: 1 },
            { from: 'clk1:clockOut', to: 'cg1:clockIn', color: '#06b6d4', depth: 1 },
            { from: 'clk1:barOut', to: 'snap1:barIn', color: '#06b6d4', depth: 1 },
            { from: 'cg1:rootOut', to: 'bs1:pitchIn', color: '#a855f7', depth: 1 },
            { from: 'div1:div2Out', to: 'bs1:gateIn', color: '#fbbf24', depth: 1 },
            { from: 'div1:div4Out', to: 'drm1:trigKick', color: '#fbbf24', depth: 1 },
            { from: 'div1:div8Out', to: 'drm1:trigSnare', color: '#fbbf24', depth: 1 },
            { from: 'div1:div2Out', to: 'drm1:trigHat', color: '#fbbf24', depth: 1 },
          ],
          snapshots: {
            activeSlot: 1,
            currentSpeed: 7,
            slots: {
              1: { name: 'Intro (2 Bars)', values: { drm1: { level: 0 }, bs1: { level: 0.25, cutoff: 260 }, cg1: { cutoff: 900 } } },
              2: { name: 'Build-Up (2 Bars)', values: { drm1: { level: 0.45 }, bs1: { level: 0.55, cutoff: 420 }, cg1: { cutoff: 1700 } } },
              3: { name: 'Beat Drop (4 Bars)', values: { drm1: { level: 0.86 }, bs1: { level: 0.78, cutoff: 680 }, cg1: { cutoff: 2800 } } },
            },
          },
        },
      },
      {
        id: 'tut-granular',
        cat: 'texture',
        badge: 'SPATIAL FX · SHIMMER',
        color: '#c084fc',
        title: 'Granular Cloud: Microsound Shimmer & Frozen Puffer',
        desc: t(
          'Die <b>Granular Cloud</b> zerschneidet den Audiostrom in winzige 30–350ms Mikro-Grains und picht sie glasklar um +1 Oktave, +Quinte oder als Dual-Shimmer hinauf. Mit <code>freezeIn</code> frierst du jeden Moment zu einer endlosen Drone ein.',
          '<b>Granular Cloud</b> slices incoming audio into overlapping 30–350ms stereo micro-grains pitched up an octave, fifth, or dual shimmer, plus a gate-controlled endless <code>freezeIn</code> buffer.'
        ),
        greenJacks: [
          { id: 'freezeIn', type: 'in', label: 'FREEZE IN', desc: t('Gate-Trigger friert den aktuellen Soundpuffer auf Kommando ein.', 'Latches the 2-second grain buffer into an endless frozen texture.') },
          { id: 'cvMix', type: 'in', label: 'MIX CV', desc: t('Blendet Shimmer-Wolke rhythmisch oder als Swell ein.', 'Fades granular shimmer smoothly in and out via LFO or envelope.') },
          { id: 'cvTexture', type: 'in', label: 'TEXTURE CV', desc: t('Verbreitert Jitter und Streuung dynamisch.', 'Modulates stereo cloud diffusion and grain scatter timing.') },
        ],
        scheme: {
          fromLbl: 'Slope Generator: ENV OUT & EOF',
          toLbl: 'Granular Cloud: MIX CV & TEXTURE CV',
          sonicEffect: t(
            '<b>Hörbares Ergebnis:</b> Ein einfaches Filzklavier oder Pluck verwandelt sich in weite, atmende Kinoleinwand-Wolken – ohne die Transienten im Direktklang zu verwaschen.',
            '<b>Audible Payoff:</b> Simple harp or felt piano notes bloom into shimmering atmospheric halos without washing out attack clarity.'
          ),
        },
        steps: [
          t('Füge <code>granular_cloud</code> mit <code>pitchMode: "dualShimmer"</code> und <code>size: 0.16s</code> hinzu.', 'Add <code>granular_cloud</code> set to <code>dualShimmer</code> and <code>size: 0.16s</code>.'),
          t('Stecke <code>slope_generator:envOut -> granular_cloud:cvMix</code>.', 'Patch <code>slope_generator:envOut -> granular_cloud:cvMix</code>.'),
          t('Optional: <code>slow_random:invOut -> granular_cloud:cvTexture</code>.', 'Optionally patch <code>slow_random:invOut -> granular_cloud:cvTexture</code>.'),
        ],
        proTip: t('Tipp: Halte <code>feedback &lt;= 0.55</code> bei schnellen Noten und drehe danach <code>reverb</code> weich hinein.', 'Pro Tip: Keep <code>feedback &lt;= 0.55</code> on dense arps so octave shimmer melts musically into reverb.'),
        state: {
          version: 2,
          name: 'Tutorial 06 · Granular Shimmer Cloud',
          master: 0.82,
          modules: [
            { id: 'clk1', type: 'master_clock', enabled: true, pos: { x: 60, y: 60 }, values: { tempo: 80, swing: 0.06, running: 1 } },
            { id: 'euc1', type: 'euclidean', enabled: true, pos: { x: 280, y: 60 }, values: { steps: 16, pulses: 5, rotation: 0 } },
            { id: 'rw1', type: 'random_walk', enabled: true, pos: { x: 520, y: 60 }, values: { stepSize: 2, range: 2, key: 2, scale: 'hirajoshi', octave: 60 } },
            { id: 'slp1', type: 'slope_generator', enabled: true, pos: { x: 760, y: 60 }, values: { rise: 8, fall: 12, curve: 0.6, scale: 0.7, offset: 0.15, mode: 'loop' } },
            { id: 'plk1', type: 'pluck', enabled: true, pos: { x: 60, y: 340 }, chDelay: 0.35, chReverb: 0.45, values: { level: 0.74, tone: 2800, damp: 1.4, bright: 0.6, body: 0.55 } },
            { id: 'cld1', type: 'granular_cloud', enabled: true, pos: { x: 60, y: 640 }, values: { size: 0.16, texture: 0.68, feedback: 0.46, mix: 0.36, pitchMode: 'dualShimmer', freeze: 0 } },
            { id: 'rev1', type: 'reverb', enabled: true, pos: { x: 340, y: 640 }, values: { decay: 7.4, damp: 0.58, predelay: 0.03, tone: 2900, mix: 0.45 } },
          ],
          cables: [
            { from: 'clk1:clockOut', to: 'euc1:clockIn', color: '#06b6d4', depth: 1 },
            { from: 'euc1:trigOut', to: 'rw1:clockIn', color: '#fbbf24', depth: 1 },
            { from: 'rw1:pitchOut', to: 'plk1:pitchIn', color: '#a855f7', depth: 1 },
            { from: 'euc1:trigOut', to: 'plk1:gateIn', color: '#fbbf24', depth: 1 },
            { from: 'slp1:envOut', to: 'cld1:cvMix', color: '#10b981', depth: 0.6 },
          ],
        },
      },
      {
        id: 'tut-slope',
        cat: 'modulation',
        badge: 'FUNCTION GENERATOR · CV',
        color: '#eab308',
        title: 'Slope Generator: 0.01s–180s Swells, Cascades & Inverse Ducking',
        desc: t(
          'Der <b>Slope Generator</b> ist Hüllkurve, LFO, One-Shot-Intro-Swell (bis 180s) und Trigger-Sequenzer in einem. Besonders stark: <code>invOut</code> liefert gleichzeitig das exakte Gegenbild für sauberes Sidechain-Ducking.',
          '<b>Slope Generator</b> acts simultaneously as an AD/ASR envelope, cyclic LFO, slow 180s one-shot swell, and cascade clock via EOR/EOF triggers. Meanwhile, <code>invOut</code> delivers effortless anti-phase ducking.'
        ),
        greenJacks: [
          { id: 'envOut', type: 'out', label: 'ENV OUT', desc: t('Positive Hüllkurve (0.0 -> 1.0) für Swells und Filterfahrten.', 'Rising positive curve (0.0 -> 1.0) for swells and filter sweeps.') },
          { id: 'invOut', type: 'out', label: 'INV OUT', desc: t('Spiegelverkehrte Hüllkurve (1.0 -> 0.0) für Sidechain-Ducking.', 'Inverted curve (1.0 -> 0.0) for instant ducking without compressors.') },
          { id: 'eofOut', type: 'out', label: 'EOF OUT', desc: t('Trigger-Puls beim Erreichen der Null-Linie zum Kaskadieren.', 'Trigger pulse at end of fall for self-running envelope cascades.') },
          { id: 'modRise', type: 'in', label: 'RISE CV', desc: t('Moduliert die Anstiegszeit dynamisch.', 'Modulates rise duration externally.') },
        ],
        scheme: {
          fromLbl: 'Slope: ENV OUT & INV OUT',
          toLbl: 'Drone: VCA CV | Pluck: VCA CV',
          sonicEffect: t(
            '<b>Hörbares Ergebnis:</b> Sobald die Drone-Fläche anschwillt, macht das Zupfmuster automatisch dezent Platz – der Mix bleibt kristallklar und dynamisch lebendig.',
            '<b>Audible Payoff:</b> As the warm drone rises in intensity, pluck notes naturally duck back to make space, keeping the mix balanced and breathing.'
          ),
        },
        steps: [
          t('Wähle <code>mode: "loop"</code>, <code>rise: 6s</code>, <code>fall: 10s</code>.', 'Set <code>mode: "loop"</code>, <code>rise: 6s</code>, <code>fall: 10s</code>.'),
          t('Stecke <code>envOut -> drone:vcaCv</code> für den großen Flächen-Bogen.', 'Patch <code>envOut -> drone:vcaCv</code> to drive the pad swell.'),
          t('Stecke <code>invOut -> pluck:vcaCv</code> für das musikalische Gegengewicht.', 'Patch <code>invOut -> pluck:vcaCv</code> to duck the companion pluck.'),
        ],
        proTip: t('Tipp: Im Modus <code>oneshot</code> mit <code>sustainHold: 1</code> öffnet sich dein Intro langsam bis zum Maximum und bleibt dort stehen.', 'Pro Tip: Use <code>oneshot</code> mode + <code>sustainHold: 1</code> for an effortless 60-second intro rise that locks open at full energy.'),
        state: {
          version: 2,
          name: 'Tutorial 07 · Slope Swell & Inverse Ducking',
          master: 0.8,
          modules: [
            { id: 'clk1', type: 'master_clock', enabled: true, pos: { x: 60, y: 60 }, values: { tempo: 90, swing: 0.06, running: 1 } },
            { id: 'euc1', type: 'euclidean', enabled: true, pos: { x: 280, y: 60 }, values: { steps: 16, pulses: 6, rotation: 0 } },
            { id: 'slp1', type: 'slope_generator', enabled: true, pos: { x: 520, y: 60 }, values: { mode: 'loop', rise: 6, fall: 10, curve: 0.55, scale: 0.9, offset: 0.1 } },
            { id: 'drn1', type: 'drone', enabled: true, pos: { x: 60, y: 340 }, chReverb: 0.6, values: { level: 0.65, tone: 820, detune: 12, sub: 0.6, fm: 0.05, drift: 0.5, root: 33, chord: 'fifths', wave: 'triangle' } },
            { id: 'plk1', type: 'pluck', enabled: true, pos: { x: 360, y: 340 }, chDelay: 0.35, chReverb: 0.45, values: { level: 0.72, tone: 2400, damp: 1.2, bright: 0.6, body: 0.55 } },
            { id: 'rev1', type: 'reverb', enabled: true, pos: { x: 60, y: 640 }, values: { decay: 8.0, damp: 0.58, predelay: 0.03, tone: 2800, mix: 0.48 } },
          ],
          cables: [
            { from: 'clk1:clockOut', to: 'euc1:clockIn', color: '#06b6d4', depth: 1 },
            { from: 'euc1:trigOut', to: 'plk1:gateIn', color: '#fbbf24', depth: 1 },
            { from: 'slp1:envOut', to: 'drn1:vcaCv', color: '#10b981', depth: 0.85 },
            { from: 'slp1:invOut', to: 'plk1:vcaCv', color: '#10b981', depth: 0.7 },
          ],
        },
      },
      {
        id: 'tut-morph',
        cat: 'texture',
        badge: 'WAVETABLE · MULTISOURCE',
        color: '#8b5cf6',
        title: 'Morph Voice: 8 Spectral Worlds, Formant Choir & Jump CV',
        desc: t(
          'Die <b>Morph Voice</b> vereint 8 kontinuierlich überblendbare Oszillator-Welten: Analogsäge, Dreieck, Rechteck, Vokalchor („Aah/Ooh“), Glockenspektrum, Transienten-Rauschen, FM-Metall und Glitch-Obertöne – samt Parameter-Locks bei Mutation.',
          '<b>Morph Voice</b> sweeps continuously across 8 oscillator realms: analog saw, triangle, square, vocal formants (“Aah/Ooh”), bell spectra, air noise, metallic FM, and digital shimmer.'
        ),
        greenJacks: [
          { id: 'morphCv', type: 'in', label: 'MORPH CV', desc: t('Fährt stufenlos durch alle 8 Wellenform-Bereiche.', 'Sweeps smoothly across all 8 wavetable zones.') },
          { id: 'timbreCv', type: 'in', label: 'TIMBRE CV', desc: t('Moduliert Filter-Eckfrequenz und Brillanz.', 'Animates brilliance and harmonic upper partials.') },
          { id: 'jumpIn', type: 'in', label: 'JUMP TRIG', desc: t('Springt pro Trigger zufällig in eine andere Klangwelt.', 'Selects a fresh random wavetable morph point per trigger.') },
          { id: 'envCv', type: 'in', label: 'ENV CV', desc: t('Dehnt oder staucht Attack/Release dynamisch.', 'Scales envelope attack/release durations live.') },
        ],
        scheme: {
          fromLbl: 'Slope Generator: ENV OUT',
          toLbl: 'Morph Voice: MORPH CV',
          sonicEffect: t(
            '<b>Hörbares Ergebnis:</b> Jeder einzelne Notenanschlag wandert dynamisch von weichem Sinus über einen schwebenden Vokalchor in glockenhafte Obertöne.',
            '<b>Audible Payoff:</b> Every note blossoms dynamically from warm pure waves through expressive vowel formants into crystalline bell harmonics.'
          ),
        },
        steps: [
          t('Stecke <code>slope_generator:trigIn -> euclidean:trigOut</code> und <code>envOut -> morph_voice:morphCv</code>.', 'Patch <code>euclidean:trigOut -> slope_generator:trigIn</code> and <code>envOut -> morph_voice:morphCv</code>.'),
          t('Stelle <code>voices: 3</code>, <code>detune: 14</code> und <code>glide: 0.18s</code> ein.', 'Dial <code>voices: 3</code>, <code>detune: 14</code>, and <code>glide: 0.18s</code>.'),
          t('Sperre Lieblingsparameter per Lock-Chip und nutze den <b>Mutate</b>-Button für sichere Variation.', 'Lock pitch/glide chips and trigger <b>Mutate</b> for instant controlled timbral variation.'),
        ],
        proTip: t('Tipp: Patche <code>euclidean:invOut -> morph_voice:jumpIn</code> für unerwartete Wellenform-Sprünge zwischen den Hauptnoten.', 'Pro Tip: Route <code>euclidean:invOut -> morph_voice:jumpIn</code> for subtle wavetable timbre shifts on off-beats.'),
        state: {
          version: 2,
          name: 'Tutorial 08 · Morph Voice Wavetable',
          master: 0.82,
          modules: [
            { id: 'clk1', type: 'master_clock', enabled: true, pos: { x: 60, y: 60 }, values: { tempo: 88, swing: 0.04, running: 1 } },
            { id: 'euc1', type: 'euclidean', enabled: true, pos: { x: 280, y: 60 }, values: { steps: 16, pulses: 5, rotation: 0 } },
            { id: 'rw1', type: 'random_walk', enabled: true, pos: { x: 520, y: 60 }, values: { stepSize: 2, range: 2, key: 9, scale: 'minor', octave: 48 } },
            { id: 'slp1', type: 'slope_generator', enabled: true, pos: { x: 760, y: 60 }, values: { mode: 'trig', rise: 0.35, fall: 1.4, curve: 0.5, scale: 0.85, offset: 0.05 } },
            { id: 'mv1', type: 'morph_voice', enabled: true, pos: { x: 60, y: 340 }, chDelay: 0.35, chReverb: 0.55, values: { level: 0.72, morph: 0.28, bright: 2400, formant: 0.55, rough: 0.12, detune: 14, attack: 0.08, release: 1.6, voices: 3, glide: 0.18, source: 'hybrid' } },
            { id: 'rev1', type: 'reverb', enabled: true, pos: { x: 60, y: 640 }, values: { decay: 7.2, damp: 0.56, predelay: 0.03, tone: 2800, mix: 0.45 } },
          ],
          cables: [
            { from: 'clk1:clockOut', to: 'euc1:clockIn', color: '#06b6d4', depth: 1 },
            { from: 'euc1:trigOut', to: 'rw1:clockIn', color: '#fbbf24', depth: 1 },
            { from: 'euc1:trigOut', to: 'slp1:trigIn', color: '#fbbf24', depth: 1 },
            { from: 'rw1:pitchOut', to: 'mv1:pitchIn', color: '#a855f7', depth: 1 },
            { from: 'euc1:trigOut', to: 'mv1:gateIn', color: '#fbbf24', depth: 1 },
            { from: 'slp1:envOut', to: 'mv1:morphCv', color: '#10b981', depth: 0.75 },
          ],
        },
      },
      {
        id: 'tut-resonator',
        cat: 'texture',
        badge: 'MODAL PHYSICAL MODEL',
        color: '#10b981',
        title: 'Resonator Garden: 6 Modal Bodies & Singing Bowl Morphing',
        desc: t(
          'Der <b>Resonator Garden</b> simuliert bis zu 8 gekoppelte physikalische Moden (Harfensaiten, Marimbastäbe, tibetische Klangschalen). Über <code>materialCv</code> und <code>dampCv</code> schlägt er bald holzig-trocken, bald gläsern-nachsingend.',
          '<b>Resonator Garden</b> physically models 2–8 coupled acoustic modes spanning plucked harp strings, woody marimba bars, and Tibetan singing bowls.'
        ),
        greenJacks: [
          { id: 'materialCv', type: 'in', label: 'MATERIAL CV', desc: t('Verschiebt das modale Tuning von rein harmonisch zu glockigem Metall.', 'Morphs mode ratios from harmonic wood/string to glassy bell metal.') },
          { id: 'dampCv', type: 'in', label: 'DAMP CV', desc: t('Hohe Werte dämpfen hart (Holzblock); niedrige singen sekundenlang nach.', 'Modulates high-frequency damping from dry tap to long sustaining bowls.') },
          { id: 'pitchIn', type: 'in', label: 'PITCH IN', desc: t('Stimmt alle Resonatoren melodisch in die aktive Tonart.', 'Tunes resonator fundamental across 1V/Oct melodies.') },
        ],
        scheme: {
          fromLbl: 'Slow Random: CV OUT',
          toLbl: 'Resonator Garden: DAMP CV & MATERIAL CV',
          sonicEffect: t(
            '<b>Hörbares Ergebnis:</b> Ein lebendiger akustischer Klanggarten, der organisch zwischen warmen Marimba-Taps und schwebenden Meditation-Glocken wechselt.',
            '<b>Audible Payoff:</b> An acoustic garden oscillating between intimate marimba wood strikes and singing bronze resonance.'
          ),
        },
        steps: [
          t('Stecke <code>euclidean:trigOut -> resonator_garden:gateIn</code>.', 'Patch <code>euclidean:trigOut -> resonator_garden:gateIn</code>.'),
          t('Stelle <code>modes: 8</code>, <code>decay: 2.8s</code> und <code>excite: "impulse"</code> ein.', 'Select <code>modes: 8</code>, <code>decay: 2.8s</code>, and <code>excite: "impulse"</code>.'),
          t('Verbinde <code>slow_random:cvOut -> dampCv</code> &amp; <code>invOut -> materialCv</code>.', 'Route <code>slow_random:cvOut -> dampCv</code> and <code>invOut -> materialCv</code>.'),
        ],
        proTip: t('Tipp: Mit <code>excite: "noise"</code> wird der Garden zu einem flüsternden Windharfen-Resonator.', 'Pro Tip: Switch <code>excite</code> from <code>impulse</code> to <code>noise</code> for bowed-glass or aeolian wind harp textures.'),
        state: {
          version: 2,
          name: 'Tutorial 09 · Acoustic Resonator Garden',
          master: 0.82,
          modules: [
            { id: 'clk1', type: 'master_clock', enabled: true, pos: { x: 60, y: 60 }, values: { tempo: 86, swing: 0.08, running: 1 } },
            { id: 'euc1', type: 'euclidean', enabled: true, pos: { x: 280, y: 60 }, values: { steps: 13, pulses: 5, rotation: 0 } },
            { id: 'rw1', type: 'random_walk', enabled: true, pos: { x: 520, y: 60 }, values: { stepSize: 2, range: 2, key: 2, scale: 'hirajoshi', octave: 48 } },
            { id: 'sr1', type: 'slow_random', enabled: true, pos: { x: 760, y: 60 }, values: { rate: 0.14, smooth: 1.8, depth: 0.65, mode: 'smooth' } },
            { id: 'res1', type: 'resonator_garden', enabled: true, pos: { x: 60, y: 340 }, chDelay: 0.4, chReverb: 0.55, values: { level: 0.72, material: 0.45, size: 0.48, damp: 0.48, pos: 0.4, spread: 0.45, decay: 2.8, modes: 8, excite: 'impulse' } },
            { id: 'rev1', type: 'reverb', enabled: true, pos: { x: 60, y: 640 }, values: { decay: 7.0, damp: 0.56, predelay: 0.03, tone: 2900, mix: 0.45 } },
          ],
          cables: [
            { from: 'clk1:clockOut', to: 'euc1:clockIn', color: '#06b6d4', depth: 1 },
            { from: 'euc1:trigOut', to: 'rw1:clockIn', color: '#fbbf24', depth: 1 },
            { from: 'rw1:pitchOut', to: 'res1:pitchIn', color: '#a855f7', depth: 1 },
            { from: 'euc1:trigOut', to: 'res1:gateIn', color: '#fbbf24', depth: 1 },
            { from: 'sr1:cvOut', to: 'res1:dampCv', color: '#10b981', depth: 0.55 },
            { from: 'sr1:invOut', to: 'res1:materialCv', color: '#10b981', depth: 0.35 },
          ],
        },
      },
      {
        id: 'tut-swarm',
        cat: 'texture',
        badge: 'ADDITIVE SWARM · 32 PARTIALS',
        color: '#eab308',
        title: 'Spectral Swarm: 32 Partials, Cohesion & Scatter/Gather',
        desc: t(
          'Der <b>Spectral Swarm</b> dirigiert bis zu 32 reine Sinus-Teiltöne wie einen lebendigen Schwarm. Bei hoher <code>cohesion</code> richten sich alle Stimmen blitzsauber zu einem sakralen Orgel-Akkord aus; bei niedriger <code>cohesion</code> treiben sie als schwebender Nebel auseinander.',
          '<b>Spectral Swarm</b> conducts 2–32 independent sine partials like a flock of birds: high <code>cohesion</code> aligns every partial into a radiant sacred chord, while low cohesion disperses them into atmospheric microtonal mist.'
        ),
        greenJacks: [
          { id: 'cohesionCv', type: 'in', label: 'COHESION CV', desc: t('Zieht die 32 Oszillatoren dynamisch zusammen (100%) oder auseinander (0%).', 'Continuous convergence control pulling 32 partials into tuning lock or drift.') },
          { id: 'scatterIn', type: 'in', label: 'SCATTER TRIG', desc: t('Zerstreut die Teiltöne impulsartig im Frequenz- und Stereoraum.', 'Scatters harmonic partials instantaneously on a clock or Euclidean trigger.') },
          { id: 'gatherIn', type: 'in', label: 'GATHER TRIG', desc: t('Sammelt alle Stimmen punktgenau auf dem Taktanfang wieder ein.', 'Pulls the cloud cleanly back into harmonic focus on bar transitions.') },
        ],
        scheme: {
          fromLbl: 'Slope Generator: ENV OUT',
          toLbl: 'Spectral Swarm: COHESION CV',
          sonicEffect: t(
            '<b>Hörbares Ergebnis:</b> Ein unheimlicher, schwirrender Teiltöne-Schwarm kondensiert über mehrere Sekunden wie durch Zauberkraft zu einem strahlenden, reinen Dur-Akkord.',
            '<b>Audible Payoff:</b> A shimmering, uncanny mist of overtones gradually crystallizes into a luminous pure choir chord and melts away again.'
          ),
        },
        steps: [
          t('Wähle <code>count: 24</code>, <code>mode: "drone"</code> und <code>inharm: 0.25</code>.', 'Set <code>count: 24</code>, <code>mode: "drone"</code>, and <code>inharm: 0.25</code>.'),
          t('Stecke <code>slope_generator:envOut -> spectral_swarm:cohesionCv</code> (Rise 6s, Fall 12s).', 'Patch <code>slope_generator:envOut -> spectral_swarm:cohesionCv</code> (Rise 6s, Fall 12s).'),
          t('Steuere <code>chord_glide:rootOut -> spectral_swarm:pitchIn</code> für Tonartwechsel.', 'Optionally connect <code>chord_glide:rootOut -> spectral_swarm:pitchIn</code> to shift swarm harmony.'),
        ],
        proTip: t('Tipp: Patche <code>master_clock:barOut -> gatherIn</code> im <code>particles</code>-Modus für rhythmische Kristall-Wellen.', 'Pro Tip: Switch to <code>particles</code> mode and patch <code>euclidean:trigOut -> gateIn</code> for crystalline granular rain.'),
        state: {
          version: 2,
          name: 'Tutorial 10 · Spectral Swarm Cohesion',
          master: 0.82,
          modules: [
            { id: 'clk1', type: 'master_clock', enabled: true, pos: { x: 60, y: 60 }, values: { tempo: 76, swing: 0, running: 1 } },
            { id: 'slp1', type: 'slope_generator', enabled: true, pos: { x: 280, y: 60 }, values: { mode: 'loop', rise: 6, fall: 12, curve: 0.6, scale: 0.85, offset: 0.1 } },
            { id: 'swm1', type: 'spectral_swarm', enabled: true, pos: { x: 60, y: 340 }, chDelay: 0.2, chReverb: 0.65, values: { level: 0.62, count: 24, inharm: 0.24, scatter: 0.45, motion: 0.22, depth: 0.55, bright: 0.48, cohesion: 0.4, decay: 3.5, mode: 'drone' } },
            { id: 'cld1', type: 'granular_cloud', enabled: true, pos: { x: 60, y: 640 }, values: { size: 0.2, texture: 0.68, feedback: 0.4, mix: 0.28, pitchMode: 'fifthUp', freeze: 0 } },
            { id: 'rev1', type: 'reverb', enabled: true, pos: { x: 340, y: 640 }, values: { decay: 9.5, damp: 0.62, predelay: 0.035, tone: 2500, mix: 0.52 } },
          ],
          cables: [
            { from: 'slp1:envOut', to: 'swm1:cohesionCv', color: '#10b981', depth: 0.85 },
            { from: 'clk1:barOut', to: 'swm1:gatherIn', color: '#fbbf24', depth: 1 },
          ],
        },
      },
      {
        id: 'tut-hybrid-perc',
        cat: 'rhythm',
        badge: 'DRUMS · LAYERED SYNTH',
        color: '#f97316',
        title: 'Hybrid Percussion: Sub Drop, Transient Snap & Material CV',
        desc: t(
          'Die <b>Hybrid Percussion</b> kombiniert einen tiefen Pitch-Drop-Körper (Taiko, Sub-Tom, Kick) mit Transient-Snap und physikalischem Rauschen. Mit <code>timbreCv</code> und <code>lengthCv</code> klingt jeder Schlag organisch anders.',
          '<b>Hybrid Percussion</b> builds drums from a pitch-dropping body oscillator, transient attack snap, physical membrane noise, and continuous per-hit CV modulation via <code>timbreCv</code> and <code>lengthCv</code>.'
        ),
        greenJacks: [
          { id: 'timbreCv', type: 'in', label: 'MATERIAL CV', desc: t('Variiert jeden Schlag zwischen warmem Fell und metallischem Rim.', 'Shifts each drum strike seamlessly from warm membrane to metallic ring.') },
          { id: 'lengthCv', type: 'in', label: 'LENGTH CV', desc: t('Wechselt zwischen trockenen Geisterschlägen und langen Sub-Toms.', 'Modulates decay tail length dynamically for ghost notes vs booms.') },
          { id: 'pitchIn', type: 'in', label: 'PITCH IN', desc: t('Stimmt Toms oder melodische Basstrommeln exakt auf die Tonleiter.', 'Tunes tom melodies or 808 drops cleanly via 1V/Oct.') },
        ],
        scheme: {
          fromLbl: 'Slow Random: CV OUT & INV OUT',
          toLbl: 'Hybrid Perc: MATERIAL CV & LENGTH CV',
          sonicEffect: t(
            '<b>Hörbares Ergebnis:</b> Statt steriler Drum-Machine klingt die Spur wie ein organischer Live-Perkussionist mit wechselnder Dynamik und Trommelspannung.',
            '<b>Audible Payoff:</b> Rhythms gain physical variety – ghost strokes sound tight and woody while accented strikes bloom with sub resonance.'
          ),
        },
        steps: [
          t('Für monumentale Taikos: <code>tune: 52 Hz</code>, <code>body: 0.92</code>, <code>drop: 0.7</code>, <code>length: 0.65s</code>.', 'For cinematic Taiko weight dial <code>tune: 52 Hz</code>, <code>body: 0.92</code>, <code>drop: 0.7</code>.'),
          t('Für treibende Holz-Percussion: <code>tune: 165 Hz</code>, <code>snap: 0.6</code>, <code>length: 0.22s</code>.', 'For woody tribal hits dial <code>tune: 165 Hz</code>, <code>snap: 0.6</code>, <code>length: 0.22s</code>.'),
          t('Stecke <code>slow_random:cvOut -> timbreCv</code> &amp; <code>invOut -> lengthCv</code>.', 'Patch <code>slow_random:cvOut -> timbreCv</code> &amp; <code>invOut -> lengthCv</code>.'),
        ],
        proTip: t('Tipp: Halte den Channel Reverb-Send gering (10–20%) für trockenen Sub-Druck oder nutze 40% nur auf Snare/Rim-Einstellungen.', 'Pro Tip: Keep <code>chReverb</code> around 15% on sub kicks so low end punches hard; push higher on tuned percussion.'),
        state: {
          version: 2,
          name: 'Tutorial 11 · Hybrid Organic Percussion',
          master: 0.85,
          modules: [
            { id: 'clk1', type: 'master_clock', enabled: true, pos: { x: 60, y: 60 }, values: { tempo: 112, swing: 0.12, running: 1 } },
            { id: 'euc1', type: 'euclidean', enabled: true, pos: { x: 280, y: 60 }, values: { steps: 16, pulses: 7, rotation: 2 } },
            { id: 'sr1', type: 'slow_random', enabled: true, pos: { x: 520, y: 60 }, values: { rate: 0.45, smooth: 0.4, depth: 0.75, mode: 'smooth' } },
            { id: 'drm1', type: 'drum_rack', enabled: true, pos: { x: 60, y: 340 }, values: { level: 0.78, kDecay: 0.4, sSnap: 0.7, hDecay: 0.06 } },
            { id: 'hp1', type: 'hybrid_perc', enabled: true, pos: { x: 340, y: 340 }, chDelay: 0.25, chReverb: 0.28, values: { level: 0.74, tune: 140, body: 0.75, material: 0.42, drop: 0.45, noise: 0.25, snap: 0.55, length: 0.26, drive: 0.12 } },
            { id: 'rev1', type: 'reverb', enabled: true, pos: { x: 60, y: 640 }, values: { decay: 2.6, damp: 0.65, predelay: 0.015, tone: 2500, mix: 0.24 } },
          ],
          cables: [
            { from: 'clk1:clockOut', to: 'euc1:clockIn', color: '#06b6d4', depth: 1 },
            { from: 'clk1:div4Out', to: 'drm1:trigKick', color: '#fbbf24', depth: 1 },
            { from: 'euc1:trigOut', to: 'hp1:gateIn', color: '#fbbf24', depth: 1 },
            { from: 'sr1:cvOut', to: 'hp1:timbreCv', color: '#10b981', depth: 0.65 },
            { from: 'sr1:invOut', to: 'hp1:lengthCv', color: '#10b981', depth: 0.55 },
          ],
        },
      },
      {
        id: 'tut-drone',
        cat: 'harmony',
        badge: 'SOUNDSCAPE · 6 OSCILLATORS',
        color: '#6366f1',
        title: 'Drone Machine: Harmonic Clusters, Scale Lock & Warm FM Drift',
        desc: t(
          'Die <b>Drone Machine</b> kombiniert 6 einzeln schaltbare Oszillatoren, einen satten Sub und analoge Schwebung. Mit <code>scaleLock: 1</code> rastet selbst externe <code>pitchIn</code>-Transposition harmonisch sauber auf deine Tonart ein.',
          '<b>Drone Machine</b> layers 6 individually toggleable oscillators, a sub fundamental, and gentle cross-FM drift. Enable <code>scaleLock: 1</code> so incoming <code>pitchIn</code> changes adapt diatonically to your track key.'
        ),
        greenJacks: [
          { id: 'cvTone', type: 'in', label: 'TONE CV', desc: t('Öffnet das analoge Tiefpassfilter wie Sonnenlicht durch Wolken.', 'Opens warm lowpass harmonics smoothly over multi-bar phrasing.') },
          { id: 'cvFm', type: 'in', label: 'FM CV', desc: t('Streut subtile Frequenzmodulation für flirrende Obertöne.', 'Applies subtle cross-FM shimmer cleanly bounded for warmth.') },
          { id: 'pitchIn', type: 'in', label: 'PITCH IN', desc: t('Folgt Akkord-Grundtönen von Chord Glide ohne schiefe Terzen.', 'Follows Chord Glide ROOT PITCH while Scale Lock preserves key intervals.') },
        ],
        scheme: {
          fromLbl: 'Chord Glide (ROOT) + Slope (ENV)',
          toLbl: 'Drone Machine: PITCH IN & TONE CV',
          sonicEffect: t(
            '<b>Hörbares Ergebnis:</b> Tiefe Filmscore- und Solar-Drones bleiben weich und warm im Fundament, während <code>TONE CV</code> langsame Harmoniewellen zeichnet.',
            '<b>Audible Payoff:</b> Grounded orchestral brass/space weight without harsh highs, smoothly undulating across chord movements.'
          ),
        },
        steps: [
          t('Stelle <code>wave: "sawtooth"</code> oder <code>"triangle"</code>, <code>tone: 750–1200 Hz</code>, <code>detune: 12</code>.', 'Set <code>wave: "sawtooth"</code> or <code>"triangle"</code>, warm <code>tone: 750–1200 Hz</code>, <code>detune: 12</code>.'),
          t('Aktiviere <code>scaleLock: 1</code> + Tonart/Skala und verbinde <code>chord_glide:rootOut -> drone:pitchIn</code>.', 'Enable <code>scaleLock: 1</code> and patch <code>chord_glide:rootOut -> drone:pitchIn</code>.'),
          t('Schalte auf dem Drone-Panel einzelne <b>Voice LEDs</b> zu, um Dichte zu dosieren.', 'Toggle individual <b>Voice LEDs</b> on the module panel to sculpt upper fifth/octave voices.'),
        ],
        proTip: t('Tipp: Halte <code>fm</code> zwischen <code>0.03–0.12</code> für edle Wärme ohne kratzige Verzerrung.', 'Pro Tip: Keep <code>fm</code> between <code>0.03</code> and <code>0.12</code> for lush orchestral warmth with zero digital fizz.'),
        state: {
          version: 2,
          name: 'Tutorial 12 · Scale-Locked Analog Drone',
          master: 0.82,
          modules: [
            { id: 'clk1', type: 'master_clock', enabled: true, pos: { x: 60, y: 60 }, values: { tempo: 68, swing: 0, running: 1 } },
            { id: 'slp1', type: 'slope_generator', enabled: true, pos: { x: 280, y: 60 }, values: { rise: 12, fall: 14, curve: 0.55, scale: 0.7, offset: 0.15, mode: 'loop' } },
            { id: 'cg1', type: 'chord_glide', enabled: true, pos: { x: 60, y: 340 }, chReverb: 0.45, values: { level: 0.42, glide: 1.0, cutoff: 1100, key: 5, scale: 'dorian', progression: 'default', clockDiv: 64 } },
            { id: 'drn1', type: 'drone', enabled: true, pos: { x: 360, y: 340 }, chDelay: 0.25, chReverb: 0.6, values: { level: 0.68, tone: 900, detune: 12, sub: 0.75, fm: 0.06, drift: 0.5, root: 29, chord: 'fifths', wave: 'sawtooth', scaleLock: 1, key: 5, scale: 'dorian' }, extra: { voices: [true, true, true, false, true, false] } },
            { id: 'rev1', type: 'reverb', enabled: true, pos: { x: 60, y: 640 }, values: { decay: 10.0, damp: 0.6, predelay: 0.035, tone: 2600, mix: 0.52 } },
          ],
          cables: [
            { from: 'clk1:clockOut', to: 'cg1:clockIn', color: '#06b6d4', depth: 1 },
            { from: 'cg1:rootOut', to: 'drn1:pitchIn', color: '#a855f7', depth: 1 },
            { from: 'slp1:envOut', to: 'drn1:cvTone', color: '#10b981', depth: 0.5 },
          ],
        },
      },
      {
        id: 'tut-euclidean-prob',
        cat: 'rhythm',
        badge: 'RHYTHM · STOCHASTIC',
        color: '#ec4899',
        title: 'Euclidean + Probability Gate: Complementary & Evolving Beats',
        desc: t(
          'Kombiniere mathematische Polyrhythmik (<b>Euclidean</b> mit <code>trigOut</code> + komplementärem <code>invOut</code>) mit dem <b>Probability Gate</b>: Durchgelassene Impulse triggern Voice A, übersprungene (<code>altOut</code>) spielen eine sanfte Gegenmelodie auf Voice B.',
          'Combine Björklund math (<b>Euclidean</b> <code>trigOut</code> &amp; <code>invOut</code>) with <b>Probability Gate</b>: passed hits fire instrument A while skipped triggers (<code>altOut</code>) call-and-response with instrument B.'
        ),
        greenJacks: [
          { id: 'trigOut', type: 'out', label: 'EUC / PROB OUT', desc: t('Haupt-Triggerpfad bei bestandener Wahrscheinlichkeit.', 'Primary trigger branch when probability passes.') },
          { id: 'invOut', type: 'out', label: 'EUC INV OUT', desc: t('Exakte Pausen-Lücken zwischen den Hauptschlägen (z. B. für Hats).', 'Fires strictly on empty steps between Euclidean hits.') },
          { id: 'altOut', type: 'out', label: 'PROB SKIPPED', desc: t('Alternativ-Zweig für organische Call-and-Response-Echo-Noten.', 'Alternate branch turning dropped notes into expressive B-voice answers.') },
        ],
        scheme: {
          fromLbl: 'Euclidean: TRIG -> Prob Gate',
          toLbl: 'PASSED -> Pluck | SKIPPED -> FM Bell',
          sonicEffect: t(
            '<b>Hörbares Ergebnis:</b> Keine Note geht „verloren“: Entweder zupft sie warm auf dem Pluck oder funkelt leise auf der FM Bell – endlos lebendig und niemals mechanisch starr.',
            '<b>Audible Payoff:</b> Zero wasted notes – patterns flow smoothly in call-and-response between organic plucked strings and glistening FM overtones.'
          ),
        },
        steps: [
          t('Stelle <code>euclidean</code> auf <code>steps: 13</code>, <code>pulses: 7</code>.', 'Set <code>euclidean</code> to <code>steps: 13</code>, <code>pulses: 7</code> for polymetric pulse.'),
          t('Patche <code>euc:trigOut -> prob_gate:trigIn</code> (Chance ~<code>65%</code>).', 'Wire <code>euc:trigOut -> prob_gate:trigIn</code> (Chance ~<code>65%</code>).'),
          t('Patche <code>prob:trigOut -> pluck:gateIn</code> &amp; <code>prob:altOut -> fm_voice:gateIn</code>.', 'Patch <code>prob:trigOut -> pluck:gateIn</code> and <code>prob:altOut -> fm_voice:gateIn</code>.'),
        ],
        proTip: t('Tipp: Stecke zusätzlich <code>euc:invOut -> drum_rack:trigHat</code> für perfekte Lücken-Hi-Hats.', 'Pro Tip: Route <code>euc:invOut -> drum_rack:trigHat</code> so hats only play in the spaces between melodic notes.'),
        state: {
          version: 2,
          name: 'Tutorial 13 · Euclidean Call & Response',
          master: 0.82,
          modules: [
            { id: 'clk1', type: 'master_clock', enabled: true, pos: { x: 60, y: 60 }, values: { tempo: 94, swing: 0.08, running: 1 } },
            { id: 'euc1', type: 'euclidean', enabled: true, pos: { x: 280, y: 60 }, values: { steps: 13, pulses: 7, rotation: 1 } },
            { id: 'prb1', type: 'prob_gate', enabled: true, pos: { x: 520, y: 60 }, values: { chance: 0.65, burst: 1 } },
            { id: 'rw1', type: 'random_walk', enabled: true, pos: { x: 760, y: 60 }, values: { stepSize: 2, range: 2, repeat: 8, key: 9, scale: 'minorPenta', octave: 60 } },
            { id: 'plk1', type: 'pluck', enabled: true, pos: { x: 60, y: 340 }, chDelay: 0.35, chReverb: 0.45, values: { level: 0.74, tone: 2700, damp: 1.3, bright: 0.55, body: 0.55 } },
            { id: 'fm1', type: 'fm_voice', enabled: true, pos: { x: 340, y: 340 }, chDelay: 0.45, chReverb: 0.5, values: { level: 0.42, ratio: 2.0, index: 1.6, decay: 2.0, tone: 3200 } },
            { id: 'dly1', type: 'delay', enabled: true, pos: { x: 60, y: 640 }, values: { time: 0.478, feedback: 0.42, tone: 2300, mod: 0.18, mix: 0.32, mode: 'pingpong' } },
            { id: 'rev1', type: 'reverb', enabled: true, pos: { x: 340, y: 640 }, values: { decay: 6.0, damp: 0.6, predelay: 0.03, tone: 2800, mix: 0.44 } },
          ],
          cables: [
            { from: 'clk1:clockOut', to: 'euc1:clockIn', color: '#06b6d4', depth: 1 },
            { from: 'euc1:trigOut', to: 'rw1:clockIn', color: '#fbbf24', depth: 1 },
            { from: 'euc1:trigOut', to: 'prb1:trigIn', color: '#fbbf24', depth: 1 },
            { from: 'rw1:pitchOut', to: 'plk1:pitchIn', color: '#a855f7', depth: 1 },
            { from: 'rw1:pitchOut', to: 'fm1:pitchIn', color: '#a855f7', depth: 1 },
            { from: 'prb1:trigOut', to: 'plk1:gateIn', color: '#fbbf24', depth: 1 },
            { from: 'prb1:altOut', to: 'fm1:gateIn', color: '#fbbf24', depth: 1 },
          ],
        },
      },
      {
        id: 'tut-walk-quantizer',
        cat: 'harmony',
        badge: 'GENERATIVE MELODY · PITCH',
        color: '#10b981',
        title: 'Random Walk & Scale Quantizer: Musical Drift & Glide',
        desc: t(
          'Wie macht man aus purem Zufall eingängige, einprägsame Melodien? <b>Random Walk</b> besitzt ein Turing-Machine-Gedächtnis (<code>repeat</code> = Schleifenlänge, <code>mutation</code> = sanftes Umschreiben) plus Slew-<code>glide</code> – und der <b>Scale Quantizer</b> lässt selbst freie LFOs auf Tonarten einrasten.',
          'How do you turn randomness into memorable themes? <b>Random Walk</b> features Turing-Machine memory locking (<code>repeat</code> loop + gentle <code>mutation</code>) and smooth Slew <code>glide</code>, while <b>Scale Quantizer</b> locks raw LFO curves to exact scales.'
        ),
        greenJacks: [
          { id: 'pitchOut', type: 'out', label: 'PITCH OUT', desc: t('Geglättete oder stufige 1V/Okt Tonhöhe für jedes Melodie-Instrument.', 'Stepped or slew-glided 1V/Oct melody CV for Keys, Pluck, or Violin.') },
          { id: 'gateOut', type: 'out', label: 'GATE OUT', desc: t('Sendet einen neuen Note-Trigger bei jedem Tonschritt.', 'Fires a clean note gate trigger on quantized note changes.') },
          { id: 'pitchIn', type: 'in', label: 'QUANTIZE PITCH IN', desc: t('Nimmt beliebige LFO- oder CV-Signale am Scale Quantizer entgegen.', 'Accepts raw modulation voltages on Scale Quantizer to create LFO melodies.') },
        ],
        scheme: {
          fromLbl: 'Random Walk (Loop 8 Steps)',
          toLbl: 'Scale Quantizer -> Touch Keys (Legato)',
          sonicEffect: t(
            '<b>Hörbares Ergebnis:</b> Eine hypnotische 8-Ton-Phrase entsteht, wiederholt sich wie ein klassisches Motif und verändert mit <code>mutation: 0.2</code> alle paar Takte zart ein einzelnes Intervall.',
            '<b>Audible Payoff:</b> A hypnotic 8-note motif repeats cohesively while <code>mutation: 0.2</code> subtly refreshes single notes every few bars.'
          ),
        },
        steps: [
          t('Stelle <code>repeat: 8</code>, <code>mutation: 0.2</code> und <code>scale: "dorian"</code> ein.', 'Dial <code>repeat: 8</code>, <code>mutation: 0.2</code>, and <code>scale: "dorian"</code>.'),
          t('Für schwebende Slides: drehe <code>glide</code> auf <code>0.15s</code> und Keys auf <code>legato</code>.', 'For expressive slides set <code>glide: 0.15s</code> and Keys polyphony to <code>legato</code>.'),
          t('Mit dem Quantizer darunter (<code>transpose: +7</code>) entsteht sofort eine Quinte darüber.', 'Route a second voice through <code>Scale Quantizer</code> with <code>transpose: +7</code> for instant fifth harmonies.'),
        ],
        proTip: t('Tipp: <code>mutation: 0</code> friert ein gefundenes 8-Note-Motiv für immer exakt ein!', 'Pro Tip: Set <code>mutation: 0</code> to freeze a catchy generated motif permanently while playing live.'),
        state: {
          version: 2,
          name: 'Tutorial 14 · Generative Motif & Quantizer',
          master: 0.82,
          modules: [
            { id: 'clk1', type: 'master_clock', enabled: true, pos: { x: 60, y: 60 }, values: { tempo: 88, swing: 0.05, running: 1 } },
            { id: 'rw1', type: 'random_walk', enabled: true, pos: { x: 280, y: 60 }, values: { stepSize: 2, range: 2, repeat: 8, mutation: 0.22, seed: 42, glide: 0.08, key: 2, scale: 'dorian', octave: 48 } },
            { id: 'qt1', type: 'quantizer', enabled: true, pos: { x: 540, y: 60 }, values: { transpose: 7, key: 2, scale: 'dorian' } },
            { id: 'keys1', type: 'keys', enabled: true, pos: { x: 60, y: 340 }, chDelay: 0.3, chReverb: 0.5, values: { level: 0.65, cutoff: 1450, reso: 1.1, attack: 0.08, release: 2.2, detune: 10, glide: 0.12, polyphony: 'poly', wave: 'triangle', key: 2, scale: 'dorian' } },
            { id: 'plk1', type: 'pluck', enabled: true, pos: { x: 360, y: 340 }, chDelay: 0.45, chReverb: 0.5, values: { level: 0.52, tone: 2400, damp: 1.5, bright: 0.5, body: 0.6 } },
            { id: 'rev1', type: 'reverb', enabled: true, pos: { x: 60, y: 640 }, values: { decay: 6.5, damp: 0.6, predelay: 0.03, tone: 2800, mix: 0.44 } },
          ],
          cables: [
            { from: 'clk1:div2Out', to: 'rw1:clockIn', color: '#06b6d4', depth: 1 },
            { from: 'rw1:pitchOut', to: 'keys1:pitchIn', color: '#a855f7', depth: 1 },
            { from: 'rw1:gateOut', to: 'keys1:gateIn', color: '#fbbf24', depth: 1 },
            { from: 'rw1:pitchOut', to: 'qt1:pitchIn', color: '#a855f7', depth: 1 },
            { from: 'clk1:div4Out', to: 'qt1:trigIn', color: '#06b6d4', depth: 1 },
            { from: 'qt1:pitchOut', to: 'plk1:pitchIn', color: '#a855f7', depth: 1 },
            { from: 'qt1:gateOut', to: 'plk1:gateIn', color: '#fbbf24', depth: 1 },
          ],
        },
      },
      {
        id: 'tut-logic-attenuverter',
        cat: 'modulation',
        badge: 'CONTROL TOOLKIT · CV & GATE',
        color: '#0284c7',
        title: 'CV Logic & Attenuverter: Voltage Sculpting & A/B Routing',
        desc: t(
          'Zwei unverzichtbare Eurorack-Helfer: Der <b>Attenuverter</b> dosiert, invertiert oder summiert zwei LFOs präzise (<code>sumOut</code>), und <b>CV Logic & Switch</b> leitet Trigger je nach Steuerspannung automatisch auf Pfad A (<code>passOut</code>) oder Pfad B (<code>invPassOut</code>).',
          'Two indispensable modular utilities: <b>Attenuverter</b> scales, flips polarity, and sums dual CV streams (<code>sumOut</code>), while <b>CV Logic &amp; Switch</b> routes triggers dynamically between A (<code>passOut</code>) and B (<code>invPassOut</code>).'
        ),
        greenJacks: [
          { id: 'outA', type: 'out', label: 'ATTEN OUT A / SUM', desc: t('Skaliertes, invertiertes (-100%..+100%) oder summiertes CV-Signal.', 'Scaled, polarity-flipped (-100%..+100%), or summed modulation voltage.') },
          { id: 'ctrlCv', type: 'in', label: 'LOGIC CTRL CV', desc: t('Steuert die A/B-Weiche über den Schwellenwert (thresh).', 'Thresholds incoming CV to flip gate routing between PASS A and INV B.') },
          { id: 'passOut', type: 'out', label: 'PASS A / INV B', desc: t('Teilt eine Clock-Spur dynamisch zwischen zwei Instrumenten auf.', 'Alternates one rhythm lane between two voices as modulation swells.') },
        ],
        scheme: {
          fromLbl: 'Slow Random -> Logic CTRL CV & Attenuverter',
          toLbl: 'PASS A -> Felt Piano | INV B -> Resonator',
          sonicEffect: t(
            '<b>Hörbares Ergebnis:</b> Wie ein unsichtbarer Dirigent gibt das Rack die Melodie-Phrase mal ans Klavier und mal an den akustischen Resonator ab, während <code>sumOut</code> komplexere Filterkurven zeichnet.',
            '<b>Audible Payoff:</b> Like an invisible conductor, phrases trade organically between Felt Piano and Resonator Garden while summed CV weaves evolving filter arcs.'
          ),
        },
        steps: [
          t('Stecke <code>master_clock:div2Out -> logic_switch:gateIn</code>.', 'Patch <code>master_clock:div2Out -> logic_switch:gateIn</code>.'),
          t('Stecke <code>slow_random:cvOut -> logic_switch:ctrlCv</code> und <code>-> attenuverter:inA</code>.', 'Route <code>slow_random:cvOut -> logic_switch:ctrlCv</code> and <code>attenuverter:inA</code>.'),
          t('Stecke <code>passOut -> piano:gateIn</code>, <code>invPassOut -> res:gateIn</code> und <code>attenuverter:outA -> filter:cvCutoff</code>.', 'Wire <code>passOut -> piano</code>, <code>invPassOut -> resonator</code>, and <code>attenuverter:outA -> filter:cvCutoff</code>.'),
        ],
        proTip: t('Tipp: Nutze <code>logic_switch:stateOut</code> (LATCH CV), um Effekte taktweise hart zwischen zwei Einstellungen umzuschalten.', 'Pro Tip: Feed <code>logic_switch:toggleIn</code> from <code>barOut</code> and send <code>stateOut</code> to <code>granular_cloud:freezeIn</code> to freeze every second bar!'),
        state: {
          version: 2,
          name: 'Tutorial 15 · CV Logic & Attenuverter Routing',
          master: 0.82,
          modules: [
            { id: 'clk1', type: 'master_clock', enabled: true, pos: { x: 60, y: 60 }, values: { tempo: 86, swing: 0.06, running: 1 } },
            { id: 'sr1', type: 'slow_random', enabled: true, pos: { x: 280, y: 60 }, values: { rate: 0.14, smooth: 1.6, depth: 0.85, mode: 'smooth' } },
            { id: 'lsw1', type: 'logic_switch', enabled: true, pos: { x: 520, y: 60 }, values: { thresh: 0.5 } },
            { id: 'att1', type: 'attenuverter', enabled: true, pos: { x: 760, y: 60 }, values: { scaleA: 0.28, offsetA: 0.1 } },
            { id: 'rw1', type: 'random_walk', enabled: true, pos: { x: 1000, y: 60 }, values: { stepSize: 2, range: 2, key: 5, scale: 'dorian', octave: 48 } },
            { id: 'piano1', type: 'felt_piano', enabled: true, pos: { x: 60, y: 340 }, chDelay: 0.3, chReverb: 0.5, values: { level: 0.78, felt: 0.72, decay: 3.0, color: 2300 } },
            { id: 'res1', type: 'resonator_garden', enabled: true, pos: { x: 360, y: 340 }, chDelay: 0.4, chReverb: 0.55, values: { level: 0.68, material: 0.5, damp: 0.45, decay: 2.2, modes: 6 } },
            { id: 'flt1', type: 'filter', enabled: true, pos: { x: 60, y: 640 }, values: { cutoff: 2100, reso: 1.2, drive: 0.06 } },
            { id: 'rev1', type: 'reverb', enabled: true, pos: { x: 340, y: 640 }, values: { decay: 6.5, damp: 0.58, predelay: 0.03, tone: 2800, mix: 0.44 } },
          ],
          cables: [
            { from: 'clk1:div2Out', to: 'lsw1:gateIn', color: '#fbbf24', depth: 1 },
            { from: 'clk1:div2Out', to: 'rw1:clockIn', color: '#06b6d4', depth: 1 },
            { from: 'sr1:cvOut', to: 'lsw1:ctrlCv', color: '#10b981', depth: 1 },
            { from: 'sr1:cvOut', to: 'att1:inA', color: '#10b981', depth: 1 },
            { from: 'lsw1:passOut', to: 'piano1:gateIn', color: '#fbbf24', depth: 1 },
            { from: 'lsw1:invPassOut', to: 'res1:gateIn', color: '#fbbf24', depth: 1 },
            { from: 'rw1:pitchOut', to: 'piano1:pitchIn', color: '#a855f7', depth: 1 },
            { from: 'rw1:pitchOut', to: 'res1:pitchIn', color: '#a855f7', depth: 1 },
            { from: 'att1:outA', to: 'flt1:cvCutoff', color: '#10b981', depth: 0.65 },
          ],
        },
      },
      {
        id: 'tut-bass-drums',
        cat: 'rhythm',
        badge: 'GROOVE · LOW-END FOUNDATION',
        color: '#ef4444',
        title: 'Analog Bass & Drum Rack: Tight Sub, 303 Acids & Rolling Hats',
        desc: t(
          'So entsteht ein druckvolles, glasklares Beat-Fundament: <b>Drum Rack</b> liefert Kick, Snare, Hat & Rim getrennt auf 4 Triggern; <b>Analog Bass</b> zieht sich per <code>div2Out</code> rollend darunter und weicht dank <b>Slope Sidechain</b> auf jedem Viertelschlag präzise der Kick.',
          'Build a clean, punchy rhythm foundation: <b>Drum Rack</b> receives separated triggers for Kick, Snare, Hat &amp; Perc, while <b>Analog Bass</b> plays rolling 8th-note sub lines sidechained out of the kick’s way via <code>Slope INV OUT</code>.'
        ),
        greenJacks: [
          { id: 'trigKick', type: 'in', label: 'DRUM KICK / SNARE / HAT', desc: t('4 eigene Gate-Buchsen – jede Stimme unabhängig steuerbar.', '4 discrete drum triggers so kick, snare, hats &amp; perc run independent rhythms.') },
          { id: 'modCutoff', type: 'in', label: 'BASS CUTOFF CV', desc: t('Lässt die 303-Filterlinie organisch atmen.', 'Sweeps resonant bass cutoff smoothly over multi-bar phrases.') },
          { id: 'vcaCv', type: 'in', label: 'BASS VCA CV', desc: t('Mit Slope INV OUT geduckt entsteht sofortiger Club-Pump.', 'Patched from Slope INV OUT for tight club sidechain clarity.') },
        ],
        scheme: {
          fromLbl: 'Clock Divider (/4, /8, /2) + Slope INV',
          toLbl: 'Drum Rack + Analog Bass (Sidechained)',
          sonicEffect: t(
            '<b>Hörbares Ergebnis:</b> Die Kick steht druckvoll und ungetrübt voran, während der rollende Bass exakt im Offbeat-Raum zwischen den Kicks aufatmet.',
            '<b>Audible Payoff:</b> Clean, unmuddied low-end impact – kicks punch forward cleanly while the rolling bass breathes in between beats.'
          ),
        },
        steps: [
          t('Verbinde <code>div4Out -> trigKick</code>, <code>div8Out -> trigSnare</code> und <code>div2Out -> trigHat</code>.', 'Patch <code>div4Out -> trigKick</code>, <code>div8Out -> trigSnare</code>, and <code>div2Out -> trigHat</code>.'),
          t('Treibe <code>bass:gateIn</code> mit <code>div2Out</code> (rollende Achtel) und <code>pitchIn</code> aus <code>chord_glide:rootOut</code>.', 'Drive <code>bass:gateIn</code> with <code>div2Out</code> (rolling 8ths) and <code>pitchIn</code> from <code>chord_glide:rootOut</code>.'),
          t('Patche <code>div4Out -> slope:trigIn</code> (Rise 0.02s, Fall 0.28s) und <code>invOut -> bass:vcaCv</code>.', 'Patch <code>div4Out -> slope:trigIn</code> (Rise 0.02s, Fall 0.28s) and <code>invOut -> bass:vcaCv</code>.'),
        ],
        proTip: t('Tipp: Halte bei Kick &amp; Sub-Bass den Channel <code>Reverb-Send</code> niedrig (0–10%) und lege Hall stattdessen nur auf Chords &amp; Snare.', 'Pro Tip: Keep <code>chReverb</code> near 0% on Analog Bass &amp; Drum Rack while adding generous space to synths.'),
        state: {
          version: 2,
          name: 'Tutorial 16 · Tight Bass & Drum Foundation',
          master: 0.85,
          modules: [
            { id: 'clk1', type: 'master_clock', enabled: true, pos: { x: 60, y: 60 }, values: { tempo: 118, swing: 0.06, running: 1 } },
            { id: 'div1', type: 'clock_divider', enabled: true, pos: { x: 280, y: 60 }, values: {} },
            { id: 'slp1', type: 'slope_generator', enabled: true, pos: { x: 520, y: 60 }, values: { mode: 'trig', rise: 0.02, fall: 0.28, curve: 0.45, scale: 0.75, offset: 0.25 } },
            { id: 'sr1', type: 'slow_random', enabled: true, pos: { x: 760, y: 60 }, values: { rate: 0.14, smooth: 1.5, depth: 0.55, mode: 'smooth' } },
            { id: 'cg1', type: 'chord_glide', enabled: true, pos: { x: 60, y: 340 }, chDelay: 0.2, chReverb: 0.42, values: { level: 0.46, glide: 0.2, cutoff: 1450, key: 9, scale: 'minor', progression: 'vi_IV_I_V', clockDiv: 32 } },
            { id: 'bs1', type: 'bass', enabled: true, pos: { x: 360, y: 340 }, chReverb: 0.05, values: { level: 0.82, cutoff: 480, reso: 2.8, env: 0.52, decay: 0.26, sub: 0.75 } },
            { id: 'drm1', type: 'drum_rack', enabled: true, pos: { x: 640, y: 340 }, chReverb: 0.12, values: { level: 0.86, kDecay: 0.4, sSnap: 0.78, hDecay: 0.07 } },
            { id: 'rev1', type: 'reverb', enabled: true, pos: { x: 60, y: 640 }, values: { decay: 3.6, damp: 0.62, predelay: 0.02, tone: 2700, mix: 0.28 } },
          ],
          cables: [
            { from: 'clk1:clockOut', to: 'div1:clockIn', color: '#06b6d4', depth: 1 },
            { from: 'clk1:clockOut', to: 'cg1:clockIn', color: '#06b6d4', depth: 1 },
            { from: 'div1:div4Out', to: 'drm1:trigKick', color: '#fbbf24', depth: 1 },
            { from: 'div1:div8Out', to: 'drm1:trigSnare', color: '#fbbf24', depth: 1 },
            { from: 'div1:div2Out', to: 'drm1:trigHat', color: '#fbbf24', depth: 1 },
            { from: 'cg1:rootOut', to: 'bs1:pitchIn', color: '#a855f7', depth: 1 },
            { from: 'div1:div2Out', to: 'bs1:gateIn', color: '#fbbf24', depth: 1 },
            { from: 'div1:div4Out', to: 'slp1:trigIn', color: '#fbbf24', depth: 1 },
            { from: 'slp1:invOut', to: 'bs1:vcaCv', color: '#10b981', depth: 0.7 },
            { from: 'sr1:cvOut', to: 'bs1:modCutoff', color: '#10b981', depth: 0.35 },
          ],
        },
      },
    ];
  }

  getGreenMatrixData() {
    return [
      {
        fromMod: 'slow_random',
        fromPort: 'cvOut',
        fromName: 'Slow Random',
        fromJack: 'CV OUT',
        toMod: 'filter',
        toPort: 'cvCutoff',
        toName: 'Analog Filter',
        toJack: 'CUTOFF CV',
        effect: t('<b>Sanfte Filter-Atmung:</b> Lässt den gesamten Mix organisch wie Meereswellen auf- und abschwingen.', '<b>Gentle Filter Breathing:</b> Sweeps overall mix brightness softly like ocean tides.'),
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
        effect: t('<b>Epischer Ambient-Swell:</b> Lässt Akkordflächen majestätisch anwachsen und ausatmen.', '<b>Epic Ambient Swell:</b> Slowly fades harmonic drones in and out across long arcs.'),
        params: { slope_generator: { mode: 'loop', rise: 10, fall: 18 } },
      },
      {
        fromMod: 'slope_generator',
        fromPort: 'invOut',
        fromName: 'Slope Generator',
        fromJack: 'INV OUT',
        toMod: 'bass',
        toPort: 'vcaCv',
        toName: 'Analog Bass',
        toJack: 'VCA CV',
        effect: t('<b>Sidechain-Ducking:</b> Schafft klaren Raum für Kickdrums oder schwellende Flächen.', '<b>Sidechain Ducking:</b> Instantly carves clean headroom for kicks or rising pads.'),
        params: { slope_generator: { mode: 'loop', rise: 0.03, fall: 0.32 } },
      },
      {
        fromMod: 'slow_random',
        fromPort: 'cvOut',
        fromName: 'Slow Random',
        fromJack: 'CV OUT',
        toMod: 'felt_piano',
        toPort: 'feltCv',
        toName: 'Felt Piano',
        toJack: 'FELT CV',
        effect: t('<b>Lebendige Filz-Ansprache:</b> Jede Note variiert subtil zwischen warm-gedämpft und offen.', '<b>Expressive Hammer Felt:</b> Subtly opens and warms piano transients per note.'),
        params: { slow_random: { rate: 0.14, depth: 0.45 } },
      },
      {
        fromMod: 'slope_generator',
        fromPort: 'envOut',
        fromName: 'Slope Generator',
        fromJack: 'ENV OUT',
        toMod: 'violin',
        toPort: 'bowCv',
        toName: 'Solo Violin',
        toJack: 'BOW CV',
        effect: t('<b>Menschlicher Bogenstrich:</b> Formt realistische Bogen-Crescendi über der Saite.', '<b>Human Bow Phrasing:</b> Shapes lifelike crescendos of rosin bite and sustain.'),
        params: { slope_generator: { mode: 'loop', rise: 4, fall: 7 } },
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
        effect: t('<b>Schwarm-Konvergenz:</b> Zieht 32 driftende Partials zu einem reinen Chor-Akkord zusammen.', '<b>Swarm Convergence:</b> Gathers 32 wild partials smoothly into pure chord tuning.'),
        params: { slope_generator: { mode: 'loop', rise: 6, fall: 14 } },
      },
      {
        fromMod: 'slow_random',
        fromPort: 'cvOut',
        fromName: 'Slow Random',
        fromJack: 'CV OUT',
        toMod: 'delay',
        toPort: 'cvTime',
        toName: 'Stereo Delay',
        toJack: 'TIME CV',
        effect: t('<b>Tape Warble:</b> Verleiht Echo-Wiederholungen weiches Tonband-Leiern.', '<b>Vintage Tape Flutter:</b> Adds gentle nostalgic pitch drift to stereo repeats.'),
        params: { delay: { mix: 0.38, feedback: 0.48 } },
      },
      {
        fromMod: 'slow_random',
        fromPort: 'cvOut',
        fromName: 'Slow Random',
        fromJack: 'CV OUT',
        toMod: 'resonator_garden',
        toPort: 'dampCv',
        toName: 'Resonator Garden',
        toJack: 'DAMP CV',
        effect: t('<b>Material-Atmung:</b> Wechselt zwischen kurzen Holzschlägen und langen Klangschalen.', '<b>Resonant Tails:</b> Morphs acoustic modes from dry wood strikes to long singing bells.'),
        params: { resonator_garden: { modes: 8, decay: 2.8 } },
      },
    ];
  }

  renderBoardsGallery() {
    const container = this.guideModalEl?.querySelector('#boards-container');
    if (!container) return;

    const templatesList = Object.entries(TEMPLATES);
    container.innerHTML = templatesList.map(([key, tpl]) => {
      const moduleCount = tpl.state?.modules?.length || 0;
      const cableCount = tpl.state?.cables?.length || 0;
      const moduleNames = (tpl.state?.modules || []).map((m) => tr(MODULES[m.type]?.title || m.type));
      const uniqueNames = [...new Set(moduleNames)];
      const pillsHtml = uniqueNames.slice(0, 7).map((n) => `<span class="b-mod-pill">${n}</span>`).join('')
        + (uniqueNames.length > 7 ? `<span class="b-mod-pill more">+${uniqueNames.length - 7} ${t('mehr', 'more')}</span>` : '');

      return `
        <article class="board-card" data-board-key="${key}">
          <header class="board-card-head">
            <div class="board-card-title-wrap">
              <h4>${tr(tpl.name)}</h4>
              <span class="board-card-badge">${tr(tpl.category) || t('Vorlage', 'Template')}</span>
            </div>
          </header>
          <p class="board-card-desc">${tr(tpl.description) || t('Vollständig konfiguriertes Modular-Board.', 'Complete pre-wired modular patch.')}</p>
          <div class="board-card-stats">
            <span>${moduleCount} ${t('Module', 'Modules')}</span>
            <span>·</span>
            <span>${cableCount} ${t('Kabel', 'Cables')}</span>
            <span>·</span>
            <span>v${tpl.version || tpl.state?.version || 2}</span>
          </div>
          <div class="board-card-pills">${pillsHtml}</div>
          <div class="board-card-action">
            <button type="button" class="btn-load-board" data-board-key="${key}">${t('Board laden &amp; abspielen', 'Load &amp; Play Board')}</button>
          </div>
        </article>
      `;
    }).join('');

    container.querySelectorAll('.btn-load-board').forEach((btn) => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.boardKey;
        this.options.onStartAudio?.();
        this.options.onLoadTemplate?.(key);
        this.closeGuide();
        this.options.onToast?.(`${t('Board geladen', 'Board loaded')}: ${TEMPLATES[key]?.name || key}`);
      });
    });
  }

  setupTutorialFilters() {
    const row = this.guideModalEl?.querySelector('#tut-filter-row');
    if (!row) return;
    row.querySelectorAll('.pill').forEach((pill) => {
      pill.addEventListener('click', () => {
        row.querySelectorAll('.pill').forEach((p) => p.classList.remove('active'));
        pill.classList.add('active');
        this.activeTutCat = pill.dataset.tutCat || 'all';
        this.renderTutorials(this.activeTutCat);
      });
    });
  }

  renderTutorials(filterCat = 'all') {
    const container = this.guideModalEl?.querySelector('#tutorials-container');
    if (!container) return;

    const allTuts = this.getTutorialData();
    const tuts = filterCat === 'all' ? allTuts : allTuts.filter((x) => x.cat === filterCat);

    container.innerHTML = tuts.map((tut, idx) => {
      const jacksHtml = tut.greenJacks.map((j) => `
        <div class="green-jack-item">
          <span class="green-chip ${j.type}">${j.label}</span>
          <span>${j.desc}</span>
        </div>
      `).join('');

      const stepsHtml = (tut.steps || []).map((st) => `<li>${st}</li>`).join('');

      return `
        <article class="tut-card" style="--tut-color:${tut.color};" id="${tut.id}">
          <header class="tut-head">
            <div class="tut-title-wrap">
              <span class="tut-num">${String(idx + 1).padStart(2, '0')}</span>
              <h4>${tut.title}</h4>
            </div>
            <span class="tut-badge">${tut.badge}</span>
          </header>

          <p class="tut-desc">${tut.desc}</p>

          <div class="green-jacks-box">
            <div class="tut-section-lbl">${t('WICHTIGE BUCHSEN &amp; CV', 'KEY JACKS &amp; CV')}</div>
            ${jacksHtml}
          </div>

          <div class="tut-patch-scheme">
            <div class="tut-section-lbl">${t('PATCH-ANATOMIE &amp; KLANGWIRKUNG', 'PATCH ANATOMY &amp; SONIC PAYOFF')}</div>
            <div class="scheme-cable">
              <span class="green-chip out">${tut.scheme.fromLbl}</span>
              <span class="scheme-arrow">-></span>
              <span class="green-chip in">${tut.scheme.toLbl}</span>
            </div>
            <div class="sonic-effect">${tut.scheme.sonicEffect}</div>
          </div>

          ${stepsHtml ? `
            <div class="tut-steps-box">
              <div class="tut-section-lbl">${t('SCHRITT-FÜR-SCHRITT AUFBAU', 'STEP-BY-STEP BUILD')}</div>
              <ol class="tut-steps-list">${stepsHtml}</ol>
              ${tut.proTip ? `<div class="tut-protip">${tut.proTip}</div>` : ''}
            </div>
          ` : ''}

          <div class="tut-action-bar">
            <button type="button" class="btn-tut-splice" data-tut-id="${tut.id}">${t('In aktuelles Board ergänzen', 'Add to Active Rack')}</button>
            <button type="button" class="btn-auto-patch" data-tut-id="${tut.id}">${t('Tutorial-Board laden', 'Load Tutorial Patch')}</button>
          </div>
        </article>
      `;
    }).join('');

    container.querySelectorAll('.btn-auto-patch').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tut = allTuts.find((x) => x.id === btn.dataset.tutId);
        if (!tut?.state) return;
        this.onStartAudio?.();
        if (this.onLoadRackState) {
          this.onLoadRackState(structuredClone(tut.state), tut.state.name);
        } else {
          this.applyTutorialPreset(tut.state);
        }
        btn.classList.add('done');
        btn.textContent = t('Im Rack geladen', 'Loaded in Rack');
        setTimeout(() => {
          btn.classList.remove('done');
          btn.textContent = t('Tutorial-Board laden', 'Load Tutorial Patch');
        }, 2500);
      });
    });

    container.querySelectorAll('.btn-tut-splice').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tut = allTuts.find((x) => x.id === btn.dataset.tutId);
        if (!tut?.state) return;
        this.applyTutorialPreset(tut.state);
        btn.classList.add('done');
        btn.textContent = t('Ergänzt', 'Added');
        setTimeout(() => {
          btn.classList.remove('done');
          btn.textContent = t('In aktuelles Board ergänzen', 'Add to Active Rack');
        }, 2500);
      });
    });
  }

  renderGreenGuide() {
    const container = this.guideModalEl?.querySelector('#green-matrix-container');
    if (!container) return;

    const matrix = this.getGreenMatrixData();
    container.innerHTML = matrix.map((row, idx) => `
      <div class="matrix-row">
        <div class="matrix-socket">
          <span class="m-mod">${row.fromName}</span>
          <span class="m-jack">${row.fromJack} (OUT)</span>
        </div>
        <div class="matrix-arrow">-></div>
        <div class="matrix-socket">
          <span class="m-mod">${row.toName}</span>
          <span class="m-jack">${row.toJack} (IN)</span>
        </div>
        <div class="matrix-effect">${row.effect}</div>
        <div class="matrix-action">
          <button type="button" class="btn-auto-patch" data-matrix-idx="${idx}">${t('Verbinden', 'Connect')}</button>
        </div>
      </div>
    `).join('');

    container.querySelectorAll('.btn-auto-patch').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.matrixIdx, 10);
        const row = matrix[idx];
        if (!row) return;
        this.connectGreenPair(row.fromMod, row.fromPort, row.toMod, row.toPort, row.params);
        btn.classList.add('done');
        btn.textContent = t('Verbunden', 'Connected');
        setTimeout(() => {
          btn.classList.remove('done');
          btn.textContent = t('Verbinden', 'Connect');
        }, 2400);
      });
    });
  }

  getNextFreePosition() {
    const existing = [...this.engine.controls, ...this.engine.sources, ...this.engine.effects];
    let maxY = 0;
    let rightMost = 60;
    existing.forEach((m) => {
      const p = m.pos || { x: 60, y: 60 };
      if (p.y > maxY) maxY = p.y;
      if (p.x > rightMost) rightMost = p.x;
    });
    if (existing.length === 0) return { x: 60, y: 60 };
    if (rightMost < 1100) return { x: rightMost + 280, y: Math.max(60, maxY) };
    return { x: 60, y: maxY + 300 };
  }

  connectGreenPair(fromModType, fromPort, toModType, toPort, params = {}) {
    let fromMod = this.engine.findByType(fromModType);
    if (!fromMod) fromMod = this.engine.add(fromModType, { pos: this.getNextFreePosition() });

    let toMod = this.engine.findByType(toModType);
    if (!toMod) toMod = this.engine.add(toModType, { pos: this.getNextFreePosition() });

    if (!fromMod || !toMod) {
      this.notify(t('Fehler beim Verbinden der Module', 'Error connecting modules'));
      return;
    }

    Object.entries(params).forEach(([mType, pObj]) => {
      const m = this.engine.findByType(mType);
      if (m) {
        Object.entries(pObj).forEach(([pKey, pVal]) => m.setParam?.(pKey, pVal));
        m.refreshKnobs?.();
      }
    });

    this.engine.patchSystem.connect(fromMod.id, fromPort, toMod.id, toPort, '#10b981', 1);
    this.onRackModified?.();
    this.onStartAudio?.();

    setTimeout(() => {
      this.patchBay.flashJack(`${fromMod.id}:${fromPort}`);
      this.patchBay.flashJack(`${toMod.id}:${toPort}`);
    }, 80);

    const fromLabel = fromMod.meta.jacks?.find((j) => j.id === fromPort)?.label || fromPort;
    const toLabel = toMod.meta.jacks?.find((j) => j.id === toPort)?.label || toPort;
    this.notify(`${t('Verbunden', 'Connected')}: ${fromMod.meta.title} (${fromLabel}) -> ${toMod.meta.title} (${toLabel})`);
  }

  applyTutorialPreset(recipe) {
    if (!recipe) return;

    const idToMod = new Map();

    // Supports both clean state objects ({ modules: [{ id, type, values, pos }], cables }) and compact recipe lists ({ modules: ['master_clock', ...] })
    (recipe.modules || []).forEach((item) => {
      const type = typeof item === 'string' ? item : item.type;
      let mod = (typeof item !== 'string' && item.id) ? this.engine.find(item.id) : null;
      if (!mod) mod = this.engine.findByType(type);
      if (!mod) {
        const modState = typeof item === 'string'
          ? { pos: this.getNextFreePosition(), values: recipe.params?.[type] || {} }
          : { ...structuredClone(item), pos: item.pos || this.getNextFreePosition() };
        mod = this.engine.add(type, modState);
      } else if (typeof item !== 'string' && item.values) {
        Object.entries(item.values).forEach(([k, v]) => mod.setParam?.(k, v));
        mod.refreshKnobs?.();
      }
      if (mod) {
        if (typeof item !== 'string' && item.id) idToMod.set(item.id, mod);
        idToMod.set(type, mod);
      }
    });

    if (recipe.params) {
      Object.entries(recipe.params).forEach(([type, pMap]) => {
        const m = idToMod.get(type) || this.engine.findByType(type);
        if (m) {
          Object.entries(pMap).forEach(([k, v]) => m.setParam?.(k, v));
          m.refreshKnobs?.();
        }
      });
    }

    (recipe.cables || []).forEach((c) => {
      const [fromKey, fromPort] = c.from.split(':');
      const [toKey, toPort] = c.to.split(':');
      const fromMod = idToMod.get(fromKey) || this.engine.find(fromKey) || this.engine.findByType(fromKey);
      const toMod = idToMod.get(toKey) || this.engine.find(toKey) || this.engine.findByType(toKey);
      if (fromMod && toMod) {
        this.engine.patchSystem.connect(fromMod.id, fromPort, toMod.id, toPort, c.color || '#10b981', c.depth ?? 1);
      }
    });

    this.onRackModified?.();
    this.onStartAudio?.();

    (recipe.cables || []).forEach((c) => {
      const [fromKey, fromPort] = c.from.split(':');
      const [toKey, toPort] = c.to.split(':');
      const fromMod = idToMod.get(fromKey) || this.engine.find(fromKey) || this.engine.findByType(fromKey);
      const toMod = idToMod.get(toKey) || this.engine.find(toKey) || this.engine.findByType(toKey);
      if (fromMod && toMod) {
        setTimeout(() => {
          this.patchBay.flashJack(`${fromMod.id}:${fromPort}`);
          this.patchBay.flashJack(`${toMod.id}:${toPort}`);
        }, 120);
      }
    });

    this.notify(`${t('Patch aktiviert', 'Setup activated')}: ${recipe.name || 'Tutorial'}`);
  }

  renderGuideModulesList(filterCat = 'all', searchQuery = '') {
    const container = this.guideModalEl?.querySelector('#guide-modules-list');
    if (!container) return;

    const examples = getModuleExamples();
    const query = searchQuery.trim().toLowerCase();
    const modules = Object.values(MODULES).filter((M) => {
      if (filterCat !== 'all' && M.category !== filterCat) return false;
      if (!query) return true;
      return (
        M.title.toLowerCase().includes(query) ||
        M.type.toLowerCase().includes(query) ||
        M.description.toLowerCase().includes(query) ||
        M.category.toLowerCase().includes(query) ||
        (M.jacks || []).some((j) => j.id.toLowerCase().includes(query) || j.label.toLowerCase().includes(query) || j.signal.toLowerCase().includes(query))
      );
    });

    if (modules.length === 0) {
      container.innerHTML = `<div class="guide-empty-search">${t('Kein Modul gefunden.', 'No matching modules found.')}</div>`;
      return;
    }

    container.innerHTML = modules.map((M) => {
      const jacksHtml = (M.jacks && M.jacks.length)
        ? `<div class="g-mod-jacks">
            <b>${t('Buchsen', 'Jacks')}:</b>
            <div class="g-jacks-row">
              ${M.jacks.map((j) => {
                const col = SIGNAL_COLORS[j.signal] || '#aaa';
                return `<span class="g-jack-chip" style="border-color:${col}55;" title="ID: ${j.id}">
                  <span class="chip-dot" style="background:${col};"></span>
                  <span class="chip-type">${j.type.toUpperCase()}:</span>
                  <span class="chip-name">${j.label}</span>
                  <small>(${j.id})</small>
                </span>`;
              }).join('')}
            </div>
           </div>`
        : '';

      const paramsHtml = (M.params && M.params.length)
        ? `<div class="g-mod-params">
            <b>${t('Regler', 'Controls')}:</b> ${M.params.map((p) => `<code>${tr(p.label)}</code>`).join(', ')}
           </div>`
        : '';

      const ex = examples[M.type];
      const exHtml = ex ? `
        <div class="g-mod-example">
          <div class="g-mod-example-head">
            <span class="ex-lbl">${t('PRAXIS-BEISPIEL', 'PRACTICE PATCH')}</span>
            <button type="button" class="btn-example-load" data-mod-type="${M.type}">${t('Beispiel anhören', 'Audition Example')}</button>
          </div>
          <p class="ex-text">${ex.desc}</p>
          <div class="ex-wiring"><b>${t('Verdrahtung', 'Wiring')}:</b> <code>${ex.wiring}</code></div>
        </div>
      ` : '';

      const catLabel = M.category === 'control'
        ? t('Steuerung', 'Control')
        : M.category === 'source'
          ? t('Klangquelle', 'Instrument')
          : t('Effekt', 'Effect');

      return `
        <article class="g-mod-card" style="--card-color:${M.color};">
          <header class="g-mod-head">
            <div class="g-mod-titles">
              <h4>${tr(M.title)}</h4>
              <span class="g-mod-cat">${catLabel} · ${M.type}</span>
            </div>
          </header>
          <p class="g-mod-desc">${tr(M.description)}</p>
          ${paramsHtml}
          ${jacksHtml}
          ${exHtml}
        </article>
      `;
    }).join('');

    container.querySelectorAll('.btn-example-load').forEach((btn) => {
      btn.addEventListener('click', () => {
        const ex = examples[btn.dataset.modType];
        if (!ex?.recipe) return;
        this.applyTutorialPreset(ex.recipe);
        btn.classList.add('done');
        btn.textContent = t('Aktiv im Rack', 'Active in Rack');
        setTimeout(() => {
          btn.classList.remove('done');
          btn.textContent = t('Beispiel anhören', 'Audition Example');
        }, 2500);
      });
    });
  }

  setupGuideSearch() {
    const searchInput = this.guideModalEl?.querySelector('#guide-module-search');
    const pills = this.guideModalEl?.querySelectorAll('.filter-pills .pill');
    if (!searchInput || !pills) return;
    let currentCat = 'all';

    pills.forEach((pill) => {
      pill.addEventListener('click', () => {
        pills.forEach((p) => p.classList.remove('active'));
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
    if (targetTab) {
      this.activeTabId = targetTab;
      const tabBtns = this.guideModalEl.querySelectorAll('.guide-tab-btn');
      const panes = this.guideModalEl.querySelectorAll('.guide-tab-pane');
      tabBtns.forEach((b) => b.classList.toggle('active', b.dataset.tab === targetTab));
      panes.forEach((p) => p.classList.toggle('active', p.id === targetTab));
    }
    this.guideModalEl.classList.add('open');
  }

  closeGuide() {
    this.guideModalEl.classList.remove('open');
  }
}
