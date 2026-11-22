// main.js — the browser bootstrap: canvas, keyboard and mouse, the fixed-step
// loop, and the run state machine (title -> rooms -> busted/clear -> getaway).
// All rules live in world.js; this file only feeds it inputs and draws frames.

import { LEVELS, HUD_H } from './levels.js';
import { World } from './world.js';
import {
  CANVAS_W, CANVAS_H, drawRoom, drawHUD,
  drawTitleScreen, drawBustedScreen, drawClearScreen, drawWinScreen,
} from './render.js';
import { stageShotScene, WIN_RUN } from './shots.js';
import { sfx, toggleMute } from './audio.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = CANVAS_W;
canvas.height = CANVAS_H;

const keysDown = new Set();
let pressed = new Set();

window.addEventListener('keydown', (e) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
  if (!e.repeat) pressed.add(e.code);
  keysDown.add(e.code);
});
window.addEventListener('keyup', (e) => keysDown.delete(e.code));
canvas.addEventListener('pointerdown', () => pressed.add('Enter'));

function input() {
  return {
    up: keysDown.has('KeyW') || keysDown.has('ArrowUp'),
    down: keysDown.has('KeyS') || keysDown.has('ArrowDown'),
    left: keysDown.has('KeyA') || keysDown.has('ArrowLeft'),
    right: keysDown.has('KeyD') || keysDown.has('ArrowRight'),
    sneak: keysDown.has('ShiftLeft') || keysDown.has('ShiftRight'),
    use: keysDown.has('KeyE'),
  };
}

const EVENT_SFX = {
  loot: () => sfx.loot(),
  target: () => sfx.target(),
  laser: () => sfx.laser(),
  spotted: () => sfx.spotted(),
  emp: () => sfx.emp(),
  switch: () => sfx.switch(),
  crack: () => sfx.crack(),
  clear: () => sfx.clear(),
  busted: () => sfx.busted(),
};

function newRun() {
  return {
    screen: 'title',
    roomIndex: 0,
    world: new World(LEVELS[0], 0),
    totalLoot: 0,
    detections: 0,
    peakAlarm: 0,
    time: 0,
  };
}

let run = newRun();

function startRoom(index) {
  run.roomIndex = index;
  run.world = new World(LEVELS[index], index);
  run.screen = 'game';
}

function bankRoom() {
  run.totalLoot += run.world.lootValue;
  run.detections += run.world.detections;
}

function stepGame(dt) {
  const world = run.world;
  world.step(dt, input());
  for (const ev of world.events) if (EVENT_SFX[ev]) EVENT_SFX[ev]();
  world.events.length = 0;
  run.peakAlarm = Math.max(run.peakAlarm, world.alarm);
  if (world.state === 'busted') {
    run.detections += world.detections;
    run.screen = 'busted';
  } else if (world.state === 'clear') {
    bankRoom();
    run.screen = run.roomIndex === LEVELS.length - 1 ? 'win' : 'clear';
  }
}

function stepScreens() {
  if (pressed.has('KeyM')) toggleMute();
  if (run.screen === 'title' && pressed.has('Enter')) startRoom(0);
  else if (run.screen === 'busted' && pressed.has('KeyR')) startRoom(run.roomIndex);
  else if (run.screen === 'clear' && pressed.has('Enter')) startRoom(run.roomIndex + 1);
  else if (run.screen === 'win' && pressed.has('Enter')) run = newRun();
}

function draw() {
  ctx.fillStyle = '#05060e';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  if (run.screen === 'title') drawTitleScreen(ctx, run.world, run);
  else if (run.screen === 'busted') { drawBustedScreen(ctx, run.world, run); drawHUD(ctx, run.world, run); }
  else if (run.screen === 'clear') { drawClearScreen(ctx, run.world, run); drawHUD(ctx, run.world, run); }
  else if (run.screen === 'win') drawWinScreen(ctx, run.world, run);
  else { drawRoom(ctx, run.world); drawHUD(ctx, run.world, run); }
}

// ?shot=<scene> freezes a staged showcase scene (see shots.js) — the same
// scenes the entry's screenshots were taken from.
const shotName = new URLSearchParams(window.location.search).get('shot');
if (shotName) {
  const staged = stageShotScene(shotName);
  run.world = staged.world;
  run.screen = staged.screen;
  if (staged.screen === 'win') Object.assign(run, WIN_RUN);
  draw();
} else {
  let last = performance.now();
  let acc = 0;
  const FRAME = 1000 / 60;
  function loop(now) {
    requestAnimationFrame(loop);
    acc += Math.min(100, now - last);
    last = now;
    while (acc >= FRAME) {
      acc -= FRAME;
      run.time += 1 / 60;
      if (run.screen === 'game') stepGame(1 / 60);
      stepScreens();
      pressed = new Set();
    }
    draw();
  }
  requestAnimationFrame(loop);
}
