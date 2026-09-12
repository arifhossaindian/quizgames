'use strict';
/* ============================================================
 * QuizArena · core utilities (DOM, math, toast, modal, confetti)
 * ============================================================ */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const mod = (a, n) => ((a % n) + n) % n;

/** Hyperscript: h('button.btn.btn--primary#id', {onclick}, ...children) */
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
/** normalise for answer matching (case / punctuation / space insensitive) */
const norm = s => String(s).trim().toLowerCase().replace(/[.,!?'’"।\-–—]/g, '').replace(/\s+/g, ' ');
/** answer may contain alternatives separated by |  e.g. "colour|color" */
const accepts = (given, answer) => String(answer).split('|').some(a => norm(a) === norm(given));

/* ---------- toasts ---------- */
function toast(msg, type = 'info', ms = 2800) {
  const t = h(`div.toast.toast--${type}`, {}, msg);
  $('#toasts').append(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, ms);
}

/* ---------- promise modal ----------
 * actions: [{label, kind:'primary|ghost|danger', value, keepOpen, onClick(close)}]
 * resolves with action value (true default), or null on dismiss.            */
function modal({ title, body, actions = [], wide = false }) {
  return new Promise(resolve => {
    const back = h('div.modal-back');
    const close = val => { back.classList.remove('show'); setTimeout(() => back.remove(), 250); document.removeEventListener('keydown', onKey); resolve(val); };
    const onKey = e => { if (e.key === 'Escape') close(null); };
    back.append(h(wide ? 'div.modal.modal--wide' : 'div.modal', {},
      h('div.modal__head', {}, h('h3', {}, title), h('button.modal__x', { onclick: () => close(null) }, '✕')),
      h('div.modal__body', {}, body),
      actions.length ? h('div.modal__foot', {}, actions.map(a =>
        h(`button.btn.btn--${a.kind || 'ghost'}`, {
          onclick: () => a.onClick ? a.onClick(close) : close(a.value !== undefined ? a.value : true)
        }, a.label))) : null));
    back.addEventListener('click', e => e.target === back && close(null));
    document.addEventListener('keydown', onKey);
    $('#modal-root').append(back);
    requestAnimationFrame(() => back.classList.add('show'));
  });
}

/* ---------- confetti burst ---------- */
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

/* ---------- file helpers ---------- */
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
/** downscale image file → compact jpeg dataURL (saves storage) */
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

/* ---------- shared UI bits ---------- */
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
