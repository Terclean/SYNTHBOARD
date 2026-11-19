// Regressionstest: snapshot_ctrl Song-Ablaufplan (barIn, bars1–5, autoRun, loop, reset)
import { SnapshotControllerModule } from './controls.js';

class MockParam {
  constructor(v = 0) { this.value = v; }
  cancelScheduledValues() {}
  cancelAndHoldAtTime() {}
  setValueAtTime(v) { this.value = v; }
  setTargetAtTime(v) { this.value = v; }
  linearRampToValueAtTime(v) { this.value = v; }
}
const mockCtx = {
  currentTime: 0,
  sampleRate: 48000,
  createGain: () => ({ gain: new MockParam(1), connect() {}, disconnect() {} }),
};

function assert(cond, msg) {
  if (!cond) {
    console.error(`✗ ${msg}`);
    process.exit(1);
  }
}

function makeCtrl(values) {
  const triggered = [];
  const snapSys = {
    activeSlot: null,
    triggerSlot(s) { this.activeSlot = s; triggered.push(s); },
  };
  const mod = new SnapshotControllerModule(mockCtx, { values });
  mod.engine = { snapshotSystem: snapSys };
  return { mod, triggered, snapSys };
}

// Zeitpunkt in der Vergangenheit -> Aktionen laufen synchron
const T = -1;

console.log('--- TEST 1: autoRun aus = altes Verhalten ---');
{
  const { mod, triggered } = makeCtrl({ autoRun: 0 });
  for (let i = 0; i < 20; i++) mod.onClock('barIn', T, i);
  assert(triggered.length === 0, 'Ohne autoRun darf barIn nichts umschalten');
  mod.onTrigger('nextIn', T);
  assert(triggered[0] === 1, 'nextIn funktioniert weiterhin');
  console.log('✓ autoRun: 0 verhält sich wie bisher');
}

console.log('--- TEST 2: Unterschiedlich lange Parts (8/8/16/16/8, One-Shot) ---');
{
  const { mod, triggered } = makeCtrl({ autoRun: 1, loop: 0, bars1: 8, bars2: 8, bars3: 16, bars4: 16, bars5: 8 });
  const slotAtBar = [];
  for (let bar = 0; bar < 70; bar++) {
    mod.onClock('barIn', T, bar);
    slotAtBar.push(mod.songSlot);
  }
  assert(slotAtBar[0] === 1 && slotAtBar[7] === 1, 'Takte 1–8 = Slot 1');
  assert(slotAtBar[8] === 2 && slotAtBar[15] === 2, 'Takte 9–16 = Slot 2');
  assert(slotAtBar[16] === 3 && slotAtBar[31] === 3, 'Takte 17–32 = Slot 3');
  assert(slotAtBar[32] === 4 && slotAtBar[47] === 4, 'Takte 33–48 = Slot 4');
  assert(slotAtBar[48] === 5 && slotAtBar[69] === 5, 'Ab Takt 49 = Slot 5 (One-Shot bleibt stehen)');
  assert(JSON.stringify(triggered) === '[1,2,3,4,5]', `Jeder Slot genau einmal ausgelöst: ${JSON.stringify(triggered)}`);
  assert(mod.songFinished === true, 'One-Shot markiert Song-Ende');
  console.log('✓ Slots wechseln exakt nach 8 / 8 / 16 / 16 Takten, One-Shot hält Slot 5');
}

console.log('--- TEST 3: Loop & Überspringen (bars = 0) ---');
{
  const { mod, triggered } = makeCtrl({ autoRun: 1, loop: 1, bars1: 2, bars2: 0, bars3: 1, bars4: 0, bars5: 0 });
  for (let bar = 0; bar < 7; bar++) mod.onClock('barIn', T, bar);
  // Takte: 1,1 | 3 | 1,1 | 3 | 1
  assert(JSON.stringify(triggered) === '[1,3,1,3,1]', `Loop mit übersprungenen Slots: ${JSON.stringify(triggered)}`);
  console.log('✓ Slots mit 0 Takten werden übersprungen, Loop startet wieder bei Slot 1');
}

console.log('--- TEST 4: resetIn & Clock-Neustart ---');
{
  const { mod, triggered } = makeCtrl({ autoRun: 1, loop: 1, bars1: 4, bars2: 4, bars3: 4, bars4: 4, bars5: 4 });
  for (let bar = 0; bar < 6; bar++) mod.onClock('barIn', T, bar);
  assert(mod.songSlot === 2 && mod.barInSlot === 2, 'Nach 6 Takten: Slot 2, Takt 2');
  mod.onTrigger('resetIn', T);
  assert(mod.songSlot === 1 && mod.barInSlot === 0, 'resetIn setzt auf Slot 1 / Takt 0');
  mod.onClock('barIn', T, 6);
  assert(mod.songSlot === 1 && mod.barInSlot === 1, 'Nächster Takt nach Reset = Slot 1, Bar 1');
  for (let bar = 7; bar < 12; bar++) mod.onClock('barIn', T, bar);
  mod.onClock('barIn', T, 0); // Clock-Neustart
  assert(mod.songSlot === 1 && mod.barInSlot === 1, 'Clock-Neustart (Takt 0) beginnt bei Slot 1, Bar 1');
  assert(triggered.filter((s) => s === 1).length >= 3, 'Slot 1 wurde bei Start, Reset und Neustart ausgelöst');
  console.log('✓ resetIn und Clock-Neustart springen zurück auf Slot 1');
}

console.log('--- TEST 5: Manueller Slot-Wechsel wird übernommen ---');
{
  const { mod } = makeCtrl({ autoRun: 1, loop: 1, bars1: 8, bars2: 8, bars3: 2, bars4: 8, bars5: 8 });
  mod.onClock('barIn', T, 0);
  mod.onTrigger('slot3In', T);
  mod.onClock('barIn', T, 1);
  mod.onClock('barIn', T, 2);
  assert(mod.songSlot === 3 && mod.barInSlot === 2, 'Song läuft ab manuell gewähltem Slot 3 weiter');
  mod.onClock('barIn', T, 3);
  assert(mod.songSlot === 4, 'Nach 2 Takten Slot 3 geht es mit Slot 4 weiter');
  console.log('✓ Manuelle Slot-Trigger setzen den Ablauf ab diesem Slot fort');
}

console.log('\nAlle 5 Song-Ablaufplan-Tests erfolgreich bestanden!');
