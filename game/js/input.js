// input.js — keyboard + mouse. One job: turn presses and clicks into intents.
// Keys: arrows/WASD fly, Shift/Ctrl or +/- throttle, G gear, F flaps, C camera,
// Space brake, P/Esc pause, R restart leg, M mute, 1-6 leg select on the menu.
// Mouse: menu buttons, cockpit switches, and click-drag on the sky to look around.
export function makeInput(game) {
  const input = {
    keys: new Set(),
    pitchIn: 0, rollIn: 0, throttleIn: 0, brake: false,
    mouseX: 0, mouseY: 0, dragging: false, lookDX: 0, lookDY: 0,
  };
  const canvas = game.canvas;
  const down = (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
    input.keys.add(e.key.length === 1 ? e.key.toLowerCase() : e.key);
    game.audio?.init();
    if (e.key === 'g' || e.key === 'G') toggleGear(game);
    if (e.key === 'f' || e.key === 'F') toggleFlaps(game);
    if (e.key === 'c' || e.key === 'C') game.cameraMode = game.cameraMode === 'cockpit' ? 'chase' : 'cockpit';
    if (e.key === 'm' || e.key === 'M') game.audio.muted = !game.audio.muted;
    if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
      if (game.screen === 'fly') game.screen = 'paused';
      else if (game.screen === 'paused') game.screen = 'fly';
    }
    if (e.key === 'r' || e.key === 'R') {
      if (game.screen === 'fly' || game.screen === 'crashed' || game.screen === 'debrief') game.restartLeg();
    }
    if (game.screen === 'menu' && /^[1-6]$/.test(e.key)) game.startLeg(Number(e.key) - 1);
    if (game.screen === 'debrief' && (e.key === 'Enter' || e.key === ' ')) game.nextLeg();
  };
  const up = (e) => input.keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key);
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);

  canvas.addEventListener('mousedown', (e) => {
    game.audio?.init();
    const r = canvas.getBoundingClientRect();
    input.mouseX = e.clientX - r.left; input.mouseY = e.clientY - r.top;
    input.dragging = true; input.lookDX = 0; input.lookDY = 0;
    handleClick(game, input.mouseX, input.mouseY);
  });
  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    if (input.dragging) {
      input.lookDX += x - input.mouseX; input.lookDY += y - input.mouseY;
    }
    input.mouseX = x; input.mouseY = y;
  });
  window.addEventListener('mouseup', () => { input.dragging = false; });

  input.poll = function () {
    const k = input.keys;
    const pitchUp = k.has('ArrowUp') || k.has('w');
    const pitchDown = k.has('ArrowDown') || k.has('s');
    const rollLeft = k.has('ArrowLeft') || k.has('a');
    const rollRight = k.has('ArrowRight') || k.has('d');
    // Push stick forward (W / Up) = nose down; pull back = nose up.
    input.pitchIn = (pitchDown ? 1 : 0) - (pitchUp ? 1 : 0);
    input.rollIn = (rollLeft ? 1 : 0) - (rollRight ? 1 : 0);
    const thrUp = k.has('Shift') || k.has('+') || k.has('=');
    const thrDown = k.has('Control') || k.has('-') || k.has('_');
    input.throttleIn = (thrUp ? 1 : 0) - (thrDown ? 1 : 0);
    input.brake = k.has(' ');
    // Mouse drag nudges the view a little (look around, camera never fights).
    if (input.dragging) {
      game.lookOffset = {
        x: Math.max(-1, Math.min(1, (input.lookDX / 300))),
        y: Math.max(-1, Math.min(1, (input.lookDY / 300))),
      };
    } else {
      game.lookOffset = { x: 0, y: 0 };
    }
  };
  return input;
}

function toggleGear(game) {
  const p = game.plane;
  if (p.onGround && p.speed > 45) return; // cannot raise gear on the roll
  p.gear = p.gear > 0.5 ? 0 : 1;
  game.audio?.click();
}
function toggleFlaps(game) {
  game.plane.flaps = game.plane.flaps > 0.5 ? 0 : 1;
  game.audio?.click();
}

// Click handling: menu buttons, debrief buttons, cockpit switches.
function handleClick(game, x, y) {
  const W = game.canvas.width, H = game.canvas.height;
  if (game.screen === 'menu') {
    const btns = game.menuButtons || [];
    for (const b of btns) {
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
        game.audio?.click();
        game.startLeg(b.leg);
        return;
      }
    }
    return;
  }
  if (game.screen === 'debrief') {
    const btns = game.debriefButtons || [];
    for (const b of btns) {
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
        game.audio?.click();
        b.action();
        return;
      }
    }
    return;
  }
  if (game.screen === 'crashed') {
    game.restartLeg();
    return;
  }
  if (game.screen === 'fly' && game.cameraMode === 'cockpit') {
    for (const b of game.panelButtons || []) {
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
        if (b.label.startsWith('GEAR')) toggleGear(game);
        else if (b.label.startsWith('FLAPS')) toggleFlaps(game);
        else if (b.label.startsWith('CAM')) game.cameraMode = 'chase';
        return;
      }
    }
  }
}
