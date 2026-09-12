'use strict';
/* ============================================================
 * QuizArena · storage layer
 *   localStorage → packs + settings   (small, instant)
 *   IndexedDB    → image library      (big binaries)
 *   Firebase     → optional cloud sync (js/firebase-config.js)
 * ============================================================ */
const DB = (() => {
  const KEY = 'quizarena.v2';
  const state = {
    packs: [],
    settings: { timerSec: 30, timerMode: 'auto', model: 'openai/gpt-oss-120b', apiKey: '' },
    lastSync: 0
  };

  /* ---------- IndexedDB (images) ---------- */
  const idb = () => new Promise((res, rej) => {
    const rq = indexedDB.open('quizarena-img', 1);
    rq.onupgradeneeded = () => rq.result.createObjectStore('images', { keyPath: 'id' });
    rq.onsuccess = () => res(rq.result);
    rq.onerror = () => rej(rq.error);
  });
  const tx = (mode, fn) => idb().then(db => new Promise((res, rej) => {
    const t = db.transaction('images', mode);
    const rq = fn(t.objectStore('images'));
    t.oncomplete = () => res(rq && rq.result);
    t.onerror = () => rej(t.error);
  }));

  /* ---------- Firebase (optional) ---------- */
  let fb = null;
  const cloud = () => {
    if (!fb && window.FIREBASE_CONFIG && window.firebase) {
      try { fb = firebase.initializeApp(window.FIREBASE_CONFIG).firestore(); }
      catch (e) { console.warn('[QA] firebase init failed', e); }
    }
    return fb;
  };
  const doc = () => cloud() && cloud().collection('quizarena').doc('main');

  async function push() {
    if (!(window.FIREBASE_SYNC && doc())) return;
    try {
      const { apiKey, ...safe } = state.settings;          // API key কখনো cloud-এ যায় না
      await doc().set({ packs: state.packs, settings: safe, updatedAt: Date.now() });
      state.lastSync = Date.now();
      toast('☁️ Synced to cloud', 'success');
    } catch (e) { console.warn(e); toast('Cloud push failed: ' + e.message, 'error'); }
  }
  async function pull() {
    if (!(window.FIREBASE_SYNC && doc())) return false;
    try {
      const snap = await doc().get();
      if (!snap.exists) return false;
      const d = snap.data();
      (d.packs || []).forEach(rp => {
        const i = state.packs.findIndex(p => p.id === rp.id);
        i >= 0 ? (state.packs[i] = rp) : state.packs.push(rp);
      });
      if (d.settings) Object.assign(state.settings, d.settings);
      localSave();
      state.lastSync = Date.now();
      return true;
    } catch (e) { console.warn(e); toast('Cloud pull failed: ' + e.message, 'error'); return false; }
  }
  function localSave() {
    try { localStorage.setItem(KEY, JSON.stringify({ packs: state.packs, settings: state.settings })); }
    catch (e) { toast('Local storage full! Delete some images/packs.', 'error', 4500); }
  }

  return {
    state,
    async init() {
      try {
        const d = JSON.parse(localStorage.getItem(KEY) || '{}');
        if (Array.isArray(d.packs)) state.packs = d.packs;
        if (d.settings) Object.assign(state.settings, d.settings);
      } catch (e) { /* first run */ }
      await pull().catch(() => { });
    },
    save() { localSave(); push(); },

    /* --- packs --- */
    packsFor(types) {
      return state.packs
        .map(p => ({ ...p, questions: p.questions.filter(q => types.includes(q.type)) }))
        .filter(p => p.questions.length);
    },
    addPack(p) { p.id = p.id || uid('pack'); p.created = Date.now(); state.packs.unshift(p); this.save(); return p; },
    deletePack(id) { state.packs = state.packs.filter(p => p.id !== id); this.save(); },
    renamePack(id, name) { const p = state.packs.find(x => x.id === id); if (p) { p.name = name; this.save(); } },

    /* --- images (IndexedDB) --- */
    putImage: r => tx('readwrite', s => s.put(r)),
    getImage: id => tx('readonly', s => s.get(id)),
    allImages: () => tx('readonly', s => s.getAll()),
    delImage: id => tx('readwrite', s => s.delete(id)),
    async updateImage(id, patch) {
      const r = await DB.getImage(id);
      if (r) { Object.assign(r, patch); await DB.putImage(r); }
    },

    cloud: { push, pull, enabled: () => !!(window.FIREBASE_SYNC && window.FIREBASE_CONFIG && window.firebase) },
    stats() { return { packs: state.packs.length, questions: state.packs.reduce((a, p) => a + p.questions.length, 0) }; }
  };
})();
