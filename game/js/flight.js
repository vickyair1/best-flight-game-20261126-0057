// flight.js — the flight model: a twin-turboprop that answers the controls.
// One job: move the plane. Pitch, roll, thrust, drag, lift, stall, ground.
import { CFG } from './config.js';
import { clamp, angDiff } from './rng.js';
import { groundHeight } from './world.js';

export function makePlane() {
  return {
    x: 0, y: 0, z: 0, // metres, y up
    heading: 0, pitch: 0, roll: 0,
    speed: 0, // m/s along the nose
    vs: 0, // vertical speed m/s (for landing judgement)
    throttle: 0,
    flaps: 0, // 0 up, 1 down
    gear: 1, // 1 down, 0 up
    fuel: CFG.fuelCapacity,
    damage: 0,
    onGround: true,
    crashed: false,
    propPhase: 0,
    // per-frame inputs, set by input.js
    pitchIn: 0, rollIn: 0,
  };
}

// Forward vector from heading/pitch.
export function forward(p) {
  const cp = Math.cos(p.pitch);
  return {
    x: Math.cos(p.heading) * cp,
    y: Math.sin(p.pitch),
    z: Math.sin(p.heading) * cp,
  };
}

export function stepFlight(p, input, dt, wind) {
  if (p.crashed) return;
  const gearH = 3.2; // gear height above ground when sitting
  const ground = groundHeight(p.x, p.z);
  const stall = p.flaps > 0.5 ? CFG.stallSpeedFlaps : CFG.stallSpeed;

  // --- Throttle (Shift up, Ctrl down, or +/- keys) ---
  p.throttle = clamp(p.throttle + input.throttleIn * dt * 0.55, 0, 1);

  // --- Attitude: controls answer at every speed, authority grows with speed ---
  const authority = clamp(p.speed / 45, 0.25, 1);
  const targetRoll = input.rollIn * CFG.maxRoll;
  p.roll += (targetRoll - p.roll) * Math.min(1, dt * 3.2 * authority);
  const pitchRate = input.pitchIn * 0.55 * authority;
  p.pitch = clamp(p.pitch + pitchRate * dt, -CFG.maxPitch, CFG.maxPitch);

  // Coordinated turn: bank turns the nose.
  const turn = -Math.sin(p.roll) * CFG.turnRate * clamp(p.speed / 55, 0.2, 1.15);
  p.heading += turn * dt;

  // --- Speed: thrust vs drag ---
  const drag = CFG.dragK * p.speed * p.speed
    + (p.gear ? CFG.gearDrag : 0) * p.speed * p.speed
    + (p.flaps > 0.5 ? CFG.flapDrag : 0) * p.speed * p.speed;
  const thrust = p.throttle * CFG.thrustAccel * (1 - p.speed / (CFG.maxSpeed + 25));
  let accel = thrust - drag;
  // Gravity along the flight path: climbing bleeds speed, diving gains it.
  accel -= Math.sin(p.pitch) * CFG.gravity * 0.55;
  p.speed = Math.max(0, p.speed + accel * dt);

  // --- Lift & vertical speed ---
  const fwd = forward(p);
  const liftFactor = clamp(p.speed / stall, 0, 1.4);
  const climb = Math.sin(p.pitch) * p.speed * CFG.climbK * Math.min(1, liftFactor);
  let vs = climb;
  if (p.speed < stall && !p.onGround) {
    // Stall: the nose drops and she sinks.
    vs -= (stall - p.speed) * 0.9;
    p.pitch += (-0.25 - p.pitch) * dt * 0.8;
  }
  p.vs = vs;

  // --- Wind: pushes the plane sideways, gusts in rain ---
  const gust = wind.gust ? Math.sin(performance.now() / 900) * wind.gust : 0;
  const wx = Math.cos(wind.dir) * (wind.speed + gust);
  const wz = Math.sin(wind.dir) * (wind.speed + gust);

  // --- Integrate ---
  p.x += (fwd.x * p.speed + wx * 0.35) * dt;
  p.z += (fwd.z * p.speed + wz * 0.35) * dt;
  p.y += vs * dt;
  p.propPhase += dt * (6 + p.throttle * 26 + p.speed * 0.12);

  // --- Fuel ---
  const burn = CFG.burnIdle + p.throttle * CFG.burnFull;
  p.fuel = Math.max(0, p.fuel - burn * dt);
  if (p.fuel <= 0 && p.throttle > 0) p.throttle = Math.max(0, p.throttle - dt * 0.2);

  // --- Ground ---
  // The plane stays glued to the ground while rolling: small bumps in the
  // heightmap must never flip it "airborne" at 15 m/s, or the stall sink
  // would slam it back down as a "hard impact". Only the rotate check below
  // can lift it off.
  const floorY = ground + gearH;
  if (p.onGround) {
    if (p.y <= floorY + 0.6) {
      p.y = floorY;
      p.vs = 0;
      // Rolling: light resistance; brakes bleed speed hard.
      p.speed = Math.max(0, p.speed - (input.brake ? 14 : 0.6) * dt - p.speed * 0.02 * dt);
      p.heading += input.rollIn * 0.25 * dt * clamp(p.speed / 20, 0, 1);
      p.roll *= 0.9;
      if (p.speed > CFG.takeoffSpeed && p.pitch > 0.12) {
        p.onGround = false; // rotate!
        p.y += 0.5;
      }
    } else {
      // Above the ground while flagged onGround (drove off a rise): airborne now.
      p.onGround = false;
    }
  }
  if (!p.onGround) {
    if (p.y <= floorY) {
      // Touchdown: judge it by vertical speed and gear.
      p.y = floorY;
      const impact = -p.vs;
      p.onGround = true;
      p.touchdownVs = impact;
      if (impact > CFG.crashVs || (p.gear < 0.5 && p.speed > 25)) {
        p.crashed = true; p.crashReason = impact > CFG.crashVs ? 'hard impact' : 'belly landing';
        return;
      }
      if (impact > CFG.hardLandingVs) p.damage += (impact - CFG.hardLandingVs) * 14;
      if (p.gear < 0.5) p.damage += CFG.gearUpLandingDamage;
      p.pitch = 0;
      p.vs = 0;
    }
    // Terrain collision in the air.
    if (!p.onGround && p.y < ground + 2) {
      if (p.speed > 18) { p.crashed = true; p.crashReason = 'terrain strike'; }
      else { p.y = ground + gearH; p.onGround = true; }
    }
    // Water ditching.
    if (!p.onGround && p.y < 2.5 && ground < 0.5) {
      if (p.speed > 22 || p.vs < -3) { p.crashed = true; p.crashReason = 'ditched in the sea'; }
    }
  }
  // World edge: turn back gently.
  const R = CFG.worldHalf;
  if (Math.abs(p.x) > R || Math.abs(p.z) > R) {
    p.heading += angDiff(Math.atan2(-p.z, -p.x), p.heading) * dt * 0.5;
  }
  p.damage = clamp(p.damage, 0, 100);
  p.stalled = !p.onGround && p.speed < stall;
}

export function resetPlaneToStrip(p, strip, headingOverride) {
  const g = strip;
  const c = Math.cos(g.heading), sn = Math.sin(g.heading);
  p.x = g.x - c * (g.length / 2 - 60);
  p.z = g.z - sn * (g.length / 2 - 60);
  p.y = g.elev + 3.2;
  p.heading = headingOverride ?? g.heading;
  p.pitch = 0; p.roll = 0; p.speed = 0; p.vs = 0;
  p.throttle = 0; p.flaps = 0; p.gear = 1;
  p.fuel = CFG.fuelCapacity; p.damage = 0;
  p.onGround = true; p.crashed = false; p.touchdownVs = 0;
}
