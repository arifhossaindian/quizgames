'use strict';
/* ============ QuizArena · router + views ============ */
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

  function viewHome(root) {
    const st = DB.stats();
    const imgStat = h('div.stat', {}, h('b', {}, '…'), h('span', {}, '🖼️ Images'));
    DB.allImages().then(a => imgStat.querySelector('b').textContent = a.length).catch(() => imgStat.querySelector('b').textContent = '0');
    root.append(h('section.page', {},
      h('div.hero', {},
        h('h1.hero__title', {}, 'Choose Your ', h('span.grad', {}, 'Game')),
        h('p.hero__sub', {}, 'ক্লাস বা প্রাইভেটের all-in-one quiz arena — offline-ও চলে! ডান-নিচের 🎡 বাটন দিয়ে যেকোনো সময় student pick করো।')),
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
        '১) Question Packs → ✨ AI / 📊 Sheet / 📥 Bulk Upload · ',
        '২) Image Lab → ছবি upload বা link import · ',
        '৩) গেম বেছে timer set করে খেলো!')));
  }

  /* ---------- PACKS ---------- */
  const SAMPLE_JSON = JSON.stringify({
    name: "Example Pack", subject: "GK",
    questions: [
      { type: "mcq", q: "Largest planet?", options: ["Earth", "Jupiter", "Mars", "Venus"], answer: 1, hint: "Gas giant" },
      { type: "mcq", q: "See this animal: https://upload.wikimedia.org/wikipedia/commons/5/56/Tiger.50.JPG", options: ["Lion", "Tiger", "Leopard", "Cheetah"], answer: 1 },
      { type: "word", q: "I have a trunk but I'm not a tree. Who am I?", answer: "Elephant" },
      { type: "opposite", word: "Hot", answer: "Cold" }
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
        h('button.btn.btn--ghost.btn--sm', { onclick: () => download(slug(p.name) + '.quizarena.json', JSON.stringify({ name: p.name, subject: p.subject, questions: p.questions }, null, 2)) }, '⬇ Export'),
        h('button.btn.btn--ghost.btn--sm', { onclick: async () => { if (await confirmDlg(`"${p.name}" ও তার ${p.questions.length}টা প্রশ্ন মুছে ফেলবে?`)) { DB.deletePack(p.id); toast('Pack deleted'); redraw(); } } }, '🗑 Delete')));
  }

  function viewPacks(root) {
    const list = h('div.packlist');
    const redraw = () => {
      list.replaceChildren(...DB.state.packs.map(p => packCard(p, redraw)));
      if (!DB.state.packs.length)
        list.append(h('div.empty', {}, h('div.empty__icon', {}, '📦'), h('p.muted', {}, 'কোনো pack নেই — Bulk Upload / Sheet / AI চাপো!')));
    };
    root.append(h('section.page', {},
      h('div.pagehead', {},
        h('div', {}, h('h2', {}, '📦 Question Packs'), h('p.muted', {}, 'Bulk · Sheet · AI · export · delete')),
        h('div.row', {},
          h('button.btn.btn--ghost', { onclick: () => sheetModal(redraw) }, '📊 Google Sheet'),
          h('button.btn.btn--primary', { onclick: () => bulkModal(redraw) }, '📥 Bulk Upload'),
          h('button.btn.btn--ai', { onclick: () => aiModal(redraw) }, '✨ AI Generate'))),
      list));
    redraw();
  }

  function saveImported(res, nameI, onDone, close) {
    if (!res.questions.length && !(res.images || []).length) throw new Error('কোনো valid row পাওয়া যায়নি — format চেক করো');
    if (res.questions.length) DB.addPack({ name: nameI.value.trim() || res.name || 'Imported Pack', subject: res.subject || '', questions: res.questions });
    (res.images || []).forEach(im => DB.putImage({ id: uid('img'), label: im.label, hint: im.hint || '', data: im.url, remote: true, added: Date.now() }));
    SFX.correct();
    toast(`Saved! ${res.questions.length} questions${(res.images || []).length ? ' + ' + res.images.length + ' images' : ''}${res.skipped ? ' (' + res.skipped + ' skipped)' : ''}`, 'success', 4500);
    onDone && onDone(); close(true);
  }

  function bulkModal(onDone) {
    const nameI = h('input.inp', { placeholder: 'Pack name (optional)' });
    const ta = h('textarea.inp.ta', { placeholder: 'JSON / CSV / TSV এখানে paste করো…', spellcheck: 'false' });
    modal({
      title: '📥 Bulk Upload Questions', wide: true,
      body: h('div', {},
        h('label.field', {}, 'Pack name', nameI),
        h('label.field', {}, 'Questions (JSON / CSV / TSV)', ta),
        h('details.help', {}, h('summary', {}, '📖 Format help'),
          h('pre.code', {}, SAMPLE_JSON),
          h('p.muted', {}, 'CSV/TSV header: type, q, answer, options, hint, img, audio, video (options "|" দিয়ে; mcq answer = index 0-3; type=image হলে q column-এ label, img column-এ url)')),
        h('button.btn.btn--ghost.btn--sm', { onclick: () => { navigator.clipboard.writeText(AI.gamePrompt('mcq')); toast('MCQ prompt copied!', 'success'); } }, '📋 Copy AI prompt')),
      actions: [
        { label: 'Load Sample', kind: 'ghost', keepOpen: true, onClick: () => { ta.value = SAMPLE_JSON; } },
        { label: '💾 Save Pack', kind: 'primary', keepOpen: true, onClick: close => { try { saveImported(AI.parseBulk(ta.value), nameI, onDone, close); } catch (e) { toast(e.message || 'Parse failed', 'error', 5000); } } }
      ]
    });
  }

  /* ---------- GOOGLE SHEET ---------- */
  function sheetModal(onDone) {
    const urlI = h('input.inp', { value: DB.state.settings.sheetUrl || '', placeholder: 'https://docs.google.com/spreadsheets/d/e/.../pub?output=tsv' });
    const nameI = h('input.inp', { placeholder: 'Pack name (optional)' });
    const prev = h('div.ai-preview', {}, h('p.muted', {}, 'Link দিয়ে Fetch চাপো…'));
    let res = null;
    const fetchBtn = h('button.btn.btn--primary', {
      onclick: async () => {
        fetchBtn.disabled = true; fetchBtn.textContent = 'Fetching…';
        try {
          res = await AI.fetchSheet(urlI.value);
          DB.state.settings.sheetUrl = urlI.value.trim(); DB.save();
          prev.replaceChildren(h('p', {}, h('b', {}, String(res.questions.length)), ' questions + ', h('b', {}, String(res.images.length)), ' images পাওয়া গেছে'),
            h('div.qprev', {}, res.questions.slice(0, 40).map(q => h('div.qprev__i', {}, h(`span.chip.chip--${q.type}`, {}, q.type), q.q || q.word))));
          SFX.correct();
        } catch (e) { toast(e.message, 'error', 6000); }
        fetchBtn.disabled = false; fetchBtn.textContent = '📊 Fetch Sheet';
      }
    }, '📊 Fetch Sheet');
    modal({
      title: '📊 Import from Google Sheet', wide: true,
      body: h('div', {},
        h('p.hint', {}, 'Sheet → File → Share → Publish to web → format: Tab-separated values (.tsv) → Publish → link এখানে paste করো। Header row: type, q, answer, options, hint, img, audio, video'),
        h('label.field', {}, 'Published sheet link', urlI),
        h('label.field', {}, 'Pack name', nameI),
        h('div.row', {}, fetchBtn), prev),
      actions: [{
        label: '💾 Save to Games', kind: 'primary', keepOpen: true, onClick: close => {
          if (!res) return toast('আগে Fetch চাপো', 'error');
          try { saveImported(Object.assign({ name: nameI.value.trim() || 'Sheet Pack' }, res), nameI, onDone, close); }
          catch (e) { toast(e.message, 'error'); }
        }
      }]
    });
  }

  /* ---------- AI GENERATOR (multi-topic + presets + random) ---------- */
  function aiModal(onDone) {
    const chosen = new Set();
    const chipWrap = h('div.topicgrid');
    AI.PRESET_TOPICS.forEach(t => chipWrap.append(h('button.tchip', {
      onclick: e => { chosen.has(t) ? chosen.delete(t) : chosen.add(t); e.target.classList.toggle('on'); SFX.click(); }
    }, t)));
    const rndBtn = h('button.tchip.tchip--rnd', {
      onclick: () => {
        const t = AI.PRESET_TOPICS[Math.random() * AI.PRESET_TOPICS.length | 0];
        chosen.add(t);
        [...chipWrap.children].forEach(c => c.classList.toggle('on', chosen.has(c.textContent)));
        SFX.reveal(); toast('🎲 Random topic: ' + t);
      }
    }, '🎲 Random');

    const custom = h('input.inp', { placeholder: 'নিজের topic (comma দিয়ে একাধিক): e.g. Rivers of BD, Fractions' });
    const grade = h('input.inp', { value: 'Class 5' });
    const lang = h('select.inp', {}, h('option', { value: 'English' }, 'English'), h('option', { value: 'Bangla' }, 'বাংলা (Bangla)'));
    const nM = h('input.inp', { type: 'number', min: '0', max: '25', value: '5' });
    const nW = h('input.inp', { type: 'number', min: '0', max: '25', value: '5' });
    const nO = h('input.inp', { type: 'number', min: '0', max: '25', value: '5' });
    const nTF = h('input.inp', { type: 'number', min: '0', max: '25', value: '5' });
    const getN = () => ({ mcq: Math.max(0, +nM.value || 0), word: Math.max(0, +nW.value || 0), opp: Math.max(0, +nO.value || 0), tf: Math.max(0, +nTF.value || 0) });
    const topics = () => [...chosen, ...custom.value.split(',').map(x => x.trim()).filter(Boolean)].join(', ');

    let pack = null;
    const preview = h('div.ai-preview', {}, h('p.muted', {}, 'Topic tick করে Generate চাপো…'));
    function showPack(p) {
      pack = p;
      preview.replaceChildren(h('div', {},
        h('p', {}, h('b', {}, p.name), ' — ', String(p.questions.length), ' questions', p.skipped ? h('span.badge', {}, p.skipped + ' skipped') : ''),
        h('div.qprev', {}, p.questions.slice(0, 80).map(q => h('div.qprev__i', {}, h(`span.chip.chip--${q.type}`, {}, q.type), q.q || q.word)))));
    }
    const genBtn = h('button.btn.btn--ai.btn--lg', {
      onclick: async () => {
        if (!topics()) return toast('কমপক্ষে একটা topic tick করো!', 'error');
        genBtn.disabled = true; genBtn.innerHTML = '<span class="spinner"></span> Generating…';
        try {
          const p = await AI.generate({ apiKey: DB.state.settings.apiKey, model: DB.state.settings.model, topic: topics(), grade: grade.value.trim(), lang: lang.value, n: getN() });
          if (!p.questions.length) throw new Error('AI valid প্রশ্ন দেয়নি — আবার চেষ্টা করো');
          showPack(p); SFX.correct(); toast('Generated! Review করে Save করো।', 'success');
        } catch (e) { toast('AI error: ' + e.message, 'error', 6000); }
        genBtn.disabled = false; genBtn.textContent = '✨ Generate with Groq';
      }
    }, '✨ Generate with Groq');

    const promptTa = h('textarea.inp.ta', { readonly: '' });
    const pasteTa = h('textarea.inp.ta', { placeholder: 'AI-এর দেওয়া JSON এখানে paste করো…' });
    const refresh = () => promptTa.value = AI.buildPrompt({ topic: topics() || '[TOPIC]', grade: grade.value || '[CLASS]', lang: lang.value, n: getN() });
    [custom, grade, lang, nM, nW, nO].forEach(el => el.addEventListener('input', refresh));
    chipWrap.addEventListener('click', refresh);
    refresh();

    const autoPane = h('div', {}, h('div.row', {}, genBtn), h('p.hint', {}, 'Settings-এর Groq key + model ব্যবহার হবে। Child-safe rules baked in.'));
    const manPane = h('div.hide', {},
      h('label.field', {}, '1️⃣ Prompt (যেকোনো AI-কে দাও)', promptTa),
      h('button.btn.btn--ghost.btn--sm', { onclick: () => { navigator.clipboard.writeText(promptTa.value); toast('Prompt copied!', 'success'); } }, '📋 Copy prompt'),
      h('label.field', {}, '2️⃣ AI-এর উত্তর paste করো', pasteTa),
      h('button.btn.btn--ghost.btn--sm', { onclick: () => { try { showPack(AI.parseBulk(pasteTa.value)); SFX.correct(); } catch (e) { toast(e.message, 'error'); } } }, '🔍 Parse result'));
    const tA = h('button.seg.on', { onclick: () => tab(0) }, '🤖 Auto (Groq)');
    const tB = h('button.seg', { onclick: () => tab(1) }, '📋 Any AI');
    function tab(i) { tA.classList.toggle('on', !i); tB.classList.toggle('on', !!i); autoPane.classList.toggle('hide', !!i); manPane.classList.toggle('hide', !i); refresh(); }

    modal({
      title: '✨ AI Question Generator', wide: true,
      body: h('div', {},
        h('p.muted', {}, '🎯 Topics tick করো (একাধিক selectable) + 🎲 Random + নিজের topic:'),
        chipWrap, h('div.row', { style: { marginTop: '10px' } }, rndBtn),
        h('div.row', {}, h('label.field', {}, '✍️ Custom topics', custom), h('label.field', {}, '🎓 Class', grade)),
        h('div.row', {}, h('label.field', {}, '🌐 Language', lang), h('label.field', {}, 'MCQ', nM), h('label.field', {}, 'Word', nW), h('label.field', {}, 'Opposite', nO), h('label.field', {}, 'T/F', nTF)),
        h('div.segwrap', { style: { margin: '14px 0' } }, tA, tB), autoPane, manPane,
        h('h4', {}, 'Preview'), preview),
      actions: [{
        label: '💾 Save as Pack', kind: 'primary', keepOpen: true, onClick: close => {
          if (!pack || !pack.questions.length) return toast('আগে generate/parse করো', 'error');
          DB.addPack(pack); toast('Pack saved!', 'success'); SFX.correct(); onDone && onDone(); close(true);
        }
      }]
    });
  }

  /* ---------- IMAGE LAB ---------- */
  async function viewImages(root) {
    const grid = h('div.imggrid');
    async function redraw() {
      const imgs = await DB.allImages();
      grid.replaceChildren(...imgs.sort((a, b) => (b.added || 0) - (a.added || 0)).map(im => h('div.imgcard', {},
        h('img', { src: im.data, alt: '' }),
        h('div.imgcard__f', {},
          h('input.inp', { value: im.label || '', placeholder: 'Label (answer) *', onchange: e => DB.updateImage(im.id, { label: e.target.value.trim() }) }),
          h('input.inp', { value: im.hint || '', placeholder: 'Hint (optional)', onchange: e => DB.updateImage(im.id, { hint: e.target.value.trim() }) }),
          h('button.btn.btn--ghost.btn--sm', { onclick: async () => { if (await confirmDlg(`"${im.label || im.name}" মুছে ফেলবে?`)) { await DB.delImage(im.id); toast('Image deleted'); redraw(); } } }, '🗑 Delete')))));
      if (!imgs.length) grid.append(h('p.muted', {}, 'এখনো কোনো ছবি নেই — drop করো বা list import করো!'));
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
      if (n) { SFX.correct(); toast(`${n}টা ছবি যোগ হয়েছে — Label বসাও!`, 'success'); redraw(); }
    }
    function importList() {
      const ta = h('textarea.inp.ta', { placeholder: 'JSON: {"images":[{"label":"Tiger","hint":"...","url":"https://...jpg"}]}\nঅথবা প্রতি লাইনে: label,hint,url' });
      modal({
        title: '📥 Import image list', wide: true,
        body: h('div', {}, h('p.hint', {}, 'Image গেমের 📋 Copy AI Prompt বাটনের prompt AI-কে দিলে যে list আসবে, সেটা এখানে paste করা যায়। URL গুলো direct image link (.png/.jpg/.webp) হতে হবে।'), ta),
        actions: [{
          label: '💾 Import', kind: 'primary', keepOpen: true, onClick: close => {
            try {
              const list = AI.parseImages(ta.value);
              if (!list.length) throw new Error('কোনো valid image row নেই (label + url লাগবে)');
              list.forEach(im => DB.putImage({ id: uid('img'), label: im.label, hint: im.hint || '', data: im.url, remote: true, added: Date.now() }));
              toast(`${list.length}টা image link import হলো!`, 'success'); SFX.correct(); redraw(); close(true);
            } catch (e) { toast(e.message, 'error'); }
          }
        }]
      });
    }
    const dz = h('div.dropzone', {
      ondragover: e => { e.preventDefault(); dz.classList.add('dz-over'); },
      ondragleave: () => dz.classList.remove('dz-over'),
      ondrop: e => { e.preventDefault(); dz.classList.remove('dz-over'); addFiles(e.dataTransfer.files); }
    },
      h('div.dropzone__icon', {}, '🖼️'),
      h('b', {}, 'ছবি drag & drop করো'), ' অথবা ',
      h('button.btn.btn--ghost.btn--sm', { onclick: () => fileInp.click() }, 'Browse files'), fileInp,
      h('p.hint', {}, 'Label = উত্তর। Upload করা ছবি offline-ও চলে; link করা ছবির জন্য internet লাগতে পারে।'));

    root.append(h('section.page', {},
      h('div.pagehead', {}, h('div', {}, h('h2', {}, '🖼️ Image Lab'), h('p.muted', {}, 'Upload · link import · label · delete')),
        h('button.btn.btn--ghost', { onclick: importList }, '📥 Import list')),
      dz, grid));
    redraw();
  }

  /* ---------- SETTINGS ---------- */
  function viewSettings(root) {
    const s = DB.state.settings;
    const keyI = h('input.inp', { type: 'password', value: s.apiKey || '', placeholder: 'gsk_…', onchange: e => { s.apiKey = e.target.value.trim(); DB.save(); toast('API key saved (local)', 'success'); } });
    const modelS = h('select.inp', { onchange: e => { s.model = e.target.value; DB.save(); } }, AI.MODELS.map(m => h('option', { value: m }, m)));
    modelS.value = s.model || AI.MODELS[0];
    const testB = h('button.btn.btn--ghost.btn--sm', {
      onclick: async e => {
        e.target.disabled = true; e.target.textContent = 'Testing…';
        try { await AI.ping(s.apiKey, s.model); toast('✅ Groq connection OK!', 'success'); SFX.correct(); }
        catch (err) { toast('❌ ' + err.message, 'error', 6000); }
        e.target.disabled = false; e.target.textContent = 'Test connection';
      }
    }, 'Test connection');
    const secI = h('input.inp', { type: 'number', min: '5', max: '600', value: s.timerSec, onchange: e => { s.timerSec = Math.max(5, +e.target.value || 30); DB.save(); } });
    const modeS = h('select.inp', { onchange: e => { s.timerMode = e.target.value; DB.save(); } }, h('option', { value: 'auto' }, '⚡ Auto'), h('option', { value: 'manual' }, '✋ Manual'));
    modeS.value = s.timerMode;
    const cloudOn = DB.cloud.enabled();
    const importInp = h('input.hide', {
      type: 'file', accept: '.json', onchange: async e => {
        try {
          const d = JSON.parse(await e.target.files[0].text());
          const packs = Array.isArray(d) ? d : (d.packs || [d]);
          let n = 0;
          packs.forEach(p => { try { DB.addPack(AI.validatePack(p)); n++; } catch (err) { } });
          toast(`${n} pack imported`, 'success'); render();
        } catch (err) { toast('Import failed: ' + err.message, 'error'); }
        e.target.value = '';
      }
    });
    root.append(h('section.page', {},
      h('div.pagehead', {}, h('div', {}, h('h2', {}, '⚙️ Settings'))),
      h('div.settings-grid', {},
        h('div.scard', {}, h('h3', {}, '🤖 Groq AI'),
          h('label.field', {}, 'API key', keyI),
          h('label.field', {}, 'Model', modelS),
          h('div.row', {}, testB),
          h('p.hint', {}, 'Key শুধু এই browser-এ থাকে। Public সাইটে source-এ দেখা যায় — classroom-এর জন্য আলাদা key বানিও।')),
        h('div.scard', {}, h('h3', {}, '⏱ Timer defaults'),
          h('label.field', {}, 'Seconds per question', secI),
          h('label.field', {}, 'Mode', modeS),
          h('p.hint', {}, 'Auto = প্রশ্নে নিজে চালু · Manual = GO চাপতে হয়।')),
        h('div.scard', {}, h('h3', {}, '☁️ Cloud (Firebase)'),
          h('p', {}, cloudOn ? h('span.badge', {}, 'Enabled') : h('span.chip', {}, 'Disabled (local mode)'),
            cloudOn && DB.state.lastSync ? ' · last sync ' + new Date(DB.state.lastSync).toLocaleString() : ''),
          h('p.hint', {}, cloudOn ? 'Packs + settings Firestore-এ sync হচ্ছে। Delete করলে cloud-এও মুছে যাবে।' : 'নিচের guide দেখে js/firebase-config.js সেট করো → সব data cloud-এ থাকবে, browser বদলালেও হারাবে না।'),
          cloudOn ? h('button.btn.btn--ghost.btn--sm', { onclick: async e => { e.target.textContent = 'Syncing…'; await DB.cloud.pull(); await DB.cloud.push(); e.target.textContent = '🔄 Sync now'; render(); } }, '🔄 Sync now') : null),
        h('div.scard', {}, h('h3', {}, '📴 Offline mode'),
          h('p.hint', {}, 'একবার online-এ site খুললে app device-এ cache হয়ে যাবে — তারপর internet ছাড়াই চলবে। Upload করা ছবি ও import করা pack সব device-এ থাকে। Chrome menu → "Install app" করলে মোবাইলে app-এর মতো পাবে!')),
        h('div.scard', {}, h('h3', {}, '💾 Data'),
          h('div.row', {},
            h('button.btn.btn--ghost.btn--sm', { onclick: () => download('quizarena-backup.json', JSON.stringify({ packs: DB.state.packs, settings: { ...s, apiKey: '' } }, null, 2)) }, '⬇ Export backup'),
            h('button.btn.btn--ghost.btn--sm', { onclick: () => importInp.click() }, '⬆ Import backup'), importInp),
          h('div.row', { style: { marginTop: '10px' } },
            h('button.btn.btn--danger.btn--sm', {
              onclick: async () => {
                if (!await confirmDlg('সব pack ও image মুছে যাবে! Export করে রেখেছো?')) return;
                DB.state.packs = []; DB.save();
                (await DB.allImages()).forEach(im => DB.delImage(im.id));
                toast('All data cleared'); render();
              }
            }, '🗑 Clear all data'))))));
  }

  function start() {
    $$('[data-nav]').forEach(b => b.addEventListener('click', () => App.go(b.dataset.nav)));
    const sb = $('#btn-sound');
    sb.textContent = SFX.muted ? '🔇' : '🔊';
    sb.addEventListener('click', () => { SFX.toggle(); sb.textContent = SFX.muted ? '🔇' : '🔊'; });
    addEventListener('hashchange', render);
    mountStudentPicker();
    if ('serviceWorker' in navigator && location.protocol.startsWith('http'))
      navigator.serviceWorker.register('sw.js').catch(() => { });
    render();
  }

  return { start, go: v => { SFX.click(); location.hash = v; }, replay: () => render() };
})();

document.addEventListener('DOMContentLoaded', async () => {
  await DB.init();
  App.start();
});
