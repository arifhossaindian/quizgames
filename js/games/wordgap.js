'use strict';
function gapRender(q, api) {
  q._reveal = String(q.answer).split('|')[0];
  const full = q._reveal;
  /* গড়ে ৪০% letters hide করো, কমপক্ষে ১, বেশি হলে অর্ধেক */
  const n = Math.max(1, Math.min(full.length - 1, Math.round(full.length * 0.4)));
  const positions = [];
  while (positions.length < n) {
    const p = Math.floor(Math.random() * full.length);
    if (!positions.includes(p) && full[p] !== ' ') positions.push(p);
  }
  positions.sort((a, b) => a - b);
  const hidden = positions.map(p => full[p]);
  const inputs = [];
  const display = [];
  for (let i = 0; i < full.length; i++) {
    if (full[i] === ' ') {
      display.push(h('span.builder-gap', { style: { background: 'transparent' } }, '\u00A0'));
    } else if (positions.includes(i)) {
      const inp = h('input.builder-gap', { maxlength: '1', autocomplete: 'off', autocapitalize: 'off' });
      inputs.push({ el: inp, correct: full[i] });
      display.push(inp);
    } else {
      display.push(h('span.builder-gap', {}, full[i]));
    }
  }
  function check() {
    if (api.isLocked()) return;
    const typed = inputs.map(i => i.el.value).join('');
    const ok = typed.length === hidden.length && inputs.every(i => i.el.value.toLowerCase() === i.correct.toLowerCase());
    inputs.forEach(i => i.el.classList.add(ok ? 'builder-slot--good' : 'builder-slot--bad'));
    inputs.forEach(i => i.el.disabled = true);
    api.answer(ok, ok ? '✔ Correct! 🎉' : 'Answer: ' + q._reveal);
  }
  /* auto-focus next input */
  inputs.forEach((item, ix) => {
    item.el.addEventListener('input', () => {
      if (item.el.value && ix + 1 < inputs.length) inputs[ix + 1].el.focus();
    });
  });
  setTimeout(() => inputs[0] && inputs[0].el.focus(), 100);
  return h('div.typeq', {},
    h('div.rule-banner', {}, '📝 খালি জায়গা পূরণ করো!'),
    h('div.qtext', { html: richText(q.q) }),
    mediaEl(q),
    q.hint ? h('div.qhint', { html: '💡 ' + richText(q.hint) }) : null,
    h('div.gap-display', {}, display),
    h('form.answer-form', {
      onsubmit: e => { e.preventDefault(); check(); }
    }, h('button.btn.btn--primary.btn--lg', { type: 'submit' }, 'Check ✔')),
    h('button.btn.btn--ghost', {
      onclick: () => { if (!api.isLocked()) { inputs.forEach(i => i.el.disabled = true); api.answer(false, 'Answer: ' + q._reveal); } }
    }, '👁 Reveal'));
}
GameRegistry.register({
  id: 'wordgap', name: 'Word Gap', icon: '📝', color: 'c3',
  desc: 'Word-এর মধ্যে ফাঁকা জায়গা পূরণ করো!',
  mount(root) {
    const packs = DB.packsFor(['word']);
    if (!packs.length) {
      root.append(emptyState('📝', 'No word questions yet!',
        'Bulk upload বা AI দিয়ে word প্রশ্ন যোগ করো।',
        [{ label: '📦 Question Packs', kind: 'primary', onClick: () => App.go('packs') }]));
      return;
    }
    let sel = packs[0].id, count = Math.min(10, packs[0].questions.length);
    const selEl = h('select.inp', { onchange: e => { sel = e.target.value; } },
      packs.map(p => h('option', { value: p.id, ...(p.id === sel ? { selected: '' } : {}) }, `${p.name} (${p.questions.length})`)));
    const countEl = h('input.inp', { type: 'number', min: '1', value: count, oninput: e => count = +e.target.value || 1 });
    const tset = TimerSettings(DB.state.settings);
    root.append(h('section.page', {}, h('div.setup', {},
      h('div.setup__head', {}, h('div.setup__icon', {}, '📝'),
        h('div', {}, h('h2', {}, 'Word Gap'), h('p.muted', {}, 'খালি জায়গা পূরণ করো!'))),
      h('div.setup__grid', {},
        h('label.field', {}, '📦 Pack', selEl),
        h('label.field', {}, '🔢 কতগুলো', countEl),
        tset.el),
      h('button.btn.btn--primary.btn--xl', {
        onclick: () => {
          const p = packs.find(x => x.id === sel);
          const qs = shuffle(p.questions).slice(0, Math.max(1, Math.min(count, p.questions.length)));
          SFX.reveal(); root.replaceChildren();
          new Session({ title: '📝 Word Gap', items: qs, timer: tset.get(), render: gapRender }).mount(root);
        }
      }, '🚀 START GAME'),
      h('div.row', {}, copyPromptBtn('word'), h('button.btn.btn--ghost', { onclick: () => App.go('packs') }, '📦 Manage ➜')))));
  }
});
