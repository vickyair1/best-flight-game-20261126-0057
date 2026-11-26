// audio.js — every sound is synthesized with WebAudio. No audio files.
// One job: engine drone, wind, ring chimes, touchdown, warnings.
export function makeAudio() {
  const a = {
    ctx: null, muted: false, engineOsc: null, engineOsc2: null, engineGain: null,
    windSrc: null, windGain: null, windFilter: null, started: false,
  };
  a.init = function () {
    if (a.ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      a.ctx = new AC();
      // Engine: two detuned saws through a lowpass, gain follows throttle.
      a.engineOsc = a.ctx.createOscillator(); a.engineOsc.type = 'sawtooth';
      a.engineOsc2 = a.ctx.createOscillator(); a.engineOsc2.type = 'sawtooth';
      a.engineFilter = a.ctx.createBiquadFilter(); a.engineFilter.type = 'lowpass'; a.engineFilter.frequency.value = 420;
      a.engineGain = a.ctx.createGain(); a.engineGain.gain.value = 0;
      a.engineOsc.connect(a.engineFilter); a.engineOsc2.connect(a.engineFilter);
      a.engineFilter.connect(a.engineGain); a.engineGain.connect(a.ctx.destination);
      a.engineOsc.start(); a.engineOsc2.start();
      // Wind: looped noise buffer through a bandpass.
      const len = a.ctx.sampleRate * 2;
      const buf = a.ctx.createBuffer(1, len, a.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      a.windSrc = a.ctx.createBufferSource(); a.windSrc.buffer = buf; a.windSrc.loop = true;
      a.windFilter = a.ctx.createBiquadFilter(); a.windFilter.type = 'bandpass'; a.windFilter.frequency.value = 500; a.windFilter.Q.value = 0.6;
      a.windGain = a.ctx.createGain(); a.windGain.gain.value = 0;
      a.windSrc.connect(a.windFilter); a.windFilter.connect(a.windGain); a.windGain.connect(a.ctx.destination);
      a.windSrc.start();
      a.started = true;
    } catch (e) { /* audio unavailable: the game still plays silently */ }
  };
  a.update = function (plane, dt) {
    if (!a.ctx || a.muted) { if (a.engineGain) a.engineGain.gain.value = 0; return; }
    const rpm = 55 + plane.throttle * 55 + plane.speed * 0.35;
    a.engineOsc.frequency.value = rpm;
    a.engineOsc2.frequency.value = rpm * 1.494; // a fifth above
    a.engineFilter.frequency.value = 300 + plane.throttle * 500;
    a.engineGain.gain.setTargetAtTime(0.05 + plane.throttle * 0.075, a.ctx.currentTime, 0.1);
    const wind = Math.max(0, (plane.speed - 20) / 80);
    a.windGain.gain.setTargetAtTime(wind * 0.09, a.ctx.currentTime, 0.15);
    a.windFilter.frequency.value = 400 + plane.speed * 12;
  };
  a.blip = function (freq, dur, type, vol, when = 0) {
    if (!a.ctx || a.muted) return;
    const t = a.ctx.currentTime + when;
    const o = a.ctx.createOscillator(); o.type = type || 'sine'; o.frequency.value = freq;
    const g = a.ctx.createGain();
    g.gain.setValueAtTime(vol || 0.16, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(a.ctx.destination);
    o.start(t); o.stop(t + dur + 0.05);
  };
  a.ring = function (centre) {
    a.blip(660, 0.35, 'sine', 0.2);
    a.blip(880, 0.4, 'sine', 0.2, 0.09);
    if (centre) a.blip(1320, 0.5, 'sine', 0.2, 0.18);
  };
  a.landed = function (quality) {
    a.blip(180, 0.25, 'triangle', 0.25);
    if (quality > 0.65) { a.blip(523, 0.3, 'sine', 0.16, 0.1); a.blip(784, 0.4, 'sine', 0.16, 0.2); }
  };
  a.crash = function () {
    if (!a.ctx || a.muted) return;
    const t = a.ctx.currentTime;
    const len = a.ctx.sampleRate * 0.7;
    const buf = a.ctx.createBuffer(1, len, a.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = a.ctx.createBufferSource(); src.buffer = buf;
    const f = a.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
    const g = a.ctx.createGain(); g.gain.value = 0.5;
    src.connect(f); f.connect(g); g.connect(a.ctx.destination);
    src.start(t);
    a.blip(90, 0.6, 'sawtooth', 0.2);
  };
  a.click = function () { a.blip(1200, 0.06, 'square', 0.08); };
  a.stallWarn = function () { a.blip(440, 0.12, 'square', 0.07); };
  return a;
}
