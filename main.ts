// GILT — The Meridian Job: the hand-in program (Node 22, standard library only).
// The game itself is this directory's game/ folder: plain static files a desktop
// browser plays offline (game/index.html and its ES modules, no library, no
// network request). This program hands it in: it checks the entry against the
// gate's own caps, copies game/ and screenshots/ to /output, writes the
// /output/dossier.json the judge reads with the vendored make.fun library, and
// adds a small manifest of what was handed in.
//
// Serve the game locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The gate's caps, mirrored so a broken entry fails here with a plain message
// instead of failing silently on the server.
const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

function listFiles(root, dir) {
  const found = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) found.push(...listFiles(root, full));
    else found.push({ path: relative(root, full), bytes: statSync(full).size });
  }
  return found.sort((a, b) => a.path.localeCompare(b.path));
}

function checkEntry() {
  const gameDir = join(here, 'game');
  if (!existsSync(join(gameDir, 'index.html'))) {
    throw new Error('GILT: game/index.html is missing; there is no game to hand in.');
  }
  const files = listFiles(gameDir, gameDir);
  const totalBytes = files.reduce((sum, f) => sum + f.bytes, 0);
  if (files.length > CAPS.game_max_files) {
    throw new Error(`GILT: game/ holds ${files.length} files, over the ${CAPS.game_max_files} cap.`);
  }
  if (totalBytes > CAPS.game_max_bytes) {
    throw new Error(`GILT: game/ is ${totalBytes} bytes, over the ${CAPS.game_max_bytes} cap.`);
  }
  const indexBytes = statSync(join(gameDir, 'index.html')).size;
  if (indexBytes > 1024 * 1024) {
    throw new Error(`GILT: game/index.html is ${indexBytes} bytes, over the 1 MiB cap.`);
  }
  const shotsDir = join(here, 'screenshots');
  const shots = existsSync(shotsDir)
    ? listFiles(shotsDir, shotsDir).filter((f) => /\.(png|jpe?g)$/i.test(f.path))
    : [];
  if (shots.length < 3 || shots.length > CAPS.screenshots.max) {
    throw new Error(`GILT: screenshots/ holds ${shots.length} images; the gate wants 3 or 4.`);
  }
  for (const s of shots) {
    if (s.bytes > CAPS.screenshots.max_bytes) {
      throw new Error(`GILT: screenshot ${s.path} is ${s.bytes} bytes, over the 256 KiB cap.`);
    }
  }
  return { files, totalBytes, shots };
}

const checked = checkEntry();

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

writeFileSync(join(out, 'dossier.json'), buildDossier(out, CAPS));

// A manifest of the hand-in, derived only from the files themselves (never
// from the clock), so the grader's two runs write byte-identical output.
const manifest = {
  game: 'GILT — The Meridian Job',
  entrypoint: 'game/index.html',
  game_files: checked.files.length,
  game_bytes: checked.totalBytes,
  screenshots: checked.shots.map((s) => s.path),
  files: checked.files,
};
writeFileSync(join(out, 'entry-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(
  `GILT: handed in ${manifest.game_files} game files (${manifest.game_bytes} bytes) ` +
  `and ${manifest.screenshots.length} screenshots.`,
);
