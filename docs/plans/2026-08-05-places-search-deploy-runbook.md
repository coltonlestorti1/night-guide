# places-search Edge Function — deploy runbook (Colton-run)

ENDZ's second Edge Function. Proxies Google Places text search so
`GOOGLE_PLACES_API_KEY` never reaches the client bundle.

## Machine state, checked 2026-08-05

- The `supabase` CLI is **not** installed, and neither is Homebrew. Use `npx`.
- `supabase login` was refreshed on this machine 2026-08-05.
- The repo is **already linked** — `supabase/.temp/linked-project.json` has
  `ref: nqafzgryzjbtwpvzjagr` (project **ENDZ**) from 2026-07-20. No re-link
  needed; running `link` again is a silent no-op.

## Deploy

From `~/Documents/night-guide`:

1. Set the secret. Reads the value out of `.env.local` so the key is never
   typed into a shell or a chat window:

       npx -y supabase@latest secrets set \
         GOOGLE_PLACES_API_KEY=$(grep -m1 GOOGLE_PLACES_API_KEY .env.local | cut -d= -f2-)

2. Deploy **with** JWT verification — no flag:

       npx -y supabase@latest functions deploy places-search

   Do NOT pass `--no-verify-jwt`. That flag is correct for `plan-guest`, where
   guests have no account and no JWT. Here it would turn the function into an
   open proxy on the Google Places quota, billable to Colton by anyone who
   finds the URL.

## Verify

3. Unauthenticated calls must be refused at the gateway:

       curl -s -o /dev/null -w "%{http_code}\n" \
         -X POST "https://nqafzgryzjbtwpvzjagr.supabase.co/functions/v1/places-search" \
         -H "Content-Type: application/json" -d '{"query":"monas"}'

   Expect **401**. A 200 here means the JWT flag leaked in — redeploy without it.

3b. **The load-bearing check.** A call carrying only the publishable key must
    ALSO be refused. On the first deploy (2026-08-05) this returned 200 with
    real Google results, because `sb_publishable_…` keys are not JWTs and the
    gateway accepts them as valid API keys — `verify_jwt` cannot tell a public
    visitor from a signed-in user. The function now resolves the bearer token
    to a real user itself:

       K=$(grep -m1 VITE_SUPABASE_PUBLISHABLE_KEY .env.local | cut -d= -f2-)
       curl -s -o /dev/null -w "%{http_code}\n" \
         -X POST "https://nqafzgryzjbtwpvzjagr.supabase.co/functions/v1/places-search" \
         -H "apikey: $K" -H "Authorization: Bearer $K" \
         -H "Content-Type: application/json" -d '{"query":"monas"}'

    Expect **401**. A 200 is an open proxy on the Google Places quota — anyone
    who reads the key out of the production bundle can spend it. Re-run this
    after every deploy of this function.

4. Signed-in calls return placeId/name/address and nothing else. Easiest check
   is the onboarding Spots screen itself; the field degrades to "no results"
   when the function is missing, so a populated dropdown is the pass.

5. The key must still be absent from the bundle:

       npm run build
       grep -rc "$(grep -m1 GOOGLE_PLACES_API_KEY .env.local | cut -d= -f2-)" dist/assets/*.js

   Expect `0` for every file.

## Logs

Dashboard → Edge Functions → places-search → Logs, or:

    npx -y supabase@latest functions logs places-search

## No-CLI fallback

The dashboard can do both steps: Edge Functions → Deploy a new function (paste
`supabase/functions/places-search/index.ts`, leave **Verify JWT** on), and
Project Settings → Edge Functions → Secrets for the key. Costs a re-paste on
every future edit, which is why the CLI path is preferred.
