// SYNTHBOARD – Open-Source Community Leaderboard, Auto-Tagging & Share-Links (ohne zentrale Datenbank)
import { t, onLangChange } from './i18n.js';
import { autoTagRack, normalizeTags, encodePatchToHash } from './communityUtils.js';
import { TEMPLATES } from '../modules/index.js';

const REPO_SLUG = 'Terclean/SYNTHBOARD';

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const ICON_TROPHY = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>';
const ICON_PLAY = '<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true"><polygon points="6 3 20 12 6 21 6 3"/></svg>';
const ICON_LINK = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>';
const ICON_TAG = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z"/><path d="M7 7h.01"/></svg>';

export class CommunityModal {
  constructor({ engine, getCurrentState, getSavedBoards, onOpenRackState, onToast, onStartAudio }) {
    this.engine = engine;
    this.getCurrentState = getCurrentState;
    this.getSavedBoards = getSavedBoards || (() => ({}));
    this.onOpenRackState = onOpenRackState;
    this.onToast = onToast || (() => {});
    this.onStartAudio = onStartAudio || (() => {});

    this.el = null;
    this.isOpen = false;
    this.activeTab = 'leaderboard'; // 'leaderboard' | 'publish'
    this.sortBy = 'votes'; // 'votes' | 'newest'
    this.tagFilter = '';
    this.selectedSourceKey = ''; // '' = current studio rack, otherwise saved board key
    this.tracks = [];
    this.loading = false;

    this.pendingTeaserBlob = null;
    this.pendingTeaserUrl = '';
    this.recorder = null;
    this.recordTimer = null;
    this.recordSeconds = 0;

    onLangChange(() => {
      if (this.isOpen) this.render();
    });
  }

  ensureDom() {
    if (this.el) return;
    this.el = document.createElement('div');
    this.el.id = 'community-modal';
    this.el.className = 'comm-modal hidden';
    document.body.appendChild(this.el);

    this.el.addEventListener('click', (e) => {
      if (e.target === this.el) this.close();
    });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) this.close();
    });
  }

  async open(tab = 'leaderboard') {
    this.ensureDom();
    this.activeTab = tab;
    this.isOpen = true;
    this.el.classList.remove('hidden');
    await this.loadTracks();
    this.render();
  }

  close() {
    this.stopRecording();
    if (!this.el) return;
    this.isOpen = false;
    this.el.classList.add('hidden');
  }

  async loadTracks() {
    this.loading = true;
    try {
      const res = await fetch(`./community/index.json?v=${Math.floor(Date.now() / 60000)}`);
      if (res.ok) {
        const data = await res.json();
        this.tracks = Array.isArray(data?.tracks) ? data.tracks : [];
      }
    } catch {
      this.tracks = [];
    } finally {
      this.loading = false;
    }
  }

  resolveTrackState(track) {
    if (track?.state) return structuredClone(track.state);
    if (track?.templateKey && TEMPLATES[track.templateKey]?.state) {
      return structuredClone(TEMPLATES[track.templateKey].state);
    }
    return null;
  }

  getFilteredTracks() {
    const q = this.tagFilter.trim().toLowerCase();
    const list = this.tracks.filter((tr) => {
      if (!q) return true;
      return (tr.name || '').toLowerCase().includes(q)
        || (tr.author || '').toLowerCase().includes(q)
        || (tr.description || '').toLowerCase().includes(q)
        || (tr.tags || []).some((tg) => tg.toLowerCase().includes(q));
    });
    if (this.sortBy === 'newest') {
      return list.sort((a, b) => Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0));
    }
    return list.sort((a, b) => (Number(b.votes) || 0) - (Number(a.votes) || 0));
  }

  stopRecording() {
    if (this.recordTimer) {
      clearInterval(this.recordTimer);
      this.recordTimer = null;
    }
    if (this.recorder && this.recorder.state === 'recording') {
      try { this.recorder.stop(); } catch { /* ignore */ }
    }
    this.recorder = null;
  }

  startRecording30s() {
    if (!this.engine?.ctx || !this.engine?.limiter || typeof MediaRecorder === 'undefined') {
      this.onToast(t('Audio-Aufnahme im Browser nicht verfügbar.', 'Browser audio recording unavailable.'));
      return;
    }
    this.onStartAudio?.();
    const dest = this.engine.ctx.createMediaStreamDestination();
    this.engine.limiter.connect(dest);
    const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm';
    const chunks = [];
    const rec = new MediaRecorder(dest.stream, { mimeType: mime });
    this.recorder = rec;
    this.recordSeconds = 0;

    rec.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) chunks.push(ev.data);
    };
    rec.onstop = () => {
      try { this.engine.limiter.disconnect(dest); } catch { /* ignore */ }
      if (this.pendingTeaserUrl) URL.revokeObjectURL(this.pendingTeaserUrl);
      this.pendingTeaserBlob = new Blob(chunks, { type: mime });
      this.pendingTeaserUrl = URL.createObjectURL(this.pendingTeaserBlob);
      this.render();
    };

    rec.start(250);
    this.recordTimer = setInterval(() => {
      this.recordSeconds++;
      const lbl = this.el?.querySelector('#comm-rec-status');
      if (lbl) lbl.textContent = `${this.recordSeconds}s / 30s`;
      if (this.recordSeconds >= 30) this.stopRecording();
    }, 1000);
    this.render();
  }

  getSelectedPublishState() {
    if (this.selectedSourceKey) {
      const boards = this.getSavedBoards?.() || {};
      if (boards[this.selectedSourceKey]) return boards[this.selectedSourceKey];
    }
    return this.getCurrentState?.() || {};
  }

  render() {
    if (!this.el) return;
    const filtered = this.getFilteredTracks();
    const savedBoards = this.getSavedBoards?.() || {};
    const savedKeys = Object.keys(savedBoards).sort((a, b) => a.localeCompare(b));
    if (this.selectedSourceKey && !savedBoards[this.selectedSourceKey]) {
      this.selectedSourceKey = '';
    }
    const publishState = this.getSelectedPublishState();
    const suggestedTags = autoTagRack(publishState).join(', ');

    let bodyHtml = '';
    if (this.activeTab === 'leaderboard') {
      const cardsHtml = filtered.length
        ? filtered.map((tr, idx) => {
            const rank = idx + 1;
            const tagsHtml = (tr.tags || []).map((tg) => `<button type="button" class="comm-tag" data-filter-tag="${esc(tg)}">#${esc(tg)}</button>`).join('');
            const audioHtml = tr.teaserUrl
              ? `<audio class="comm-audio" controls preload="metadata" src="${esc(tr.teaserUrl)}"></audio>`
              : `<div class="comm-live-hint">${esc(t('Direkt im Browser-Synth anhören', 'Listen live in browser synth'))}</div>`;

            return `
              <article class="comm-card">
                <div class="comm-rank ${rank <= 3 ? `is-top-${rank}` : ''}">#${rank}</div>
                <div class="comm-card-main">
                  <div class="comm-card-top">
                    <div>
                      <h4 class="comm-title">${esc(tr.name)}</h4>
                      <span class="comm-author">${esc(t('von', 'by'))} ${esc(tr.author || 'Community')}</span>
                    </div>
                    <a class="comm-vote-btn" href="${esc(tr.issueUrl || `https://github.com/${REPO_SLUG}/discussions`)}" target="_blank" rel="noopener noreferrer" title="${esc(t('Auf GitHub mit 👍 abstimmen', 'Vote with 👍 on GitHub'))}">
                      ▲ ${Number(tr.votes) || 0}
                    </a>
                  </div>
                  ${tr.description ? `<p class="comm-desc">${esc(tr.description)}</p>` : ''}
                  ${tagsHtml ? `<div class="comm-tags">${tagsHtml}</div>` : ''}
                </div>
                <div class="comm-card-side">
                  ${audioHtml}
                  <div class="comm-card-actions">
                    <button type="button" class="comm-btn-open" data-open-track="${esc(tr.id)}">${ICON_PLAY} <span>${esc(t('Im Studio öffnen', 'Open in Studio'))}</span></button>
                    <button type="button" class="comm-btn-sec" data-share-track="${esc(tr.id)}" title="${esc(t('Share-Link kopieren', 'Copy Share Link'))}">${ICON_LINK}</button>
                  </div>
                </div>
              </article>
            `;
          }).join('')
        : `<div class="comm-empty">${esc(t('Keine Tracks gefunden.', 'No tracks found.'))}</div>`;

      bodyHtml = `
        <div class="comm-toolbar">
          <input type="search" id="comm-search" class="comm-input" value="${esc(this.tagFilter)}" placeholder="${esc(t('Nach Tag, Titel oder Autor filtern…', 'Filter by tag, title or author…'))}" />
          <div class="comm-sort-group">
            <button type="button" class="comm-sort-btn ${this.sortBy === 'votes' ? 'active' : ''}" data-sort="votes">${esc(t('Top Voted', 'Top Voted'))}</button>
            <button type="button" class="comm-sort-btn ${this.sortBy === 'newest' ? 'active' : ''}" data-sort="newest">${esc(t('Neueste', 'Newest'))}</button>
          </div>
        </div>
        <div class="comm-list">${cardsHtml}</div>
      `;
    } else {
      const isRec = this.recorder?.state === 'recording';
      const sourceOptions = [
        `<option value="">${esc(t('Aktuelles Studio-Rack', 'Current Studio Rack'))}</option>`,
        ...savedKeys.map((k) => `<option value="${esc(k)}" ${this.selectedSourceKey === k ? 'selected' : ''}>${esc(t('Gespeichert', 'Saved'))}: ${esc(k)}</option>`),
      ].join('');
      const defaultName = this.selectedSourceKey || '';
      bodyHtml = `
        <form id="comm-publish-form" class="comm-publish-form">
          <label class="comm-field">
            <span>${esc(t('Welches Rack möchtest du teilen?', 'Which rack do you want to share?'))}</span>
            <select id="comm-rack-source" class="comm-input">${sourceOptions}</select>
          </label>
          <div class="comm-grid">
            <label class="comm-field">
              <span>${esc(t('Rack-Name *', 'Rack Name *'))}</span>
              <input type="text" id="comm-pub-name" class="comm-input" maxlength="80" required value="${esc(defaultName)}" placeholder="e.g. Velvet Shimmer" />
            </label>
            <label class="comm-field">
              <span>${esc(t('Autor / Handle', 'Author / Handle'))}</span>
              <input type="text" id="comm-pub-author" class="comm-input" maxlength="40" placeholder="e.g. @synthartist" />
            </label>
          </div>
          <label class="comm-field">
            <span>${esc(t('Beschreibung zu deinem Rack', 'Write something about your rack'))}</span>
            <textarea id="comm-pub-desc" class="comm-textarea" rows="3" maxlength="280" placeholder="${esc(t('Wie klingt es, wie spielt man es, welche Inspiration steckt dahinter?', 'How does it sound, how to play it, what inspired it?'))}"></textarea>
          </label>
          <div class="comm-field">
            <div class="comm-tag-head">
              <span>${esc(t('Automatische Tags (editierbar, max. 6)', 'Auto-generated Tags (editable, max 6)'))}</span>
              <button type="button" id="comm-refresh-tags" class="comm-btn-mini">${ICON_TAG} ${esc(t('Auto-Tags neu erkennen', 'Detect Auto-Tags'))}</button>
            </div>
            <input type="text" id="comm-pub-tags" class="comm-input" value="${esc(suggestedTags)}" placeholder="ambient, piano, downtempo" />
          </div>
          <div class="comm-teaser-box">
            <span class="comm-field-lbl">${esc(t('Optional: 30s Audio-Teaser (.webm)', 'Optional: 30s Audio Teaser (.webm)'))}</span>
            <div class="comm-teaser-controls">
              ${isRec
                ? `<button type="button" id="comm-rec-stop" class="comm-btn-danger">${esc(t('Stopp', 'Stop'))} (<span id="comm-rec-status">${this.recordSeconds}s / 30s</span>)</button>`
                : `<button type="button" id="comm-rec-start" class="comm-btn-sec">${esc(t('30s aufnehmen', 'Record 30s'))}</button>`}
              ${this.pendingTeaserUrl ? `<audio class="comm-audio" controls src="${esc(this.pendingTeaserUrl)}"></audio>` : ''}
            </div>
          </div>
          <div class="comm-pub-actions">
            <button type="button" id="comm-copy-link" class="comm-btn-sec">${ICON_LINK} ${esc(t('Share-Link (#p=...) kopieren', 'Copy Share Link (#p=...)'))}</button>
            <button type="submit" class="comm-btn-primary">${esc(t('Für Open-Source-Leaderboard einreichen', 'Submit to Open-Source Leaderboard'))}</button>
          </div>
          <p class="comm-os-note">${esc(t('100% Open Source ohne zentrale Datenbank: Share-Links enthalten dein Rack direkt in der URL. Einreichungen öffnen ein vorausgefülltes GitHub-Formular für das öffentliche Leaderboard.', '100% open source with no central database: Share links embed your rack in the URL. Submissions open a pre-filled GitHub form for the public leaderboard.'))}</p>
        </form>
      `;
    }

    this.el.innerHTML = `
      <div class="comm-dialog">
        <header class="comm-header">
          <div class="comm-header-title">
            ${ICON_TROPHY}
            <div>
              <h2>${esc(t('Community & Top Tracks', 'Community & Top Tracks'))}</h2>
              <span class="comm-sub">${esc(t('Open-Source Rack-Leaderboard · Anhören & im Studio öffnen', 'Open-Source Rack Leaderboard · Listen & Open in Studio'))}</span>
            </div>
          </div>
          <nav class="comm-tabs">
            <button type="button" class="comm-tab ${this.activeTab === 'leaderboard' ? 'active' : ''}" data-tab="leaderboard">${esc(t('Leaderboard', 'Leaderboard'))} (${this.tracks.length})</button>
            <button type="button" class="comm-tab ${this.activeTab === 'publish' ? 'active' : ''}" data-tab="publish">${esc(t('Rack teilen', 'Share Rack'))}</button>
          </nav>
          <button type="button" id="comm-close-btn" class="comm-close-btn" title="${esc(t('Schließen [Esc]', 'Close [Esc]'))}">✕</button>
        </header>
        <div class="comm-body">${bodyHtml}</div>
      </div>
    `;

    this.bindEvents(filtered);
  }

  bindEvents(filtered) {
    this.el.querySelector('#comm-close-btn')?.addEventListener('click', () => this.close());
    this.el.querySelectorAll('.comm-tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.activeTab = btn.dataset.tab;
        this.render();
      });
    });

    this.el.querySelector('#comm-search')?.addEventListener('input', (e) => {
      this.tagFilter = e.target.value;
      clearTimeout(this._searchTimer);
      this._searchTimer = setTimeout(() => this.render(), 140);
    });

    this.el.querySelectorAll('.comm-sort-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.sortBy = btn.dataset.sort;
        this.render();
      });
    });

    this.el.querySelectorAll('[data-filter-tag]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.tagFilter = btn.dataset.filterTag;
        this.render();
      });
    });

    this.el.querySelectorAll('[data-open-track]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const track = filtered.find((tr) => tr.id === btn.dataset.openTrack);
        const state = this.resolveTrackState(track);
        if (!state) {
          this.onToast(t('Rack-Daten nicht verfügbar', 'Rack data unavailable'));
          return;
        }
        this.onStartAudio?.();
        this.onOpenRackState?.(state, track.name);
        this.close();
        this.onToast(`${t('Geladen', 'Loaded')}: ${track.name}`);
      });
    });

    this.el.querySelectorAll('[data-share-track]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const track = filtered.find((tr) => tr.id === btn.dataset.shareTrack);
        const state = this.resolveTrackState(track);
        if (!state) return;
        const payloadState = { ...state, version: 2, name: track.name };
        const hash = await encodePatchToHash({ version: 2, name: track.name, state: payloadState });
        const url = `${window.location.origin}${window.location.pathname}${hash}`;
        await navigator.clipboard?.writeText(url);
        this.onToast(t('Share-Link in Zwischenablage kopiert', 'Share link copied to clipboard'));
      });
    });

    this.el.querySelector('#comm-rack-source')?.addEventListener('change', (e) => {
      this.selectedSourceKey = e.target.value || '';
      this.render();
    });

    this.el.querySelector('#comm-refresh-tags')?.addEventListener('click', () => {
      const input = this.el.querySelector('#comm-pub-tags');
      if (input) input.value = autoTagRack(this.getSelectedPublishState()).join(', ');
    });

    this.el.querySelector('#comm-rec-start')?.addEventListener('click', () => this.startRecording30s());
    this.el.querySelector('#comm-rec-stop')?.addEventListener('click', () => this.stopRecording());

    this.el.querySelector('#comm-copy-link')?.addEventListener('click', async () => {
      const name = this.el.querySelector('#comm-pub-name')?.value?.trim() || 'SYNTHBOARD Patch';
      const rawState = this.getSelectedPublishState();
      const state = { ...rawState, version: 2, name };
      const hash = await encodePatchToHash({ version: 2, name, state });
      const url = `${window.location.origin}${window.location.pathname}${hash}`;
      await navigator.clipboard?.writeText(url);
      this.onToast(t('Share-Link in Zwischenablage kopiert', 'Share link copied to clipboard'));
    });

    this.el.querySelector('#comm-publish-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = this.el.querySelector('#comm-pub-name')?.value?.trim() || 'Untitled Rack';
      const author = this.el.querySelector('#comm-pub-author')?.value?.trim() || 'Community';
      const description = this.el.querySelector('#comm-pub-desc')?.value?.trim() || '';
      const tags = normalizeTags(this.el.querySelector('#comm-pub-tags')?.value || '');
      const rawState = this.getSelectedPublishState();
      const state = { ...rawState, version: 2, name };
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'rack';

      // 1. JSON-Paket herunterladen
      const bundle = { version: 2, name, author, description, tags, state };
      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${slug}.synthboard.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1500);

      // 2. Falls Teaser aufgenommen wurde, ebenfalls herunterladen
      if (this.pendingTeaserBlob) {
        const ta = document.createElement('a');
        ta.href = URL.createObjectURL(this.pendingTeaserBlob);
        ta.download = `${slug}-teaser.webm`;
        ta.click();
        setTimeout(() => URL.revokeObjectURL(ta.href), 1500);
      }

      // 3. Vorausgefülltes GitHub Issue öffnen
      const issueUrl = new URL(`https://github.com/${REPO_SLUG}/issues/new`);
      issueUrl.searchParams.set('template', 'community-rack.yml');
      issueUrl.searchParams.set('title', `[Rack] ${name}`);
      issueUrl.searchParams.set('rack-name', name);
      issueUrl.searchParams.set('author', author);
      issueUrl.searchParams.set('tags', tags.join(', '));
      issueUrl.searchParams.set('description', description);
      window.open(issueUrl.toString(), '_blank', 'noopener,noreferrer');
      this.onToast(t('JSON-Paket heruntergeladen & GitHub-Einreichung geöffnet', 'JSON bundle downloaded & GitHub submission opened'));
    });
  }
}
