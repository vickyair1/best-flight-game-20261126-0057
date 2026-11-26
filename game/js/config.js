// config.js — every number the game agrees on, and the six courier legs.
// One job: constants + leg data. No logic, no drawing.
export const CFG = {
  // World (metres, y up, x east, z south; sea level y = 0)
  worldHalf: 7000,
  cell: 100, // terrain grid cell size
  // Flight model
  gravity: 9.81,
  maxSpeed: 95, // m/s, level-flight top speed at full throttle
  cruiseSpeed: 62,
  stallSpeed: 34, // clean; flaps lower it
  stallSpeedFlaps: 28,
  takeoffSpeed: 38,
  maxPitch: 0.45, // rad
  maxRoll: 1.1, // rad
  turnRate: 0.55, // rad/s at full bank, scaled by speed
  thrustAccel: 15, // m/s^2 at full throttle
  dragK: 0.0016,
  gearDrag: 0.0009,
  flapDrag: 0.0012,
  climbK: 0.9,
  // Fuel (litres)
  fuelCapacity: 220,
  burnIdle: 0.05, // L/s
  burnFull: 0.42, // L/s at full throttle
  fuelWarn: 40,
  // Damage
  hardLandingVs: 3.6, // m/s descent that starts hurting
  crashVs: 7.5, // m/s descent = crash
  gearUpLandingDamage: 60,
  // Scoring
  ringScore: 100,
  ringCenterBonus: 50,
  landingMax: 500,
  timeBonusPerSec: 2,
  fuelBonusPerLitre: 1,
  // Camera
  chaseDist: 26,
  chaseHeight: 7,
  // Rendering
  viewDist: 3600,
  fov: 1.15, // rad, vertical-ish field of view factor
  focal: 620, // px focal length at 720p (scaled by canvas height)
};

// The six courier legs. Each leg: home strip -> rings -> destination strip.
// Times of day march from morning to sunset across the legs.
export const LEGS = [
  {
    id: 1, name: 'Tanjung — Karang', from: 'tanjung', to: 'karang',
    brief: 'Morning mail run. Climb out of Tanjung, thread the rings over the bay, and set her down gentle on Karang.',
    timeOfDay: 0.18, weather: 'clear', wind: { dir: 0.6, speed: 3 },
    rings: [
      { x: -2600, y: 320, z: 2100 }, { x: -1400, y: 380, z: 1400 },
      { x: -200, y: 420, z: 900 }, { x: 900, y: 300, z: 700 },
    ],
    par: 150,
  },
  {
    id: 2, name: 'Karang — Api', from: 'karang', to: 'api',
    brief: 'Volcano freight. The strip sits on Api’s east beach, under the cone — fly the rings round its shoulder, mind the updraughts.',
    timeOfDay: 0.32, weather: 'clear', wind: { dir: 2.2, speed: 5 },
    rings: [
      { x: 1900, y: 420, z: -300 }, { x: 2400, y: 650, z: -1400 },
      { x: 3400, y: 750, z: -2100 }, { x: 4300, y: 420, z: -2500 },
    ],
    par: 170,
  },
  {
    id: 3, name: 'Api — Sawah', from: 'api', to: 'sawah',
    brief: 'Terrace hop. Low and slow over the rice terraces — the rings hang just above the paddies. Flaps help here.',
    timeOfDay: 0.45, weather: 'clear', wind: { dir: 4.0, speed: 4 },
    rings: [
      { x: 3800, y: 350, z: -2900 }, { x: 400, y: 300, z: -3100 },
      { x: -800, y: 280, z: -3200 }, { x: -1300, y: 260, z: -3150 },
    ],
    par: 160,
  },
  {
    id: 4, name: 'Sawah — Mercusuar', from: 'sawah', to: 'mercusuar',
    brief: 'Storm mail. A squall sits over the lighthouse rock — rain, gusts, and a crosswind on the short strip. Fly it clean.',
    timeOfDay: 0.58, weather: 'rain', wind: { dir: 1.2, speed: 9 },
    rings: [
      { x: 200, y: 400, z: -1600 }, { x: 1800, y: 460, z: -200 },
      { x: 3200, y: 420, z: 1400 }, { x: 4000, y: 320, z: 2600 },
    ],
    par: 190,
  },
  {
    id: 5, name: 'Mercusuar — Senja', from: 'mercusuar', to: 'senja',
    brief: 'Golden-hour parcels. Long over-water leg into the sunset — watch the fuel, the sea gives you nowhere to land.',
    timeOfDay: 0.72, weather: 'clear', wind: { dir: 5.2, speed: 6 },
    rings: [
      { x: 2800, y: 420, z: 2600 }, { x: 800, y: 480, z: 1400 },
      { x: -1400, y: 440, z: 0 }, { x: -3200, y: 380, z: -900 },
    ],
    par: 210,
  },
  {
    id: 6, name: 'Senja — Tanjung', from: 'senja', to: 'tanjung',
    brief: 'The last light. Home to Tanjung under a burning sky — dusk landing, runway lights on, bring her home.',
    timeOfDay: 0.86, weather: 'dusk', wind: { dir: 3.6, speed: 4 },
    rings: [
      { x: -4200, y: 360, z: -200 }, { x: -4000, y: 420, z: 900 },
      { x: -3800, y: 380, z: 1800 }, { x: -3600, y: 300, z: 2300 },
    ],
    par: 180,
  },
];

// Strips: name, centre, heading (rad, 0 = east, + = south), elevation, length.
export const STRIPS = {
  tanjung: { name: 'Tanjung', x: -3500, z: 2500, heading: 1.5708, elev: 26, length: 950 },
  karang: { name: 'Karang', x: 1500, z: 800, heading: 0.35, elev: 22, length: 850 },
  api: { name: 'Api', x: 4600, z: -2800, heading: 1.5708, elev: 14, length: 800 },
  sawah: { name: 'Sawah', x: -1500, z: -3200, heading: 5.5, elev: 30, length: 850 },
  mercusuar: { name: 'Mercusuar', x: 4200, z: 3200, heading: 4.2, elev: 18, length: 750 },
  senja: { name: 'Senja', x: -4200, z: -1500, heading: 1.2, elev: 24, length: 900 },
};

// Islands: gaussian bumps that shape the heightmap. Volcano is a cone, not a bump.
export const ISLANDS = [
  { x: -3500, z: 2500, r: 2300, h: 190 }, // Tanjung
  { x: 1500, z: 800, r: 1700, h: 130 }, // Karang
  { x: 3200, z: -2800, r: 2100, h: 0, volcano: true }, // Api
  { x: -1500, z: -3200, r: 1900, h: 160 }, // Sawah
  { x: 4200, z: 3200, r: 950, h: 70 }, // Mercusuar rock
  { x: -4200, z: -1500, r: 2000, h: 170 }, // Senja
  { x: -500, z: 4200, r: 800, h: 55 }, // small islet south
  { x: 4800, z: -800, r: 700, h: 45 }, // small islet east
];
