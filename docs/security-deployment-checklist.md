# Security deployment checklist

The application-side controls are in the repository, but two provider controls
must be enabled in the Supabase/Vercel dashboards for distributed protection.

## Supabase

1. Run `scripts/security-hardening.sql` in the production SQL editor.
2. In Authentication settings, disable public user sign-up. Users must be
   created through the application's administrator flow.
3. Confirm that an anonymous/authenticated REST request cannot select
   `role_permissions`, personnel health/confidentiality tables, or EQA/OUTLAB
   tables, and cannot insert/update/delete `profiles`.
4. Keep the service-role key server-only and rotate it if it has ever appeared
   in browser code, logs, or source control.

## Vercel

### Current production configuration

Applied to `nics-sj-s-projects/lab-management-cbh` on 2026-07-23:

- Rule: `High-risk public endpoints` (enabled)
- Fixed window: 600 requests per 600 seconds per IP
- Action when exceeded: Vercel `rate_limit`
- Paths: `/s/*`, `/api/satisfaction/*`, `/api/documents/download`,
  `/api/tests*`, and `/api/settings`

The current plan accepted one rate-limit rule, so these paths share one broad
edge ceiling. The application retains its finer per-visitor, per-campaign,
per-IP, and per-document limits.

When reviewing or changing the rule, keep broad edge protection on these public
paths. Adjust the limit from production traffic rather than making it stricter
than the application limits:

- `/s/*` and `GET /api/satisfaction/*`: protect page/state reads.
- `POST /api/satisfaction/*`: block obvious floods before a function runs.
- `/api/documents/download*` when `proxy=1`: protect streamed R2 traffic.

IP is intentionally only a broad edge signal. Survey submissions also require
a short-lived signed visitor challenge, an empty honeypot, a per-visitor limit,
a broad per-IP limit, and a per-campaign limit. This avoids treating all users
on a hospital/shared network as one person.

Enable usage notifications in both providers. The in-process limiter protects
downstream Supabase/R2 calls on each warm function instance; only the provider
firewall can stop a distributed request flood before it consumes a Vercel
invocation.

## Verification

Run:

```powershell
npm run test:security
npx tsc --noEmit
npm run build
```
