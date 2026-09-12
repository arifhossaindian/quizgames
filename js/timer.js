'use strict';
/* ============================================================
 * QuizArena · cinematic countdown ring
 *   mode 'auto'   → প্রশ্ন দেখানোর সাথে সাথে timer চালু
 *   mode 'manual' → GO বাটনে touch করলে তবেই চালু
 * ============================================================ */
class Timer {
  constructor(mount, cfg) {
    this.cfg = Object.assign({ seconds: 30, mode: 'auto', onEnd() { }, onTick() { } }, cfg);
    this.R = 34; this.C = 2 * Math.PI * this.R;
    this.el = h('div.timer');
    this.el.innerHTML =
      `<svg viewBox="0 0 80 80">
         <circle class="timer__track" cx="40" cy="40" r="${this.R}"></circle>
         <circle class="timer__ring"  cx="40" cy="40" r="${this.R}"
                 stroke-dasharray="${this.C.toFixed(1)}" stroke-dashoffset="0"></circle>
       </svg>
       <div class="timer__label">${this.cfg.seconds}</div>`;
    this.ring = this.el.querySelector('.timer__ring');
    this.label = this.el.querySelector('.timer__label');
    this.startBtn = h('button.timer__go', { onclick: () => this.start() }, 'GO ▶');
    mount.append(this.el);
    this.remaining = this.cfg.seconds;
    this.running = false; this.raf = null; this.endAt = 0; this.lastSec = -1;
    this.draw();
  }
  /** নতুন প্রশ্ন দেখানোর সময় কল করো */
  arm() {
    this.stop();
    this.remaining = this.cfg.seconds;
    this.lastSec = -1;
    this.draw();
    if (this.cfg.mode === 'auto') this.start();
    else { this.el.append(this.startBtn); this.el.classList.add('timer--waiting'); }
  }
  start() {
    if (this.running) return;
    this.startBtn.remove();
    this.el.classList.remove('timer--waiting');
    this.endAt = performance.now() + this.remaining * 1000;
    this.running = true;
    SFX.click();
    const loop = now => {
      if (!this.running) return;
      this.remaining = Math.max(0, (this.endAt - now) / 1000);
      this.draw();
      const sec = Math.ceil(this.remaining);
      if (sec !== this.lastSec) {
        this.lastSec = sec;
        if (sec <= 5 && sec > 0) SFX.tick();
        this.cfg.onTick(sec);
      }
      if (this.remaining <= 0) { this.running = false; SFX.timeup(); this.cfg.onEnd(); }
      else this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }
  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.startBtn.remove();
    this.el.classList.remove('timer--waiting');
  }
  draw() {
    const p = this.remaining / this.cfg.seconds;
    this.ring.style.strokeDashoffset = (this.C * (1 - p)).toFixed(2);
    this.label.textContent = Math.ceil(this.remaining);
    this.el.classList.toggle('warn', p <= .5 && p > .25);
    this.el.classList.toggle('danger', p <= .25 && this.remaining > 0);
  }
  destroy() { this.stop(); this.el.remove(); }
}
