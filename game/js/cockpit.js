// cockpit.js — instruments that look flown, and the HUD.
// One job: every number and gauge the pilot reads. Lit panels, big legible digits.
import { clamp } from './rng.js';
import { nextRing } from './missions.js';

const MS_TO_KT = 1.94384;
const M_TO_FT = 3.28084;

function fmt(n) { return Math.round(n).toLocaleString('en-US'); }

// --- Artificial horizon: sky/ground split, rolled and pitched. ---
export function drawArtificialHorizon(ctx, x, y, r, roll, pitch) {
  ctx.save();
  ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.clip();
  ctx.translate(x, y);
  ctx.rotate(-roll);
  const py = clamp(pitch, -0.5, 0.5) * r * 2.2;
  ctx.fillStyle = '#7fb2e0';
  ctx.fillRect(-r - 2, -r - 2 + py, r * 2 + 4, r + 2 - py);
  ctx.fillStyle = '#8a6a42';
  ctx.fillRect(-r - 2, py, r * 2 + 4, r + 2);
  // Horizon line + pitch ladder.
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(-r, py); ctx.lineTo(r, py); ctx.stroke();
  ctx.lineWidth = 1;
  for (const dp of [-0.2, -0.1, 0.1, 0.2]) {
    const yy = py - dp * r * 2.2;
    ctx.beginPath(); ctx.moveTo(-r * 0.45, yy); ctx.lineTo(r * 0.45, yy); ctx.stroke();
  }
  ctx.restore();
  // Fixed wings + bezel.
  ctx.strokeStyle = '#ffd76a'; ctx.lineWidth = 2.4;
  ctx.beginPath(); ctx.moveTo(x - r * 0.62, y); ctx.lineTo(x - r * 0.18, y);
  ctx.moveTo(x + r * 0.18, y); ctx.lineTo(x + r * 0.62, y); ctx.stroke();
  ctx.fillStyle = '#ffd76a';
  ctx.beginPath(); ctx.arc(x, y, 3, 0, 7); ctx.fill();
  ctx.strokeStyle = '#e8e2d2'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.stroke();
}

// --- Round gauge: dial with ticks, needle and digital readout. ---
function roundGauge(ctx, x, y, r, value, min, max, label, unit, opts = {}) {
  ctx.save();
  // Face.
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 2, x, y, r);
  g.addColorStop(0, '#2c3644'); g.addColorStop(1, '#12181f');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  ctx.strokeStyle = '#d8d2c2'; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.stroke();
  // Ticks.
  const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25;
  for (let i = 0; i <= 10; i++) {
    const a = a0 + (a1 - a0) * (i / 10);
    const big = i % 5 === 0;
    ctx.strokeStyle = '#cfd6de'; ctx.lineWidth = big ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * r * (big ? 0.78 : 0.85), y + Math.sin(a) * r * (big ? 0.78 : 0.85));
    ctx.lineTo(x + Math.cos(a) * r * 0.94, y + Math.sin(a) * r * 0.94);
    ctx.stroke();
  }
  // Red arc for the danger zone.
  if (opts.redFrom != null) {
    const ra0 = a0 + (a1 - a0) * opts.redFrom, ra1 = a1;
    ctx.strokeStyle = '#ff5544'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(x, y, r * 0.86, ra0, ra1); ctx.stroke();
  }
  // Needle.
  const t = clamp((value - min) / (max - min), 0, 1);
  const na = a0 + (a1 - a0) * t;
  ctx.strokeStyle = '#ffd76a'; ctx.lineWidth = 2.4;
  ctx.beginPath(); ctx.moveTo(x, y);
  ctx.lineTo(x + Math.cos(na) * r * 0.8, y + Math.sin(na) * r * 0.8); ctx.stroke();
  ctx.fillStyle = '#ffd76a';
  ctx.beginPath(); ctx.arc(x, y, 3, 0, 7); ctx.fill();
  // Label + value.
  ctx.fillStyle = '#9fb2c4'; ctx.font = `600 ${Math.max(9, r * 0.22)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(label, x, y + r * 0.48);
  ctx.fillStyle = '#f2f6fa'; ctx.font = `700 ${Math.max(12, r * 0.34)}px system-ui, sans-serif`;
  ctx.fillText(opts.text ?? fmt(value), x, y + r * 0.78);
  ctx.textAlign = 'left';
  ctx.restore();
}

// --- Compass tape across the top. ---
function compassTape(ctx, w, headingDeg) {
  const y = 56, halfW = 190;
  ctx.fillStyle = 'rgba(8,14,20,0.62)';
  ctx.fillRect(w / 2 - halfW - 10, y - 18, halfW * 2 + 20, 34);
  ctx.save();
  ctx.beginPath(); ctx.rect(w / 2 - halfW, y - 18, halfW * 2, 34); ctx.clip();
  const pxPerDeg = 3.2;
  for (let d = -60; d <= 60; d += 5) {
    let deg = Math.round(headingDeg + d);
    deg = ((deg % 360) + 360) % 360;
    const x = w / 2 + d * pxPerDeg;
    const cardinal = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' }[deg];
    ctx.strokeStyle = '#dfe6ec'; ctx.lineWidth = cardinal ? 2 : 1;
    ctx.beginPath(); ctx.moveTo(x, y + 8); ctx.lineTo(x, y + (cardinal ? -6 : 2)); ctx.stroke();
    if (cardinal || deg % 30 === 0) {
      ctx.fillStyle = cardinal ? '#ffd76a' : '#c8d2da';
      ctx.font = `700 ${cardinal ? 13 : 10}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(cardinal ?? String(deg).padStart(3, '0'), x, y - 8);
    }
  }
  ctx.restore();
  // Centre caret + digital heading.
  ctx.fillStyle = '#ffd76a';
  ctx.beginPath(); ctx.moveTo(w / 2 - 7, y - 18); ctx.lineTo(w / 2 + 7, y - 18); ctx.lineTo(w / 2, y - 8); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = '700 13px system-ui, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(String(Math.round(headingDeg)).padStart(3, '0') + '°', w / 2, y + 30);
  ctx.textAlign = 'left';
}

// --- Top HUD bar: speed, heading, altitude, throttle, fuel, score. ---
export function drawHUD(ctx, w, h, game, time) {
  const p = game.plane;
  const kt = p.speed * MS_TO_KT;
  const altFt = p.y * M_TO_FT;
  const hdg = ((p.heading * 180 / Math.PI) % 360 + 360) % 360;
  ctx.textAlign = 'left';
  // Bar background (opaque enough that bright clouds behind it never eat the text).
  ctx.fillStyle = 'rgba(8,14,20,0.72)';
  ctx.fillRect(0, 0, w, 46);
  // Speed.
  ctx.fillStyle = '#9fb2c4'; ctx.font = '600 11px system-ui, sans-serif';
  ctx.fillText('SPEED', 16, 16);
  ctx.fillStyle = p.stalled ? '#ff6a55' : '#fff'; ctx.font = '700 26px system-ui, sans-serif';
  const spdText = fmt(kt);
  const spdW = ctx.measureText(spdText).width;
  ctx.fillText(spdText, 16, 40);
  ctx.fillStyle = '#9fb2c4'; ctx.font = '600 11px system-ui, sans-serif';
  ctx.fillText('KT', 16 + spdW + 8, 40);
  // Compass tape.
  compassTape(ctx, w, hdg);
  // Altitude.
  ctx.fillStyle = '#9fb2c4'; ctx.font = '600 11px system-ui, sans-serif';
  const altLabel = 'ALTITUDE';
  ctx.fillText(altLabel, w - 170, 16);
  ctx.fillStyle = '#fff'; ctx.font = '700 26px system-ui, sans-serif';
  const altText = fmt(altFt);
  const altW = ctx.measureText(altText).width;
  ctx.fillText(altText, w - 170, 40);
  ctx.fillStyle = '#9fb2c4'; ctx.font = '600 11px system-ui, sans-serif';
  ctx.fillText('FT', w - 170 + altW + 8, 40);
  // Vertical speed arrow.
  const vs = p.vs * 196.85; // ft/min
  ctx.fillStyle = vs > 60 ? '#8fd6a0' : vs < -500 ? '#ff8a70' : '#c8d2da';
  ctx.font = '700 13px system-ui, sans-serif';
  ctx.fillText((vs >= 0 ? '▲ +' : '▼ ') + fmt(Math.abs(vs)) + ' fpm', w - 170, 62);
  // Throttle + fuel, right side second row (kept clear of the ALT readout).
  const tx = w - 430, ty = 56;
  ctx.fillStyle = '#9fb2c4'; ctx.font = '600 11px system-ui, sans-serif';
  ctx.fillText('THR', tx, ty + 4);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(tx + 34, ty - 5, 110, 10);
  ctx.fillStyle = p.throttle > 0.9 ? '#ffb13d' : '#7fd6a0';
  ctx.fillRect(tx + 34, ty - 5, 110 * p.throttle, 10);
  ctx.fillStyle = '#fff'; ctx.font = '700 12px system-ui, sans-serif';
  ctx.fillText(Math.round(p.throttle * 100) + '%', tx + 150, ty + 5);
  // Fuel.
  const fuelLow = p.fuel < 40;
  ctx.fillStyle = fuelLow && Math.sin(time * 8) > 0 ? '#ff6a55' : '#9fb2c4';
  ctx.font = '600 11px system-ui, sans-serif';
  ctx.fillText('FUEL', tx, ty + 22);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(tx + 34, ty + 13, 110, 10);
  ctx.fillStyle = fuelLow ? '#ff6a55' : '#ffd76a';
  ctx.fillRect(tx + 34, ty + 13, 110 * clamp(p.fuel / 220, 0, 1), 10);
  ctx.fillStyle = '#fff'; ctx.font = '700 12px system-ui, sans-serif';
  ctx.fillText(Math.round(p.fuel) + ' L', tx + 150, ty + 22);
  // Score + rings, left second row.
  const m = game.mission;
  ctx.fillStyle = '#fff'; ctx.font = '700 15px system-ui, sans-serif';
  ctx.fillText(`SCORE ${fmt(m ? m.score : 0)}`, 16, 66);
  if (m) {
    ctx.fillStyle = '#ffd76a'; ctx.font = '700 13px system-ui, sans-serif';
    ctx.fillText(`◉ RINGS ${m.ringIndex}/${m.rings.length}`, 150, 66);
    const ring = nextRing(game);
    if (ring) {
      const d = Math.hypot(ring.x - p.x, ring.y - p.y, ring.z - p.z);
      ctx.fillStyle = '#c8d2da'; ctx.font = '600 12px system-ui, sans-serif';
      ctx.fillText(`next ring ${(d / 1000).toFixed(1)} km`, 280, 66);
    } else {
      ctx.fillStyle = '#8fd6a0'; ctx.font = '700 13px system-ui, sans-serif';
      ctx.fillText(`LAND: ${m.leg.to.toUpperCase()}`, 270, 66);
    }
    ctx.fillStyle = '#c8d2da'; ctx.font = '600 12px system-ui, sans-serif';
    ctx.fillText(`LEG ${m.leg.id}/6 · ${m.leg.name} · ${fmt(m.time)}s`, 16, 86);
  }
  // Warnings.
  let warnY = 104;
  const warn = (text, col) => {
    ctx.fillStyle = 'rgba(8,14,20,0.6)';
    const tw = ctx.measureText(text).width + 18;
    ctx.fillRect(w / 2 - tw / 2, warnY - 14, tw, 22);
    ctx.fillStyle = col; ctx.font = '700 13px system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(text, w / 2, warnY + 2);
    ctx.textAlign = 'left';
    warnY += 26;
  };
  if (p.stalled) warn('⚠ STALL — NOSE DOWN, FULL THROTTLE', '#ff6a55');
  if (fuelLow) warn('⚠ LOW FUEL', '#ffb13d');
  if (p.damage > 40) warn(`⚠ AIRFRAME DAMAGE ${Math.round(p.damage)}%`, '#ffb13d');
  if (game.flashT > 0) {
    ctx.fillStyle = game.flash === 'centre' ? '#ffd76a' : '#8fd6a0';
    ctx.font = '700 26px system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(game.flash === 'centre' ? 'DEAD CENTRE! +150' : 'RING! +100', w / 2, h * 0.3);
    ctx.textAlign = 'left';
  }
}

// --- Chase-view instrument strip along the bottom. ---
export function drawInstrumentStrip(ctx, w, h, game) {
  const p = game.plane;
  const y0 = h - 108;
  ctx.fillStyle = 'rgba(10,16,22,0.82)';
  ctx.beginPath();
  ctx.roundRect(w / 2 - 330, y0, 660, 100, 12);
  ctx.fill();
  ctx.strokeStyle = 'rgba(216,210,194,0.35)'; ctx.lineWidth = 1;
  ctx.stroke();
  // Lit glow line on top edge.
  ctx.fillStyle = 'rgba(255,215,106,0.5)';
  ctx.fillRect(w / 2 - 330, y0, 660, 2);
  const cx = w / 2;
  drawArtificialHorizon(ctx, cx - 250, y0 + 50, 38, p.roll, p.pitch);
  roundGauge(ctx, cx - 130, y0 + 50, 38, p.speed * MS_TO_KT, 0, 220, 'AIRSPEED', 'KT',
    { text: fmt(p.speed * MS_TO_KT), redFrom: 0.9 });
  roundGauge(ctx, cx - 10, y0 + 50, 38, p.y * M_TO_FT, 0, 6000, 'ALT', 'FT',
    { text: fmt(p.y * M_TO_FT) });
  roundGauge(ctx, cx + 110, y0 + 50, 38, p.throttle * 100, 0, 100, 'RPM ×100', '%',
    { text: fmt(1900 + p.throttle * 600) });
  // Fuel bar + gear/flaps lights.
  const fx = cx + 185;
  ctx.fillStyle = '#9fb2c4'; ctx.font = '600 10px system-ui, sans-serif'; ctx.textAlign = 'left';
  ctx.fillText('FUEL', fx, y0 + 24);
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillRect(fx, y0 + 30, 110, 10);
  ctx.fillStyle = p.fuel < 40 ? '#ff6a55' : '#ffd76a';
  ctx.fillRect(fx, y0 + 30, 110 * clamp(p.fuel / 220, 0, 1), 10);
  ctx.fillStyle = '#fff'; ctx.font = '700 12px system-ui, sans-serif';
  ctx.fillText(Math.round(p.fuel) + ' L', fx, y0 + 58);
  const lamp = (label, on, col, yy) => {
    ctx.fillStyle = on ? col : 'rgba(255,255,255,0.14)';
    ctx.beginPath(); ctx.arc(fx + 8, yy, 6, 0, 7); ctx.fill();
    ctx.fillStyle = '#c8d2da'; ctx.font = '600 11px system-ui, sans-serif';
    ctx.fillText(label, fx + 20, yy + 4);
  };
  lamp('GEAR', p.gear > 0.5, '#8fd6a0', y0 + 76);
  lamp('FLAPS', p.flaps > 0.5, '#7fb2e0', y0 + 94);
}

// --- Full cockpit panel (cockpit view). Returns clickable button rects. ---
export function drawCockpitPanel(ctx, w, h, game) {
  const p = game.plane;
  const y0 = h - 208;
  // Panel body.
  const grad = ctx.createLinearGradient(0, y0, 0, h);
  grad.addColorStop(0, '#232c36'); grad.addColorStop(1, '#12181f');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(0, h);
  ctx.lineTo(0, y0 + 40);
  ctx.quadraticCurveTo(w / 2, y0 - 26, w, y0 + 40);
  ctx.lineTo(w, h);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(216,210,194,0.3)'; ctx.lineWidth = 1;
  ctx.stroke();
  // Warm instrument glow.
  ctx.fillStyle = 'rgba(255,190,90,0.10)';
  ctx.fillRect(0, y0, w, 10);
  const cx = w / 2;
  drawArtificialHorizon(ctx, cx, y0 + 92, 62, p.roll, p.pitch);
  roundGauge(ctx, cx - 190, y0 + 92, 58, p.speed * MS_TO_KT, 0, 220, 'AIRSPEED', 'KT',
    { text: fmt(p.speed * MS_TO_KT), redFrom: 0.9 });
  roundGauge(ctx, cx + 190, y0 + 92, 58, p.y * M_TO_FT, 0, 6000, 'ALTIMETER', 'FT',
    { text: fmt(p.y * M_TO_FT) });
  roundGauge(ctx, cx - 330, y0 + 92, 50, p.throttle * 100, 0, 100, 'RPM', '%',
    { text: fmt(1900 + p.throttle * 600) });
  roundGauge(ctx, cx + 330, y0 + 92, 50, ((p.heading * 180 / Math.PI) % 360 + 360) % 360, 0, 360, 'HEADING', '°',
    { text: String(Math.round(((p.heading * 180 / Math.PI) % 360 + 360) % 360)).padStart(3, '0') });
  // Fuel + damage bars on the left wing of the panel.
  const bx = 26;
  ctx.fillStyle = '#9fb2c4'; ctx.font = '600 11px system-ui, sans-serif'; ctx.textAlign = 'left';
  ctx.fillText('FUEL', bx, y0 + 60);
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillRect(bx, y0 + 68, 130, 12);
  ctx.fillStyle = p.fuel < 40 ? '#ff6a55' : '#ffd76a';
  ctx.fillRect(bx, y0 + 68, 130 * clamp(p.fuel / 220, 0, 1), 12);
  ctx.fillStyle = '#fff'; ctx.font = '700 13px system-ui, sans-serif';
  ctx.fillText(Math.round(p.fuel) + ' L', bx, y0 + 100);
  ctx.fillStyle = '#9fb2c4'; ctx.font = '600 11px system-ui, sans-serif';
  ctx.fillText('AIRFRAME', bx, y0 + 122);
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillRect(bx, y0 + 130, 130, 12);
  ctx.fillStyle = p.damage > 40 ? '#ff6a55' : '#8fd6a0';
  ctx.fillRect(bx, y0 + 130, 130 * (1 - p.damage / 100), 12);
  ctx.fillStyle = '#fff'; ctx.font = '700 13px system-ui, sans-serif';
  ctx.fillText(Math.round(100 - p.damage) + '%', bx, y0 + 160);
  // Clickable switches on the right wing: GEAR / FLAPS / CAM.
  const btns = [];
  const mkBtn = (label, x, on, col) => {
    const bw = 92, bh = 40;
    ctx.fillStyle = on ? col : 'rgba(255,255,255,0.10)';
    ctx.beginPath(); ctx.roundRect(x, y0 + 56, bw, bh, 8); ctx.fill();
    ctx.strokeStyle = on ? '#fff' : 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = on ? '#0c1218' : '#dfe6ec';
    ctx.font = '700 13px system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(label, x + bw / 2, y0 + 81);
    ctx.textAlign = 'left';
    btns.push({ label, x, y: y0 + 56, w: bw, h: bh });
  };
  mkBtn(p.gear > 0.5 ? 'GEAR ▼' : 'GEAR ▲', w - 330, p.gear > 0.5, '#8fd6a0');
  mkBtn(p.flaps > 0.5 ? 'FLAPS ▼' : 'FLAPS ▲', w - 226, p.flaps > 0.5, '#7fb2e0');
  mkBtn('CAM ◐', w - 122, game.cameraMode === 'cockpit', '#ffd76a');
  return btns;
}
