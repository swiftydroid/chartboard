# CI/CD Pipeline — Design

Next chunk after `auth-access-foundation` (see `docs/specs/preLaunchChecklist.md`). Scope locked in ahead of time: GitHub Actions running tests/build, Dependabot, CodeQL.

## Goal

Give every PR into `development` and `master` an enforced quality gate (lint, test, build), automated dependency updates, and static security scanning — without adding CI complexity the project (a solo-dev Next.js + Supabase app) doesn't need yet.

## Context found during scoping

- No `.github/workflows/` exists yet.
- `package.json` scripts: `lint` (ESLint), `test` (`vitest run`), `build` (`next build`).
- Only one test file currently: `lib/supabase/route-protection.test.ts`.
- `next build` succeeds with **no environment variables set** (verified locally) — CI does not need Supabase secrets for the build step.
- `next build` on Next.js 16 runs its own TypeScript check as part of the build ("Running TypeScript ..." in build output) — no separate `tsc` step needed.
- Repo default branch is `development` (confirmed via `git remote show origin`), so Dependabot PRs will target `development` by default.
- `master` currently sits at the initial scaffold commit and has not yet received `development`'s work — no promotion has happened yet, but the CI/branch-protection setup should cover it now so it's ready when that promotion does happen.
- Vercel project's Node.js Version setting (checked by user in dashboard): **24.x**. No `engines` field or `.nvmrc` existed before this chunk.

## 1. CI workflow — `.github/workflows/ci.yml`

**Triggers**: `pull_request` targeting `development` and `master`; `push` to `development` and `master`.

**Job**: single job (`ci`) on `ubuntu-latest`, Node 24.x (matches Vercel dashboard setting). Steps, in order (cheapest/fastest-to-fail first, most comprehensive last):

1. `actions/checkout`
2. `actions/setup-node` with Node 24.x and npm cache enabled (cache keyed on `package-lock.json`, avoids re-downloading ~478 packages every run)
3. `npm ci` (not `npm install` — fails hard on lockfile drift instead of silently rewriting it, guaranteeing a deterministic dependency tree)
4. `npm run lint`
5. `npm run test`
6. `npm run build`

**`package.json` change**: add `"engines": { "node": "24.x" }`, so Vercel and CI are both pinned to the same value and can't silently drift apart. (`.nvmrc` intentionally skipped — it doesn't affect Vercel's build image, only local `nvm use` convenience, and isn't needed here.)

No secrets/env vars are configured for this workflow — confirmed unnecessary for build to succeed.

## 2. Dependabot — `.github/dependabot.yml`

Two update entries, both weekly:

- `npm` ecosystem, root directory
- `github-actions` ecosystem, root directory (keeps the `ci.yml` workflow's action versions, e.g. `actions/checkout`, `actions/setup-node`, current)

PRs only, no auto-merge — each PR triggers the `ci.yml` workflow automatically since it's a normal PR against `development`.

## 3. Manual GitHub dashboard steps (tasks in this chunk, not deferred)

Both are one-time settings applied by hand in the GitHub UI, tracked as explicit tasks in the implementation plan with a verification step before being marked done — not pushed to `preLaunchChecklist.md`, since they belong to this chunk's own scope.

- **CodeQL default setup**: repo Settings → Code security → enable "CodeQL analysis" (GitHub-managed default option, not a custom workflow file). Auto-detects JS/TS, runs on PRs plus a schedule.
- **Branch protection on `development` and `master`**: repo Settings → Branches → add a rule for each requiring the `ci` job's status check to pass before merging, plus "require branches to be up to date before merging." This is what makes the CI workflow actually blocking rather than informational.

## Explicitly out of scope (YAGNI)

- E2E/Playwright testing — not part of the locked-in scope, no existing e2e setup to build on.
- Dependabot auto-merge — user chose manual review of every dependency PR for now.
- Node version matrix (multiple Node versions) — solo-dev app, single pinned version (24.x) matching prod is sufficient.
- Custom/advanced CodeQL workflow — GitHub-managed default setup covers a JS/TS Next.js app without customization.

## Testing/verification plan

- After `ci.yml` is added, open a throwaway PR (or push a trivial commit) to confirm the workflow triggers and all three steps (lint/test/build) pass.
- Deliberately break one step (e.g. introduce a lint error) on a scratch branch to confirm the check fails and — once branch protection is on — actually blocks merge.
- After Dependabot config is added, confirm via repo Insights → Dependency graph → Dependabot that it's enabled and scheduled (first PRs may take up to a week to appear on schedule, don't block completion on waiting for one).
- After CodeQL default setup is enabled, confirm the initial scan run appears and completes under Security → Code scanning.
- After branch protection rules are added, confirm in Settings → Branches that both `development` and `master` show the rule with the `ci` check listed as required.

## Follow-up (2026-08-12): Vercel Deployment Checks

After the chunk above was merged, the repo was made **public** (to unlock free CodeQL default setup, which requires GitHub Advanced Security — paid on private repos, free on public). This also surfaced that Vercel's Preview deployments run independently of the `ci` GitHub Actions check — GitHub branch protection only gates the PR merge button, not Vercel's own build/deploy pipeline, which fires on every push regardless of `ci`'s status.

Investigated two ways to gate Vercel on `ci` passing:

1. **Vercel's native "Deployment Checks"** (Project Settings → Deployment Checks): reads GitHub Actions check results and withholds promoting a **Production** deployment to the custom production domain until selected checks pass. Zero code, zero added build-minute cost — the production build still happens immediately, only the domain alias is withheld.
2. **Custom "Ignored Build Step" polling script**: the only way to gate a **Preview** deployment (no native equivalent exists for Preview — Vercel's Deployment Checks docs are explicit that it only applies to production promotion). Would require a maintained script polling the GitHub Checks API for up to N minutes before deciding build-vs-skip, at the cost of real build-minutes on every push.

**Decision**: enabled Vercel's native Deployment Checks for **Production only**, requiring the `ci` check. **Preview deployments remain ungated** — deliberately out of scope, since gating them has no free/native option and Preview URLs aren't user-facing, so the build-minute cost of a polling script wasn't judged worth it for a solo-dev project. Configuration is a Vercel dashboard setting, not a file in this repo, so it isn't visible in git history — this note is the durable record. Verification is deferred to the actual first `development` → `master` promotion (tracked in `docs/specs/preLaunchChecklist.md`), since `master` was still at the initial scaffold commit at configuration time and forcing a promotion just to test the gate would have meant an unplanned first production launch.
