// SYNTHBOARD – Schlichtes Profil & Cloud-Racks Modal (Öffentlich/Privat + 30s Audio-Teaser)
import { t, onLangChange } from './i18n.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

function resizeAvatarFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const size = 140;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        const minSide = Math.min(img.width, img.height);
        const sx = (img.width - minSide) / 2;
        const sy = (img.height - minSide) / 2;
        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = () => reject(new Error('Bild konnte nicht geladen werden'));
      img.src = reader.result;
    };
    reader.onerror = () => reject(new Error('Datei konnte nicht gelesen werden'));
    reader.readAsDataURL(file);
  });
}

export class ProfileModal {
  constructor({ store, engine, getCurrentState, onOpenRackState, onToast, onStartAudio, onProfileUpdated } = {}) {
    this.store = store;
    this.engine = engine;
    this.getCurrentState = getCurrentState;
    this.onOpenRackState = onOpenRackState;
    this.onToast = onToast || (() => {});
    this.onStartAudio = onStartAudio || (() => {});
    this.onProfileUpdated = onProfileUpdated || (() => {});

    this.activeTab = 'public'; // 'public' | 'mine' | 'profile'
    this.tagFilter = '';
    this.pendingTeaserBlob = null;
    this.pendingTeaserMime = '';
    this.pendingTeaserUrl = null;
    this.activeAudioUrls = [];
    this.teaserRecorder = null;
    this.teaserTimer = null;
    this.teaserSec = 0;

    this.el = null;
    this.createModal();
    onLangChange(() => {
      if (this.el && !this.el.classList.contains('hidden')) {
        this.render();
      }
    });
  }

  createModal() {
    const modal = document.createElement('div');
    modal.id = 'profile-modal';
    modal.className = 'profile-modal hidden';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-label', 'SYNTHBOARD Profil & Racks');
    document.body.appendChild(modal);
    this.el = modal;

    modal.addEventListener('click', (e) => {
      if (e.target === modal) this.close();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.el && !this.el.classList.contains('hidden')) {
        this.close();
      }
    });
  }

  async open(tab = null) {
    if (tab) this.activeTab = tab;
    this.el?.classList.remove('hidden');
    await this.render();
  }

  close() {
    this.stopTeaserRecording();
    this.el?.classList.add('hidden');
    this.revokeListAudioUrls();
  }

  revokeListAudioUrls() {
    this.activeAudioUrls.forEach((u) => { try { URL.revokeObjectURL(u); } catch { /* ignore */ } });
    this.activeAudioUrls = [];
  }

  async render() {
    if (!this.el) return;
    this.revokeListAudioUrls();

    const profile = (await this.store.getProfile()) || { name: 'Synth Artist', email: '', bio: '', avatarDataUrl: '' };
    const allRacks = await this.store.listAllRacks();
    const publicRacks = await this.store.listPublicRacks(this.tagFilter);

    const userIconSvg = (size = 18) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
    const avatarHtml = profile.avatarDataUrl
      ? `<img src="${esc(profile.avatarDataUrl)}" alt="Avatar" class="prof-avatar-img" />`
      : `<span class="prof-avatar-fallback">${userIconSvg(26)}</span>`;

    const renderRackCard = (rack, isMine = false) => {
      let audioHtml = `<div class="prof-no-teaser">${esc(t('Kein 30s-Teaser angehängt', 'No 30s teaser attached'))}</div>`;
      if (rack.teaserBlob instanceof Blob) {
        const url = URL.createObjectURL(rack.teaserBlob);
        this.activeAudioUrls.push(url);
        audioHtml = `<audio class="prof-audio-player" controls preload="metadata" src="${url}"></audio>`;
      }
      const tagsHtml = (rack.tags || []).map((tg) => `<span class="prof-tag">#${esc(tg)}</span>`).join('');
      const visLabel = rack.visibility === 'public' ? t('Öffentlich', 'Public') : t('Privat', 'Private');

      return `
        <article class="prof-rack-card">
          <div class="prof-rack-main">
            <div class="prof-rack-top">
              <div class="prof-rack-author">
                ${rack.authorAvatar ? `<img src="${esc(rack.authorAvatar)}" alt="" class="prof-mini-avatar"/>` : `<span class="prof-mini-avatar-fb">${userIconSvg(14)}</span>`}
                <div>
                  <h4 class="prof-rack-title">${esc(rack.name)}</h4>
                  <span class="prof-rack-by">${esc(rack.authorName || 'Synth Artist')}</span>
                </div>
              </div>
              <span class="prof-vis-badge ${rack.visibility === 'public' ? 'is-public' : 'is-private'}">${esc(visLabel)}</span>
            </div>
            ${rack.description ? `<p class="prof-rack-desc">${esc(rack.description)}</p>` : ''}
            ${tagsHtml ? `<div class="prof-tags-row">${tagsHtml}</div>` : ''}
          </div>
          <div class="prof-rack-side">
            <div class="prof-teaser-box">
              <span class="prof-teaser-lbl">${esc(t('30s Audio-Teaser', '30s Audio Teaser'))}</span>
              ${audioHtml}
            </div>
            <div class="prof-rack-actions">
              <button type="button" class="prof-btn-open" data-open-rack="${esc(rack.id)}">▶ ${esc(t('Im Studio öffnen', 'Open in Studio'))}</button>
              ${isMine ? `
                <button type="button" class="prof-btn-sec" data-toggle-vis="${esc(rack.id)}">${rack.visibility === 'public' ? esc(t('Auf Privat', 'Make Private')) : esc(t('Veröffentlichen', 'Publish'))}</button>
                <button type="button" class="prof-btn-del" data-del-rack="${esc(rack.id)}" title="${esc(t('Löschen', 'Delete'))}">✕</button>
              ` : ''}
            </div>
          </div>
        </article>
      `;
    };

    let bodyHtml = '';
    if (this.activeTab === 'public') {
      bodyHtml = `
        <div class="prof-search-bar">
          <input type="text" id="prof-tag-filter" class="prof-input" value="${esc(this.tagFilter)}" placeholder="${esc(t('Nach Tag, Name oder Text filtern…', 'Filter by tag, name or description…'))}" />
        </div>
        <div class="prof-rack-list">
          ${publicRacks.length
            ? publicRacks.map((r) => renderRackCard(r, false)).join('')
            : `<div class="prof-empty">${esc(t('Noch keine öffentlichen Racks vorhanden. Speichere unter „Meine Racks“ ein Rack als Öffentlich!', 'No public racks yet. Publish one under "My Racks"!'))}</div>`}
        </div>
      `;
    } else if (this.activeTab === 'mine') {
      const teaserPreview = this.pendingTeaserUrl
        ? `<audio class="prof-audio-player" controls src="${this.pendingTeaserUrl}"></audio>`
        : `<span class="prof-teaser-hint">${esc(t('Optional: 30s direkt aufnehmen oder .mp3 / .webm wählen', 'Optional: record 30s directly or choose .mp3 / .webm'))}</span>`;

      bodyHtml = `
        <form id="prof-save-rack-form" class="prof-publish-box">
          <h3>${esc(t('Aktuelles Rack speichern / veröffentlichen', 'Save / Publish Current Rack'))}</h3>
          <div class="prof-form-grid">
            <label class="prof-field">
              <span>${esc(t('Rack-Name', 'Rack Name'))}</span>
              <input type="text" id="prof-rack-name" class="prof-input" required maxlength="100" placeholder="${esc(t('z. B. Midnight Felt Arp', 'e.g. Midnight Felt Arp'))}" />
            </label>
            <label class="prof-field">
              <span>${esc(t('Tags (kommagetrennt)', 'Tags (comma-separated)'))}</span>
              <input type="text" id="prof-rack-tags" class="prof-input" maxlength="120" placeholder="ambient, piano, drone" />
            </label>
            <label class="prof-field prof-field-full">
              <span>${esc(t('Kurzer Text / Beschreibung', 'Short Description'))}</span>
              <input type="text" id="prof-rack-desc" class="prof-input" maxlength="300" placeholder="${esc(t('Wie klingt der Patch? Welche Regler lohnen sich?', 'How does it sound? Which knobs should be tweaked?'))}" />
            </label>
          </div>
          <div class="prof-teaser-row">
            <div class="prof-teaser-controls">
              <button type="button" id="prof-rec-teaser" class="prof-btn-rec ${this.teaserRecorder ? 'is-rec' : ''}">
                ${this.teaserRecorder ? `■ ${esc(t('Stopp', 'Stop'))} (${this.teaserSec}s / 30s)` : `● ${esc(t('30s Teaser aufnehmen', 'Record 30s Teaser'))}`}
              </button>
              <label class="prof-btn-sec prof-file-lbl">
                ${esc(t('MP3 / WebM wählen', 'Choose MP3 / WebM'))}
                <input type="file" id="prof-teaser-file" accept=".mp3,.webm,audio/mpeg,audio/webm" hidden />
              </label>
              <select id="prof-rack-vis" class="prof-select">
                <option value="private">${esc(t('Privat (nur für mich)', 'Private (only me)'))}</option>
                <option value="public">${esc(t('Öffentlich (Community)', 'Public (Community)'))}</option>
              </select>
              <button type="submit" class="prof-btn-primary">${esc(t('Rack speichern', 'Save Rack'))}</button>
            </div>
            <div class="prof-teaser-preview">${teaserPreview}</div>
          </div>
        </form>

        <h3 class="prof-subhead">${esc(t('Meine gespeicherten Racks', 'My Saved Racks'))} (${allRacks.length})</h3>
        <div class="prof-rack-list">
          ${allRacks.length
            ? allRacks.map((r) => renderRackCard(r, true)).join('')
            : `<div class="prof-empty">${esc(t('Noch keine Racks gespeichert.', 'No saved racks yet.'))}</div>`}
        </div>
      `;
    } else {
      bodyHtml = `
        <form id="prof-edit-form" class="prof-profile-form">
          <div class="prof-avatar-editor">
            <div class="prof-avatar-big">${avatarHtml}</div>
            <label class="prof-btn-sec prof-file-lbl">
              ${esc(t('Profilbild wählen', 'Choose Avatar'))}
              <input type="file" id="prof-avatar-input" accept="image/*" hidden />
            </label>
          </div>
          <label class="prof-field">
            <span>${esc(t('Name', 'Name'))}</span>
            <input type="text" id="prof-user-name" class="prof-input" maxlength="60" value="${esc(profile.name || '')}" required />
          </label>
          <label class="prof-field">
            <span>${esc(t('E-Mail', 'Email'))}</span>
            <input type="email" id="prof-user-email" class="prof-input" maxlength="120" value="${esc(profile.email || '')}" placeholder="artist@example.com" />
          </label>
          <label class="prof-field">
            <span>${esc(t('Bio', 'Bio'))}</span>
            <textarea id="prof-user-bio" class="prof-textarea" maxlength="280" rows="3" placeholder="${esc(t('Kurze Info über dich und deinen Sound…', 'Short bio about you and your sound…'))}">${esc(profile.bio || '')}</textarea>
          </label>
          <div class="prof-form-foot">
            <span class="prof-db-note">${esc(t('Hinweis: Lokal im Browser gespeichert (IndexedDB) – bereit für den Anschluss einer Cloud-Datenbank.', 'Note: Stored locally in your browser (IndexedDB) – ready for cloud database integration.'))}</span>
            <button type="submit" class="prof-btn-primary">${esc(t('Profil speichern', 'Save Profile'))}</button>
          </div>
        </form>
      `;
    }

    this.el.innerHTML = `
      <div class="prof-dialog">
        <header class="prof-header">
          <div class="prof-header-left">
            <div class="prof-avatar-sm">${avatarHtml}</div>
            <div>
              <h2>${esc(profile.name || 'Synth Artist')}</h2>
              <span class="prof-header-sub">${esc(t('Schlichtes Profil & Cloud-Racks', 'Simple Profile & Cloud Racks'))}</span>
            </div>
          </div>
          <nav class="prof-tabs" role="tablist">
            <button type="button" class="prof-tab ${this.activeTab === 'public' ? 'active' : ''}" data-tab="public">${esc(t('Öffentlich', 'Public'))} (${publicRacks.length})</button>
            <button type="button" class="prof-tab ${this.activeTab === 'mine' ? 'active' : ''}" data-tab="mine">${esc(t('Meine Racks', 'My Racks'))} (${allRacks.length})</button>
            <button type="button" class="prof-tab ${this.activeTab === 'profile' ? 'active' : ''}" data-tab="profile">${esc(t('Profil', 'Profile'))}</button>
          </nav>
          <button type="button" id="prof-close-btn" class="prof-close-btn" title="${esc(t('Schließen [Esc]', 'Close [Esc]'))}">✕</button>
        </header>
        <div class="prof-body">${bodyHtml}</div>
      </div>
    `;

    this.bindEvents(allRacks);
  }

  bindEvents(allRacks) {
    this.el.querySelector('#prof-close-btn')?.addEventListener('click', () => this.close());
    this.el.querySelectorAll('.prof-tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.activeTab = btn.dataset.tab;
        this.render();
      });
    });

    this.el.querySelector('#prof-tag-filter')?.addEventListener('input', (e) => {
      this.tagFilter = e.target.value;
      clearTimeout(this._filterTimer);
      this._filterTimer = setTimeout(() => this.render(), 140);
    });

    // Rack im Studio öffnen
    this.el.querySelectorAll('[data-open-rack]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const rack = allRacks.find((r) => r.id === btn.dataset.openRack);
        if (!rack) return;
        this.onStartAudio?.();
        this.onOpenRackState?.(structuredClone(rack.state), rack.name);
        this.close();
        this.onToast(`${t('Rack geöffnet', 'Rack opened')}: „${rack.name}“`);
      });
    });

    // Sichtbarkeit wechseln
    this.el.querySelectorAll('[data-toggle-vis]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        await this.store.toggleVisibility(btn.dataset.toggleVis);
        await this.render();
      });
    });

    // Rack löschen
    this.el.querySelectorAll('[data-del-rack]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        await this.store.deleteRack(btn.dataset.delRack);
        this.onToast(t('Rack gelöscht', 'Rack deleted'));
        await this.render();
      });
    });

    // 30s Teaser-Datei wählen
    this.el.querySelector('#prof-teaser-file')?.addEventListener('change', (e) => {
      const f = e.target.files?.[0];
      if (!f) return;
      if (f.size > 10 * 1024 * 1024) {
        this.onToast(t('Audio-Teaser maximal 10 MB groß', 'Audio teaser max 10 MB'));
        return;
      }
      if (this.pendingTeaserUrl) URL.revokeObjectURL(this.pendingTeaserUrl);
      this.pendingTeaserBlob = f;
      this.pendingTeaserMime = f.type || 'audio/mpeg';
      this.pendingTeaserUrl = URL.createObjectURL(f);
      this.render();
    });

    // 30s Teaser direkt aufnehmen
    this.el.querySelector('#prof-rec-teaser')?.addEventListener('click', async () => {
      if (this.teaserRecorder) {
        this.stopTeaserRecording();
        return;
      }
      await this.startTeaserRecording();
    });

    // Rack speichern
    this.el.querySelector('#prof-save-rack-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = this.el.querySelector('#prof-rack-name')?.value || '';
      const tags = this.el.querySelector('#prof-rack-tags')?.value || '';
      const description = this.el.querySelector('#prof-rack-desc')?.value || '';
      const visibility = this.el.querySelector('#prof-rack-vis')?.value || 'private';
      const state = this.getCurrentState ? this.getCurrentState() : null;
      if (!state) return;

      await this.store.saveRack({
        name,
        description,
        tags,
        visibility,
        state,
        teaserBlob: this.pendingTeaserBlob,
        teaserMime: this.pendingTeaserMime,
      });

      if (this.pendingTeaserUrl) URL.revokeObjectURL(this.pendingTeaserUrl);
      this.pendingTeaserBlob = null;
      this.pendingTeaserMime = '';
      this.pendingTeaserUrl = null;
      this.onToast(visibility === 'public' ? t('Rack öffentlich gespeichert!', 'Rack published!') : t('Rack privat gespeichert!', 'Rack saved privately!'));
      await this.render();
    });

    // Profilbild wählen
    this.el.querySelector('#prof-avatar-input')?.addEventListener('change', async (e) => {
      const f = e.target.files?.[0];
      if (!f) return;
      try {
        const dataUrl = await resizeAvatarFile(f);
        const cur = (await this.store.getProfile()) || {};
        const updated = await this.store.saveProfile({ ...cur, avatarDataUrl: dataUrl });
        this.onProfileUpdated(updated);
        await this.render();
      } catch (err) {
        this.onToast(err.message);
      }
    });

    // Profil speichern
    this.el.querySelector('#prof-edit-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = this.el.querySelector('#prof-user-name')?.value || 'Synth Artist';
      const email = this.el.querySelector('#prof-user-email')?.value || '';
      const bio = this.el.querySelector('#prof-user-bio')?.value || '';
      const updated = await this.store.saveProfile({ name, email, bio });
      this.onProfileUpdated(updated);
      this.onToast(t('Profil gespeichert', 'Profile saved'));
      await this.render();
    });
  }

  async startTeaserRecording() {
    if (!this.engine?.limiter || !this.engine?.ctx) return;
    await this.onStartAudio?.();
    const dest = this.engine.ctx.createMediaStreamDestination();
    this.engine.limiter.connect(dest);
    const chunks = [];
    const rec = new MediaRecorder(dest.stream);
    this.teaserRecorder = rec;
    this.teaserSec = 0;

    rec.ondataavailable = (ev) => ev.data.size && chunks.push(ev.data);
    rec.onstop = () => {
      try { this.engine.limiter.disconnect(dest); } catch { /* ignore */ }
      clearInterval(this.teaserTimer);
      this.teaserTimer = null;
      this.teaserRecorder = null;
      const mime = rec.mimeType || 'audio/webm';
      const blob = new Blob(chunks, { type: mime });
      if (this.pendingTeaserUrl) URL.revokeObjectURL(this.pendingTeaserUrl);
      this.pendingTeaserBlob = blob;
      this.pendingTeaserMime = mime;
      this.pendingTeaserUrl = URL.createObjectURL(blob);
      this.onToast(t('30s Teaser bereit!', '30s teaser ready!'));
      this.render();
    };

    rec.start();
    this.render();

    this.teaserTimer = setInterval(() => {
      this.teaserSec++;
      const btn = this.el?.querySelector('#prof-rec-teaser');
      if (btn) btn.textContent = `■ ${t('Stopp', 'Stop')} (${this.teaserSec}s / 30s)`;
      if (this.teaserSec >= 30) {
        this.stopTeaserRecording();
      }
    }, 1000);
  }

  stopTeaserRecording() {
    clearInterval(this.teaserTimer);
    this.teaserTimer = null;
    if (this.teaserRecorder && this.teaserRecorder.state !== 'inactive') {
      try { this.teaserRecorder.stop(); } catch { /* ignore */ }
    }
    this.teaserRecorder = null;
  }
}
