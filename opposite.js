'use strict';
GameRegistry.register({
  id: 'opposite', name: 'Opposite Words', icon: '🔁', color: 'c5',
  desc: 'শব্দ দেখাও — students বিপরীত শব্দ বলবে!',
  mount(root) {
    const packs = DB.packsFor(['opposite']);
    if (!packs.length) {
      root.append(emptyState('🔁', 'No opposite questions yet!',
        'Bulk upload বা AI দিয়ে opposite প্রশ্ন যোগ করো।',
        [{ label: '📦 Question Packs', kind: 'primary', onClick: () => App.go('packs') }]));
      return;
    }
    let sel = packs[0].id, count = Math.min(10, packs[0].questions.length);
    const selEl = h('select.inp', { onchange: e => { sel = e.target.value; } },
      packs.map(p => h('option', { value: p.id, ...(p.id === sel ? { selected: '' } : {}) }, `${p.name} (${p.questions.length})`)));
    const countEl = h('input.inp', { type: 'number', min: '1', value: count, oninput: e => count = +e.target.value || 1 });
    const tset = TimerSettings(DB.state.settings);
    root.append(h('section.page', {}, h('div.setup', {},
      h('div.setup__head', {}, h('div.setup__icon', {}, '🔁'),
        h('div', {}, h('h2', {}, 'Opposite Words'), h('p.muted', {}, 'বিপরীত শব্দ বলো!'))),
      h('div.setup__grid', {},
        h('label.field', {}, '📦 Pack', selEl),
        h('label.field', {}, '🔢 কতগুলো', countEl),
        tset.el),
      h('button.btn.btn--primary.btn--xl', {
        onclick: () => {
          const p = packs.find(x => x.id === sel);
          const qs = shuffle(p.questions).slice(0, Math.max(1, Math.min(count, p.questions.length)));
          SFX.reveal(); root.replaceChildren();
          new Session({ title: '🔁 Opposite Words', items: qs, timer: tset.get(),
            render: (q, api) => typeRender({ prompt: q.word, big: true, banner: '🔁 Say the OPPOSITE!', q, api })
          }).mount(root);
        }
      }, '🚀 START GAME'),
      h('div.row', {}, copyPromptBtn('opposite'), h('button.btn.btn--ghost', { onclick: () => App.go('packs') }, '📦 Manage ➜')))));
  }
});