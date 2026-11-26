// plane.js — the aircraft itself: Kiki, a twin-turboprop courier in Cendrawasih Air livery.
// One job: draw the plane. Chase view shows her whole airframe; cockpit view her nose.
import { clamp } from './rng.js';

// Draw the plane from behind (chase view), centred at (cx, cy), sized by `s` px.
// Roll rotates the airframe; propPhase spins the prop blur.
export function drawChasePlane(ctx, cx, cy, s, roll, propPhase, gear, flaps, dusk) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(roll * 0.55);
  const u = s / 100; // unit
  // Soft shadow blob under the plane (she floats above the ground far below).
  // --- Tail ---
  ctx.fillStyle = '#e8590c';
  ctx.beginPath(); // vertical stabiliser
  ctx.moveTo(-6 * u, -34 * u); ctx.lineTo(6 * u, -34 * u);
  ctx.lineTo(9 * u, -58 * u); ctx.lineTo(-9 * u, -58 * u);
  ctx.closePath(); ctx.fill();
  // Bird mark on the tail.
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(0, -46 * u, 4.5 * u, 0, 7); ctx.fill();
  ctx.fillStyle = '#e8590c';
  ctx.beginPath(); ctx.arc(1.5 * u, -47 * u, 2.2 * u, 0, 7); ctx.fill();
  // Horizontal stabiliser.
  ctx.fillStyle = '#f8f4ec';
  ctx.beginPath();
  ctx.moveTo(-30 * u, -30 * u); ctx.lineTo(30 * u, -30 * u);
  ctx.lineTo(26 * u, -22 * u); ctx.lineTo(-26 * u, -22 * u);
  ctx.closePath(); ctx.fill();
  // --- Fuselage (seen from behind, slightly above) ---
  const bodyGrad = ctx.createLinearGradient(0, -30 * u, 0, 34 * u);
  bodyGrad.addColorStop(0, '#fdfbf6');
  bodyGrad.addColorStop(0.55, '#f3ede0');
  bodyGrad.addColorStop(1, '#d8cfba');
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.moveTo(-13 * u, -30 * u);
  ctx.quadraticCurveTo(-17 * u, 0, -12 * u, 30 * u);
  ctx.quadraticCurveTo(0, 36 * u, 12 * u, 30 * u);
  ctx.quadraticCurveTo(17 * u, 0, 13 * u, -30 * u);
  ctx.closePath(); ctx.fill();
  // Orange cheatline (the titles live on the tail — the fuselage is too
  // narrow for the airline name at this scale).
  ctx.fillStyle = '#e8590c';
  ctx.fillRect(-14.5 * u, -6 * u, 29 * u, 5 * u);
  // Rear cargo door outline + APU.
  ctx.strokeStyle = 'rgba(18,50,74,0.35)'; ctx.lineWidth = 1 * u;
  ctx.strokeRect(-8 * u, 16 * u, 16 * u, 12 * u);
  // --- Wings (low wing, slight dihedral) ---
  ctx.fillStyle = '#f8f4ec';
  ctx.beginPath();
  ctx.moveTo(-13 * u, 2 * u); ctx.lineTo(-78 * u, 14 * u);
  ctx.lineTo(-78 * u, 22 * u); ctx.lineTo(-13 * u, 12 * u);
  ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(13 * u, 2 * u); ctx.lineTo(78 * u, 14 * u);
  ctx.lineTo(78 * u, 22 * u); ctx.lineTo(13 * u, 12 * u);
  ctx.closePath(); ctx.fill();
  // Wing tips: orange.
  ctx.fillStyle = '#e8590c';
  ctx.fillRect(-78 * u, 14 * u, 6 * u, 8 * u);
  ctx.fillRect(72 * u, 14 * u, 6 * u, 8 * u);
  // Flaps (lowered when flaps down).
  if (flaps > 0.5) {
    ctx.fillStyle = '#d8cfba';
    ctx.fillRect(-52 * u, 20 * u, 34 * u, 5 * u);
    ctx.fillRect(18 * u, 20 * u, 34 * u, 5 * u);
  }
  // --- Engines + spinning props ---
  for (const side of [-1, 1]) {
    const ex = side * 40 * u, ey = 6 * u;
    // Nacelle.
    ctx.fillStyle = '#e8e0cd';
    ctx.beginPath(); ctx.ellipse(ex, ey, 9 * u, 11 * u, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#12324a';
    ctx.beginPath(); ctx.ellipse(ex, ey - 2 * u, 6.5 * u, 7 * u, 0, 0, 7); ctx.fill();
    // Prop blur disc.
    const pr = 24 * u;
    const pg = ctx.createRadialGradient(ex, ey - 2 * u, 2, ex, ey - 2 * u, pr);
    pg.addColorStop(0, 'rgba(220,225,230,0.10)');
    pg.addColorStop(0.75, 'rgba(220,225,230,0.22)');
    pg.addColorStop(1, 'rgba(220,225,230,0)');
    ctx.fillStyle = pg;
    ctx.beginPath(); ctx.arc(ex, ey - 2 * u, pr, 0, 7); ctx.fill();
    // Prop blades (two, rotating).
    ctx.strokeStyle = 'rgba(40,44,48,0.75)';
    ctx.lineWidth = 2.4 * u;
    const a = propPhase + (side < 0 ? 0.6 : 0);
    ctx.beginPath();
    ctx.moveTo(ex - Math.cos(a) * pr * 0.92, ey - 2 * u - Math.sin(a) * pr * 0.92);
    ctx.lineTo(ex + Math.cos(a) * pr * 0.92, ey - 2 * u + Math.sin(a) * pr * 0.92);
    ctx.stroke();
    // Spinner.
    ctx.fillStyle = '#e8590c';
    ctx.beginPath(); ctx.arc(ex, ey - 2 * u, 3.2 * u, 0, 7); ctx.fill();
    // Exhaust shimmer.
    ctx.fillStyle = 'rgba(120,130,140,0.25)';
    ctx.fillRect(ex - 3 * u, ey + 9 * u, 6 * u, 8 * u);
  }
  // --- Nav lights (blink) ---
  const blink = (Math.sin(propPhase * 0.35) > 0) ? 1 : 0.25;
  ctx.fillStyle = `rgba(255,60,60,${blink})`;
  ctx.beginPath(); ctx.arc(-78 * u, 18 * u, 2.6 * u, 0, 7); ctx.fill();
  ctx.fillStyle = `rgba(60,255,120,${blink})`;
  ctx.beginPath(); ctx.arc(78 * u, 18 * u, 2.6 * u, 0, 7); ctx.fill();
  ctx.fillStyle = `rgba(255,255,255,${blink})`;
  ctx.beginPath(); ctx.arc(0, -58 * u, 2.2 * u, 0, 7); ctx.fill();
  // --- Landing gear (when down) ---
  if (gear > 0.5) {
    ctx.strokeStyle = '#2c3136'; ctx.lineWidth = 2.4 * u;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(side * 9 * u, 30 * u); ctx.lineTo(side * 11 * u, 44 * u);
      ctx.stroke();
      ctx.fillStyle = '#1c1f22';
      ctx.beginPath(); ctx.arc(side * 11 * u, 46 * u, 4 * u, 0, 7); ctx.fill();
    }
    ctx.beginPath(); ctx.moveTo(0, 32 * u); ctx.lineTo(0, 44 * u); ctx.stroke();
    ctx.fillStyle = '#1c1f22';
    ctx.beginPath(); ctx.arc(0, 46 * u, 3.4 * u, 0, 7); ctx.fill();
  }
  ctx.restore();
}

// Cockpit view: the nose + cowling bottom edge, seen over the panel.
export function drawCockpitNose(ctx, w, h, plane) {
  const cx = w / 2;
  const noseY = h * 0.62;
  // Cowling: the nose cone bottom, with the orange stripe.
  const grad = ctx.createLinearGradient(0, noseY, 0, h);
  grad.addColorStop(0, '#f3ede0');
  grad.addColorStop(0.12, '#e8e0cd');
  grad.addColorStop(1, '#5a5648');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.16, noseY + 30);
  ctx.quadraticCurveTo(cx, noseY - 46, cx + w * 0.16, noseY + 30);
  ctx.lineTo(cx + w * 0.34, h);
  ctx.lineTo(cx - w * 0.34, h);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#e8590c';
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.13, noseY + 26);
  ctx.quadraticCurveTo(cx, noseY - 12, cx + w * 0.13, noseY + 26);
  ctx.lineTo(cx + w * 0.16, noseY + 44);
  ctx.lineTo(cx - w * 0.16, noseY + 44);
  ctx.closePath(); ctx.fill();
  // Prop blur arcs at the nose edges.
  const spin = plane.propPhase;
  ctx.strokeStyle = 'rgba(200,205,210,0.35)';
  ctx.lineWidth = 3;
  for (const side of [-1, 1]) {
    const px = cx + side * w * 0.30;
    ctx.beginPath();
    ctx.arc(px, noseY - 10, 54, spin % 6.28, (spin % 6.28) + 2.2);
    ctx.stroke();
  }
}
