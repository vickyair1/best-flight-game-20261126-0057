// main.js — CENDRAWASIH, Island Courier: the game itself.
// One job: own the screens (menu / fly / paused / debrief / crashed), the loop,
// and the draw order. All the flying, world and drawing live in the other files.
import { CFG, LEGS, STRIPS } from './config.js';
import { makePlane, stepFlight } from './flight.js';
import { startLeg, checkRings, checkLanding, checkEndStates } from './missions.js';
import { makeCamera, updateCamera, drawScene } from './render.js';
import { drawChasePlane, drawCockpitNose } from './plane.js';
import { drawHUD, drawInstrumentStrip, drawCockpitPanel } from './cockpit.js';
import { makeAudio } from './audio.js';
import { makeInput } from './input.js';
import { applyShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

export const game = {
  canvas,
  plane: makePlane(),
  camera: makeCamera(),
  cameraMode: 'chase',
  screen: 'menu',
  mission: null,
  best: [0, 0, 0, 0, 0, 0],
  timeOfDay: 0.18,
  weather: 'clear',
  wind: { dir: 0.6, speed: 3, gust: 0 },
  message: '',
  messageT: 0,
  flash: '',
  flashT: 0,
  debrief: null,
  crashInfo: null,
  lookOffset: { x: 0, y: 0 },
  menuButtons: [],
  debriefButtons: [],
  panelButtons: [],
  shotFrozen: false,
  shotSettle: 0,
  shotName: '',
  audio: null,
  input: null,
};
window.__cendrawasih = game;
game.audio = makeAudio();
game.input = makeInput(game);

// Restore best stars.
try {
  const saved = JSON.parse(localStorage.getItem('cendrawasih-best') || '[]');
  if (Array.isArray(saved)) saved.forEach((v, i) => { if (v) game.best[i] = v; });
} catch { /* fresh start */ }

game.startLeg = function (legIndex) {
  startLeg(game, legIndex);
  game.audio.init();
};
game.restartLeg = function () {
  if (game.mission) startLeg(game, game.mission.legIndex);
};
game.nextLeg = function () {
  const next = (game.mission.legIndex + 1) % LEGS.length;
  startLeg(game, next);
};

function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = window.innerWidth, h = window.innerHeight;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  game.viewW = w; game.viewH = h;
}
window.addEventListener('resize', resize);
resize();

// --- Screens ---
function drawMenu(time) {
  const w = game.viewW, h = game.viewH;
  // Attract scene: the world from a slow orbit over Tanjung at golden hour.
  const p = game.plane;
  p.x = -3500; p.y = 620; p.z = 2500; p.heading = 2.4 + Math.sin(time * 0.05) * 0.2;
  p.pitch = -0.05; p.roll = 0; p.speed = 0; p.throttle = 0;
  game.cameraMode = 'chase';
  game.timeOfDay = 0.72;
  updateCamera(game.camera, p, 'chase', 0.016, w, h);
  drawScene(ctx, w, h, game, 0.016, time);
  // Title block.
  ctx.fillStyle = 'rgba(8,14,20,0.45)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd76a';
  ctx.font = '700 15px system-ui, sans-serif';
  ctx.fillText('C E N D R A W A S I H   A I R   P R E S E N T S', w / 2, h * 0.16);
  ctx.fillStyle = '#fff';
  ctx.font = '800 64px system-ui, sans-serif';
  ctx.fillText('CENDRAWASIH', w / 2, h * 0.16 + 66);
  ctx.fillStyle = '#ffd76a';
  ctx.font = '700 30px system-ui, sans-serif';
  ctx.fillText('— Island Courier —', w / 2, h * 0.16 + 106);
  ctx.fillStyle = '#e8eef2';
  ctx.font = '400 17px system-ui, sans-serif';
  ctx.fillText('Fly the mail between six island strips. Thread the rings, mind the fuel,', w / 2, h * 0.16 + 140);
  ctx.fillText('and bring her home gentle — the islands are watching.', w / 2, h * 0.16 + 164);
  // Leg buttons.
  game.menuButtons = [];
  const bw = 460, bh = 46, gap = 10;
  const y0 = h * 0.42;
  LEGS.forEach((leg, i) => {
    const y = y0 + i * (bh + gap);
    const stars = game.best[i] || 0;
    ctx.fillStyle = 'rgba(12,20,28,0.78)';
    ctx.beginPath(); ctx.roundRect(w / 2 - bw / 2, y, bw, bh, 10); ctx.fill();
    ctx.strokeStyle = 'rgba(255,215,106,0.5)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = '#ffd76a'; ctx.font = '700 15px system-ui, sans-serif'; ctx.textAlign = 'left';
    ctx.fillText(`${i + 1}.  ${leg.name}`, w / 2 - bw / 2 + 16, y + 20);
    ctx.fillStyle = '#9fb2c4'; ctx.font = '600 12px system-ui, sans-serif';
    ctx.fillText(leg.brief.split('.')[0] + '.', w / 2 - bw / 2 + 16, y + 37);
    ctx.fillStyle = '#ffd76a'; ctx.font = '700 16px system-ui, sans-serif'; ctx.textAlign = 'right';
    ctx.fillText('★'.repeat(stars) + '☆'.repeat(3 - stars), w / 2 + bw / 2 - 16, y + 28);
    ctx.textAlign = 'center';
    game.menuButtons.push({ leg: i, x: w / 2 - bw / 2, y, w: bw, h: bh });
  });
  ctx.fillStyle = '#c8d2da'; ctx.font = '400 14px system-ui, sans-serif';
  ctx.fillText('WASD / arrows fly · SHIFT / CTRL throttle · G gear · F flaps · C camera · SPACE brake · P pause · M mute', w / 2, y0 + 6 * (bh + gap) + 8);
  ctx.fillText('Mouse: click the legs above, or the GEAR / FLAPS / CAM switches on the cockpit panel.', w / 2, y0 + 6 * (bh + gap) + 30);
  ctx.fillText('An original game — its own islands, planes, sounds and names. No network, no files but these.', w / 2, y0 + 6 * (bh + gap) + 52);
}

function drawDebrief() {
  const w = game.viewW, h = game.viewH, d = game.debrief;
  ctx.fillStyle = 'rgba(8,14,20,0.72)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd76a'; ctx.font = '700 15px system-ui, sans-serif';
  ctx.fillText('LEG COMPLETE', w / 2, h * 0.18);
  ctx.fillStyle = '#fff'; ctx.font = '800 40px system-ui, sans-serif';
  ctx.fillText(d.leg, w / 2, h * 0.18 + 48);
  ctx.fillStyle = '#ffd76a'; ctx.font = '700 44px system-ui, sans-serif';
  ctx.fillText('★'.repeat(d.stars) + '☆'.repeat(3 - d.stars), w / 2, h * 0.18 + 104);
  ctx.fillStyle = '#e8eef2'; ctx.font = '400 18px system-ui, sans-serif';
  ctx.fillText(d.landing, w / 2, h * 0.18 + 136);
  const rows = [
    ['Rings', `${d.rings}`],
    ['Landing', `+${d.landingScore}`],
    ['Time', `${d.time}s  (+${d.timeBonus})`],
    ['Fuel left', `${d.fuel} L  (+${d.fuelBonus})`],
    ['Damage', `${d.damage}%  (−${d.damagePenalty})`],
    ['SCORE', `${d.score}`],
  ];
  ctx.font = '400 17px system-ui, sans-serif';
  rows.forEach(([k, v], i) => {
    const y = h * 0.18 + 176 + i * 30;
    ctx.fillStyle = '#9fb2c4'; ctx.textAlign = 'right';
    ctx.fillText(k, w / 2 - 20, y);
    ctx.fillStyle = k === 'SCORE' ? '#ffd76a' : '#fff';
    ctx.font = k === 'SCORE' ? '700 19px system-ui, sans-serif' : '400 17px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(v, w / 2 + 20, y);
    ctx.font = '400 17px system-ui, sans-serif';
  });
  // Buttons.
  game.debriefButtons = [];
  const mkBtn = (label, x, action) => {
    const bw = 200, bh = 48, y = h * 0.18 + 176 + 6 * 30 + 26;
    ctx.fillStyle = '#ffd76a';
    ctx.beginPath(); ctx.roundRect(x - bw / 2, y, bw, bh, 10); ctx.fill();
    ctx.fillStyle = '#0c1218'; ctx.font = '700 16px system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(label, x, y + 31);
    game.debriefButtons.push({ x: x - bw / 2, y, w: bw, h: bh, action });
  };
  mkBtn('↻ FLY AGAIN  (R)', w / 2 - 120, () => game.restartLeg());
  mkBtn('NEXT LEG  (⏎)', w / 2 + 120, () => game.nextLeg());
  try { localStorage.setItem('cendrawasih-best', JSON.stringify(game.best)); } catch { /* ignore */ }
}

function drawCrashed() {
  const w = game.viewW, h = game.viewH, c = game.crashInfo;
  ctx.fillStyle = 'rgba(20,8,6,0.66)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff6a55'; ctx.font = '800 44px system-ui, sans-serif';
  ctx.fillText('DOWN.', w / 2, h * 0.4);
  ctx.fillStyle = '#fff'; ctx.font = '400 19px system-ui, sans-serif';
  ctx.fillText(`Kiki ${c.reason}. The courier office sends a recovery boat — the mail is soaked, but you walk away.`, w / 2, h * 0.4 + 36);
  ctx.fillStyle = '#c8d2da'; ctx.font = '400 16px system-ui, sans-serif';
  ctx.fillText(`Score so far ${c.score} · ${c.time}s into the leg`, w / 2, h * 0.4 + 64);
  ctx.fillStyle = '#ffd76a'; ctx.font = '700 18px system-ui, sans-serif';
  ctx.fillText('Click anywhere or press R to fly the leg again', w / 2, h * 0.4 + 104);
}

function drawPaused() {
  const w = game.viewW, h = game.viewH;
  ctx.fillStyle = 'rgba(8,14,20,0.6)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff'; ctx.font = '800 40px system-ui, sans-serif';
  ctx.fillText('PAUSED', w / 2, h * 0.42);
  ctx.fillStyle = '#c8d2da'; ctx.font = '400 16px system-ui, sans-serif';
  ctx.fillText('P or Esc to resume · R restart leg · M mute · C switch camera', w / 2, h * 0.42 + 34);
}

// --- Main loop ---
let last = performance.now();
let stallBeepT = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const time = now / 1000;
  const w = game.viewW, h = game.viewH;
  ctx.clearRect(0, 0, w, h);

  if (game.screen === 'menu') { drawMenu(time); requestAnimationFrame(frame); return; }

  const p = game.plane;
  if (game.screen === 'fly' && !game.shotFrozen) {
    game.input.poll();
    stepFlight(p, game.input, dt, game.wind);
    if (game.mission) {
      game.mission.time += dt;
      checkRings(game);
      checkLanding(game);
      checkEndStates(game);
    }
    if (p.stalled) {
      stallBeepT -= dt;
      if (stallBeepT <= 0) { game.audio.stallWarn(); stallBeepT = 0.7; }
    }
    game.audio.update(p, dt);
  }
  if (game.flashT > 0) game.flashT -= dt;
  if (game.messageT > 0) game.messageT -= dt;

  // Camera: look offset from mouse drag.
  const lookX = game.lookOffset.x * 0.12, lookY = game.lookOffset.y * 0.06;
  updateCamera(game.camera, p, game.cameraMode, game.shotFrozen ? 0.5 : dt, w, h);
  if (lookX || lookY) { game.camera.cy += lookY * h * 0.2; game.camera.cx += lookX * w * 0.15; }
  // Staged-shot framing: shift the world a touch so a ring reads clear of the plane.
  if (game.camAim) {
    game.camera.cx += game.camAim.dx * w;
    game.camera.cy += game.camAim.dy * h;
  }

  drawScene(ctx, w, h, game, dt, time);

  // Aircraft + instruments.
  if (game.cameraMode === 'chase') {
    const planeS = Math.min(w, h) * 0.22;
    // The plane sits just below centre, clearly in frame but small enough
    // that the world, the rings and the runway stay readable around her.
    const planeY = h * (game.planeScreenY ?? 0.52);
    drawChasePlane(ctx, w / 2 + game.lookOffset.x * 30, planeY, planeS, p.roll, p.propPhase, p.gear, p.flaps, game.timeOfDay > 0.68);
    drawInstrumentStrip(ctx, w, h, game);
  } else {
    drawCockpitNose(ctx, w, h, p);
    game.panelButtons = drawCockpitPanel(ctx, w, h, game);
  }
  drawHUD(ctx, w, h, game, time);

  // Mission banner.
  if (game.messageT > 0 && game.message) {
    ctx.fillStyle = 'rgba(8,14,20,0.66)';
    ctx.font = '400 15px system-ui, sans-serif';
    const tw = ctx.measureText(game.message).width + 28;
    ctx.beginPath(); ctx.roundRect(w / 2 - tw / 2, 96, tw, 30, 8); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
    ctx.fillText(game.message, w / 2, 116);
    ctx.textAlign = 'left';
  }

  if (game.screen === 'paused') drawPaused();
  if (game.screen === 'debrief') drawDebrief();
  if (game.screen === 'crashed') drawCrashed();

  // Screenshot readiness: after the camera has settled on a frozen pose.
  if (game.shotFrozen) {
    game.shotSettle += dt;
    if (game.shotSettle > 1.2 && !window.__shotReady) {
      window.__shotReady = true;
      window.__shotInfo = {
        shot: game.shotName, screen: game.screen,
        altFt: Math.round(p.y * 3.28084), speedKt: Math.round(p.speed * 1.94384),
        heading: Math.round(((p.heading * 180 / Math.PI) % 360 + 360) % 360),
      };
    }
  }
  requestAnimationFrame(frame);
}

// Boot: menu attract mode needs a plane + mission to render the world.
startLeg(game, 0);
game.screen = 'menu';
game.mission = null;
game.plane = makePlane();
game.plane.x = -3500; game.plane.y = 620; game.plane.z = 2500;
game.timeOfDay = 0.72;
game.weather = 'clear';

// Screenshot poses from the URL.
const params = new URLSearchParams(location.search);
const shot = params.get('shot');
if (shot) {
  applyShot(game, shot);
  // applyShot sets screen fly + frozen; make sure the camera starts near the pose.
  const p = game.plane;
  const cam = game.camera;
  cam.px = p.x - Math.cos(p.heading) * 26; cam.py = p.y + 7; cam.pz = p.z - Math.sin(p.heading) * 26;
  if (game.cameraMode === 'cockpit') { cam.px = p.x; cam.py = p.y + 1.7; cam.pz = p.z; }
}
requestAnimationFrame(frame);
