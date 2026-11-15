// "Says Who?" — the sound. Rendered offline with the Web Audio graph, so it is identical on every run.
import { DUR, BEAT, BAR, T } from './film.js';

const hz = m => 440 * Math.pow(2, (m - 69) / 12);
const N = { F2: 41, G2: 43, A2: 45, C3: 48, E2: 40, B2: 47, E3: 52, F3: 53, G3: 55, A3: 57, B3: 59, C4: 60, D4: 62, E4: 64, F4: 65, G4: 67, A4: 69, B4: 71, C5: 72, D5: 74, E5: 76, F5: 77, G5: 79, A5: 81, B5: 83, C6: 84, D6: 86, E6: 88 };

export async function renderScore(sr = 48000) {
  const ac = new OfflineAudioContext(2, Math.ceil(sr * (DUR + 0.25)), sr);
  let seed = 7; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const noiseBuf = ac.createBuffer(1, sr * 2, sr); { const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = rnd() * 2 - 1; }
  const irBuf = ac.createBuffer(2, sr * 2.6, sr); for (let c = 0; c < 2; c++) { const d = irBuf.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] = (rnd() * 2 - 1) * Math.pow(1 - i / d.length, 3.2); }

  // buses
  const comp = ac.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 3.5; comp.attack.value = 0.004; comp.release.value = 0.16; comp.knee.value = 8;
  const master = ac.createGain(); master.gain.value = 0.9; const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 32; comp.connect(master); master.connect(hp); hp.connect(ac.destination);
  const dry = ac.createGain(); dry.connect(comp);
  const rev = ac.createConvolver(); rev.buffer = irBuf; const revOut = ac.createGain(); revOut.gain.value = 0.42; rev.connect(revOut); revOut.connect(comp);
  const dly = ac.createDelay(1); dly.delayTime.value = BEAT * 0.75; const fb = ac.createGain(); fb.gain.value = 0.36; const dlp = ac.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 3200;
  dly.connect(dlp); dlp.connect(fb); fb.connect(dly); const dlyOut = ac.createGain(); dlyOut.gain.value = 0.3; dlp.connect(dlyOut); dlyOut.connect(comp);
  const pump = ac.createGain(); pump.connect(dry); const pumpRev = ac.createGain(); pumpRev.gain.value = 0.35; pump.connect(pumpRev); pumpRev.connect(rev); // everything that ducks under the kick

  const G = (v, dest) => { const g = ac.createGain(); g.gain.value = v; g.connect(dest); return g; };
  const pan = (p, dest) => { const n = ac.createStereoPanner(); n.pan.value = p; n.connect(dest); return n; };
  const out = (p = 0, wet = 0, echo = 0, base = dry) => { const n = pan(p, base); if (wet) n.connect(G(wet, rev)); if (echo) n.connect(G(echo, dly)); return n; };
  const env = (g, t, a, peak, d, hold = 0) => { g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.setValueAtTime(peak, t + a + hold); g.gain.exponentialRampToValueAtTime(0.0001, t + a + hold + d); };
  const osc = (type, f, t, len, dest, det = 0) => { const o = ac.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = det; o.connect(dest); o.start(t); o.stop(t + len); return o; };
  const noise = (t, len, dest, off = 0) => { const s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = true; s.connect(dest); s.start(t, off % 1.9); s.stop(t + len); return s; };
  const filt = (type, f, q, dest) => { const b = ac.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; b.connect(dest); return b; };

  /* instruments */
  const keys = (m, t, vel = 0.2, p = 0, wet = 0.8) => { // soft felt piano
    const g = ac.createGain(); env(g, t, 0.006, vel, 2.2); const f = filt('lowpass', 1500 + vel * 4000, 0.5, g); g.connect(out(p, wet, 0.15));
    osc('triangle', hz(m), t, 2.4, f); osc('sine', hz(m) * 2, t, 2.4, G(0.3, f)); osc('sine', hz(m) * 3.01, t, 0.6, G(0.08, f));
  };
  const pad = (ms, t, len, vel, dest = dry, cut = 600) => ms.forEach((m, i) => {
    const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vel, t + Math.min(1.2, len * 0.4)); g.gain.setValueAtTime(vel, t + len - 0.3); g.gain.linearRampToValueAtTime(0.0001, t + len + 0.6);
    const f = filt('lowpass', cut, 0.7, g); g.connect(out(i % 2 ? 0.5 : -0.5, 0.6, 0, dest)); osc('sawtooth', hz(m), t, len + 0.7, f, -8); osc('sawtooth', hz(m), t, len + 0.7, f, 9); osc('sine', hz(m), t, len + 0.7, G(0.6, f));
  });
  const kick = (t, vel = 1) => {
    const g = ac.createGain(); env(g, t, 0.002, vel, 0.32); g.connect(dry); const o = osc('sine', 150, t, 0.4, g); o.frequency.setValueAtTime(165, t); o.frequency.exponentialRampToValueAtTime(46, t + 0.11);
    const c = ac.createGain(); env(c, t, 0.001, 0.25 * vel, 0.02); c.connect(dry); noise(t, 0.03, filt('highpass', 2500, 0.7, c));
    pump.gain.cancelScheduledValues(t); pump.gain.setValueAtTime(0.22, t); pump.gain.linearRampToValueAtTime(1, t + BEAT * 0.72);
  };
  const clap = (t, vel = 0.5) => { const g = ac.createGain(); g.connect(out(0, 0.5)); const f = filt('bandpass', 1500, 0.9, g); noise(t, 0.3, f, t);
    g.gain.setValueAtTime(0.0001, t); for (const [o, v] of [[0, 1], [0.011, 0.7], [0.023, 0.9]]) { g.gain.setValueAtTime(vel * v, t + o); g.gain.exponentialRampToValueAtTime(vel * 0.2, t + o + 0.01); } g.gain.exponentialRampToValueAtTime(0.0001, t + 0.26); };
  const hat = (t, vel = 0.12, open = false, p = 0.25) => { const g = ac.createGain(); env(g, t, 0.001, vel, open ? 0.22 : 0.035); g.connect(out(p, open ? 0.2 : 0)); noise(t, open ? 0.3 : 0.06, filt('highpass', 8500, 0.8, g), t * 3); };
  const snare = (t, vel = 0.3) => { const g = ac.createGain(); env(g, t, 0.001, vel, 0.12); g.connect(out(0, 0.3)); noise(t, 0.16, filt('bandpass', 2400, 0.6, g), t * 5); osc('triangle', 190, t, 0.1, G(0.6, g)); };
  const bass = (m, t, len, vel = 0.5) => { const g = ac.createGain(); env(g, t, 0.006, vel, len * 0.9, len * 0.1); g.connect(pump); const f = filt('lowpass', 320, 2, g); osc('sawtooth', hz(m), t, len + 0.05, f); osc('sine', hz(m - 12), t, len + 0.05, G(1.1, g)); f.frequency.setValueAtTime(700, t); f.frequency.exponentialRampToValueAtTime(220, t + len); };
  const saws = (ms, t, len, vel = 0.11, open = 3800) => { // big detuned chord
    const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vel, t + 0.015); g.gain.setValueAtTime(vel, t + len - 0.05); g.gain.linearRampToValueAtTime(0.0001, t + len);
    const f = filt('lowpass', 900, 1.2, g); f.frequency.setValueAtTime(900, t); f.frequency.exponentialRampToValueAtTime(open, t + Math.min(0.25, len * 0.5)); f.frequency.exponentialRampToValueAtTime(1300, t + len); g.connect(pump);
    ms.forEach((m, i) => [-14, -5, 6, 13].forEach((d, k) => osc('sawtooth', hz(m), t, len + 0.02, pan((k - 1.5) * 0.5, f), d)));
  };
  const lead = (m, t, len = BEAT * 0.5, vel = 0.2, p = 0.1) => { const g = ac.createGain(); env(g, t, 0.004, vel, len * 1.6); g.connect(out(p, 0.3, 0.45)); const f = filt('lowpass', 5200, 2.5, g); f.frequency.setValueAtTime(6000, t); f.frequency.exponentialRampToValueAtTime(1200, t + len * 1.5);
    osc('square', hz(m), t, len * 2, G(0.5, f)); osc('sawtooth', hz(m), t, len * 2, G(0.5, f), 7); osc('sawtooth', hz(m + 12), t, len * 2, G(0.18, f), -6); };
  const bell = (m, t, vel = 0.25, p = 0) => { const g = ac.createGain(); env(g, t, 0.003, vel, 2.6); g.connect(out(p, 0.9, 0.3)); osc('sine', hz(m), t, 3, g); osc('sine', hz(m) * 2.76, t, 1.2, G(0.25, g)); osc('sine', hz(m) * 5.4, t, 0.4, G(0.1, g)); osc('triangle', hz(m) * 2, t, 2, G(0.15, g)); };
  const crash = (t, vel = 0.3, len = 2.2) => { const g = ac.createGain(); env(g, t, 0.002, vel, len); g.connect(out(0, 0.6)); noise(t, len + 0.1, filt('highpass', 5200, 0.5, g), t); };
  const boom = (t, vel = 0.9) => { const g = ac.createGain(); env(g, t, 0.004, vel, 1.8); g.connect(dry); const o = osc('sine', 70, t, 2, g); o.frequency.setValueAtTime(82, t); o.frequency.exponentialRampToValueAtTime(30, t + 0.9);
    const n = ac.createGain(); env(n, t, 0.002, vel * 0.5, 0.6); n.connect(out(0, 0.7)); noise(t, 0.7, filt('lowpass', 900, 0.6, n), 0.3); crash(t, 0.32); };
  const sweep = (t, len, vel, f0, f1, up = true) => { const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); if (up) { g.gain.exponentialRampToValueAtTime(vel, t + len); g.gain.linearRampToValueAtTime(0.0001, t + len + 0.03); } else { g.gain.linearRampToValueAtTime(vel, t + len * 0.35); g.gain.exponentialRampToValueAtTime(0.0001, t + len); }
    g.connect(out(0, 0.4)); const f = filt('bandpass', f0, 1.4, g); f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + len); noise(t, len + 0.05, f, t); };
  const blip = (m, t, vel = 0.1, p = 0, type = 'sine', len = 0.09) => { const g = ac.createGain(); env(g, t, 0.002, vel, len); g.connect(out(p, 0.25, 0.1)); const o = osc(type, hz(m), t, len + 0.03, g); o.frequency.setValueAtTime(hz(m) * 1.5, t); o.frequency.exponentialRampToValueAtTime(hz(m), t + 0.03); };
  const pops = (t, n, span, vel = 0.07) => { const scale = [72, 74, 76, 79, 81, 84, 86, 88, 91]; for (let i = 0; i < n; i++) { const q = i / n; blip(scale[Math.floor(rnd() * scale.length)] + (rnd() > 0.7 ? 12 : 0), t + span * q * q + rnd() * 0.03, vel * (1 - q * 0.6), rnd() * 1.6 - 0.8); } };

  /* act one — the same four bars it has always been */
  { const w = ac.createGain(); w.gain.setValueAtTime(0.0001, 0); w.gain.linearRampToValueAtTime(0.035, 2); w.gain.setValueAtTime(0.035, 13.6); w.gain.linearRampToValueAtTime(0.0001, 14.0); const wh = filt('highpass', 140, 0.5, dry); w.connect(wh); const f = filt('lowpass', 420, 0.4, w); noise(0, 14.1, f); f.frequency.setValueAtTime(300, 0); f.frequency.linearRampToValueAtTime(520, 7); f.frequency.linearRampToValueAtTime(300, 14); }
  pad([N.A2, N.E3, N.A3, N.C4], 0.3, 7.0, 0.035); pad([N.F2, N.C4 - 12, N.F3, N.A3], 7.5, 3.6, 0.035); pad([N.E2, N.B2, N.E3, N.A3], 11.25, 2.5, 0.04, dry, 900);
  [N.A4, N.C5, N.E5, N.D5, N.C5, N.A4, N.G4, N.A4, N.F4, N.A4, N.C5, N.B4, N.A4, N.E4].forEach((m, i) => keys(m, 0.9 + i * BEAT * 2, 0.17 - (i % 4 === 3 ? 0.04 : 0), i % 2 ? 0.25 : -0.25));
  for (let b = 2; b < 30; b++) { const g = ac.createGain(); env(g, b * BEAT, 0.001, b % 2 ? 0.035 : 0.05, 0.02); g.connect(out(b % 2 ? 0.3 : -0.3, 0.2)); noise(b * BEAT, 0.03, filt('bandpass', b % 2 ? 2600 : 2000, 6, g), b); } // a clock, ticking
  { const g = ac.createGain(); g.gain.setValueAtTime(0.0001, 12.6); g.gain.exponentialRampToValueAtTime(0.11, 13.98); g.gain.linearRampToValueAtTime(0.0001, 14.0); g.connect(out(0, 0.3)); const o = osc('sine', 110, 12.6, 1.45, g); o.frequency.exponentialRampToValueAtTime(220, 14.0); } // tension, then nothing
  blip(N.C5 + 24, 14.885, 0.16, 0.2, 'square', 0.025); blip(N.G4 + 24, 14.96, 0.1, 0.2, 'square', 0.02); // the click

  /* the drop — F G Am C, twelve bars */
  const CH = [[N.F2, [N.F3, N.A3, N.C4, N.F4]], [N.G2, [N.G3, N.B3, N.D4, N.G4]], [N.A2, [N.A3, N.C4, N.E4, N.A4]], [N.C3, [N.G3, N.C4, N.E4, N.G4]]];
  const MEL = [[N.C6, 0, N.A5, 0, N.F5, 0, N.A5, N.C6], [N.B5, 0, N.G5, 0, N.D5, 0, N.G5, N.B5], [N.C6, 0, N.C6, N.B5, 0, N.A5, 0, N.E5], [N.G5, 0, N.E5, N.G5, 0, N.C6, N.D6, N.E6]];
  const MODE = ['full', 'full', 'thin', 'thin', 'full', 'full', 'full', 'thin', 'full', 'float', 'build', 'hits'];
  boom(T.drop, 1); { const g = ac.createGain(); env(g, T.drop, 0.01, 0.16, 0.5); g.connect(out(0, 0.4)); const o = osc('sine', 300, T.drop, 0.6, g); o.frequency.exponentialRampToValueAtTime(1300, T.drop + 0.45); }
  pops(T.drop + 0.02, 70, 1.3); pops(T.drop + BAR, 50, 0.9);
  for (let b = 0; b < 12; b++) {
    const t0 = T.drop + b * BAR, [root, tri] = CH[b % 4], mode = MODE[b], drums = mode !== 'float' && mode !== 'build';
    if (b && MODE[b] !== MODE[b - 1] || [2, 4, 5, 7, 8, 9, 10].includes(b)) { sweep(t0 - 0.35, 0.35, 0.16, 500, 7000); if (mode === 'full') crash(t0, 0.2, 1.4); }
    if (drums) for (let q = 0; q < 4; q++) { kick(t0 + q * BEAT); if (q % 2) clap(t0 + q * BEAT, mode === 'thin' ? 0.3 : 0.5); }
    if (mode === 'full' || mode === 'hits') for (let e = 0; e < 16; e++) hat(t0 + e * BEAT / 4, e % 4 === 2 ? 0.16 : e % 2 ? 0.05 : 0.09, e % 4 === 2, e % 2 ? 0.4 : -0.2);
    if (mode === 'thin') for (let e = 0; e < 8; e++) hat(t0 + e * BEAT / 2, e % 2 ? 0.14 : 0.06, false);
    if (mode !== 'float') for (let e = 0; e < 8; e++) bass(root + (e % 2 ? 12 : 0) + 12, t0 + e * BEAT / 2, BEAT / 2, mode === 'build' ? 0.2 : 0.42);
    if (mode === 'full') { saws(tri, t0, BAR - 0.02); MEL[b % 4].forEach((m, e) => m && lead(m, t0 + e * BEAT / 2)); }
    if (mode === 'thin') MEL[b % 4].forEach((m, e) => m && e % 2 === 0 && lead(m - 12, t0 + e * BEAT / 2, BEAT * 0.4, 0.1));
    if (mode === 'float') { pump.gain.cancelScheduledValues(t0); pump.gain.setValueAtTime(1, t0); pad(tri, t0, BAR, 0.07, dry, 2200); MEL[b % 4].forEach((m, e) => m && bell(m - 12, t0 + e * BEAT / 2, 0.08, e % 2 ? 0.4 : -0.4)); }
    if (mode === 'build') { pump.gain.cancelScheduledValues(t0); pump.gain.setValueAtTime(1, t0); pad(tri, t0, BAR, 0.08, dry, 1400); for (let e = 0; e < 16; e++) snare(t0 + e * BEAT / 4, 0.06 + 0.3 * Math.pow(e / 16, 1.6)); sweep(t0, BAR - 0.02, 0.3, 300, 9000); for (let q = 0; q < 4; q++) kick(t0 + q * BEAT, 0.5 + q * 0.12); }
    if (mode === 'hits') for (let e = 0; e < 8; e++) { saws(e < 4 ? CH[0][1] : CH[1][1].map(m => m + (e >= 6 ? 2 : 0)), t0 + e * BEAT / 2, BEAT / 2 - 0.05, 0.14, 5200); lead(MEL[3][e] || N.E6, t0 + e * BEAT / 2, BEAT * 0.3, 0.16); }
  }
  // sound for what the picture does
  for (let i = 0; i < 24; i++) blip([84, 86, 88, 91, 93, 96][i % 6], T.tex + 0.28 + i * BEAT / 4, 0.09, (i % 5) / 4 - 0.5, 'square', 0.035); // one tick per painted pixel
  pops(T.smile + 0.25, 60, 1.2, 0.08);
  for (let n = 0; n < 4; n++) { const t = T.skinW + (n + 0.5) * BEAT; blip([84, 88, 91, 96][n], t, 0.14, 0, 'triangle', 0.18); sweep(t - 0.2, 0.2, 0.1, 800, 5000); }
  { const g = ac.createGain(); g.gain.setValueAtTime(0.0001, T.skyW); g.gain.linearRampToValueAtTime(0.06, T.skyW + 1.2); g.gain.linearRampToValueAtTime(0.0001, T.words); g.connect(out(0, 0.5)); for (let i = 0; i < 14; i++) { const cg = ac.createGain(); env(cg, T.skyW + 0.9 + i * 0.065 + rnd() * 0.02, 0.002, 0.5, 0.03); cg.connect(g); osc('sine', 4200 + rnd() * 600, T.skyW + 0.9 + i * 0.065, 0.06, cg); } } // crickets as night falls

  /* end card — resolve, then sign off */
  boom(T.end, 1); kick(T.end, 1); pump.gain.setValueAtTime(1, T.end + BEAT);
  pad([N.C3, N.G3, N.C4, N.E4, N.G4, N.D5], T.end, 5.6, 0.06, dry, 2600); saws([N.C4, N.E4, N.G4, N.C5], T.end, 1.6, 0.13, 6000);
  [N.E5, N.G5, N.C6, N.D6, N.C6, N.G5].forEach((m, i) => keys(m, T.end + 0.5 + i * BEAT, 0.16, i % 2 ? 0.3 : -0.3));
  const sig = T.end + 1.6 + 6 * BEAT; [N.G5, N.C6, N.E6].forEach((m, i) => bell(m, sig + i * BEAT / 2, 0.3, (i - 1) * 0.3)); bell(N.C5, sig + BEAT, 0.16);
  master.gain.setValueAtTime(0.9, DUR - 1.3); master.gain.linearRampToValueAtTime(0.0001, DUR - 0.05);
  return ac.startRendering();
}

export function toWav(buf) { // 16-bit stereo, normalised just under full scale
  const L = buf.getChannelData(0), R = buf.getChannelData(1), n = L.length; let peak = 0; for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  const k = 0.97 / (peak || 1), out = new ArrayBuffer(44 + n * 4), v = new DataView(out), w = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 4, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 2, true); v.setUint32(24, buf.sampleRate, true); v.setUint32(28, buf.sampleRate * 4, true); v.setUint16(32, 4, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 4, true);
  for (let i = 0; i < n; i++) { v.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i] * k)) * 32767, true); v.setInt16(46 + i * 4, Math.max(-1, Math.min(1, R[i] * k)) * 32767, true); }
  return { bytes: new Uint8Array(out), peak };
}
