# night-guide (ENDZ app code)

Full project context — product, scope, privacy principles, tone — lives in
`~/Documents/endz/CLAUDE.md`. Read it before product work.

## Product-discussion gate (required)

For every major ENDZ product feature, complete a discussion and approval phase
before implementation. Audit the current behavior, ask focused questions,
present options and tradeoffs, define the MVP and acceptance criteria, and wait
for explicit approval before editing code, changing Supabase, selecting a paid
data source, or modifying recommendation logic.

Feature tasks and the full gate process live in `docs/ENDZ_MASTER_TASKS.md`.
A feature appearing in that tracker does NOT mean it is approved.

## Multi-session safety (required)

**Several Claude sessions work this repo at once.** On 2026-08-05 the shared
checkout changed branch three times mid-task and another session merged and
pushed to `main` while work was in flight. Assume you are never alone.

1. **Work in a worktree, never in `~/Documents/night-guide` directly.**
   `git worktree add .claude/worktrees/<name> -b <branch> main`
   (`.claude/worktrees/` is already gitignored). `git worktree remove` when
   done — a stale worktree holding `main` **blocks every other session from
   checking it out**.
2. **Pass absolute paths to file tools, and `cd <abs-path> &&` inside every
   Bash call.** The Bash tool's working directory persists between calls, so an
   earlier `cd` will silently pull a later `git commit` into the shared
   checkout. That is exactly how another session's in-progress file got
   committed under the wrong message, and how a `git reset HEAD~1` meant to
   undo it landed on `main` and reverted their merge instead.
3. **Never `git add -A` outside a worktree you own.** Stage explicit paths.
4. **Claim your work before you start.** Record what you're touching in the
   `active_work` memory (branch, worktree, files). Memory is shared across
   sessions in this project. It is read at session *start*, so it prevents
   collisions between sessions rather than mid-flight ones.
5. **Before pushing:** `git fetch`, confirm you're 0 behind, and check your own
   commits survived (`git merge-base --is-ancestor <sha> main`).

There is no locking. Git is the real arbiter — a rejected push is a signal to
re-fetch and re-verify, never to force.

Note `~/Documents/night-guide-b` is a separate long-lived worktree
(`wt/session-b`) driven by another session.

## Build gotchas

- Typecheck with `npx tsc --noEmit -p tsconfig.app.json` (bare `npx tsc` is a silent no-op).
- DDL to Supabase goes clipboard → Colton pastes in the SQL editor (only the anon key exists locally); record all schema DDL in `~/Documents/endz/endz-schema.sql`.
- Google OAuth redirects target `localhost:8080` — test auth flows on the local dev server, not Vercel preview URLs.
