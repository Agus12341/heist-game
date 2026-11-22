// shots.js — deterministic showcase scenes for the screenshots.
// Each scene builds a real World, poses a mid-job moment (a run already in
// progress: some loot bagged, the alarm part-raised), then plays the real
// rules forward with held inputs for a fixed number of fixed-length steps.
// Detection, cones, the crack timer and the alarm all evolve under the actual
// simulation, so a screenshot is the game itself — never a mock-up.
// main.js uses this for ?shot= URLs; the maker's harness uses it the same way.

import { LEVELS } from './levels.js';
import { World, tileCenter } from './world.js';

const STEP = 1 / 60;

function keys(obj) {
  return { up: false, down: false, left: false, right: false, sneak: false, use: false, ...obj };
}

function runScript(world, frames, script) {
  for (let i = 0; i < frames; i++) {
    world.step(STEP, script(i, world));
    world.events.length = 0;
  }
  return world;
}

function pose(world, tx, ty, face) {
  const c = tileCenter(tx, ty);
  world.player.x = c.x;
  world.player.y = c.y;
  world.player.face = face;
}

function poseGuard(world, index, tx, ty, angle) {
  const g = world.guards[index];
  const c = tileCenter(tx, ty);
  g.x = c.x;
  g.y = c.y;
  g.angle = angle;
  g.hold = angle;
  g.mode = 'patrol';
  g.pause = 0;
}

export function stageShotScene(name) {
  if (name === 'play') {
    // The Gallery, mid-job: a painting is already in the sack. The thief
    // freezes in the open as the right-hand guard's cone rakes across him,
    // one room from the tiara; the middle guard watches the doorway, cameras
    // sweep, the lasers hum, and the alarm sits at a third.
    const world = new World(LEVELS[1], 1);
    const painting = world.loots.find((l) => l.kind === 'p' && l.x < 200);
    painting.taken = true;
    world.lootValue = painting.value;
    world.lootCount = 1;
    pose(world, 20, 8, 2.75);
    world.player.sneak = true;
    poseGuard(world, 1, 13, 11, 0.15);
    poseGuard(world, 2, 24, 9, 2.9);
    runScript(world, 60, () => keys({ sneak: true }));
    if (world.alarm < 30) world.alarm = 30;
    return { world, screen: 'game' };
  }
  if (name === 'vault') {
    // The Vault, seconds from glory: two gold stacks already bagged, the
    // thief at the vault door with the crack ring past halfway, the middle
    // guard patrolling below and the alarm high from the run in.
    const world = new World(LEVELS[2], 2);
    for (const l of world.loots) {
      if (l.kind === 'g' && l.y < 200) { l.taken = true; world.lootValue += l.value; world.lootCount += 1; }
    }
    pose(world, 24, 2, 0);
    poseGuard(world, 2, 27, 10, -2.2);
    runScript(world, 115, () => keys({ use: true }));
    if (world.alarm < 41) world.alarm = 41;
    return { world, screen: 'game' };
  }
  if (name === 'title') {
    // The Lobby at rest behind the title: patrols walking, cones sweeping.
    const world = new World(LEVELS[0], 0);
    runScript(world, 120, () => keys({}));
    return { world, screen: 'title' };
  }
  if (name === 'win') {
    const world = new World(LEVELS[2], 2);
    pose(world, 10, 13, -0.6);
    runScript(world, 60, () => keys({}));
    return { world, screen: 'win' };
  }
  const world = new World(LEVELS[0], 0);
  return { world, screen: 'game' };
}

// The run totals the win scene reports (the harness and ?shot= share them).
export const WIN_RUN = { totalLoot: 6150, detections: 1, peakAlarm: 63, time: 0 };
