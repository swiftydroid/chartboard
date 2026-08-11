# CI/CD Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every PR into `development` and `master` an enforced lint/test/build gate, weekly automated dependency updates, and static security scanning.

**Architecture:** A single GitHub Actions workflow (`ci.yml`) runs lint → test → build on PRs/pushes to `development` and `master`. A `dependabot.yml` config opens weekly PRs for npm and GitHub Actions dependencies. CodeQL's GitHub-managed default setup and branch protection rules are enabled by hand in the GitHub UI (not codified as files) and verified afterward.

**Tech Stack:** GitHub Actions, Dependabot, CodeQL (GitHub default setup), Node.js 24.x, npm, ESLint, Vitest, Next.js 16 build.

## Global Constraints

- Node version is pinned to `24.x` everywhere (matches the Vercel project's dashboard-configured Node.js Version) — `package.json` `engines`, and the CI workflow's `setup-node` step, must both say `24.x`.
- No secrets/env vars are added to the workflow — `next build` succeeds with none set (verified during design).
- CI job must be a single job named `ci` (this exact name becomes the required status check context in branch protection — do not rename without updating the branch protection rule to match).
- Dependabot: PRs only, weekly schedule, `npm` + `github-actions` ecosystems. No auto-merge.
- CodeQL: GitHub-managed default setup only — no custom `codeql.yml` workflow file.
- Branch protection required on both `development` and `master`, requiring the `ci` check and "up to date" branch requirement.
- No `gh` CLI available in this environment — all GitHub-side verification (Actions runs, Dependabot status, CodeQL status, branch protection rule) must be checked via the GitHub web UI, not scripted.

---

### Task 1: Pin Node version and scaffold the feature branch

**Files:**
- Modify: `package.json`

**Interfaces:**
- Produces: `package.json` `engines.node` = `"24.x"`, consumed implicitly by `npm install`/`npm ci` (npm warns on mismatch) and by Vercel's build image selection.

- [ ] **Step 1: Create the feature branch**

```bash
git checkout development
git pull origin development
git checkout -b ci-cd-pipeline
```

- [ ] **Step 2: Add the `engines` field to `package.json`**

Add this key at the top level of `package.json` (alongside `"name"`, `"version"`, `"private"`):

```json
  "engines": {
    "node": "24.x"
  },
```

Resulting top of the file should read:

```json
{
  "name": "auth-access-foundation",
  "version": "0.1.0",
  "private": true,
  "engines": {
    "node": "24.x"
  },
  "scripts": {
```

- [ ] **Step 3: Verify no engine warning locally**

Run: `npm install`
Expected: completes with no `npm warn EBADENGINE` output (local Node is v24.18.0, which satisfies `24.x`).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "pin Node engine to 24.x"
```

---

### Task 2: Add the CI workflow

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Produces: a GitHub Actions check named `ci` on every PR/push to `development` and `master`. Task 6 (branch protection) depends on this exact check name existing and having run at least once.

- [ ] **Step 1: Create the workflow file**

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  pull_request:
    branches: [development, master]
  push:
    branches: [development, master]

jobs:
  ci:
    name: ci
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '24.x'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Test
        run: npm run test

      - name: Build
        run: npm run build
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "add CI workflow: lint, test, build"
```

(Do not push yet — Task 4 pushes the whole branch and opens the PR once Tasks 1–3 are all committed, so the workflow's first real run is against the complete set of changes.)

---

### Task 3: Add Dependabot config

**Files:**
- Create: `.github/dependabot.yml`

**Interfaces:**
- Produces: weekly Dependabot PRs against `development` (the repo's default branch) for `npm` and `github-actions` ecosystems. Each such PR automatically triggers the Task 2 `ci` workflow, since it's a normal PR.

- [ ] **Step 1: Create the Dependabot config file**

Create `.github/dependabot.yml`:

```yaml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"

  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
```

- [ ] **Step 2: Commit**

```bash
git add .github/dependabot.yml
git commit -m "add Dependabot config for npm and github-actions"
```

---

### Task 4: Open the PR and verify CI runs green

**Files:** none (verification task)

**Interfaces:**
- Consumes: `.github/workflows/ci.yml` from Task 2, `.github/dependabot.yml` from Task 3, `package.json` engines from Task 1.

- [ ] **Step 1: Push the branch**

```bash
git push -u origin ci-cd-pipeline
```

- [ ] **Step 2: Open a PR into `development` via the GitHub web UI**

Go to `https://github.com/swiftydroid/chartboard/pulls`, click "New pull request", base `development` ← compare `ci-cd-pipeline`, title e.g. "Add CI/CD pipeline: workflow + Dependabot", create the PR.

- [ ] **Step 3: Verify the `ci` check runs and passes**

On the PR page, wait for the "Checks" section to show the `ci` check. Confirm it goes green (lint, test, and build all pass). If it fails, fix the underlying issue (not the workflow) and push a fix commit to `ci-cd-pipeline`, then re-verify.

- [ ] **Step 4: Merge the PR**

Merge `ci-cd-pipeline` into `development` via the GitHub UI (standard merge — branch protection isn't enabled yet at this point, so no required-check gate blocks this merge).

- [ ] **Step 5: Sync local `development`**

```bash
git checkout development
git pull origin development
```

---

### Task 5: Enable CodeQL default setup (manual, GitHub UI)

**Files:** none (GitHub repo setting, not a file in the repo)

**Interfaces:** none — independent of other tasks, can be done any time after Task 4's PR merges (needs at least one push to `development` with real source files, which already existed before this chunk).

- [ ] **Step 1: Enable CodeQL**

Go to `https://github.com/swiftydroid/chartboard/settings/security_analysis`. Under "Code scanning", find "CodeQL analysis" and click "Set up" → "Default". Confirm the languages detected include JavaScript/TypeScript, then enable.

- [ ] **Step 2: Verify it's enabled**

Go to `https://github.com/swiftydroid/chartboard/security/code-scanning`. Confirm the page shows CodeQL default setup as active (either a completed/queued scan, or a status banner confirming default setup is on — GitHub queues the first scan asynchronously, it may take a few minutes to appear).

- [ ] **Step 3: Report back**

Confirm to the user that this step is done before marking it complete — this is a manual UI action, not something verifiable by a local command.

---

### Task 6: Enable branch protection on `development` and `master` (manual, GitHub UI)

**Files:** none (GitHub repo setting, not a file in the repo)

**Interfaces:**
- Consumes: the `ci` check name from Task 2, which must have run at least once (via Task 4's PR) before GitHub will offer it as a selectable required status check.

- [ ] **Step 1: Add a branch protection rule for `development`**

Go to `https://github.com/swiftydroid/chartboard/settings/branches`. Click "Add branch protection rule". Branch name pattern: `development`. Enable:
- "Require a pull request before merging"
- "Require status checks to pass before merging" → search for and select `ci` → also check "Require branches to be up to date before merging"

Save the rule.

- [ ] **Step 2: Add a branch protection rule for `master`**

Repeat Step 1 with branch name pattern `master`, same settings (require PR, require the `ci` status check, require up to date).

- [ ] **Step 3: Verify both rules**

Go back to `https://github.com/swiftydroid/chartboard/settings/branches` and confirm both `development` and `master` are listed with rules showing the `ci` check as required.

- [ ] **Step 4: Report back**

Confirm to the user that both rules are in place before marking this task complete.

---

### Task 7: End-to-end verification that the gate actually blocks

**Files:**
- Create (temporary, deleted at end of task): a scratch branch, not a repo file.

**Interfaces:** none — final verification only, exercises Tasks 2 and 6 together.

- [ ] **Step 1: Create a scratch branch with a deliberately broken lint rule**

```bash
git checkout development
git pull origin development
git checkout -b ci-verify-scratch
```

Edit any existing `.ts`/`.tsx` file (e.g. `app/page.tsx`) to introduce an unused variable:

```ts
const _unusedCiVerificationVar = 1;
```

```bash
git add -A
git commit -m "scratch: verify CI blocks on lint failure (not for merging)"
git push -u origin ci-verify-scratch
```

- [ ] **Step 2: Open a scratch PR and confirm it's blocked**

Open a PR from `ci-verify-scratch` into `development` via the GitHub web UI. Confirm:
- The `ci` check runs and **fails** on the lint step.
- The "Merge pull request" button is disabled/blocked, with GitHub showing the required `ci` check as failing.

- [ ] **Step 3: Clean up**

Close the scratch PR without merging, then delete the branch both locally and on the remote:

```bash
git checkout development
git branch -D ci-verify-scratch
git push origin --delete ci-verify-scratch
```

- [ ] **Step 4: Confirm the chunk is complete**

At this point: CI workflow is merged and required, Dependabot is configured, CodeQL default setup is enabled, and branch protection has been proven to actually block a failing check. Report completion to the user.
