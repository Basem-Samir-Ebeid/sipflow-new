---
name: Admin password setup
description: dev_admin_password must be seeded in app_settings on fresh installs for developer admin login to work.
---

**Rule:** Any fresh installation must seed `dev_admin_password` into `app_settings`. Without it, `POST /api/dev-verify` returns 500 and the developer admin panel is inaccessible.

**Why:** The route reads the password from `app_settings` table. If the key doesn't exist, login fails silently.

**How to apply:** During migration/setup, run:
```sql
INSERT INTO app_settings (key, value) VALUES ('dev_admin_password', 'admin123')
ON CONFLICT (key) DO NOTHING;
```
