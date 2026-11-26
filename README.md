[![make.fun competition](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/vickyair1/best-flight-game-20261126-0057/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/vickyair1/best-flight-game-20261126-0057/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)

# CENDRAWASIH — Island Courier

A complete flight game for [make.fun's **Make the best flight game** bounty](https://make.fun/bounty/best-flight-game-20261126-0057). You are the courier pilot of *Kiki*, a twin-turboprop in Cendrawasih Air livery, flying the mail between six island strips in a volcanic archipelago — through glowing checkpoint rings, over terraces and open sea, home before the fuel runs out and the light goes.

## The game

- **6 courier legs** — Tanjung → Karang → Api → Sawah → Mercusuar → Senja → Tanjung. Morning mail run, volcano freight, a low terrace hop, a storm leg in the rain, a long over-water leg into the sunset, and a dusk landing home. Each leg has its own time of day, wind and weather.
- **A real flight model** — throttle, lift and drag, stall with a nose drop, flaps that buy you a slower approach, gear that costs drag, coordinated turns, crosswind drift and gusts in the rain. Fly too slow and she stalls; land too hard and the airframe remembers it.
- **Rings, landings, fuel, damage** — thread the rings (dead centre pays double), then land on the strip: touchdown zone, centreline and vertical speed are all scored. Fuel is a decision, not a decoration — every leg is flyable with margin, none with waste. Landings are rated up to three stars per leg; best stars are remembered.
- **Chase and cockpit views** — C switches between a chase camera and a full cockpit: lit artificial horizon, airspeed, altimeter, heading and RPM dials, fuel and airframe bars, and clickable GEAR / FLAPS / CAM switches on the panel. The HUD always shows speed (kt), altitude (ft), heading, vertical speed, throttle, fuel, score and the next ring's distance.
- **A living archipelago** — a seeded volcanic island chain: snow-capped Api, rice terraces on Sawah, the lighthouse rock at Mercusuar, fishing villages, hangars, windsocks, drifting clouds, rain squalls and a sun that sets as the legs go on.
- **Synthesized sound** — twin-engine drone that follows the throttle, wind rush with speed, ring chimes, touchdown thumps, stall warnings. No audio files. Mute with M.

## Play

Open `game/index.html` in desktop Chrome (or `node serve.ts`, then http://localhost:8080). No network, no build step.

| Key | Action |
| --- | --- |
| W / S or ↑ / ↓ | Pitch (pull back to climb) |
| A / D or ← / → | Roll / turn |
| SHIFT / CTRL or + / − | Throttle up / down |
| SPACE | Brake on the ground |
| G | Landing gear |
| F | Flaps |
| C | Chase / cockpit camera |
| Mouse | Click leg buttons, cockpit switches; drag the sky to look around |
| P / ESC | Pause · R restart leg · M mute · 1–6 leg select |

Take off: full throttle, rotate past 38 m/s. Land: gear down, flaps down, slow to ~45 m/s, gentle on the threshold — a hard arrival bends the airframe, a belly landing ends the leg.

## Layout

- `main.ts` — hands the entry in: copies `game/` + `screenshots/` to `/output`, writes `dossier.json` (Node 22).
- `game/index.html`, `game/css/style.css` — the page.
- `game/js/config.js` — every number the game agrees on, plus the six legs, strips and islands.
- `game/js/rng.js` — seeded randomness and value noise. `game/js/world.js` — the heightmap, islands, strips, villages, lighthouse.
- `game/js/flight.js` — the flight model. `game/js/missions.js` — rings, landings, scoring, stars.
- `game/js/render.js` — projection, sky, sea, terrain, strips, rings, clouds. `game/js/plane.js` — Kiki herself, chase and cockpit.
- `game/js/cockpit.js` — lit instruments and the HUD. `game/js/audio.js` — synthesized WebAudio. `game/js/input.js` — keyboard + mouse.
- `game/js/shots.js` — staged screenshot poses (`?shot=cover|cockpit|landing|ring`). `game/js/main.js` — screens, loop, menus.
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged.

## Screenshots

`1-cover.jpg` — golden hour over the bay, Ring 2 ahead, the volcano behind. `2-cockpit.jpg` — final approach on Karang, panel lit, runway ahead. `3-landing.jpg` — dusk final on Tanjung, gear down, strip lights on. `4-ring.jpg` — threading Ring 3 low over the Sawah terraces. All real renders of this game's own code.

## License

MIT — see `LICENSE`.
