# VRA Homes Codebase Audit

Date: 2026-05-31  
Scope: Next.js App Router application, Supabase schema/migrations, API routes, client components, dependencies, and available build checks.

## Verification run

- `pnpm install --frozen-lockfile`: passed.
- `pnpm exec tsc --noEmit`: failed with existing TypeScript errors.
- `pnpm lint`: failed because `eslint` is not installed even though `package.json` defines `lint`.
- `pnpm build`: passed, but only because `next.config.mjs` skips TypeScript validation.
- `pnpm audit --audit-level moderate`: failed with 3 high and 3 moderate vulnerabilities.

## Critical findings

### 1. Public signup creates administrator accounts

**Evidence**
- `/signup` is public in `lib/supabase/middleware.ts:6`.
- `signUpAdminAction` hardcodes `role: 'admin'` into user metadata in `lib/auth/actions.ts:72-90`.
- `handle_new_user()` trusts `raw_user_meta_data.role` in `supabase/schema.sql:24-38`.

**Impact**  
An unauthenticated visitor can create an admin account and take over the application.

**Actionable fix**
1. Remove public `/signup` or gate it behind a one-time bootstrap token/invite.
2. Disable public Supabase Auth signup for production.
3. Change `handle_new_user()` to ignore client-controlled role metadata and default to `customer`.
4. Create/administer non-customer roles only through a service-role API guarded by `requireAdmin()`.

### 2. Users can self-escalate roles through profile RLS

**Evidence**
- `profiles` self-update policy permits any column update: `supabase/schema.sql:266-269`.
- `profiles` insert policy has no role constraint: `supabase/schema.sql:276-278`.
- Backfill and trigger copy user metadata roles: `supabase/schema.sql:281-287`.

**Impact**  
Any authenticated user can update their own `profiles.role` to `admin` if using a Supabase client or crafted request.

**Actionable fix**
1. Add a `BEFORE INSERT OR UPDATE` trigger that rejects role changes unless `public.is_admin()` is true.
2. Tighten self-insert/update policies to only allow safe profile fields.
3. Move role changes to an admin-only server endpoint with an explicit allowlist.

### 3. Plaintext passwords are stored and returned

**Evidence**
- `user_credentials.password` stores raw passwords in `supabase/add-user-credentials.sql:4-7`.
- Admin users API reads and returns passwords in `app/api/admin/users/route.ts:43-52`.
- Admin users API upserts plaintext passwords in `app/api/admin/users/route.ts:95-102` and `app/api/admin/users/route.ts:173-178`.
- Admin UI models/display-toggles passwords in `app/admin/users/page.tsx:46-74`.

**Impact**  
Database or admin-session compromise exposes reusable credentials.

**Actionable fix**
1. Drop `public.user_credentials`.
2. Stop returning passwords from `/api/admin/users`.
3. Use Supabase Auth Admin password reset or generated one-time passwords shown once at creation.
4. Remove password visibility UI.

## High findings

### 4. Production build hides TypeScript failures

**Evidence**
- `next.config.mjs:3-5` sets `typescript.ignoreBuildErrors = true`.
- `pnpm exec tsc --noEmit` fails in:
  - `app/api/admin/dashboard/route.ts:98`
  - `components/projects/project-detail/milestones-tab.tsx:385`
  - `components/projects/project-detail/payments-tab.tsx:202,250`
  - `components/projects/project-filters.tsx:23,31`
  - `lib/admin-dashboard-data.ts:214`
  - `lib/data/project-fetch.ts:133-140`
  - `lib/projects/invoice-actions.ts:124,156`
  - `lib/providers/auth-provider.tsx:209-228`

**Impact**  
Broken types can ship to production, especially around Supabase response shapes and action contracts.

**Actionable fix**
1. Fix the listed TypeScript errors.
2. Remove `ignoreBuildErrors`.
3. Add a CI step for `pnpm exec tsc --noEmit`.

### 5. Project list API over-fetches full nested graphs

**Evidence**
- `PROJECT_LIST_SELECT` loads projects plus milestones, expenses, client payments, PM profile, and engineers in `lib/data/project-fetch.ts:11-21`.
- `/api/projects` uses that select for list views via `lib/data/project-fetch.ts:53-99`.

**Impact**  
Project list and dashboards scale as `projects x child rows`, increasing Supabase query cost, payload size, and client hydration work.

**Actionable fix**
1. Add a summary select/view for list routes with only table columns needed for cards/filters.
2. Move aggregate metrics to SQL views/RPCs.
3. Keep full nested selects only for `/api/projects/[projectId]`.

### 6. Project detail tabs render and fetch while hidden

**Evidence**
- `TabsContent` only CSS-hides inactive tab content in `components/ui/tabs.tsx:53-65`.
- `ProjectDetailContent` mounts all tabs in `components/projects/project-detail-content.tsx:483-549`.
- `ExpensesTab` statically imports `xlsx` and runs multiple effects/fetches at `components/projects/project-detail/expenses-tab.tsx:103`, `421-480`, `512-514`, and `637-655`.

**Impact**  
Opening a project mounts expenses, payments, milestones, manpower, reports, and photos work even when the user is on Overview.

**Actionable fix**
1. Conditionally render each tab body only when `activeTab` matches.
2. Use `next/dynamic` for heavy tabs.
3. Lazy-import `xlsx` only inside the Excel import handler.

### 7. Admin dashboard and money timeline load unbounded table data

**Evidence**
- Admin dashboard performs multiple broad table reads in `app/api/admin/dashboard/route.ts:43-75` and filters archived projects in JS at `app/api/admin/dashboard/route.ts:94-104`.
- Money timeline loads all received payments and approved expenses in `app/api/admin/money-timeline/route.ts:69-87`, then filters/paginates in memory at `app/api/admin/money-timeline/route.ts:141-143`.

**Impact**  
Dashboard latency and memory use grow with all historical rows.

**Actionable fix**
1. Push archived/date/project filters into SQL.
2. Replace full-table fetches with grouped aggregate SQL views or RPCs.
3. Implement database-level pagination/cursors for money timeline.

### 8. Base RLS policies grant broad staff access

**Evidence**
- `schema.sql` grants admin/PM/engineer broad manage access to projects and child tables in `supabase/schema.sql:291-372`.
- `expense_split_groups` has a broad staff policy in `supabase/expense-splits-module.sql:41-55`.
- Invoice storage policies are role-wide, not project-scoped, in `supabase/expense-invoices-module.sql:168-210`.

**Impact**  
PMs/engineers can access records outside their assignments if assignment-scoped SQL is not applied everywhere, and invoice object access is not project-bound.

**Actionable fix**
1. Fold assignment-scoped access into ordered migrations.
2. Scope split groups and storage object policies by `project_id`.
3. Add a deployment/CI health check that fails if broad staff policies remain active.

### 9. Dependency vulnerabilities

**Evidence**
- `pnpm audit --audit-level moderate` reports:
  - `xlsx`: high prototype pollution and ReDoS advisories.
  - `recharts > lodash`: high code injection and moderate prototype pollution advisories.
  - `postcss`: moderate XSS advisory.
- `xlsx` is imported in `components/projects/project-detail/expenses-tab.tsx:103`.
- Recharts is imported in `components/projects/project-detail/reports-tab.tsx:26`, `components/dashboard/charts.tsx:19`, and `components/ui/chart.tsx:4`.

**Impact**  
Untrusted spreadsheet uploads and chart data increase exposure to parser/library vulnerabilities.

**Actionable fix**
1. Replace `xlsx` with a maintained parser or isolate spreadsheet parsing behind strict size/content validation and a server boundary.
2. Update `postcss` to a patched version.
3. Update Recharts/lodash when patched packages are available; remove dead Recharts code first.

### 10. OAuth callback has an open-redirect risk

**Evidence**
- `app/auth/callback/route.ts:5-13` concatenates `origin` and an unvalidated `next` parameter.

**Impact**  
Attackers can craft post-login redirects using `next` values such as protocol-relative or encoded external paths.

**Actionable fix**
1. Accept only relative paths matching a strict allowlist.
2. Reject values beginning with `//`, containing `:`, or containing backslashes.
3. Default to role-based dashboard routing when invalid.

## Medium findings

### 11. Dead legacy modules and dashboard components

**Evidence**
- `lib/project-context.tsx` exports mock/context state but has no app imports.
- `lib/data/projects.ts` duplicates the project data layer and has no imports.
- `components/dashboard/charts.tsx`, `components/dashboard/payment-tables.tsx`, and `components/dashboard/stat-widgets.tsx` export components with no imports.

**Impact**  
Dead modules increase maintenance cost and keep vulnerable/unused dependencies alive.

**Actionable fix**
1. Delete these files after a final import check.
2. Keep `lib/data/project-fetch.ts` as the canonical project API data layer.
3. Remove dependencies that only supported deleted components.

### 12. Duplicate and unused UI primitives

**Evidence**
- Duplicate toast/mobile hooks exist under both `hooks/` and `components/ui/`.
- The shadcn toast stack is isolated to unused components: `hooks/use-toast.ts`, `components/ui/use-toast.ts`, `components/ui/toast.tsx`, `components/ui/toaster.tsx`.
- Many shadcn primitives appear unused by app imports, including `sidebar`, `chart`, `command`, `carousel`, `drawer`, `form`, `navigation-menu`, `pagination`, `resizable`, `toggle`, and `toggle-group`.

**Impact**  
Large UI files and dependencies increase bundle/build surface and obscure the component set actually in use.

**Actionable fix**
1. Standardize on Sonner for notifications.
2. Delete duplicate toast/mobile files.
3. Remove unused shadcn primitives and prune packages such as `cmdk`, `vaul`, `embla-carousel-react`, `input-otp`, and `react-resizable-panels` if no imports remain.

### 13. Missing database indexes on high-traffic foreign keys

**Evidence**
- Query patterns repeatedly filter by `project_id`, `status`, `expense_date`, `week_id`, `engineer_id`, and profile role.
- Schema files define only a small subset of indexes, for example `expenses_split_group_id_idx` in `supabase/expense-splits-module.sql:35-37`.

**Impact**  
Project-scoped reads and dashboard aggregates will degrade to sequential scans as data grows.

**Actionable fix**
Add indexes aligned to hot paths, for example:

```sql
create index if not exists expenses_project_status_date_idx
  on public.expenses (project_id, status, expense_date desc);
create index if not exists milestones_project_sort_idx
  on public.milestones (project_id, sort_order);
create index if not exists client_payments_project_status_idx
  on public.client_payments (project_id, status);
create index if not exists vendor_payments_project_status_idx
  on public.vendor_payments (project_id, status);
create index if not exists project_engineers_engineer_project_idx
  on public.project_engineers (engineer_id, project_id);
```

### 14. N+1 write patterns in imports, metric sync, and OCR

**Evidence**
- CSV import calls `createExpenseAction()` per row in `components/projects/project-detail/expenses-tab.tsx:1538-1602`.
- Approved expense creation calls milestone sync in `lib/projects/tab-actions.ts:138-140`.
- `syncProjectMilestoneMetrics()` updates milestones one by one in `lib/projects/tab-actions.ts:59-95`.
- OCR line items are inserted one by one in `lib/invoices/apply-extraction.ts:52-68`.

**Impact**  
Bulk imports and invoice processing perform unnecessary round trips and repeat expensive recalculations.

**Actionable fix**
1. Add a batch expense import server action.
2. Sync milestone metrics once per batch.
3. Replace per-line OCR inserts with one bulk `.insert(itemsArray)`.
4. Move milestone aggregate recalculation to SQL where possible.

### 15. Staff and customer PII is broadly readable

**Evidence**
- `profiles` SELECT policy allows all authenticated users: `supabase/schema.sql:263-264`.
- `/api/staff-profiles` returns staff/customer profile details to any signed-in user in `app/api/staff-profiles/route.ts:16-36`.

**Impact**  
Customers and engineers can enumerate emails, phone numbers, and company names beyond their assigned projects.

**Actionable fix**
1. Restrict `profiles` read policy to self, admins, and shared-project participants.
2. Replace broad profile reads with a limited `staff_directory` view.
3. Gate `/api/staff-profiles` to admin/PM roles or assignment-scoped results.

### 16. Upload validation trusts client MIME/extension

**Evidence**
- Validation allows MIME or extension match in `lib/invoices/validate.ts:22-34`.
- Server action uses `file.type` as provided by the browser in `lib/projects/invoice-actions.ts:39-45`.

**Impact**  
Malformed or malicious files can be accepted as invoices and forwarded to OCR.

**Actionable fix**
1. Verify magic bytes on the server (`%PDF-`, PNG, JPEG).
2. Require MIME, extension, and detected content to agree.
3. Consider malware scanning before OCR.

### 17. Invoice OCR sends documents to a third-party model

**Evidence**
- OCR sends invoice file content to OpenAI through AI SDK in `lib/invoices/ocr/extract.ts:50-81`.

**Impact**  
Invoices may contain vendor, pricing, tax, and address data subject to privacy/compliance requirements.

**Actionable fix**
1. Document this data flow and obtain explicit customer/project consent.
2. Add project-level opt-in/opt-out for OCR.
3. Consider redaction or an internal OCR provider for sensitive projects.

## Low findings

### 18. Deprecated Next.js middleware convention

**Evidence**
- Build warns that `middleware` is deprecated in favor of `proxy`.
- Current file is `middleware.ts`.

**Actionable fix**  
Migrate `middleware.ts` to `proxy.ts` and export `proxy()` for Next.js 16 compatibility.

### 19. Lint script is broken

**Evidence**
- `package.json:9` defines `"lint": "eslint ."`.
- `pnpm lint` fails with `eslint: not found`.

**Actionable fix**
1. Add ESLint and the appropriate Next/TypeScript config packages, or remove the script if linting is intentionally disabled.
2. Add lint to CI after installation is fixed.

### 20. Weak password rules

**Evidence**
- Admin password update only requires 6 characters in `app/api/admin/users/route.ts:73-74`.

**Actionable fix**  
Require at least 12 characters and enforce Supabase Auth password policy settings.

### 21. Unknown roles default to admin

**Evidence**
- `dashboardPath()` defaults to `/admin` in `lib/auth/actions.ts:23-35`.
- Middleware root redirect defaults to `/admin` in `lib/supabase/middleware.ts:69-80`.

**Actionable fix**  
Redirect unknown roles to `/login?error=invalid_role` or a safe access-denied page.

### 22. SQL source of truth is split and contains stale modules

**Evidence**
- Core modules live as standalone SQL files while `supabase/migrations/` contains only a subset.
- Material intelligence/material purchases scripts remain even though drop migrations exist.

**Actionable fix**
1. Convert all schema changes to ordered migrations.
2. Move obsolete SQL scripts to an archive directory or delete them.
3. Add a fresh-database migration test.

### 23. Duplicate status/type definitions

**Evidence**
- `UserRole` is defined in `lib/types/database.ts:2`, `lib/providers/auth-provider.tsx:15`, and locally in `app/admin/users/page.tsx:44`.
- Status badge logic is duplicated instead of using `PROJECT_STATUS_BADGE`.

**Actionable fix**
1. Re-export shared types from `lib/types/database.ts`.
2. Centralize status badge rendering around `lib/project-status.ts`.

## Recommended remediation order

1. Lock down signup, profile role updates, and plaintext password storage.
2. Fix TypeScript errors, remove `ignoreBuildErrors`, and repair lint tooling.
3. Scope RLS/storage policies to project assignments and migrate all required SQL into ordered migrations.
4. Slim project list/dashboard queries and add high-traffic indexes.
5. Lazy-load project detail tabs and remove full-graph list payloads.
6. Remove dead modules, duplicate UI, stale SQL, and vulnerable unused dependencies.
7. Batch import/OCR write paths and move aggregates into SQL.
