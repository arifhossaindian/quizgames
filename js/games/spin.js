'use strict';
GameRegistry.register({
  id: 'spin', name: 'Spin the Roll', icon: '🎡', color: 'c1',
  desc: 'Roll number দিয়ে student pick — default 1–40।',
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
        ctx.save(); ctx.rotate((i + .5) * seg);
        ctx.fillStyle = '#fff';
        ctx.font = `800 ${Math.min(40, Math.max(13, 560 / N))}px Outfit, sans-serif`;
        ctx.fillText(list[i] ?? '', R - 16, 0);
        ctx.restore();
      }
      ctx.restore();
      ctx.beginPath(); ctx.arc(c, c, 52, 0, 7);
      ctx.fillStyle = '#0b1020'; ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 4; ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = '800 24px Outfit, sans-serif'; ctx.textAlign = 'center';
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
        angle = R0 + (Rf - R0) * e; draw();
        const idx = Math.floor(mod(-Math.PI / 2 - angle, 2 * Math.PI) / seg);
        if (idx !== lastIdx) { lastIdx = idx; SFX.spinTick(); }
        if (p < 1) requestAnimationFrame(step);
        else { spinning = false; spinBtn.disabled = false; showResult(list[idx]); }
      };
      requestAnimationFrame(step);
    }
    function showResult(n) {
      res.textContent = '#' + n; res.classList.add('show');
      SFX.win(); confetti(1800, .8);
      if (remC.checked) { removed.add(n); draw(); renderPicked(); }
      setTimeout(() => res.classList.remove('show'), 2600);
    }
    function renderPicked() {
      picked.replaceChildren(...[...removed].map(n =>
        h('span.chip.chip--picked', { onclick: () => { removed.delete(n); draw(); renderPicked(); SFX.click(); } }, '#' + n + ' ✕')));
    }
    root.append(h('section.page', {}, h('div.spinwrap', {},
      h('div.wheel-box', {}, canvas, h('div.wheel-pointer'), res),
      h('div.spin-side', {},
        h('h2', {}, '🎡 Spin the Roll'),
        h('p.muted', {}, 'SPIN চাপো — wheel ঘুরে roll number বেছে দেবে।'),
        h('div.row', {}, h('label.field', {}, 'From (min)', minI), h('label.field', {}, 'To (max)', maxI)),
        h('label.check', {}, remC, ' Winner wheel থেকে বাদ দাও'),
        spinBtn,
        h('p.muted', { style: { marginTop: '16px' } }, 'Picked:'),
        picked,
        removed.size ? h('button.btn.btn--ghost.btn--sm', { onclick: () => { removed.clear(); draw(); renderPicked(); } }, '↺ Reset all') : null))));
    draw();
  }
});
