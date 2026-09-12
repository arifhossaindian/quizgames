'use strict';
/* ============ Storage: localStorage + IndexedDB + optional Firebase ============ */
const DB = (() => {
  const KEY = 'quizarena.v2';
  const state = {
    packs: [],
    settings: { timerSec: 30, timerMode: 'auto', model: 'openai/gpt-oss-120b', apiKey: '', sheetUrl: '' },
    lastSync: 0
  };

  /* 🌟 first-bar khullei default pack */
  const STARTER = {
    name: '🌟 Starter Pack', subject: 'General',
    questions: [
      { type: 'word', q: 'Largest land animal with a long trunk', answer: 'Elephant' },
      { type: 'word', q: 'Big bird that lays the largest egg but cannot fly', answer: 'Ostrich' },
      { type: 'word', q: 'Largest planet in our solar system', answer: 'Jupiter' },
      { type: 'word', q: 'Sweet golden food made by bees', answer: 'Honey' },
      { type: 'word', q: 'Colorful arc in the sky after rain', answer: 'Rainbow' },
      { type: 'word', q: 'Ship of the desert', answer: 'Camel' },
      { type: 'word', q: 'King of the jungle', answer: 'Lion' },
      { type: 'word', q: 'Organ that pumps blood in your body', answer: 'Heart' },
      { type: 'word', q: 'Tallest animal in the world', answer: 'Giraffe' },
      { type: 'word', q: 'White frozen water that falls in winter', answer: 'Snow' },
      { type: 'opposite', word: 'Hot', answer: 'Cold' },
      { type: 'opposite', word: 'Big', answer: 'Small' },
      { type: 'opposite', word: 'Fast', answer: 'Slow' },
      { type: 'opposite', word: 'Happy', answer: 'Sad' },
      { type: 'opposite', word: 'Day', answer: 'Night' },
      { type: 'opposite', word: 'Up', answer: 'Down' },
      { type: 'opposite', word: 'Ancient', answer: 'Modern|New' },
      { type: 'opposite', word: 'Clean', answer: 'Dirty' },
      { type: 'opposite', word: 'Strong', answer: 'Weak' },
      { type: 'opposite', word: 'Open', answer: 'Close|Shut' },
      { type: 'mcq', q: 'Which planet is known as the Red Planet?', options: ['Venus', 'Mars', 'Jupiter', 'Saturn'], answer: 1 },
      { type: 'mcq', q: 'What is the capital of Bangladesh?', options: ['Chattogram', 'Sylhet', 'Dhaka', 'Khulna'], answer: 2 },
      { type: 'mcq', q: 'How many legs does a spider have?', options: ['6', '8', '4', '10'], answer: 1 },
      { type: 'mcq', q: 'Which one is a fruit?', options: ['Potato', 'Tomato', 'Onion', 'Carrot'], answer: 1 },
      { type: 'mcq', q: 'What do bees make?', options: ['Milk', 'Honey', 'Silk', 'Wool'], answer: 1 },
      { type: 'mcq', q: 'Which animal gives us milk?', options: ['Cow', 'Tiger', 'Crow', 'Frog'], answer: 0 }
    ]
  };

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
      const { apiKey, ...safe } = state.settings;
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
      } catch (e) { }
      if (!localStorage.getItem('qa.seeded')) {
        state.packs.push(Object.assign({ id: uid('pack'), created: Date.now() }, STARTER));
        localStorage.setItem('qa.seeded', '1');
        localSave();
      }
      await pull().catch(() => { });
    },
    save() { localSave(); push(); },
    packsFor(types) {
      return state.packs.map(p => ({ ...p, questions: p.questions.filter(q => types.includes(q.type)) })).filter(p => p.questions.length);
    },
    addPack(p) { p.id = p.id || uid('pack'); p.created = Date.now(); state.packs.unshift(p); this.save(); return p; },
    deletePack(id) { state.packs = state.packs.filter(p => p.id !== id); this.save(); },
    putImage: r => tx('readwrite', s => s.put(r)),
    getImage: id => tx('readonly', s => s.get(id)),
    allImages: () => tx('readonly', s => s.getAll()),
    delImage: id => tx('readwrite', s => s.delete(id)),
    async updateImage(id, patch) { const r = await DB.getImage(id); if (r) { Object.assign(r, patch); await DB.putImage(r); } },
    cloud: { push, pull, enabled: () => !!(window.FIREBASE_SYNC && window.FIREBASE_CONFIG && window.firebase) },
    stats() { return { packs: state.packs.length, questions: state.packs.reduce((a, p) => a + p.questions.length, 0) }; }
  };
})();
