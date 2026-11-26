// world.js — the archipelago: heightmap, islands, strips, villages, lighthouse.
// One job: answer "what is the ground here?" and "what colour is it?"
// Everything is seeded, so the same seed builds the same islands every run.
import { CFG, ISLANDS, STRIPS } from './config.js';
import { makeNoise, clamp, lerp } from './rng.js';

const noise = makeNoise(20261126);
const detail = makeNoise(777001);

// Gaussian falloff for an island bump.
function bump(dx, dz, r) {
  const d2 = (dx * dx + dz * dz) / (r * r);
  return Math.exp(-d2 * 2.2);
}

// Raw island height before strip-flattening.
function islandHeight(x, z) {
  let h = -14; // seabed
  for (const isl of ISLANDS) {
    const dx = x - isl.x, dz = z - isl.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (isl.volcano) {
      // Cone with a crater bowl on top.
      const t = clamp(1 - d / 1500, 0, 1);
      const cone = Math.pow(t, 1.6) * 880;
      const crater = d < 260 ? -90 * (1 - d / 260) : 0;
      h = Math.max(h, cone + crater);
    } else {
      h = Math.max(h, bump(dx, dz, isl.r) * isl.h);
    }
  }
  // Rolling detail, stronger on land, fainter under water.
  const n = noise(x / 900, z / 900);
  const d2 = detail(x / 260, z / 260);
  h += n * 26 + d2 * 7;
  return h;
}

// Flatten the ground around every strip so runways sit on level pads, and
// clear a level approach corridor 900 m past each threshold so finals are
// never flown into a hillside that the strip pad does not cover.
function flatten(x, z, h) {
  for (const key of Object.keys(STRIPS)) {
    const s = STRIPS[key];
    const dx = x - s.x, dz = z - s.z;
    const along = dx * Math.cos(s.heading) + dz * Math.sin(s.heading);
    const across = -dx * Math.sin(s.heading) + dz * Math.cos(s.heading);
    const halfLen = s.length / 2 + 160;
    const halfWid = 150;
    if (Math.abs(along) < halfLen && Math.abs(across) < halfWid) {
      const ax = clamp(1 - Math.abs(along) / halfLen, 0, 1);
      const aw = clamp(1 - Math.abs(across) / halfWid, 0, 1);
      const w = Math.min(ax, aw);
      const smooth = w * w * (3 - 2 * w);
      h = lerp(h, s.elev, smooth);
    }
    // Approach / departure corridor: CAP the ground, never raise it. The cap
    // rises gently with distance past the pad (4 m at the threshold, +4 m per
    // 100 m out) so a final stays clear of hills AND a departure climbs over
    // them: a hill that pokes into the climb or glide path is cut down, low
    // ground stays low, so no raised ramp scars the hillside. Full cap
    // within 90 m of the centreline, feathered out to 180 m, fading along
    // its last 300 m.
    const padHalf = s.length / 2 + 160;
    const corrLen = padHalf + 2600;
    const corrWid = 180;
    if (Math.abs(along) < corrLen && Math.abs(across) < corrWid) {
      const beyond = Math.max(0, Math.abs(along) - padHalf);
      const cap = s.elev + 4 + beyond * 0.04;
      if (h > cap) {
        const endFade = clamp((corrLen - Math.abs(along)) / 300, 0, 1);
        const side = Math.abs(across);
        const sideFade = side < 90 ? 1 : clamp(1 - (side - 90) / 90, 0, 1);
        const w = Math.min(endFade, sideFade);
        const smooth = w * w * (3 - 2 * w);
        h = lerp(h, cap, smooth);
      }
    }
  }
  return h;
}

export function groundHeight(x, z) {
  return flatten(x, z, islandHeight(x, z));
}

// Which island (if any) is this point on? Used for biome colour.
function islandAt(x, z) {
  let best = null, bestV = 0;
  for (const isl of ISLANDS) {
    const dx = x - isl.x, dz = z - isl.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    const v = isl.volcano ? clamp(1 - d / 1500, 0, 1) : bump(dx, dz, isl.r);
    if (v > bestV) { bestV = v; best = isl; }
  }
  return bestV > 0.12 ? { isl: best, v: bestV } : null;
}

// Terrain colour for a ground point. Returns [r, g, b].
export function groundColor(x, z, h) {
  // Broad, slow patches (hundreds of metres) so neighbouring cells agree.
  const n = noise(x / 520 + 40, z / 520 + 9) * 0.5 + 0.5; // patchiness 0..1
  const d = detail(x / 260, z / 260) * 0.5 + 0.5;
  const vary = (n - 0.5) * 12 + (d - 0.5) * 6;
  const at = islandAt(x, z);
  if (h < 1.5) return [232, 214, 158]; // sand
  if (h < 4) return [214, 196, 138]; // wet sand / shore grass
  if (at && at.isl.volcano) {
    if (h > 640) return [245, 244, 240]; // snow cap
    if (h > 420) return [74, 70, 66]; // bare basalt
    if (h > 240) return [96, 84, 70]; // scree
    return [104, 128, 74]; // volcano scrub
  }
  // Rice terraces on Sawah: banded greens by height.
  if (at && at.isl.x === -1500 && at.isl.z === -3200 && h > 18 && h < 120) {
    const band = Math.floor(h / 14) % 2;
    const base = band ? [96, 160, 72] : [140, 178, 84];
    return [base[0] + vary, base[1] + vary, base[2] + vary * 0.5];
  }
  if (h > 120) return [122, 118, 104]; // high rock
  if (n > 0.62) return [52, 96, 52]; // forest
  if (n > 0.45) return [86, 138, 66]; // jungle
  return [118, 168, 82]; // meadow
}

// Shallow-water tint: one uniform turquoise for every shallow cell, so the
// shallows read as a smooth fringe instead of a patchwork of squares.
export function shallowColor(depth) {
  return [64, 198, 190];
}

// Strip geometry helpers: runway corners + threshold point for a strip key.
export function stripGeom(key) {
  const s = STRIPS[key];
  const c = Math.cos(s.heading), sn = Math.sin(s.heading);
  const hl = s.length / 2, hw = 15;
  const corner = (a, w) => ({
    x: s.x + a * c - w * sn, z: s.z + a * sn + w * c,
  });
  return {
    ...s,
    corners: [corner(-hl, -hw), corner(hl, -hw), corner(hl, hw), corner(-hl, hw)],
    start: { x: s.x - hl * c, z: s.z - hl * sn }, // threshold (landing end)
    end: { x: s.x + hl * c, z: s.z + hl * sn },
  };
}

// Decorations placed by seed: trees, huts, hangars, windsock, lighthouse.
// Returns arrays of {x, z, h, kind, s} — h is ground height at the spot.
export function buildDecor(seed) {
  const rand = (() => {
    let a = seed >>> 0;
    return () => {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  })();
  const trees = [], huts = [], hangars = [];
  for (const isl of ISLANDS) {
    const count = isl.volcano ? 60 : Math.floor(isl.r / 14);
    for (let i = 0; i < count; i++) {
      const a = rand() * Math.PI * 2;
      const r = Math.sqrt(rand()) * isl.r * 0.92;
      const x = isl.x + Math.cos(a) * r, z = isl.z + Math.sin(a) * r;
      const h = groundHeight(x, z);
      if (h < 6 || h > 130) continue;
      if (rand() < 0.72) trees.push({ x, z, h, s: 7 + rand() * 6 });
      else huts.push({ x, z, h, s: 1 });
    }
  }
  for (const key of Object.keys(STRIPS)) {
    const g = stripGeom(key);
    // Two hangars beside each strip + a windsock at the threshold.
    const c = Math.cos(g.heading), sn = Math.sin(g.heading);
    hangars.push({ x: g.x - sn * 55, z: g.z + c * 55, h: g.elev, heading: g.heading, w: 26, d: 18 });
    hangars.push({ x: g.x - sn * 55 + c * 40, z: g.z + c * 55 + sn * 40, h: g.elev, heading: g.heading, w: 22, d: 16 });
  }
  // Lighthouse on Mercusuar rock.
  const lh = { x: 4200, z: 3200, h: groundHeight(4200, 3200) };
  return { trees, huts, hangars, lighthouse: lh };
}

export const WORLD = { noise, detail };
export { CFG };
