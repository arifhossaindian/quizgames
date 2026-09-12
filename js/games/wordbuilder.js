'use strict';
function builderRender(q, api) {
  q._reveal = String(q.answer).split('|')[0];
  const answer = q._reveal;
  const letters = shuffle(answer.toUpperCase().split(''));
  const slots = [];
  const letterBtns = [];
  const slotRow = h('div.builder-slots');
  const letterRow = h('div.builder-letters');
  letters.forEach((L, i) => {
    const btn = h('button.builder-letter', {
      onclick: () => {
        if (api.isLocked() || btn.disabled) return;
        const empty = slots.find(s => s.val === null);
        if (!empty) return;
        empty.val = L; empty.from = i;
        empty.el.textContent = L;
        btn.disabled = true;
        SFX.click();
        check();
      }
    }, L);
    letterBtns.push(btn);
    letterRow.append(btn);
  });
  for (let i = 0; i < answer.length; i++) {
    const slot = { val: null, from: -1, el: h('div.builder-slot', {
      onclick: () => {
        if (api.isLocked() || slot.val === null) return;
        letterBtns[slot.from].disabled = false;
        slot.val = null; slot.from = -1; slot.el.textContent = '';
        SFX.click();
      }
    }) };
    slots.push(slot);
    slotRow.append(slot.el);
  }
  function check() {
    if (slots.some(s => s.val === null)) return;
    const typed = slots.map(s => s.val).join('');
    const ok = accepts(typed, q.answer);
    slots.forEach(s => s.el.classList.add(ok ? 'builder-slot--good' : 'builder-slot--bad'));
    letterBtns.forEach(b => b.disabled = true);
    api.answer(ok, ok ? '✔ Correct! 🎉' : 'Answer: ' + q._reveal);
  }
  return h('div.typeq', {},
    h('div.rule-banner', {}, '🧩 Letters গুলো ঠিকঠাক সাজাও!'),
    h('div.qtext', { html: richText(q.q) }),
    mediaEl(q),
    q.hint ? h('div.qhint', { html: '💡 ' + richText(q.hint) }) : null,
    slotRow, letterRow,
    h('button.btn.btn--ghost', { style: { marginTop: '14px' },
      onclick: () => {
        slots.forEach(s => { if (s.val !== null) { letterBtns[s.from].disabled = false; s.val = null; s.from = -1; s.el.textContent = ''; } });
      }
    }, '🔄 Shuffle'),
    h('button.btn.btn--ghost', {
      onclick: () => { if (!api.isLocked()) { letterBtns.forEach(b => b.disabled = true); api.answer(false, 'Answer: ' + q._reveal); } }
    }, '👁 Reveal'));
}
GameRegistry.register({
  id: 'wordbuilder', name: 'Word Builder', icon: '🧩', color: 'c3',
  desc: 'ছড়ানো letters সাজিয়ে word বানাও!',
  mount(root) {
    const packs = DB.packsFor(['word']);
    if (!packs.length) {
      root.append(emptyState('🧩', 'No word questions yet!',
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
      h('div.setup__head', {}, h('div.setup__icon', {}, '🧩'),
        h('div', {}, h('h2', {}, 'Word Builder'), h('p.muted', {}, 'Scrambled letters ঠিকঠাক সাজিয়ে word বানাও!'))),
      h('div.setup__grid', {},
        h('label.field', {}, '📦 Pack', selEl),
        h('label.field', {}, '🔢 কতগুলো', countEl),
        tset.el),
      h('button.btn.btn--primary.btn--xl', {
        onclick: () => {
          const p = packs.find(x => x.id === sel);
          const qs = shuffle(p.questions).slice(0, Math.max(1, Math.min(count, p.questions.length)));
          SFX.reveal(); root.replaceChildren();
          new Session({ title: '🧩 Word Builder', items: qs, timer: tset.get(), render: builderRender }).mount(root);
        }
      }, '🚀 START GAME'),
      h('div.row', {}, copyPromptBtn('word'), h('button.btn.btn--ghost', { onclick: () => App.go('packs') }, '📦 Manage ➜')))));
  }
});
