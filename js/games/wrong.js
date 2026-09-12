'use strict';
GameRegistry.register({
  id: 'wrong', name: 'Wrong Answer Only', icon: '🚫', color: 'c4',
  desc: 'উল্টো খেলা! সঠিক উত্তর এড়িয়ে ভুল অপশন বেছে নাও।',
  mount(root) {
    const packs = DB.packsFor(['mcq']);
    if (!packs.length) {
      root.append(emptyState('🚫', 'No mcq questions yet!',
        'Bulk upload বা AI দিয়ে mcq প্রশ্ন যোগ করো।',
        [{ label: '📦 Question Packs', kind: 'primary', onClick: () => App.go('packs') }]));
      return;
    }
    let sel = packs[0].id, count = Math.min(10, packs[0].questions.length);
    const selEl = h('select.inp', { onchange: e => { sel = e.target.value; } },
      packs.map(p => h('option', { value: p.id, ...(p.id === sel ? { selected: '' } : {}) }, `${p.name} (${p.questions.length})`)));
    const countEl = h('input.inp', { type: 'number', min: '1', value: count, oninput: e => count = +e.target.value || 1 });
    const tset = TimerSettings(DB.state.settings);
    root.append(h('section.page', {}, h('div.setup', {},
      h('div.setup__head', {}, h('div.setup__icon', {}, '🚫'),
        h('div', {}, h('h2', {}, 'Wrong Answer Only'), h('p.muted', {}, 'ভুল অপশন বেছে নাও!'))),
      h('div.setup__grid', {},
        h('label.field', {}, '📦 Pack', selEl),
        h('label.field', {}, '🔢 কতগুলো', countEl),
        tset.el),
      h('button.btn.btn--primary.btn--xl', {
        onclick: () => {
          const p = packs.find(x => x.id === sel);
          const qs = shuffle(p.questions).slice(0, Math.max(1, Math.min(count, p.questions.length)));
          SFX.reveal(); root.replaceChildren();
          new Session({ title: '🚫 Wrong Answer Only', items: qs, timer: tset.get(),
            render: (q, api) => mcqRender(q, api, { invert: true }) }).mount(root);
        }
      }, '🚀 START GAME'),
      h('div.row', {}, copyPromptBtn('mcq'), h('button.btn.btn--ghost', { onclick: () => App.go('packs') }, '📦 Manage ➜')))));
  }
});
