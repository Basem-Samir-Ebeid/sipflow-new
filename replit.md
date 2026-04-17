# SîpFlõw (Kaada) - Drink Ordering & Management System

## Overview
A Next.js multi-tenant café/social space drink ordering and management system. Each café location (Place) has isolated data. Customers browse a categorized menu (Hot/Cold/Shisha), place orders with notes, and get assigned a table. Staff manage orders via a dashboard. Admins manage drinks, users, inventory, send broadcast messages, and view revenue analytics. A developer admin manages all places (create/toggle/delete).

## Known Fix — Price Type Coercion
PostgreSQL returns DECIMAL/NUMERIC columns as strings (e.g., `'15.00'`). All `drink.price` references across the codebase use `Number()` conversion before arithmetic, comparisons, and `.toFixed()` calls. This prevents `TypeError` crashes in DrinkCard and other components.

## Recent Features (v2.6 — Subscriptions System)
- **نظام الباقات والاشتراكات:** تبويب جديد "الاشتراكات" في لوحة الأدمن المطور (وسيلز أدمن). كل مكان له باقة: مجانية / شهرية / سنوية / بريميوم. كل باقة تحدد: عدد الطاولات، الموظفين، المنتجات، تفعيل الحجوزات، تفعيل التقارير. مع تاريخ انتهاء قابل للتخصيص وتنبيه قبل 7 أيام من الانتهاء.
- **Database:** أعمدة جديدة في جدول `places`: `subscription_plan` (free/monthly/yearly/premium)، `subscription_expires_at`.
- **API:** `GET /api/subscriptions` و `PATCH /api/subscriptions` لقراءة وتحديث اشتراكات الأماكن.
- **الصلاحيات:** `super_developer` و `sales_admin` لهم وصول لتبويب الاشتراكات.

## Recent Features (v2.5 — Developer Permissions)
- **Advanced Developer Permissions:** Developer admin login now supports roles: Super Developer (full access), Support Admin (support/live/messages overview), Sales Admin (clients/places/reservations), and Finance Admin (revenue/analytics/cashier/count). Existing `ADMIN_SECRET` / `dev_admin_password` login remains Super Developer. The developer admin panel no longer shows the main Command Center tab.
- **Dev Admin Accounts:** Super Developer can manage additional developer admin accounts from the new "الصلاحيات" tab. Accounts are stored in `app_settings.dev_admin_accounts` with hashed passwords and role metadata.

## Recent Features (v2.4 — Live Command Center)
- **مركز التحكم (Command Center):** Dev admin's default tab — real-time overview of all active places. Shows global stats (total places, orders, revenue, active tables), per-place health indicators (green/yellow/red pulse), order counts by status, revenue, waiter calls. Auto-refreshes every 5 seconds. Violet/indigo theme. Recent activity feed with live notifications. API: `GET /api/command-center` (auth-protected via `x-admin-secret` header).
- **ويدجت شاشة البداية للمطور:** Replaced the old numeric system-status block on the landing screen with a private "لوحة التشغيل الهادئ" panel. It no longer displays places, order counts, pending orders, or revenue on the public landing view.

## Recent Features (v2.3 — Admin UI Refresh)
- **شاشة ترحيب المطور:** Violet/indigo command-center aesthetic — animated spinning ring, "secure session" badge, "ACCESS GRANTED" glow, 2×2 status cards, terminal-style log line.
- **شاشة ترحيب أدمن المكان:** Warm amber theme — spinning ring around café icon, "PLACE ADMIN" badge, 2×2 status cards, rounded corner frames. Simpler but cohesive with dev admin design.
- **Header أدمن المطور محسّن:** Live clock, grid overlay, animated sweep, 4 stat cards, quick actions strip, ping indicator.
- **Header أدمن المكان محسّن:** Dark amber gradient, place name + icon, 3 stat cards (drinks/users/orders), "ADMIN" badge, connection status bar.
- **Tab bars محسّنة:** Both admin types now use horizontal scrollable bars. Dev admin has colored group labels; place admin has amber/emerald/sky themed groups with separators.

## Recent Features (v2.2 — Dev Admin Exclusives)
- **البنر العالمي:** Dev admin can enable a global announcement banner (Settings tab) with custom text and 4 color themes. Banner appears at the top of the customer page (sticky, dismissable) using `global_banner_enabled/text/color` app_settings keys.
- **رسالة جماعية:** Dev admin can broadcast a titled message to all places simultaneously (Messages tab). POSTs to `/api/messages` for each place in parallel.
- **نسخ مكان:** Dev admin can clone any existing place (Places tab) — copies all metadata + drinks to a new place with a custom name/code. New API endpoint `POST /api/places/clone`.
- **ضغط البيانات:** Dev admin can bulk-delete old sessions & orders older than 1/3/6/12 months across all places (Danger tab). Extended `POST /api/reset-data` with `action: 'delete_old'`.

## Recent Features (v2.1)
- **نداء النادل (Call Waiter):** Customers with a table number see a "🔔 اطلب النادل" button in the tracker widget while orders are active. 60-second cooldown after each call. POSTs to `/api/messages` with title "🔔 نداء نادل". Waiter page polls messages every 10s, plays sound for new calls, and shows dismissable indigo notification cards with a badge count in the header.
- **طباعة الفاتورة (Print Receipt):** Customers see a "🖨️ اطبع فاتورتك" button in the tracker widget when all orders are delivered. Triggers existing receipt modal (`setShowReceipt(true)`).
- **وضع المكان مغلق (Closed Mode):** Place admin can toggle open/closed in Settings tab. When closed, saves key `place_closed_${placeId}=true` via `/api/settings`. Customer page fetches this on load; when closed, shows a full-screen red overlay blocking the menu. Admin can set a custom closure message stored as `place_closed_message_${placeId}`.
- **Order Rating System:** Customers see 1-5 star rating widget in the order tracker after all orders are delivered. Ratings stored in DB and displayed in cashier report tab with avg + distribution chart.
- **WhatsApp Notifications:** Customer enters optional phone number when ordering. When bar marks order ready, a popup appears with a WhatsApp button linking to `wa.me/<phone>?text=...` to notify the customer.
- **DB additions:** `orders.rating` (smallint), `orders.rating_comment` (text), `orders.customer_phone` (text)

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
4. Developer admin logs in via 🔧 Admin VIP link using name + password → receives role-based access to the allowed developer tabs

## Authentication
- **Developer admin:** name + password. Existing `ADMIN_SECRET` or `app_settings.dev_admin_password` grants Super Developer. Additional named accounts are stored in `app_settings.dev_admin_accounts` with hashed passwords and roles (`super_developer`, `support_admin`, `sales_admin`, `finance_admin`). Successful login sets a server-managed HTTP-only session cookie for protected admin actions.
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
- `ADMIN_SECRET` — Server-side developer admin fallback password. Do not expose this as a `NEXT_PUBLIC_*` variable.

## Development
The workflow runs `npm run dev` which starts Next.js on port 5000 at `0.0.0.0`.

## Replit Migration
- Dependencies have been installed from the existing `package.json`/`package-lock.json` setup.
- The Replit PostgreSQL database has been initialized using the existing project migration scripts, including the multi-tenant, reservations, company employee, subscription, and app settings tables.

## Recent UI Update
- The entrance screen system status card was redesigned into a dark "لوحة التشغيل الهادئ / CONTROL MODE" panel with private mode, readiness status, secure entry, smart routing, and instant operation indicators.

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
