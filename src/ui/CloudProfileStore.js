// SYNTHBOARD – Schlichter Profil- & Cloud-Rack-Store (IndexedDB-Adapter, bereit für späteres Backend)
const DB_NAME = 'synthboard_cloud_v1';
const DB_VERSION = 1;
const STORE_PROFILE = 'profile';
const STORE_RACKS = 'racks';
const LS_PROFILE_FALLBACK = 'synthboard:profile_v1';

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB nicht verfügbar'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_PROFILE)) {
        db.createObjectStore(STORE_PROFILE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_RACKS)) {
        db.createObjectStore(STORE_RACKS, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function cleanText(raw, maxLen = 120) {
  return String(raw ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .slice(0, maxLen);
}

export function normalizeTags(raw) {
  const arr = Array.isArray(raw) ? raw : String(raw ?? '').split(',');
  const out = [];
  const seen = new Set();
  for (const item of arr) {
    const tag = cleanText(item, 24).toLowerCase().replace(/^#+/, '');
    if (tag && !seen.has(tag)) {
      seen.add(tag);
      out.push(tag);
      if (out.length >= 6) break;
    }
  }
  return out;
}

export class CloudProfileStore {
  async getProfile() {
    try {
      const db = await openDb();
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_PROFILE, 'readonly');
        const req = tx.objectStore(STORE_PROFILE).get('me');
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    } catch {
      try {
        return JSON.parse(localStorage.getItem(LS_PROFILE_FALLBACK)) || null;
      } catch {
        return null;
      }
    }
  }

  async saveProfile({ name, email, bio, avatarDataUrl } = {}) {
    const existing = (await this.getProfile()) || {};
    const profile = {
      id: 'me',
      name: cleanText(name, 60) || 'Synth Artist',
      email: cleanText(email, 120),
      bio: cleanText(bio, 280),
      avatarDataUrl: typeof avatarDataUrl === 'string' && avatarDataUrl.startsWith('data:image/')
        ? avatarDataUrl
        : (existing.avatarDataUrl || ''),
      updatedAt: Date.now(),
    };
    try {
      const db = await openDb();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_PROFILE, 'readwrite');
        tx.objectStore(STORE_PROFILE).put(profile);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch {
      try { localStorage.setItem(LS_PROFILE_FALLBACK, JSON.stringify(profile)); } catch { /* ignore */ }
    }
    return profile;
  }

  async listAllRacks() {
    try {
      const db = await openDb();
      const rows = await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_RACKS, 'readonly');
        const req = tx.objectStore(STORE_RACKS).getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
      return rows.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    } catch {
      return [];
    }
  }

  async listPublicRacks(tagFilter = '') {
    const all = await this.listAllRacks();
    const pub = all.filter((r) => r.visibility === 'public');
    const q = cleanText(tagFilter, 32).toLowerCase();
    if (!q) return pub;
    return pub.filter((r) =>
      r.name.toLowerCase().includes(q)
      || (r.description || '').toLowerCase().includes(q)
      || (r.tags || []).some((tg) => tg.includes(q))
    );
  }

  async saveRack({ id, name, description, tags, visibility, state, teaserBlob, teaserMime } = {}) {
    const profile = (await this.getProfile()) || { name: 'Synth Artist', avatarDataUrl: '' };
    const all = await this.listAllRacks();
    const existing = id ? all.find((r) => r.id === id) : null;
    const now = Date.now();
    const rack = {
      id: existing?.id || `rack_${now}_${Math.random().toString(36).slice(2, 7)}`,
      name: cleanText(name, 100) || 'Unbenanntes Rack',
      description: cleanText(description, 300),
      tags: normalizeTags(tags),
      visibility: visibility === 'public' ? 'public' : 'private',
      state: structuredClone(state),
      teaserBlob: teaserBlob instanceof Blob ? teaserBlob : (existing?.teaserBlob || null),
      teaserMime: teaserMime || existing?.teaserMime || '',
      authorName: profile.name || 'Synth Artist',
      authorAvatar: profile.avatarDataUrl || '',
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_RACKS, 'readwrite');
      tx.objectStore(STORE_RACKS).put(rack);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    return rack;
  }

  async toggleVisibility(id) {
    const all = await this.listAllRacks();
    const rack = all.find((r) => r.id === id);
    if (!rack) return null;
    rack.visibility = rack.visibility === 'public' ? 'private' : 'public';
    rack.updatedAt = Date.now();
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_RACKS, 'readwrite');
      tx.objectStore(STORE_RACKS).put(rack);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    return rack;
  }

  async deleteRack(id) {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_RACKS, 'readwrite');
      tx.objectStore(STORE_RACKS).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}
