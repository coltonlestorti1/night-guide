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

## Build gotchas

- Typecheck with `npx tsc --noEmit -p tsconfig.app.json` (bare `npx tsc` is a silent no-op).
- DDL to Supabase goes clipboard → Colton pastes in the SQL editor (only the anon key exists locally); record all schema DDL in `~/Documents/endz/endz-schema.sql`.
- Google OAuth redirects target `localhost:8080` — test auth flows on the local dev server, not Vercel preview URLs.
