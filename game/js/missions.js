// missions.js — the courier legs: rings, landings, scoring, stars, fuel decisions.
// One job: turn flying into a game with goals, a score and a verdict per leg.
import { CFG, LEGS, STRIPS } from './config.js';
import { clamp } from './rng.js';
import { stripGeom } from './world.js';
import { resetPlaneToStrip } from './flight.js';

export function makeMission(legIndex) {
  const leg = LEGS[legIndex];
  return {
    leg,
    legIndex,
    rings: leg.rings.map((r) => ({ ...r, passed: false, centre: false })),
    ringIndex: 0,
    score: 0,
    time: 0,
    landed: false,
    landingScore: 0,
    landingQuality: '',
    done: false,
    stars: 0,
    events: [], // {t, text} for the debrief log
  };
}

export function startLeg(game, legIndex) {
  const m = makeMission(legIndex);
  game.mission = m;
  const from = STRIPS[m.leg.from];
  resetPlaneToStrip(game.plane, from);
  game.plane.fuel = CFG.fuelCapacity;
  game.timeOfDay = m.leg.timeOfDay;
  game.weather = m.leg.weather;
  game.wind = { dir: m.leg.wind.dir, speed: m.leg.wind.speed, gust: m.leg.weather === 'rain' ? 3.5 : 0 };
  game.screen = 'fly';
  game.message = m.leg.brief;
  game.messageT = 6;
  game.cameraMode = 'chase';
  game.debrief = null;
  return m;
}

// Ring pass test: within the ring's radius in the plane perpendicular to travel.
export function checkRings(game) {
  const m = game.mission;
  if (!m || m.done) return;
  const ring = m.rings[m.ringIndex];
  if (!ring) return;
  const p = game.plane;
  const dx = p.x - ring.x, dy = p.y - ring.y, dz = p.z - ring.z;
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (dist < 62) {
    ring.passed = true;
    ring.centre = dist < 26;
    const pts = CFG.ringScore + (ring.centre ? CFG.ringCenterBonus : 0);
    m.score += pts;
    m.ringIndex++;
    m.events.push({ t: m.time, text: ring.centre ? `Ring ${m.ringIndex} — dead centre! +${pts}` : `Ring ${m.ringIndex} — +${pts}` });
    game.audio?.ring(ring.centre);
    game.flash = ring.centre ? 'centre' : 'ring';
    game.flashT = 0.9;
    if (m.ringIndex >= m.rings.length) {
      game.message = `All rings! Now land on ${STRIPS[m.leg.to].name} — gear down, flaps help, gentle.`;
      game.messageT = 7;
    }
  }
}

// Landing test: on the destination strip, slow, on the ground.
export function checkLanding(game) {
  const m = game.mission;
  if (!m || m.done) return;
  const p = game.plane;
  if (!p.onGround || p.speed > 26) return;
  const g = stripGeom(m.leg.to);
  const dx = p.x - g.x, dz = p.z - g.z;
  const along = dx * Math.cos(g.heading) + dz * Math.sin(g.heading);
  const across = -dx * Math.sin(g.heading) + dz * Math.cos(g.heading);
  if (Math.abs(along) > g.length / 2 + 40 || Math.abs(across) > 60) return;
  // Landed on the strip. Score it.
  const vs = p.touchdownVs ?? 3;
  const vsScore = clamp(1 - Math.max(0, vs - 1.2) / 4, 0, 1);
  const centreScore = clamp(1 - Math.abs(across) / 15, 0, 1);
  const zoneScore = along > -g.length / 2 + 60 && along < 150 ? 1 : 0.5;
  const gearScore = p.gear > 0.5 ? 1 : 0;
  const quality = vsScore * 0.5 + centreScore * 0.25 + zoneScore * 0.15 + gearScore * 0.1;
  m.landingScore = Math.round(CFG.landingMax * quality);
  m.landingQuality = quality > 0.85 ? 'Butter smooth' : quality > 0.65 ? 'A good landing' : quality > 0.4 ? 'A firm arrival' : 'Rough — the airframe felt that';
  const timeBonus = Math.max(0, Math.round((m.leg.par - m.time) * CFG.timeBonusPerSec));
  const fuelBonus = Math.round(p.fuel * CFG.fuelBonusPerLitre);
  const damagePenalty = Math.round(p.damage * 2);
  m.score += m.landingScore + timeBonus + fuelBonus - damagePenalty;
  m.timeBonus = timeBonus; m.fuelBonus = fuelBonus; m.damagePenalty = damagePenalty;
  m.landed = true; m.done = true;
  const total = m.score;
  m.stars = total >= 950 ? 3 : total >= 700 ? 2 : total >= 450 ? 1 : 0;
  game.audio?.landed(quality);
  game.debrief = {
    leg: m.leg.name, score: total, stars: m.stars,
    rings: `${m.rings.filter((r) => r.passed).length}/${m.rings.length}`,
    landing: m.landingQuality, landingScore: m.landingScore,
    time: Math.round(m.time), timeBonus, fuel: Math.round(p.fuel), fuelBonus,
    damage: Math.round(p.damage), damagePenalty,
  };
  game.best[m.legIndex] = Math.max(game.best[m.legIndex] || 0, m.stars);
  game.screen = 'debrief';
}

// Crash / out-of-fuel handling.
export function checkEndStates(game) {
  const p = game.plane;
  const m = game.mission;
  if (p.crashed && game.screen === 'fly') {
    game.audio?.crash();
    game.screen = 'crashed';
    game.crashInfo = { reason: p.crashReason || 'crashed', score: m ? m.score : 0, time: m ? Math.round(m.time) : 0 };
  }
  if (p.fuel <= 0 && !p.onGround && game.screen === 'fly' && p.speed < 20) {
    game.message = 'Fuel exhausted — she is gliding. Find flat ground or water, gear down, gentle.';
    game.messageT = 5;
  }
}

export function nextRing(game) {
  const m = game.mission;
  if (!m) return null;
  return m.rings[m.ringIndex] || null;
}

export function destinationStrip(game) {
  return game.mission ? stripGeom(game.mission.leg.to) : null;
}
