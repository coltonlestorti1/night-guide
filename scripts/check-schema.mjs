#!/usr/bin/env node
/**
 * Schema drift guard.
 *
 * WHY THIS EXISTS
 * On 2026-08-05 the `active_check_ins` view was missing three columns that had
 * been added to `check_ins` after the view was created (a `select *` view
 * freezes its column list at creation). `useMyCheckIn` selected one of them,
 * every request 400'd, and the vibe buttons — the most important write in the
 * app — were dead for a day. 256 unit tests stayed green the entire time,
 * because this failure lives at the database/client boundary where they are
 * structurally blind.
 *
 * WHAT IT DOES
 * Extracts every `.from("relation").select("columns")` pair out of src/, then
 * asks PostgREST to run each one with `limit=0`. PostgREST validates the column
 * list before it reads any rows, so a missing column returns 42703 while a
 * valid one returns an empty array. No data is read and no rows are returned.
 *
 * It deliberately reads the real query sites rather than a hand-maintained
 * manifest: a manifest is just one more thing that can drift.
 *
 * RLS is not a factor. Column validation happens before row filtering, so an
 * anon key that can see zero rows still proves the columns exist.
 *
 * Usage:  npm run check:schema
 * Exit:   0 = no drift, 1 = drift found, 2 = could not run
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const SRC = "src";
const URL_KEY = "VITE_SUPABASE_URL";
const ANON_KEY = "VITE_SUPABASE_PUBLISHABLE_KEY";

/** Read VITE_* vars out of .env.local without pulling in a dotenv dependency. */
function loadEnv() {
  const out = { ...process.env };
  for (const file of [".env.local", ".env"]) {
    try {
      for (const line of readFileSync(file, "utf8").split("\n")) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (m && !out[m[1]]) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    } catch {
      /* file absent is fine */
    }
  }
  return out;
}

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) files.push(...walk(p));
    else if ([".ts", ".tsx"].includes(extname(p))) files.push(p);
  }
  return files;
}

/**
 * Column lists are often factored into module constants
 * (`const PROFILE_COLS = "id, username, ..."`), used both bare
 * (`.select(PROFILE_COLS)`) and interpolated (`` .select(`${RSVP_COLS}, ...`) ``).
 * Collect them so those selects can be resolved instead of skipped — they cover
 * the joins, which is exactly where hand-maintained lists rot.
 *
 * Keyed per file first, since the same name is defined identically in several
 * modules; a global map is the fallback.
 */
function collectConstants(files) {
  const perFile = new Map();
  const global = new Map();
  const re = /(?:^|\n)\s*(?:export\s+)?const\s+([A-Z][A-Z0-9_]*)\s*=\s*["'`]([^"'`]+)["'`]/g;
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    const local = new Map();
    let m;
    while ((m = re.exec(text))) {
      local.set(m[1], m[2]);
      if (!global.has(m[1])) global.set(m[1], m[2]);
    }
    perFile.set(file, local);
  }
  return { perFile, global };
}

const resolve = (str, local, global) =>
  str.replace(/\$\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}/g, (whole, name) =>
    local.get(name) ?? global.get(name) ?? whole,
  );

/**
 * Find each `.from("x")` and the select that belongs to the same chain.
 *
 * The lookahead stops at the next `.from(` so a select further down the file is
 * never attributed to the wrong relation — that mis-attribution produced three
 * false failures on the first run, and a guard that invents failures gets
 * switched off.
 */
function extractQueries(files, consts) {
  const found = new Map();
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    const local = consts.perFile.get(file) ?? new Map();
    const fromRe = /\.from\(\s*["'`]([a-z_][a-z0-9_]*)["'`]\s*\)/g;
    let m;
    while ((m = fromRe.exec(text))) {
      const relation = m[1];
      const rest = text.slice(m.index + m[0].length);
      const nextFrom = rest.search(/\.from\(\s*["'`]/);
      const window = nextFrom === -1 ? rest : rest.slice(0, nextFrom);

      // Quoted/templated list, or a bare identifier referring to a constant.
      const quoted = window.match(/\.select\(\s*["'`]([^"'`]+)["'`]/);
      const ident = window.match(/\.select\(\s*([A-Z][A-Z0-9_]*)\s*[,)]/);
      const raw = quoted ? quoted[1] : ident ? (local.get(ident[1]) ?? consts.global.get(ident[1])) : null;
      if (!raw) continue;

      const columns = resolve(raw, local, consts.global).replace(/\s+/g, " ").trim();
      if (columns === "*") continue;

      const line = text.slice(0, m.index).split("\n").length;
      const key = `${relation}::${columns}`;
      if (!found.has(key)) found.set(key, { relation, columns, sites: [] });
      found.get(key).sites.push(`${file}:${line}`);
    }
  }
  return [...found.values()];
}

/**
 * Split a PostgREST select list into plain column names.
 *
 * Embedded resources — `profiles!inner(username)`, `alias:table(col)` — are
 * dropped: they are joins, not columns of this relation, and are validated by
 * PostgREST itself at request time. Aliases (`alias:column`) are unwrapped to
 * the underlying column.
 */
function plainColumns(select) {
  const parts = [];
  let depth = 0;
  let buf = "";
  for (const ch of select) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      parts.push(buf);
      buf = "";
    } else buf += ch;
  }
  parts.push(buf);
  return parts
    .map((p) => p.trim())
    .filter((p) => p && !p.includes("(") && p !== "*")
    .map((p) => (p.includes(":") ? p.split(":").pop().trim() : p))
    .filter(Boolean);
}

/** Column names of a relation, via the introspection function. */
async function relationColumns(base, key, relation) {
  const res = await fetch(`${base}/rest/v1/rpc/relation_columns`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ rel: relation }),
  });
  if (!res.ok) return null; // function not installed, or not callable
  const rows = await res.json();
  return rows.map((r) => r.column_name);
}

async function check(base, key, q) {
  // An interpolation we could not resolve must never be reported as drift — we
  // do not know what the real column list is, and a false failure is worse than
  // a gap because it teaches people to ignore the guard.
  if (q.columns.includes("${")) {
    return { ok: false, kind: "unverifiable", code: "unresolved interpolation" };
  }

  // Preferred: ask the database what columns the relation actually has. This
  // works even when RLS or grants make the relation unreadable, which is the
  // case for active_check_ins — the relation that drifted, and which anon can
  // no longer read at all since the 2026-08-06 view hardening.
  const actual = await relationColumns(base, key, q.relation);
  if (actual) {
    if (actual.length === 0) {
      return { ok: false, kind: "missing-relation" };
    }
    const missing = plainColumns(q.columns).filter((c) => !actual.includes(c));
    return missing.length
      ? { ok: false, kind: "drift", missing }
      : { ok: true, via: "introspection" };
  }

  // Fallback while the function is not installed: a zero-row probe. PostgREST
  // validates the column list before reading rows, so this still detects drift
  // on any relation the key is allowed to read.
  const url =
    `${base}/rest/v1/${q.relation}` +
    `?select=${encodeURIComponent(q.columns)}&limit=0`;
  const res = await fetch(url, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (res.ok) return { ok: true, via: "probe" };
  let body = {};
  try {
    body = await res.json();
  } catch {
    /* non-JSON error body */
  }
  if (body.code === "42703") {
    return { ok: false, kind: "drift", message: body.message };
  }
  return { ok: false, kind: "unverifiable", code: body.code ?? res.status };
}

const env = loadEnv();
const base = env[URL_KEY];
const key = env[ANON_KEY];

if (!base || !key) {
  console.error(`SKIP  ${URL_KEY} / ${ANON_KEY} not set — cannot reach the database.`);
  process.exit(2);
}

const consts = collectConstants(walk(SRC));
const queries = extractQueries(walk(SRC), consts).sort((a, b) =>
  a.relation.localeCompare(b.relation),
);
console.log(`Checking ${queries.length} distinct select(s) against ${new URL(base).host}\n`);

let drift = 0;
let skipped = 0;

for (const q of queries) {
  const r = await check(base, key, q);

  if (r.ok) {
    console.log(`  ok    ${q.relation}  (${q.columns})`);
    continue;
  }

  if (r.kind === "drift") {
    drift++;
    const detail = r.missing ? `missing: ${r.missing.join(", ")}` : r.message;
    console.log(`  DRIFT ${q.relation}  — ${detail}`);
    for (const s of q.sites) console.log(`        at ${s}`);
    continue;
  }

  if (r.kind === "missing-relation") {
    drift++;
    console.log(`  DRIFT ${q.relation}  — relation does not exist in the public schema`);
    for (const s of q.sites) console.log(`        at ${s}`);
    continue;
  }

  skipped++;
  console.log(`  skip  ${q.relation}  (${r.code}: could not verify)`);
}

console.log(`\n${queries.length} checked · ${drift} drifted · ${skipped} unverifiable`);

if (skipped > 0) {
  console.warn(
    `\n${skipped} select(s) could not be verified. Install the introspection\n` +
      `function so nothing is skipped: scripts/2026-08-06-relation-columns-fn.sql`,
  );
}

if (drift > 0) {
  console.error(
    `\nFAIL: ${drift} select(s) reference columns the database does not have.\n` +
      `If a view is involved: a \`select *\` view freezes its column list at\n` +
      `creation — re-run its definition after any ALTER TABLE ... ADD COLUMN.\n` +
      `See scripts/2026-08-06-fix-active-check-ins-view.sql`,
  );
  process.exit(1);
}
console.log("PASS: no schema drift.");
