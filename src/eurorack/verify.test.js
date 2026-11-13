// Automated verification test of Eurorack Engine, Modules, Routing, Macros, and Distant Lights state
import { EurorackEngine, MACROS, evalLane } from './engine.js';
import { buildDistantLights } from './distantLights.js';

class MockAudioParam {
  constructor(v = 0) { this.value = v; }
  cancelScheduledValues() {}
  cancelAndHoldAtTime() {}
  setValueAtTime(v) { this.value = v; }
  setTargetAtTime(v) { this.value = v; }
}

class MockAudioNode {
  constructor(ctx) {
    this.context = ctx;
    this.gain = new MockAudioParam(1);
    this.frequency = new MockAudioParam(1000);
    this.detune = new MockAudioParam(0);
    this.Q = new MockAudioParam(1);
    this.threshold = new MockAudioParam(-10);
    this.knee = new MockAudioParam(4);
    this.ratio = new MockAudioParam(12);
    this.attack = new MockAudioParam(0.01);
    this.release = new MockAudioParam(0.2);
    this.reduction = 0;
    this.offset = new MockAudioParam(0);
    this.pan = new MockAudioParam(0);
    this.type = 'lowpass';
    this.oversample = 'none';
    this.curve = null;
    this.channelCount = 2;
  }
  connect(t) { return t; }
  disconnect() {}
  start() {}
  stop() {}
}

class MockAudioContext {
  constructor() {
    this.currentTime = 0;
    this.sampleRate = 44100;
    this.state = 'running';
  }
  createGain() { return new MockAudioNode(this); }
  createOscillator() { return new MockAudioNode(this); }
  createBiquadFilter() { return new MockAudioNode(this); }
  createWaveShaper() { return new MockAudioNode(this); }
  createConstantSource() { return new MockAudioNode(this); }
  createStereoPanner() { return new MockAudioNode(this); }
  createDynamicsCompressor() { return new MockAudioNode(this); }
  createChannelSplitter() { return new MockAudioNode(this); }
  createChannelMerger() { return new MockAudioNode(this); }
  createDelay() {
    const d = new MockAudioNode(this);
    d.delayTime = new MockAudioParam(0);
    return d;
  }
  createConvolver() { return new MockAudioNode(this); }
  createBuffer(ch, len, sr) { return { length: len, numberOfChannels: ch, sampleRate: sr, getChannelData: () => new Float32Array(len) }; }
  createBufferSource() {
    const s = new MockAudioNode(this);
    s.playbackRate = new MockAudioParam(1);
    return s;
  }
  createAnalyser() {
    const a = new MockAudioNode(this);
    a.fftSize = 2048;
    a.getFloatTimeDomainData = (buf) => buf.fill(0.1);
    return a;
  }
  createPeriodicWave() { return {}; }
  resume() { return Promise.resolve(); }
}

globalThis.window = {
  AudioContext: MockAudioContext,
  webkitAudioContext: MockAudioContext,
};

async function runTests() {
  console.log('--- TEST 1: buildDistantLights() Datenstruktur ---');
  const patch = buildDistantLights();
  if (patch.format !== 'synthboard-eurorack' || patch.version !== 1) throw new Error('Ungültiges Format');
  if (patch.modules.length !== 13) throw new Error(`Erwartet 13 Module, erhalten: ${patch.modules.length}`);
  if (patch.cables.length !== 16) throw new Error(`Erwartet 16 Kabel, erhalten: ${patch.cables.length}`);
  console.log('✓ Vorkonfigurierte Datenstruktur korrekt (13 Module, 16 Kabel)');

  console.log('--- TEST 2: EurorackEngine Instanziierung und Laden ---');
  const ctx = new MockAudioContext();
  const dest = ctx.createGain();
  const engine = new EurorackEngine(ctx, dest, { timer: false });
  const loadRes = engine.loadState(patch);
  if (!loadRes.ok) throw new Error(`Laden fehlgeschlagen: ${loadRes.error}`);
  if (loadRes.warnings.length > 0) throw new Error(`Unerwartete Warnungen: ${loadRes.warnings.join(', ')}`);
  console.log('✓ Engine hat Distant Lights fehlerfrei geladen');

  console.log('--- TEST 3: Rückkopplungsverhinderung (Cycle Detection) ---');
  // osc:out -> filter:in -> sat:in -> vca:in -> chorus:in -> mixer:coreIn
  // Versuch: chorus:out zurück in osc:pitchIn (oder filter:cutoffCv)
  const cycRes = engine.connect('chorus', 'out', 'filter', 'in');
  if (cycRes.ok) throw new Error('Rückkopplung wurde nicht verhindert!');
  console.log(`✓ Rückkopplung erfolgreich blockiert: "${cycRes.error}"`);

  console.log('--- TEST 4: Makro-Routing auf echte DSP-Parameter ---');
  engine.setMacro('bright', 0.8, true);
  const cutoff = engine.modules.get('filter').values.cutoff;
  if (cutoff < 2000) throw new Error(`Helligkeits-Makro hat Filter nicht geöffnet (cutoff: ${cutoff})`);
  console.log(`✓ Makro "Helligkeit" steuert Filter-Cutoff (${Math.round(cutoff)} Hz)`);

  console.log('--- TEST 5: Automations-Auswertung über alle 60 Takte ---');
  for (let bar = 0; bar <= 60; bar += 5) {
    const buildLevel = evalLane(patch.arrangement.lanes.build.points, bar);
    const bassLevel = evalLane(patch.arrangement.lanes.bass.points, bar);
    if (!Number.isFinite(buildLevel) || !Number.isFinite(bassLevel)) {
      throw new Error(`Ungültiger Automationswert bei Takt ${bar}`);
    }
  }
  // Takt 0: Bass -60 dB, Takt 46: Bass -11 dB
  const bassStart = evalLane(patch.arrangement.lanes.bass.points, 0);
  const bassPeak = evalLane(patch.arrangement.lanes.bass.points, 46);
  if (bassStart !== -60 || bassPeak !== -11) throw new Error('Bass-Automation entspricht nicht der Vorgabe');
  console.log(`✓ Automationsspuren geprüft (Bass Start: ${bassStart} dB, Höhepunkt: ${bassPeak} dB)`);

  console.log('--- TEST 6: Zustand Export/Import Round-Trip ---');
  const exported = engine.getState();
  const reloaded = engine.loadState(exported);
  if (!reloaded.ok) throw new Error('Zustandsexport lässt sich nicht reimportieren');
  console.log('✓ Export- und Re-Import-Zyklus erfolgreich');

  console.log('--- TEST 7: Standard-Patch (Spielbereit & Manuell) ---');
  const { buildStandardPatch, buildEmptyPatch } = await import('./distantLights.js');
  const stdPatch = buildStandardPatch();
  if (stdPatch.mode !== 'manual' || stdPatch.name !== 'Eurorack Standard') {
    throw new Error('Standard-Patch muss im manuellen Spielmodus sein');
  }
  const stdRes = engine.loadState(stdPatch);
  if (!stdRes.ok) throw new Error(`Standard-Patch konnte nicht geladen werden: ${stdRes.error}`);
  console.log('✓ Standard-Patch erfolgreich geladen (Modus: manual, spielbereit)');

  console.log('--- TEST 8: Leeres Rack (Tabula Rasa) ---');
  const emptyPatch = buildEmptyPatch();
  if (emptyPatch.cables.length !== 0) throw new Error('Leeres Rack darf keine Kabel enthalten');
  const emptyRes = engine.loadState(emptyPatch);
  if (!emptyRes.ok) throw new Error(`Leeres Rack konnte nicht geladen werden: ${emptyRes.error}`);
  console.log('✓ Leeres Rack erfolgreich geladen (0 Kabel)');

  console.log('--- TEST 9: disconnectAll() ---');
  engine.loadState(stdPatch);
  if (engine.cables.length === 0) throw new Error('Standard-Patch sollte Kabel haben');
  engine.disconnectAll();
  if (engine.cables.length !== 0) throw new Error('disconnectAll() hat nicht alle Kabel entfernt');
  console.log('✓ disconnectAll() hat alle Kabel erfolgreich abgezogen');

  console.log('--- TEST 10: Freies Notenspiel (playNote / stopNote) ---');
  engine.loadState(stdPatch);
  engine.playNote(60);
  const harmony = engine.modules.get('harmony');
  if (!harmony.sounding || !harmony.gate) throw new Error('playNote hat Harmony-Gate nicht geöffnet');
  engine.stopNote(60);
  if (harmony.gate) throw new Error('stopNote hat Harmony-Gate nicht geschlossen');
  console.log('✓ playNote und stopNote schalten Gate und Pitch fehlerfrei');

  console.log('\nAlle 10 Unit-Tests erfolgreich bestanden!');
}

runTests().catch((err) => {
  console.error('TEST FEHLGESCHLAGEN:', err);
  process.exit(1);
});
