// SYNTHBOARD – Modular Cable Patch & Signal Routing System

export const SIGNAL_COLORS = {
  gate: '#fbbf24',    // Gold / Amber (Trigger & Gate)
  pitch: '#a855f7',   // Neon Violet (Noten & Tonhöhe)
  mod: '#10b981',     // Emerald Mint (Modulation & LFO)
  clock: '#06b6d4',   // Electric Cyan (Clock & Sync)
  audio: '#60a5fa',   // Sky Blue (Audio)
};

export class PatchSystem {
  constructor(engine) {
    this.engine = engine;
    this.connections = new Map(); // id -> connection object
    this.onActivity = null; // Callback für optische LED-Pulse auf Jacks
    this.onConnectionsChanged = null;
  }

  static makeId(fromModuleId, fromPortId, toModuleId, toPortId) {
    return `${fromModuleId}:${fromPortId}->${toModuleId}:${toPortId}`;
  }

  connect(fromModuleId, fromPortId, toModuleId, toPortId, customColor = null, depth = 1) {
    if (fromModuleId === toModuleId && fromPortId === toPortId) return null;

    let fromMod = this.engine.find(fromModuleId) || this.engine.findByType?.(fromModuleId);
    let toMod = this.engine.find(toModuleId) || this.engine.findByType?.(toModuleId);
    if (!fromMod || !toMod) return null;

    const actualFromId = fromMod.id;
    const actualToId = toMod.id;

    // Ein Input-Jack kann typischerweise nur von einem Kabel gespeist werden (Eurorack-Standard)
    this.disconnectPort(actualToId, toPortId);

    const fromJack = fromMod.meta.jacks?.find(j => j.id === fromPortId);
    const toJack = toMod.meta.jacks?.find(j => j.id === toPortId);

    const signal = fromJack?.signal || toJack?.signal || 'gate';
    const color = customColor || SIGNAL_COLORS[signal] || '#a0aab2';

    const id = PatchSystem.makeId(actualFromId, fromPortId, actualToId, toPortId);
    const conn = {
      id,
      fromModuleId: actualFromId,
      fromPortId,
      toModuleId: actualToId,
      toPortId,
      signal,
      color,
      depth: Number.isFinite(depth) ? Math.max(0, Math.min(2, depth)) : 1, // Modulationsstärke pro Kabel
    };

    this.connections.set(id, conn);
    this.onConnectionsChanged?.();
    return conn;
  }

  disconnect(id) {
    if (this.connections.delete(id)) {
      this.onConnectionsChanged?.();
      return true;
    }
    return false;
  }

  disconnectPort(moduleId, portId) {
    let changed = false;
    for (const [id, c] of this.connections.entries()) {
      if ((c.toModuleId === moduleId && c.toPortId === portId) ||
          (c.fromModuleId === moduleId && c.fromPortId === portId)) {
        this.connections.delete(id);
        changed = true;
      }
    }
    if (changed) this.onConnectionsChanged?.();
  }

  disconnectModule(moduleId) {
    let changed = false;
    for (const [id, c] of this.connections.entries()) {
      if (c.fromModuleId === moduleId || c.toModuleId === moduleId) {
        this.connections.delete(id);
        changed = true;
      }
    }
    if (changed) this.onConnectionsChanged?.();
  }

  hasIncoming(toModuleId, toPortId) {
    for (const c of this.connections.values()) {
      if (c.toModuleId === toModuleId && c.toPortId === toPortId) return true;
    }
    return false;
  }

  getIncoming(toModuleId, toPortId) {
    for (const c of this.connections.values()) {
      if (c.toModuleId === toModuleId && c.toPortId === toPortId) return c;
    }
    return null;
  }

  getConnections() {
    return Array.from(this.connections.values());
  }

  // ── Signalweiterleitung in Audio-Echtzeit ──
  routeTrigger(fromModuleId, fromPortId, time, velocity = 1, duration = 0.1, meta = null) {
    for (const c of this.connections.values()) {
      if (c.fromModuleId === fromModuleId && c.fromPortId === fromPortId) {
        const target = this.engine.find(c.toModuleId);
        if (target && target.enabled) {
          const toJack = target.meta.jacks?.find((j) => j.id === c.toPortId);
          if (toJack?.signal === 'clock') {
            target.receiveClock(c.toPortId, time, 0);
          } else {
            target.receiveTrigger(c.toPortId, time, velocity, duration, meta);
          }
        }
        this.notifyActivity(c.fromModuleId, c.fromPortId, c.toModuleId, c.toPortId, time, 'gate');
      }
    }
  }

  routePitch(fromModuleId, fromPortId, time, midiNote, velocity = 1, duration = 0.1, meta = null) {
    for (const c of this.connections.values()) {
      if (c.fromModuleId === fromModuleId && c.fromPortId === fromPortId) {
        const target = this.engine.find(c.toModuleId);
        if (target && target.enabled) {
          target.receivePitch(c.toPortId, time, midiNote, velocity, duration, meta);
        }
        this.notifyActivity(c.fromModuleId, c.fromPortId, c.toModuleId, c.toPortId, time, 'pitch');
      }
    }
  }

  routeMod(fromModuleId, fromPortId, value, time) {
    for (const c of this.connections.values()) {
      if (c.fromModuleId === fromModuleId && c.fromPortId === fromPortId) {
        const target = this.engine.find(c.toModuleId);
        if (target && target.enabled) {
          let v = value;
          const d = c.depth ?? 1;
          if (d !== 1) {
            // Pan wird um die Mitte skaliert, alle anderen CVs wie ein Abschwächer
            v = c.toPortId === 'panCv' ? 0.5 + (value - 0.5) * d : value * d;
          }
          target.receiveMod(c.toPortId, v, time);
        }
      }
    }
  }

  routeClock(fromModuleId, fromPortId, time, tick = 0) {
    for (const c of this.connections.values()) {
      if (c.fromModuleId === fromModuleId && c.fromPortId === fromPortId) {
        const target = this.engine.find(c.toModuleId);
        if (target && target.enabled) {
          const toJack = target.meta.jacks?.find((j) => j.id === c.toPortId);
          if (toJack?.signal === 'gate') {
            target.receiveTrigger(c.toPortId, time, 0.9, 0.15);
          } else {
            target.receiveClock(c.toPortId, time, tick);
          }
        }
        this.notifyActivity(c.fromModuleId, c.fromPortId, c.toModuleId, c.toPortId, time, 'clock');
      }
    }
  }

  notifyActivity(fromModuleId, fromPortId, toModuleId, toPortId, time, type) {
    if (!this.onActivity) return;
    const now = this.engine.ctx?.currentTime || 0;
    const delayMs = Math.max(0, (time - now) * 1000);
    setTimeout(() => {
      this.onActivity({ fromModuleId, fromPortId, toModuleId, toPortId, type });
    }, delayMs);
  }

  getState() {
    return Array.from(this.connections.values()).map(c => ({
      from: `${c.fromModuleId}:${c.fromPortId}`,
      to: `${c.toModuleId}:${c.toPortId}`,
      color: c.color,
      ...((c.depth ?? 1) !== 1 ? { depth: c.depth } : {}),
    }));
  }

  loadState(cables = []) {
    this.connections.clear();
    if (!Array.isArray(cables)) return;
    for (const c of cables) {
      if (!c.from || !c.to) continue;
      const [fromMod, fromPort] = c.from.split(':');
      const [toMod, toPort] = c.to.split(':');
      if (fromMod && fromPort && toMod && toPort) {
        this.connect(fromMod, fromPort, toMod, toPort, c.color, c.depth ?? 1);
      }
    }
    this.onConnectionsChanged?.();
  }

  clear() {
    this.connections.clear();
    this.onConnectionsChanged?.();
  }
}
