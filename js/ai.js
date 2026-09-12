'use strict';
/* ============ QuizArena · AI + parsers (JSON/CSV/TSV/Sheet) ============ */
const AI = (() => {
  const ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
  const MODELS = ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'qwen/qwen3-30b-a3b', 'llama-3.3-70b-versatile'];

  const PRESET_TOPICS = ['🐾 Animals', ' Solar System', ' Plants & Trees', '🫀 Human Body', '➗ Math Fun',
    '🔤 English Grammar', '🇧 Bangladesh', '️ World Geography', ' Sports', ' Fruits & Food',
    '🦅 Birds', '🐝 Insects', '🌊 Ocean Life', '🌦️ Weather & Seasons', '🎨 Colors & Shapes',
    '🧪 Science Experiments', '📖 Story & Fairy Tales', '🔢 Numbers & Counting', '🏠 Daily Objects',
    '🚗 Transport', '🎵 Music & Instruments', '🦕 Dinosaurs', '💻 Computer Basics', '🌍 Environment'];

  const SYSTEM_PROMPT = `You are "QuizForge", a question generator for a classroom quiz game used with school students (ages 6-16).
OUTPUT: Reply with ONE valid JSON object only — no markdown, no code fences. Exact schema:
{"name":"pack name","subject":"subject","questions":[
 {"type":"mcq","q":"question","options":["A","B","C","D"],"answer":0,"hint":"optional","img":"optional https image url","audio":"optional https mp3 url","video":"optional youtube/mp4 url"},
 {"type":"word","q":"clue/riddle","answer":"OneWord","hint":"optional"},
 {"type":"opposite","word":"Hot","answer":"Cold"}]}
HARD RULES:
1. 100% CHILD-SAFE. No violence, adult themes, drugs, politics, religious controversy, horror. When unsure pick safer.
2. Difficulty must match the requested class/grade.
3. mcq "answer" = INDEX (0-based). Exactly one correct option.
4. "word" answers = one or two common words.
5. "opposite" pairs = common unambiguous antonyms.
6. No duplicates. Exact requested counts.
7. Question language = requested language (English or Bangla). JSON keys stay English.`;

  function buildPrompt({ topic, grade, lang, n }) {
    return `Create a classroom quiz pack.
Topic(s): ${topic}
Class/Grade: ${grade}
Language: ${lang}
Counts: ${n.mcq} mcq, ${n.word} word, ${n.opposite || n.opp || 0} opposite questions.
Audience is children — 100% child-safe and age-appropriate.
Output ONLY one valid JSON object (no markdown) in EXACTLY this schema:
{"name":"Pack name","subject":"Subject","questions":[
 {"type":"mcq","q":"Question?","options":["A","B","C","D"],"answer":0,"hint":"optional"},
 {"type":"word","q":"Clue/riddle for a one-word answer","answer":"Answer","hint":"optional"},
 {"type":"opposite","word":"Hot","answer":"Cold"}]}
For mcq, "answer" is the index (0-3) of the correct option. No duplicates.`;
  }

  /* প্রতি গেমের জন্য UNIVERSAL copy-paste prompt (দেখায় না, শুধু copy) */
  function gamePrompt(kind) {
    const per = {
      mcq: { t: 'MCQ questions (exactly 4 options, one correct)', n: 15, row: '{"type":"mcq","q":"Question?","options":["A","B","C","D"],"answer":0,"hint":"optional hint","img":"optional direct https image url .png/.jpg/.webp","audio":"optional direct https mp3 url","video":"optional YouTube or .mp4 url"}' },
      word: { t: 'one-word guess riddles/clues', n: 15, row: '{"type":"word","q":"Clue or riddle whose answer is ONE word","answer":"Answer","hint":"optional"}' },
      opposite: { t: 'opposite-word pairs', n: 20, row: '{"type":"opposite","word":"Hot","answer":"Cold"}' },
      image: { t: 'guess-the-image items (common, easily photographable objects/animals)', n: 15, row: '{"label":"Tiger","hint":"Big striped cat","url":"optional direct https image url"}' }
    }[kind] || { t: 'MCQ questions', n: 15, row: '{"type":"mcq","q":"Q?","options":["A","B","C","D"],"answer":0}' };
    return `You are creating content for a children's classroom quiz game (ages 6-16). Everything must be 100% child-safe and school-appropriate.
Create ${per.n} ${per.t}.
Reply with ONLY this JSON — no markdown, no explanation:
{"name":"<short pack name>","questions":[${per.row}, ...more rows...]}
Rules: mcq "answer" = index 0-3 of the correct option; no duplicate questions; media urls must be direct public https links or omitted entirely.`;
  }

  /* ---------- validation ---------- */
  const s = v => String(v ?? '').replace(/[<>]/g, '').trim();

    function validateQuestion(q) {
    if (!q || typeof q !== 'object') return null;
    const img = safeUrl(q.img || q.image), audio = safeUrl(q.audio), video = safeUrl(q.video);
    if (q.type === 'mcq') {
      const opts = (q.options || []).map(s).filter(Boolean);
      if (!s(q.q) || opts.length < 2 || opts.length > 6) return null;
      let a = q.answer;
      if (typeof a === 'string') { const ix = opts.findIndex(o => norm(o) === norm(a)); if (ix >= 0) a = ix; }
      a = parseInt(a, 10);
      if (!(a >= 0 && a < opts.length)) return null;
      return { type: 'mcq', q: s(q.q), options: opts, answer: a, hint: s(q.hint) || undefined, img, audio, video };
    }
    if (q.type === 'word')
      return s(q.q) && s(q.answer) ? { type: 'word', q: s(q.q), answer: s(q.answer), hint: s(q.hint) || undefined, img, audio, video } : null;
    if (q.type === 'opposite')
      return (s(q.word) || s(q.q)) && s(q.answer) ? { type: 'opposite', word: s(q.word || q.q), answer: s(q.answer) } : null;
    if (q.type === 'tf') {
      if (!s(q.q)) return null;
      let a = q.answer;
      if (typeof a === 'string') a = /^(true|yes|1|yes|হ্যাঁ|সত্য|সঠিক)$/i.test(a.trim());
      else a = !!a;
      return { type: 'tf', q: s(q.q), answer: a ? 1 : 0, hint: s(q.hint) || undefined, img, audio, video };
    }
    return null;
  }
  function validatePack(obj) {
    if (Array.isArray(obj)) obj = { questions: obj };
    if (!obj || typeof obj !== 'object' || !Array.isArray(obj.questions))
      throw new Error('Not a valid pack (need {name?, questions:[...]})');
    const qs = obj.questions.map(validateQuestion).filter(Boolean);
    return { name: s(obj.name) || 'Imported Pack', subject: s(obj.subject) || '', questions: qs, skipped: obj.questions.length - qs.length };
  }

  /* ---------- CSV / TSV ---------- */
  function splitLine(line, sep) {
    const out = []; let cur = '', q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (q) { if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
      else if (c === '"') q = true;
      else if (c === sep) { out.push(cur); cur = ''; }
      else cur += c;
    }
    out.push(cur);
    return out.map(x => x.trim());
  }
  function rowsToQuestions(rows, iT, iQ, iA, iO, iH, iImg, iAu, iVid) {
    const qs = [], imgs = [];
    for (const c of rows) {
      const t = (c[iT] || '').toLowerCase();
      if (t === 'image' || t === 'img') { const label = s(c[iQ] || c[iO]); if (label) imgs.push({ label, hint: s(c[iH]), url: safeUrl(c[iImg]) || '' }); continue; }
      if (t === 'mcq') qs.push({ type: 'mcq', q: c[iQ], answer: c[iA], options: (c[iO] || '').split('|').filter(Boolean), hint: c[iH], img: c[iImg], audio: c[iAu], video: c[iVid] });
      else if (t === 'word') qs.push({ type: 'word', q: c[iQ], answer: c[iA], hint: c[iH], img: c[iImg], audio: c[iAu], video: c[iVid] });
      else if (t === 'opposite') qs.push({ type: 'opposite', word: c[iQ], answer: c[iA] });
    }
    return { qs, imgs };
  }
  function parseDelimited(text, sep) {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    let iT = 0, iQ = 1, iA = 2, iO = 3, iH = 4, iImg = 5, iAu = 6, iVid = 7, start = 0;
    if (/^\s*type\s*[\t,]/i.test(lines[0])) {
      const head = splitLine(lines[0], sep).map(x => x.toLowerCase());
      const ix = (...ns) => { for (const n of ns) { const i = head.indexOf(n); if (i >= 0) return i; } return -1; };
      iT = ix('type', 'game'); iQ = ix('q', 'question', 'prompt', 'label'); iA = ix('answer', 'a');
      iO = ix('options', 'choices'); iH = ix('hint'); iImg = ix('img', 'image', 'imageurl', 'picture', 'url');
      iAu = ix('audio', 'mp3', 'sound'); iVid = ix('video', 'youtube');
      start = 1;
    }
    const rows = lines.slice(start).map(l => splitLine(l, sep));
    const { qs, imgs } = rowsToQuestions(rows, iT, iQ, iA, iO, iH, iImg, iAu, iVid);
    const questions = qs.map(validateQuestion).filter(Boolean);
    return { questions, images: imgs.filter(x => x.label), skipped: qs.length - questions.length };
  }
  function parseBulk(text) {
    const t = String(text || '').trim();
    if (!t) throw new Error('Nothing to parse');
    if (t[0] === '{' || t[0] === '[') return validatePack(JSON.parse(t));
    const r = parseDelimited(t, t.includes('\t') ? '\t' : ',');
    return { name: 'Imported Pack', subject: '', questions: r.questions, skipped: r.skipped, images: r.images };
  }
  function parseImages(text) {
    const t = String(text || '').trim();
    let arr = [];
    if (t[0] === '{' || t[0] === '[') {
      const o = JSON.parse(t);
      arr = Array.isArray(o) ? o : (o.images || o.questions || o.rows || []);
      return arr.map(r => ({ label: s(r.label || r.q), hint: s(r.hint), url: safeUrl(r.url || r.img || r.image) || '' })).filter(r => r.label && r.url);
    }
    return t.split(/\r?\n/).filter(l => l.trim()).map(l => {
      const c = splitLine(l, l.includes('\t') ? '\t' : ',');
      if (/label/i.test(c[0])) return null;
      return { label: s(c[0]), hint: s(c[1]), url: safeUrl(c[2]) || '' };
    }).filter(r => r && r.label && r.url);
  }

  /* ---------- Google Sheet ---------- */
  async function fetchSheet(url) {
    let u = String(url || '').trim();
    if (!u) throw new Error('Sheet URL দাও');
    if (u.includes('/pub?')) u = u.replace(/output=\w+/, 'output=tsv');
    else if (u.includes('output=tsv') || u.includes('output=csv')) { /* ok */ }
    else throw new Error('এটা published link না! Sheet → File → Share → Publish to web → TSV link paste করো');
    const r = await fetch(u);
    if (!r.ok) throw new Error('Sheet fetch failed (' + r.status + '). Publish to web করা আছে তো?');
    const text = await r.text();
    const res = parseDelimited(text, '\t');
    if (!res.questions.length && !res.images.length) throw new Error('Sheet-এ কোনো valid row পাওয়া যায়নি। Header দেখো: type, q, answer, options, hint, img, audio, video');
    return res;
  }

  /* ---------- Groq ---------- */
  function extractJSON(t) {
    const a = t.indexOf('{'), b = t.lastIndexOf('}');
    if (a < 0 || b < a) throw new Error('AI response-এ JSON পাওয়া যায়নি');
    return JSON.parse(t.slice(a, b + 1));
  }
  async function call({ apiKey, model, messages, json = true, tok = 6000 }) {
    const isGptOss = model.includes('gpt-oss');
    const body = { model, messages };
    body[isGptOss ? 'max_completion_tokens' : 'max_tokens'] = tok;
    if (!isGptOss) body.temperature = 0.9;
    if (json) body.response_format = { type: 'json_object' };
    const r = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + apiKey },
      body: JSON.stringify(body)
    });
    if (!r.ok) {
      let msg = r.status + ' ' + r.statusText;
      try { msg = (await r.json()).error?.message || msg; } catch (e) { }
      throw new Error(msg);
    }
    return (await r.json()).choices[0].message.content;
  }
  async function generate({ apiKey, model, topic, grade, lang, n }) {
    if (!apiKey) throw new Error('No Groq API key — Settings-এ যোগ করো');
    const messages = [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: buildPrompt({ topic, grade, lang, n }) }];
    let text;
    try { text = await call({ apiKey, model, messages }); }
    catch (e) { text = await call({ apiKey, model, messages, json: false }); }
    return validatePack(extractJSON(text));
  }
  async function ping(apiKey, model) {
    await call({ apiKey, model, messages: [{ role: 'user', content: 'Reply with exactly: OK' }], json: false, tok: 200 });
    return true;
  }

  return { MODELS, PRESET_TOPICS, SYSTEM_PROMPT, buildPrompt, gamePrompt, validateQuestion, validatePack, parseBulk, parseImages, parseDelimited, fetchSheet, generate, ping };
})();
