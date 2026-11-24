// SYNTHBOARD – Community Leaderboard Sync (GitHub Issues -> public/community/index.json)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateAndSanitizePatchState } from '../src/modules/patchValidator.js';
import { autoTagRack, normalizeTags, decodePatchFromHash } from '../src/ui/communityUtils.js';

export const SUBMISSION_LABEL = 'community-rack';
export const APPROVAL_LABELS = new Set(['approved', 'community-approved', 'leaderboard-approved']);

function cleanText(raw, maxLen = 120, fallback = '') {
  const str = String(raw ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!str || /^_no response_$/i.test(str)) return fallback;
  return str.slice(0, maxLen);
}

function cleanMultilineText(raw, maxLen = 280) {
  const str = String(raw ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .trim();
  if (!str || /^_no response_$/i.test(str)) return '';
  return str.slice(0, maxLen);
}

export function getTrackIssueNumber(track) {
  if (!track || typeof track !== 'object') return null;
  if (Number.isInteger(track.issueNumber) && track.issueNumber > 0) {
    return track.issueNumber;
  }
  if (typeof track.id === 'string') {
    const m = track.id.match(/^issue-(\d+)$/);
    if (m) return Number(m[1]);
  }
  if (typeof track.issueUrl === 'string') {
    const m = track.issueUrl.match(/\/issues\/(\d+)(?:$|[/?#])/);
    if (m) return Number(m[1]);
  }
  return null;
}

export function isIssueApproved(issue) {
  if (!issue || issue.pull_request) return false;
  const labels = Array.isArray(issue.labels) ? issue.labels : [];
  const names = labels.map((l) => (typeof l === 'string' ? l : l?.name || '').toLowerCase().trim());
  const hasSubmission = names.includes(SUBMISSION_LABEL);
  const hasApproval = names.some((n) => APPROVAL_LABELS.has(n));
  return hasSubmission && hasApproval;
}

/**
 * Parst die Markdown-Abschnitte eines GitHub YAML Issue-Formulars (### Überschrift).
 */
export function parseIssueFormSections(body = '') {
  const sections = new Map();
  const text = String(body ?? '').replace(/\r\n/g, '\n');
  const regex = /^###\s+([^\n]+)\n([\s\S]*?)(?=^###\s+[^\n]+\n|\s*$)/gm;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const heading = match[1].trim().toLowerCase();
    const content = match[2].trim();
    sections.set(heading, content);
  }
  return sections;
}

function findSection(sections, keywords) {
  for (const [heading, content] of sections.entries()) {
    if (keywords.some((kw) => heading.includes(kw))) {
      return content;
    }
  }
  return '';
}

function tryParseJsonCandidate(str) {
  try {
    const parsed = JSON.parse(str);
    if (parsed && typeof parsed === 'object') {
      if (Array.isArray(parsed.modules) || (parsed.state && Array.isArray(parsed.state.modules))) {
        return parsed;
      }
    }
  } catch { /* ignore */ }
  return null;
}

/**
 * Extrahiert das Rack-JSON-Payload aus dem Issue-Body:
 * 1. Verlinkte .json-Datei (z. B. GitHub user-attachments .synthboard.json)
 * 2. Fenced JSON-Codeblock (```json ... ```)
 * 3. SYNTHBOARD Share-Link (#p=gz... oder #p=raw...)
 * 4. Rohes JSON-Objekt im Text
 */
export async function extractPatchPayloadFromIssue(issue, fetchText = null) {
  const body = String(issue?.body ?? '');
  if (!body.trim()) return null;

  // 1. Verlinkte .json / .synthboard.json Anhänge prüfen
  const urlRegex = /https:\/\/[^\s)<>"'`]+\.json(?:\?[^\s)<>"'`]*)?/gi;
  const urls = body.match(urlRegex) || [];
  if (fetchText && urls.length > 0) {
    for (const url of urls) {
      try {
        const rawText = await fetchText(url);
        const parsed = tryParseJsonCandidate(rawText);
        if (parsed) return parsed;
      } catch (err) {
        console.warn(`[Community Sync] Konnte JSON-Anhang nicht laden (${url}): ${err.message}`);
      }
    }
  }

  // 2. Fenced Code-Blöcke (```json ... ``` oder ``` ... ```)
  const fenceRegex = /```(?:json)?\s*([\s\S]*?)```/gi;
  let fenceMatch;
  while ((fenceMatch = fenceRegex.exec(body)) !== null) {
    const parsed = tryParseJsonCandidate(fenceMatch[1].trim());
    if (parsed) return parsed;
  }

  // 3. Share-Link (#p=gz.... oder #p=raw....)
  const hashMatch = body.match(/#p=(?:gz|raw)\.[A-Za-z0-9_-]+/);
  if (hashMatch) {
    try {
      const decoded = await decodePatchFromHash(hashMatch[0]);
      if (decoded && (Array.isArray(decoded.modules) || Array.isArray(decoded.state?.modules))) {
        return decoded;
      }
    } catch (err) {
      console.warn(`[Community Sync] Konnte Share-Hash nicht dekodieren: ${err.message}`);
    }
  }

  // 4. Rohes JSON-Objekt im Text
  const firstBrace = body.indexOf('{');
  const lastBrace = body.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const parsed = tryParseJsonCandidate(body.slice(firstBrace, lastBrace + 1));
    if (parsed) return parsed;
  }

  return null;
}

export function sortLeaderboardTracks(tracks) {
  return [...tracks].sort((a, b) => {
    const voteDiff = (Number(b.votes) || 0) - (Number(a.votes) || 0);
    if (voteDiff !== 0) return voteDiff;
    const timeDiff = (Date.parse(b.createdAt || 0) || 0) - (Date.parse(a.createdAt || 0) || 0);
    if (timeDiff !== 0) return timeDiff;
    return String(a.id || '').localeCompare(String(b.id || ''));
  });
}

/**
 * Synchronisiert GitHub-Issues mit dem bestehenden index.json-Datenbestand.
 * - Behält bestehende Seed-Tracks (ohne Issue-Zuordnung) und deren Stimmen bei.
 * - Übernimmt freigegebene Issues (community-rack + approved) nach strenger Rack-Validierung.
 * - Nutzt die Issue-Nummer als stabile Zuordnung (keine Duplikate bei erneuten Läufen).
 * - Aktualisiert 👍-Stimmen (reactions["+1"]) für alle zugeordneten Tracks.
 * - Meldet changed=false, wenn keine echten Datenänderungen vorliegen.
 */
export async function syncLeaderboardData({ currentData, issues, fetchText = null }) {
  const currentTracks = Array.isArray(currentData?.tracks) ? currentData.tracks : [];
  const seedTracks = [];
  const existingByIssue = new Map();

  for (const track of currentTracks) {
    const issueNum = getTrackIssueNumber(track);
    if (issueNum !== null) {
      existingByIssue.set(issueNum, structuredClone(track));
    } else {
      seedTracks.push(structuredClone(track));
    }
  }

  const issueList = Array.isArray(issues) ? issues.filter((i) => i && !i.pull_request) : [];
  const nextIssueTracks = new Map();

  // Zuerst alle bereits bekannten Issue-Tracks vormerken (falls ein Seed-Track einem Issue zugeordnet wurde)
  for (const [num, prev] of existingByIssue.entries()) {
    nextIssueTracks.set(num, prev);
  }

  for (const issue of issueList) {
    const num = Number(issue.number);
    if (!Number.isInteger(num) || num <= 0) continue;

    const isOpen = issue.state === 'open';
    const approved = isIssueApproved(issue);
    const votes = Number(issue.reactions?.['+1']) || 0;
    const prev = existingByIssue.get(num) || null;

    // Falls ein bestehender Seed-Track (mit templateKey) einem offenen Issue zugeordnet wurde: Stimmen aktualisieren
    if (prev && prev.templateKey && !prev.state && isOpen) {
      prev.votes = votes;
      prev.issueUrl = issue.html_url || prev.issueUrl;
      nextIssueTracks.set(num, prev);
      continue;
    }

    // Wenn ein früher importiertes Community-Issue geschlossen oder die Freigabe entzogen wurde: entfernen
    if (!isOpen || !approved) {
      if (prev && !prev.templateKey) {
        nextIssueTracks.delete(num);
      }
      continue;
    }

    // Freigegebene Einreichung parsen & validieren
    const sections = parseIssueFormSections(issue.body || '');
    const formName = cleanText(findSection(sections, ['rack name', 'rack-name', 'name']), 80);
    const formAuthor = cleanText(findSection(sections, ['author', 'autor', 'handle']), 40);
    const formTagsRaw = cleanText(findSection(sections, ['tags']), 180);
    const formDesc = cleanMultilineText(findSection(sections, ['description', 'beschreibung']), 280);

    const rawPayload = await extractPatchPayloadFromIssue(issue, fetchText);
    const candidateData = rawPayload || (prev?.state ? { version: 2, name: prev.name, state: prev.state } : null);

    if (!candidateData) {
      console.warn(`[Community Sync] Überspringe Issue #${num}: Keine Rack-Daten gefunden.`);
      continue;
    }

    const titleFallback = cleanText(String(issue.title || '').replace(/^\[rack\]\s*/i, ''), 80, `Community Rack #${num}`);
    const fallbackName = formName || cleanText(rawPayload?.name, 80) || cleanText(rawPayload?.state?.name, 80) || titleFallback;
    const validated = validateAndSanitizePatchState(candidateData, { fallbackName });

    if (!validated.ok) {
      console.warn(`[Community Sync] Überspringe Issue #${num}: Rack-Validierung fehlgeschlagen (${validated.error})`);
      continue;
    }

    const finalName = formName || cleanText(rawPayload?.name, 80) || validated.name;
    const finalAuthor = formAuthor
      || cleanText(rawPayload?.author, 40)
      || prev?.author
      || (issue.user?.login ? `@${issue.user.login}` : 'Community');
    const finalDesc = formDesc
      || cleanMultilineText(rawPayload?.description, 280)
      || prev?.description
      || '';

    let finalTags = normalizeTags(formTagsRaw || rawPayload?.tags || prev?.tags || []);
    if (finalTags.length === 0) {
      finalTags = autoTagRack(validated.state);
    }

    const stateWithMeta = {
      ...validated.state,
      version: 2,
      name: finalName,
    };

    const trackEntry = {
      version: 2,
      id: prev?.id || `issue-${num}`,
      issueNumber: num,
      name: finalName,
      author: finalAuthor,
      description: finalDesc,
      tags: finalTags,
      votes,
      issueUrl: issue.html_url || prev?.issueUrl || `https://github.com/${currentData?.repo || 'Terclean/SYNTHBOARD'}/issues/${num}`,
      createdAt: prev?.createdAt || issue.created_at || new Date().toISOString(),
      ...(prev?.teaserUrl ? { teaserUrl: prev.teaserUrl } : {}),
      state: stateWithMeta,
    };

    nextIssueTracks.set(num, trackEntry);
  }

  const combinedTracks = sortLeaderboardTracks([
    ...seedTracks,
    ...nextIssueTracks.values(),
  ]);

  const changed = JSON.stringify(currentTracks) !== JSON.stringify(combinedTracks);
  const nextData = {
    version: 2,
    name: currentData?.name || 'SYNTHBOARD Community Leaderboard',
    updatedAt: changed ? new Date().toISOString() : (currentData?.updatedAt || new Date().toISOString()),
    repo: currentData?.repo || 'Terclean/SYNTHBOARD',
    tracks: combinedTracks,
  };

  return { changed, nextData };
}

async function fetchAllRepoIssues(repo, token) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'SYNTHBOARD-Community-Leaderboard-Sync',
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const all = [];
  for (let page = 1; page <= 5; page++) {
    const url = `https://api.github.com/repos/${repo}/issues?labels=${encodeURIComponent(SUBMISSION_LABEL)}&state=all&per_page=100&page=${page}`;
    const res = await fetch(url, { headers });
    if (!res.ok) {
      throw new Error(`GitHub API Fehler ${res.status}: ${await res.text()}`);
    }
    const batch = await res.json();
    if (!Array.isArray(batch) || batch.length === 0) break;
    all.push(...batch);
    if (batch.length < 100) break;
  }
  return all;
}

async function main() {
  const indexPath = path.resolve(process.cwd(), 'public/community/index.json');
  const currentData = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  const repo = process.env.REPO || currentData.repo || 'Terclean/SYNTHBOARD';
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || '';

  const fetchText = async (url) => {
    const headers = { 'User-Agent': 'SYNTHBOARD-Community-Leaderboard-Sync' };
    if (token && /^https:\/\/(api\.github\.com|github\.com)\//i.test(url)) {
      headers.Authorization = `Bearer ${token}`;
    }
    const res = await fetch(url, { headers, redirect: 'follow' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.text();
  };

  const issues = await fetchAllRepoIssues(repo, token);
  const { changed, nextData } = await syncLeaderboardData({ currentData, issues, fetchText });

  if (changed) {
    fs.writeFileSync(indexPath, `${JSON.stringify(nextData, null, 2)}\n`, 'utf8');
    console.log(`[Community Sync] public/community/index.json aktualisiert (${nextData.tracks.length} Tracks).`);
  } else {
    console.log('[Community Sync] Keine Datenänderung – index.json und updatedAt bleiben unverändert.');
  }

  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `changed=${changed ? 'true' : 'false'}\n`, 'utf8');
  }
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isDirectRun) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
