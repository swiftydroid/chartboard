# Auth & Access Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the ChartBoard Next.js app with Supabase-backed email/password login, session gating, and a `profiles` table, proving the full auth chain end-to-end with a placeholder protected page.

**Architecture:** Next.js 16 App Router talks to a hosted Supabase project (Postgres + Auth) via `@supabase/ssr`. Session cookies are refreshed and routes gated in `middleware.ts`; a second, independent `getUser()` check in `app/(protected)/layout.tsx` guards all protected pages; Row Level Security on the `profiles` table is the final data-access backstop. Deployed to Vercel behind a Cloudflare-managed custom domain.

**Tech Stack:** Next.js 16 (App Router, TypeScript), Node.js 24, Supabase (`@supabase/supabase-js`, `@supabase/ssr`), Tailwind CSS, shadcn/ui, Vercel, Cloudflare DNS.

## Global Constraints

- Next.js version: 16 (App Router only, no Pages Router)
- Node.js version: 24
- Supabase: hosted Free-tier project only — no local Supabase CLI/Docker stack
- Auth method: email + password only for this chunk — no OAuth, no magic link, no self-serve sign-up
- Account creation: manual via Supabase dashboard — no sign-up UI is built in this chunk
- Styling: Tailwind CSS + shadcn/ui only — no other component library
- **No automated tests except for pure logic with no external dependency.** The only unit-tested code in this chunk is the middleware's route-protection predicate (Task 6) — a plain function with real edge cases and no Supabase/network dependency. Everything else (Supabase client wrappers, pages, Server Actions) is thin glue around the Supabase SDK, where a mocked unit test would just re-assert the mock rather than catch real bugs (cookie persistence, RLS enforcement) — those stay covered by the manual verification checklist only. Do not add Jest/Playwright/React Testing Library, and do not add tests to any task other than Task 6.
- Test runner: Vitest (added in Task 6, the only task that needs one)
- Env vars required throughout: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (service-role key is provisioned but unused until a future admin-tooling chunk)
- Design reference: `docs/specs/auth-access-foundation-design.md`

---

## File Structure

```
chartboard/
├── .env.local                          # gitignored, real Supabase project values
├── .env.example                        # committed, placeholder values
├── middleware.ts                       # root middleware, delegates to lib/supabase/middleware.ts
├── lib/
│   └── supabase/
│       ├── client.ts                   # browser Supabase client
│       ├── server.ts                   # server Supabase client (Server Components/Actions)
│       ├── route-protection.ts         # pure route-matching predicate (unit tested)
│       ├── route-protection.test.ts    # unit tests for route-protection.ts (colocated, Vitest convention)
│       └── middleware.ts               # session refresh + route gating logic
├── supabase/
│   └── migrations/
│       └── 0001_profiles.sql           # profiles table, RLS, auto-provisioning trigger
├── app/
│   ├── page.tsx                        # redirects "/" to "/dashboard"
│   ├── login/
│   │   └── page.tsx                    # login form (client component)
│   └── (protected)/
│       ├── layout.tsx                  # server-side getUser() gate, wraps protected pages
│       ├── actions.ts                  # logout Server Action
│       └── dashboard/
│           └── page.tsx                # placeholder page proving the auth chain works
└── components/
    └── ui/                             # shadcn/ui generated components (button, input, label)
```

---

### Task 1: Bootstrap the Next.js project

**Files:**
- Create: entire project scaffold via `create-next-app` (package.json, tsconfig.json, next.config.ts, app/layout.tsx, app/page.tsx, app/globals.css, tailwind config, .gitignore, etc.)

**Interfaces:**
- Produces: a running Next.js 16 dev server at `http://localhost:3000`, Tailwind CSS wired into `app/globals.css`, TypeScript configured with the `@/*` import alias.

- [ ] **Step 1: Confirm Node version**

Run: `node --version`
Expected: `v24.x.x`. If not, install/switch to Node 24 before continuing (e.g. via `nvm install 24 && nvm use 24`).

- [ ] **Step 2: Scaffold the project**

Run from the repo root:
```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir=false --import-alias "@/*" --use-npm
```
When prompted, accept defaults for anything not covered by the flags above.

- [ ] **Step 3: Verify the dev server runs**

Run: `npm run dev`
Expected: server starts on port 3000; visiting `http://localhost:3000` in a browser shows the default Next.js starter page. Stop the server (Ctrl+C) once confirmed.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "Bootstrap Next.js 16 project with TypeScript and Tailwind"
```

---

### Task 2: Configure the Supabase project and environment variables

**Files:**
- Create: `.env.local`
- Create: `.env.example`
- Modify: `.gitignore` (verify `.env*.local` is already ignored by the Next.js scaffold — it is by default; confirm rather than re-add)

**Interfaces:**
- Produces: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` available via `process.env` for all later tasks.

- [ ] **Step 1: Create the Supabase project**

In the Supabase dashboard (supabase.com), create a new project on the Free tier. Note the project's API URL and keys from Project Settings → API.

- [ ] **Step 2: Write `.env.local`**

Create `.env.local` in the repo root:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```
Replace each value with the real ones from the Supabase dashboard.

- [ ] **Step 3: Write `.env.example`**

Create `.env.example` in the repo root (committed, no real secrets):
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

- [ ] **Step 4: Verify `.env.local` is git-ignored**

Run: `git check-ignore .env.local`
Expected: prints `.env.local`, confirming it will not be committed. If it prints nothing, add `.env*.local` to `.gitignore` before proceeding.

- [ ] **Step 5: Commit**

```bash
git add .env.example .gitignore
git commit -m "Add Supabase environment variable placeholders"
```

---

### Task 3: Install Supabase packages and shadcn/ui

**Files:**
- Modify: `package.json` (new dependencies)
- Create: `components.json` (shadcn/ui config)
- Create: `lib/utils.ts` (shadcn/ui's `cn()` helper, generated by the init command)
- Create: `components/ui/button.tsx`, `components/ui/input.tsx`, `components/ui/label.tsx`

**Interfaces:**
- Produces: `createBrowserClient`/`createServerClient` available from `@supabase/ssr`; `Button`, `Input`, `Label` components importable from `@/components/ui/*`.

- [ ] **Step 1: Install Supabase packages**

Run: `npm install @supabase/supabase-js @supabase/ssr`

- [ ] **Step 2: Initialize shadcn/ui**

Run: `npx shadcn@latest init`
When prompted, choose defaults (Tailwind CSS variables, `app/globals.css`, `@/components` alias).

- [ ] **Step 3: Add the components this chunk needs**

Run: `npx shadcn@latest add button input label`

- [ ] **Step 4: Verify the install**

Run: `npm run build`
Expected: build succeeds with no type errors (the default Next.js starter page still compiles; nothing references the new components yet, which is fine).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Install Supabase client packages and shadcn/ui base components"
```

---

### Task 4: Supabase client helpers (browser + server)

**Files:**
- Create: `lib/supabase/client.ts`
- Create: `lib/supabase/server.ts`

**Interfaces:**
- Produces:
  - `createClient()` from `lib/supabase/client.ts` — returns a browser Supabase client, no args, for use in `'use client'` components.
  - `createClient()` (async) from `lib/supabase/server.ts` — returns `Promise<SupabaseClient>`, for use in Server Components/Route Handlers/Server Actions.

- [ ] **Step 1: Write the browser client**

Create `lib/supabase/client.ts`:
```ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 2: Write the server client**

Create `lib/supabase/server.ts`:
```ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from a Server Component render; safe to ignore
            // because middleware.ts refreshes the session on every request.
          }
        },
      },
    }
  )
}
```

- [ ] **Step 3: Verify it compiles**

Run: `npm run build`
Expected: build succeeds (nothing calls these functions yet, but TypeScript must resolve the imports and env var types cleanly).

- [ ] **Step 4: Commit**

```bash
git add lib/supabase/client.ts lib/supabase/server.ts
git commit -m "Add Supabase browser and server client helpers"
```

---

### Task 5: Database schema — profiles table, RLS, auto-provisioning trigger

**Files:**
- Create: `supabase/migrations/0001_profiles.sql`

**Interfaces:**
- Produces: `public.profiles` table with columns `id uuid` (PK, FK to `auth.users.id`), `role text` (`'admin'|'member'`, default `'member'`), `display_name text` (nullable), `created_at timestamptz`. Any later task or future chunk querying `profiles` relies on exactly these column names and types.

- [ ] **Step 1: Write the migration file**

Create `supabase/migrations/0001_profiles.sql`:
```sql
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  display_name text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, null);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

- [ ] **Step 2: Apply the migration**

Open the Supabase dashboard → SQL Editor → paste the full contents of `supabase/migrations/0001_profiles.sql` → Run.
Expected: "Success. No rows returned."

- [ ] **Step 3: Verify manually**

In the Supabase dashboard → Authentication → Users, click "Add user" and create a test user with any email/password. Then go to Table Editor → `profiles`.
Expected: a row exists with `id` matching the new user's UUID, `role = 'member'`, `display_name = null`. Delete this test user afterward (Authentication → Users → delete) to keep the project clean — you'll create your real account in Task 10.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0001_profiles.sql
git commit -m "Add profiles table, RLS policies, and auto-provisioning trigger"
```

---

### Task 6: Middleware — session refresh and route gating

**Files:**
- Create: `lib/supabase/route-protection.ts`
- Test: `lib/supabase/route-protection.test.ts`
- Create: `lib/supabase/middleware.ts`
- Create: `middleware.ts` (repo root)
- Modify: `package.json` (add `vitest` devDependency and `test` script)

**Interfaces:**
- Consumes: `createServerClient` from `@supabase/ssr` (no dependency on Task 4's helpers — middleware needs its own request/response-bound cookie handling, this is intentional per the Supabase SSR pattern).
- Produces:
  - `isProtectedPath(pathname: string): boolean` from `lib/supabase/route-protection.ts` — pure function, no dependencies, the only unit-tested code in this chunk (see Global Constraints).
  - `updateSession(request: NextRequest): Promise<NextResponse>` from `lib/supabase/middleware.ts`, used by the root `middleware.ts`.

- [ ] **Step 1: Install the test runner**

Run: `npm install -D vitest`

Add to `package.json`'s `"scripts"` block:
```json
"test": "vitest run"
```

- [ ] **Step 2: Write the failing test**

Create `lib/supabase/route-protection.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { isProtectedPath } from './route-protection'

describe('isProtectedPath', () => {
  it('matches the exact protected path', () => {
    expect(isProtectedPath('/dashboard')).toBe(true)
  })

  it('matches a nested path under a protected prefix', () => {
    expect(isProtectedPath('/dashboard/settings')).toBe(true)
  })

  it('does not match an unrelated path that merely starts with the same letters', () => {
    expect(isProtectedPath('/dashboard-old')).toBe(false)
  })

  it('does not match the login page', () => {
    expect(isProtectedPath('/login')).toBe(false)
  })

  it('does not match the root path', () => {
    expect(isProtectedPath('/')).toBe(false)
  })
})
```

- [ ] **Step 3: Run the test and verify it fails**

Run: `npx vitest run lib/supabase/route-protection.test.ts`
Expected: FAIL — `route-protection.ts` does not exist yet, so the import fails to resolve.

- [ ] **Step 4: Write the minimal implementation**

Create `lib/supabase/route-protection.ts`:
```ts
const PROTECTED_PREFIXES = ['/dashboard']

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )
}
```

- [ ] **Step 5: Run the test and verify it passes**

Run: `npx vitest run lib/supabase/route-protection.test.ts`
Expected: PASS — all 5 cases green.

- [ ] **Step 6: Write the middleware session logic, using the tested predicate**

Create `lib/supabase/middleware.ts`:
```ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { isProtectedPath } from './route-protection'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (isProtectedPath(request.nextUrl.pathname) && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
```

- [ ] **Step 7: Write the root middleware entrypoint**

Create `middleware.ts` in the repo root:
```ts
import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

- [ ] **Step 8: Manual verification — full dev server**

Run: `npm run dev`, then visit `http://localhost:3000/dashboard` in a browser.
Expected: redirected to `/login` (which doesn't exist as a page yet — a 404 on `/login` is fine and expected at this point; what matters is the URL bar shows `/login`, proving the redirect fired). Stop the server.

- [ ] **Step 9: Commit**

```bash
git add lib/supabase/route-protection.ts lib/supabase/route-protection.test.ts lib/supabase/middleware.ts middleware.ts package.json package-lock.json
git commit -m "Add middleware for session refresh and route gating, with unit-tested route matching"
```

---

### Task 7: Login page

**Files:**
- Create: `app/login/page.tsx`

**Interfaces:**
- Consumes: `createClient()` from `lib/supabase/client.ts` (Task 4); `Button`, `Input`, `Label` from `@/components/ui/*` (Task 3).
- Produces: the `/login` route.

- [ ] **Step 1: Write the login page**

Create `app/login/page.tsx`:
```tsx
'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    setLoading(false)

    if (error) {
      setError('Invalid email or password')
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <h1 className="text-xl font-semibold">Log in</h1>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? 'Logging in...' : 'Log in'}
        </Button>
      </form>
    </div>
  )
}
```

- [ ] **Step 2: Manual verification — wrong credentials**

Run: `npm run dev`, visit `http://localhost:3000/login`, submit a non-existent email/any password.
Expected: "Invalid email or password" shown inline; page stays on `/login`.

- [ ] **Step 3: Commit**

```bash
git add app/login/page.tsx
git commit -m "Add login page"
```

(Full login success can't be verified yet — there's no account and no `/dashboard` page. That happens in Tasks 8 and 10.)

---

### Task 8: Protected layout, dashboard placeholder, and root redirect

**Files:**
- Create: `app/(protected)/layout.tsx`
- Create: `app/(protected)/dashboard/page.tsx`
- Modify: `app/page.tsx` (replace the default starter content with a redirect)

**Interfaces:**
- Consumes: `createClient()` from `lib/supabase/server.ts` (Task 4); the `profiles` table (Task 5).
- Produces: `/dashboard` route, protected by both middleware (Task 6) and this layout's own `getUser()` check.

- [ ] **Step 1: Write the protected layout**

Create `app/(protected)/layout.tsx`:
```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return <>{children}</>
}
```

- [ ] **Step 2: Write the dashboard placeholder page**

Create `app/(protected)/dashboard/page.tsx`:
```tsx
import { createClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, display_name')
    .eq('id', user!.id)
    .single()

  return (
    <div className="p-8 space-y-2">
      <p>Logged in as {user!.email}</p>
      <p>Role: {profile?.role ?? 'unknown'}</p>
    </div>
  )
}
```

- [ ] **Step 3: Redirect the root path**

Replace the contents of `app/page.tsx`:
```tsx
import { redirect } from 'next/navigation'

export default function Home() {
  redirect('/dashboard')
}
```

- [ ] **Step 4: Manual verification — gating**

Run: `npm run dev`, visit `http://localhost:3000/` while logged out.
Expected: redirected to `/login` (via `/dashboard` → layout's `getUser()` check → `/login`).

- [ ] **Step 5: Commit**

```bash
git add "app/(protected)/layout.tsx" "app/(protected)/dashboard/page.tsx" app/page.tsx
git commit -m "Add protected layout, dashboard placeholder, and root redirect"
```

---

### Task 9: Logout Server Action

**Files:**
- Create: `app/(protected)/actions.ts`
- Modify: `app/(protected)/dashboard/page.tsx` (add the logout button)

**Interfaces:**
- Consumes: `createClient()` from `lib/supabase/server.ts` (Task 4).
- Produces: `logout()` Server Action from `app/(protected)/actions.ts`.

- [ ] **Step 1: Write the logout action**

Create `app/(protected)/actions.ts`:
```ts
'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
```

- [ ] **Step 2: Wire the logout button into the dashboard page**

Modify `app/(protected)/dashboard/page.tsx` — add the import and the form:
```tsx
import { createClient } from '@/lib/supabase/server'
import { logout } from '../actions'
import { Button } from '@/components/ui/button'

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, display_name')
    .eq('id', user!.id)
    .single()

  return (
    <div className="p-8 space-y-4">
      <p>Logged in as {user!.email}</p>
      <p>Role: {profile?.role ?? 'unknown'}</p>
      <form action={logout}>
        <Button type="submit" variant="outline">
          Log out
        </Button>
      </form>
    </div>
  )
}
```

- [ ] **Step 3: Verify it compiles**

Run: `npm run build`
Expected: build succeeds with no type errors. (Full click-through verification happens in Task 11's checklist, once a real account exists.)

- [ ] **Step 4: Commit**

```bash
git add "app/(protected)/actions.ts" "app/(protected)/dashboard/page.tsx"
git commit -m "Add logout server action"
```

---

### Task 10: Create your account and promote it to admin

**Files:**
- None (dashboard/SQL Editor actions only — no code changes)

**Interfaces:**
- None produced; this task populates data the previous tasks already depend on.

- [ ] **Step 1: Create your account**

In the Supabase dashboard → Authentication → Users → "Add user", create your real account with your email and a password. Confirm the email automatically if prompted (no email-sending is configured yet).

- [ ] **Step 2: Confirm the trigger provisioned a profile row**

Table Editor → `profiles`. Expected: a row with your user's `id`, `role = 'member'`, `display_name = null`.

- [ ] **Step 3: Promote yourself to admin**

SQL Editor, run (replace the email):
```sql
update public.profiles
set role = 'admin'
where id = (select id from auth.users where email = 'your-email@example.com');
```
Expected: "Success. 1 rows affected."

- [ ] **Step 4: Verify**

Table Editor → `profiles` → confirm your row now shows `role = 'admin'`.

(No commit — this task makes no code changes.)

---

### Task 11: Deploy to Vercel and run the full manual verification checklist

**Files:**
- None (Vercel/Cloudflare dashboard configuration only)

**Interfaces:**
- None produced; this is the end-to-end verification of every prior task together.

- [ ] **Step 1: Push the repo to GitHub**

If not already done:
```bash
git remote add origin <your-github-repo-url>
git push -u origin development
```

- [ ] **Step 2: Import the project into Vercel**

In the Vercel dashboard, import the GitHub repo. In the project's Environment Variables settings, add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` with the same values as `.env.local`. Deploy.

- [ ] **Step 3: Point the Cloudflare domain at Vercel**

In Vercel's project → Domains, add your custom domain. Follow Vercel's displayed DNS instructions in Cloudflare (typically a CNAME or A record) to point the domain at the deployment. Wait for Vercel to confirm the domain is verified.

- [ ] **Step 4: Run the full manual verification checklist against the live domain**

Visit your custom domain and confirm each of the following:
- [ ] Log in with correct credentials → lands on `/dashboard`, shows your email and `Role: admin`
- [ ] Log in with wrong password → inline "Invalid email or password" shown, stays on `/login`
- [ ] Visit `/dashboard` directly while logged out → redirected to `/login`
- [ ] Reload `/dashboard` while logged in → session persists, no redirect
- [ ] Click "Log out" → redirected to `/login`; visiting `/dashboard` afterward redirects again
- [ ] Leave the tab logged in for longer than the access token's lifetime (default 1 hour — or temporarily lower the JWT expiry in Supabase Auth settings to a few minutes to speed this check up, then revert it), then reload `/dashboard` → session refreshes silently, no redirect to `/login`

- [ ] **Step 5: Commit any final config notes**

If any deployment-specific documentation was added (e.g. a README note about the live URL), commit it:
```bash
git add -A
git commit -m "Document Vercel deployment and custom domain setup"
```
If nothing changed, skip this step — no empty commits.
