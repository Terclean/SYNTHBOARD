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
  'Steuerung': 'Control',
  'Steuerung & Rhythmus': 'Control & Rhythm',
  'Instrumente': 'Instruments',
  'Instrumente & Klangquellen': 'Instruments & Sound Sources',
  'Effekte': 'Effects',
  'Master-Effekte': 'Master Effects',
  'Alle': 'All',

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

  // Workspace HUD
  'Frei': 'Free',
  'Alles anzeigen': 'Fit all',
  'Freie Positionen': 'Free positions',
  'Fokussieren': 'Focus',

  // Patch-Auswahl & Modulkarten
  'Neues Board (ungespeichert)': 'New Board (unsaved)',
  'Meine Patches': 'My Patches',
  'Studio-Vorlagen': 'Studio Templates',
  'Speicher komplett leeren (alle Boards löschen)...': 'Clear storage (delete all boards)...',
  'KANALZUG · PAN & AUX SENDS': 'CHANNEL STRIP · PAN & AUX SENDS',
  'EINGÄNGE': 'INPUTS',
  'AUSGÄNGE': 'OUTPUTS',
  'AKTIVER PERFORMANCE SNAPSHOT': 'ACTIVE PERFORMANCE SNAPSHOT',

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
