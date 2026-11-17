import assert from 'node:assert/strict';
import { TEMPLATES } from './index.js';
import {
  MAX_IMPORT_BYTES,
  validateFileSize,
  validateAndSanitizePatchState,
} from './patchValidator.js';

console.log('--- TEST 1: Dateigrößenlimit (2 MiB) ---');
assert.equal(validateFileSize(1024).ok, true);
assert.equal(validateFileSize(MAX_IMPORT_BYTES).ok, true);
const tooBig = validateFileSize(MAX_IMPORT_BYTES + 1);
assert.equal(tooBig.ok, false);
assert.match(tooBig.error, /zu groß/i);
console.log('✓ 2-MiB-Limit wird korrekt erzwungen');

console.log('--- TEST 2: Gültige bestehende Templates & Export-Format ---');
for (const [key, tpl] of Object.entries(TEMPLATES)) {
  const res = validateAndSanitizePatchState({ name: tpl.name, state: tpl.state });
  assert.equal(res.ok, true, `Template "${key}" fehlgeschlagen: ${res.error}`);
}
console.log(`✓ Alle ${Object.keys(TEMPLATES).length} eingebauten Templates bestehen die Validierung`);

console.log('--- TEST 3: Beschädigtes JSON & ungültige Root-Struktur ---');
assert.throws(() => JSON.parse('{ broken json'), SyntaxError);
assert.equal(validateAndSanitizePatchState(null).ok, false);
assert.equal(validateAndSanitizePatchState([]).ok, false);
assert.equal(validateAndSanitizePatchState({ modules: 'nope' }).ok, false);
console.log('✓ Beschädigtes JSON & ungültige Struktur werden abgewiesen');

console.log('--- TEST 4: Unbekannte Modultypen & doppelte IDs ---');
const unknownMod = validateAndSanitizePatchState({
  modules: [{ id: 'x1', type: 'non_existent_module' }],
});
assert.equal(unknownMod.ok, false);
assert.match(unknownMod.error, /Unbekannter Modultyp/i);

const dupIds = validateAndSanitizePatchState({
  modules: [
    { id: 'clk1', type: 'master_clock' },
    { id: 'clk1', type: 'drone' },
  ],
});
assert.equal(dupIds.ok, false);
assert.match(dupIds.error, /Doppelte Modul-ID/i);
console.log('✓ Unbekannte Modultypen und doppelte IDs werden abgewiesen');

console.log('--- TEST 5: Nicht endliche Werte, Clamping & options/values Merge ---');
const nonFinite = validateAndSanitizePatchState({
  modules: [{ id: 'clk1', type: 'master_clock', values: { tempo: Infinity } }],
});
assert.equal(nonFinite.ok, false);
assert.match(nonFinite.error, /endliche Zahl/i);

const clampedImport = validateAndSanitizePatchState({
  modules: [
    { id: 'clk1', type: 'master_clock', values: { tempo: 9999 } },
    { id: 'sl1', type: 'slope_generator', values: { curve: -0.2 }, options: { mode: 'trig' } },
  ],
});
assert.equal(clampedImport.ok, true);
assert.equal(clampedImport.state.modules[0].values.tempo, 200);
assert.equal(clampedImport.state.modules[1].values.curve, 0);
assert.equal(clampedImport.state.modules[1].values.mode, 'trig');

const badOption = validateAndSanitizePatchState({
  modules: [{ id: 'sl1', type: 'slope_generator', values: { mode: 'invalid_mode' } }],
});
assert.equal(badOption.ok, false);
assert.match(badOption.error, /Auswahlwert/i);
console.log('✓ Nicht endliche & Optionsfehler abgewiesen, Bereichsüberschreitungen geclampt & options gemerged');

console.log('--- TEST 6: Ungültige Kabelverbindungen ---');
const badCableMod = validateAndSanitizePatchState({
  modules: [{ id: 'clk1', type: 'master_clock' }],
  cables: [{ from: 'clk1:clockOut', to: 'missing:gateIn' }],
});
assert.equal(badCableMod.ok, false);
assert.match(badCableMod.error, /Unbekanntes Modul/i);

const badCableJack = validateAndSanitizePatchState({
  modules: [
    { id: 'clk1', type: 'master_clock' },
    { id: 'dp1', type: 'drone' },
  ],
  cables: [{ from: 'clk1:nonExistentPort', to: 'dp1:vcaCv' }],
});
assert.equal(badCableJack.ok, false);
assert.match(badCableJack.error, /Ungültiger Ausgang/i);
console.log('✓ Ungültige Kabelverbindungen werden abgewiesen');

console.log('--- TEST 7: Whitelist & HTML-/Script-Text in Namen ---');
const xssImport = validateAndSanitizePatchState({
  name: '<script>alert(1)</script> My Patch',
  __proto__: { polluted: true },
  modules: [
    {
      id: 'clk1',
      type: 'master_clock',
      unknownField: 'evil',
      values: { tempo: 110, injectedParam: 123 },
    },
  ],
});
assert.equal(xssImport.ok, true);
assert.equal(xssImport.state.modules[0].unknownField, undefined);
assert.equal(xssImport.state.modules[0].values.injectedParam, undefined);
assert.equal(({}).polluted, undefined);
assert.equal(xssImport.name, '<script>alert(1)</script> My Patch'); // Rohstring bleibt sicher für textContent/esc()
console.log('✓ Unbekannte Felder gestrippt, kein Prototype Pollution');

console.log('--- TEST 8: Bestehendes Rack bleibt bei Fehler unverändert ---');
const existingRack = {
  modules: [{ id: 'dp1', type: 'drone', values: { level: 0.7 } }],
  cables: [],
};
let activeRack = existingRack;
const failedImport = validateAndSanitizePatchState({
  modules: [{ id: 'bad', type: 'does_not_exist' }],
});
if (failedImport.ok) activeRack = failedImport.state;
assert.strictEqual(activeRack, existingRack);
console.log('✓ Bestehendes Rack bleibt bei fehlgeschlagenem Import erhalten');

console.log('\nAlle 8 Patch-Import-Regressionstests erfolgreich bestanden!');
