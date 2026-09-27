/** Tiny WebAudio synth for UI and combat sounds. No audio assets required. */

type Sfx = 'click' | 'hire' | 'hit' | 'crit' | 'down' | 'coin' | 'breach' | 'victory' | 'memo' | 'build' | 'error' | 'heal' | 'fire';

const MUTE_KEY = 'dungeon-hr-muted';
let ctx: AudioContext | null = null;
let muted = (() => {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
})();

export function isMuted() {
  return muted;
}

export function setMuted(m: boolean) {
  muted = m;
  try {
    localStorage.setItem(MUTE_KEY, m ? '1' : '0');
  } catch {
    // ignore
  }
}

function ac(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function tone(freq: number, dur: number, type: OscillatorType, vol: number, delay = 0, slideTo?: number) {
  const a = ac();
  if (!a) return;
  const t = a.currentTime + delay;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur: number, vol: number, delay = 0, filterFreq = 1200) {
  const a = ac();
  if (!a) return;
  const t = a.currentTime + delay;
  const len = Math.floor(a.sampleRate * dur);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = filterFreq;
  const g = a.createGain();
  g.gain.value = vol;
  src.connect(f).connect(g).connect(a.destination);
  src.start(t);
}

export function play(s: Sfx) {
  if (muted) return;
  try {
    switch (s) {
      case 'click':
        tone(520, 0.05, 'triangle', 0.05);
        break;
      case 'hire':
        tone(440, 0.1, 'triangle', 0.08);
        tone(660, 0.14, 'triangle', 0.08, 0.08);
        break;
      case 'build':
        noise(0.12, 0.15, 0, 600);
        tone(180, 0.12, 'square', 0.04, 0.02);
        break;
      case 'hit':
        noise(0.08, 0.12, 0, 900);
        tone(160, 0.08, 'square', 0.03, 0, 90);
        break;
      case 'crit':
        noise(0.12, 0.2, 0, 1600);
        tone(240, 0.12, 'sawtooth', 0.05, 0, 80);
        break;
      case 'fire':
        noise(0.35, 0.18, 0, 2400);
        break;
      case 'heal':
        tone(660, 0.12, 'sine', 0.05);
        tone(880, 0.16, 'sine', 0.05, 0.08);
        break;
      case 'down':
        tone(300, 0.35, 'sawtooth', 0.05, 0, 60);
        break;
      case 'coin':
        tone(988, 0.08, 'square', 0.04);
        tone(1318, 0.18, 'square', 0.04, 0.07);
        break;
      case 'breach':
        tone(220, 0.3, 'sawtooth', 0.07, 0, 110);
        tone(165, 0.5, 'sawtooth', 0.07, 0.25, 70);
        break;
      case 'victory':
        [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.2, 'triangle', 0.07, i * 0.1));
        break;
      case 'memo':
        tone(740, 0.06, 'sine', 0.05);
        tone(988, 0.1, 'sine', 0.05, 0.06);
        break;
      case 'error':
        tone(200, 0.12, 'square', 0.04);
        tone(150, 0.16, 'square', 0.04, 0.1);
        break;
    }
  } catch {
    // Audio is optional.
  }
}
