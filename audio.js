// audio.js — tiny WebAudio bleeps, generated live: no audio files, no network.
// Every sound is a shaped oscillator blip; the module is a no-op without a
// browser AudioContext (tests, thumbnails), and M toggles mute in main.js.

let ctx = null;
let muted = false;

function ac() {
  if (typeof window === 'undefined' || !window.AudioContext) return null;
  if (!ctx) ctx = new window.AudioContext();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function blip(freqFrom, freqTo, seconds, type = 'square', gain = 0.05) {
  const a = ac();
  if (!a || muted) return;
  const t = a.currentTime;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freqFrom, t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(30, freqTo), t + seconds);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + seconds);
  osc.connect(g).connect(a.destination);
  osc.start(t);
  osc.stop(t + seconds);
}

export const sfx = {
  loot() { blip(880, 1320, 0.09, 'square', 0.04); },
  target() { blip(660, 990, 0.12, 'square', 0.05); setTimeout(() => blip(990, 1480, 0.14, 'square', 0.05), 70); },
  laser() { blip(1400, 300, 0.22, 'sawtooth', 0.06); },
  spotted() { blip(220, 440, 0.18, 'sawtooth', 0.06); },
  emp() { blip(1200, 90, 0.3, 'sawtooth', 0.05); },
  switch() { blip(500, 700, 0.06, 'square', 0.04); },
  crack() { blip(520, 520, 0.07, 'square', 0.05); setTimeout(() => blip(780, 1180, 0.16, 'square', 0.05), 90); },
  clear() { blip(523, 784, 0.14, 'triangle', 0.06); setTimeout(() => blip(784, 1046, 0.2, 'triangle', 0.06), 110); },
  busted() { blip(320, 60, 0.55, 'sawtooth', 0.07); },
};

export function toggleMute() {
  muted = !muted;
  return muted;
}
