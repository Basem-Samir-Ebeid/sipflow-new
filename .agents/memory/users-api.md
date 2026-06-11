---
name: Users API graceful empty response
description: GET /api/users without place_id should return [] not 400, to prevent browser console errors on initial load.
---

**Rule:** `GET /api/users` with no `place_id` returns `[]` (200) instead of 400. Security is maintained because without a place_id the result is always empty.

**Why:** SWR in page.tsx fires before currentPlace is loaded from localStorage on first render, causing a 400 in the browser console.

**How to apply:** `if (!placeId) return NextResponse.json([])` at the top of the GET handler.
