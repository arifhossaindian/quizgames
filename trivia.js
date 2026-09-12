'use strict';
function triviaRender(q, api) {
  q._reveal = q.answer === 0 || q.answer === true || /^(true|yes|হ্যাঁ|সত্য)$/i.test(q.answer) ? 'TRUE' : 'FALSE';
  const isTrue = q._reveal === 'TRUE';
  const btnT = h('button.opt.opt--tf', { onclick: () => pick(true) }, h('span.opt__key', {}, '✓'), h('span.opt__txt', {}, 'TRUE'));
  const btnF = h('button.opt.opt--tf', { onclick: () => pick(false) }, h('span.opt__key', {}, '✗'), h('span.opt__txt', {}, 'FALSE'));
  function pick(picked) {
    if (api.isLocked()) return;
    const ok = picked === isTrue;
    btnT.disabled = btnF.disabled = true;
    if (isTrue) btnT.classList.add('opt--right'); else btnF.classList.add('opt--right');
    if (picked !== isTrue) (picked ? btnT : btnF).classList.add('opt--wrong');
    api.answer(ok, ok ? '✔ Correct! 🎉' : 'Answer: ' + q._reveal);
  }
  return h('div.mcq', {},
    h('div.rule-banner', {}, '⚡ True না False?'),
    h('div.qtext.qtext--xl', { html: richText(q.q) }),
    mediaEl(q),
    q.hint ? h('div.qhint', { html: '💡 ' + richText(q.hint) }) : null,
    h('div.opts', {}, btnT, btnF));
}
GameRegistry.register({
  id: 'trivia', name: 'Rapid True/False', icon: '⚡', color: 'c6',
  desc: 'দ্রুত True/False — প্রতি প্রশ্নে ২ অপশন, fast-paced!',
  mount(root) {
    const packs = DB.packsFor(['tf']);
    if (!packs.length) {
      root.append(emptyState('⚡', 'No True/False questions yet!',
        'AI দিয়ে "tf" type প্রশ্ন যোগ করো — JSON: {"type":"tf","q":"statement","answer":true}',
        [{ label: '📦 Question Packs', kind: 'primary', onClick: () => App.go('packs') }]));
      return;
    }
    let sel = packs[0].id, count = Math.min(15, packs[0].questions.length);
    const selEl = h('select.inp', { onchange: e => { sel = e.target.value; } },
      packs.map(p => h('option', { value: p.id, ...(p.id === sel ? { selected: '' } : {}) }, `${p.name} (${p.questions.length})`)));
    const countEl = h('input.inp', { type: 'number', min: '1', value: count, oninput: e => count = +e.target.value || 1 });
    const tset = TimerSettings(DB.state.settings);
    root.append(h('section.page', {}, h('div.setup', {},
      h('div.setup__head', {}, h('div.setup__icon', {}, '⚡'),
        h('div', {}, h('h2', {}, 'Rapid True/False'), h('p.muted', {}, 'Fast-paced True/False!'))),
      h('div.setup__grid', {},
        h('label.field', {}, '📦 Pack', selEl),
        h('label.field', {}, '🔢 কতগুলো', countEl),
        tset.el),
      h('button.btn.btn--primary.btn--xl', {
        onclick: () => {
          const p = packs.find(x => x.id === sel);
          const qs = shuffle(p.questions).slice(0, Math.max(1, Math.min(count, p.questions.length)));
          SFX.reveal(); root.replaceChildren();
          new Session({ title: '⚡ Rapid True/False', items: qs, timer: tset.get(), render: triviaRender }).mount(root);
        }
      }, '🚀 START GAME'),
      h('div.row', {}, copyPromptBtn('tf'), h('button.btn.btn--ghost', { onclick: () => App.go('packs') }, '📦 Manage ➜')))));
  }
});