# SYNTHBOARD – Vollständige Bestandsaufnahme & Sounddesign-Referenz

> **Zweck dieses Dokuments:**  
> Dieses Dokument bietet einer externen KI oder einem Musiker eine lückenlose, technisch exakte Übersicht aller tatsächlich im Code implementierten Funktionen von **SYNTHBOARD**. Es dient als verbindliche Wissensbasis, um Schritt für Schritt beim Sounddesign, Patching, Beatbauen und bei Live-Performances anzuleiten, ohne den Quellcode lesen zu müssen.
>
> **Stand:** Codebasis nach Bereinigung (29 Module, Snapshot-System, 5-Slot Focus Dock, Tastatur-Workflow, 14 Beispiel-Boards).

---

## Inhaltsverzeichnis
1. [Überblick & Systemarchitektur](#1-überblick--systemarchitektur)
2. [Bedienoberfläche, Steuerung & Interaktion](#2-bedienoberfläche-steuerung--interaktion)
3. [Das modulare Patch-System (Kabel, Signaltypen & Modulationsstärke)](#3-das-modulare-patch-system-kabel-signaltypen--modulationsstärke)
4. [Kanalzug & Mixer-Architektur jeder Klangquelle](#4-kanalzug--mixer-architektur-jeder-klangquelle)
5. [Vollständiger Modulkatalog (29 Module)](#5-vollständiger-modulkatalog-29-module)
   - 5.1 [Steuerung & Rhythmus (10 Module)](#51-steuerung--rhythmus-10-module)
   - 5.2 [Klangquellen & Instrumente (13 Module)](#52-klangquellen--instrumente-13-module)
   - 5.3 [Effektkette (6 Module)](#53-effektkette-6-module)
6. [Presets, Boards & Performance Snapshot-System](#6-presets-boards--performance-snapshot-system)
7. [Technische Besonderheiten & Signalfluss](#7-technische-besonderheiten--signalfluss)
8. [Status: Funktionsfähig, Teilweise umgesetzt & Geplant](#8-status-funktionsfähig-teilweise-umgesetzt--geplant)
9. [Drei konkret nachbaubare Patch-Beispiele](#9-drei-konkret-nachbaubare-patch-beispiele)
   - 9.1 [Patch 1: Atmendes, weiches Akkord-Pad](#91-patch-1-atmendes-weiches-akkord-pad)
   - 9.2 [Patch 2: Gläserner, generativer Pluck](#92-patch-2-gläserner-generativer-pluck)
   - 9.3 [Patch 3: Drückender Analog-Subbass](#93-patch-3-drückender-analog-subbass)

---

## 1. Überblick & Systemarchitektur

SYNTHBOARD ist eine browserbasierte, semi-modulare Synthesizer- und Ambient-Groovebox auf Basis der **Web Audio API**.

### Grundprinzip des Signalflusses
1. **Steuerung (Control-Ebene):** Module wie Clocks, Sequencer, Euklidische Rhythmen und LFOs erzeugen Steuerimpulse (Trigger, Clock, Gate, Pitch, CV). Sie werden über virtuelle farbcodierte Patchkabel frei an Instrumente oder Effektparameter geroutet.
2. **Klangquellen (Audio-Ebene):** Bis zu 13 verschiedene Syntheseformen laufen parallel. Jede Klangquelle verfügt über einen eigenen integrierten **Kanalzug** (VCA, Pan, Delay Send, Reverb Send).
3. **Effektkette (Master-FX):** Alle aktiven Klangquellen werden summiert und durchlaufen eine serielle Effektkette (Filter, Chorus, LoFi, Reverb, Delay, Tremolo), bevor das Signal am Master-Ausgang mit Limiter und Oszilloskop ankommt.

---

## 2. Bedienoberfläche, Steuerung & Interaktion

### 2.1 Rack & Navigation
- **Module hinzufügen:** Linke Seitenleiste „Module“. Klick auf das `+`-Symbol oder Ziehen (Drag & Drop) in die entsprechende Rack-Reihe (Steuerung oben, Klangquellen Mitte, Effekte unten).
- **Module entfernen:** Klick auf das `✕` oben rechts auf der Modulkarte.
- **Modul ein-/ausschalten (Bypass):** Klick auf die LED / Power-Taste im Modulkopf.
- **Zoom & Rack-Ansicht:**
  - `+` / `-` Tasten oben links oder Mausrad mit gehaltener Strg/Cmd-Taste.
  - `Fit`-Button: Passt die Ansicht automatisch optimal an den Bildschirm an.
- **Master-Sektion (oben rechts):**
  - Master-Lautstärkeregler (0–100%).
  - Live-Oszilloskop (Wellenform-Visualisierung).
  - REC-Button: Nimmt das Master-Audio direkt als WAV-Datei auf.

### 2.2 Regler-Steuerung (Knobs)
Jeder Drehregler auf der Oberfläche bietet drei intuitive Steuerungsmöglichkeiten:
1. **Maus-Drag:** Klicken und vertikal nach oben/unten ziehen.
2. **Klick & Tastatursteuerung (Fokus):**
   - Ein einfacher Klick auf einen Regler aktiviert den **cyanfarbenen Fokusring**.
   - **Pfeiltasten** `↑` / `→`: Wert schrittweise erhöhen.
   - **Pfeiltasten** `↓` / `←`: Wert schrittweise verringern.
   - **Shift + Pfeiltaste:** Feineinstellung in Mikroschritten (0.5%).
   - **Alt + Pfeiltaste:** Grobeinstellung in großen Sprüngen (8%).
   - **Doppelklick auf Regler:** Setzt den Regler exakt auf seinen Standardwert (Default) zurück.

### 2.3 Das 5-Slot Focus-Dock
Für präzises Schrauben an komplexen Sounds können Regler in das **Focus-Dock** gepinnt werden:
- **Regler hinzufügen:** **`Shift + Klick`** auf einen beliebigen Drehregler im Rack pinnt ihn in das links ausfahrende Dock.
- **Kapazität:** Bis zu **5 Regler** gleichzeitig.
- **Bedienung im Dock:**
  - Extra große **68-Pixel-Regler** mit kontrastreicher LED-Ringanzeige.
  - Exakter Zahlenwert mit Einheit (Hz, %, ms, bpm).
  - Feinschrittige Tasten `◀` und `▶` pro Regler.
  - Klick auf `✕` entfernt den Regler aus dem Dock; `Alle leeren` leert alle 5 Slots.
  - Vollständige bidirektionale Echtzeit-Synchronisation mit dem Modul im Rack.

### 2.4 Globale Tastatur-Shortcuts
- **Leertaste:** Master-Transport Start / Pause.
- **Tasten `1`, `2`, `3`, `4`, `5`:** Snapshot-Performance-Slots 1 bis 5 direkt anwählen.
- **Tasten `6`, `7`, `8`:** Snapshot-Morph-Geschwindigkeit einstellen:
  - `6`: **Direkt** (0 s Umschaltzeit).
  - `7`: **Glide** (0.8 s weiche Übergangszeit).
  - `8`: **Slow Morph** (3.5 s schwebende Ambient-Morphing-Zeit).
- **Noten-Eingabe (Touch Keys):** Reihe `A, W, S, E, D, F, T, G, Z, H, U, J` spielt Tonleiter wie auf einem Klavier.

---

## 3. Das modulare Patch-System (Kabel, Signaltypen & Modulationsstärke)

Das Patch-System verbindet Modulbuchsen (Jacks) miteinander.

### 3.1 Signaltypen & Kabelfarben
| Signaltyp | Buchsen-Farbe | Hex-Code | Funktion & Wertebereich |
|---|---|---|---|
| **Clock** | Elektrisches Cyan | `#06b6d4` | Rhythmische Taktimpulse (1/16, 1/8, 1/4, 1 Bar) |
| **Gate / Trigger** | Warmes Bernstein / Gold | `#fbbf24` | Note-On Impulse, Percussion-Schläge, Hüllkurven-Start |
| **Pitch** | Neon-Violett | `#a855f7` | Tonhöhensteuerung in MIDI-Halbtönen (z. B. 48 = C3, 60 = C4) |
| **Mod / CV** | Smaragd-Grün | `#10b981` | Modulationsspannung (0.0 bis 1.0 unipolar bzw. -1.0 bis +1.0 bipolar) |
| **Audio** | Himmelblau | `#60a5fa` | Internes Audiosignal (Kanalzüge zur Master-Effektkette) |

### 3.2 Kabel patchen & entfernen
- **Verbindung herstellen:** Auf eine **Ausgangsbuchse (OUT)** klicken, gedrückt halten und zur gewünschten **Eingangsbuchse (IN)** ziehen (oder Ausgang anklicken und anschließend Eingang anklicken).
- **Kabel löschen:** 
  - Klick auf eine belegte Eingangsbuchse trennt das Kabel.
  - Rechtsklick auf die Buchse oder das Kabel.
- **Regel:** Ein Eingang (IN) kann immer nur von **einem** Kabel gespeist werden. Ein Ausgang (OUT) kann parallel zu **beliebig vielen** Eingängen gepatcht werden (Signalvervielfachung / Multiple).

### 3.3 Modulationsstärke pro Kabel (Depth-Badge)
Jedes gesteckte Kabel besitzt in der Mitte eine interaktive Prozent-Plakette:
- **Bereich:** `0%` bis `200%` (Standard: `100%`).
- **Einstellen:** Auf das Prozent-Badge klicken und vertikal ziehen, oder das **Mausrad** über dem Badge drehen.
- **Wirkung:**
  - Bei `100%`: Volle Modulationsauslenkung.
  - Bei `50%`: Halbe Auslenkung (perfekt für dezente Filterfahrten).
  - Bei `0%`: Kabel ist stummgeschaltet, bleibt aber gesteckt.
  - Bei `panCv`: Skaliert die Modulation gleichmäßig um die Stereo-Mitte.

---

## 4. Kanalzug & Mixer-Architektur jeder Klangquelle

Jede Klangquelle (`SourceBase`) besitzt am unteren Rand einen vollwertigen Stereo-Mixer-Kanalzug (`Kanalzug – Pan & Aux Sends`):

| Element | Bereich | Funktion |
|---|---|---|
| **PAN** | -100% (L) bis +100% (R) | Positionierung im Stereofeld |
| **DELAY** (Aux Send) | 0% bis 100% | Anteil des Signals, der in das Master Stereo-Delay geschickt wird |
| **REVERB** (Aux Send) | 0% bis 100% | Anteil des Signals, der in den Ambient Reverb geschickt wird |
| **VCA CV (Buchse)** | CV IN (0..1) | Steuert direkt die Lautstärke des Instruments (für externe Hüllkurven & Swells) |
| **PAN CV (Buchse)** | CV IN (0..1) | Moduliert die Panoramaposition dynamisch im Stereofeld |

> [!NOTE]
> Wenn ein Kabel an **VCA CV** angeschlossen wird, übernimmt die anliegende Steuerspannung die Lautstärkekontrolle der Stimme. Ohne Kabel an VCA CV ist die Stimme voll geöffnet (Dauer-Drone oder instrumenteneigene Hüllkurve).

---

## 5. Vollständiger Modulkatalog (29 Module)

### 5.1 Steuerung & Rhythmus (10 Module)

#### 1. Master Clock (`master_clock`)
- **Zweck:** Das rhythmische Herz des Racks. Erzeugt hochpräzise BPM-Takte und Swing.
- **Optionen (Dropdown):**
  - `Transport` (`running`): `▶ Läuft` | `■ Pause`
- **Regler:**
  - `Tempo` (`tempo`): 40 bis 200 bpm (Standard: 88 bpm)
  - `Swing` (`swing`): 0% bis 60% (Standard: 12%)
- **Buchsen:**
  - `1/16` (`clockOut`) [OUT, Clock]: Sechzehntel-Pulse
  - `1/8` (`div2Out`) [OUT, Clock]: Achtel-Pulse
  - `1/4` (`div4Out`) [OUT, Clock]: Viertel-Pulse
  - `1 BAR` (`barOut`) [OUT, Clock]: Taktanfang (ganzer Takt)
  - `RESET` (`resetOut`) [OUT, Gate]: Trigger-Impuls beim Start

#### 2. Clock Divider (`clock_divider`)
- **Zweck:** Teilt eingehende Clock-Signale musikalisch herunter, um langsame Rhythmen und polyrhythmische Strukturen zu erzeugen.
- **Buchsen:**
  - `CLOCK` (`clockIn`) [IN, Clock]: Clock-Eingang
  - `RESET` (`resetIn`) [IN, Gate]: Zähler-Reset
  - `/2 (1/8)` (`div2Out`) [OUT, Clock]: Halbiertes Tempo
  - `/3 (Triol)` (`div3Out`) [OUT, Clock]: Triolen-Teilung
  - `/4 (1/4)` (`div4Out`) [OUT, Clock]: Viertel-Teilung
  - `/8 (1/2)` (`div8Out`) [OUT, Clock]: Halbe Noten
  - `/16 (1 Bar)` (`div16Out`) [OUT, Clock]: Ganzer Takt

#### 3. Euclidean Rhythm (`euclidean`)
- **Zweck:** Verteilt eine Anzahl Schläge nach dem Björklund-Algorithmus mathematisch gleichmäßig über ein Step-Gitter (Weltmusik-, Minimal- & IDM-Grooves).
- **Regler:**
  - `Steps` (`steps`): 1 bis 16 Schritte (Standard: 16)
  - `Hits` (`pulses`): 0 bis 16 Schläge (Standard: 5)
  - `Rotate` (`rotation`): 0 bis 15 Schritte Verschiebung (Standard: 0)
- **Buchsen:**
  - `CLOCK` (`clockIn`) [IN, Clock]
  - `RESET` (`resetIn`) [IN, Gate]
  - `TRIG` (`trigOut`) [OUT, Gate]: Ausgelöste Euklid-Hits
  - `OFF-BEAT` (`invOut`) [OUT, Gate]: Pausen/Off-Beats

#### 4. Probability Gate (`prob_gate`)
- **Zweck:** Lässt eintreffende Trigger nur mit einer bestimmten Wahrscheinlichkeit passieren; erzeugt lebendige, unvorhersehbare Rhythmen.
- **Regler:**
  - `Chance` (`chance`): 0% bis 100% Durchlass-Wahrscheinlichkeit (Standard: 75%)
  - `Burst` (`burst`): 1 bis 3 Mehrfachschläge pro Treffer (Standard: 1)
- **Buchsen:**
  - `TRIG IN` (`trigIn`) [IN, Gate]
  - `PASSED` (`trigOut`) [OUT, Gate]: Erfolgreich durchgelassene Trigger
  - `DROPPED` (`altOut`) [OUT, Gate]: Verworfene Trigger (für Alternativ-Triggering)

#### 5. Random Walk (`random_walk`)
- **Zweck:** Generativer Tonhöhen-Wanderer. Wandert bei jedem Clock-Schritt zufällig nach oben oder unten innerhalb einer wählbaren Skala.
- **Optionen (Dropdown):**
  - `Tonart` (`key`): C, C#, D, D#, E, F, F#, G, G#, A (Standard), B♭, B
  - `Skala` (`scale`): Moll Penta, Dur Penta, Dorisch (Standard), Moll, Dur, Hirajoshi
  - `Oktave` (`octave`): Okt 1 (24), Okt 2 (36), Okt 3 (48, Standard), Okt 4 (60)
- **Regler:**
  - `Schritt` (`stepSize`): 1 bis 4 Tonschritte pro Sprung (Standard: 2)
  - `Umfang` (`range`): 1 bis 3 Oktaven Tonumfang (Standard: 2)
  - `Loop` (`repeat`): 0 bis 16 Schritte Schleifen-Gedächtnis (0 = unendlich frei, Standard: 8)
  - `Mutation` (`mutation`): 0% bis 100% Mutationsrate im Loop (Standard: 25%)
  - `Seed` (`seed`): 1 bis 9999 Zufalls-Startwert (Standard: 42)
- **Buchsen:**
  - `CLOCK` (`clockIn`) [IN, Clock]
  - `RESET` (`resetIn`) [IN, Gate]
  - `PITCH` (`pitchOut`) [OUT, Pitch]: Quantisierte MIDI-Note
  - `GATE` (`gateOut`) [OUT, Gate]: Trigger pro Schritt

#### 6. Scale Quantizer (`quantizer`)
- **Zweck:** Zwingt beliebige eingehende Tonhöhen oder Steuerspannungen exakt auf eine musikalische Tonart und Skala.
- **Optionen (Dropdown):**
  - `Grundton` (`key`): C bis B (Standard: A)
  - `Skala` (`scale`): Moll Penta, Dur Penta, Dorisch (Standard), Moll, Dur, Hirajoshi
- **Regler:**
  - `Transp.` (`transpose`): -12 bis +12 Halbtöne (Standard: 0)
- **Buchsen:**
  - `PITCH IN` (`pitchIn`) [IN, Pitch]: Rohe Tonhöhe / CV
  - `SAMPLE` (`trigIn`) [IN, Gate]: Sample & Hold Auslöser
  - `QUANT OUT` (`pitchOut`) [OUT, Pitch]: Exakt quantisierte Tonhöhe
  - `GATE` (`gateOut`) [OUT, Gate]: Trigger bei Notenwechsel

#### 7. Slow Random (`slow_random`)
- **Zweck:** Langsam fließende, organische Modulationsspannungen für Filterfahrten, Panorama-Drift und lebendige Ambient-Klangfarben.
- **Optionen (Dropdown):**
  - `Kurve` (`mode`): `Gleitend` (sanft interpoliert) | `Stufig (S&H)` (Treppenstufen)
- **Regler:**
  - `Rate` (`rate`): 0.02 bis 2.50 Hz log (Standard: 0.15 Hz)
  - `Glättung` (`smooth`): 0.05 bis 3.00 s (Standard: 0.80 s)
  - `Tiefe` (`depth`): 0% bis 100% (Standard: 75%)
- **Buchsen:**
  - `S&H CLOCK` (`trigIn`) [IN, Gate]: Friert bei Trigger einen neuen Zufallswert ein
  - `CV OUT` (`cvOut`) [OUT, Mod]: Modulationsspannung (0..1)
  - `INV CV` (`invOut`) [OUT, Mod]: Invertierte Modulationsspannung (1..0)

#### 8. Macro & Szene (`macro`)
- **Zweck:** Zentrale Master-Steuerung mehrerer Sound-Aspekte über drei globale Makro-Spannungen.
- **Regler:**
  - `Dichte` (`density`): 0% bis 100% (Standard: 65%)
  - `Variation` (`variation`): 0% bis 100% (Standard: 35%)
  - `Bewegung` (`motion`): 0% bis 100% (Standard: 50%)
  - `Seed` (`seed`): 1 bis 9999
- **Buchsen:**
  - `DICHTE CV` (`densityOut`) [OUT, Mod]
  - `VARIATION CV` (`variationOut`) [OUT, Mod]
  - `BEWEGUNG CV` (`motionOut`) [OUT, Mod]

#### 9. Slope Generator (`slope_generator`)
- **Zweck:** Vielseitige Funktionskurve: ASR/AD-Hüllkurve, Attack-Decay-LFO oder Slew-Limiter (Glide).
- **Optionen (Dropdown):**
  - `Modus` (`mode`): `Loop` (schwingt als LFO) | `Trigger` (läuft einmal komplett durch) | `Gate` (hält Sustain solange Gate anliegt)
- **Regler:**
  - `Anstieg Rise` (`rise`): 0.05 bis 30 s log (Standard: 0.8 s)
  - `Abfall Fall` (`fall`): 0.05 bis 30 s log (Standard: 1.6 s)
  - `Kurve` (`curve`): -1.0 (logarithmisch) bis +1.0 (exponentiell) (Standard: -0.2)
  - `Zyklus` (`loop`): 0 (Aus) oder 1 (Ein)
- **Buchsen:**
  - `TRIG IN` (`trigIn`) [IN, Gate]: Startet Hüllkurve
  - `MOD RISE` (`riseCv`) [IN, Mod]: Moduliert Anstiegszeit
  - `MOD FALL` (`fallCv`) [IN, Mod]: Moduliert Abfallzeit
  - `ENV OUT` (`envOut`) [OUT, Mod]: Hüllkurven-Ausgang (0..1)
  - `INV OUT` (`invOut`) [OUT, Mod]: Invertierte Hüllkurve
  - `EOR` (`eorOut`) [OUT, Gate]: End of Rise Trigger (wenn Anstieg abgeschlossen ist)
  - `EOF` (`eofOut`) [OUT, Gate]: End of Fall Trigger (wenn Abfall abgeschlossen ist)

#### 10. Attenuverter & Offset (`attenuverter`)
- **Zweck:** Präzises Skalieren, Invertieren und Verschieben zweier CV-Spannungen inklusive Summierung.
- **Regler:**
  - `Skala A` (`scaleA`): -100% bis +100% (Standard: 100%)
  - `Offset A` (`offsetA`): -1.00 bis +1.00 (Standard: 0.00)
  - `Skala B` (`scaleB`): -100% bis +100% (Standard: 100%)
  - `Offset B` (`offsetB`): -1.00 bis +1.00 (Standard: 0.00)
- **Buchsen:**
  - `IN A` (`inA`) [IN, Mod]
  - `IN B` (`inB`) [IN, Mod]
  - `OUT A` (`outA`) [OUT, Mod]
  - `OUT B` (`outB`) [OUT, Mod]
  - `A+B SUM` (`sumOut`) [OUT, Mod]: Summe beider verarbeiteten Spannungen

---

### 5.2 Klangquellen & Instrumente (13 Module)

Alle Klangquellen besitzen standardmäßig den integrierten Mixer-Kanalzug (`PAN`, `DELAY`, `REVERB`, `VCA CV`, `PAN CV`).

#### 1. Felt Piano (`felt_piano`)
- **Klangcharakter:** Intimes, mechanisches Filzklavier mit gedämpftem Anschlag, Holzresonanz und Raumklang im Stile von Nils Frahm oder Ólafur Arnalds.
- **Optionen (Dropdown):**
  - `Akkord` (`chord`): `Einzelnote` (`single`), `Oktave` (`octave`), `Quinte` (`fifth`), `Moll` (`minor`), `Dur` (`major`), `Sus2` (`sus2`)
- **Regler:**
  - `Level` (`level`): 0% bis 100% (Standard: 80%)
  - `Anschlag` (`felt`): 0% bis 100% Filzdämpfung (Standard: 65%)
  - `Ausklang` (`decay`): 0.3 bis 6.0 s log (Standard: 2.8 s)
  - `Klangfarbe` (`color`): 400 bis 8000 Hz log (Standard: 3000 Hz)
  - `Korpus` (`body`): 0% bis 100% Holz-Resonanz (Standard: 60%)
  - `Hammer` (`hammer`): 0% bis 100% Tasten-Mechanik-Knistern (Standard: 40%)
- **Buchsen:**
  - `GATE` (`gateIn`) [IN, Gate]
  - `PITCH` (`pitchIn`) [IN, Pitch]
  - `VEL CV` (`velCv`) [IN, Mod]: Anschlagdynamik
  - `FILZ CV` (`feltCv`) [IN, Mod]: Dynamische Filzdämpfung
  - `VCA CV` (`vcaCv`) [IN, Mod]
  - `PAN CV` (`panCv`) [IN, Mod]

#### 2. Drone Maschine (`drone`)
- **Klangcharakter:** Vielstimmiger analoger Drone-Cluster nach dem Vorbild des Elmyra / Solar 42 mit Schwebung, Sub-Oszillator und analogem Frequenzdriften.
- **Optionen (Dropdown):**
  - `Grundton` (`root`): E1 (28) bis A2 (45) (Standard: A1 / 33)
  - `Akkord` (`chord`): `Quinten` (`fifth`), `Oktaven` (`octaves`), `Moll 9` (`minor9`), `Dur maj7` (`major7`), `Sus` (`sus`), `Cluster` (`cluster`)
  - `Welle` (`wave`): Saw (Sägezahn), Triangle (Dreieck), Square (Rechteck), Sine (Sinus)
- **Zusatz-UI:** 6 interaktive **Voice-Pads** (beschriftet mit den echten Notennamen) zum einzelnen Ein-/Ausschalten jeder Drone-Stimme.
- **Regler:**
  - `Level` (`level`): 0% bis 100% (Standard: 70%)
  - `Tone` (`tone`): 150 bis 8000 Hz log (Standard: 1800 Hz)
  - `Detune` (`detune`): 0 bis 30 Cent Schwebung (Standard: 8 ct)
  - `Sub` (`sub`): 0% bis 100% Subbass-Anteil (Standard: 35%)
  - `FM` (`fm`): 0% bis 100% Frequenzmodulation (Standard: 4%)
  - `Drift` (`drift`): 0% bis 100% analoges Tonhöhendriften (Standard: 35%)
- **Buchsen:**
  - `VCA CV` (`vcaCv`) [IN, Mod]
  - `PAN CV` (`panCv`) [IN, Mod]
  - `FM CV` (`fmCv`) [IN, Mod]
  - `TONE CV` (`toneCv`) [IN, Mod]

#### 3. Pluck Synth (`pluck`)
- **Klangcharakter:** Saitenähnliche, perkussive Zupfklänge (Harfe, Kalimba, Koto) mit resonanter Oberton-Modellierung.
- **Zusatz-UI:** Button `▶ Pluck Test` zum manuellen Anzupfen.
- **Regler:**
  - `Level` (`level`): 0% bis 100% (Standard: 75%)
  - `Dämpfung` (`damp`): 100 bis 8000 Hz log Saitendämpfung (Standard: 2200 Hz)
  - `Decay` (`decay`): 0.1 bis 5.0 s log Ausklingzeit (Standard: 1.5 s)
  - `Oberton` (`overtone`): 0% bis 100% metallischer Anteil (Standard: 40%)
  - `Body` (`body`): 0% bis 100% Resonanzkörper (Standard: 45%)
- **Buchsen:**
  - `GATE` (`gateIn`) [IN, Gate]
  - `PITCH` (`pitchIn`) [IN, Pitch]
  - `FILTER CV` (`filterCv`) [IN, Mod]
  - `VCA CV` (`vcaCv`) [IN, Mod]
  - `PAN CV` (`panCv`) [IN, Mod]

#### 4. FM Bell & Metal (`fm_voice`)
- **Klangcharakter:** 2-Operator-FM-Synthese für metallische Gongs, DX-E-Pianos, Glöckchen und raue perkussive Texturen.
- **Zusatz-UI:** Button `▶ FM Test`.
- **Regler:**
  - `Level` (`level`): 0% bis 100% (Standard: 70%)
  - `Ratio` (`ratio`): 0.5 bis 16.0 Frequenzverhältnis Modulator zu Carrier (Standard: 2.0)
  - `Mod Index` (`modIndex`): 0.0 bis 10.0 FM-Tiefe (Standard: 2.5)
  - `Decay` (`decay`): 0.05 bis 5.0 s log (Standard: 1.2 s)
  - `Tone` (`tone`): 200 bis 10000 Hz log Höhenfilter (Standard: 4000 Hz)
- **Buchsen:**
  - `GATE` (`gateIn`) [IN, Gate]
  - `PITCH` (`pitchIn`) [IN, Pitch]
  - `INDEX CV` (`indexCv`) [IN, Mod]: Moduliert FM-Index
  - `VCA CV` (`vcaCv`) [IN, Mod]
  - `PAN CV` (`panCv`) [IN, Mod]

#### 5. Analog Bass (`bass`)
- **Klangcharakter:** Druckvoller monophoner Analogsynthesizer mit resonanter Tiefpassfilter-Hüllkurve und Sub-Oszillator für Fundamente.
- **Zusatz-UI:** Button `▶ Bass Test`.
- **Regler:**
  - `Level` (`level`): 0% bis 100% (Standard: 80%)
  - `Cutoff` (`cutoff`): 40 bis 6000 Hz log (Standard: 550 Hz)
  - `Reso` (`reso`): 0.5 bis 12.0 Filterresonanz (Standard: 3.5)
  - `Env Mod` (`env`): 0% bis 100% Filter-Hüllkurvenhub (Standard: 60%)
  - `Decay` (`decay`): 0.05 bis 3.0 s log (Standard: 0.45 s)
  - `Sub` (`sub`): 0% bis 100% Sub-Oszillator (Standard: 50%)
- **Buchsen:**
  - `GATE` (`gateIn`) [IN, Gate]
  - `PITCH` (`pitchIn`) [IN, Pitch]
  - `CUTOFF CV` (`cutoffCv`) [IN, Mod]
  - `VCA CV` (`vcaCv`) [IN, Mod]
  - `PAN CV` (`panCv`) [IN, Mod]

#### 6. Drum Rack (`drum_rack`)
- **Klangcharakter:** 4-teiliges analoges Drum-Modul bestehend aus Kick (Pitch-Drop Sub), Snare (Snap + Rauschfahne), Hi-Hat (metallischer Sechsfach-Oszillator) und Percussion/Tom.
- **Zusatz-UI:** 4 manuelle Trigger-Taster: `KICK`, `SNARE`, `HAT`, `PERC`.
- **Regler:**
  - `Master` (`level`): 0% bis 100% (Standard: 85%)
  - `Kick Dec` (`kDecay`): 0.08 bis 1.50 s Kick-Ausklingzeit (Standard: 0.35 s)
  - `Snare Snappy` (`sSnap`): 0% bis 100% Snare-Teppich (Standard: 55%)
  - `Hat Dec` (`hDecay`): 0.02 bis 0.50 s Hi-Hat Länge (Standard: 0.08 s)
  - `Perc Tune` (`pTune`): 80 bis 900 Hz log Tom/Percussion-Tonhöhe (Standard: 320 Hz)
- **Buchsen:**
  - `KICK IN` (`trigKick`) [IN, Gate]
  - `SNARE IN` (`trigSnare`) [IN, Gate]
  - `HAT IN` (`trigHat`) [IN, Gate]
  - `PERC IN` (`trigPerc`) [IN, Gate]
  - `VCA CV` (`vcaCv`) [IN, Mod]
  - `PAN CV` (`panCv`) [IN, Mod]

#### 7. Touch Keys (`keys`)
- **Klangcharakter:** Polyphoner Pad- und Lead-Synthesizer mit analog modellierten Wellenformen und 12 interaktiven Tastenfeldern.
- **Optionen (Dropdown):**
  - `Welle` (`wave`): Saw, Square, Triangle, Sine
  - `Tonart` (`key`): C bis B
  - `Skala` (`scale`): Moll Penta, Dur Penta, Dorisch, Moll, Dur, Hirajoshi
  - `Oktave` (`octave`): Okt 1 (36) bis Okt 4 (72)
- **Zusatz-UI:** 12 anklickbare Touch-Pads auf der Modulfront; ansteuerbar über PC-Tastatur (`A` bis `K`).
- **Regler:**
  - `Level` (`level`): 0% bis 100% (Standard: 75%)
  - `Cutoff` (`cutoff`): 80 bis 12000 Hz log (Standard: 2200 Hz)
  - `Reso` (`reso`): 0.5 bis 8.0 (Standard: 2.0)
  - `Attack` (`attack`): 0.01 bis 4.0 s log (Standard: 0.15 s)
  - `Release` (`release`): 0.05 bis 8.0 s log (Standard: 1.2 s)
  - `Detune` (`detune`): 0 bis 25 Cent (Standard: 6 ct)
- **Buchsen:**
  - `GATE` (`gateIn`) [IN, Gate]
  - `PITCH` (`pitchIn`) [IN, Pitch]
  - `CUTOFF CV` (`cutoffCv`) [IN, Mod]
  - `RECORD` (`recordIn`) [IN, Gate]
  - `VCA CV` (`vcaCv`) [IN, Mod]
  - `PAN CV` (`panCv`) [IN, Mod]

#### 8. Step Sequencer (`sequencer`)
- **Zweck & Klang:** 8-Step Melodie-Sequencer mit eigener analoger Synth-Stimme (Duale Oszillatoren mit Detune + Resonanzfilter), Gate- und Pitch-Ausgängen.
- **Optionen (Dropdown):**
  - `Welle` (`wave`): Sawtooth, Square, Triangle, Sine
  - `Raster` (`division`): `1/4` (Viertel), `1/8` (Achtel, Standard), `1/16` (Sechzehntel)
  - `Tonart` (`key`): C bis B (Standard: A / 9)
  - `Skala` (`scale`): Moll Penta, Dur Penta, Dorisch, Moll, Dur, Hirajoshi
  - `Oktave` (`octave`): Okt 1 bis 4 (24, 36, 48 [Standard], 60)
- **Zusatz-UI & Step-Bedienung (Pausen / Mute):**
  - **8 Step-Spalten:** Jede Spalte besitzt eine Lauflicht-LED (`seq-led`), einen vertikalen Schieberegler für die Tonhöhenstufe (0 bis 9), eine Live-Notenanzeige (z. B. `A3`) und einen **Step-Schalter (`seq-toggle`)**.
  - **Pausen / Mute pro Step:** Durch Klick auf den Schalter unter der Note wird der jeweilige Step **ein- oder ausgeschaltet**. Ist ein Step aus (`off`), wird die Spalte abgedunkelt: Der Sequencer erzeugt an diesem Step **weder Audio noch einen Trigger an `GATE OUT`** (echte musikalische Pause).
  - **Transport & Würfeln:** `▶ Play` / `■ Stop` Button zum manuellen Starten/Stoppen; `🎲 Würfeln`-Button generiert sofort eine neue zufällige Tonfolge mit lebendigen Pausen.
- **Regler:**
  - `Tempo` (`tempo`): 40 bis 200 bpm (Standard: 92 bpm; wird bei Verbindung an `CLOCK IN` automatisch von der externen Master Clock synchronisiert)
  - `Level` (`level`): 0% bis 100% Lautstärke der internen Synth-Stimme (Standard: 60%)
  - `Decay` (`decay`): 0.05 bis 2.50 s log (Standard: 0.45 s)
  - `Cutoff` (`cutoff`): 150 bis 10000 Hz log (Standard: 1400 Hz)
  - `Reso` (`reso`): 0.5 bis 15.0 Resonanz (Standard: 5.0)
  - `Env` (`env`): 0% bis 100% Filter-Hüllkurvenhub (Standard: 55%)
  - `Chance` (`chance`): 0% bis 100% Trefferwahrscheinlichkeit (Standard: 100%; bei kleineren Werten entstehen zufällige Pausen)
- **Buchsen:**
  - `CLOCK IN` (`clockIn`) [IN, Clock]: Externer Takt (überstimmt das interne Tempo)
  - `VCA CV` (`vcaCv`) [IN, Mod]
  - `PAN CV` (`panCv`) [IN, Mod]
  - `GATE OUT` (`gateOut`) [OUT, Gate]: Sendet Trigger für jeden aktiven Step (z. B. an Pluck oder Bass)
  - `PITCH OUT` (`pitchOut`) [OUT, Pitch]: Sendet die quantisierte Tonhöhe des aktiven Steps (z. B. an Pluck oder FM-Voice)

#### 9. Noise Textur (`noise`)
- **Klangcharakter:** Atmosphäre-, Wind-, Regen-, Meeresrauschen und analoges Tonbandknistern.
- **Optionen (Dropdown):**
  - `Farbe` (`color`): `White` (Weiß), `Pink` (Rosa), `Red` (Rot/Brownian), `Tape` (Tonband)
  - `Filter` (`mode`): `Lowpass`, `Bandpass`, `Highpass`
- **Regler:**
  - `Level` (`level`): 0% bis 100% (Standard: 60%)
  - `Tone` (`tone`): 100 bis 14000 Hz log Filter-Cutoff (Standard: 1200 Hz)
  - `Reso` (`reso`): 0.5 bis 10.0 Resonanz-Pfeifen (Standard: 2.0)
  - `Bewegung` (`modDepth`): 0% bis 100% interne Filterbewegung (Standard: 35%)
  - `Rate` (`modRate`): 0.01 bis 1.50 Hz log Modulationsgeschwindigkeit (Standard: 0.12 Hz)
  - `Knistern` (`crackle`): 0% bis 100% Vinyl/Tape Knistern (Standard: 20%)
- **Buchsen:**
  - `FILTER CV` (`filterCv`) [IN, Mod]
  - `VCA CV` (`vcaCv`) [IN, Mod]
  - `PAN CV` (`panCv`) [IN, Mod]

#### 10. Morph Voice (`morph_voice`)
- **Klangcharakter:** Fortschrittliche Vokal-, Wavetable- und Formant-Synthese mit kontinuierlichem Wellenform-Morphing und Chordeigenschaften.
- **Optionen (Dropdown):**
  - `Wellenform` (`wave`): Saw, Triangle, Square, Sine
  - `Akkord` (`chord`): Unison, Quinte, Oktave, Moll, Dur, Sus2
- **Regler:**
  - `Level` (`level`): 0% bis 100% (Standard: 75%)
  - `Morph` (`morph`): 0% bis 100% Wavetable-Position (Standard: 20%)
  - `Helligkeit` (`bright`): 200 bis 10000 Hz log (Standard: 2400 Hz)
  - `Vokal` (`formant`): 0% bis 100% Formantfilter (A-E-I-O-U) (Standard: 0%)
  - `Reibung` (`rough`): 0% bis 100% Verzerrung / Unsauberkeit (Standard: 5%)
  - `Detune` (`detune`): 0 bis 30 Cent
  - `Attack` (`attack`): 0.01 bis 3.0 s log
  - `Release` (`release`): 0.05 bis 8.0 s log
  - `Stimmen` (`voices`): 1 bis 4 Stimmen Polyphonie
  - `Sprung` (`jump`): 0% bis 100% Formantsprung-Wahrscheinlichkeit
  - `Velocity` (`velSens`): 0% bis 100%
  - `Mutation` (`mutation`): 0% bis 100%
- **Buchsen:**
  - `GATE` (`gateIn`) [IN, Gate]
  - `PITCH` (`pitchIn`) [IN, Pitch]
  - `MORPH CV` (`morphCv`) [IN, Mod]
  - `TIMBRE CV` (`timbreCv`) [IN, Mod]
  - `ENV CV` (`envCv`) [IN, Mod]
  - `JUMP` (`jumpIn`) [IN, Gate]: Löst Formantsprung aus
  - `MUTATE` (`mutateIn`) [IN, Gate]: Mutiert Parameter
  - `VCA CV` (`vcaCv`) [IN, Mod]
  - `PAN CV` (`panCv`) [IN, Mod]

#### 11. Hybrid Percussion (`hybrid_perc`)
- **Klangcharakter:** Physisch modellierte Drums: Tiefbass-Kicks, Rimshots, Glöckchen, hölzerne Marimbas und analoge Snares.
- **Zusatz-UI:** 4 Trigger-Buttons: `Bass`, `Wood`, `Bell`, `Metal`.
- **Regler:**
  - `Level` (`level`): 0% bis 100%
  - `Tonhöhe` (`tune`): 30 bis 800 Hz log Grundton (Standard: 120 Hz)
  - `Körper` (`body`): 0% bis 100% Kesselvolumen (Standard: 70%)
  - `Material` (`material`): 0% (weich) bis 100% (hartes Metall) (Standard: 35%)
  - `Pitch-Drop` (`drop`): 0% bis 100% Tonhöhenabfall für Kicks (Standard: 45%)
  - `Rauschen` (`noise`): 0% bis 100% Snare-Rauschen (Standard: 20%)
  - `Snap` (`snap`): 0% bis 100% Transienten-Schärfe (Standard: 50%)
  - `Länge` (`length`): 0.03 bis 3.0 s log (Standard: 0.25 s)
  - `Drive` (`drive`): 0% bis 100% Bandsättigung (Standard: 15%)
  - `Velocity` (`velSens`), `Mutation` (`mutation`)
- **Buchsen:**
  - `GATE` (`gateIn`) [IN, Gate]
  - `PITCH` (`pitchIn`) [IN, Pitch]
  - `TIMBRE CV` (`timbreCv`) [IN, Mod]
  - `LENGTH CV` (`lengthCv`) [IN, Mod]
  - `MATERIAL CV` (`materialCv`) [IN, Mod]
  - `VCA CV` (`vcaCv`) [IN, Mod]
  - `PAN CV` (`panCv`) [IN, Mod]

#### 12. Resonator Garden (`resonator_garden`)
- **Klangcharakter:** Modale Synthese bestehend aus bis zu 8 parallelen Bandpass-Resonatoren. Simuliert Glockenspiele, Vibraphone, Glas- und Holzklänge.
- **Optionen (Dropdown):**
  - `Anregung` (`exciter`): `Impuls` (`strike`), `Rauschen` (`noise`), `Dauer` (`bow` / Streichen)
- **Regler:**
  - `Level` (`level`): 0% bis 100%
  - `Material` (`material`): 0% bis 100% (Holz über Glas zu Stahl)
  - `Raum` (`size`): 0% bis 100% Korpusgröße
  - `Dämpfung` (`damp`): 0% bis 100%
  - `Anschlagpos.` (`pos`): 0% bis 100% Anschlagpunkt
  - `Verteilung` (`spread`): 0% bis 100% Stereobreite der Obertöne
  - `Ausklang` (`decay`): 0.15 bis 15.0 s log (Standard: 2.5 s)
  - `Resonanzen` (`modes`): 2 bis 8 Teiltöne
  - `Velocity` (`velSens`), `Mutation` (`mutation`)
- **Buchsen:**
  - `GATE` (`gateIn`) [IN, Gate]
  - `PITCH` (`pitchIn`) [IN, Pitch]
  - `MATERIAL CV` (`materialCv`) [IN, Mod]
  - `DAMP CV` (`dampCv`) [IN, Mod]
  - `MUTATE` (`mutateIn`) [IN, Gate]
  - `VCA CV` (`vcaCv`) [IN, Mod]
  - `PAN CV` (`panCv`) [IN, Mod]

#### 13. Spectral Swarm (`spectral_swarm`)
- **Klangcharakter:** Bis zu 32 additive Sinus-Oszillatoren, die als Schwarm umeinander kreisen. Erzeugt ätherische Schimmer-Pads, unharmonische Chöre und Partikel-Wolken.
- **Optionen (Dropdown):**
  - `Modus` (`mode`): `Drone` (dauerhaftes Schweben) | `Partikel` (perkussiv angeregt)
- **Regler:**
  - `Level` (`level`): 0% bis 100%
  - `Teiltöne` (`count`): 2 bis 32 Oszillatoren (Standard: 14)
  - `Unharmonik` (`inharm`): 0% bis 100% Abweichung von der Harmonischen
  - `Streuung` (`scatter`): 0% bis 100% Tonhöhenverbreiterung
  - `Bewegung` (`motion`): 0.02 bis 3.0 Hz log Schwarm-LFO-Tempo
  - `Tiefe` (`depth`): 0% bis 100% Modulationstiefe
  - `Helligkeit` (`bright`): 0% bis 100% Spektrale Dämpfung
  - `Zusammenhalt` (`cohesion`): 0% (Chaotisch) bis 100% (Reiner Akkord)
  - `Hüllkurve` (`decay`): 0.1 bis 8.0 s log
  - `Velocity` (`velSens`), `Mutation` (`mutation`)
- **Buchsen:**
  - `GATE` (`gateIn`) [IN, Gate]
  - `PITCH` (`pitchIn`) [IN, Pitch]
  - `SCATTER` (`scatterIn`) [IN, Gate]: Spreizt den Schwarm auseinander
  - `GATHER` (`gatherIn`) [IN, Gate]: Zieht den Schwarm auf einen Ton zusammen
  - `COHESION CV` (`cohesionCv`) [IN, Mod]
  - `MUTATE` (`mutateIn`) [IN, Gate]
  - `VCA CV` (`vcaCv`) [IN, Mod]
  - `PAN CV` (`panCv`) [IN, Mod]

#### 14. Chord Glide (`chord_glide`)
- **Klangcharakter & Zweck:** Harmonischer Akkord-Sequencer mit polyphonem Portamento (Glide) und automatischem Smooth Voice Leading. Jede der 4–6 Stimmen gleitet mit minimalem harmonischem Weg in den Folgeakkord (Common Tone Retention). Integriertes polyphones Dual-Oszillator Ambient-Pad mit Filter, Detune und Hüllkurve. Kann auch externe polyphone Instrumente (Felt Piano, Touch Keys) und monophone Synths ansteuern.
- **Sequencer-Karten & Editierung:**
  - 4, 8 oder 16 Akkordschritte (per Button `＋ Schritt` hinzufügbar, duplizierbar, löschbar).
  - Pro Schritt einstellbar: Grundton (C bis H), Akkordtyp (13 Harmonien: Dur, Moll, sus2, sus4, dim, aug, maj7, m7, dom7, maj9, m9, add9, dom9), Dauer (¼, ½, 1, 2 Takte).
  - Klick auf eine Akkordkarte triggert direktes Vorhören.
  - Live-Modus: Tasten 1–8 springen im Live-Betrieb direkt zum jeweiligen Akkord.
- **Visualisierung:**
  - Real-time Tonhöhen-Canvas mit horizontalen Oktav-Linien und farbigen Bezier-Kurven für jede Einzelstimme.
  - Durchlaufender Playhead zeigt stets die exakte Abspiel- und Glide-Position.
- **Regler:**
  - `Level` (`level`): 0% bis 100%
  - `Glide` (`glide`): 0 bis 5.0 s logarithmisch fein regelbar
  - `Filter` (`filter`): 100 bis 12000 Hz Lowpass-Grenzfrequenz
  - `Detune` (`detune`): 0 bis 25 Cent Schwebung zwischen Dual-Oszillatoren
  - `Attack` (`attack`): 0.01 bis 4.0 s Pad-Einschwingzeit
  - `Release` (`release`): 0.1 bis 8.0 s Ausklingzeit
- **Erweiterte Einstellungen (Drawer):**
  - `Strum` (`strum`): 0 bis 90 ms Zeitversatz zwischen den Saiten/Notenanschlägen
  - `Retrigger` (`retrigger`): An/Aus (neu anschlagen vs. nahtlos gehalten)
  - `Voice Leading` (`voiceLeading`): An/Aus (intelligente Umkehrung vs. statische Lagen)
  - `Stimmen` (`voices`): 4, 5 oder 6 Stimmen
  - `Basis-Oktave` (`octave`): C2, C3 oder C4
  - `Preset-Auswahl`: „Warm Ambient“, „Night Drift“, „Cinematic“, „Floating“
- **Buchsen:**
  - `CLOCK` (`clockIn`) [IN, Clock]: Synchronisiert Schrittwechsel mit der Master Clock
  - `RESET` (`resetIn`) [IN, Trigger]: Setzt Sequenz auf Schritt 1 zurück
  - `TRANSPOSE CV` (`transposeCv`) [IN, Mod]: Transponiert alle Stimmen realtime (±24 Halbtöne)
  - `GLIDE CV` (`glideCv`) [IN, Mod]: Moduliert die Gleitzeit pro Schritt
  - `NEXT TRIG` (`nextTrig`) [IN, Trigger]: Springt sofort zum nächsten Akkord
  - `VCA CV` (`vcaCv`) [IN, Mod]: Externe Lautstärkemodulation
  - `PAN CV` (`panCv`) [IN, Mod]: Stereoposition
  - `POLY PITCH` (`pitchOut`) [OUT, Pitch]: Gibt das gesamte polyphone MIDI-Array `[m0, m1, ...]` an Felt Piano oder Keys aus
  - `ROOT PITCH` (`rootOut`) [OUT, Pitch]: Gibt den tiefsten Grundton als monophones CV für Bass-Synths aus
  - `CHORD TRIG` (`gateOut`) [OUT, Gate]: Trigger-Puls bei jedem Akkordwechsel für Envelopes

---

### 5.3 Effektkette (6 Module)

Die Effektkette liegt seriell im Master-Weg. Module können horizontal verschoben oder per Bypass stummgeschaltet werden.

#### 1. Analog Filter (`filter`)
- **Zweck:** 4-Pol-Kaskadenfilter (24 dB/Okt) mit Eigensättigung und integriertem Modulations-LFO.
- **Optionen (Dropdown):**
  - `Typ` (`ftype`): `Lowpass`, `Highpass`, `Bandpass`
- **Regler:**
  - `Cutoff` (`cutoff`): 40 bis 16000 Hz log (Standard: 2200 Hz)
  - `Reso` (`reso`): 0.5 bis 15.0 Resonanzspitze (Standard: 2.5)
  - `Drive` (`drive`): 0% bis 100% asymmetrische Sättigung (Standard: 20%)
  - `LFO Rate` (`lfoRate`): 0.02 bis 10.0 Hz log Sweep-Geschwindigkeit (Standard: 0.15 Hz)
  - `LFO Tiefe` (`lfoDepth`): 0% bis 100% Sweep-Intensität (Standard: 35%)
- **Buchsen:**
  - `CUTOFF CV` (`cvCutoff`) [IN, Mod]: Externe Filtermodulation per Kabel

#### 2. Chorus (`chorus`)
- **Zweck:** Stereobreite, analoger Ensemble-Effekt und Schwebung für flächige Sounds.
- **Regler:**
  - `Rate` (`rate`): 0.05 bis 6.0 Hz log (Standard: 0.6 Hz)
  - `Tiefe` (`depth`): 0% bis 100% Modulationstiefe (Standard: 50%)
  - `Delay` (`delay`): 5 bis 40 ms Basis-Verzögerung (Standard: 16 ms)
  - `Mix` (`mix`): 0% bis 100% Effektanteil (Standard: 50%)

#### 3. Tremolo / Pan (`tremolo`)
- **Zweck:** Rhythmische Amplituden- und Stereo-Panoramamodulation.
- **Optionen (Dropdown):**
  - `Form` (`wave`): `Sine` (weich), `Triangle` (linear), `Square` (zerhackt / Slicer)
- **Regler:**
  - `Rate` (`rate`): 0.1 bis 14.0 Hz log (Standard: 3.5 Hz)
  - `Tiefe` (`depth`): 0% bis 100% Lautstärke-Modulation (Standard: 50%)
  - `Auto-Pan` (`pan`): 0% bis 100% Ping-Pong Stereobewegung (Standard: 30%)

#### 4. Lo-Fi Tape (`lofi`)
- **Zweck:** Vintage-Wärme, Kassetten-Geleier (Wow & Flutter), Röhrensättigung und Bitcrusher.
- **Regler:**
  - `Drive` (`drive`): 0% bis 100% Röhrenverzerrung (Standard: 30%)
  - `Bits` (`bits`): 3 bis 16 Bit Quantisierung (Standard: 12 Bit)
  - `Tone` (`tone`): 500 bis 14000 Hz log Dumpf-Filter (Standard: 4500 Hz)
  - `Wobble` (`wobble`): 0% bis 100% Kassetten-Geleier (Standard: 35%)
  - `Output` (`level`): 0% bis 150% Lautstärke-Ausgleich (Standard: 90%)

#### 5. Stereo Delay (`delay`)
- **Zweck:** Tape-Delay und Ping-Pong Echo mit Tonfilter und Tonhöhen-Wobble.
- **Optionen (Dropdown):**
  - `Modus` (`mode`): `Stereo` (paralleles Echo) | `Ping-Pong` (schlägt zwischen L und R hin und her)
- **Regler:**
  - `Time` (`time`): 0.05 bis 1.50 s log Echozeit (Standard: 0.42 s)
  - `Feedback` (`feedback`): 0% bis 100% Wiederholungen (Standard: 50%)
  - `Tone` (`tone`): 400 bis 9000 Hz log Dumpfheit der Echos (Standard: 2600 Hz)
  - `Wobble` (`mod`): 0% bis 100% Tape-Drift (Standard: 25%)
  - `Mix` (`mix`): 0% bis 100% Dry/Wet Anteil (Standard: 40%)
- **Buchsen:**
  - `TIME CV` (`cvTime`): Externe Echozeit-Modulation

#### 6. Ambient Reverb (`reverb`)
- **Zweck:** Riesiger, schwebender FDN-Raumhall (Feedback Delay Network) für unendliche Hallfahnen.
- **Regler:**
  - `Decay` (`decay`): 0.4 bis 15.0 s log Hallzeit (Standard: 5.0 s)
  - `Dämpfung` (`damp`): 0% bis 100% Absorption hoher Frequenzen (Standard: 45%)
  - `Pre-Delay` (`predelay`): 0 bis 250 ms Vorverzögerung (Standard: 30 ms)
  - `Tone` (`tone`): 500 bis 14000 Hz log Helligkeit (Standard: 6000 Hz)
  - `Mix` (`mix`): 0% bis 100% Reverb-Anteil (Standard: 45%)

---

## 6. Presets, Boards & Performance Snapshot-System

### 6.1 Die 14 fertigen Beispiel-Boards
Über den Button `🎛️ Beispiel-Boards` (oder das Vorlagen-Dropdown) können 14 komplett vorverkabelte Racks geladen werden:

1. **Hypnotic Live Beat & Ambient Rack (`scenes`):** 12 Module. Euklidische Rhythmen, Clock Divider, hybride Percussion, Drums, Resonator Garden, Delay & Reverb.
2. **Nils Frahm Felt Piano & Melodic Ambient (`felt_piano_ambient`):** 11 Module. Intimes Filzklavier mit Random Walk Melodie in A-Moll, Subbass, Slow Random Dämpfungsmodulation und 5 fertigen Performance-Slots.
3. **Generatives Modular-System (`generative`):** 11 Module. Selbstspielendes System mit Probability Gate, Random Walk, Drone und Filtermodulation.
4. **Zen-Garten & Resonator-Meditation (`zen_garden`):** 8 Module. Meditative Glocken und Glas-Resonanzen mit organischem Rauschen.
5. **Deep Space & Harmonic Cluster (`deep_space`):** 9 Module. Kosmische Schwebungen mit Spectral Swarm und Drone Maschine.
6. **Berlin School & Hypnotic Sequenz (`berlin_school`):** 8 Module. Klaus-Schulze-artiger analoger 16-Step-Sequencer mit Tape Delay.
7. **Cyberpunk & Industrial Glitch (`cyberpunk`):** 10 Module. Harte FM-Sounds, Bitcrushing und treibende 16tel-Rhythmen.
8. **Biophilic Forest & Nature Ambient (`biophilic`):** 8 Module. Vogel- und Wassertropfen-Texturen durch Random Modulatoren.
9. **Ethereal Dream-Pop & Shimmer Soundscape (`dreampop`):** 9 Module. Schimmernde Obertöne, Chorus und weite Reverb-Räume.
10. **Minimal Dub-Techno & Tape Echo (`dub_techno`):** 9 Module. Chord-Stabs mit gefiltertem Ping-Pong Tape-Delay.
11. **Somnus Schlaf & Traumdrift (`sleep`):** Sanfter Delta-Wellen Ambient mit tiefem Grundton und Traumhall.
12. **Solar 42 Drone Desk (`solar`):** Inspiriert vom Solar 42 Synthesizer; 6-stimmige Schwebungen mit analoger Drift.
13. **Ambient Sequenz & Plucks (`sequence`):** Kalimba- und Harfen-Zupfer über gemächlicher Bassline.
14. **Lo-Fi Tape & Vintage Keys (`lofi`):** Warmes E-Piano mit Wow & Flutter Tonbandleiern.
*(Zusätzlich: `Leeres Board` für komplett freie Patch-Experimente).*

### 6.2 Performance Snapshot-System (Slots 1–5 & Morphing)
Oben im Rack befindet sich die Leiste `PRESET SLOTS (1–5)`:
- **5 Speicherplätze:** Speichert alle Reglerstände, Dropdown-Auswahlen (Akkorde, Wellenformen, Skalen) und Voice-Pads.
- **Speichern:** Auf `Speichern auf Slot X` klicken (oder Slot angewählt halten).
- **Abrufen:** Klick auf Slot `1` bis `5` oder Zifferntaste `1` bis `5`.
- **Morphing & Geschwindigkeiten:**
  - `6: Direkt` (0 s): Sofortiger Parametersprung.
  - `7: Glide` (0.8 s): Musikalisch weiches Gleiten aller kontinuierlichen Regler.
  - `8: Slow` (3.5 s): Extrem langsames, organisches Ineinanderfließen zweier Sounds.
  - **Diskrete Werte:** Akkorde (z. B. von Quinten zu Oktaven) oder Wellenformen schalten auf halbem Weg des Morphs klickfrei und weich um.

---

## 7. Technische Besonderheiten & Signalfluss

1. **Tonhöhen-Standard (MIDI-Pitch):**
   - Im Gegensatz zu analogem 1V/Okt übertragen Pitch-Kabel in SYNTHBOARD kontinuierliche bzw. quantisierte **MIDI-Notennummern** (z. B. 36 = C2, 48 = C3, 60 = C4).
   - Jede Einheit `1.0` entspricht genau einem Halbton. Eine Oktave entspricht `12.0`.
2. **Clock-Architektur:**
   - Die Master Clock läuft auf Basis des hochpräzisen Web Audio Hardware-Timers (`ctx.currentTime`). Sie driftet niemals auseinander.
   - 1 Bar = 16 Steps (Vierteltakt = 4 Steps, Achtel = 2 Steps, Sechzehntel = 1 Step).
3. **Polyphonie:**
   - `drone`: 6 Stimmen parallel (über die 6 Pads aktivierbar).
   - `keys` & `morph_voice`: bis zu 4 Stimmen polyphon spielbar.
   - `spectral_swarm`: bis zu 32 Teiltöne gleichzeitig.
   - Andere Stimmen (`bass`, `pluck`, `fm_voice`) sind monophon mit Priorität auf die letzte Note.
4. **Audio-Kanalzug-Verschaltung:**
   - Jedes Instrument sendet über seinen Aux-Send gain-gesteuert in das Master-Delay und das Master-Reverb. Dadurch bleibt der trockene Sound sauber im Stereofeld, während Effekte räumlich schweben.

---

## 8. Status: Funktionsfähig, Teilweise umgesetzt & Geplant

| Funktion / Modul | Status | Bemerkungen |
|---|---|---|
| **Alle 29 Module** | ✅ **Voll funktionsfähig** | Alle Parameter, Jacks und Synthesestufen berechnen echtes Audio in Web Audio. |
| **Kabel-Patchbay** | ✅ **Voll funktionsfähig** | Farbcodierung, Drag & Drop, LED-Aktivitätsanzeige, Mehrfach-Ausgänge. |
| **Kabel-Modulationsstärke** | ✅ **Voll funktionsfähig** | 0% bis 200% Depth per Drag/Wheel auf dem Kabelbadge einstellbar. |
| **VCA & Pan CV pro Stimme** | ✅ **Voll funktionsfähig** | Jede Quelle reagiert auf VCA- und Pan-Modulation. |
| **Focus-Dock (5 Regler)** | ✅ **Voll funktionsfähig** | Shift+Klick pinnt Regler; Pfeiltasten mit Shift/Alt-Modifikatoren. |
| **Snapshot-Morphing** | ✅ **Voll funktionsfähig** | 5 Slots, 3 Geschwindigkeiten (0s / 0.8s / 3.5s), inkl. Dropdown-Interpolation. |
| **Audio-Patching per Kabel** | ⚠️ **Teilweise / Speziell** | Kabel sind für Steuer- und Modulationssignale (Clock, Gate, Pitch, CV). Der Audiofluss erfolgt fest über die Quell-Kanalzüge zur Master-Effektkette (kein freies Audio-Feedback per Kabel). |
| **Freie Sample-WAV-Lader** | ❌ **Nicht implementiert** | Es gibt keinen WAV-Sampler/Field-Recorder. Rauschen/Knistern wird vom Modul `noise` synthetisiert. |
| **Triggerbare Slotwechsel** | ❌ **Nicht implementiert** | Snapshot-Slots können manuell per Klick oder Tastatur (1–5) gewechselt werden, besitzen aber noch keine CV-Triggerbuchse. |

---

## 9. Drei konkret nachbaubare Patch-Beispiele

### 9.1 Patch 1: Atmendes, weiches Akkord-Pad
*Ein tiefer, organischer Ambient-Klangteppich, der langsam an- und abschwillt und im Raum schwebt.*

#### Benötigte Module
1. `drone` (Drone Maschine)
2. `slope_generator` (Slope Generator)
3. `slow_random` (Slow Random)
4. `reverb` (Ambient Reverb)
5. `chorus` (Chorus)

#### Startwerte der Regler
- **`drone`:**
  - `Level`: `75%`
  - `Tone`: `650 Hz`
  - `Detune`: `12 ct`
  - `Sub`: `40%`
  - `FM`: `0%`
  - `Drift`: `60%`
  - Dropdown `Grundton`: `A1`
  - Dropdown `Akkord`: `Quinten`
  - Dropdown `Welle`: `Triangle`
  - Voice-Pads: Stimmen 1, 3, 5 aktivieren (2, 4, 6 ausschalten).
  - Kanalzug: `PAN` = `0%`, `DELAY` = `20%`, `REVERB` = `60%`.
- **`slope_generator`:**
  - Dropdown `Modus`: `Loop`
  - `Anstieg Rise`: `4.5 s`
  - `Abfall Fall`: `6.0 s`
  - `Kurve`: `0.2`
  - `Zyklus`: `1 (Ein)`
- **`slow_random`:**
  - Dropdown `Kurve`: `Gleitend`
  - `Rate`: `0.08 Hz`
  - `Glättung`: `1.8 s`
  - `Tiefe`: `45%`
- **`chorus`:**
  - `Rate`: `0.15 Hz`, `Tiefe`: `55%`, `Mix`: `40%`.
- **`reverb`:**
  - `Decay`: `9.0 s`, `Dämpfung`: `50%`, `Tone`: `4000 Hz`, `Mix`: `55%`.

#### Kabelverbindungen
1. Von `slope_generator:ENV OUT` ➔ nach `drone:VCA CV` *(lässt das Pad alle 10 Sekunden langsam auf- und abtauchen)*.
2. Von `slow_random:CV OUT` ➔ nach `drone:TONE CV` *(Badge auf `60%` stellen – filtert den Akkord sanft heller und dunkler)*.

---

### 9.2 Patch 2: Gläserner, generativer Pluck
*Ein sich selbst entwickelndes, minimalistisches Melodiespiel auf einer japanischen Skala mit weiten Ping-Pong-Echos.*

#### Benötigte Module
1. `master_clock` (Master Clock)
2. `euclidean` (Euclidean Rhythm)
3. `random_walk` (Random Walk)
4. `quantizer` (Scale Quantizer)
5. `pluck` (Pluck Synth)
6. `delay` (Stereo Delay)

#### Startwerte der Regler
- **`master_clock`:**
  - `Tempo`: `84 bpm`, `Swing`: `10%`, Dropdown `Transport`: `▶ Läuft`.
- **`euclidean`:**
  - `Steps`: `16`, `Hits`: `7`, `Rotate`: `2`.
- **`random_walk`:**
  - Dropdown `Tonart`: `D`, Dropdown `Skala`: `Hirajoshi`, Dropdown `Oktave`: `Okt 3 (48)`.
  - `Schritt`: `2`, `Umfang`: `2`, `Loop`: `8`, `Mutation`: `25%`.
- **`quantizer`:**
  - Dropdown `Grundton`: `D`, Dropdown `Skala`: `Hirajoshi`, `Transp.`: `0`.
- **`pluck`:**
  - `Level`: `75%`, `Dämpfung`: `3800 Hz`, `Decay`: `1.8 s`, `Oberton`: `65%`, `Body`: `35%`.
  - Kanalzug: `PAN` = `15%`, `DELAY` = `45%`, `REVERB` = `35%`.
- **`delay`:**
  - Dropdown `Modus`: `Ping-Pong`, `Time`: `0.38 s`, `Feedback`: `55%`, `Tone`: `3200 Hz`, `Mix`: `40%`.

#### Kabelverbindungen
1. Von `master_clock:1/16` ➔ nach `euclidean:CLOCK`.
2. Von `master_clock:1/8` ➔ nach `random_walk:CLOCK`.
3. Von `random_walk:PITCH` ➔ nach `quantizer:PITCH IN`.
4. Von `quantizer:QUANT OUT` ➔ nach `pluck:PITCH`.
5. Von `euclidean:TRIG` ➔ nach `pluck:GATE`.

---

### 9.3 Patch 3: Drückender Analog-Subbass
*Ein warmer, definierter Bass mit Sub-Oszillator und dezenter Filter-Lebendigkeit – hält das tonale Fundament stabil.*

#### Benötigte Module
1. `master_clock` (Master Clock)
2. `clock_divider` (Clock Divider)
3. `bass` (Analog Bass)
4. `slow_random` (Slow Random)

#### Startwerte der Regler
- **`master_clock`:**
  - `Tempo`: `90 bpm`, Dropdown `Transport`: `▶ Läuft`.
- **`bass`:**
  - `Level`: `85%`
  - `Cutoff`: `220 Hz`
  - `Reso`: `2.2`
  - `Env Mod`: `55%`
  - `Decay`: `0.42 s`
  - `Sub`: `75%`
  - Kanalzug: `PAN` = `0%` (exakt Center), `DELAY` = `0%` (trocken), `REVERB` = `8%` (sehr dezent).
- **`slow_random`:**
  - Dropdown `Kurve`: `Gleitend`, `Rate`: `0.1 Hz`, `Glättung`: `1.2 s`, `Tiefe`: `35%`.

#### Kabelverbindungen
1. Von `master_clock:1/4` ➔ nach `clock_divider:CLOCK`.
2. Von `clock_divider:/2 (1/8)` ➔ nach `bass:GATE`.
3. Von `slow_random:CV OUT` ➔ nach `bass:CUTOFF CV`.
   - **Kabel-Badge einstellen:** Auf das Badge klicken und auf **`30%`** herunterziehen, damit der Bass nur minimal atmet und druckvoll bleibt.

---

## 10. Schnell-Anleitung für eine anleitende KI

Wenn du als KI den Benutzer Schritt für Schritt beim Sounddesign anleitest, befolge dieses Schema:
1. **Benenne stets exakt die deutschen UI-Bezeichnungen** (z. B. „Felt Piano“, „Master Clock“, „Anstieg Rise“, „Dämpfung“).
2. **Gib immer den genauen Wertebereich und die Einheit an** (z. B. `Cutoff auf 450 Hz`, `Decay auf 1.8 s`, `Sub auf 40%`).
3. **Nenne bei Kabeln immer Quellmodul:Buchse und Zielmodul:Buchse** (z. B. `master_clock:1/16` ➔ `euclidean:CLOCK`).
4. **Erwähne die Kabelfarbe** (z. B. „Gelbes Gate-Kabel von TRIG nach GATE“), damit der Nutzer die visuelle Bestätigung im Rack sofort sieht.
5. **Erkläre bei Bedarf die Feineinstellung:** „Klicke den Regler an und nutze die Pfeiltasten, oder pinne ihn mit `Shift + Klick` ins Focus-Dock.“

---

## 11. Standard-Eingabeformat für externe KIs (Schaltbild-Generator)

Damit eine beliebige externe KI (ChatGPT, Claude, etc.) einen Sound oder Beat so ausgibt, dass der Benutzer ihn einfach kopieren und in Antigravity einfügen kann – woraufhin Antigravity ein **visuelles Schaltbild** und ein **ladefertiges Preset** erzeugt –, gilt folgendes standardisiertes Format:

### 11.1 Die Aufforderung (Prompt) für die externe KI
Kopiere diesen Prompt an die externe KI, wenn sie einen neuen Sound oder Beat für SYNTHBOARD entwirft:

```text
Gib deinen Sound- oder Beat-Entwurf bitte IMMER am Ende deiner Antwort in einem einzigen Codeblock im Format ```synthboard-patch``` aus.
Halte dich exakt an folgende Struktur und verwende nur Module, Regler und Buchsen aus der SYNTHBOARD-Dokumentation:

```synthboard-patch
NAME: [Name des Sounds / Patches]
TYP: [z. B. Ambient Pad, Techno Beat, Glitch Arp, Meditations-Drone]
BESCHREIBUNG: [1-2 Sätze über Klangidee und Wirkung]

MODULE:
- [modul_id] ([Deutscher Modulname]):
    [regler_id]: [wert] [einheit]
    [dropdown_id]: [wert]
    Kanalzug: Pan: [wert%], Delay: [wert%], Reverb: [wert%]

KABEL:
- [quell_id]:[ausgangs_jack] -> [ziel_id]:[eingangs_jack] ([SIGNAL_TYP], [STÄRKE%])

TIPP: [1 praktischer Tipp für die Performance oder das Schrauben am Sound]
```
```

### 11.2 Gültige Bezeichner (Auszug für schnelle Referenz)
- **Modul-IDs:** `master_clock`, `clock_divider`, `euclidean`, `prob_gate`, `random_walk`, `quantizer`, `slow_random`, `macro`, `slope_generator`, `attenuverter`, `felt_piano`, `drone`, `pluck`, `fm_voice`, `bass`, `drum_rack`, `keys`, `sequencer`, `noise`, `morph_voice`, `hybrid_perc`, `resonator_garden`, `spectral_swarm`, `filter`, `chorus`, `tremolo`, `lofi`, `delay`, `reverb`.
- **Signaltypen:** `clock` (Cyan), `gate` (Amber), `pitch` (Violett), `mod` (Grün).
- **Stärke:** `0%` bis `200%` (Standard `100%`).

### 11.3 Was Antigravity aus diesem Block automatisch baut
Sobald ein Block im Format ````synthboard-patch ... ```` hier im Chat eingefügt wird, wandelt Antigravity ihn sofort um in:
1. Ein **visuelles Mermaid-Schaltbild (Signalflussdiagramm)** mit farblich markierten Kabeln, Modul-Knoten und Pegeln.
2. Eine tabellarische **Rack-Bauanleitung** mit Klick-Pfaden und Shortcut-Tipps.
3. Einen **Import-fertigen SYNTHBOARD-JSON-Code**, der über den Button `Import JSON` mit einem einzigen Klick direkt in das Synthesizer-Rack geladen werden kann.

### 11.4 Offizielles SYNTHBOARD JSON-Schema & Export-Beispiel
Wenn eine KI direkt eine `.json`-Datei generieren soll, die über den Button **„Import JSON“** im Header von SYNTHBOARD importiert werden kann, muss sie diesem Schema entsprechen:

```json
{
  "name": "Mein erster Beat (100 BPM)",
  "state": {
    "version": 2,
    "master": 0.85,
    "modules": [
      {
        "type": "master_clock",
        "id": "master_clock",
        "enabled": true,
        "values": {
          "tempo": 100,
          "swing": 0.12,
          "running": 1
        }
      },
      {
        "type": "sequencer",
        "id": "sequencer",
        "enabled": true,
        "values": {
          "tempo": 100,
          "level": 0.0,
          "decay": 0.45,
          "cutoff": 1800,
          "reso": 4,
          "env": 0.6,
          "chance": 1,
          "wave": "sawtooth",
          "division": 2,
          "key": 9,
          "scale": "minorPenta",
          "octave": 48
        },
        "extra": {
          "running": true,
          "steps": [
            { "on": true, "deg": 0 },
            { "on": true, "deg": 2 },
            { "on": false, "deg": 0 },
            { "on": true, "deg": 4 },
            { "on": false, "deg": 0 },
            { "on": true, "deg": 3 },
            { "on": true, "deg": 7 },
            { "on": false, "deg": 0 }
          ]
        }
      },
      {
        "type": "pluck",
        "id": "pluck",
        "enabled": true,
        "values": {
          "level": 0.75,
          "damp": 3600,
          "decay": 1.6,
          "overtone": 0.65,
          "body": 0.35
        },
        "extra": {
          "chPan": 0.2,
          "chDelay": 0.35,
          "chReverb": 0.4
        }
      },
      {
        "type": "bass",
        "id": "bass",
        "enabled": true,
        "values": {
          "level": 0.85,
          "cutoff": 240,
          "reso": 2.2,
          "env": 0.55,
          "decay": 0.4,
          "sub": 0.75
        },
        "extra": {
          "chPan": 0.0,
          "chDelay": 0.0,
          "chReverb": 0.08
        }
      },
      {
        "type": "drum_rack",
        "id": "drum_rack",
        "enabled": true,
        "values": {
          "level": 0.8,
          "kDecay": 0.35,
          "sSnap": 0.55,
          "hDecay": 0.08,
          "pTune": 320
        },
        "extra": {
          "chPan": 0.0,
          "chDelay": 0.1,
          "chReverb": 0.15
        }
      },
      {
        "type": "delay",
        "id": "delay",
        "enabled": true,
        "values": {
          "time": 0.3,
          "feedback": 0.45,
          "tone": 3000,
          "mod": 0.15,
          "mix": 0.35,
          "mode": "pingpong"
        }
      },
      {
        "type": "reverb",
        "id": "reverb",
        "enabled": true,
        "values": {
          "decay": 6.5,
          "damp": 0.45,
          "tone": 5000,
          "mix": 0.4
        }
      }
    ],
    "cables": [
      {
        "from": "master_clock:1/16",
        "to": "sequencer:clockIn",
        "color": "#06b6d4",
        "depth": 1
      },
      {
        "from": "sequencer:gateOut",
        "to": "pluck:gateIn",
        "color": "#fbbf24",
        "depth": 1
      },
      {
        "from": "sequencer:pitchOut",
        "to": "pluck:pitchIn",
        "color": "#a855f7",
        "depth": 1
      },
      {
        "from": "master_clock:1/4",
        "to": "drum_rack:trigKick",
        "color": "#fbbf24",
        "depth": 1
      },
      {
        "from": "master_clock:1/4",
        "to": "bass:gateIn",
        "color": "#fbbf24",
        "depth": 1
      }
    ]
  }
}
```



