// levels.js — the three rooms of the Meridian job: tile maps, patrols, cameras,
// lasers and loot. Pure data; world.js turns it into a running simulation.
//
// Tile legend (one character per tile, maps are COLS x ROWS):
//   #  wall            blocks movement and sight
//   .  marble floor
//   ,  carpet          soft floor: guards notice you more slowly here
//   :  shadow          dark corner: detection crawls while you stand in it
//   P  display plinth  blocks movement and sight (good cover)
//   T  table           blocks movement, not sight
//   D  exit door       locked until the room's target loot is taken
//   d  doorway         a gap in a divider wall, plain floor
//   E  entry           where the thief slips in
//   V  vault steel     solid; the one tile named vaultDoor can be cracked open
//   s  laser switch    step on it to toggle the room's laser grid
//   x  camera panel    use it (E) to blind the room's cameras for a while
//   g  gold bars       loot, $250
//   p  painting        loot, $400
//   j  jewel case      loot, $350
//   *  the target      the one piece the room is really about

export const TILE = 36;
export const COLS = 32;
export const ROWS = 17;
export const HUD_H = 36;

export const LOOT_VALUES = { g: 250, p: 400, j: 350 };

const LOBBY = {
  name: 'Room 1 — The Lobby',
  targetName: 'the Sun Mask',
  targetValue: 900,
  timeLimit: 95,
  map: [
    '################################',
    '#.........#..........#......D..#',
    '#..g......#....p.....#.........#',
    '#.........#..........#...TT....#',
    '#..PP.....#....::....#.........#',
    '#..PP.....#....::....#..*......#',
    '#.........#..........#.........#',
    '#....,....#....,,....#....,....#',
    '#....,...............d.........#',
    '#....,....#....,,....#....,....#',
    '#.........#..........#.........#',
    '#..:......#..........#.....g...#',
    '#..:..PP..#....TT....#.........#',
    '#.....PP..#..........#..s......#',
    '#.........#....x.....#.........#',
    '#.E.......#..........#.........#',
    '################################',
  ],
  guards: [
    { path: [[5, 2], [8, 2], [8, 6], [5, 6]], speed: 50 },
    { path: [[24, 12], [29, 12], [29, 7], [24, 7]], speed: 54 },
  ],
  cameras: [{ x: 16, y: 1, baseAngle: Math.PI / 2, sweep: 0.65, speed: 0.5 }],
  lasers: [{ from: [22, 4], to: [22, 6] }],
};

const GALLERY = {
  name: 'Room 2 — The Gallery',
  targetName: 'the Meridian Tiara',
  targetValue: 1400,
  timeLimit: 115,
  map: [
    '################################',
    '#.....#..........#.........*...#',
    '#..p..#....::....#....PP.......#',
    '#.....#....::....#....PP....D..#',
    '#.....d..........#.............#',
    '#..:..#....PP....#....,,.......#',
    '#..:..#....PP....#....,,....#..#',
    '#.....#..........d.............#',
    '#..,..#....TT....#....TT.......#',
    '#..,..#..........#.............#',
    '#.....#....s.....#....:........#',
    '#..j..#..........#....:....p...#',
    '#.....#....PP....#.............#',
    '#.....#....PP....#....g........#',
    '#..E..#..........#.............#',
    '#.....#....x.....#....j........#',
    '################################',
  ],
  guards: [
    { path: [[2, 8], [5, 8], [5, 13], [2, 13]], speed: 54 },
    { path: [[13, 2], [16, 2], [16, 6], [13, 6]], speed: 58 },
    { path: [[27, 13], [23, 13], [23, 9], [27, 9]], speed: 56 },
  ],
  cameras: [
    { x: 9, y: 15, baseAngle: -Math.PI / 2, sweep: 0.6, speed: 0.45 },
    { x: 29, y: 1, baseAngle: Math.PI / 2, sweep: 0.8, speed: 0.62 },
  ],
  lasers: [
    { from: [21, 5], to: [21, 7] },
    { from: [15, 10], to: [15, 13] },
  ],
};

const VAULT = {
  name: 'Room 3 — The Vault',
  targetName: 'the Meridian Diamond',
  targetValue: 2500,
  timeLimit: 135,
  vaultDoor: [25, 2],
  map: [
    '################################',
    '#..........#.........#...V.....#',
    '#..g.......#....g....#...V.*...#',
    '#..........#.........#...V.....#',
    '#..PP......d.........#....VVVVV#',
    '#..PP......#....::...#.........#',
    '#..........#....::...#....s....#',
    '#....,.....#.........#.........#',
    '#....,.....#....TT...d.........#',
    '#....,.....#.........#.........#',
    '#..........#....:....#..j......#',
    '#..:.......#....:....#.........#',
    '#..:..TT...#.........#....PP...#',
    '#..........#....PP...#....PP...#',
    '#..........#....PP...#.........#',
    '#DE....x...#.........d....g....#',
    '################################',
  ],
  guards: [
    { path: [[5, 3], [8, 3], [8, 8], [5, 8]], speed: 56 },
    { path: [[12, 15], [12, 10], [19, 10], [19, 15]], speed: 60 },
    { path: [[24, 8], [24, 11], [28, 11], [28, 8]], speed: 58 },
  ],
  cameras: [
    { x: 16, y: 1, baseAngle: Math.PI / 2, sweep: 0.7, speed: 0.55 },
    { x: 30, y: 15, baseAngle: -Math.PI / 2, sweep: 0.65, speed: 0.5 },
  ],
  lasers: [
    { from: [22, 5], to: [22, 7] },
    { from: [13, 4], to: [13, 6] },
  ],
};

export const LEVELS = [LOBBY, GALLERY, VAULT];

export function tileAt(level, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return '#';
  return level.map[ty][tx];
}

export function isSolidTile(ch) {
  return ch === '#' || ch === 'P' || ch === 'T' || ch === 'V';
}

export function blocksSightTile(ch) {
  return ch === '#' || ch === 'P' || ch === 'V';
}
