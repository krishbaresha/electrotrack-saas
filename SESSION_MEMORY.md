# TechBill — Project Session Memory Log

This document serves as the persistent memory of all active configurations, placeholders for credentials, infrastructure architecture, and session history for the **TechBill POS & ERP SaaS** application.

---

## 🖥️ VM & Infrastructure Configuration

### Azure VM Details
*   **Public IP**: `<VM_HOST_IP>`
*   **Operating System**: Ubuntu 24.04.1 LTS
*   **SSH Username**: `techbill_admin`
*   **SSH Password**: `<SSH_PASSWORD>`
*   **SSH Port**: `22`
*   **Domain (Dynamic DNS)**: `<VM_HOST_IP>.nip.io` (secured with Let's Encrypt Certbot SSL)
*   **Process Manager**: PM2 running NestJS backend as `electrotrack-backend` on port `8000` (proxied by Nginx)

### Production Database Configuration
*   **Type**: Native PostgreSQL 16 (running in Docker container `techbill_postgres`)
*   **Container Port**: `5432` (mapped to VM port `5432`, firewalled from outer internet)
*   **Database User**: `techbill_admin`
*   **Database Password**: `<DATABASE_PASSWORD>`
*   **Database Name**: `techbill_db`
*   **Database URL (from VM context)**: `postgresql://techbill_admin:<DATABASE_PASSWORD>@localhost:5432/techbill_db?schema=public`

### Daily Backups
*   **Backup Script**: `/home/techbill_admin/backup.sh` (triggered by root crontab at **2:00 AM** daily)
*   **Dumps Directory**: `/home/techbill_admin/backups/`
*   **Retention**: 7 days (auto-cleaned to prevent disk bloat)

---

## 🔌 Local Development Tunneling

Since the VM PostgreSQL port (`5432`) is firewalled from the outside internet, local development requires SSH tunneling.

### How to Run SSH Tunnel
Start the tunnel utility from the root workspace directory before starting the API server:
```bash
node scratch/tunnel.js
```
This forwards local port `5432` to VM port `5432`, allowing you to connect locally using Option A in the `.env` database toggle.

---

## 📜 Session History & Log

### Session 1 — Supabase to Azure VM Database Migration
*   **Date**: July 2026
*   **Work Done**:
    - Created the `techbill_postgres` Docker container on the Azure VM.
    - Exported schema/data from Supabase and restored to VM database.
    - Cloned the backend NestJS codebase to the VM (`/home/techbill_admin/techbill/electrotrack-api`).
    - Configured PM2 processes and injected environment secrets.
    - Configured Certbot and Nginx reverse proxy on port 80/443 mapping to port 8000.
    - Cleaned up `@supabase/supabase-js` references from the client POS code.
    - Allowed Vercel origins in NestJS CORS configurations.

### Session 2 — Subdomain Routing, Lockups & Net Profit Calculations
*   **Date**: July 13, 2026
*   **Work Done**:
    - Fixed infinite redirect loop between `techbill.app` login page and tenant subdomains.
    - Implemented secure URL token handoff for subdomain session hydration.
    - Excluded `/auth/logout` from Axios retry interceptors to prevent infinite sign-out loops.
    - Moved the Starter subscription feature paywall down to expose basic summary metrics on the Owner dashboard.
    - Added Net Profit calculation (`Gross Profit - Expenses`) on dashboards and reports.
    - Refactored PO processing to auto-create suppliers and restock inventory, and implemented 24-hour hard-delete window for mistake corrections.

### Session 3 — Database Redirection to VM & Developer Toggles
*   **Date**: July 14, 2026
*   **Work Done**:
    - Added local SSH Tunneling utility (`scratch/tunnel.js`) to bypass firewalls and connect local API to VM database.
    - Created direct diagnostic checker script (`scratch/check_vm_db.js`) to view VM database row counts via SSH.
    - Updated `techbill-api/.env` and `.env.example` to support toggleable database configurations between VM (Option A) and Supabase Cloud (Option B).
    - Documented environment selection and SSH tunnel execution in root `README.md` and `techbill-api/README.md`.
    - Created this `SESSION_MEMORY.md` file.

### Session 4 — Inventory Auditing, POS Fixes, Tenant Licensing & RBAC
*   **Date**: July 14, 2026
*   **Work Done**:
    - **POS & Cart Enhancements**: Fixed POS product click behavior to directly add items to cart, bypassing unneeded modals, and automatically selecting available serial numbers. Implemented POS Quick Add-on Buttons for dynamic additional charges in the cart.
    - **Inventory Management**: Built an Inventory Integrity Center and Dedicated Inventory Summary API. Conducted system audits and synchronization, fixed issues with Inventory Cost Value displaying as Rs 0, and enhanced credit management tracking.
    - **Tenant & Licensing**: Developed a Centralized Tenant Licensing System for managing SaaS subscriptions and implemented Dynamic Role-Based Access Control (RBAC) for fine-grained permissions.
    - **Infrastructure & Stability**: Resolved Prisma `EPERM` generation errors, synced local and remote VM databases, checked and verified VM deployments, and implemented strategies for safely pushing GitHub changes to Vercel and the live VM.
    - **Metrics & Dashboards**: Enhanced Metrics and Credit Tabs to display more accurate and real-time business health indicators.

---

## 🚀 Future Session Objectives & Gotchas
1. **Always run the tunnel**: Ensure `node scratch/tunnel.js` is running when using VM database locally.
2. **PM2 Restarts on VM**: Remember to run `pm2 restart electrotrack-backend` on the VM if prisma schema or `.env` parameters are changed.
3. **Database Migrations on VM**: Always perform schema migrations on the VM using `npx prisma migrate deploy` or `npx prisma db push --accept-data-loss` (requires docker exec or direct database connection from VM shell).
