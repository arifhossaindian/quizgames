'use strict';
/* ============================================================
 * QuizArena · WebAudio synthesized SFX — zero audio files needed
 * ============================================================ */
const SFX = (() => {
  let ctx = null, muted = localStorage.getItem('qa.muted') === '1';
  const ac = () => ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();

  function tone({ f = 440, f2, t = 0, d = .15, type = 'sine', v = .18 }) {
    if (muted) return;
    const a = ac(), o = a.createOscillator(), g = a.createGain(), T = a.currentTime + t;
    o.type = type;
    o.frequency.setValueAtTime(f, T);
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(1, f2), T + d);
    g.gain.setValueAtTime(0, T);
    g.gain.linearRampToValueAtTime(v, T + .012);
    g.gain.exponentialRampToValueAtTime(.0001, T + d);
    o.connect(g).connect(a.destination);
    o.start(T); o.stop(T + d + .05);
  }
  function noise({ t = 0, d = .35, v = .1, f = 700 }) {
    if (muted) return;
    const a = ac(), len = Math.round(a.sampleRate * d);
    const buf = a.createBuffer(1, len, a.sampleRate), data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = a.createBufferSource(); src.buffer = buf;
    const bp = a.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f;
    const g = a.createGain(); g.gain.value = v;
    src.connect(bp).connect(g).connect(a.destination);
    src.start(a.currentTime + t);
  }

  const api = {
    get muted() { return muted; },
    toggle() { muted = !muted; localStorage.setItem('qa.muted', muted ? '1' : '0'); return muted; },
    resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); },
    click()   { tone({ f: 620, d: .06, type: 'triangle', v: .12 }); },
    tick()    { tone({ f: 1250, d: .03, type: 'square', v: .05 }); },
    spinTick(){ tone({ f: 900 + Math.random() * 300, d: .02, type: 'square', v: .04 }); },
    whoosh()  { noise({ d: .4, v: .08, f: 500 }); },
    reveal()  { tone({ f: 400, f2: 950, d: .22, type: 'triangle' }); },
    correct() { tone({ f: 523, d: .12 }); tone({ f: 659, t: .1, d: .12 }); tone({ f: 784, t: .2, d: .28 }); },
    wrong()   { tone({ f: 220, f2: 110, d: .4, type: 'sawtooth', v: .13 }); },
    timeup()  { tone({ f: 880, d: .14, type: 'square', v: .12 }); tone({ f: 880, t: .18, d: .14, type: 'square', v: .12 }); tone({ f: 620, t: .36, d: .4, type: 'square', v: .12 }); },
    win()     { [523, 659, 784, 1046].forEach((f, i) => tone({ f, t: i * .12, d: .3 })); }
  };
  document.addEventListener('pointerdown', () => api.resume());
  return api;
})();
