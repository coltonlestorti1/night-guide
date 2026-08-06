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
 * Usage:  npm run hooks:install
 */
import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const MARKER = "# installed by scripts/install-hooks.mjs";
const HOOKS = ["pre-push"];

/** execFile, not exec: no shell, so nothing here can be word-split or expanded. */
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();

const commonDir = resolve(git("rev-parse", "--path-format=absolute", "--git-common-dir"));
const topLevel = resolve(git("rev-parse", "--show-toplevel"));
const hooksDir = join(commonDir, "hooks");
mkdirSync(hooksDir, { recursive: true });

let installed = 0;
for (const hook of HOOKS) {
  const target = join(hooksDir, hook);

  if (existsSync(target) && !readFileSync(target, "utf8").includes(MARKER)) {
    console.error(`SKIP  ${hook} — a hook already exists and was not written by us.`);
    console.error(`      Inspect ${target} and merge by hand if you want both.`);
    continue;
  }

  // cd to the top level so the hook's relative paths resolve the same way
  // whether the push came from the main checkout or a worktree.
  writeFileSync(
    target,
    `#!/bin/sh\n${MARKER}\ncd "$(git rev-parse --show-toplevel)" || exit 0\nexec sh scripts/hooks/${hook} "$@"\n`,
  );
  chmodSync(target, 0o755);
  console.log(`ok    ${hook} -> scripts/hooks/${hook}`);
  installed++;
}

console.log(
  `\n${installed} hook(s) installed into ${hooksDir}` +
    `\nThis covers every worktree of ${topLevel}.` +
    `\nBypass a single push with: git push --no-verify`,
);
