'use strict';
/* ============================================================
 * QuizArena · router + views (home, packs, image lab, settings)
 * ============================================================ */
const App = (() => {
  let current = null;

  function render() {
    if (window.__qaCleanup) { window.__qaCleanup(); window.__qaCleanup = null; }
    const v = location.hash.slice(1) || 'home';
    const root = $('#view');
    root.replaceChildren();
    $$('.topnav button').forEach(b => b.classList.toggle('on', b.dataset.nav === v));
    if (v === 'home') return viewHome(root);
    if (v === 'packs') return viewPacks(root);
    if (v === 'images') return viewImages(root);
    if (v === 'settings') return viewSettings(root);
    const g = GAMES.find(x => x.id === v);
    if (g) { current = g; g.mount(root); } else viewHome(root);
  }

  /* ---------------- HOME ---------------- */
  function viewHome(root) {
    const st = DB.stats();
    const imgStat = h('div.stat', {}, h('b', {}, '…'), h('span', {}, '🖼️ Images'));
    DB.allImages().then(a => imgStat.querySelector('b').textContent = a.length).catch(() => imgStat.querySelector('b').textContent = '0');
    root.append(h('section.page', {},
      h('div.hero', {},
        h('h1.hero__title', {}, 'Choose Your ', h('span.grad', {}, 'Game')),
        h('p.hero__sub', {}, 'ক্লাস বা প্রাইভেটের জন্য all-in-one quiz arena — spin, images, words, opposites, সবকিছু timer সহ।')),
      h('div.gamegrid', {}, GAMES.map((g, i) =>
        h(`button.gamecard.gc--${g.color}`, { style: { '--d': i * 70 + 'ms' }, onclick: () => App.go(g.id) },
          h('div.gamecard__icon', {}, g.icon),
          h('div.gamecard__name', {}, g.name),
          h('div.gamecard__desc', {}, g.desc),
          h('div.gamecard__play', {}, 'PLAY ➜')))),
      h('div.stats', {},
        h('div.stat', {}, h('b', {}, String(st.packs)), h('span', {}, '📦 Packs')),
        h('div.stat', {}, h('b', {}, String(st.questions)), h('span', {}, '❓ Questions')),
        imgStat),
      h('div.howto', {},
        h('b', {}, '🚀 Quick start: '),
        '১) Question Packs → ✨ AI Generate বা 📥 Bulk Upload দিয়ে প্রশ্ন ঢালো · ',
        '২) Image Lab → ছবি upload করে label দাও · ',
        '৩) যেকোনো গেম বেছে timer set করে খেলা শুরু করো!')));
  }

  /* ---------------- PACKS ---------------- */
  const SAMPLE_JSON = JSON.stringify({
    name: "Example Pack — General Knowledge",
    subject: "GK",
    questions: [
      { type: "mcq", q: "Which is the largest planet in the Solar System?", options: ["Earth", "Jupiter", "Mars", "Venus"], answer: 1, hint: "It has a great red spot" },
      { type: "mcq", q: "What is the capital of Bangladesh?", options: ["Chattogram", "Sylhet", "Dhaka", "Khulna"], answer: 2 },
      { type: "word", q: "I have a trunk but I'm not a tree. I am the largest land animal. Who am I?", answer: "Elephant", hint: "Grey & huge" },
      { type: "word", q: "Which bird lays the largest egg?", answer: "Ostrich" },
      { type: "opposite", word: "Hot", answer: "Cold" },
      { type: "opposite", word: "Ancient", answer: "Modern|New" }
    ]
  }, null, 2);

  function packCard(p, redraw) {
    const counts = { mcq: 0, word: 0, opposite: 0 };
    p.questions.forEach(q => counts[q.type] = (counts[q.type] || 0) + 1);
    return h('div.pack', {},
      h('div.pack__head', {},
        h('div', {}, h('div.pack__name', {}, p.name), h('div.muted', {}, p.subject || '—')),
        h('div.chips', {}, Object.entries(counts).filter(([, n]) => n).map(([t, n]) => h(`span.chip.chip--${t}`, {}, `${t} ×${n}`)))),
      h('div.pack__actions', {},
        h('button.btn.btn--ghost.btn--sm', {
          onclick: () => download(slug(p.name) + '.quizarena.json',
            JSON.stringify({ name: p.name, subject: p.subject, questions: p.questions }, null, 2))
        }, '⬇ Export'),
        h('button.btn.btn--ghost.btn--sm', { onclick: async () => { if (await confirmDlg(`"${p.name}" ও তার ${p.questions.length}টা প্রশ্ন মুছে ফেলবে?`)) { DB.deletePack(p.id); toast('Pack deleted'); redraw(); } } }, '🗑 Delete')));
  }

  function viewPacks(root) {
    const list = h('div.packlist');
    const redraw = () => {
      list.replaceChildren(...DB.state.packs.map(p => packCard(p, redraw)));
      if (!DB.state.packs.length)
        list.append(h('div.empty', {}, h('div.empty__icon', {}, '📦'), h('p.muted', {}, 'কোনো pack নেই — Bulk Upload বা AI Generate চাপো!')));
    };
    root.append(h('section.page', {},
      h('div.pagehead', {},
        h('div', {}, h('h2', {}, '📦 Question Packs'), h('p.muted', {}, 'Bulk upload · AI generate · export · সব এক জায়গায়')),
        h('div.row', {},
          h('button.btn.btn--primary', { onclick: () => bulkModal(redraw) }, '📥 Bulk Upload'),
          h('button.btn.btn--ai', { onclick: () => aiModal(redraw) }, '✨ AI Generate'))),
      list));
    redraw();
  }

  function bulkModal(onDone) {
    const nameI = h('input.inp', { placeholder: 'Pack name (optional)' });
    const ta = h('textarea.inp.ta', { placeholder: 'JSON বা CSV এখানে paste করো…', spellcheck: 'false' });
    const body = h('div', {},
      h('label.field', {}, 'Pack name', nameI),
      h('label.field', {}, 'Questions (JSON or CSV)', ta),
      h('details.help', {},
        h('summary', {}, '📖 Format help — AI-কে বোলো এভাবে দিতে'),
        h('p.muted', {}, 'JSON format:'),
        h('pre.code', {}, SAMPLE_JSON),
        h('p.muted', {}, 'অথবা CSV format (header: type,q,answer,options,hint — options "|" দিয়ে আলাদা, mcq answer = index 0-3):'),
        h('pre.code', {}, 'type,q,answer,options,hint\nmcq,"Capital of Bangladesh?",2,"Chattogram|Sylhet|Dhaka|Khulna",\nword,"Largest planet?",Jupiter,,\nopposite,Hot,Cold,,'),
        h('p.hint', {}, '💡 word/opposite-এ একাধিক গ্রহণযোগ্য উত্তর হলে "|" দাও: "Modern|New"')),
      h('button.btn.btn--ghost.btn--sm', {
        onclick: () => {
          navigator.clipboard.writeText(AI.buildPrompt({ topic: '[TOPIC]', grade: '[CLASS]', lang: 'English', n: { mcq: 10, word: 10, opp: 10 } }));
          toast('AI prompt copied! ChatGPT/Gemini/যেকোনো AI-কে দাও,结果 এখানে paste করো', 'success', 4000);
        }
      }, '📋 Copy prompt for any AI'));

    modal({
      title: '📥 Bulk Upload Questions', body, wide: true,
      actions: [
        { label: 'Load Sample', kind: 'ghost', keepOpen: true, onClick: () => { ta.value = SAMPLE_JSON; } },
        {
          label: '💾 Save Pack', kind: 'primary', keepOpen: true, onClick: close => {
            try {
              const pack = AI.parseBulk(ta.value);
              if (nameI.value.trim()) pack.name = nameI.value.trim();
              if (!pack.questions.length) throw new Error('কোনো valid প্রশ্ন পাওয়া যায়নি — format চেক করো');
              DB.addPack(pack);
              SFX.correct();
              toast(`Saved "${pack.name}" — ${pack.questions.length} questions${pack.skipped ? ` (${pack.skipped} skipped)` : ''}`, 'success', 4000);
              onDone && onDone();
              close(true);
            } catch (e) { toast(e.message || 'Parse failed', 'error', 5000); }
          }
        }]
    });
  }

  /* ---------------- AI GENERATOR ---------------- */
  function aiModal(onDone) {
    const topic = h('input.inp', { placeholder: 'e.g. Solar System / প্রাণীজগৎ / Bangladesh…' });
    const grade = h('input.inp', { value: 'Class 5', placeholder: 'e.g. Class 5' });
    const lang = h('select.inp', {}, h('option', { value: 'English' }, 'English'), h('option', { value: 'Bangla' }, 'বাংলা (Bangla)'));
    const nM = h('input.inp', { type: 'number', min: '0', max: '25', value: '5' });
    const nW = h('input.inp', { type: 'number', min: '0', max: '25', value: '5' });
    const nO = h('input.inp', { type: 'number', min: '0', max: '25', value: '5' });
    const getN = () => ({ mcq: Math.max(0, +nM.value || 0), word: Math.max(0, +nW.value || 0), opp: Math.max(0, +nO.value || 0) });

    const fields = h('div', {},
      h('div.row', {}, h('label.field', {}, '🎯 Topic', topic), h('label.field', {}, '🎓 Class / Grade', grade)),
      h('div.row', {}, h('label.field', {}, '🌐 Language', lang),
        h('label.field', {}, 'MCQ', nM), h('label.field', {}, 'Word', nW), h('label.field', {}, 'Opposite', nO)));

    let pack = null;
    const preview = h('div.ai-preview', {}, h('p.muted', {}, 'Generate করলে এখানে preview দেখাবে…'));
    function showPack(p) {
      pack = p;
      preview.replaceChildren(h('div', {},
        h('p', {}, h('b', {}, p.name), ' — ', String(p.questions.length), ' questions', p.skipped ? h('span.badge', {}, p.skipped + ' invalid skipped') : ''),
        h('div.qprev', {}, p.questions.slice(0, 80).map(q =>
          h('div.qprev__i', {}, h(`span.chip.chip--${q.type}`, {}, q.type), q.q || q.word)))));
    }

    const genBtn = h('button.btn.btn--ai.btn--lg', {
      onclick: async () => {
        if (!topic.value.trim()) return toast('আগে topic লেখো!', 'error');
        genBtn.disabled = true;
        genBtn.innerHTML = '<span class="spinner"></span> Generating…';
        try {
          const p = await AI.generate({ apiKey: DB.state.settings.apiKey, model: DB.state.settings.model, topic: topic.value.trim(), grade: grade.value.trim(), lang: lang.value, n: getN() });
          if (!p.questions.length) throw new Error('AI কোনো valid প্রশ্ন দেয়নি — আবার চেষ্টা করো');
          showPack(p); SFX.correct(); toast('Generated! Review করে Save করো।', 'success');
        } catch (e) { toast('AI error: ' + e.message, 'error', 6000); }
        genBtn.disabled = false; genBtn.textContent = '✨ Generate with Groq';
      }
    }, '✨ Generate with Groq');

    const promptTa = h('textarea.inp.ta', { readonly: '' });
    const pasteTa = h('textarea.inp.ta', { placeholder: 'AI-এর দেওয়া JSON এখানে paste করো…' });
    const refreshPrompt = () => promptTa.value = AI.buildPrompt({ topic: topic.value || '[TOPIC]', grade: grade.value || '[CLASS]', lang: lang.value, n: getN() });
    [topic, grade, lang, nM, nW, nO].forEach(el => el.addEventListener('input', refreshPrompt));
    refreshPrompt();

    const autoPane = h('div', {}, h('div.row', {}, genBtn),
      h('p.hint', {}, 'Settings-এর Groq API key ও model ব্যবহার হবে। Child-safe rules prompt-এ baked in আছে.'));
    const manPane = h('div.hide', {},
      h('label.field', {}, '1️⃣ এই prompt যেকোনো AI-কে দাও (ChatGPT, Gemini, Groq Playground…)', promptTa),
      h('button.btn.btn--ghost.btn--sm', { onclick: () => { navigator.clipboard.writeText(promptTa.value); toast('Prompt copied!', 'success'); } }, '📋 Copy prompt'),
      h('label.field', {}, '2️⃣ AI-এর উত্তর এখানে paste করো', pasteTa),
      h('button.btn.btn--ghost.btn--sm', { onclick: () => { try { showPack(AI.parseBulk(pasteTa.value)); SFX.correct(); } catch (e) { toast(e.message, 'error'); } } }, '🔍 Parse result'));

    const tA = h('button.seg.on', { onclick: () => tab(0) }, '🤖 Auto (Groq)');
    const tB = h('button.seg', { onclick: () => tab(1) }, '📋 Any AI (copy-paste)');
    function tab(i) {
      tA.classList.toggle('on', !i); tB.classList.toggle('on', !!i);
      autoPane.classList.toggle('hide', !!i); manPane.classList.toggle('hide', !i);
      refreshPrompt();
    }

    modal({
      title: '✨ AI Question Generator', wide: true,
      body: h('div', {}, fields, h('div.segwrap', { style: { margin: '14px 0' } }, tA, tB), autoPane, manPane, h('h4', {}, 'Preview'), preview),
      actions: [{
        label: '💾 Save as Pack', kind: 'primary', keepOpen: true, onClick: close => {
          if (!pack || !pack.questions.length) return toast('আগে generate/parse করো', 'error');
          DB.addPack(pack);
          toast(`Pack saved — ${pack.questions.length} questions!`, 'success');
          SFX.correct(); onDone && onDone(); close(true);
        }
      }]
    });
  }

  /* ---------------- IMAGE LAB ---------------- */
  async function viewImages(root) {
    const grid = h('div.imggrid');
    async function redraw() {
      const imgs = await DB.allImages();
      grid.replaceChildren(...imgs.sort((a, b) => (b.added || 0) - (a.added || 0)).map(im => h('div.imgcard', {},
        h('img', { src: im.data, alt: '' }),
        h('div.imgcard__f', {},
          h('input.inp', { value: im.label || '', placeholder: 'Label (answer) *', onchange: e => DB.updateImage(im.id, { label: e.target.value.trim() }) }),
          h('input.inp', { value: im.hint || '', placeholder: 'Hint (optional)', onchange: e => DB.updateImage(im.id, { hint: e.target.value.trim() }) }),
          h('button.btn.btn--ghost.btn--sm', {
            onclick: async () => { if (await confirmDlg(`"${im.label || im.name}" মুছে ফেলবে?`)) { await DB.delImage(im.id); toast('Image deleted'); redraw(); } }
          }, '🗑 Delete')))));
      if (!imgs.length) grid.append(h('p.muted', {}, 'এখনো কোনো ছবি নেই — নিচে drop করো!'));
    }
    const fileInp = h('input.hide', { type: 'file', accept: 'image/*', multiple: '', onchange: e => { addFiles(e.target.files); e.target.value = ''; } });
    async function addFiles(files) {
      let n = 0;
      for (const f of files) {
        if (!f.type.startsWith('image/')) continue;
        try {
          const data = await fileToThumb(f);
          await DB.putImage({ id: uid('img'), label: '', hint: '', data, name: f.name, added: Date.now() });
          n++;
        } catch (e) { console.warn(e); }
      }
      if (n) { SFX.correct(); toast(`${n}টা ছবি যোগ হয়েছে — এখন Label (উত্তর) বসাও!`, 'success'); redraw(); }
    }
    const dz = h('div.drop
