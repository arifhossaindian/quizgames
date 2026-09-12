'use strict';
/* ============================================================
 * QuizArena · the six games
 * ============================================================ */

/* ---------- shared: timer settings block ---------- */
function TimerSettings(def) {
  let sec = +(def.timerSec || 30), mode = def.timerMode || 'auto';
  const hintEl = h('p.hint', {});
  const bA = h('button.seg', { onclick: () => set('auto') }, '⚡ Auto');
  const bM = h('button.seg', { onclick: () => set('manual') }, '✋ Manual');
  function set(m) {
    mode = m;
    bA.classList.toggle('on', m === 'auto');
    bM.classList.toggle('on', m === 'manual');
    hintEl.textContent = m === 'auto'
      ? 'Auto: প্রতি প্রশ্নে timer নিজেই চালু হবে।'
      : 'Manual: প্রতি প্রশ্নে timer-এর GO বাটন চাপতে হবে।';
    SFX.click();
  }
  const inp = h('input.inp', { type: 'number', min: '5', max: '600', value: sec, oninput: e => sec = +e.target.value });
  set(mode);
  return {
    el: h('label.field', {}, '⏱ Timer (seconds / question)', h('div.row', {}, inp, h('div.segwrap', {}, bA, bM)), hintEl),
    get: () => ({ seconds: Math.min(600, Math.max(5, sec || 30)), mode })
  };
}

/* ---------- shared: pack-based game setup screen ---------- */
function packSetup(root, { title, icon, types, onStart }) {
  const packs = DB.packsFor(types);
  if (!packs.length) {
    root.append(emptyState(icon, 'No questions yet!',
      `এই গেমের জন্য "${types.join(' / '}" টাইপের প্রশ্ন লাগবে। Bulk upload বা AI দিয়ে pack বানাও।`,
      [{ label: '📦 Open Question Packs', kind: 'primary', onClick: () => App.go('packs') }]));
    return;
  }
  let sel = packs[0].id, count = Math.min(10, packs[0].questions.length);
  const selEl = h('select.inp', { onchange: e => { sel = e.target.value; } },
    packs.map(p => h('option', { value: p.id, ...(p.id === sel ? { selected: '' } : {}) }, `${p.name} · ${p.subject || '—'} (${p.questions.length})`)));
  const countEl = h('input.inp', { type: 'number', min: '1', value: count, oninput: e => count = +e.target.value || 1 });
  const tset = TimerSettings(DB.state.settings);

  root.append(h('section.page', {}, h('div.setup', {},
    h('div.setup__head', {}, h('div.setup__icon', {}, icon),
      h('div', {}, h('h2', {}, title), h('p.muted', {}, `${packs.length} pack ready · ${packs.reduce((a, p) => a + p.questions.length, 0)} questions total`))),
    h('div.setup__grid', {},
      h('label.field', {}, '📦 Question Pack', selEl),
      h('label.field', {}, '🔢 কতগুলো প্রশ্ন', countEl),
      tset.el),
    h('button.btn.btn--primary.btn--xl', {
      onclick: () => {
        const p = packs.find(x => x.id === sel);
        const qs = shuffle(p.questions).slice(0, Math.max(1, Math.min(count, p.questions.length)));
        SFX.reveal();
        root.replaceChildren();
        onStart(qs, tset.get());
      }
    }, '🚀 START GAME'),
    h('button.btn.btn--ghost', { onclick: () => App.go('packs') }, '📦 Manage packs ➜'))));
}

/* ---------- shared: question renderers ---------- */
function mcqRender(q, api, { invert = false } = {}) {
  q._reveal = q.options[q.answer];
  const btns = q.options.map((opt, ix) => h('button.opt', { onclick: () => pick(ix) },
    h('span.opt__key', {}, 'ABCDEF'[ix]), h('span.opt__txt', {}, opt)));
  function pick(ix) {
    if (api.isLocked()) return;
    const isTrue = ix === q.answer, ok = invert ? !isTrue : isTrue;
    btns.forEach((b, j) => {
      b.disabled = true;
      if (j === q.answer) b.classList.add(invert ? 'opt--trap' : 'opt--right');
      if (j === ix && !ok) b.classList.add('opt--wrong');
      if (j === ix && ok) b.classList.add('opt--right');
    });
    api.answer(ok, invert
      ? (ok ? `✔ ঠিক ধরেছো — এটা একটা WRONG answer! (আসল উত্তর ছিল: ${q.options[q.answer]})`
            : `✖ তুমি তো সঠিক উত্তরটাই বেছে নিলে! (সঠিক উত্তর: ${q.options[q.answer]})`)
      : (ok ? '✔ Correct! 🎉' : 'Answer: ' + q.options[q.answer]));
  }
  return h('div.mcq', {},
    invert ? h('div.rule-banner', {}, '🚫 WRONG ANSWER ONLY — ভুল অপশনটা বেছে নাও!') : null,
    h('div.qtext', {}, q.q),
    q.hint ? h('div.qhint', {}, '💡 ' + q.hint) : null,
    h('div.opts', {}, btns));
}

function typeRender({ prompt, big, banner, q, api }) {
  q._reveal = String(q.answer).split('|')[0];
  const input = h('input.inp.inp--lg', { placeholder: 'Type answer…', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false' });
  const hintBox = h('div.qhint.hide', {}, '💡 ' + (q.hint || ''));
  const check = () => {
    if (api.isLocked()) return;
    const ok = accepts(input.value, q.answer);
    input.disabled = true;
    input.classList.add(ok ? 'inp--good' : 'inp--bad');
    api.answer(ok, ok ? '✔ Correct! 🎉' : 'Answer: ' + q._reveal);
  };
  return h('div.typeq', {},
    banner ? h('div.rule-banner', {}, banner) : null,
    h('div.qtext' + (big ? '.qtext--xl' : ''), {}, prompt),
    q.hint ? h('button.btn.btn--ghost.btn--sm', { onclick: () => { hintBox.classList.remove('hide'); SFX.reveal(); } }, '💡 Hint') : null,
    hintBox,
    h('form.answer-form', { onsubmit: e => { e.preventDefault(); check(); } },
      input, h('button.btn.btn--primary.btn--lg', { type: 'submit' }, 'Check ✔')),
    h('button.btn.btn--ghost', { onclick: () => { if (!api.isLocked()) { input.disabled = true; api.answer(false, 'Answer: ' + q._reveal); } } }, '👁 Reveal'));
}

/* ---------- shared: session engine (progress, score, timer, end screen) ---------- */
class Session {
  constructor({ title, items, timer, render }) {
    this.items = items; this.renderFn = render;
    this.i = 0; this.score = 0; this.answered = false;
    this.card = h('div.qcard');
    this.prog = h('span', {});
    this.scoreEl = h('div.score-chip', {}, '⭐ 0');
    this.nextBtn = h('button.btn.btn--primary.btn--lg.hide', { onclick: () => this.next() }, 'Next ➜');
    const timerMount = h('div.session__timer');
    this.ui = h('div.session', {},
      h('div.session__top', {},
        h('button.btn.btn--ghost.btn--sm', { onclick: () => this.quit() }, '✕ Quit'),
        h('div.session__title', {}, title),
        h('div.session__prog', {}, this.prog),
        this.scoreEl),
      h('div.session__mid', {}, timerMount, this.card),
      h('div.session__bottom', {}, this.nextBtn));
    this.timer = new Timer(timerMount, { ...timer, onEnd: () => this.timeout() });
  }
  mount(root) {
    root.append(this.ui);
    window.__qaCleanup = () => this.timer.destroy();
    this.show(0);
  }
  show(i) {
    this.i = i; this.answered = false;
    this.prog.textContent = `Q ${i + 1} / ${this.items.length}`;
    this.nextBtn.classList.add('hide');
    this.card.className = 'qcard';
    void this.card.offsetWidth;                       // restart animation
    this.card.classList.add('in');
    const api = { answer: (ok, text) => this.onAnswered(ok, text), isLocked: () => this.answered };
    this.card.append(this.renderFn(this.items[i], api));
    this.timer.arm();
  }
  onAnswered(ok, bannerText) {
    if (this.answered) return;
    this.answered = true;
    this.timer.stop();
    if (ok) { this.score++; SFX.correct(); this.card.classList.add('good'); confetti(1300, .5); }
    else { SFX.wrong(); this.card.classList.add('bad'); }
    this.scoreEl.textContent = '⭐ ' + this.score;
    if (bannerText) this.card.append(h(ok ? 'div.reveal' : 'div.reveal.reveal--bad', {}, bannerText));
    this.nextBtn.classList.remove('hide');
    this.nextBtn.classList.add('pop');
  }
  timeout() {
    if (this.answered) return;
    this.answered = true;
    this.card.classList.add('bad');
    this.card.append(h('div.reveal.reveal--bad', {}, `⏰ Time up! Answer: ${this.items[this.i]._reveal || '—'}`));
    this.nextBtn.classList.remove('hide');
  }
  next() {
    SFX.click();
    this.i + 1 < this.items.length ? this.show(this.i + 1) : this.finish();
  }
  quit() { this.timer.destroy(); window.__qaCleanup = null; App.go('home'); }
  finish() {
    this.timer.destroy(); window.__qaCleanup = null;
    SFX.win(); confetti(3000, 1.2);
    const n = this.items.length, pct = Math.round(this.score / n * 100);
    const msg = pct >= 80 ? 'Legendary! 🔥' : pct >= 50 ? 'Well played! 🎉' : 'Keep practising! 💪';
    this.ui.replaceChildren(h('div.endscreen', {},
      h('div.endscreen__badge', {}, pct >= 50 ? '🏆' : '🎯'),
      h('h2', {}, msg),
      h('div.endscreen__score', {}, String(this.score), h('span', {}, `/ ${n} · ${pct}%`)),
      h('div.endscreen__btns', {},
        h('button.btn.btn--primary.btn--lg', { onclick: () => App.replay() }, '🔁 Play Again'),
        h('button.btn.btn--ghost.btn--lg', { onclick: () => App.go('home') }, '🏠 Home'))));
  }
}

/* ============================================================
 * 🎡 GAME 1 — Spin the Roll
 * ============================================================ */
const SpinGame = {
  id: 'spin', name: 'Spin the Roll', icon: '🎡', color: 'c1',
  desc: 'Roll number দিয়ে student pick করো — default 1–40, range যেকোনো হতে পারে।',
  mount(root) {
    let min = 1, max = 40, angle = 0, spinning = false, hue = 0;
    const removed = new Set();
    const canvas = h('canvas.wheel', { width: '840', height: '840' });
    const ctx = canvas.getContext('2d');
    const res = h('div.spin-result');
    const picked = h('div.picked');
    const spinBtn = h('button.btn.btn--primary.btn--xl', { onclick: spin }, '🎡 SPIN!');
    const remC = h('input', { type: 'checkbox' });
    const minI = h('input.inp', { type: 'number', value: '1', onchange: apply });
    const maxI = h('input.inp', { type: 'number', value: '40', onchange: apply });

    const nums = () => { const a = []; for (let n = min; n <= max; n++) if (!removed.has(n)) a.push(n); return a; };
    function apply() {
      min = Math.max(0, Math.round(+minI.value || 0));
      max = Math.min(200, Math.round(+maxI.value || 40));
      if (max - min < 1) { max = min + 1; maxI.value = max; }
      [...removed].forEach(n => (n < min || n > max) && removed.delete(n));
      angle = 0; hue = (hue + 47) % 360;
      draw(); renderPicked(); SFX.click();
    }
    function draw() {
      const list = nums(), N = Math.max(list.length, 1), S = 840, c = S / 2, R = c - 18;
      ctx.clearRect(0, 0, S, S);
      ctx.save(); ctx.translate(c, c);
      ctx.beginPath(); ctx.arc(0, 0, R + 10, 0, 7);
      ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.lineWidth = 8; ctx.stroke();
      ctx.rotate(angle);
      const seg = 2 * Math.PI / N;
      ctx.textBaseline = 'middle'; ctx.textAlign = 'right';
      for (let i = 0; i < N; i++) {
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, R, i * seg, (i + 1) * seg); ctx.closePath();
        ctx.fillStyle = `hsl(${(i * 360 / N + hue) % 360} 68% ${i % 2 ? 40 : 52}%)`;
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 2; ctx.stroke();
        ctx.save();
        ctx.rotate((i + .5) * seg);
        ctx.fillStyle = '#fff';
        ctx.font = `800 ${Math.min(40, Math.max(13, 560 / N))}px Outfit, sans-serif`;
        ctx.fillText(list[i] ?? '', R - 16, 0);
        ctx.restore();
      }
      ctx.restore();
      ctx.beginPath(); ctx.arc(c, c, 52, 0, 7);
      ctx.fillStyle = '#0b1020'; ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 4; ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = "800 24px Outfit, sans-serif"; ctx.textAlign = 'center';
      ctx.fillText('SPIN', c, c);
    }
    function spin() {
      const list = nums();
      if (spinning) return;
      if (list.length < 2) return toast('সব roll pick হয়ে গেছে — Reset চাপো!', 'error');
      spinning = true; spinBtn.disabled = true; SFX.whoosh();
      const N = list.length, seg = 2 * Math.PI / N;
      const t = Math.floor(Math.random() * N);
      const targetA = (t + .5) * seg + (Math.random() - .5) * seg * .6;
      const R0 = angle, T = -Math.PI / 2 - targetA;
      const Rf = R0 + (5 + Math.random() * 3) * 2 * Math.PI + mod(T - R0, 2 * Math.PI);
      const dur = 4200 + Math.random() * 900, t0 = performance.now();
      let lastIdx = -1;
      const step = now => {
        const p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 4);
        angle = R0 + (Rf - R0) * e;
        draw();
        const idx = Math.floor(mod(-Math.PI / 2 - angle, 2 * Math.PI) / seg);
        if (idx !== lastIdx) { lastIdx = idx; SFX.spinTick(); }
        if (p < 1) requestAnimationFrame(step);
        else { spinning = false; spinBtn.disabled = false; showResult(list[idx]); }
      };
      requestAnimationFrame(step);
    }
    function showResult(n) {
      res.textContent = '#' + n;
      res.classList.add('show');
      SFX.win(); confetti(1800, .8);
      if (remC.checked) { removed.add(n); draw(); renderPicked(); }
      setTimeout(() => res.classList.remove('show'), 2600);
    }
    function renderPicked() {
      picked.replaceChildren(...[...removed].map(n =>
        h('span.chip.chip--picked', { title: 'ফিরিয়ে আনতে ক্লিক করো', onclick: () => { removed.delete(n); draw(); renderPicked(); SFX.click(); } }, '#' + n + ' ✕')));
    }

    root.append(h('section.page', {}, h('div.spinwrap', {},
      h('div.wheel-box', {}, canvas, h('div.wheel-pointer'), res),
      h('div.spin-side', {},
        h('h2', {}, '🎡 Spin the Roll'),
        h('p.muted', {}, 'SPIN চাপো — wheel ঘুরে একটা roll number বেছে দেবে। ক্লাসে student pick করার জন্য perfect!'),
        h('div.row', {}, h('label.field', {}, 'From (min)', minI), h('label.field', {}, 'To (max)', maxI)),
        h('label.check', {}, remC, ' Winner wheel থেকে বাদ দাও (একাধিক student pick)'),
        spinBtn,
        h('p.muted', { style: { marginTop: '16px' } }, 'Picked:'),
        picked,
        removed.size ? h('button.btn.btn--ghost.btn--sm', { onclick: () => { removed.clear(); draw(); renderPicked(); } }, '↺ Reset all') : null))));
    draw();
  }
};

/* ============================================================
 * 🖼️ GAME 2 — Guess the Image
 * ============================================================ */
function imgRender(q, api, pool) {
  q._reveal = q.label;
  const visual = h('div.gimg-wrap', {}, h('img.gimg', { src: q.data, alt: '?' }));
  const others = shuffle(pool.filter(l => norm(l) !== norm(q.label))).slice(0, 3);
  let answerUI;
  if (others.length >= 3) {
    const opts = shuffle([q.label, ...others]);
    const btns = opts.map((o, ix) => h('button.opt', { onclick: () => pick(ix) },
      h('span.opt__key', {}, 'ABCD'[ix]), h('span.opt__txt', {}, o)));
    function pick(ix) {
      if (api.isLocked()) return;
      const ok = norm(opts[ix]) === norm(q.label);
      btns.forEach((b, j) => {
        b.disabled = true;
        if (norm(opts[j]) === norm(q.label)) b.classList.add('opt--right');
        else if (j === ix) b.classList.add('opt--wrong');
      });
      api.answer(ok, ok ? '✔ Correct! 🎉' : 'Answer: ' + q.label);
    }
    answerUI = h('div.opts', {}, btns);
  } else {
    const input = h('input.inp.inp--lg', { placeholder: 'Type your answer…', autocomplete: 'off' });
    answerUI = h('form.answer-form', {
      onsubmit: e => {
        e.preventDefault();
        if (api.isLocked()) return;
        const ok = accepts(input.value, q.label);
        input.disabled = true;
        api.answer(ok, ok ? '✔ Correct! 🎉' : 'Answer: ' + q.label);
      }
    }, input, h('button.btn.btn--primary.btn--lg', { type: 'submit' }, 'Check ✔'));
  }
  return h('div.imgq', {}, visual, q.hint ? h('div.qhint', {}, '💡 ' + q.hint) : null, answerUI);
}

const ImageGame = {
  id: 'image', name: 'Guess the Image', icon: '🖼️', color: 'c2',
  desc: 'তোমার upload করা ছবি random দেখাবে — সঠিক label বেছে নাও!',
  async mount(root) {
    const imgs = (await DB.allImages()).filter(i => i.data);
    if (!imgs.length) {
      root.append(emptyState('🖼️', 'Image library খালি!',
        'Image Lab থেকে ছবি upload করো, প্রতিটার Label (= উত্তর) দাও, তারপর খেলো।',
        [{ label: '🖼️ Open Image Lab', kind: 'primary', onClick: () => App.go('images') }]));
      return;
    }
    const chosen = new Set(imgs.filter(i => i.label).map(i => i.id));
    const grid = h('div.imgpick');
    imgs.forEach(im => {
      const cb = h('input', {
        type: 'checkbox', ...(chosen.has(im.id) ? { checked: '' } : {}),
        onchange: e => { card.classList.toggle('on', e.target.checked); e.target.checked ? chosen.add(im.id) : chosen.delete(im.id); SFX.click(); }
      });
      const card = h('label.imgpick__card' + (chosen.has(im.id) ? '.on' : ''), {}, cb,
        h('img', { src: im.data, alt: '' }), h('span', {}, im.label || '⚠ no label'));
      grid.append(card);
    });
    let count = Math.min(10, imgs.length);
    const countEl = h('input.inp', { type: 'number', min: '1', value: count, oninput: e => count = +e.target.value || 1 });
    const tset = TimerSettings(DB.state.settings);

    root.append(h('section.page', {}, h('div.setup', {},
      h('div.setup__head', {}, h('div.setup__icon', {}, '🖼️'),
        h('div', {}, h('h2', {}, 'Guess the Image'), h('p.muted', {}, 'যে ছবিগুলো খেলাবে tick করো (label = উত্তর)'))),
      grid,
      h('div.setup__grid', {}, h('label.field', {}, '🔢 কত রাউন্ড', countEl), tset.el),
      h('button.btn.btn--primary.btn--xl', {
        onclick: () => {
          const pool = shuffle(imgs.filter(i => chosen.has(i.id) && i.label));
          if (!pool.length) return toast('কমপক্ষে একটা labelled ছবি বেছে নাও', 'error');
          const items = pool.slice(0, Math.max(1, Math.min(count, pool.length)));
          const labels = pool.map(i => i.label);
          SFX.reveal();
          root.replaceChildren();
          new Session({ title: '🖼️ Guess the Image', items, timer: tset.get(), render: (q, api) => imgRender(q, api, labels) }).mount(root);
        }
      }, '🚀 START GAME'),
      h('button.btn.btn--ghost', { onclick: () => App.go('images') }, '🖼️ Manage library ➜'))));
  }
};

/* ============================================================
 * 🔤 GAME 3 — Guess the Word   🚫 GAME 4 — Wrong Answer Only
 * 🔁 GAME 5 — Opposite Words   🧠 GAME 6 — Classic Quiz
 * ============================================================ */
const WordGame = {
  id: 'word', name: 'Guess the Word', icon: '🔤', color: 'c3',
  desc: 'Clue পড়ে উত্তর guess করো — টাইপ করো বা Reveal চাপো।',
  mount(root) {
    packSetup(root, {
      title: 'Guess the Word', icon: '🔤', types: ['word'],
      onStart: (items, timer) => new Session({ title: '🔤 Guess the Word', items, timer, render: (q, api) => typeRender({ prompt: q.q, q, api }) }).mount(root)
    });
  }
};

const WrongOnlyGame = {
  id: 'wrong', name: 'Wrong Answer Only', icon: '🚫', color: 'c4',
  desc: 'উল্টো খেলা! সঠিক উত্তরটা এড়িয়ে ভুল অপশন বেছে নিতে হবে।',
  mount(root) {
    packSetup(root, {
      title: 'Wrong Answer Only', icon: '🚫', types: ['mcq'],
      onStart: (items, timer) => new Session({ title: '🚫 Wrong Answer Only', items, timer, render: (q, api) => mcqRender(q, api, { invert: true }) }).mount(root)
    });
  }
};

const OppositesGame = {
  id: 'opposite', name: 'Opposite Words', icon: '🔁', color: 'c5',
  desc: 'শব্দ দেখাও — students বিপরীত শব্দ বলবে, timer চলবে!',
  mount(root) {
    packSetup(root, {
      title: 'Opposite Words', icon: '🔁', types: ['opposite'],
      onStart: (items, timer) => new Session({ title: '🔁 Opposite Words', items, timer, render: (q, api) => typeRender({ prompt: q.word, big: true, banner: '🔁 Say the OPPOSITE!', q, api }) }).mount(root)
    });
  }
};

const QuizGame = {
  id: 'quiz', name: 'Classic Quiz', icon: '🧠', color: 'c6',
  desc: 'সাধারণ MCQ quiz — সঠিক উত্তর বেছে নাও, score বানাও।',
  mount(root) {
    packSetup(root, {
      title: 'Classic Quiz', icon: '🧠', types: ['mcq'],
      onStart: (items, timer) => new Session({ title: '🧠 Classic Quiz', items, timer, render: (q, api) => mcqRender(q, api) }).mount(root)
    });
  }
};

const GAMES = [SpinGame, ImageGame, WordGame, WrongOnlyGame, OppositesGame, QuizGame];
