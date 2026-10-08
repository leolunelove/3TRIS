import type { Settings } from "./types";

function curve(v: number) {
  const x = Math.max(0, Math.min(1, v));
  return x * x;
}

export class GameAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private unlocked = false;
  private musicOn = false;
  private musicNodes: AudioNode[] = [];
  private musicTimer: number | null = null;
  private pulse: OscillatorNode | null = null;
  private pulseGain: GainNode | null = null;
  private noiseSrc: AudioBufferSourceNode | null = null;
  private noiseFilter: BiquadFilterNode | null = null;
  private intensity = 1;
  settings: Settings;

  constructor(settings: Settings) {
    this.settings = settings;
  }

  applySettings(s: Settings) {
    this.settings = s;
    this.syncGains();
  }

  unlock() {
    if (this.unlocked && this.ctx && this.ctx.state !== "suspended") return;
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!this.ctx) {
      this.ctx = new Ctx({ latencyHint: "interactive" });
      this.master = this.ctx.createGain();
      this.musicBus = this.ctx.createGain();
      this.sfxBus = this.ctx.createGain();
      this.musicBus.connect(this.master);
      this.sfxBus.connect(this.master);
      this.master.connect(this.ctx.destination);
      this.syncGains();
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    this.unlocked = true;
  }

  resume() {
    if (this.ctx?.state === "suspended") void this.ctx.resume();
  }

  private syncGains() {
    if (!this.ctx || !this.master || !this.musicBus || !this.sfxBus) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(curve(this.settings.master), t, 0.03);
    this.musicBus.gain.setTargetAtTime(curve(this.settings.music) * 0.55, t, 0.04);
    this.sfxBus.gain.setTargetAtTime(curve(this.settings.sfx), t, 0.03);
  }

  private env(duration: number, peak: number, attack = 0.004, release?: number) {
    if (!this.ctx || !this.sfxBus) return null;
    const g = this.ctx.createGain();
    const t = this.ctx.currentTime;
    const rel = release ?? duration * 0.7;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    g.connect(this.sfxBus);
    window.setTimeout(() => {
      try {
        g.disconnect();
      } catch {
        /* already gone */
      }
    }, (duration + 0.05) * 1000);
    void rel;
    return { g, t };
  }

  private tone(freq: number, type: OscillatorType, duration: number, peak: number, detune = 0) {
    if (!this.ctx) return;
    const e = this.env(duration, peak);
    if (!e) return;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, e.t);
    o.detune.setValueAtTime(detune, e.t);
    o.connect(e.g);
    o.start(e.t);
    o.stop(e.t + duration + 0.02);
  }

  private noise(duration: number, peak: number, hp = 400, lp = 2400) {
    if (!this.ctx) return;
    const e = this.env(duration, peak, 0.002);
    if (!e) return;
    const len = Math.max(1, (this.ctx.sampleRate * duration) | 0);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const high = this.ctx.createBiquadFilter();
    high.type = "highpass";
    high.frequency.value = hp;
    const low = this.ctx.createBiquadFilter();
    low.type = "lowpass";
    low.frequency.value = lp;
    src.connect(high);
    high.connect(low);
    low.connect(e.g);
    src.start(e.t);
    src.stop(e.t + duration);
  }

  move() {
    const f = 1680 + Math.random() * 90;
    this.tone(f, "square", 0.018, 0.035);
  }

  rotate() {
    this.tone(1240 + Math.random() * 80, "square", 0.022, 0.04);
    this.tone(1860, "triangle", 0.03, 0.018);
  }

  hold() {
    this.tone(520, "triangle", 0.05, 0.04);
    this.tone(780, "sine", 0.07, 0.025);
  }

  lock() {
    this.tone(82 + Math.random() * 8, "sine", 0.07, 0.12);
    this.noise(0.04, 0.05, 200, 1800);
  }

  hardDrop() {
    this.tone(52, "sine", 0.12, 0.22);
    this.tone(98, "triangle", 0.07, 0.08);
    this.noise(0.05, 0.07, 120, 1400);
  }

  lineClear(lines: number, difficult: boolean) {
    const base = 420 + lines * 90;
    this.tone(base, "triangle", 0.09 + lines * 0.02, 0.09 + lines * 0.02);
    this.tone(base * 1.5, "sine", 0.12, 0.05);
    this.noise(0.06 + lines * 0.015, 0.06 + lines * 0.02, 500, 3200);
    if (lines >= 4 || difficult) {
      this.tone(64, "sine", 0.18, 0.16);
      this.tone(base * 2, "square", 0.08, 0.03);
    }
  }

  combo(n: number) {
    this.tone(640 + n * 70, "sine", 0.06, 0.04);
  }

  levelUp() {
    this.tone(440, "sine", 0.1, 0.05);
    this.tone(660, "sine", 0.14, 0.04);
  }

  gameOver() {
    this.tone(196, "sine", 0.22, 0.1);
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    window.setTimeout(() => this.tone(146, "sine", 0.32, 0.08), 140);
    void t;
  }

  newBest() {
    this.tone(523, "sine", 0.12, 0.06);
    this.tone(784, "sine", 0.18, 0.05);
  }

  setIntensity(level: number) {
    this.intensity = level;
    if (!this.ctx || !this.noiseFilter || !this.pulse) return;
    const t = this.ctx.currentTime;
    const cut = 280 + Math.min(40, level) * 18;
    this.noiseFilter.frequency.setTargetAtTime(cut, t, 0.4);
    const rate = 0.35 + Math.min(40, level) * 0.012;
    try {
      this.pulse.frequency.setTargetAtTime(rate, t, 0.5);
    } catch {
      /* ignore */
    }
  }

  startMusic() {
    if (!this.ctx || !this.musicBus || this.musicOn) return;
    this.unlock();
    if (!this.ctx || !this.musicBus) return;
    this.musicOn = true;
    const ctx = this.ctx;

    const drone = ctx.createOscillator();
    drone.type = "sine";
    drone.frequency.value = 49;
    const droneG = ctx.createGain();
    droneG.gain.value = 0.18;
    drone.connect(droneG);
    droneG.connect(this.musicBus);
    drone.start();

    const fifth = ctx.createOscillator();
    fifth.type = "sine";
    fifth.frequency.value = 73.5;
    const fifthG = ctx.createGain();
    fifthG.gain.value = 0.07;
    fifth.connect(fifthG);
    fifthG.connect(this.musicBus);
    fifth.start();

    const lfo = ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = 0.38;
    this.pulse = lfo;
    const lfoG = ctx.createGain();
    lfoG.gain.value = 0.08;
    this.pulseGain = lfoG;
    lfo.connect(lfoG);
    lfoG.connect(droneG.gain);
    lfo.start();

    const noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const nd = noiseBuf.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    const nsrc = ctx.createBufferSource();
    nsrc.buffer = noiseBuf;
    nsrc.loop = true;
    const nf = ctx.createBiquadFilter();
    nf.type = "bandpass";
    nf.frequency.value = 320;
    nf.Q.value = 0.7;
    this.noiseFilter = nf;
    const ng = ctx.createGain();
    ng.gain.value = 0.035;
    nsrc.connect(nf);
    nf.connect(ng);
    ng.connect(this.musicBus);
    nsrc.start();
    this.noiseSrc = nsrc;

    this.musicNodes = [drone, fifth, lfo, droneG, fifthG, lfoG, nsrc, nf, ng];
    this.setIntensity(this.intensity);
  }

  stopMusic() {
    for (const n of this.musicNodes) {
      try {
        if ("stop" in n && typeof (n as OscillatorNode).stop === "function") {
          (n as OscillatorNode).stop();
        }
        n.disconnect();
      } catch {
        /* already stopped */
      }
    }
    this.musicNodes = [];
    this.musicOn = false;
    this.pulse = null;
    this.pulseGain = null;
    this.noiseSrc = null;
    this.noiseFilter = null;
  }

  destroy() {
    this.stopMusic();
    if (this.musicTimer != null) window.clearInterval(this.musicTimer);
    void this.ctx?.close();
    this.ctx = null;
  }
}
