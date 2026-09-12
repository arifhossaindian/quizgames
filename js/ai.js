'use strict';
/* ============================================================
 * QuizArena · AI layer
 *   • Groq API (gpt-oss-120b / qwen3-30b ...) — in-app generation
 *   • Universal pack validator/parser (JSON + CSV bulk upload)
 *   • Copy-paste prompt for ANY external AI
 *   • সব প্রশ্ন child-safe হতে বাধ্য (system prompt-এ hard rules)
 * ============================================================ */
const AI = (() => {
  const ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
  const MODELS = ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'qwen/qwen3-30b-a3b', 'llama-3.3-70b-versatile'];

  const SYSTEM_PROMPT = `You are "QuizForge", a question generator for a classroom quiz game used with school students (ages 6-16).

OUTPUT: Reply with ONE valid JSON object only — no markdown, no code fences, no explanations. Exact schema:
{
  "name": "short pack name",
  "subject": "subject",
  "questions": [
    {"type":"mcq","q":"question text","options":["A","B","C","D"],"answer":0,"hint":"optional short hint"},
    {"type":"word","q":"clue or riddle whose answer is a word","answer":"Answer","hint":"optional"},
    {"type":"opposite","word":"Hot","answer":"Cold"}
  ]
}

HARD RULES:
1. 100% CHILD-SAFE. Never include violence, gore, adult/romantic themes, drugs, politics, religious controversy, insults, horror, death details, or anything a parent or school would object to. When in doubt, pick a safer alternative.
2. Vocabulary and difficulty must match the requested class/grade exactly.
3. mcq "answer" = INDEX (0-based) of the correct option. Exactly one correct option; distractors plausible but clearly wrong.
4. "word" answers must be one or two common words a student can spell.
5. "opposite" pairs must be common, unambiguous antonyms.
6. No duplicate questions or duplicate answer meanings. Produce exactly the requested counts.
7. Write question text in the requested language (English or Bangla). JSON keys stay in English.`;

  /** Prompt template — in-app Groq call AND external copy-paste (any AI) both use this */
  function buildPrompt({ topic, grade, lang, n }) {
    return `Create a classroom quiz pack.
Topic: ${topic}
Class/Grade: ${grade}
Language: ${lang}
Counts: ${n.mcq} mcq, ${n.word} word, ${n.opposite || n.opp || 0} opposite questions.

Audience is children — every question must be 100% child-safe and age-appropriate (no violence, no adult content, nothing scary, political or controversial).

Output ONLY one valid JSON object (no markdown, no extra text) in EXACTLY this schema:
{
  "name": "Pack name",
  "subject": "Subject",
  "questions": [
    {"type":"mcq","q":"Question?","options":["A","B","C","D"],"answer":0,"hint":"optional"},
    {"type":"word","q":"Clue/riddle for a one-word answer","answer":"Answer","hint":"optional"},
    {"type":"opposite","word":"Hot","answer":"Cold"}
  ]
}
For mcq, "answer" is the index (0-3) of the correct option. No duplicates.`;
  }

  /* ---------- validation / sanitisation ---------- */
  const s = v => String(v ?? '').replace(/[<>]/g, '').trim();   // strip HTML-ish chars

  function validateQuestion(q) {
    if (!q || typeof q !== 'object') return null;
    if (q.type === 'mcq') {
      const opts = (q.options || []).map(s).filter(Boolean);
      if (!s(q.q) || opts.length < 2 || opts.length > 6) return null;
      let a = q.answer;
      if (typeof a === 'string') {
        const ix = opts.findIndex(o => norm(o) === norm(a));
        if (ix >= 0) a = ix;
      }
      a = parseInt(a, 10);
      if (!(a >= 0 && a < opts.length)) return null;
      return { type: 'mcq', q: s(q.q), options: opts, answer: a, hint: s(q.hint) || undefined };
    }
    if (q.type === 'word')
      return s(q.q) && s(q.answer) ? { type: 'word', q: s(q.q), answer: s(q.answer), hint: s(q.hint) || undefined } : null;
    if (q.type === 'opposite')
      return (s(q.word) || s(q.q)) && s(q.answer) ? { type: 'opposite', word: s(q.word || q.q), answer: s(q.answer) } : null;
    return null;
  }

  function validatePack(obj) {
    if (Array.isArray(obj)) obj = { questions: obj };
    if (!obj || typeof obj !== 'object' || !Array.isArray(obj.questions))
      throw new Error('Not a valid pack (need {name?, questions:[...]})');
    const qs = obj.questions.map(validateQuestion).filter(Boolean);
    return {
      name: s(obj.name) || 'Imported Pack',
      subject: s(obj.subject) || '',
      questions: qs,
      skipped: obj.questions.length - qs.length
    };
  }

  /* ---------- CSV: type,q,answer,options,hint (options = A|B|C|D) ---------- */
  function splitCSVLine(line) {
    const out = []; let cur = '', q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (q) { if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
      else if (c === '"') q = true;
      else if (c === ',') { out.push(cur); cur = ''; }
      else cur += c;
    }
    out.push(cur);
    return out.map(x => x.trim());
  }
  function parseCSV(text) {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    let iT = 0, iQ = 1, iA = 2, iO = 3, iH = 4, start = 0;
    if (/^\s*type\s*,/i.test(lines[0])) {
      const head = splitCSVLine(lines[0]).map(x => x.toLowerCase());
      iT = head.indexOf('type'); iQ = head.indexOf('q'); iA = head.indexOf('answer');
      iO = head.indexOf('options'); iH = head.indexOf('hint');
      if (iQ < 0) iQ = 1; if (iA < 0) iA = 2;
      start = 1;
    }
    const questions = lines.slice(start).map(l => {
      const c = splitCSVLine(l);
      const t = (c[iT] || '').toLowerCase();
      if (t === 'mcq') return { type: 'mcq', q: c[iQ], answer: c[iA], options: (iO >= 0 ? c[iO] || '' : '').split('|').filter(Boolean), hint: iH >= 0 ? c[iH] : '' };
      if (t === 'word') return { type: 'word', q: c[iQ], answer: c[iA], hint: iH >= 0 ? c[iH] : '' };
      if (t === 'opposite') return { type: 'opposite', word: c[iQ], answer: c[iA] };
      return null;
    }).filter(Boolean);
    return { questions };
  }

  /** bulk upload entry point — JSON or CSV auto-detect */
  function parseBulk(text) {
    const t = String(text || '').trim();
    if (!t) throw new Error('Nothing to parse');
    if (t[0] === '{' || t[0] === '[') return validatePack(JSON.parse(t));
    return validatePack(parseCSV(t));
  }

  function extractJSON(t) {
    const a = t.indexOf('{'), b = t.lastIndexOf('}');
    if (a < 0 || b < a) throw new Error('AI response contained no JSON object');
    return JSON.parse(t.slice(a, b + 1));
  }

  /* ---------- Groq calls ---------- */
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
      let msg = `${r.status} ${r.statusText}`;
      try { msg = (await r.json()).error?.message || msg; } catch (e) { }
      throw new Error(msg);
    }
    return (await r.json()).choices[0].message.content;
  }

  async function generate({ apiKey, model, topic, grade, lang, n }) {
    if (!apiKey) throw new Error('No Groq API key — Settings-এ যোগ করো');
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildPrompt({ topic, grade, lang, n }) }
    ];
    let text;
    try { text = await call({ apiKey, model, messages }); }
    catch (e) { text = await call({ apiKey, model, messages, json: false }); } // fallback: no json mode
    return validatePack(extractJSON(text));
  }

  async function ping(apiKey, model) {
    await call({ apiKey, model, messages: [{ role: 'user', content: 'Reply with exactly: OK' }], json: false, tok: 200 });
    return true;
  }

  return { MODELS, SYSTEM_PROMPT, buildPrompt, validateQuestion, validatePack, parseBulk, generate, ping };
})();
