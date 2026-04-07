# SîpFlõw (Kaada) - Drink Ordering & Management System

## Overview
A Next.js multi-tenant café/social space drink ordering and management system. Each café location (Place) has isolated data. Customers browse a categorized menu (Hot/Cold/Shisha), place orders with notes, and get assigned a table. Staff manage orders via a dashboard. Admins manage drinks, users, inventory, send broadcast messages, and view revenue analytics. A developer admin manages all places (create/toggle/delete).

## Architecture
- **Framework:** Next.js 16.2.0 (App Router, Turbopack)
- **Language:** TypeScript
- **Database:** PostgreSQL (Replit built-in) via `pg`
- **Styling:** Tailwind CSS 4.0 + Shadcn/UI (Radix UI)
- **Data Fetching:** SWR (polling every 3-10s for real-time updates)
- **Port:** 5000

## Key Routes
- `/` — Main interface (place selection → login → menu/orders/admin)
- `/staff` — Staff dashboard for managing and completing orders
- `/reserve/[placeCode]` — Public table reservation page (accessible to anyone with link)
- `/api/places` — CRUD for café locations + `?code=xxx` lookup
- `/api/places/[id]` — PATCH / DELETE a specific place
- `/api/reservations` — GET (by place_id) / POST reservations
- `/api/reservations/[id]` — PATCH status / DELETE a reservation
- `/api/*` — Backend API routes (drinks, inventory, messages, orders, sessions, staff, users) — all place_id filtered

## Multi-Tenant Flow
1. User opens app → Place Selection screen (enter place name/code)
2. Place looked up via `/api/places/lookup?code=XXX` → stored in `localStorage` as `qa3da_place`
3. Normal login → all data is filtered by `place_id`
4. Developer admin logs in via 🔧 Admin VIP link using name + hardcoded password → sees all places, can manage them via "الأماكن" tab

## Authentication
- **Developer admin:** name (any) + password `Basem.s.ebeid#@55!` — sets `isDevAdmin=true`, bypasses place selection, auto-navigates to admin panel
- **Place admin (role=admin):** normal login within a place, sees ⚙️ Settings button (asks username+password to verify)
- **Staff (role=order_receiver):** normal login, sees receipt tab only
- **Default dev DB credentials:** admin `admin`/`admin123`, staff `staff`/`staff123`

## Database
Uses Replit's built-in PostgreSQL. Schema managed via migrations in `scripts/`.
- `scripts/008_full_rebuild.sql` — base schema
- `scripts/009_add_places.sql` — multi-tenant places migration
- `scripts/010_fix_users_unique.sql` — remove unique constraint on users.name

### Tables
- `places` — Café locations (id, name, code, description, is_active, logo_url)
- `drinks` — Menu items (with place_id FK)
- `inventory` — Stock levels per drink
- `users` — Customer accounts (with place_id FK, no unique on name)
- `staff_users` — Staff login accounts (with place_id FK)
- `sessions` — Daily ordering sessions (with place_id FK)
- `orders` — Customer orders with status tracking
- `admin_messages` — Broadcast messages (with place_id FK)
- `app_settings` — Key-value config store

## Environment Variables
All managed as Replit secrets:
- `DATABASE_URL` — PostgreSQL connection string (auto-managed by Replit)
- `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE` — Also auto-managed

## Development
The workflow runs `pnpm run dev` which starts Next.js on port 5000 at `0.0.0.0`.

## Key Features
- **Multi-tenant:** Each café is isolated by `place_id` throughout entire stack
- **Shisha tab:** Shows any drink with "شيشة" in its name OR category='shisha'
- **Thermal receipt:** Realistic creamy-background receipt with barcode (staff only see user receipt)
- **Session persistence:** User login saved in `localStorage` (key: `qa3da_user`), place in `qa3da_place`
- **Order notes:** Per-drink notes when submitting an order
- **Inventory decrement:** Placing an order auto-decrements inventory
- **Image uploads:** Saved to `public/images/uploads/`
- **APP_VERSION:** Currently `1.9` — bump on each deploy
- **Place admin management:** Dev admin can assign, edit (name/password), or delete place admins from the Places tab
- **Admin VIP login:** Dev admin login requires name + password; auto-redirects to admin panel
- **QR Code Manager:** Admin panel cashier tab has a QR code manager — shows QR per table + print all QRs for a place. QR links to `/?place={code}&table={num}`
- **Table Reservations:** `reservations` DB table, `/api/reservations` API, `/reserve/[placeCode]` public booking page (Arabic RTL dark gold UI). Dev admin can enable/disable per place, view/confirm/cancel/delete reservations + see public booking QR
- **Dev activity notifications:** `dev_notifications` table, fires on add/edit/delete drink, add staff, update fees; dev admin sees live list + badge
- **Service charge & tax:** `calcTotals(subtotal, sc, tr)` computes fees; shown on receipt; per-place settings in admin panel cashier tab

## Version History
- 1.5 — Thermal receipt redesign + shisha tab fix
- 1.6 — Full multi-tenant Places system
- 1.7 — Dev admin login with name+password, place admin edit/delete, ⚙️ button restricted to place admins only, Admin VIP branding
- 1.8 — Service charge & tax fees, SîpFlõw logo on receipt, dev admin notifications
- 1.9 — QR code manager for tables + full table reservation system
