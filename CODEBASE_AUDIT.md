# VRA Homes Codebase Audit

**Date:** 2026-07-26  
**Branch base:** `master` @ `530493d`  
**Scope:** Next.js App Router app, Supabase SQL/migrations, API routes, client components, dependencies, and local verification commands.

## Verification run

| Check | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | Passed |
| `pnpm exec tsc --noEmit` | Failed — **28** TypeScript errors |
| `pnpm lint` | Failed — `eslint` binary not installed (`Unlisted binaries: eslint`) |
| `pnpm build` | Passed, but prints `Skipping validation of types` (`typescript.ignoreBuildErrors: true`) |
| `pnpm audit --audit-level low` | Failed — **20** advisories (**12 high**, **8 moderate**) |
| `pnpm dlx knip` | **42** unused files, **19** unused deps, many unused exports/types |
| Bundle (`route-bundle-stats.json`) | `/projects/[id]` first-load JS ≈ **2.16 MB** uncompressed |

Prior weekly audit findings remain largely open. New since last run: Next.js `16.2.6` has multiple patched advisories in `>=16.2.11`, and bulk expense entry increases reliance on the same over-fetching project/expense paths.

---

## Critical

### 1. Public signup creates administrator accounts

**Evidence**
- Public routes include `/signup` in `lib/supabase/middleware.ts`.
- `app/signup/page.tsx` is labeled “Admin Sign Up” and calls `signUpAdminAction`.
- `lib/auth/actions.ts` hardcodes `role: 'admin'` into signup metadata.
- `handle_new_user()` in `supabase/schema.sql` trusts `raw_user_meta_data.role`.

**Impact**  
Anyone who can reach `/signup` can create an admin and take over the app.

**Actionable fix**
1. Remove public `/signup` or gate it with a one-time bootstrap/invite token.
2. Disable public Auth signup in the Supabase project for production.
3. Change `handle_new_user()` to ignore client role metadata and default to `customer`.
4. Create staff/admin users only via service-role APIs guarded by `requireAdmin()`.

### 2. Profile RLS allows role self-escalation

**Evidence**
- `profiles` self UPDATE/INSERT policies in `supabase/schema.sql` only check `auth.uid() = id` with no column restrictions.
- Runtime fallback in `lib/supabase/ensure-profile.ts` also trusts `user_metadata.role`.

**Impact**  
Any authenticated user can escalate to `admin` via a direct Supabase client update.

**Actionable fix**
1. Add a `BEFORE INSERT OR UPDATE` trigger that rejects role changes unless `public.is_admin()`.
2. Split self-service profile updates to safe columns only (`full_name`, `phone`, etc.).
3. Move role changes to an admin-only server endpoint with an explicit allowlist.

### 3. Plaintext passwords stored and returned by admin API

**Evidence**
- `user_credentials.password` is plain `text` in `supabase/add-user-credentials.sql`.
- `GET/PATCH/POST /api/admin/users` reads, returns, and upserts plaintext passwords.
- Admin UI reveals passwords in `app/admin/users/page.tsx`.

**Impact**  
DB or admin-session compromise exposes reusable credentials for every managed user.

**Actionable fix**
1. Drop `public.user_credentials`.
2. Stop returning passwords from `/api/admin/users`.
3. Use Supabase Auth Admin invite/reset flows; show generated passwords once at creation only.
4. Remove password visibility UI.

### 4. Telegram webhook fails open without secret

**Evidence**
- `middleware.ts` excludes `api/telegram/webhook` from session middleware.
- `app/api/telegram/webhook/route.ts` only checks `x-telegram-bot-api-secret-token` when `TELEGRAM_WEBHOOK_SECRET` is set.
- Webhook handlers use service-role writes (`createAdminClient()`).

**Impact**  
If the secret env var is missing, any caller can post forged Telegram updates that mutate expenses/accounts.

**Actionable fix**
1. Fail closed in production: require `TELEGRAM_WEBHOOK_SECRET`.
2. Reject every POST without a matching secret header.
3. Keep webhook out of cookie auth, but never skip shared-secret verification.

---

## High

### 5. Production build hides TypeScript failures

**Evidence**
- `next.config.mjs` sets `typescript.ignoreBuildErrors = true`.
- `pnpm exec tsc --noEmit` reports 28 errors, concentrated in:
  - `app/api/admin/dashboard/route.ts`
  - `components/finance/all-expenses-content.tsx`
  - project detail tabs (`additional-works`, `milestones`, `overview`, `payments`, filters)
  - `lib/data/project-fetch.ts` (Supabase select parser errors)
  - `lib/project-context.tsx` (dead file still typechecked)
  - `lib/projects/invoice-actions.ts`, `lib/projects/actions.ts`
  - `lib/providers/auth-provider.tsx`
  - `lib/admin-dashboard-data.ts`

**Impact**  
Broken contracts around dashboard shapes, action results, and project fetches can ship unnoticed.

**Actionable fix**
1. Fix the listed errors (prefer typed selects / `TabActionResult` with `data`).
2. Delete or exclude dead `lib/project-context.tsx`.
3. Remove `ignoreBuildErrors`.
4. Add CI: `pnpm exec tsc --noEmit`.

### 6. Engineer expense self-approval still possible via RLS / split actions

**Evidence**
- Assignment-scoped expense policy grants engineers `FOR ALL` without status restrictions (`supabase/assignment-scoped-access.sql`).
- App layer forces pending status for normal/bulk create (`lib/permissions.ts`), but `lib/projects/expense-split-actions.ts` still accepts caller-supplied `status`.
- Base schema still has broad staff expense policies if assignment SQL was never applied.

**Impact**  
Engineers can approve their own expenses by calling Supabase/RLS-allowed writes or split insert paths.

**Actionable fix**
1. Enforce in Postgres: engineers insert/update only `status = 'pending'`; cannot set `approved_by` or flip status.
2. Strip/override `status` in split actions server-side based on role.
3. Fold assignment-scoped policies into canonical migrations and drop broad staff policies.

### 7. Storage policies are role-wide, not project-scoped

**Evidence**
- `expense-invoices` policies allow any staff role to read/write/delete any object in the bucket.
- `project-designs` policies allow admin/PM (and broad engineer read) without path/project assignment checks.

**Impact**  
Any staff user can access or overwrite another project’s invoices/design files if they know/guess object paths.

**Actionable fix**
1. Scope `storage.objects` by path prefix project id + `user_can_access_project(...)`.
2. Restrict delete/update to admin or assigned PM.
3. Prefer signed URLs from server actions instead of broad client bucket reads.

### 8. `/api/projects` over-fetches full nested graphs

**Evidence**
- `PROJECT_LIST_SELECT` embeds `milestones(*)`, `expenses(*)`, `client_payments(*)`, PM, engineers (`lib/data/project-fetch.ts`).
- List consumers (`use-project-data`, projects page) only need summary totals/labels, then filter/sort client-side.
- No pagination/search on `/api/projects`.

**Impact**  
Payload and Supabase cost grow as `projects × child rows`; dashboards and keyboard preload amplify the cost.

**Actionable fix**
1. Add a summary select/RPC with aggregates only.
2. Keep nested detail selects for `/api/projects/[projectId]`.
3. Move status/search/sort/pagination server-side.

### 9. Global expense shortcut listener can refetch `/api/projects` in a loop

**Evidence**
- Mounted in root `app/layout.tsx`.
- Effect in `expense-shortcut-listener.tsx` depends on whole `registry` and calls `registry.setProjects`.
- Provider value is recreated whenever `projects` changes (`expense-shortcut-context.tsx`).
- Guard is only `role === "customer"`; missing role still fetches.

**Impact**  
Non-customer (and unauthenticated-loading) pages can repeatedly hit the heavy projects API after every response.

**Actionable fix**
1. Destructure stable `setProjects`; depend on `[isLoading, role, setProjects]`.
2. Guard `if (!role) return`.
3. Prefer a slim `/api/projects/options` (`id, name` only), or fetch on picker open.

### 10. Admin finance feeds load full ledgers then filter/paginate in memory

**Evidence**
- Money timeline loads all received payments + approved expenses + active projects, then filters/pages in JS.
- All-expenses unified feed loads project/company/personal ledgers fully, filters by date in memory, then slices; route also re-fetches form metadata.
- Admin dashboard runs ~8 unbounded table reads and aggregates in TypeScript.

**Impact**  
Admin pages degrade linearly with ledger size; “Load more” still reloads full source data.

**Actionable fix**
1. Push date/project/type filters, order, and limit into SQL/RPC (`UNION ALL` view).
2. Filter archived projects in SQL, not after fetch.
3. Split lightweight metadata endpoints from paginated feed endpoints.

### 11. Missing core indexes + schema source-of-truth drift

**Evidence**
- Core tables live mainly in standalone `schema.sql` / modules; only 10 versioned migrations exist.
- Manpower, labour teams, categories, splits, notifications, assignment-scope, credentials are standalone SQL.
- Fresh migration-only setup cannot recreate production RLS/helpers.
- Repo SQL lacks indexes for common filters (`project_id`, `status`, `expense_date`, assignment lookups).

**Impact**  
Slow queries as data grows; environments diverge; security policies may be absent on fresh DBs.

**Actionable fix**
1. Create a baseline migration for core schema + helpers + RLS.
2. Move standalone modules into ordered migrations; CI `supabase db reset`.
3. Add indexes for projects/expenses/payments/milestones/labour/assignments (see Medium §15).

### 12. Dependency vulnerabilities (12 high)

**Evidence (pnpm audit)**
- Direct `xlsx@0.18.5`: prototype pollution + ReDoS; no patched npm version in audit metadata.
- `next@16.2.6`: multiple highs fixed in `>=16.2.11` (middleware bypass, DoS, SSRF, etc.).
- `recharts` → `lodash@4.17.23` code injection / prototype pollution (fixed in lodash `>=4.18.0`).
- `sharp` / `postcss` highs with newer patches available.

**Actionable fix**
1. Upgrade `next` to `>=16.2.11` immediately.
2. Replace `xlsx` with a maintained parser (e.g. ExcelJS / SheetJS Pro) or isolate parsing in a worker with strict validation.
3. Upgrade/override lodash via recharts resolution, or lazy-load charts less often.
4. Bump `sharp`/`postcss` to patched versions; re-run `pnpm audit`.

### 13. Project detail first-load JS is ~2.16 MB

**Evidence**
- `project-detail-content.tsx` statically imports all tabs.
- `expenses-tab.tsx` statically imports all of `xlsx`.
- `reports-tab.tsx` statically imports Recharts.
- No `next/dynamic` / `React.lazy` usage found.
- Bundle stats: `/projects/[id]` ≈ 2,164,598 uncompressed first-load bytes; `/engineer` and `/admin/expenses` also >1.1 MB.

**Impact**  
Opening Overview/Design still downloads spreadsheet + chart code and inactive tabs.

**Actionable fix**
1. Dynamically import inactive tabs.
2. Dynamic-import `xlsx` inside the import handler only.
3. Load `ReportsTab` only when `activeTab === "reports"`.

---

## Medium

### 14. Expense metric sync fans out one update per milestone

**Evidence**
- `syncMilestoneExpenseMetrics` reads all milestones/expenses and `Promise.all` updates each milestone (`lib/projects/tab-actions.ts`).
- Called from create/bulk/update/status/delete and split flows.

**Actionable fix**  
Recompute affected milestones only, or one SQL aggregate `UPDATE ... FROM (SELECT ...)`.

### 15. Recommended indexes (missing from repo SQL)

Add a migration for:
- `projects(status, created_at desc)`
- `projects(pm_id, status)`, `projects(customer_id, status)`
- `project_engineers(engineer_id)`
- `milestones(project_id, sort_order)`
- `expenses(project_id, status, expense_date desc)`
- `expenses(project_id, milestone_id, status)`
- `client_payments(project_id, status, received_date desc)`
- `vendor_payments(project_id, status)`
- `additional_works(project_id, approval_status)`
- `labour_entries(project_id, entry_date)`

### 16. Profile PII enumerable by any signed-in user

**Evidence**
- `profiles` SELECT policy `USING (true)`.
- `/api/staff-profiles` returns staff/customer contact fields to any authenticated user.

**Actionable fix**  
Restrict SELECT / API to admin/PM or project-connected profiles only.

### 17. Expense split group RLS is globally staff-wide

**Evidence**
- `expense-splits-module.sql` allows any admin/pm/engineer on all split groups without project assignment checks.

**Actionable fix**  
Scope with `user_can_access_project(project_id)` and role-specific mutation limits.

### 18. Dead product code + duplicate UI patterns

**Unused product files (knip + import search)**
- `components/dashboard/charts.tsx`, `payment-tables.tsx`, `stat-widgets.tsx`
- `lib/data/projects.ts`, `lib/project-context.tsx` (demo context; also causes TS errors)
- `components/forms/keyboard-select-field.tsx`
- `styles/globals.css` (app uses `app/globals.css`)
- ~30 unused shadcn `components/ui/*` leftovers + unused Radix/form deps

**Near-duplicates (live)**
- Expense intent entry: `add-expense-menu`, keyboard type/company pickers, project picker
- Metric presentation: `MetricCard` vs dashboard `MetricTile` vs dead `StatWidget`

**Actionable fix**
1. Delete confirmed unused dashboard/context/CSS files in a cleanup PR.
2. Unify expense-intent config shared by menu + keyboard flows.
3. Trim unused shadcn/Radix deps only if not planning CLI generation soon.

### 19. Middleware auth cost on nearly every request

**Evidence**
- Root middleware runs Supabase `getUser` + profile lookup broadly.
- Many API handlers then repeat authorization (`requireAdmin`, role checks).

**Actionable fix**  
Narrow matcher for static/public assets; cache profile role briefly per request; avoid duplicate profile fetches in handlers that already trust middleware headers (carefully).

### 20. Lint tooling broken

**Evidence**
- `package.json` script `"lint": "eslint ."` but eslint is not a dependency.

**Actionable fix**  
Install/configure ESLint for Next 16, or remove the script until configured. Add CI lint.

---

## Low

### 21. Material Intelligence tables are historical artifacts only

**Evidence**
- Created then dropped in migrations (`20260530120000_*`, `20260530160000_*`, `20260530200000_drop_*`).
- Standalone `material-*-module.sql` files remain.
- No app references under `app/`, `lib/`, `components/`.

**Actionable fix**  
Keep historical migrations; archive/delete standalone module files; confirm production applied the drop.

### 22. No confirmed wholly unused *live* business table

Active modules (manpower, labour teams, categories, splits, notifications, telegram, company/personal finance, design, credentials) are referenced.  
`user_credentials` is used but should be removed for security (Critical §3), not because it is dead.

### 23. Unused exports / types noise

Knip reports many unused exports (helpers, select constants, permission helpers). Prefer deleting only clearly abandoned public APIs; keep shared library exports that are part of intentional module surfaces.

---

## Suggested fix order

1. **Security first:** close public admin signup, lock profile role column, drop plaintext credentials, require Telegram webhook secret, tighten expense/storage RLS.
2. **Stop shipping blind:** fix TS errors, remove `ignoreBuildErrors`, upgrade Next to `>=16.2.11`.
3. **Stop the refetch/overfetch:** fix expense-shortcut deps; add project summary endpoint; slim list selects.
4. **Admin scale:** SQL-filter/paginate money timeline + all-expenses; add core indexes; consolidate schema into migrations.
5. **Bundle:** dynamic-import tabs/xlsx/recharts; delete dead dashboard files; replace or isolate `xlsx`.

---

## Out of scope / cannot prove from repo alone

- Live production table sizes, EXPLAIN plans, and whether standalone SQL modules were applied.
- Whether Supabase Dashboard Auth settings already disable public signup.
- Runtime presence of `TELEGRAM_WEBHOOK_SECRET` in deployed env.
