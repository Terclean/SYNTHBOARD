// Regressionstests für Community-Leaderboard-Sync (Freigabe, Validierung, Deduplizierung, Votes & No-Op)
import { syncLeaderboardData } from '../../scripts/sync-community-leaderboard.mjs';
import { encodePatchToHash } from '../ui/communityUtils.js';

const SEED_INDEX = {
  version: 2,
  name: 'SYNTHBOARD Community Leaderboard',
  updatedAt: '2026-11-19T12:00:00Z',
  repo: 'Terclean/SYNTHBOARD',
  tracks: [
    {
      version: 2,
      id: 'piano-opera',
      name: 'Piano Opera',
      author: 'Terclean',
      description: 'Expressive felt piano chords.',
      tags: ['piano', 'cinematic'],
      votes: 14,
      templateKey: 'piano_opera',
      issueUrl: 'https://github.com/Terclean/SYNTHBOARD/discussions',
      createdAt: '2026-11-19T10:00:00Z',
    },
    {
      version: 2,
      id: 'somnus-dreamdrift',
      name: 'Somnus (Dreamdrift)',
      author: 'Terclean',
      description: 'Deep ambient tri-drone.',
      tags: ['ambient', 'drone'],
      votes: 9,
      templateKey: 'sleep',
      issueUrl: 'https://github.com/Terclean/SYNTHBOARD/discussions',
      createdAt: '2026-11-18T18:00:00Z',
    },
    {
      version: 2,
      id: 'start-here-first-tone',
      name: 'Start Here – First Tone',
      author: 'Terclean',
      description: 'Clean 4-module starter patch.',
      tags: ['ambient', 'drone'],
      votes: 6,
      templateKey: 'start_here',
      issueUrl: 'https://github.com/Terclean/SYNTHBOARD/discussions',
      createdAt: '2026-11-17T14:00:00Z',
    },
  ],
};

const VALID_BUNDLE = {
  version: 2,
  name: 'Velvet Horizon',
  author: '@horizon',
  description: 'Warm analog drone with slow filter breathing.',
  tags: ['ambient', 'drone', 'modular'],
  state: {
    version: 2,
    name: 'Velvet Horizon',
    master: 0.8,
    modules: [
      { id: 'clk1', type: 'master_clock', enabled: true, pos: { x: 60, y: 60 }, values: { tempo: 84, swing: 0, running: 1 } },
      { id: 'drn1', type: 'drone', enabled: true, pos: { x: 340, y: 60 }, values: { level: 0.65, tone: 920, root: 36 } },
      { id: 'rev1', type: 'reverb', enabled: true, pos: { x: 620, y: 60 }, values: { decay: 7.5, mix: 0.45 } },
    ],
    cables: [],
  },
};

async function runTests() {
  console.log('--- TEST 1: Nicht freigegebene Einreichung (nur community-rack) wird noch nicht veröffentlicht ---');
  const unapprovedIssue = {
    number: 42,
    state: 'open',
    title: '[Rack] Velvet Horizon',
    html_url: 'https://github.com/Terclean/SYNTHBOARD/issues/42',
    created_at: '2026-11-24T09:00:00Z',
    user: { login: 'horizon' },
    labels: [{ name: 'community-rack' }],
    reactions: { '+1': 3 },
    body: `### Rack Name\n\nVelvet Horizon\n\n### Patch Data\n\n\`\`\`json\n${JSON.stringify(VALID_BUNDLE)}\n\`\`\``,
  };

  const res1 = await syncLeaderboardData({ currentData: SEED_INDEX, issues: [unapprovedIssue] });
  if (res1.changed || res1.nextData.tracks.length !== 3) {
    throw new Error('Nicht freigegebenes Issue darf keine Änderung auslösen');
  }
  console.log('✓ Nicht freigegebenes Issue wird ignoriert, changed=false');

  console.log('--- TEST 2: Freigegebene Einreichung (community-rack + approved) wird validiert & importiert ---');
  const approvedIssue = {
    ...unapprovedIssue,
    labels: [{ name: 'community-rack' }, { name: 'approved' }],
  };
  const res2 = await syncLeaderboardData({ currentData: SEED_INDEX, issues: [approvedIssue] });
  if (!res2.changed || res2.nextData.tracks.length !== 4) {
    throw new Error('Freigegebenes Issue wurde nicht übernommen');
  }
  const imported = res2.nextData.tracks.find((t) => t.id === 'issue-42');
  if (!imported || imported.name !== 'Velvet Horizon' || imported.votes !== 3 || !Array.isArray(imported.state?.modules)) {
    throw new Error('Importierter Track unvollständig: ' + JSON.stringify(imported));
  }
  console.log('✓ Freigegebenes Rack mit validiertem State, Tags und 3 Votes importiert');

  console.log('--- TEST 3: Erneuter Lauf ohne Änderungen erzeugt weder Duplikat noch Änderung (No-Op) ---');
  const res3 = await syncLeaderboardData({ currentData: res2.nextData, issues: [approvedIssue] });
  if (res3.changed || res3.nextData.tracks.length !== 4 || res3.nextData.updatedAt !== res2.nextData.updatedAt) {
    throw new Error('Erneuter unveränderter Lauf muss changed=false liefern');
  }
  console.log('✓ Erneuter Lauf ohne Änderungen ist strikt idempotent (changed=false, kein Duplikat)');

  console.log('--- TEST 4: Neue 👍-Stimme auf dem Issue wird synchronisiert ---');
  const votedIssue = {
    ...approvedIssue,
    reactions: { '+1': 11 },
  };
  const res4 = await syncLeaderboardData({ currentData: res2.nextData, issues: [votedIssue] });
  const updatedTrack = res4.nextData.tracks.find((t) => t.id === 'issue-42');
  if (!res4.changed || updatedTrack?.votes !== 11 || res4.nextData.tracks[1].id !== 'issue-42') {
    throw new Error('Stimmen-Update oder Sortierung fehlgeschlagen');
  }
  console.log('✓ 👍-Stimme auf 11 erhöht und Leaderboard-Rang aktualisiert');

  console.log('--- TEST 5: Import über verlinkten JSON-Anhang & über #p=... Share-Link ---');
  const hash = await encodePatchToHash(VALID_BUNDLE);
  const linkIssue = {
    number: 43,
    state: 'open',
    title: '[Rack] Linked Patch',
    html_url: 'https://github.com/Terclean/SYNTHBOARD/issues/43',
    created_at: '2026-11-24T09:30:00Z',
    user: { login: 'patcher' },
    labels: [{ name: 'community-rack' }, { name: 'approved' }],
    reactions: { '+1': 1 },
    body: `### Rack Name\n\nLinked Patch\n\n### Patch Data\n\n[velvet.synthboard.json](https://github.com/user-attachments/files/12345/velvet.synthboard.json)`,
  };
  const hashIssue = {
    number: 44,
    state: 'open',
    title: '[Rack] Hash Patch',
    html_url: 'https://github.com/Terclean/SYNTHBOARD/issues/44',
    created_at: '2026-11-24T09:45:00Z',
    user: { login: 'hasher' },
    labels: [{ name: 'community-rack' }, { name: 'approved' }],
    reactions: { '+1': 2 },
    body: `### Rack Name\n\nHash Patch\n\n### Patch Data\n\nhttps://terclean.github.io/SYNTHBOARD/${hash}`,
  };
  const res5 = await syncLeaderboardData({
    currentData: SEED_INDEX,
    issues: [linkIssue, hashIssue],
    fetchText: async () => JSON.stringify(VALID_BUNDLE),
  });
  if (!res5.nextData.tracks.some((t) => t.id === 'issue-43') || !res5.nextData.tracks.some((t) => t.id === 'issue-44')) {
    throw new Error('JSON-Link oder Share-Hash wurde nicht importiert');
  }
  console.log('✓ Sowohl verlinkte .synthboard.json-Anhänge als auch #p=... Share-Links werden sauber importiert');

  console.log('\nAlle 5 Community-Leaderboard-Sync-Tests erfolgreich bestanden!');
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
