---
name: Sessions FK violation fix
description: The sessions table has a FK constraint to places; creating a session with a non-existent place_id crashes with error code 23503.
---

**Rule:** The `GET /api/sessions` route must catch error code `23503` (FK violation) and return a 400 with a clear Arabic message instead of a 500.

**Why:** On fresh installs, the places table may be empty. If a stale place_id is in localStorage, the sessions route tries to create a session and crashes.

**How to apply:** Wrap `createSession()` call in try/catch; if `err.code === '23503'`, return 400 "المكان المحدد غير موجود".
