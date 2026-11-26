// rng.js — deterministic seeded randomness + value noise for the world.
// One job: reproducible numbers. Same seed => same islands, clouds, gusts.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Smooth 2D value noise in [-1, 1], built from a hashed lattice.
export function makeNoise(seed) {
  const rand = mulberry32(seed);
  const perm = new Uint8Array(512);
  const base = new Uint8Array(256);
  for (let i = 0; i < 256; i++) base[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const t = base[i]; base[i] = base[j]; base[j] = t;
  }
  for (let i = 0; i < 512; i++) perm[i] = base[i & 255];
  const fade = (t) => t * t * (3 - 2 * t);
  const hash = (ix, iz) => perm[(perm[ix & 255] + iz) & 255] / 255;
  function noise(x, z) {
    const ix = Math.floor(x), iz = Math.floor(z);
    const fx = x - ix, fz = z - iz;
    const a = hash(ix, iz), b = hash(ix + 1, iz);
    const c = hash(ix, iz + 1), d = hash(ix + 1, iz + 1);
    const u = fade(fx), v = fade(fz);
    return ((a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 2 - 1);
  }
  // Fractal sum: 3 octaves.
  return function fbm(x, z) {
    return noise(x, z) * 0.55 + noise(x * 2.1 + 7.3, z * 2.1 + 3.1) * 0.3
      + noise(x * 4.3 + 13.7, z * 4.3 + 9.2) * 0.15;
  };
}

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const TAU = Math.PI * 2;
// Wrap an angle to [-PI, PI].
export function angDiff(a, b) {
  let d = (a - b) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}
