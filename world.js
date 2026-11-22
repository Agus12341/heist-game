// world.js — the heist simulation: one room, stepped deterministically.
// No DOM, no randomness: the same inputs always produce the same run, which is
// what lets main.js stage exact screenshot scenes and the tests replay rules.

import {
  TILE, COLS, ROWS, LOOT_VALUES,
  tileAt, isSolidTile, blocksSightTile,
} from './levels.js';

export const VIEW_W = COLS * TILE;
export const VIEW_H = ROWS * TILE;

const PLAYER_R = 11;
const WALK_SPEED = 138;
const SNEAK_SPEED = 76;
const GUARD_RANGE = 172;
const GUARD_HALF_ANGLE = 0.56;
const CAMERA_RANGE = 198;
const CAMERA_HALF_ANGLE = 0.42;
const CRACK_SECONDS = 3;

export function tileCenter(tx, ty) {
  return { x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 };
}

function angleLerp(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

export class World {
  constructor(level, roomIndex) {
    this.level = level;
    this.roomIndex = roomIndex;
    this.time = 0;
    this.timeLeft = level.timeLimit;
    this.state = 'play'; // 'play' | 'busted' | 'clear'
    this.bustReason = '';
    this.alarm = 0;
    this.detections = 0;
    this.lootValue = 0;
    this.lootCount = 0;
    this.targetTaken = false;
    this.empCharges = 2;
    this.camBlind = 0;
    this.vaultCrack = 0;
    this.vaultOpen = !level.vaultDoor;
    this.cracking = false;
    this.hint = '';
    this.hintTime = 0;
    this.events = [];
    this.seenByGuard = false;
    this.seenByCamera = false;

    this.player = { x: 0, y: 0, face: -Math.PI / 2, moving: false, sneak: false };
    this.guards = level.guards.map((g, i) => {
      const start = tileCenter(g.path[0][0], g.path[0][1]);
      const next = tileCenter(g.path[1][0], g.path[1][1]);
      return {
        x: start.x, y: start.y,
        path: g.path, speed: g.speed,
        wp: 1, pause: 0, phase: i * 1.7,
        angle: Math.atan2(next.y - start.y, next.x - start.x),
        meter: 0, mode: 'patrol', chaseTime: 0, lostTime: 0, hold: undefined,
      };
    });
    this.cameras = level.cameras.map((c, i) => ({
      x: tileCenter(c.x, c.y).x, y: tileCenter(c.x, c.y).y,
      baseAngle: c.baseAngle, sweep: c.sweep, speed: c.speed,
      angle: c.baseAngle, phase: i * 2.3, alert: false,
    }));
    this.lasers = level.lasers.map((l) => ({
      a: tileCenter(l.from[0], l.from[1]),
      b: tileCenter(l.to[0], l.to[1]),
      on: true, cooldown: 0,
    }));
    this.loots = [];
    for (let ty = 0; ty < ROWS; ty++) {
      for (let tx = 0; tx < COLS; tx++) {
        const ch = level.map[ty][tx];
        if (ch === 'E') {
          const c = tileCenter(tx, ty);
          this.player.x = c.x; this.player.y = c.y;
        } else if (ch === '*' || LOOT_VALUES[ch]) {
          const c = tileCenter(tx, ty);
          this.loots.push({
            x: c.x, y: c.y, kind: ch, taken: false,
            isTarget: ch === '*',
            value: ch === '*' ? level.targetValue : LOOT_VALUES[ch],
          });
        }
      }
    }
    this.lastTile = this.playerTile();
  }

  tile(tx, ty) {
    if (this.level.vaultDoor && !this.vaultOpen &&
        tx === this.level.vaultDoor[0] && ty === this.level.vaultDoor[1]) return 'V';
    if (this.level.vaultDoor && this.vaultOpen &&
        tx === this.level.vaultDoor[0] && ty === this.level.vaultDoor[1]) return '.';
    return tileAt(this.level, tx, ty);
  }

  playerTile() {
    return {
      tx: Math.floor(this.player.x / TILE),
      ty: Math.floor(this.player.y / TILE),
    };
  }

  solidAt(px, py) {
    return isSolidTile(this.tile(Math.floor(px / TILE), Math.floor(py / TILE)));
  }

  moveCircle(p, dx, dy) {
    // Axis-separated collision so the thief slides along walls and plinths.
    let nx = p.x + dx;
    if (!this.solidAt(nx - PLAYER_R, p.y) && !this.solidAt(nx + PLAYER_R, p.y) &&
        !this.solidAt(nx, p.y - PLAYER_R) && !this.solidAt(nx, p.y + PLAYER_R) &&
        !this.solidAt(nx - PLAYER_R * 0.7, p.y - PLAYER_R * 0.7) &&
        !this.solidAt(nx + PLAYER_R * 0.7, p.y - PLAYER_R * 0.7) &&
        !this.solidAt(nx - PLAYER_R * 0.7, p.y + PLAYER_R * 0.7) &&
        !this.solidAt(nx + PLAYER_R * 0.7, p.y + PLAYER_R * 0.7)) p.x = nx;
    let ny = p.y + dy;
    if (!this.solidAt(p.x - PLAYER_R, ny) && !this.solidAt(p.x + PLAYER_R, ny) &&
        !this.solidAt(p.x, ny - PLAYER_R) && !this.solidAt(p.x, ny + PLAYER_R) &&
        !this.solidAt(p.x - PLAYER_R * 0.7, ny - PLAYER_R * 0.7) &&
        !this.solidAt(p.x + PLAYER_R * 0.7, ny - PLAYER_R * 0.7) &&
        !this.solidAt(p.x - PLAYER_R * 0.7, ny + PLAYER_R * 0.7) &&
        !this.solidAt(p.x + PLAYER_R * 0.7, ny + PLAYER_R * 0.7)) p.y = ny;
  }

  losClear(x0, y0, x1, y1) {
    const dist = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.max(1, Math.floor(dist / 6));
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const ch = this.tile(
        Math.floor((x0 + (x1 - x0) * t) / TILE),
        Math.floor((y0 + (y1 - y0) * t) / TILE),
      );
      if (blocksSightTile(ch)) return false;
    }
    return true;
  }

  visibilityFactor() {
    const { tx, ty } = this.playerTile();
    const ch = this.tile(tx, ty);
    let f = this.player.moving ? 1.1 : 0.75;
    if (this.player.sneak) f *= 0.55;
    if (ch === ':') f *= 0.35;
    if (ch === ',') f *= 0.7;
    return Math.max(0.15, Math.min(1.25, f));
  }

  canSee(sx, sy, angle, range, halfAngle) {
    const dx = this.player.x - sx;
    const dy = this.player.y - sy;
    const dist = Math.hypot(dx, dy);
    if (dist > range) return { seen: false, dist };
    if (dist > 26) {
      let d = Math.abs(Math.atan2(dy, dx) - angle) % (Math.PI * 2);
      if (d > Math.PI) d = Math.PI * 2 - d;
      if (d > halfAngle) return { seen: false, dist };
    }
    if (!this.losClear(sx, sy, this.player.x, this.player.y)) return { seen: false, dist };
    return { seen: true, dist };
  }

  bust(reason) {
    if (this.state !== 'play') return;
    this.state = 'busted';
    this.bustReason = reason;
    this.events.push('busted');
  }

  step(dt, input) {
    if (this.state !== 'play') return;
    this.time += dt;
    this.timeLeft -= dt;
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      this.bust('The getaway driver left without you.');
      return;
    }
    if (this.hintTime > 0) this.hintTime -= dt;
    if (this.camBlind > 0) this.camBlind -= dt;
    this.seenByGuard = false;
    this.seenByCamera = false;

    this.stepPlayer(dt, input);
    if (this.state !== 'play') return;
    for (const g of this.guards) this.stepGuard(g, dt);
    if (this.state !== 'play') return;
    for (const c of this.cameras) this.stepCamera(c, dt);
    this.stepLasers(dt);

    const seen = this.seenByGuard || this.seenByCamera;
    if (!seen && this.alarm > 0) this.alarm = Math.max(0, this.alarm - 2.4 * dt);
    if (this.alarm >= 100) {
      this.alarm = 100;
      this.bust('The alarm hit full — the building locked down.');
    }
  }

  stepPlayer(dt, input) {
    const p = this.player;
    p.sneak = !!input.sneak;
    let mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    let my = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    p.moving = mx !== 0 || my !== 0;
    if (p.moving) {
      const len = Math.hypot(mx, my);
      const weight = 1 - Math.min(0.18, this.lootCount * 0.03);
      const speed = (p.sneak ? SNEAK_SPEED : WALK_SPEED) * weight;
      const vx = (mx / len) * speed * dt;
      const vy = (my / len) * speed * dt;
      const ox = p.x, oy = p.y;
      this.moveCircle(p, vx, vy);
      p.face = angleLerp(p.face, Math.atan2(p.y - oy, p.x - ox), 0.5);
      if (p.x === ox && p.y === oy) p.face = angleLerp(p.face, Math.atan2(my, mx), 0.5);
    }

    const { tx, ty } = this.playerTile();
    const ch = this.tile(tx, ty);

    // Stepping onto a laser switch toggles the room's grid (edge-triggered).
    const tileKey = tx + ',' + ty;
    if (ch === 's' && this.lastTileKey !== tileKey && this.time > 0.2) {
      for (const l of this.lasers) l.on = !l.on;
      this.events.push('switch');
      this.hint = this.lasers[0] && this.lasers[0].on ? 'Lasers ON' : 'Lasers OFF';
      this.hintTime = 1.4;
    }
    this.lastTileKey = tileKey;

    // Loot: walk over it to bag it.
    for (const loot of this.loots) {
      if (!loot.taken && Math.hypot(loot.x - p.x, loot.y - p.y) < 19) {
        loot.taken = true;
        this.lootValue += loot.value;
        this.lootCount += 1;
        if (loot.isTarget) {
          this.targetTaken = true;
          this.events.push('target');
          this.hint = 'Got ' + this.level.targetName + ' — get to the exit!';
          this.hintTime = 2.4;
        } else {
          this.events.push('loot');
        }
      }
    }

    // Interactions on the use key: camera panel first, then the vault door.
    this.cracking = false;
    if (input.use) {
      if (this.tryCameraPanel()) return;
      this.tryCrackVault(dt);
    } else if (this.vaultCrack > 0 && !this.vaultOpen) {
      this.vaultCrack = Math.max(0, this.vaultCrack - dt / 6);
    }

    // Exit door.
    if (ch === 'D') {
      if (this.targetTaken) {
        this.state = 'clear';
        this.events.push('clear');
      } else if (this.hintTime <= 0) {
        this.hint = 'Locked. The room still holds ' + this.level.targetName + '.';
        this.hintTime = 1.6;
      }
    }
  }

  tryCameraPanel() {
    const { tx, ty } = this.playerTile();
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (this.tile(tx + dx, ty + dy) !== 'x') continue;
        const c = tileCenter(tx + dx, ty + dy);
        if (Math.hypot(c.x - this.player.x, c.y - this.player.y) > 40) continue;
        if (this.camBlind > 0) return true;
        if (this.empCharges <= 0) {
          if (this.hintTime <= 0) { this.hint = 'No EMP charges left.'; this.hintTime = 1.4; }
          return true;
        }
        this.empCharges -= 1;
        this.camBlind = 8;
        this.events.push('emp');
        this.hint = 'Cameras blind for 8 seconds.';
        this.hintTime = 1.6;
        return true;
      }
    }
    return false;
  }

  tryCrackVault(dt) {
    if (!this.level.vaultDoor || this.vaultOpen) return;
    const c = tileCenter(this.level.vaultDoor[0], this.level.vaultDoor[1]);
    if (Math.hypot(c.x - this.player.x, c.y - this.player.y) > TILE * 1.45) return;
    this.cracking = true;
    this.vaultCrack += dt / CRACK_SECONDS;
    if (this.vaultCrack >= 1) {
      this.vaultCrack = 1;
      this.vaultOpen = true;
      this.events.push('crack');
      this.hint = 'The vault is open.';
      this.hintTime = 1.8;
    }
  }

  stepGuard(g, dt) {
    const sight = this.canSee(g.x, g.y, g.angle, GUARD_RANGE, GUARD_HALF_ANGLE);
    if (sight.seen) {
      this.seenByGuard = true;
      const rate = (1.5 - sight.dist / GUARD_RANGE) * this.visibilityFactor();
      g.meter = Math.min(1, g.meter + rate * dt * (g.mode === 'suspect' ? 1.5 : 1));
      this.alarm = Math.min(100, this.alarm + 9 * dt);
      g.lostTime = 0;
      if (g.meter >= 1 && g.mode !== 'chase') {
        g.mode = 'chase';
        g.chaseTime = 0;
        this.detections += 1;
        this.alarm = Math.min(100, this.alarm + 25);
        this.events.push('spotted');
      }
    } else {
      const decay = this.tile(this.playerTile().tx, this.playerTile().ty) === ':' ? 0.4 : 0.22;
      g.meter = Math.max(0, g.meter - decay * dt);
      g.lostTime += dt;
    }

    if (g.mode === 'chase') {
      g.chaseTime += dt;
      const dx = this.player.x - g.x;
      const dy = this.player.y - g.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 4) {
        this.moveCircle(g, (dx / dist) * 122 * dt, (dy / dist) * 122 * dt);
        g.angle = angleLerp(g.angle, Math.atan2(dy, dx), 0.3);
      }
      if (dist < 20) {
        this.bust('A guard grabbed you mid-job.');
        return;
      }
      if (g.chaseTime > 4.5 || g.lostTime > 1.6) {
        g.mode = 'patrol';
        g.meter = 0.45;
      }
      return;
    }

    if (g.mode === 'suspect' || (g.meter >= 0.38 && sight.seen)) {
      g.mode = 'suspect';
      g.angle = angleLerp(g.angle, Math.atan2(this.player.y - g.y, this.player.x - g.x), 0.18);
      if (g.meter < 0.12) g.mode = 'patrol';
      return;
    }
    g.mode = 'patrol';

    if (g.hold !== undefined) {
      // Posted guard (a showcase pose): stands his ground, cone swaying a
      // little, but detection above still runs exactly as for any guard.
      g.angle = g.hold + Math.sin(this.time * 0.9 + g.phase) * 0.18;
      return;
    }

    if (g.pause > 0) {
      g.pause -= dt;
      const wp = tileCenter(g.path[g.wp][0], g.path[g.wp][1]);
      const base = Math.atan2(wp.y - g.y, wp.x - g.x);
      g.angle = base + Math.sin(this.time * 1.4 + g.phase) * 0.55;
      return;
    }
    const target = tileCenter(g.path[g.wp][0], g.path[g.wp][1]);
    const dx = target.x - g.x;
    const dy = target.y - g.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 5) {
      g.wp = (g.wp + 1) % g.path.length;
      g.pause = 0.9;
      return;
    }
    this.moveCircle(g, (dx / dist) * g.speed * dt, (dy / dist) * g.speed * dt);
    g.angle = angleLerp(g.angle, Math.atan2(dy, dx), 0.25);
  }

  stepCamera(c, dt) {
    c.angle = c.baseAngle + Math.sin(this.time * c.speed + c.phase) * c.sweep;
    c.alert = false;
    if (this.camBlind > 0) return;
    const sight = this.canSee(c.x, c.y, c.angle, CAMERA_RANGE, CAMERA_HALF_ANGLE);
    if (sight.seen) {
      this.seenByCamera = true;
      c.alert = true;
      this.alarm = Math.min(100, this.alarm + 13 * dt);
    }
  }

  stepLasers(dt) {
    for (const l of this.lasers) {
      if (l.cooldown > 0) l.cooldown -= dt;
      if (!l.on || l.cooldown > 0) continue;
      const d = pointSegmentDistance(this.player.x, this.player.y, l.a, l.b);
      if (d < 10) {
        l.cooldown = 1.2;
        this.detections += 1;
        this.alarm = Math.min(100, this.alarm + 30);
        this.events.push('laser');
        this.hint = 'You clipped a laser beam!';
        this.hintTime = 1.4;
      }
    }
  }
}

export function pointSegmentDistance(px, py, a, b) {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const wx = px - a.x;
  const wy = py - a.y;
  const len2 = vx * vx + vy * vy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, (wx * vx + wy * vy) / len2));
  const cx = a.x + vx * t;
  const cy = a.y + vy * t;
  return Math.hypot(px - cx, py - cy);
}
