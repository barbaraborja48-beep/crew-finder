# PinGü

PinGü (penguin + pin) is a private web app for a small friend group (4 to 12 people) to find each other at a festival with bad signal. Built from the "Crew Finder" design handoff, first target **Elrow Halloween Takeover, Recinto Iberdrola Music, Madrid, 31.10.26**.

Tap where you are on the venue map or a stage floor. Your dot glows in your laser color and fades over 2:30. Tap again nearby to extend it, and get bonus time when a friend is close. Everything queues offline and sends the moment there's any signal. Bars, food trucks and picnic areas have their own close-ups drawn to their real shape and size. There's also a crew chat that doubles as the night's history (every check-in, status change and join), a profile with name, color, status and notes, ghost mode, SOS, push notifications, and an iOS Shortcut for one-tap check-ins.

**To get it running, follow [SETUP.md](SETUP.md).**

## Stack

- Vite + React + TypeScript, plain CSS with the Nocturne tokens (`src/styles.css`)
- Installable PWA (`vite-plugin-pwa`): app shell, icon fonts and the venue map are precached, so it opens with zero signal
- Supabase: Postgres + row-level security, anonymous auth, Realtime, Storage
- IndexedDB (`idb`) for the offline outbox and a snapshot of crew data

## How it fits together

| Piece | Where |
| --- | --- |
| Check-in rules (2:30 life, merge within 34 px, +1:00, +0:30 friend near, 10:00 cap, 20% slower fade) | `src/lib/rules.ts` (unit tested in `rules.test.ts`) |
| Offline outbox; one-request delta sync (`crew_sync`), data saver (no socket, 60 s checks, notification-triggered), falls back to the older per-table sync if the DB isn't updated | `src/lib/store.ts`, `supabase/migrations/…_low_data_sync.sql` |
| Text-message fallback for check-ins and SOS when there's no data | `src/lib/sms.ts`, `SmsFallback` in `src/components/common.tsx` |
| Photo compression (≤1280 px, JPEG q0.6, ~150 KB) | `src/lib/photo.ts` |
| Screens: Map, Check in (stage floor), Chat, Crew, Find, Status sheet, SOS, Shortcut setup, onboarding | `src/screens/` |
| Schema, RLS, RPCs (`create_crew`, `crew_preview`, `join_crew`, `quick_checkin`, `purge_old_crews`), storage bucket, cron | `supabase/migrations/…_crew_finder.sql` |
| Elrow venue + places (image-pixel coords on a 1214×1520 map) | `supabase/migrations/…_seed_elrow.sql`, `public/assets/elrow-map.webp` |
| All 8 bars, picnic areas, food truck row with real shapes; profile rules; chat history; push tables + trigger | `supabase/migrations/…_map_profile_push.sql` |
| Push sender (Web Push, VAPID keys made on first use, hook secret) | `supabase/functions/push/index.ts` |
| Notification display + tap-to-open | `public/push-sw.js`, `src/lib/push.ts` |

### Privacy model

No accounts. Each device signs in anonymously, then joins a crew with an 8-character invite code. RLS only lets you read your own crew's rows and only write your own check-ins and messages. The Shortcut secret lives in a separate table nobody can read directly. Rejoining a crew with the same name moves that member to the new device, because an iPhone Home Screen app doesn't share storage with Safari.

### Sync

Every write is saved to IndexedDB, shown immediately, and sent by a loop. Rows use client-generated UUIDs and upserts, so retries never duplicate. A newer write to the same row replaces the queued one. Photos upload separately and last.

Each sync is a single `crew_sync` call: it carries everything queued (compact keys) and returns only rows changed since the last cursor (compact arrays), plus the venue only when its hash changed. Measured with a crew of 6 and a full night of history, with the live connection down: idle on the map went from about 6.7 MB/hour (96 requests per 3 min) to about 0.1 MB/hour (6 per 3 min); 3 check-ins plus a message went from 22 requests/42 KB to 4 syncs/~9.5 KB.

## Develop

```bash
npm install
cp .env.example .env.local   # fill in your Supabase URL + publishable key
npm run dev
npm test                     # check-in rule tests
npm run build                # production build + service worker
```

`supabase/tests/` has a SQL test of every RLS policy and RPC. It runs on plain Postgres: load `supabase_stub.sql`, then all migrations, then `rls_and_rpc.sql` (six `ERROR` lines expected, each a blocked action), `push_and_profile.sql` (five expected), `low_data_sync.sql` or `pingu.sql`.

## Not in the web version

Background location, Bluetooth proximity, UWB precision arrow, interactive WidgetKit widgets and Live Activities need a native SwiftUI app (see the design handoff, "Native later"). Venue setup (upload a map, place pins) is also not built yet, because Elrow ships with seeded places.
