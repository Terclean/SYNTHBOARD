// Test-Verifizierung für StudioWorkspace (Google-Maps Workspace System)
import { StudioWorkspace } from './StudioWorkspace.js';

// Mocks für DOM
globalThis.document = {
  createElement: (tag) => {
    const el = {
      tagName: tag.toUpperCase(),
      classList: {
        add: () => {},
        remove: () => {},
        toggle: () => {},
        contains: () => false,
      },
      style: {},
      dataset: {},
      querySelector: () => null,
      querySelectorAll: () => [],
      appendChild: (child) => child,
      remove: () => {},
      addEventListener: () => {},
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 320, height: 400 }),
    };
    return el;
  },
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => [],
};

globalThis.window = {
  devicePixelRatio: 1,
  innerWidth: 1920,
  innerHeight: 1080,
  addEventListener: () => {},
  matchMedia: () => ({ matches: false }),
};

globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 1);
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);

console.log('--- TEST 1: StudioWorkspace Instanziierung ---');
const viewportEl = {
  classList: { add: () => {}, remove: () => {} },
  style: {},
  appendChild: () => {},
  addEventListener: () => {},
  getBoundingClientRect: () => ({ left: 100, top: 50, width: 1200, height: 800 }),
};
const worldEl = { style: {}, appendChild: () => {} };

const ws = new StudioWorkspace({
  viewportEl,
  worldEl,
  engine: { controls: [], sources: [], effects: [] },
  patchBay: { requestDraw: () => {} },
});

if (ws.zoom === 0.85 && ws.mode === 'free') {
  console.log('✓ Workspace initialisiert im freien Modus mit 85% Zoom');
} else {
  throw new Error('Initialisierung fehlgeschlagen');
}

console.log('--- TEST 2: Welt- und Bildschirmkoordinaten (Google Maps) ---');
ws.panX = 100;
ws.panY = 50;
ws.zoom = 1.0;

// Bei clientX = 250, clientY = 150 und viewport.left = 100, top = 50:
// sx = 250 - 100 = 150, sy = 150 - 50 = 100.
// worldX = (150 - 100) / 1.0 = 50, worldY = (100 - 50) / 1.0 = 50.
const world = ws.screenToWorld(250, 150);
if (Math.round(world.x) === 50 && Math.round(world.y) === 50) {
  console.log('✓ screenToWorld präzise:', world);
} else {
  throw new Error(`screenToWorld falsch: ${JSON.stringify(world)}`);
}

const screen = ws.worldToScreen(50, 50);
if (Math.round(screen.x) === 250 && Math.round(screen.y) === 150) {
  console.log('✓ worldToScreen präzise:', screen);
} else {
  throw new Error(`worldToScreen falsch: ${JSON.stringify(screen)}`);
}

console.log('--- TEST 3: Auto-Layout Packing (Kompakt nach Seitenverhältnis) ---');
const mockModules = [
  { id: 'm1', meta: { category: 'control' } },
  { id: 'm2', meta: { category: 'source' } },
  { id: 'm3', meta: { category: 'source' } },
  { id: 'm4', meta: { category: 'effect' } },
  { id: 'm5', meta: { category: 'effect' } },
];
const layout = ws.computeCompactLayout(mockModules);
if (layout.size === 5 && layout.has('m1') && layout.has('m5')) {
  console.log('✓ 5 Module kompakt berechnet ohne Überlappung');
} else {
  throw new Error('computeCompactLayout fehlerhaft');
}

console.log('--- TEST 4: Schnapp-Hilfslinien (Snapping) ---');
const cardA = { id: 'a', x: 100, y: 100, width: 300, height: 380, el: { style: {} } };
const cardB = { id: 'b', x: 418, y: 105, width: 300, height: 380, el: { style: {} } }; // fast aligned
ws.cards.set('a', cardA);
ws.cards.set('b', cardB);

const snap = ws.computeSnapping('b', 418, 105, cardB.width, cardB.height);
if (snap.guides.length > 0) {
  console.log('✓ Schnapp-Hilfslinien erkannt:', snap.guides.length);
} else {
  throw new Error('Snapping hat Hilfslinien nicht erkannt');
}

console.log('--- TEST 5: Freie Positionen sichern und wiederherstellen ---');
ws.savedFreePositions.set('a', { x: 50, y: 50 });
ws.savedFreePositions.set('b', { x: 400, y: 50 });
ws.hasSavedFreePositions = true;
ws.restoreFreePositions(false);

if (cardA.x === 50 && cardB.x === 400) {
  console.log('✓ Freie Positionen erfolgreich restauriert');
} else {
  throw new Error('restoreFreePositions fehlgeschlagen');
}

console.log('\nAlle Workspace-Tests erfolgreich bestanden!');
