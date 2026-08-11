/**
 * Parsing a PostgREST select list.
 *
 * Split out of check-schema.mjs so it can be tested without running the guard,
 * which executes at import time.
 *
 * WHY THIS EXISTS AT ALL: the guard used to drop every embedded resource,
 * checking only the top-level relation's own columns. Its docstring justified
 * that by saying embeds "are validated by PostgREST itself at request time" —
 * true, but a guard that runs before push exists precisely so a query does not
 * have to be RUN to find the drift. Proved 2026-08-11: pointed at a select for
 * `night_post_tags.score`, a column that did not exist, PostgREST rejected the
 * query with 42703 and the guard printed `ok`.
 */

/**
 * Split a select list on commas at depth zero, so embedded parentheses stay
 * with their embed.
 */
function topLevelParts(select) {
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
  return parts.map((p) => p.trim()).filter(Boolean);
}

/**
 * Plain column names of THIS relation — embeds excluded, aliases unwrapped.
 *
 * `alias:column` becomes `column`. A part containing `(` is an embed and
 * belongs to embeddedSelects instead.
 */
export function plainColumns(select) {
  return topLevelParts(select)
    .filter((p) => !p.includes("(") && p !== "*")
    .map((p) => (p.includes(":") ? p.split(":").pop().trim() : p))
    .filter(Boolean);
}

/**
 * The relation an embed points at, from its head.
 *
 *   author:profiles!night_posts_user_id_fkey  ->  profiles
 *   tag:night_post_tags!inner                 ->  night_post_tags
 *   profiles!inner                            ->  profiles
 *   plans                                     ->  plans
 *
 * The alias before `:` is the caller's name for the result and says nothing
 * about the schema. The hint after `!` is either a FK constraint name or a
 * join modifier (`inner`/`left`) — never a relation.
 */
function relationOf(head) {
  const afterAlias = head.includes(":") ? head.slice(head.indexOf(":") + 1) : head;
  return afterAlias.split("!")[0].trim();
}

/**
 * Every embedded resource in a select, flattened, including nested ones.
 *
 * Returns `{ relation, select }` per embed, where `select` is the embed's own
 * column list — ready to be run back through plainColumns and checked against
 * that relation the same way the top level is.
 *
 * Nesting is real in this codebase: night_post_tags embeds night_posts, which
 * itself embeds profiles.
 */
export function embeddedSelects(select) {
  const out = [];
  for (const part of topLevelParts(select)) {
    const open = part.indexOf("(");
    if (open === -1) continue;

    // Match the closing paren for THIS embed, not the first one we meet.
    let depth = 0;
    let close = -1;
    for (let i = open; i < part.length; i++) {
      if (part[i] === "(") depth++;
      else if (part[i] === ")") {
        depth--;
        if (depth === 0) {
          close = i;
          break;
        }
      }
    }
    if (close === -1) continue; // unbalanced — not something to report as drift

    const relation = relationOf(part.slice(0, open));
    const inner = part.slice(open + 1, close);
    if (relation) out.push({ relation, select: inner });
    out.push(...embeddedSelects(inner));
  }
  return out;
}
