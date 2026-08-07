# Pre-Launch Checklist

Tracks work needed before this project goes to production, accumulated across implementation plans. This is a durable, committed doc — unlike the per-plan SDD ledger (`.superpowers/sdd/<plan>/progress.md`), which is git-ignored scratch deleted once a plan's branch finishes.

## 1. Production infra parity

Manual config applied to UAT/dev that still needs to be replicated/verified in a separate prod Supabase project + Vercel prod environment before go-live. (Decision: single Supabase project for now — see `docs/impl-plans/auth-access-foundation-plan.md` Global Constraints. Split into `chartboard-prod` / `chartboard-uat` before real users onboard.)

- [ ] Create `chartboard-prod` Supabase project (separate from the dev/UAT project used during this plan)
- [ ] Re-run `supabase/migrations/0001_profiles.sql` against prod project
- [ ] Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` for prod in Vercel (separate values from dev/UAT — do not reuse)
- [ ] Create real admin account(s) in prod project and promote via the `profiles.role` SQL update (Task 10 pattern)
- [ ] Point Cloudflare-managed prod domain at the prod Vercel deployment
- [ ] Confirm JWT/session expiry settings match intended prod behavior (default 1hr access token — verify not left at a shortened debug value from Task 11 verification)

## 2. Parked review findings

Findings deferred during implementation review, not fixed before merge.

- [ ] `README.md` was fully replaced with the default `create-next-app` template during Task 1 scaffold (expected for a fresh scaffold; revisit with real project description before launch)
- [ ] `app/layout.tsx` destructures only `children` from a props type that also declares `params` (unused) — valid TS, minor consistency nit, low priority

## 3. Process/tooling gaps

- [x] Next.js 16 deprecated the `middleware.ts` file convention in favor of `proxy.ts` (function renamed `middleware` → `proxy`, same behavior/matcher config). The plan's file structure and Task 6/9/11 steps still reference `middleware.ts` by name — mentally substitute `proxy.ts`. Migrated during Task 6 (commit `4f6effb`); no outstanding action, just a naming mismatch between the plan doc and the actual repo going forward.
