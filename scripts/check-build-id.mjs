#!/usr/bin/env node
// Proves dist/version.json and the compiled bundle agree on the build id.
//
// If these ever drift, every client sees a permanent "new version" banner that
// reloading never clears — the worst possible failure of this feature, and one
// no unit test can catch because it only exists after a real build.

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const dist = path.resolve(process.cwd(), "dist");

let version;
try {
  version = JSON.parse(await readFile(path.join(dist, "version.json"), "utf8"));
} catch {
  console.error("FAIL: dist/version.json is missing. Run `npm run build` first.");
  process.exit(1);
}

const { buildId } = version;
if (typeof buildId !== "string" || buildId.length === 0) {
  console.error(`FAIL: dist/version.json has no usable buildId: ${JSON.stringify(version)}`);
  process.exit(1);
}

// Guarded like the version.json read above: this now runs as `postbuild`, on
// Vercel, on every deploy. An unguarded readdir on a missing dist/assets would
// fail the deploy with an unhandled-rejection stack trace instead of the one
// line that says what to do about it.
const assets = path.join(dist, "assets");
let found = false;
try {
  const js = (await readdir(assets)).filter((f) => f.endsWith(".js"));
  for (const file of js) {
    if ((await readFile(path.join(assets, file), "utf8")).includes(buildId)) {
      found = true;
      break;
    }
  }
} catch {
  console.error("FAIL: dist/assets could not be read. Run `npm run build` first.");
  process.exit(1);
}

if (!found) {
  console.error(`FAIL: buildId ${buildId} is in version.json but not in any dist/assets/*.js bundle.`);
  process.exit(1);
}

console.log(`PASS: build id ${buildId} matches in version.json and the bundle.`);
