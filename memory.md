# TechBill POS System - Project Memory

## Architecture Overview
- **Backend (`techbill-api`)**: NestJS, Prisma ORM, PostgreSQL (local VM). Hosted on an Azure VM at `4.193.188.145`.
- **Frontend (`techbill-pos`)**: React, Vite, Zustand, TailwindCSS, React Router. Hosted on Vercel with auto-deployment on push to the `master` branch.
- **Database**: Local PostgreSQL on the VM — `localhost:5432`, DB = `techbill_db`, user = `techbill_admin`, password = `TechBillSecurePass2026!`. **NOT Supabase.**

## Canonical Repo & VM Info
- **GitHub**: `https://github.com/krishbaresha/Tech-Bill` ← the ONLY correct repo
- **VM Host**: `4.193.188.145` | User: `techbill_admin` | Password: `Office#1234_h`
- **API Path on VM**: `/home/techbill_admin/techbill/electrotrack-api/techbill-api`
- **PM2 App Name**: `electrotrack-backend`
- **Old stale remote** `talharana23/test-techbill` — deleted, never use it

## Key Workflows & Scripts

### Remote VM Deployment
Standard deploy workflow:
1. Make changes locally
2. `git add` + `git commit` + `git push origin master`
3. SSH to VM → `git pull origin master`
4. `npx prisma db push --accept-data-loss` (if schema changed)
5. `npm run build`
6. `pm2 restart electrotrack-backend`

For SSH automation, use scripts in `scratch/` (e.g. `vm_run.js`, `fix_additional_charges.js`).

### WebSocket Events
Real-time updates are handled via `EventsGateway`. 
- `sale.created` event is emitted when a sale succeeds.
- Frontend components (like `SalesFeed.tsx` and `OwnerDashboard.tsx`) subscribe to this via `socket.on('sale.created')` to update live metrics and feeds.

## Important Fixes & Recent Work

### 1. Concurrency & Race Conditions
- Refactored `sales.service.ts` to implement strict atomic `updateMany` locking for generic products when pulling stock for a sale.
- Ensured idempotency by checking `idempotencyKey` via `@unique` constraints in the database, avoiding double-charges for duplicate API requests.

### 2. POS Offline / Session Issues
- Fixed `CashDrawerSession` bug where an active sessionId was incorrectly strictly required in some environments. The POS backend now auto-assigns an open drawer session to a user if one is not explicitly provided in the payload.

### 3. Dashboard Visibility Bug
- The "Starter" subscription feature gate was incorrectly wrapping the *entire* `OwnerDashboard` container (`inset-0 absolute z-30`), thus obscuring basic business metrics like "Total Sales", "Items Sold", and "Discounts Given".
- Moved the feature gate paywall down to explicitly lock *only* the advanced analytics (`SalesChart`, `StockAlerts`, `SalesFeed`, and `AiInsights`), leaving the basic summary visible to all users.
- Connected the Dashboard Summary to the WebSocket `sale.created` payload so that POS sales immediately update the main dashboard stats in real-time.


### 4. Mistaken Action Deletions & IP Logging
- Added `trust proxy` in NestJS to properly retrieve and record actual IP addresses (e.g. `req.ip` via Nginx) rather than local proxy loops like `::ffff:127.0.0.1` in Audit Logs.
- Implemented a 24-hour hard-delete window for the Owner role to permanently delete mistakenly created Sales, Returns, and Online Orders.
- Deleting an invoice or return gracefully restores the associated inventory items (from `sold` back to `in_stock`, and vice versa) and recursively recalculates parent sale statuses (e.g. reverting a Sale to `completed` if its last return is deleted).

### 5. Purchase Orders & Inventory Enhancements
- Removed the redundant GRN (Good Receipt Note) flow.
- Purchase Orders now auto-create suppliers if they don't exist and integrate directly into the gross profit deduction.
- Inventory restocking now happens automatically upon receiving a Purchase Order, including manual and auto serial number generation support.

### 6. Expenses & Net Profit Reporting
- Standard daily expenses (e.g. lunch, supplies) are now separated from Purchase Order costs in `reports.service.ts`.
- Implemented a true `Net Profit` calculation (`Gross Profit - Expenses`) which surfaces directly on the `OwnerDashboard` and `ReportsPage`.
- Added dynamic real-time summation of expenses on the `ExpensesPage` header for quick visibility.
- Added **"Personal Expenses"** as a selectable category in the Expense form (between Maintenance and Adjustment / Shortage).

### 7. Dashboard Expense Timezone Bug (Critical Fix)
- **Root Cause**: The `Expense` model uses a PostgreSQL `@db.Date` column (date-only, no time). The `buildSummary` method was passing full timestamp ranges (e.g. `2026-07-13T19:00:00Z` to `2026-07-14T18:59:59Z`) to filter expenses. PostgreSQL strips the time portion when comparing against a `DATE` column, causing it to match `>= 2026-07-13` — bleeding previous day's expenses into today's dashboard.
- **Fix**: Separated the date window for expense/reconciliation queries from the timestamp range used for sales. Expenses are now queried using exact UTC midnight boundaries (e.g. `date = 2026-07-14T00:00:00Z`), strictly isolating them to the correct calendar day.
- **Files Changed**: `techbill-api/src/modules/reports/reports.service.ts` — `buildSummary()`, `getTodayReconciliationState()`, `submitReconciliation()`.

### 8. Additional Charges Bug Fix (Session 6 — July 14, 2026)
- **Root Cause (3 parts)**:
  1. `sales` DB table had no `additional_charges` or `description` columns — they were never in the Prisma schema.
  2. `sales.service.ts` total calculation ignored `additionalCharges` (`total = subtotal - discount + deliveryCharge` — missing `+ additionalCharges`).
  3. `sale.create()` data block never included `additionalCharges` or `description` fields.
- **Symptoms**: Additional charges showed correctly on the POS form UI but were silently dropped on submit — not stored in DB, not reflected in invoice total.
- **Fix**:
  - Added `additionalCharges` and `description` to `Sale` model in **both** `prisma/schema.prisma` (root) and `techbill-api/prisma/schema.prisma` (API-level — the one CI uses).
  - Fixed total calculation: `const additionalCharges = dto.additionalCharges ?? 0; const total = subtotal - discount + deliveryCharge + additionalCharges;`
  - Added both fields to `tx.sale.create({ data: { ... } })`.
  - Applied `npx prisma db push --accept-data-loss` on VM to add the DB columns.
- **CI Fix**: GitHub Actions CI was failing because only `techbill-api/prisma/schema.prisma` is used during CI build — fixing the root `prisma/schema.prisma` alone was not enough.
- **VM Git Remote Fix**: VM's git remote was pointing to the old deleted repo `talharana23/test-techbill`. Updated to `krishbaresha/Tech-Bill` permanently via `git remote set-url origin`.
- **Commits**: `3d0730d` (service + root schema fix), `805f746` (API schema fix for CI).

### 9. Credit Feature Re-write & Payment Logistics (Session 7 — July 15, 2026)
- **Root Cause**: The Credit section strictly required `supplierId` and `customerId` via dropdown selectors, which limited the user's ability to input generic "Person / Party" names. Additionally, recording a credit payment merely updated the `paidAmount` on the parent `CreditRecord` without tracking *when* the payment was made, preventing credit payments from appearing in daily reports.
- **Fix**:
  - Replaced all selector dropdowns in `CreditPage.tsx` with open text `<input type="text">`.
  - Added `personName` column to `CreditRecord` (`schema.prisma`) to store the free-text name while retaining nullable foreign keys for backwards compatibility.
  - Removed "Supplier" label in favor of generic "Person / Party" terminology across UI and analytics cards.
  - Added `CreditPayment` model to strictly log every payment (`amount`, `date`) via a Prisma transaction inside `credit.service.ts`'s `recordPayment()`.
  - Upgraded `reports.service.ts` to seamlessly integrate credit payments based on their exact payment date: "Customer Owes Us" payments explicitly **add** to daily `Revenue`, and "We Owe" payments explicitly **add** to daily `Expenses` (which correctly lowers Net Profit dynamically).
- **Commits**: `6f4549e`, `d1b4eb3`

## Known Gotchas
1. **Two schema files**: `prisma/schema.prisma` (root, used for local VM tunnel scripts) AND `techbill-api/prisma/schema.prisma` (API-level, used by CI and the actual NestJS build). **Always update BOTH** when changing the DB schema.
2. **Timezones**: The `createdAt` timestamps in Prisma rely on UTC. The Node API correctly translates local date requests (e.g. `start = new Date('2026-07-11T00:00:00+05:00')`) into UTC for database querying. Do not manually subtract timezone hours unless absolutely necessary, as `Date` handles it internally.
3. **PM2 Restarts**: Always remember to run `pm2 restart electrotrack-backend` after updating code on the VM or pushing Prisma client updates.
4. **`@db.Date` vs Timestamp Filtering**: When querying models with `@db.Date` fields (e.g. `Expense`, `CashReconciliation`), do NOT use timezone-offset timestamps as range filters. PostgreSQL will ignore the time part and bleed into adjacent days. Always use exact UTC midnight dates (e.g. `new Date('2026-07-14T00:00:00Z')`) as both `gte` and `lte` to match a single day.
5. **VM Schema Sync**: Use `npx prisma db push --accept-data-loss` on the VM (NOT `migrate dev`) since the VM has a local PostgreSQL DB. `migrate dev` requires interactive prompts and a `DIRECT_URL` that differs from pool URL.
6. **VM Git Remote**: The VM's `origin` remote must always point to `https://github.com/krishbaresha/Tech-Bill.git`. It was previously stale pointing at `talharana23/test-techbill` (deleted). If a git pull fails, check remote with `git remote -v` and fix with `git remote set-url origin https://github.com/krishbaresha/Tech-Bill.git`.

*Last Updated: July 15, 2026 — Session 7*

