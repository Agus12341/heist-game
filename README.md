[![make.fun · best-heist-game-20261122-0559](https://make.fun/badge/best-heist-game-20261122-0559.svg)](https://make.fun/bounty/best-heist-game-20261122-0559?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)
[![rank](https://make.fun/badge/best-heist-game-20261122-0559/Agus12341/heist-game/rank.svg)](https://make.fun/bounty/best-heist-game-20261122-0559/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)
[![reward](https://make.fun/badge/best-heist-game-20261122-0559/Agus12341/heist-game/reward.svg)](https://make.fun/bounty/best-heist-game-20261122-0559?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)

# GILT — The Meridian Job

A tiny top-down heist game for the [make.fun "Make the best heist game" bounty](https://make.fun/bounty/best-heist-game-20261122-0559).
You are Wren, a thief with one night to empty the Meridian Gallery: slip through
three rooms — the Lobby, the Gallery and the Vault — past patrolling guards with
vision cones, sweeping security cameras and laser grids, bag each room's target
piece, crack the vault, and reach the exit before the alarm meter fills or the
getaway driver leaves.

It plays offline in a desktop browser from the static files in `game/` — no
build step, no network request, no library. Serve it and play:

```
node serve.ts        # then open http://localhost:8080
```

**Controls:** WASD / arrow keys move · Shift sneaks · E uses (camera panels,
vault door) · R retries a room · M mutes.

**How it plays:** carpet and shadow tiles slow detection; every guard carries a
detection meter that fills as you cross his cone, and a full meter means a chase
and a jumping alarm. Cameras feed the same alarm meter — blind them for eight
seconds from a camera panel, at the cost of one of your two EMP charges a room.
Laser switches on the floor toggle a room's beams. Optional loot is money in
the sack and weight on your back: the more you carry, the slower you walk. Each
room's exit stays locked until its target piece is in the bag.

## Layout

- `main.ts` — the hand-in program (Node 22, standard library only): validates
  the entry against the gate's caps, copies `game/` and `screenshots/` to the
  output and writes `dossier.json` with the vendored library.
- `game/index.html` — the page; everything it loads lives under `game/`.
- `game/src/levels.js` — the three rooms: maps, patrols, cameras, lasers, loot.
- `game/src/world.js` — the simulation: movement, patrols, vision cones,
  detection, the alarm, lasers, vault cracking. Deterministic, DOM-free.
- `game/src/render.js` — all canvas drawing: the rooms, cones, HUD, screens.
- `game/src/shots.js` — the deterministic showcase scenes behind `?shot=`.
- `game/src/audio.js` — generated WebAudio bleeps; no audio files.
- `game/src/main.js` — browser bootstrap: input, fixed-step loop, screens.
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged.
- `screenshots/` — real frames of the game, staged by `game/src/shots.js`.

Hand it in with `mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts`.

MIT licensed — see `LICENSE`.
