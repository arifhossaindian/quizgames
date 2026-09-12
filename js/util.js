'use strict';
/* ============ QuizArena · core utilities ============ */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const mod = (a, n) => ((a % n) + n) % n;

function h(spec, props = {}, ...kids) {
  const el = document.createElement(spec.match(/^([a-zA-Z0-9-]*)/)[1] || 'div');
  const id = spec.match(/#([a-zA-Z0-9_-]+)/);
  if (id) el.id = id[1];
  for (const c of spec.matchAll(/\.([a-zA-Z0-9_-]+)/g)) el.classList.add(c[1]);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'style' && typeof v === 'object')
      Object.entries(v).forEach(([sk, sv]) => sk.startsWith('--') ? el.style.setProperty(sk, sv) : (el.style[sk] = sv));
    else el.setAttribute(k, v);
  }
  kids.flat(9).forEach(k => {
    if (k == null || k === false) return;
    el.append(k.nodeType ? k : document.createTextNode(k));
  });
  return el;
}

const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
const uid = (p = 'id') => p + '_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'pack';
const escapeHtml = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = s => String(s).trim().toLowerCase().replace(/[.,!?'’"।\-–—]/g, '').replace(/\s+/g, ' ');
const accepts = (given, answer) => String(answer).split('|').some(a => norm(a) === norm(given));
const safeUrl = v => { const s = String(v || '').trim(); return /^(https?:|data:)/i.test(s) ? s : undefined; };
const ytId = u => { const m = String(u || '').match(/(?:youtu\.be\/([\w-]{6,})|youtube\.com\/watch\?[\w=&;%.\/-]*?v=([\w-]{6,}))/); return m ? (m[1] || m[2]) : null; };

/* ---------- rich text: HTML + image/audio/video/youtube + LaTeX ---------- */
function richText(s) {
  let t = escapeHtml(String(s ?? ''));
  const stash = [];
  const put = html => { stash.push(html); return '\u0000' + (stash.length - 1) + '\u0000'; };
  t = t.replace(/(?:youtu\.be\/([\w-]{6,})|youtube\.com\/watch\?[\w=&;%.\/-]*?v=([\w-]{6,}))/gi, (m, a, b) => put(`<iframe class="rvid" src="https://www.youtube.com/embed/${a || b}" allowfullscreen loading="lazy"></iframe>`));
  t = t.replace(/https?:\/\/[^\s<"]+?\.(?:png|jpe?g|webp|gif)(?:\?[^\s<"]*)?/gi, m => put(`<img class="rimg" src="${m}" alt="">`));
  t = t.replace(/https?:\/\/[^\s<"]+?\.(?:mp3|ogg|wav|m4a)(?:\?[^\s<"]*)?/gi, m => put(`<audio controls src="${m}"></audio>`));
  t = t.replace(/https?:\/\/[^\s<"]+?\.(?:mp4|webm)(?:\?[^\s<"]*)?/gi, m => put(`<video class="rvid" controls src="${m}"></video>`));
  t = t.replace(/https?:\/\/[^\s<"]+/gi, m => put(`<a href="${m}" target="_blank" rel="noopener">🔗 link</a>`));
  t = t.replace(/&lt;(\/?(?:b|i|u|em|strong|br|sub|sup|code))&gt;/gi, '<$1>');
  t = t.replace(/\n/g, '<br>');
  t = t.replace(/\u0000(\d+)\u0000/g, (m, i) => stash[+i]);
  return t;
}
function renderMathIn(root) {
  if (window.renderMathInElement) {
    try { renderMathInElement(root, { delimiters: [{ left: '$$', right: '$$', display: true }, { left: '$', right: '$', display: false }], ignoredTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code'] }); } catch (e) { }
  }
}
/* question-এর img/audio/video field গুলো element বানায় */
function mediaEl(q) {
  const out = [];
  if (q.img) out.push(h('img.rimg', { src: q.img, alt: '' }));
  if (q.audio) out.push(h('audio', { controls: '', src: q.audio }));
  if (q.video) { const y = ytId(q.video); out.push(y ? h('iframe.rvid', { src: 'https://www.youtube.com/embed/' + y, allowfullscreen: '', loading: 'lazy' }) : h('video.rvid', { controls: '', src: q.video })); }
  return out.length ? h('div.qmedia', {}, out) : null;
}

/* ---------- toasts / modal / confetti ---------- */
function toast(msg, type = 'info', ms = 2800) {
  const t = h(`div.toast.toast--${type}`, {}, msg);
  $('#toasts').append(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, ms);
}
function modal({ title, body, actions = [], wide = false }) {
  return new Promise(resolve => {
    const back = h('div.modal-back');
    const close = val => { back.classList.remove('show'); setTimeout(() => back.remove(), 250); document.removeEventListener('keydown', onKey); resolve(val); };
    const onKey = e => { if (e.key === 'Escape') close(null); };
    back.append(h(wide ? 'div.modal.modal--wide' : 'div.modal', {},
      h('div.modal__head', {}, h('h3', {}, title), h('button.modal__x', { onclick: () => close(null) }, '✕')),
      h('div.modal__body', {}, body),
      actions.length ? h('div.modal__foot', {}, actions.map(a =>
        h(`button.btn.btn--${a.kind || 'ghost'}`, { onclick: () => a.onClick ? a.onClick(close) : close(a.value !== undefined ? a.value : true) }, a.label))) : null));
    back.addEventListener('click', e => e.target === back && close(null));
    document.addEventListener('keydown', onKey);
    $('#modal-root').append(back);
    requestAnimationFrame(() => back.classList.add('show'));
  });
}
function confetti(duration = 2500, power = 1) {
  const c = h('canvas.confetti-canvas');
  document.body.append(c);
  const ctx = c.getContext('2d');
  let W, H;
  const rs = () => { W = c.width = innerWidth; H = c.height = innerHeight; };
  rs(); addEventListener('resize', rs);
  const cols = ['#ffd166', '#ef476f', '#06d6a0', '#4cc9f0', '#f78c6b', '#a78bfa', '#ffffff'];
  const ps = Array.from({ length: Math.round(140 * power) }, () => ({
    x: Math.random() * W, y: -20 - Math.random() * H * .5, r: 3 + Math.random() * 5,
    c: cols[Math.random() * cols.length | 0], vx: (Math.random() - .5) * 2.2,
    vy: 2 + Math.random() * 3.5, rot: Math.random() * 7, vr: (Math.random() - .5) * .25
  }));
  const t0 = performance.now();
  const step = now => {
    const t = now - t0;
    ctx.clearRect(0, 0, W, H);
    for (const p of ps) {
      p.x += p.vx; p.y += p.vy; p.vy += .02; p.rot += p.vr;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.globalAlpha = t > duration ? Math.max(0, 1 - (t - duration) / 600) : 1;
      ctx.fillStyle = p.c; ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 1.6); ctx.restore();
    }
    if (t < duration + 700) requestAnimationFrame(step);
    else { c.remove(); removeEventListener('resize', rs); }
  };
  requestAnimationFrame(step);
}

/* ---------- files ---------- */
function download(name, text, mime = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  h('a', { href: url, download: name }).click();
  URL.revokeObjectURL(url);
}
function bmpToThumb(src, max) {
  const sc = Math.min(1, max / Math.max(src.width, src.height));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(src.width * sc));
  c.height = Math.max(1, Math.round(src.height * sc));
  c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', .82);
}
async function fileToThumb(file, max = 900) {
  try { return bmpToThumb(await createImageBitmap(file), max); }
  catch (e) {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => { res(bmpToThumb(img, max)); URL.revokeObjectURL(url); };
      img.onerror = rej; img.src = url;
    });
  }
}

/* ---------- shared UI ---------- */
function emptyState(icon, title, msg, actions = []) {
  return h('section.page.in', {}, h('div.empty', {},
    h('div.empty__icon', {}, icon), h('h2', {}, title), h('p.muted', {}, msg),
    h('div.row', { style: { justifyContent: 'center' } },
      actions.map(a => h(`button.btn.btn--${a.kind || 'ghost'}`, { onclick: a.onClick }, a.label)))));
}
const confirmDlg = msg => modal({
  title: 'Are you sure?', body: h('p', {}, msg),
  actions: [{ label: 'Yes, do it', kind: 'danger', value: true }, { label: 'Cancel', value: false }]
});

/* ============================================================
 * 🎡 GLOBAL MINI STUDENT PICKER — সব পেজে ভাসমান বাটন
 * ============================================================ */
function mountStudentPicker() {
  let cfg = { min: 1, max: 40, removed: [] };
  try { Object.assign(cfg, JSON.parse(localStorage.getItem('qa.picker') || '{}')); } catch (e) { }
  const save = () => localStorage.setItem('qa.picker', JSON.stringify(cfg));
  const nums = () => { const a = []; for (let n = cfg.min; n <= cfg.max; n++) if (!cfg.removed.includes(n)) a.push(n); return a; };

  const fab = h('button.fab', { title: '🎡 Student picker', onclick: openPicker }, '🎡');
  document.body.append(fab);

  function openPicker() {
    let angle = 0, spinning = false;
    const cv = h('canvas.miniwheel', { width: '520', height: '520' });
    const ctx = cv.getContext('2d');
    const res = h('div.miniwheel__res');
    const picked = h('div.picked');
    const remC = h('input', { type: 'checkbox', checked: '' });
    const minI = h('input.inp', { type: 'number', value: cfg.min, onchange: clamp });
    const maxI = h('input.inp', { type: 'number', value: cfg.max, onchange: clamp });
    function clamp() {
      cfg.min = Math.max(0, Math.round(+minI.value || 0));
      cfg.max = Math.min(300, Math.round(+maxI.value || 1));
      if (cfg.max - cfg.min < 1) { cfg.max = cfg.min + 1; maxI.value = cfg.max; }
      cfg.removed = cfg.removed.filter(n => n >= cfg.min && n <= cfg.max);
      save(); draw(); chips();
    }
    function chips() {
      picked.replaceChildren(...cfg.removed.map(n => h('span.chip.chip--picked', { onclick: () => { cfg.removed = cfg.removed.filter(x => x !== n); save(); draw(); chips(); } }, '#' + n + ' ✕')));
    }
    function draw() {
      const list = nums(), N = Math.max(list.length, 1), S = 520, c = S / 2, R = c - 12;
      ctx.clearRect(0, 0, S, S);
      ctx.save(); ctx.translate(c, c); ctx.rotate(angle);
      const seg = 2 * Math.PI / N;
      ctx.textBaseline = 'middle'; ctx.textAlign = 'right';
      for (let i = 0; i < N; i++) {
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, R, i * seg, (i + 1) * seg); ctx.closePath();
        ctx.fillStyle = `hsl(${(i * 360 / N) % 360} 68% ${i % 2 ? 40 : 52}%)`;
        ctx.fill();
        ctx.save(); ctx.rotate((i + .5) * seg);
        ctx.fillStyle = '#fff';
        ctx.font = `800 ${Math.min(30, Math.max(10, 380 / N))}px Outfit, sans-serif`;
        ctx.fillText(list[i] ?? '', R - 10, 0);
        ctx.restore();
      }
      ctx.restore();
      ctx.beginPath(); ctx.arc(c, c, 34, 0, 7); ctx.fillStyle = '#0b1020'; ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 3; ctx.stroke();
    }
    function spin() {
      const list = nums();
      if (spinning) return;
      if (list.length < 2) return toast('সব pick হয়ে গেছে — Reset চাপো!', 'error');
      spinning = true; SFX.whoosh();
      const N = list.length, seg = 2 * Math.PI / N;
      const t = Math.floor(Math.random() * N);
      const targetA = (t + .5) * seg + (Math.random() - .5) * seg * .6;
      const R0 = angle, T = -Math.PI / 2 - targetA;
      const Rf = R0 + (4 + Math.random() * 2) * 2 * Math.PI + mod(T - R0, 2 * Math.PI);
      const dur = 3200 + Math.random() * 700, t0 = performance.now();
      let last = -1;
      const step = now => {
        const p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 4);
        angle = R0 + (Rf - R0) * e; draw();
        const idx = Math.floor(mod(-Math.PI / 2 - angle, 2 * Math.PI) / seg);
        if (idx !== last) { last = idx; SFX.spinTick(); }
        if (p < 1) requestAnimationFrame(step);
        else {
          spinning = false;
          res.textContent = '#' + list[idx];
          res.classList.add('show'); SFX.win(); confetti(1400, .6);
          if (remC.checked) { cfg.removed.push(list[idx]); save(); draw(); chips(); }
          setTimeout(() => res.classList.remove('show'), 2200);
        }
      };
      requestAnimationFrame(step);
    }
    modal({
      title: '🎡 Student Picker',
      body: h('div.picker', {},
        h('div.miniwheel-box', {}, cv, h('div.miniwheel-pointer'), res),
        h('div.row', {}, h('label.field', {}, 'From', minI), h('label.field', {}, 'To', maxI)),
        h('label.check', {}, remC, ' Winner বাদ দাও'),
        h('button.btn.btn--primary.btn--lg', { style: { width: '100%' }, onclick: spin }, '🎡 SPIN'),
        picked,
        h('button.btn.btn--ghost.btn--sm', { onclick: () => { cfg.removed = []; save(); draw(); chips(); } }, '↺ Reset all'))
    });
    draw(); chips();
  }
}
