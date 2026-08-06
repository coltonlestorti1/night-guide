#!/usr/bin/env node
/**
 * Install the repo's git hooks.
 *
 * Hooks are not versioned by git, so the real hook lives in scripts/hooks/ and
 * this writes a one-line shim into the git hooks directory that execs it. That
 * keeps the hook reviewable in the repo and means editing it does not require
 * reinstalling.
 *
 * Writes to the COMMON git dir, so a single install covers every worktree —
 * which matters here, since this repo is worked from several at once.
 *
 * Idempotent. Refuses to clobber a hook it did not write.
 *
 * Usage:  npm run hooks:install   (also runs automatically via postinstall)
 *
 * ── THIS SCRIPT MUST NEVER FAIL ──────────────────────────────────────────────
 * It runs from `postinstall`, so a throw here breaks `npm install` for everyone
 * and fails the Vercel build — where there may be no git dir, no hooks
 * directory, and a read-only filesystem. Developer convenience must never be
 * able to break a deploy. Every failure path exits 0 with a note; the only
 * consequence of not installing is that someone runs `npm run check:schema`
 * by hand.
 */
import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const MARKER = "# installed by scripts/install-hooks.mjs";
const HOOKS = ["pre-push"];

/**
 * execFile, not exec: no shell, so nothing here can be word-split or expanded.
 * git's stderr is discarded — outside a repository it prints "fatal: not a git
 * repository", and that word showing up in a deploy log reads like a broken
 * build when it is the expected, handled case.
 */
const git = (...args) =>
  execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();

/** Bail out cleanly. Never a non-zero exit — see the header. */
function skip(reason) {
  console.log(`hooks: skipped (${reason})`);
  process.exit(0);
}

// CI and deploy builds install dependencies but never push, so a hook there is
// pointless — and the filesystem may be read-only.
if (process.env.CI || process.env.VERCEL) skip("CI/deploy environment");

let commonDir;
let topLevel;
try {
  commonDir = resolve(git("rev-parse", "--path-format=absolute", "--git-common-dir"));
  topLevel = resolve(git("rev-parse", "--show-toplevel"));
} catch {
  // No git, or not a repository — e.g. installed as a dependency, or a
  // tarball/Docker context with .git stripped out.
  skip("not a git repository");
}

try {
  const hooksDir = join(commonDir, "hooks");
  mkdirSync(hooksDir, { recursive: true });

  let installed = 0;
  for (const hook of HOOKS) {
    const target = join(hooksDir, hook);

    if (existsSync(target) && !readFileSync(target, "utf8").includes(MARKER)) {
      console.log(`hooks: kept existing ${hook} (not written by us) — install by hand if wanted`);
      continue;
    }

    // cd to the top level so the hook's relative paths resolve the same way
    // whether the push came from the main checkout or a worktree.
    writeFileSync(
      target,
      `#!/bin/sh\n${MARKER}\ncd "$(git rev-parse --show-toplevel)" || exit 0\nexec sh scripts/hooks/${hook} "$@"\n`,
    );
    chmodSync(target, 0o755);
    installed++;
  }

  console.log(
    `hooks: ${installed} installed into ${hooksDir} (covers every worktree of ${topLevel}). ` +
      `Bypass one push with: git push --no-verify`,
  );
} catch (err) {
  // Read-only filesystem, permissions, anything else. Not worth a broken
  // install: the fallback is running `npm run check:schema` by hand.
  skip(`could not write hooks — ${err.code ?? err.message}`);
}
