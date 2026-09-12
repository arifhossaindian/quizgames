'use strict';
GameRegistry.register({
  id: 'mood', name: 'Mood Mode', icon: '🎲', color: 'c7',
  desc: 'Select করা games থেকে random rotation — একবারে সব!',
  async mount(root) {
    /* যেসব game session-based (spin/image বাদ) */
    const available = GAMES.filter(g => ['image', 'word', 'wordbuilder', 'wordgap', 'wrong', 'opposite', 'trivia'].includes(g.id));
    const images = (await DB.allImages()).filter(i => i.data && i.label);
    const selected = new Set(available.map(g => g.id));
    let total = 15;

    const gameList = h('div.mood-games');
    available.forEach(g => {
      const card = h('label.mood-card', {},
        h('input', {
          type: 'checkbox', checked: '',
          onchange: e => { card.classList.toggle('on', e.target.checked); e.target.checked ? selected.add(g.id) : selected.delete(g.id); SFX.click(); }
        }),
        h('div.mood-card__icon', {}, g.icon),
        h('div.mood-card__name', {}, g.name));
      card.classList.add('on');
      gameList.append(card);
    });

    const totalEl = h('input.inp', { type: 'number', min: '3', max: '50', value: total, oninput: e => total = +e.target.value || 15 });
    const tset = TimerSettings(DB.state.settings);

    root.append(h('section.page', {}, h('div.setup', {},
      h('div.setup__head', {}, h('div.setup__icon', {}, '🎲'),
        h('div', {}, h('h2', {}, '🎲 Mood Mode'), h('p.muted', {}, 'Selected games থেকে random rotation — এক session-এ সব খেলা!'))),
      h('p.muted', {}, '✅ কোন কোন game rotation-এ থাকবে:'),
      gameList,
      h('div.setup__grid', { style: { marginTop: '20px' } },
        h('label.field', {}, '🔢 Total rounds', totalEl),
        tset.el),
      h('button.btn.btn--primary.btn--xl', {
        onclick: async () => {
          if (selected.size === 0) return toast('কমপক্ষে একটা game select করো!', 'error');
          const pool = available.filter(g => selected.has(g.id));
          if (pool.length === 0) return toast('কোনো game নেই', 'error');
          const rounds = [];
          for (let i = 0; i < total; i++) {
            const g = pool[Math.floor(Math.random() * pool.length)];
            rounds.push(g);
          }
          SFX.reveal(); root.replaceChildren();
          runMood(root, rounds, tset.get(), images);
        }
      }, '🚀 START MOOD MODE'),
      h('button.btn.btn--ghost', { onclick: () => App.go('home') }, '🏠 Home'))));
  }
});

async function runMood(root, games, timer, images) {
  const ui = h('div.session', {},
    h('div.session__top', {},
      h('button.btn.btn--ghost.btn--sm', { onclick: quit }, '✕ Quit'),
      h('div.session__title', {}, '🎲 Mood Mode'),
      h('div.session__prog'),
      h('div.score-chip', {}, '⭐ 0')));
  root.append(ui);
  let round = 0, score = 0;
  async function next() {
    if (round >= games.length) return finish();
    const g = games[round];
    round++;
    ui.querySelector('.session__prog').textContent = `Round ${round} / ${games.length}`;
    ui.querySelector('.score-chip').textContent = '⭐ ' + score;
    /* banner */
    const banner = h('div.mood-banner', {}, h('span', {}, g.icon), h('b', {}, g.name));
    ui.append(banner);
    /* fetch items based on game type */
    const items = await fetchItemsFor(g.id, images);
    if (!items) { toast(g.name + ' এর জন্য question নেই, skipping…', 'error'); return next(); }
    /* mount session */
    const mount = h('div');
    ui.append(mount);
    const sess = new Session({
      title: g.icon + ' ' + g.name,
      items: [items],
      timer,
      render: getRenderer(g.id)
    });
    const origFinish = sess.finish.bind(sess);
    sess.finish = function() {
      if (sess.score > 0) score += sess.score;
      sess.timer.destroy();
      window.__qaCleanup = null;
      banner.remove();
      mount.remove();
      next();
    };
    /* override next button to go to next mood round, not finish session */
    sess.next = function() {
      SFX.click();
      if (sess.i + 1 < sess.items.length) {
        sess.show(sess.i + 1);
      } else {
        sess.finish();
      }
    };
    sess.mount(mount);
  }
  function finish() {
    SFX.win(); confetti(3000, 1.2);
    const pct = Math.round(score / games.length * 100);
    const msg = pct >= 80 ? 'Legendary! 🔥' : pct >= 50 ? 'Well played! 🎉' : 'Keep practising! 💪';
    ui.replaceChildren(h('div.endscreen', {},
      h('div.endscreen__badge', {}, pct >= 50 ? '🏆' : '🎯'),
      h('h2', {}, msg),
      h('div.endscreen__score', {}, String(score), h('span', {}, `/ ${games.length} · ${pct}%`)),
      h('div.endscreen__btns', {},
        h('button.btn.btn--primary.btn--lg', { onclick: () => App.replay() }, '🔁 Play Again'),
        h('button.btn.btn--ghost.btn--lg', { onclick: () => App.go('home') }, '🏠 Home'))));
  }
  function quit() { App.go('home'); }
  next();
}

async function fetchItemsFor(gameId, images) {
  const getPackQs = (type, n) => {
    const packs = DB.packsFor([type]);
    if (!packs.length) return null;
    const p = packs[Math.floor(Math.random() * packs.length)];
    return shuffle(p.questions).slice(0, n)[0] || null;
  };
  if (gameId === 'image') {
    if (!images.length) return null;
    const q = images[Math.floor(Math.random() * images.length)];
    return q;
  }
  if (gameId === 'word') return getPackQs('word', 1);
  if (gameId === 'wordbuilder') return getPackQs('word', 1);
  if (gameId === 'wordgap') return getPackQs('word', 1);
  if (gameId === 'wrong') return getPackQs('mcq', 1);
  if (gameId === 'opposite') return getPackQs('opposite', 1);
  if (gameId === 'trivia') return getPackQs('tf', 1);
  return null;
}

function getRenderer(gameId) {
  /* reuse existing renderers via global functions */
  if (gameId === 'image') return function(q, api) {
    /* simplified inline */
    q._reveal = q.label;
    const visual = h('div.gimg-wrap', {}, h('img.gimg', { src: q.data, alt: '?' }));
    const input = h('input.inp.inp--lg', { placeholder: 'Type answer…', autocomplete: 'off' });
    return h('div.imgq', {}, visual,
      q.hint ? h('div.qhint', { html: '💡 ' + richText(q.hint) }) : null,
      h('form.answer-form', {
        onsubmit: e => {
          e.preventDefault();
          if (api.isLocked()) return;
          const ok = accepts(input.value, q.label);
          input.disabled = true;
          api.answer(ok, ok ? '✔ Correct! 🎉' : 'Answer: ' + q.label);
        }
      }, input, h('button.btn.btn--primary.btn--lg', { type: 'submit' }, 'Check ✔')));
  };
  if (gameId === 'word') return (q, api) => typeRender({ prompt: q.q, q, api });
  if (gameId === 'wordbuilder') return (q, api) => {
    /* inline builder */
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
          if (slots.every(s => s.val !== null)) {
            const typed = slots.map(s => s.val).join('');
            const ok = accepts(typed, q.answer);
            slots.forEach(s => s.el.classList.add(ok ? 'builder-slot--good' : 'builder-slot--bad'));
            letterBtns.forEach(b => b.disabled = true);
            api.answer(ok, ok ? '✔ Correct! 🎉' : 'Answer: ' + q._reveal);
          }
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
    return h('div.typeq', {},
      h('div.rule-banner', {}, '🧩 Letters ঠিকঠাক সাজাও!'),
      h('div.qtext', { html: richText(q.q) }),
      slotRow, letterRow);
  };
  if (gameId === 'wordgap') return (q, api) => {
    q._reveal = String(q.answer).split('|')[0];
    const full = q._reveal;
    const n = Math.max(1, Math.min(full.length - 1, Math.round(full.length * 0.4)));
    const positions = [];
    while (positions.length < n) {
      const p = Math.floor(Math.random() * full.length);
      if (!positions.includes(p) && full[p] !== ' ') positions.push(p);
    }
    const inputs = [];
    const display = [];
    for (let i = 0; i < full.length; i++) {
      if (full[i] === ' ') display.push(h('span.builder-gap', {}, '\u00A0'));
      else if (positions.includes(i)) {
        const inp = h('input.builder-gap', { maxlength: '1', autocomplete: 'off', autocapitalize: 'off' });
        inputs.push({ el: inp, correct: full[i] });
        display.push(inp);
      } else display.push(h('span.builder-gap', {}, full[i]));
    }
    setTimeout(() => inputs[0] && inputs[0].el.focus(), 100);
    return h('div.typeq', {},
      h('div.rule-banner', {}, '📝 Fill the blanks'),
      h('div.qtext', { html: richText(q.q) }),
      h('div.gap-display', {}, display),
      h('form.answer-form', {
        onsubmit: e => {
          e.preventDefault();
          if (api.isLocked()) return;
          const ok = inputs.every(i => i.el.value.toLowerCase() === i.correct.toLowerCase());
          inputs.forEach(i => i.el.classList.add(ok ? 'builder-slot--good' : 'builder-slot--bad'));
          inputs.forEach(i => i.el.disabled = true);
          api.answer(ok, ok ? '✔ Correct! 🎉' : 'Answer: ' + q._reveal);
        }
      }, h('button.btn.btn--primary.btn--lg', { type: 'submit' }, 'Check ✔')));
  };
  if (gameId === 'wrong') return (q, api) => mcqRender(q, api, { invert: true });
  if (gameId === 'opposite') return (q, api) => typeRender({ prompt: q.word, big: true, banner: '🔁 Say the OPPOSITE!', q, api });
  if (gameId === 'trivia') return (q, api) => {
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
      h('div.rule-banner', {}, '⚡ True বা False?'),
      h('div.qtext.qtext--xl', { html: richText(q.q) }),
      h('div.opts', {}, btnT, btnF));
  };
  return () => h('div', {}, 'Unknown game');
}
