// render.js — the view out of the window: sky, sea, terrain, strips, rings, clouds.
// One job: turn world coordinates into pixels. No game logic lives here.
import { CFG, STRIPS } from './config.js';
import { clamp, lerp, mulberry32 } from './rng.js';
import { groundHeight, groundColor, shallowColor, stripGeom, buildDecor } from './world.js';

// Precomputed terrain grid: heights + colours, built once from the seed.
const GRID_N = 141; // -7000..7000 step 100
const GRID_STEP = 100;
const heights = new Float32Array(GRID_N * GRID_N);
const colours = new Uint8Array(GRID_N * GRID_N * 3);
for (let j = 0; j < GRID_N; j++) {
  for (let i = 0; i < GRID_N; i++) {
    const x = -7000 + i * GRID_STEP, z = -7000 + j * GRID_STEP;
    const h = groundHeight(x, z);
    heights[j * GRID_N + i] = h;
    const c = groundColor(x, z, h);
    colours[(j * GRID_N + i) * 3] = c[0];
    colours[(j * GRID_N + i) * 3 + 1] = c[1];
    colours[(j * GRID_N + i) * 3 + 2] = c[2];
  }
}
function gridH(i, j) {
  i = clamp(i, 0, GRID_N - 1); j = clamp(j, 0, GRID_N - 1);
  return heights[j * GRID_N + i];
}
function gridC(i, j) {
  i = clamp(i, 0, GRID_N - 1); j = clamp(j, 0, GRID_N - 1);
  const k = (j * GRID_N + i) * 3;
  return [colours[k], colours[k + 1], colours[k + 2]];
}

const decor = buildDecor(20261126);
const cloudRand = mulberry32(4242);
const clouds = [];
for (let i = 0; i < 42; i++) {
  clouds.push({
    x: (cloudRand() - 0.5) * 13000, z: (cloudRand() - 0.5) * 13000,
    y: 950 + cloudRand() * 450, s: 170 + cloudRand() * 260,
    a: 0.35 + cloudRand() * 0.35,
  });
}

// Sky palettes by time of day (0 dawn .. 1 dusk).
function skyPalette(t) {
  if (t < 0.3) return { top: [96, 158, 214], mid: [168, 205, 232], low: [232, 222, 190], sun: [255, 236, 180], haze: [210, 224, 232] };
  if (t < 0.55) return { top: [70, 140, 205], mid: [140, 192, 228], low: [246, 226, 182], sun: [255, 240, 200], haze: [200, 218, 230] };
  if (t < 0.75) return { top: [82, 128, 198], mid: [244, 178, 110], low: [255, 196, 120], sun: [255, 190, 90], haze: [240, 196, 150] };
  return { top: [52, 62, 128], mid: [198, 110, 96], low: [255, 150, 80], sun: [255, 140, 60], haze: [226, 150, 120] };
}
function sunPos(t) {
  // Sun arcs east -> west, low at dawn/dusk.
  const az = lerp(-0.5, Math.PI + 0.5, t); // azimuth
  const el = lerp(0.28, 0.10, Math.abs(t - 0.5) * 2); // elevation rad
  return { x: Math.cos(az) * Math.cos(el), y: Math.sin(el), z: Math.sin(az) * Math.cos(el) };
}

export function makeCamera() {
  return { px: 0, py: 0, pz: 0, fx: 0, fy: 0, fz: 1, rx: 1, ry: 0, rz: 0, ux: 0, uy: 1, uz: 0, focal: 620, cx: 640, cy: 360 };
}

// Update camera from plane state. Returns nothing; fills cam.
export function updateCamera(cam, plane, mode, dt, w, h) {
  const fwdX = Math.cos(plane.heading) * Math.cos(plane.pitch);
  const fwdY = Math.sin(plane.pitch);
  const fwdZ = Math.sin(plane.heading) * Math.cos(plane.pitch);
  let tx, ty, tz, lx, ly, lz, rollK;
  if (mode === 'cockpit') {
    tx = plane.x + fwdX * 1.2; ty = plane.y + 1.7; tz = plane.z + fwdZ * 1.2;
    lx = plane.x + fwdX * 120; ly = plane.y + fwdY * 120 + 2; lz = plane.z + fwdZ * 120;
    rollK = 0.85;
  } else {
    const back = CFG.chaseDist, up = CFG.chaseHeight;
    tx = plane.x - fwdX * back; ty = plane.y + up; tz = plane.z - fwdZ * back;
    lx = plane.x + fwdX * 70; ly = plane.y + fwdY * 70 + 1; lz = plane.z + fwdZ * 70;
    rollK = 0.3;
  }
  const k = 1 - Math.exp(-dt * (mode === 'cockpit' ? 18 : 5.5));
  cam.px += (tx - cam.px) * k; cam.py += (ty - cam.py) * k; cam.pz += (tz - cam.pz) * k;
  // Forward
  let fx = lx - cam.px, fy = ly - cam.py, fz = lz - cam.pz;
  const fl = Math.hypot(fx, fy, fz) || 1;
  fx /= fl; fy /= fl; fz /= fl;
  // Right = forward x worldUp, then rotate right/up by roll around forward.
  let rx = -fz, ry = 0, rz = fx;
  const rl = Math.hypot(rx, ry, rz) || 1; rx /= rl; ry /= rl; rz /= rl;
  let ux = ry * fz - rz * fy, uy = rz * fx - rx * fz, uz = rx * fy - ry * fx;
  const roll = plane.roll * rollK;
  const cr = Math.cos(roll), sr = Math.sin(roll);
  const nrx = rx * cr + ux * sr, nry = ry * cr + uy * sr, nrz = rz * cr + uz * sr;
  const nux = ux * cr - rx * sr, nuy = uy * cr - ry * sr, nuz = uz * cr - rz * sr;
  cam.fx = fx; cam.fy = fy; cam.fz = fz;
  cam.rx = nrx; cam.ry = nry; cam.rz = nrz;
  cam.ux = nux; cam.uy = nuy; cam.uz = nuz;
  cam.focal = CFG.focal * (h / 720);
  cam.cx = w / 2; cam.cy = h / 2;
  cam.pitch = Math.asin(clamp(fy, -1, 1));
}

export function project(cam, x, y, z) {
  const dx = x - cam.px, dy = y - cam.py, dz = z - cam.pz;
  const cz = dx * cam.fx + dy * cam.fy + dz * cam.fz;
  if (cz < 2) return null;
  const cx = dx * cam.rx + dy * cam.ry + dz * cam.rz;
  const cy = dx * cam.ux + dy * cam.uy + dz * cam.uz;
  const s = cam.focal / cz;
  return { x: cam.cx + cx * s, y: cam.cy - cy * s, d: cz, s };
}

function rgb(c, a = 1) {
  return a >= 1 ? `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})` : `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
}

// --- The main scene draw. ctx is the 2D canvas context, w/h the canvas size. ---
export function drawScene(ctx, w, h, game, dt, time) {
  const plane = game.plane;
  const cam = game.camera;
  const t = game.timeOfDay;
  const pal = skyPalette(t);
  const sun = sunPos(t);
  const dusk = t > 0.68;

  // Horizon screen position from camera pitch. Looking down (pitch < 0)
  // lifts the horizon up the screen; looking up drops it.
  const horizonY = cam.cy + Math.tan(cam.pitch) * cam.focal;

  // Sky.
  const sky = ctx.createLinearGradient(0, 0, 0, Math.max(horizonY, h));
  sky.addColorStop(0, rgb(pal.top));
  sky.addColorStop(0.62, rgb(pal.mid));
  sky.addColorStop(1, rgb(pal.low));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, Math.max(0, Math.min(h, horizonY + 2)));

  // Sun disc + glow.
  const sunP = project(cam, cam.px + sun.x * 9000, cam.py + sun.y * 9000, cam.pz + sun.z * 9000);
  if (sunP) {
    const g = ctx.createRadialGradient(sunP.x, sunP.y, 4, sunP.x, sunP.y, 190);
    g.addColorStop(0, rgb(pal.sun, 0.95)); g.addColorStop(0.25, rgb(pal.sun, 0.45)); g.addColorStop(1, rgb(pal.sun, 0));
    ctx.fillStyle = g;
    ctx.fillRect(sunP.x - 200, sunP.y - 200, 400, 400);
    ctx.fillStyle = rgb([255, 250, 230]);
    ctx.beginPath(); ctx.arc(sunP.x, sunP.y, 26, 0, 7); ctx.fill();
  }

  // Sea below the horizon.
  if (horizonY < h) {
    const sea = ctx.createLinearGradient(0, horizonY, 0, h);
    const deep = dusk ? [28, 52, 96] : [24, 88, 138];
    const near = dusk ? [64, 96, 140] : [46, 140, 178];
    sea.addColorStop(0, rgb(near)); sea.addColorStop(1, rgb(deep));
    ctx.fillStyle = sea;
    ctx.fillRect(0, Math.max(0, horizonY), w, h - Math.max(0, horizonY));
    // Sun glint path on the water.
    if (sunP) {
      ctx.fillStyle = rgb(pal.sun, 0.16);
      const gx = sunP.x;
      ctx.beginPath();
      ctx.moveTo(gx - 26, horizonY);
      ctx.lineTo(gx + 26, horizonY);
      ctx.lineTo(gx + 150, h); ctx.lineTo(gx - 150, h);
      ctx.closePath(); ctx.fill();
    }
  }

  // --- Terrain quads (painter's algorithm, LOD by distance) ---
  const quads = [];
  const camI = Math.round((cam.px + 7000) / GRID_STEP);
  const camJ = Math.round((cam.pz + 7000) / GRID_STEP);
  for (let j = 0; j < GRID_N; j += 1) {
    for (let i = 0; i < GRID_N; i += 1) {
      const wx = -7000 + i * GRID_STEP, wz = -7000 + j * GRID_STEP;
      const dx = wx - cam.px, dz = wz - cam.pz;
      const dist = Math.hypot(dx, dz);
      const stride = dist < 900 ? 1 : dist < 1800 ? 2 : dist < 3600 ? 4 : 8;
      if ((i % stride) !== 0 || (j % stride) !== 0) continue;
      if (dist > 7200) continue;
      // Behind the camera?
      const fwdDot = dx * cam.fx + dz * cam.fz;
      if (fwdDot < -300) continue;
      const hC = gridH(i, j);
      const s = stride * GRID_STEP;
      // Sea cell: shallow tint only; deep sea is the base fill.
      if (hC < 0) {
        if (hC > -12) {
          const pts = [
            project(cam, wx, 0.4, wz), project(cam, wx + s, 0.4, wz),
            project(cam, wx + s, 0.4, wz + s), project(cam, wx, 0.4, wz + s),
          ];
          if (pts.every(Boolean)) {
            quads.push({ pts, col: shallowColor(-hC), a: 0.42, d: dist });
          }
        }
        continue;
      }
      const h1 = gridH(i + stride, j), h2 = gridH(i + stride, j + stride), h3 = gridH(i, j + stride);
      // Skip a quad fully under water (shouldn't happen) or fully behind.
      const pts = [
        project(cam, wx, hC, wz), project(cam, wx + s, h1, wz),
        project(cam, wx + s, h2, wz + s), project(cam, wx, h3, wz + s),
      ];
      if (!pts.every(Boolean)) continue;
      // Frustum reject: all points off one screen side.
      if (pts.every((p) => p.x < -60) || pts.every((p) => p.x > w + 60)
        || pts.every((p) => p.y < -60) || pts.every((p) => p.y > h + 60)) continue;
      const c = gridC(i, j);
      quads.push({ pts, col: c, a: 1, d: dist + (hC > 200 ? 0 : 0) });
    }
  }
  quads.sort((a, b) => b.d - a.d);
  for (const q of quads) {
    // Distance haze: far ground fades toward the sky's haze colour.
    const fog = clamp(q.d / 6500, 0, 1) * 0.55;
    const col = fog > 0 ? [
      lerp(q.col[0], pal.haze[0], fog),
      lerp(q.col[1], pal.haze[1], fog),
      lerp(q.col[2], pal.haze[2], fog),
    ] : q.col;
    ctx.fillStyle = rgb(col, q.a);
    ctx.beginPath();
    ctx.moveTo(q.pts[0].x, q.pts[0].y);
    for (let k = 1; k < 4; k++) ctx.lineTo(q.pts[k].x, q.pts[k].y);
    ctx.closePath(); ctx.fill();
  }

  // --- Runways, rings, decor, clouds ---
  drawStrips(ctx, cam, game, dusk);
  drawRings(ctx, cam, game, time);
  drawDecor(ctx, cam, game, dusk, time);
  drawClouds(ctx, cam, game);

  // Haze band at the horizon for depth.
  const hz = ctx.createLinearGradient(0, horizonY - 90, 0, horizonY + 70);
  hz.addColorStop(0, rgb(pal.haze, 0)); hz.addColorStop(0.55, rgb(pal.haze, 0.20)); hz.addColorStop(1, rgb(pal.haze, 0));
  ctx.fillStyle = hz;
  ctx.fillRect(0, Math.max(0, horizonY - 90), w, 160);

  // Rain streaks.
  if (game.weather === 'rain') {
    ctx.strokeStyle = 'rgba(200,215,230,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < 90; i++) {
      const rx = ((i * 137.5 + time * 700) % (w + 40)) - 20;
      const ry = ((i * 89.3 + time * 1500) % (h + 40)) - 20;
      ctx.moveTo(rx, ry); ctx.lineTo(rx - 7, ry + 22);
    }
    ctx.stroke();
  }
}

function poly(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
}

function drawStrips(ctx, cam, game, dusk) {
  for (const key of Object.keys(STRIPS)) {
    const g = stripGeom(key);
    const pts = g.corners.map((c) => project(cam, c.x, g.elev + 0.6, c.z));
    if (!pts.every(Boolean)) continue;
    // Asphalt.
    ctx.fillStyle = '#3a3d42';
    poly(ctx, pts); ctx.fill();
    // Edge lines.
    ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y); ctx.lineTo(pts[1].x, pts[1].y);
    ctx.moveTo(pts[3].x, pts[3].y); ctx.lineTo(pts[2].x, pts[2].y);
    ctx.stroke();
    // Centreline dashes.
    const c = Math.cos(g.heading), sn = Math.sin(g.heading);
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let a = -g.length / 2 + 40; a < g.length / 2 - 30; a += 60) {
      const p1 = project(cam, g.x + (a) * c, g.elev + 0.8, g.z + (a) * sn);
      const p2 = project(cam, g.x + (a + 30) * c, g.elev + 0.8, g.z + (a + 30) * sn);
      if (p1 && p2) { ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); }
    }
    ctx.stroke();
    // Threshold bars at both ends.
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    for (const end of [-1, 1]) {
      const bx = g.x + end * (g.length / 2 - 18) * c;
      const bz = g.z + end * (g.length / 2 - 18) * sn;
      for (let k = -2; k <= 2; k++) {
        const px = bx - sn * k * 6, pz = bz + c * k * 6;
        const q1 = project(cam, px - c * 10, g.elev + 0.8, pz - sn * 10);
        const q2 = project(cam, px + c * 10, g.elev + 0.8, pz + sn * 10);
        if (q1 && q2) {
          ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(q1.x, q1.y); ctx.lineTo(q2.x, q2.y); ctx.stroke();
        }
      }
    }
    // Edge lights glow at dusk / rain.
    if (dusk || game.weather === 'rain') {
      for (let a = -g.length / 2; a <= g.length / 2; a += 75) {
        for (const side of [-15, 15]) {
          const p = project(cam, g.x + a * c - sn * side, g.elev + 1.5, g.z + a * sn + c * side);
          if (!p || p.d > 4000) continue;
          ctx.fillStyle = 'rgba(255,220,120,0.95)';
          ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(1.5, 90 / p.d), 0, 7); ctx.fill();
        }
      }
    }
    // Strip name label when close.
    const d = Math.hypot(g.x - cam.px, g.z - cam.pz);
    if (d < 1800) {
      const lp = project(cam, g.x, g.elev + 26, g.z);
      if (lp) {
        ctx.fillStyle = 'rgba(10,20,30,0.55)';
        ctx.font = '600 13px system-ui, sans-serif';
        const label = `✈ ${g.name}`;
        const tw = ctx.measureText(label).width;
        ctx.fillRect(lp.x - tw / 2 - 6, lp.y - 11, tw + 12, 20);
        ctx.fillStyle = '#fff';
        ctx.fillText(label, lp.x - tw / 2, lp.y + 4);
      }
    }
  }
}

function drawRings(ctx, cam, game, time) {
  const m = game.mission;
  if (!m) return;
  m.rings.forEach((ring, idx) => {
    const passed = ring.passed;
    const isNext = idx === m.ringIndex;
    if (passed && !isNext) return; // flown rings vanish
    const R = 60;
    const pulse = isNext ? 1 + Math.sin(time * 4) * 0.06 : 1;
    const rr = R * pulse;
    // Light beam above the next ring so it can be spotted from afar.
    if (isNext) {
      const b1 = project(cam, ring.x, ring.y, ring.z);
      const b2 = project(cam, ring.x, ring.y + 260, ring.z);
      if (b1 && b2) {
        const grad = ctx.createLinearGradient(b1.x, b1.y, b2.x, b2.y);
        grad.addColorStop(0, 'rgba(255,170,40,0.28)');
        grad.addColorStop(1, 'rgba(255,170,40,0)');
        ctx.strokeStyle = grad; ctx.lineWidth = Math.max(2, 2600 / b1.d);
        ctx.beginPath(); ctx.moveTo(b1.x, b1.y); ctx.lineTo(b2.x, b2.y); ctx.stroke();
      }
    }
    // View-facing circle.
    const pts = [];
    for (let k = 0; k <= 28; k++) {
      const a = (k / 28) * Math.PI * 2;
      const px = ring.x + cam.rx * Math.cos(a) * rr + cam.ux * Math.sin(a) * rr;
      const py = ring.y + cam.ry * Math.cos(a) * rr + cam.uy * Math.sin(a) * rr;
      const pz = ring.z + cam.rz * Math.cos(a) * rr + cam.uz * Math.sin(a) * rr;
      pts.push(project(cam, px, py, pz));
    }
    if (!pts.every(Boolean)) return;
    const col = passed ? '90,220,120' : isNext ? '255,176,46' : '200,210,220';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = `rgba(${col},0.35)`; ctx.lineWidth = 10;
    ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke();
    ctx.strokeStyle = `rgba(${col},1)`; ctx.lineWidth = 3.5;
    ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke();
    // Centre chevron for the next ring.
    if (isNext) {
      const cp = project(cam, ring.x, ring.y, ring.z);
      if (cp) {
        ctx.fillStyle = 'rgba(255,176,46,0.95)';
        ctx.font = `700 ${Math.max(13, 5200 / cp.d)}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(`RING ${idx + 1}`, cp.x, cp.y - rr * 0.9 * (cam.focal / cp.d) - 14);
        ctx.textAlign = 'left';
      }
    }
  });
  // Destination strip beacon: a green column over the target runway.
  if (m.ringIndex >= m.rings.length) {
    const g = stripGeom(m.leg.to);
    const b1 = project(cam, g.x, g.elev, g.z);
    const b2 = project(cam, g.x, g.elev + 300, g.z);
    if (b1 && b2) {
      const grad = ctx.createLinearGradient(b1.x, b1.y, b2.x, b2.y);
      grad.addColorStop(0, 'rgba(80,220,130,0.35)'); grad.addColorStop(1, 'rgba(80,220,130,0)');
      ctx.strokeStyle = grad; ctx.lineWidth = Math.max(3, 3000 / b1.d);
      ctx.beginPath(); ctx.moveTo(b1.x, b1.y); ctx.lineTo(b2.x, b2.y); ctx.stroke();
    }
  }
}

function drawDecor(ctx, cam, game, dusk, time) {
  const plane = game.plane;
  // Trees: small dark cones, near only.
  ctx.fillStyle = '#2f6b34';
  for (const t of decor.trees) {
    const d = Math.hypot(t.x - cam.px, t.z - cam.pz);
    if (d > 1300) continue;
    const b = project(cam, t.x, t.h, t.z);
    const top = project(cam, t.x, t.h + t.s * 1.6, t.z);
    if (!b || !top) continue;
    const wpx = Math.max(2, (t.s * cam.focal) / b.d * 0.5);
    ctx.beginPath();
    ctx.moveTo(b.x - wpx, b.y); ctx.lineTo(top.x, top.y); ctx.lineTo(b.x + wpx, b.y);
    ctx.closePath(); ctx.fill();
  }
  // Huts: white walls, terracotta roofs.
  for (const hut of decor.huts) {
    const d = Math.hypot(hut.x - cam.px, hut.z - cam.pz);
    if (d > 1500) continue;
    const b = project(cam, hut.x, hut.h, hut.z);
    const t2 = project(cam, hut.x, hut.h + 7, hut.z);
    if (!b || !t2) continue;
    const wpx = Math.max(2, 9 * cam.focal / b.d * 0.5);
    ctx.fillStyle = '#f2ead8';
    ctx.fillRect(b.x - wpx, t2.y, wpx * 2, b.y - t2.y);
    ctx.fillStyle = '#b5502e';
    ctx.beginPath();
    ctx.moveTo(b.x - wpx - 2, t2.y); ctx.lineTo(b.x, t2.y - wpx * 0.7); ctx.lineTo(b.x + wpx + 2, t2.y);
    ctx.closePath(); ctx.fill();
  }
  // Hangars: grey boxes beside strips.
  for (const hg of decor.hangars) {
    const d = Math.hypot(hg.x - cam.px, hg.z - cam.pz);
    if (d > 2600) continue;
    const c = Math.cos(hg.heading), sn = Math.sin(hg.heading);
    const corners = [
      [hg.x - c * hg.w / 2 - sn * hg.d / 2, hg.z - sn * hg.w / 2 + c * hg.d / 2],
      [hg.x + c * hg.w / 2 - sn * hg.d / 2, hg.z + sn * hg.w / 2 + c * hg.d / 2],
      [hg.x + c * hg.w / 2 + sn * hg.d / 2, hg.z + sn * hg.w / 2 - c * hg.d / 2],
      [hg.x - c * hg.w / 2 + sn * hg.d / 2, hg.z - sn * hg.w / 2 - c * hg.d / 2],
    ];
    const base = corners.map(([x, z]) => project(cam, x, hg.h, z));
    const top = corners.map(([x, z]) => project(cam, x, hg.h + 9, z));
    if (!base.every(Boolean) || !top.every(Boolean)) continue;
    ctx.fillStyle = '#8b939c';
    poly(ctx, top); ctx.fill();
    ctx.fillStyle = '#6d747d';
    ctx.beginPath();
    ctx.moveTo(base[0].x, base[0].y); ctx.lineTo(top[0].x, top[0].y);
    ctx.lineTo(top[1].x, top[1].y); ctx.lineTo(base[1].x, base[1].y);
    ctx.closePath(); ctx.fill();
  }
  // Lighthouse on Mercusuar + rotating beam at dusk.
  const lh = decor.lighthouse;
  const d = Math.hypot(lh.x - cam.px, lh.z - cam.pz);
  if (d < 5000) {
    const b = project(cam, lh.x, lh.h, lh.z);
    const t2 = project(cam, lh.x, lh.h + 34, lh.z);
    if (b && t2) {
      const wpx = Math.max(2, 5 * cam.focal / b.d);
      ctx.fillStyle = '#f4f1e8';
      ctx.fillRect(b.x - wpx, t2.y, wpx * 2, b.y - t2.y);
      ctx.fillStyle = '#c0392b';
      ctx.fillRect(b.x - wpx, t2.y + (b.y - t2.y) * 0.35, wpx * 2, (b.y - t2.y) * 0.18);
      ctx.fillStyle = '#ffd76a';
      ctx.beginPath(); ctx.arc(b.x, t2.y, wpx * 0.8, 0, 7); ctx.fill();
      if (dusk) {
        const beamA = time * 0.9;
        const bx = lh.x + Math.cos(beamA) * 500, bz = lh.z + Math.sin(beamA) * 500;
        const bp = project(cam, bx, lh.h + 34, bz);
        if (bp) {
          const grad = ctx.createLinearGradient(b.x, t2.y, bp.x, bp.y);
          grad.addColorStop(0, 'rgba(255,220,120,0.4)'); grad.addColorStop(1, 'rgba(255,220,120,0)');
          ctx.strokeStyle = grad; ctx.lineWidth = Math.max(2, 900 / b.d);
          ctx.beginPath(); ctx.moveTo(b.x, t2.y); ctx.lineTo(bp.x, bp.y); ctx.stroke();
        }
      }
    }
  }
}

function drawClouds(ctx, cam, game) {
  for (const cl of clouds) {
    const d = Math.hypot(cl.x - cam.px, cl.z - cam.pz);
    if (d > 9000) continue;
    const p = project(cam, cl.x, cl.y, cl.z);
    if (!p) continue;
    const s = (cl.s * cam.focal) / p.d;
    if (s < 4) continue;
    // A cloud is a cluster of puffs, not one flat pancake.
    const puffs = [
      { dx: -0.55, dy: 0.08, r: 0.62 }, { dx: 0, dy: -0.06, r: 1 },
      { dx: 0.55, dy: 0.1, r: 0.66 }, { dx: 0.2, dy: 0.16, r: 0.5 },
    ];
    for (const pf of puffs) {
      const px = p.x + pf.dx * s, py = p.y + pf.dy * s, pr = pf.r * s;
      const g = ctx.createRadialGradient(px, py, 0, px, py, pr);
      g.addColorStop(0, `rgba(255,255,255,${cl.a})`);
      g.addColorStop(0.7, `rgba(255,255,255,${cl.a * 0.55})`);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(px, py, pr, pr * 0.42, 0, 0, 7);
      ctx.fill();
    }
  }
}
