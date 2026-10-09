/**
 * Fully procedural audio (Web Audio API): no audio files, no licenses.
 * - SFX: short synthesized cues, optionally spatialized (HRTF panner)
 * - Voices: pitched "blips" per character while subtitles show the words
 * - Ambience: filtered-noise wind + soft village hum + occasional birds
 * - Music: a slow pad that changes chords; layers fade with tension
 */
import type { Character } from '../core/schema.js';

export type Sfx =
  | 'hover'
  | 'click'
  | 'grab'
  | 'drop'
  | 'deliver'
  | 'pickup'
  | 'pulse'
  | 'quest'
  | 'objective'
  | 'hint'
  | 'denied'
  | 'open'
  | 'close'
  | 'awaken';

type Vec = { x: number; y: number; z: number };

const CHORDS = [
  [220.0, 277.18, 329.63], // A
  [196.0, 246.94, 293.66], // G
  [174.61, 220.0, 261.63], // F
  [196.0, 246.94, 329.63], // Em-ish
];

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private buses!: Record<'music' | 'sfx' | 'voice' | 'ambience', GainNode>;
  private noise!: AudioBuffer;
  private windFilter: BiquadFilterNode | null = null;
  private musicTimer = 0;
  private chord = 0;
  private birdTimer = 4;
  private volumes = { music: 0.6, sfx: 0.8, voice: 0.8 };
  private zone = 'beacon';

  get ready(): boolean {
    return this.ctx !== null && this.ctx.state === 'running';
  }

  /** Must be called from a user gesture (click / Enter VR). Safe to call repeatedly. */
  unlock(): void {
    try {
      if (!this.ctx) this.init();
      void this.ctx?.resume();
    } catch {
      /* audio unavailable: the game stays silent */
    }
  }

  private init(): void {
    const ctx = new AudioContext();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor();
    this.master.connect(comp).connect(ctx.destination);
    const bus = () => {
      const g = ctx.createGain();
      g.connect(this.master);
      return g;
    };
    this.buses = { music: bus(), sfx: bus(), voice: bus(), ambience: bus() };
    this.noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.applyVolumes();
    this.startAmbience();
  }

  setVolumes(v: { music: number; sfx: number; voice: number }): void {
    this.volumes = { ...v };
    this.applyVolumes();
  }

  private applyVolumes(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.buses.music.gain.setTargetAtTime(this.volumes.music * 0.35, t, 0.2);
    this.buses.sfx.gain.setTargetAtTime(this.volumes.sfx, t, 0.05);
    this.buses.voice.gain.setTargetAtTime(this.volumes.voice * 0.5, t, 0.05);
    this.buses.ambience.gain.setTargetAtTime(this.volumes.sfx * 0.5, t, 0.2);
  }

  setZone(zone: string): void {
    this.zone = zone;
    if (this.windFilter && this.ctx) {
      this.windFilter.frequency.setTargetAtTime(zone === 'beacon' ? 700 : 420, this.ctx.currentTime, 2);
    }
  }

  /** Update the listener from the camera (call every frame). */
  setListener(p: Vec, forward: Vec, up: Vec): void {
    if (!this.ctx) return;
    const l = this.ctx.listener;
    if (l.positionX) {
      const t = this.ctx.currentTime;
      l.positionX.setValueAtTime(p.x, t);
      l.positionY.setValueAtTime(p.y, t);
      l.positionZ.setValueAtTime(p.z, t);
      l.forwardX.setValueAtTime(forward.x, t);
      l.forwardY.setValueAtTime(forward.y, t);
      l.forwardZ.setValueAtTime(forward.z, t);
      l.upX.setValueAtTime(up.x, t);
      l.upY.setValueAtTime(up.y, t);
      l.upZ.setValueAtTime(up.z, t);
    } else {
      l.setPosition(p.x, p.y, p.z);
      l.setOrientation(forward.x, forward.y, forward.z, up.x, up.y, up.z);
    }
  }

  /** Per-frame: schedules music chords and ambient birds. */
  tick(dt: number): void {
    if (!this.ready) return;
    this.musicTimer -= dt;
    if (this.musicTimer <= 0) {
      this.musicTimer = 9;
      this.playChord(CHORDS[this.chord++ % CHORDS.length]);
    }
    this.birdTimer -= dt;
    if (this.birdTimer <= 0) {
      this.birdTimer = 5 + Math.random() * 9;
      this.bird();
    }
  }

  private out(bus: GainNode, at?: Vec): AudioNode {
    const ctx = this.ctx as AudioContext;
    if (!at) return bus;
    const p = ctx.createPanner();
    p.panningModel = 'HRTF';
    p.distanceModel = 'inverse';
    p.refDistance = 1.5;
    p.maxDistance = 60;
    p.rolloffFactor = 1.2;
    p.positionX.value = at.x;
    p.positionY.value = at.y;
    p.positionZ.value = at.z;
    p.connect(bus);
    return p;
  }

  private tone(freq: number, dur: number, opts: { type?: OscillatorType; gain?: number; slide?: number; at?: Vec; bus?: GainNode; delay?: number; attack?: number }): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const t = ctx.currentTime + (opts.delay ?? 0);
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = opts.type ?? 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (opts.slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * opts.slide), t + dur);
    const peak = opts.gain ?? 0.2;
    const attack = opts.attack ?? 0.008;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.out(opts.bus ?? this.buses.sfx, opts.at));
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private noiseBurst(dur: number, freq: number, opts: { gain?: number; at?: Vec; q?: number; delay?: number }): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const t = ctx.currentTime + (opts.delay ?? 0);
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    f.Q.value = opts.q ?? 1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(opts.gain ?? 0.3, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.out(this.buses.sfx, opts.at));
    src.start(t, Math.random());
    src.stop(t + dur + 0.05);
  }

  sfx(name: Sfx, at?: Vec): void {
    switch (name) {
      case 'hover':
        return this.tone(1400, 0.05, { type: 'sine', gain: 0.04 });
      case 'click':
        return this.tone(880, 0.08, { type: 'triangle', gain: 0.12, slide: 1.3 });
      case 'open':
        this.tone(520, 0.12, { type: 'sine', gain: 0.1 });
        return this.tone(780, 0.16, { type: 'sine', gain: 0.08, delay: 0.06 });
      case 'close':
        return this.tone(600, 0.14, { type: 'sine', gain: 0.08, slide: 0.6 });
      case 'grab':
        this.noiseBurst(0.06, 2000, { gain: 0.2, at });
        return this.tone(330, 0.1, { type: 'triangle', gain: 0.14, slide: 1.5, at });
      case 'drop':
        return this.noiseBurst(0.18, 300, { gain: 0.35, at, q: 0.7 });
      case 'pickup':
        this.tone(660, 0.12, { type: 'triangle', gain: 0.12, at });
        return this.tone(990, 0.18, { type: 'triangle', gain: 0.1, delay: 0.07, at });
      case 'deliver':
        [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.25, { type: 'triangle', gain: 0.1, delay: i * 0.07, at }));
        return;
      case 'pulse':
        this.tone(140, 1.1, { type: 'sine', gain: 0.35, slide: 2.4, at, attack: 0.02 });
        return this.noiseBurst(0.8, 900, { gain: 0.12, at, q: 4 });
      case 'awaken':
        [196, 247, 294, 392, 494].forEach((f, i) => this.tone(f, 2.2, { type: 'sine', gain: 0.12, delay: i * 0.18, at, attack: 0.3 }));
        return;
      case 'quest':
        [392, 523, 659].forEach((f, i) => this.tone(f, 0.6, { type: 'triangle', gain: 0.1, delay: i * 0.12 }));
        return;
      case 'objective':
        this.tone(784, 0.2, { type: 'sine', gain: 0.1 });
        return this.tone(1175, 0.3, { type: 'sine', gain: 0.08, delay: 0.09 });
      case 'hint':
        return this.tone(988, 0.3, { type: 'sine', gain: 0.07 });
      case 'denied':
        return this.tone(180, 0.18, { type: 'square', gain: 0.06, slide: 0.8 });
    }
  }

  /** One syllable of character "speech". */
  blip(voice: Character['voice'], at?: Vec, delay = 0): void {
    const f = voice.pitch * (0.85 + Math.random() * 0.35);
    this.tone(f, 0.07 / Math.max(0.5, voice.speed) + 0.03, { type: voice.wave, gain: 0.09, at, bus: this.buses?.voice, delay });
  }

  /** Blips for a line of dialogue, roughly one per word (capped). */
  speak(text: string, voice: Character['voice'], at?: Vec): void {
    if (!this.ready) return;
    const words = Math.min(14, text.split(/\s+/).length);
    const gap = 0.11 / voice.speed + 0.03;
    for (let i = 0; i < words; i++) this.blip(voice, at, i * gap);
  }

  private startAmbience(): void {
    const ctx = this.ctx as AudioContext;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 600;
    f.Q.value = 0.5;
    this.windFilter = f;
    const g = ctx.createGain();
    g.gain.value = 0.12;
    // Slow gusts
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.06;
    lfo.connect(lfoGain).connect(g.gain);
    src.connect(f).connect(g).connect(this.buses.ambience);
    src.start();
    lfo.start();
    // Low warm hum of the half-awake ship
    const hum = ctx.createOscillator();
    hum.type = 'sine';
    hum.frequency.value = 55;
    const hg = ctx.createGain();
    hg.gain.value = 0.025;
    hum.connect(hg).connect(this.buses.ambience);
    hum.start();
    this.setZone(this.zone);
  }

  private bird(): void {
    const at = { x: (Math.random() - 0.5) * 40, y: 8 + Math.random() * 6, z: (Math.random() - 0.5) * 40 };
    const base = 2200 + Math.random() * 1400;
    const n = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) this.tone(base * (1 + i * 0.08), 0.09, { type: 'sine', gain: 0.03, slide: 1.25, delay: i * 0.13, at, bus: this.buses.ambience });
  }

  private playChord(freqs: number[]): void {
    for (const f of freqs) {
      for (const detune of [-4, 4]) {
        const ctx = this.ctx as AudioContext;
        const t = ctx.currentTime;
        const o = ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.value = f / 2;
        o.detune.value = detune;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.05, t + 3);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 10);
        o.connect(g).connect(this.buses.music);
        o.start(t);
        o.stop(t + 10.2);
      }
    }
  }
}
