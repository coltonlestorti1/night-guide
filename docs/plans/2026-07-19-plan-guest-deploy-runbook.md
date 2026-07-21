# plan-guest Edge Function — deploy runbook (Colton-run)

ENDZ's first Edge Function. One-time setup, then one command per deploy.
The service-role key never leaves Supabase — the platform injects
SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY into the function automatically.

## One-time setup

1. Install the CLI: `brew install supabase/tap/supabase`
2. `supabase login` (opens the browser)
3. From the night-guide repo root:
   `supabase link --project-ref <PROJECT_REF>`
   (PROJECT_REF is the subdomain in your dashboard URL:
   https://supabase.com/dashboard/project/<PROJECT_REF>)

## Deploy (every time the function changes)

    supabase functions deploy plan-guest --no-verify-jwt

`--no-verify-jwt` is REQUIRED: guests have no account and no JWT, and the
app's publishable key is not a JWT either. Without the flag every guest
request 401s. Safety doesn't depend on the gateway check — the function
itself never returns anything beyond the single plan a valid token names,
and unknown tokens get a generic 404.

## Smoke test (after deploy)

    curl -s "https://<PROJECT_REF>.supabase.co/functions/v1/plan-guest?token=00000000-0000-0000-0000-000000000000"

Expected: `{"error":"Not found"}` (404). Then open a real plan link from
the app in an incognito window.

## Logs

Dashboard → Edge Functions → plan-guest → Logs (or `supabase functions logs plan-guest`).
