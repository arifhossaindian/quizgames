'use strict';
GameRegistry.register({
  id: 'word', name: 'Guess the Word', icon: '🔤', color: 'c3',
  desc: 'Clue পড়ে word guess করো — Bangla বা English।',
  mount(root) {
    const packs = DB.packsFor(['word']);
    if (!packs.length) {
      root.append(emptyState('🔤', 'No questions yet!',
        'Bulk upload বা AI দিয়ে word প্রশ্ন যোগ করো।',
        [{ label: '📦 Question Packs', kind: 'primary', onClick: () => App.go('packs') }]));
      return;
    }
    let sel = packs[0].id, count = Math.min(10, packs[0].questions.length);
    const selEl = h('select.inp', { onchange: e => { sel = e.target.value; } },
      packs.map(p => h('option', { value: p.id, ...(p.id === sel ? { selected: '' } : {}) }, `${p.name} · ${p.subject || '—'} (${p.questions.length})`)));
    const countEl = h('input.inp', { type: 'number', min: '1', value: count, oninput: e => count = +e.target.value || 1 });
    const tset = TimerSettings(DB.state.settings);
    root.append(h('section.page', {}, h('div.setup', {},
      h('div.setup__head', {}, h('div.setup__icon', {}, '🔤'),
        h('div', {}, h('h2', {}, 'Guess the Word'), h('p.muted', {}, 'Clue পড়ে word বলো'))),
      h('div.setup__grid', {},
        h('label.field', {}, '📦 Pack', selEl),
        h('label.field', {}, '🔢 কতগুলো প্রশ্ন', countEl),
        tset.el),
      h('button.btn.btn--primary.btn--xl', {
        onclick: () => {
          const p = packs.find(x => x.id === sel);
          const qs = shuffle(p.questions).slice(0, Math.max(1, Math.min(count, p.questions.length)));
          SFX.reveal(); root.replaceChildren();
          new Session({ title: '🔤 Guess the Word', items: qs, timer: tset.get(),
            render: (q, api) => typeRender({ prompt: q.q, q, api })
          }).mount(root);
        }
      }, '🚀 START GAME'),
      h('div.row', {}, copyPromptBtn('word'), h('button.btn.btn--ghost', { onclick: () => App.go('packs') }, '📦 Manage packs ➜')))));
  }
});
