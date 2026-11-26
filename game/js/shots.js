// shots.js — staged screenshot poses for ?shot=.
// One job: put the game in a photogenic, deterministic state, then say ready.
// The game reads ?shot=<name>&seed=<n>; each pose sets leg, plane, weather,
// time of day and camera, then freezes the sim so the render is stable.
import { STRIPS } from './config.js';
import { startLeg } from './missions.js';
import { resetPlaneToStrip } from './flight.js';

export function applyShot(game, name) {
  const p = game.plane;
  const set = (legIdx, opts) => {
    startLeg(game, legIdx);
    Object.assign(p, opts.plane || {});
    if (opts.timeOfDay != null) game.timeOfDay = opts.timeOfDay;
    if (opts.weather) game.weather = opts.weather;
    if (opts.camera) game.cameraMode = opts.camera;
    if (opts.ringIndex != null) game.mission.ringIndex = opts.ringIndex;
    if (opts.ringsPassed) game.mission.rings.forEach((r, i) => { r.passed = i < opts.ringsPassed; });
    if (opts.camAim) game.camAim = opts.camAim; else game.camAim = null;
    if (opts.planeScreenY != null) game.planeScreenY = opts.planeScreenY; else game.planeScreenY = 0.52;
    game.screen = 'fly';
    game.shotFrozen = true; // sim holds still; props keep their phase
    // Let the camera settle on the pose, then flag ready.
    game.shotSettle = 0;
  };
  switch (name) {
    case 'cover': {
      // Golden hour, chase view: the ring hangs just ahead and above the
      // plane, volcano filling the background, bay and islands below.
      set(1, {
        plane: { x: 2350, y: 610, z: -1150, heading: 4.91, pitch: -0.02, roll: -0.08, speed: 68, throttle: 0.72, gear: 0, flaps: 0, onGround: false },
        timeOfDay: 0.72, weather: 'clear', camera: 'chase', ringIndex: 1, ringsPassed: 1,
        camAim: { dx: 0.08, dy: -0.03 }, planeScreenY: 0.58,
      });
      break;
    }
    case 'cockpit': {
      // Final approach, cockpit view, runway ahead at a slight angle so its
      // length reads, panel lit, edge lights on.
      const s = STRIPS.karang;
      const c = Math.cos(s.heading), sn = Math.sin(s.heading);
      set(0, {
        plane: {
          x: s.x - c * 800 - sn * 90, y: s.elev + 90, z: s.z - sn * 800 + c * 90,
          heading: s.heading + 0.12, pitch: -0.06, roll: 0.02, speed: 46, throttle: 0.42,
          gear: 1, flaps: 1, onGround: false,
        },
        timeOfDay: 0.86, weather: 'dusk', camera: 'cockpit', ringIndex: 4, ringsPassed: 4,
      });
      break;
    }
    case 'landing': {
      // Dusk final: high enough that the whole strip shows below the plane,
      // 400 m before the threshold, 70 m off the centreline with a small crab
      // angle, so the runway angles ahead to the right of the plane instead
      // of hiding behind her.
      const s = STRIPS.tanjung;
      const c = Math.cos(s.heading), sn = Math.sin(s.heading);
      set(5, {
        plane: {
          x: s.x - c * 875 - sn * 70, y: s.elev + 120, z: s.z - sn * 875 + c * 70,
          heading: s.heading + 0.08, pitch: -0.10, roll: -0.03, speed: 44, throttle: 0.38,
          gear: 1, flaps: 1, onGround: false,
        },
        timeOfDay: 0.86, weather: 'dusk', camera: 'chase', ringIndex: 4, ringsPassed: 4,
        camAim: { dx: 0, dy: 0.03 }, planeScreenY: 0.62,
      });
      break;
    }
    case 'ring': {
      // Threading a ring low over the terraces, morning light, the Sawah strip
      // and the sea beyond. The ring sits up-left of the plane, clear of her.
      set(2, {
        plane: { x: -550, y: 300, z: -3225, heading: 3.05, pitch: 0.0, roll: 0.18, speed: 62, throttle: 0.66, gear: 0, flaps: 0, onGround: false },
        timeOfDay: 0.32, weather: 'clear', camera: 'chase', ringIndex: 2, ringsPassed: 2,
        camAim: { dx: -0.10, dy: -0.02 }, planeScreenY: 0.58,
      });
      break;
    }
    default: {
      // Any other ?shot= value: start leg 1 on the runway, ready to fly.
      startLeg(game, 0);
      game.screen = 'fly';
      game.shotFrozen = false;
    }
  }
  window.__shotReady = false;
  game.shotName = name;
}
