// render.js — every pixel of GILT: the noir-gallery look, vision cones, lasers,
// HUD and screens. Pure canvas calls from world state; no game logic lives here.

import { TILE, COLS, ROWS, HUD_H, tileAt, blocksSightTile } from './levels.js';
import { VIEW_W, VIEW_H, tileCenter } from './world.js';

export const CANVAS_W = VIEW_W;
export const CANVAS_H = VIEW_H + HUD_H;

const INK = '#0b0e1a';
const FLOOR_A = '#252b47';
const FLOOR_B = '#21263e';
const CARPET = '#5e2436';
const CARPET_EDGE = '#7a3049';
const SHADOW = '#131830';
const WALL_TOP = '#465273';
const WALL_FACE = '#333c5c';
const WALL_LINE = '#5d6c99';
const PLINTH = '#2c3350';
const GLASS = 'rgba(150,205,255,0.20)';
const WOOD = '#6e4a2c';
const WOOD_DARK = '#54371f';
const BRASS = '#c9a227';
const GOLD = '#f2c14e';
const TEAL = '#2fd4c4';
const GUARD_BLUE = '#2b3a67';
const ALARM_RED = '#ff4757';

export function conePolygon(world, sx, sy, angle, range, halfAngle) {
  // March rays across the cone; each stops at the first sight-blocking tile,
  // so cones bend around walls and plinths exactly the way detection does.
  const pts = [{ x: sx, y: sy }];
  const steps = 14;
  for (let i = 0; i <= steps; i++) {
    const a = angle - halfAngle + (2 * halfAngle * i) / steps;
    let d = range;
    for (let m = 6; m < range; m += 6) {
      const px = sx + Math.cos(a) * m;
      const py = sy + Math.sin(a) * m;
      const ch = world.tile(Math.floor(px / TILE), Math.floor(py / TILE));
      if (blocksSightTile(ch)) { d = m; break; }
    }
    pts.push({ x: sx + Math.cos(a) * d, y: sy + Math.sin(a) * d });
  }
  return pts;
}

function poly(ctx, pts, fill) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

function circle(ctx, x, y, r, fill) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

function text(ctx, str, x, y, size, color, align = 'left', bold = true) {
  ctx.font = (bold ? 'bold ' : '') + size + 'px system-ui, sans-serif';
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
}

export function drawRoom(ctx, world) {
  const level = world.level;
  ctx.save();
  ctx.translate(0, HUD_H);
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  for (let ty = 0; ty < ROWS; ty++) {
    for (let tx = 0; tx < COLS; tx++) {
      const ch = world.tile(tx, ty);
      const x = tx * TILE;
      const y = ty * TILE;
      drawFloorTile(ctx, ch, x, y, tx, ty);
    }
  }
  // Lasers sit above the floor but below the actors.
  for (const l of world.lasers) drawLaser(ctx, world, l);
  for (const loot of world.loots) if (!loot.taken) drawLoot(ctx, world, loot);
  // Cones above loot so danger reads over everything on the floor.
  for (const c of world.cameras) drawCameraCone(ctx, world, c);
  for (const g of world.guards) drawGuardCone(ctx, world, g);
  for (const c of world.cameras) drawCamera(ctx, world, c);
  for (const g of world.guards) drawGuard(ctx, world, g);
  drawThief(ctx, world);
  if (world.level.vaultDoor) drawVaultDoorOverlay(ctx, world);
  ctx.restore();
}

function drawFloorTile(ctx, ch, x, y, tx, ty) {
  const base = (tx + ty) % 2 === 0 ? FLOOR_A : FLOOR_B;
  if (ch === '#') {
    ctx.fillStyle = WALL_FACE;
    ctx.fillRect(x, y, TILE, TILE);
    ctx.fillStyle = WALL_TOP;
    ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 10);
    ctx.fillStyle = WALL_LINE;
    ctx.fillRect(x + 2, y + 2, TILE - 4, 2);
    return;
  }
  ctx.fillStyle = ch === ',' ? CARPET : ch === ':' ? SHADOW : base;
  ctx.fillRect(x, y, TILE, TILE);
  if (ch === ',') {
    ctx.strokeStyle = CARPET_EDGE;
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 3, y + 3, TILE - 6, TILE - 6);
  }
  if (ch === ':') {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(x, y, TILE, 3);
    ctx.fillRect(x, y, 3, TILE);
  }
  if (ch === 'P') {
    ctx.fillStyle = PLINTH;
    ctx.fillRect(x + 3, y + 5, TILE - 6, TILE - 6);
    ctx.fillStyle = GLASS;
    ctx.fillRect(x + 6, y + 2, TILE - 12, TILE - 12);
    ctx.strokeStyle = BRASS;
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 6, y + 2, TILE - 12, TILE - 12);
    circle(ctx, x + TILE / 2, y + TILE / 2, 4, GOLD);
  }
  if (ch === 'T') {
    ctx.fillStyle = WOOD_DARK;
    ctx.fillRect(x + 2, y + 4, TILE - 4, TILE - 4);
    ctx.fillStyle = WOOD;
    ctx.fillRect(x + 2, y + 4, TILE - 4, TILE - 10);
  }
  if (ch === 'D') {
    ctx.fillStyle = '#1a2f2a';
    ctx.fillRect(x + 3, y + 1, TILE - 6, TILE - 1);
    ctx.strokeStyle = BRASS;
    ctx.lineWidth = 3;
    ctx.strokeRect(x + 3, y + 1, TILE - 6, TILE - 1);
  }
  if (ch === 'd') {
    ctx.fillStyle = BRASS;
    ctx.fillRect(x, y + TILE / 2 - 2, TILE, 4);
  }
  if (ch === 'V') {
    ctx.fillStyle = '#4a5568';
    ctx.fillRect(x, y, TILE, TILE);
    ctx.fillStyle = '#5d6d85';
    ctx.fillRect(x + 3, y + 3, TILE - 6, TILE - 6);
    ctx.fillStyle = '#39424f';
    for (const [rx, ry] of [[7, 7], [TILE - 7, 7], [7, TILE - 7], [TILE - 7, TILE - 7]]) {
      ctx.fillRect(x + rx - 2, y + ry - 2, 4, 4);
    }
  }
  if (ch === 's') {
    ctx.fillStyle = '#1d2438';
    ctx.fillRect(x + 6, y + 6, TILE - 12, TILE - 12);
    ctx.strokeStyle = '#39d98a';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 6, y + 6, TILE - 12, TILE - 12);
    circle(ctx, x + TILE / 2, y + TILE / 2, 4, '#39d98a');
  }
  if (ch === 'x') {
    ctx.fillStyle = '#141a2e';
    ctx.fillRect(x + 5, y + 5, TILE - 10, TILE - 10);
    ctx.fillStyle = '#39d98a';
    ctx.fillRect(x + 9, y + 9, TILE - 18, 8);
    ctx.fillStyle = '#1f6f4a';
    ctx.fillRect(x + 9, y + 20, TILE - 18, 3);
    ctx.fillRect(x + 9, y + 25, TILE - 22, 3);
  }
  if (ch === 'E') {
    ctx.strokeStyle = 'rgba(47,212,196,0.5)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 5, y + 5, TILE - 10, TILE - 10);
  }
}

function drawLaser(ctx, world, l) {
  const active = l.on && l.cooldown <= 0;
  // Emitter posts.
  for (const p of [l.a, l.b]) {
    ctx.fillStyle = '#222a44';
    ctx.fillRect(p.x - 5, p.y - 5, 10, 10);
    ctx.fillStyle = active ? ALARM_RED : '#5a2330';
    ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
  }
  if (!l.on) return;
  ctx.strokeStyle = l.cooldown > 0 ? 'rgba(255,71,87,0.25)' : 'rgba(255,71,87,0.9)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(l.a.x, l.a.y);
  ctx.lineTo(l.b.x, l.b.y);
  ctx.stroke();
  if (active) {
    ctx.strokeStyle = 'rgba(255,71,87,0.25)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(l.a.x, l.a.y);
    ctx.lineTo(l.b.x, l.b.y);
    ctx.stroke();
  }
}

function drawLoot(ctx, world, loot) {
  const { x, y } = loot;
  const pulse = 0.75 + 0.25 * Math.sin(world.time * 3 + x);
  if (loot.isTarget) {
    ctx.globalAlpha = 0.35 * pulse;
    circle(ctx, x, y, 20, GOLD);
    ctx.globalAlpha = 1;
    // The room's prize: a bright gem on a cushion, ringed so it reads at once.
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 15 + 2 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#7a1f2b';
    ctx.fillRect(x - 11, y + 4, 22, 8);
    ctx.fillStyle = '#7ee2ff';
    ctx.beginPath();
    ctx.moveTo(x, y - 12);
    ctx.lineTo(x + 8, y - 2);
    ctx.lineTo(x, y + 6);
    ctx.lineTo(x - 8, y - 2);
    ctx.closePath();
    ctx.fill();
    return;
  }
  if (loot.kind === 'g') {
    ctx.fillStyle = '#b8860b';
    ctx.fillRect(x - 10, y + 1, 9, 6);
    ctx.fillRect(x + 1, y + 1, 9, 6);
    ctx.fillStyle = GOLD;
    ctx.fillRect(x - 5, y - 6, 10, 6);
    return;
  }
  if (loot.kind === 'p') {
    ctx.fillStyle = '#3a2c18';
    ctx.fillRect(x - 11, y - 12, 22, 24);
    ctx.fillStyle = BRASS;
    ctx.fillRect(x - 9, y - 10, 18, 20);
    ctx.fillStyle = '#274b73';
    ctx.fillRect(x - 7, y - 8, 14, 16);
    circle(ctx, x, y - 2, 3.5, GOLD);
    return;
  }
  // 'j' jewel case
  ctx.fillStyle = '#1d2b4d';
  ctx.fillRect(x - 11, y - 7, 22, 14);
  ctx.strokeStyle = '#7ee2ff';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x - 11, y - 7, 22, 14);
  ctx.fillStyle = '#7ee2ff';
  for (const dx of [-6, 0, 6]) {
    ctx.beginPath();
    ctx.moveTo(x + dx, y - 4);
    ctx.lineTo(x + dx + 3, y);
    ctx.lineTo(x + dx, y + 4);
    ctx.lineTo(x + dx - 3, y);
    ctx.closePath();
    ctx.fill();
  }
}

function drawGuardCone(ctx, world, g) {
  const heat = g.meter;
  const fill = g.mode === 'chase'
    ? 'rgba(255,71,87,0.40)'
    : 'rgba(255,' + Math.round(176 - heat * 100) + ',66,' + (0.20 + heat * 0.18) + ')';
  poly(ctx, conePolygon(world, g.x, g.y, g.angle, 172, 0.56), fill);
}

function drawCameraCone(ctx, world, c) {
  if (world.camBlind > 0) return;
  const fill = c.alert ? 'rgba(255,71,87,0.38)' : 'rgba(255,90,90,0.20)';
  poly(ctx, conePolygon(world, c.x, c.y, c.angle, 198, 0.42), fill);
}

function drawCamera(ctx, world, c) {
  ctx.fillStyle = '#161c30';
  ctx.fillRect(c.x - 9, c.y - 7, 18, 14);
  ctx.strokeStyle = '#8fa3cc';
  ctx.lineWidth = 2;
  ctx.strokeRect(c.x - 9, c.y - 7, 18, 14);
  const blind = world.camBlind > 0;
  circle(ctx, c.x, c.y, 3.5, blind ? '#3a4358' : ALARM_RED);
  if (blind) text(ctx, 'zzz', c.x + 14, c.y - 8, 10, '#8fa3cc', 'left');
}

function drawGuard(ctx, world, g) {
  // Direction wedge, then the body: navy uniform, cap, brass badge.
  const nx = g.x + Math.cos(g.angle) * 13;
  const ny = g.y + Math.sin(g.angle) * 13;
  ctx.fillStyle = '#e8c39e';
  ctx.beginPath();
  ctx.moveTo(nx + Math.cos(g.angle + 2.5) * 6, ny + Math.sin(g.angle + 2.5) * 6);
  ctx.lineTo(nx + Math.cos(g.angle) * 7, ny + Math.sin(g.angle) * 7);
  ctx.lineTo(nx + Math.cos(g.angle - 2.5) * 6, ny + Math.sin(g.angle - 2.5) * 6);
  ctx.closePath();
  ctx.fill();
  circle(ctx, g.x, g.y, 11, GUARD_BLUE);
  circle(ctx, g.x, g.y, 6.5, '#e8c39e');
  ctx.fillStyle = '#1d2a4d';
  ctx.beginPath();
  ctx.arc(g.x, g.y, 7, Math.PI, Math.PI * 2);
  ctx.fill();
  circle(ctx, g.x + 6, g.y + 6, 2, GOLD);
  if (g.meter > 0.03) {
    // Detection arc over the guard's head: fills amber, snaps red when full.
    ctx.strokeStyle = g.meter >= 1 ? ALARM_RED : '#ffb042';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(g.x, g.y - 17, 7, -Math.PI / 2, -Math.PI / 2 + g.meter * Math.PI * 2);
    ctx.stroke();
  }
  if (g.mode === 'suspect') text(ctx, '?', g.x, g.y - 30, 17, '#ffb042', 'center');
  if (g.mode === 'chase') text(ctx, '!', g.x, g.y - 30, 19, ALARM_RED, 'center');
}

function drawThief(ctx, world) {
  const p = world.player;
  const { tx, ty } = world.playerTile();
  const inShadow = world.tile(tx, ty) === ':';
  ctx.globalAlpha = inShadow ? 0.55 : 1;
  // Loot sack on the back, growing with the haul.
  const sack = 5 + Math.min(6, world.lootCount * 1.2);
  const bx = p.x - Math.cos(p.face) * 10;
  const by = p.y - Math.sin(p.face) * 10;
  circle(ctx, bx, by, sack, '#7a5a21');
  circle(ctx, p.x, p.y, 11, TEAL);
  circle(ctx, p.x, p.y, 6, '#123a37');
  // Hood point toward facing.
  const hx = p.x + Math.cos(p.face) * 9;
  const hy = p.y + Math.sin(p.face) * 9;
  ctx.fillStyle = TEAL;
  ctx.beginPath();
  ctx.moveTo(hx + Math.cos(p.face + 2.6) * 6, hy + Math.sin(p.face + 2.6) * 6);
  ctx.lineTo(hx + Math.cos(p.face) * 6, hy + Math.sin(p.face) * 6);
  ctx.lineTo(hx + Math.cos(p.face - 2.6) * 6, hy + Math.sin(p.face - 2.6) * 6);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
  if (p.sneak) {
    ctx.strokeStyle = 'rgba(47,212,196,0.55)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 15, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawVaultDoorOverlay(ctx, world) {
  const [tx, ty] = world.level.vaultDoor;
  const c = tileCenter(tx, ty);
  if (world.vaultOpen) {
    ctx.fillStyle = '#0d1420';
    ctx.fillRect(c.x - 16, c.y - 16, 32, 32);
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 2;
    ctx.strokeRect(c.x - 16, c.y - 16, 32, 32);
    return;
  }
  // Vault wheel, plus the cracking ring while the thief works the lock.
  ctx.strokeStyle = '#d7dee9';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(c.x, c.y, 9, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.5;
    ctx.moveTo(c.x, c.y);
    ctx.lineTo(c.x + Math.cos(a) * 9, c.y + Math.sin(a) * 9);
  }
  ctx.stroke();
  if (world.vaultCrack > 0) {
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(c.x, c.y, 14, -Math.PI / 2, -Math.PI / 2 + world.vaultCrack * Math.PI * 2);
    ctx.stroke();
    text(ctx, 'CRACKING ' + Math.round(world.vaultCrack * 100) + '%', c.x, c.y + 30, 12, GOLD, 'center');
  }
}

export function drawHUD(ctx, world, run) {
  ctx.fillStyle = '#0d1122';
  ctx.fillRect(0, 0, CANVAS_W, HUD_H);
  ctx.fillStyle = BRASS;
  ctx.fillRect(0, HUD_H - 2, CANVAS_W, 2);
  text(ctx, world.level.name.toUpperCase(), 12, HUD_H / 2, 15, '#d7dee9');
  // Loot so far (whole run) and this room's target state.
  const loot = run.totalLoot + world.lootValue;
  text(ctx, 'LOOT $' + loot.toLocaleString('en-US'), 300, HUD_H / 2, 15, GOLD);
  const targetLabel = world.targetTaken
    ? world.level.targetName.toUpperCase() + ' — TAKEN'
    : world.level.targetName.toUpperCase();
  text(ctx, targetLabel, 470, HUD_H / 2, 12, world.targetTaken ? '#39d98a' : '#e8b4b8');
  // The alarm meter: segmented, labelled, impossible to miss.
  const ax = 800;
  const aw = 190;
  text(ctx, 'ALARM', ax - 8, HUD_H / 2, 13, '#ffb042', 'right');
  ctx.fillStyle = '#1a2036';
  ctx.fillRect(ax, HUD_H / 2 - 8, aw, 16);
  const frac = world.alarm / 100;
  const alarmColor = frac > 0.7 ? ALARM_RED : frac > 0.35 ? '#ffb042' : '#39d98a';
  ctx.fillStyle = alarmColor;
  const pulse = frac > 0.7 ? 0.8 + 0.2 * Math.sin(world.time * 10) : 1;
  ctx.globalAlpha = pulse;
  ctx.fillRect(ax, HUD_H / 2 - 8, aw * frac, 16);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = '#39406b';
  ctx.lineWidth = 1;
  for (let i = 1; i < 10; i++) {
    ctx.beginPath();
    ctx.moveTo(ax + (aw * i) / 10, HUD_H / 2 - 8);
    ctx.lineTo(ax + (aw * i) / 10, HUD_H / 2 + 8);
    ctx.stroke();
  }
  // Countdown and EMP charges.
  const t = Math.max(0, Math.ceil(world.timeLeft));
  const clock = Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0');
  text(ctx, clock, 1030, HUD_H / 2, 16, t <= 15 ? ALARM_RED : '#d7dee9', 'center');
  text(ctx, 'EMP ' + '●'.repeat(world.empCharges) + '○'.repeat(2 - world.empCharges),
    1105, HUD_H / 2, 13, '#7ee2ff', 'center');
  if (world.hintTime > 0 && world.hint) {
    ctx.fillStyle = 'rgba(9,11,24,0.82)';
    const w = world.hint.length * 8.4 + 28;
    ctx.fillRect(CANVAS_W / 2 - w / 2, HUD_H + 10, w, 26);
    text(ctx, world.hint, CANVAS_W / 2, HUD_H + 23, 14, '#ffe9a8', 'center');
  }
  if (world.camBlind > 0) {
    text(ctx, 'CAMERAS BLIND ' + world.camBlind.toFixed(0) + 's', CANVAS_W / 2, HUD_H + 52, 13, '#7ee2ff', 'center');
  }
}

function dim(ctx, alpha) {
  ctx.fillStyle = 'rgba(5,6,14,' + alpha + ')';
  ctx.fillRect(0, HUD_H, CANVAS_W, VIEW_H);
}

function panel(ctx, w, h) {
  const x = CANVAS_W / 2 - w / 2;
  const y = HUD_H + VIEW_H / 2 - h / 2;
  ctx.fillStyle = 'rgba(10,13,26,0.92)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = BRASS;
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
  return { x, y };
}

export function drawTitleScreen(ctx, world, run) {
  drawRoom(ctx, world);
  dim(ctx, 0.62);
  text(ctx, 'G I L T', CANVAS_W / 2, HUD_H + 150, 92, GOLD, 'center');
  text(ctx, 'THE MERIDIAN JOB', CANVAS_W / 2, HUD_H + 205, 24, '#d7dee9', 'center');
  text(ctx, 'Three rooms. One diamond. Every guard, camera and laser between you and the door.',
    CANVAS_W / 2, HUD_H + 258, 16, '#aeb9d9', 'center', false);
  text(ctx, 'Slip past the vision cones, bag the target piece in each room, crack the vault,',
    CANVAS_W / 2, HUD_H + 300, 15, '#aeb9d9', 'center', false);
  text(ctx, 'and get out before the alarm fills or the driver leaves.',
    CANVAS_W / 2, HUD_H + 324, 15, '#aeb9d9', 'center', false);
  text(ctx, 'MOVE  WASD / ARROWS        SNEAK  SHIFT        USE  E        RETRY  R',
    CANVAS_W / 2, HUD_H + 380, 16, TEAL, 'center');
  text(ctx, 'Carpet and shadow slow detection. EMP panels blind cameras — you carry two charges a room.',
    CANVAS_W / 2, HUD_H + 410, 13, '#8fa3cc', 'center', false);
  text(ctx, 'PRESS ENTER TO START THE JOB', CANVAS_W / 2, HUD_H + 480, 20,
    Math.sin(run.time * 3) > -0.3 ? GOLD : '#8a6d1f', 'center');
}

export function drawBustedScreen(ctx, world, run) {
  drawRoom(ctx, world);
  dim(ctx, 0.66);
  const { x, y } = panel(ctx, 560, 210);
  text(ctx, 'BUSTED', CANVAS_W / 2, y + 52, 44, ALARM_RED, 'center');
  text(ctx, world.bustReason, CANVAS_W / 2, y + 102, 16, '#d7dee9', 'center', false);
  text(ctx, 'The room resets. The rest of the haul is still yours to lose.',
    CANVAS_W / 2, y + 132, 13, '#8fa3cc', 'center', false);
  text(ctx, 'PRESS R TO TRY THE ROOM AGAIN', CANVAS_W / 2, y + 172, 16, GOLD, 'center');
}

export function drawClearScreen(ctx, world, run) {
  drawRoom(ctx, world);
  dim(ctx, 0.55);
  const { x, y } = panel(ctx, 520, 200);
  text(ctx, 'ROOM CLEANED OUT', CANVAS_W / 2, y + 48, 30, '#39d98a', 'center');
  text(ctx, world.level.targetName + ' — bagged', CANVAS_W / 2, y + 92, 16, GOLD, 'center');
  text(ctx, 'Room haul  $' + world.lootValue.toLocaleString('en-US') +
    '      Run total  $' + (run.totalLoot + world.lootValue).toLocaleString('en-US'),
    CANVAS_W / 2, y + 124, 15, '#d7dee9', 'center', false);
  text(ctx, 'PRESS ENTER FOR THE NEXT ROOM', CANVAS_W / 2, y + 164, 16, TEAL, 'center');
}

export function ratingFor(run) {
  if (run.detections === 0 && run.peakAlarm <= 50) return 'GHOST — never truly seen';
  if (run.detections <= 2 && run.peakAlarm < 100) return 'PROFESSIONAL — cool hands';
  return 'SMASH AND GRAB — loud, but rich';
}

export function drawWinScreen(ctx, world, run) {
  drawRoom(ctx, world);
  dim(ctx, 0.7);
  const { x, y } = panel(ctx, 600, 300);
  text(ctx, 'GETAWAY CLEAN', CANVAS_W / 2, y + 50, 38, GOLD, 'center');
  text(ctx, 'The Meridian Diamond is yours.', CANVAS_W / 2, y + 92, 16, '#d7dee9', 'center', false);
  text(ctx, 'TOTAL HAUL   $' + run.totalLoot.toLocaleString('en-US'), CANVAS_W / 2, y + 140, 22, GOLD, 'center');
  text(ctx, 'Times spotted or tripped: ' + run.detections, CANVAS_W / 2, y + 178, 15, '#aeb9d9', 'center', false);
  text(ctx, 'Peak alarm: ' + Math.round(run.peakAlarm) + '%', CANVAS_W / 2, y + 204, 15, '#aeb9d9', 'center', false);
  text(ctx, ratingFor(run), CANVAS_W / 2, y + 240, 18, TEAL, 'center');
  text(ctx, 'PRESS ENTER TO RUN IT AGAIN', CANVAS_W / 2, y + 274, 13, '#8fa3cc', 'center', false);
}
