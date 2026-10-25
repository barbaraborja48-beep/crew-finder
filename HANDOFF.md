# PinGü handoff

Read this first in a new chat. It covers what the app is, where everything lives, how Barbara likes to work, what's done, and what's still open (as of 25 Oct 2026).

## Who you're working with

- **Barbara Borja** owns the project. She has a business and marketing background, not a developer's. Her phone is set to Spanish, so give iPhone settings paths in Spanish when they come up.
- **Writing style:** natural and friendly, like explaining something to a smart friend. No em dashes, no corporate jargon, no press-release tone. Short steps, and links she can tap.
- **How she likes to work:**
  - Ask follow-up questions when something's unclear. Number them and include a recommendation, so she can answer with "yes".
  - **Show a preview (screenshots or a short video) before changing the live app.** Build on a branch and only merge to `main` once she says go (or clearly proceeds, for example by asking for the SQL link).
  - She wants speed, especially on event nights.
  - **Venue changes stay venue-specific.** When she asks for changes to Mondo Disko, the Halloween map must not change. She was upset once when it looked like it might, so say explicitly that the other venue is untouched.
- Every SQL change means she has to paste a file into Supabase. Always give her the direct GitHub link to the file on `main`, and say which order to run files in.

## Where things live

| What | Where |
|---|---|
| Code | https://github.com/barbaraborja48-beep/crew-finder (private), branch `main` |
| Live app | Vercel, deploys automatically from `main`: crew-finder-xi.vercel.app |
| Database, auth, storage, push | Supabase project `ryqtifsfmhfzrgkrbxlm` (https://ryqtifsfmhfzrgkrbxlm.supabase.co) |
| App key (public) | Publishable key `sb_publishable_8nB2ZwwUCbB9_QRZXxar2g_aO7lXXwy`, set in Vercel as `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` |
| Push function | Supabase Edge Function `push`, deployed by pasting `supabase/functions/push/index.ts` into the dashboard editor (JWT verification off) |
| Setup guide for Barbara | `SETUP.md` (lists every SQL file in order) |

## What the app is

**PinGü** (penguin + pin) is a phone web app (PWA, added to the Home Screen) that lets a small friend group find each other at a festival or club with bad signal. Each person is a neon cartoon penguin on the venue map.

- **Pins:** tap where you are. Pins never expire. They glow while fresh, fade by 15 minutes (the penguin goes idle with a "z"), and drop off the map after 12 hours. The server stamps time from "how long ago" (`a` in ms), so late or wrong-clock phones still show the right age.
- **Penguins:**
  - Activity follows the type of place you're at: dance at stages, drink at bars, eat at food, wait at the WC or coat check, smoke outside.
  - **Speed shows signal:** faster dancing means a better connection.
  - Each person picks one accessory, and colours can repeat.
  - A small yellow signal badge means that person is in low data mode.
- **Two venues** (picked when someone starts a crew; everyone who joins gets that crew's venue):
  - **Halloween Takeover**, Recinto Iberdrola Music, 31.10.26. A festival map with 5 stages, bars, WC, food trucks and picnic areas. Each stage and shaped area has its own close-up for pinning precisely.
  - **Mondo Disko**, Sala But, Madrid. Two floors (P1 / P2 buttons on the map):
    - **Main map:** tap anywhere and you're pinned instantly, named after the nearest spot, with an Undo button. No filter buttons, no double-tap zoom.
    - **Pin page:** a dance floor seen from the crowd, with the DJ at the top, curved rows (front / middle / back), 3 columns, and front-left / front-right corners. WC and "I'm upstairs" tiles sit beside the DJ screen. Bar, Bar and Outside / smoking buttons sit around the floor's edges.
    - **DJ screen:** lava-lamp aura, NOW PLAYING / UP NEXT, runs off the phone clock. Tap it for the lineup, then swipe to page 2 for the countdown, Shazam and Steps. Shazam and Steps both open a "Coming in PinGü Premium" screen with a 5-star rating and comments.
    - **Floor plans:** `public/assets/mondo-p1.webp` / `-p2.webp`, with the VIP tables erased.
- **Other features:** crew chat (text, location, photos), status and note, ghost mode, SOS (hold the button), ping a friend, meet spot, an iPhone Shortcut for one-touch pins, and an offer to text your spot when a pin is stuck for 30 seconds.

## The two connection modes (newest change, live)

The switch is in the profile (top-right avatar) and applies to that phone only. It's saved in localStorage as `pingu-low-data`.

- **Good connection (default):** a Supabase Realtime live connection, plus a check every 20 s whenever the connection is down. The status line shows a passive "● Live" dot (there's no manual refresh in this mode). If two syncs in a row are slow or fail, or the live connection errors twice, a "Signal's weak here. Switch to low data mode?" hint appears. It never switches by itself.
- **Low data:**
  - No live connection and no timer. The app syncs only when you pin or post, open the app, tap refresh, or a notification arrives.
  - The status line reads "Up to date · HH:MM" and refreshes when tapped.
  - Failed sends retry after 2, 4 and 8 s, then every 15 s. Photos load when tapped.
  - Sets `members.saver = true` (the badge friends see).
  - Tells the server to pause pin and chat notifications for this phone. The switches grey out, and the user's choices are kept locally and restored when they switch back.
- **Notifications:** the server function decides recipients.
  - "Pin notifications" covers new spots and status changes.
  - "Chat notifications" covers messages, photos and shared locations.
  - SOS, pings (to the pinged person only) and meet-spot changes always come through. Meet-spot changes only do this once the push function has been redeployed, see below.

## Database changes (`supabase/migrations`, run in this order)

1. `20261022174557_crew_finder.sql`: base schema, RLS, RPCs
2. `20261022174600_seed_elrow.sql`: Halloween venue and places
3. `20261023120000_map_profile_push.sql`: shapes, profile, chat history, push tables and trigger
4. `20261024120000_low_data_sync.sql`: `crew_sync` one-request delta sync
5. `20261025120000_pingu.sql`: accessory, signal, saver flag, repeat colours
6. `20261026120000_pins.sql`: pins don't expire; server stamps time from age
7. `20261027120000_mondo_disko.sql`: Mondo venue, floors, venue picker
8. `20261028120000_mondo_free_pins.sql`: Mondo zones, real dance floor, smoking area, framing
9. `20261029120000_lineup_feedback_lowsignal.sql`: DJ lineup, `feature_taps` and `feedback` logs (it also limited notifications, which file 10 reverses)
10. `20261030120000_notification_switches.sql`: pin and chat notifications back on, filtered per person

Plus two fixes she already ran: `supabase/fixes/2026-10-23_push_apikey.sql` and `2026-10-23b_push_key_from_db.sql`.

**Status:** Barbara ran 1 to 9. She was just given the link for **10**, so confirm she ran it.

## Open items

1. **Confirm SQL 10 was run.** Without it, pin and chat notifications stay off for everyone.
2. **Redeploy the push function (optional, about 1 minute):** paste the current `supabase/functions/push/index.ts` into Supabase → Edge Functions → push → Code → Deploy. It brings:
   - meet-spot changes reaching everyone ("Name · new meet spot"),
   - "Pinned" wording instead of "Checked in",
   - Mondo zone names in notifications.
3. **DJ lineup** is only set for tonight: Sat 24 → Sun 25 Oct 2026, Madrid time. The clocks go back at 03:00, hence +02:00 before and +01:00 after. To change it, update `venues.lineup` (JSON list of `{name, start, end}` in ISO with offset) for venue `e1e0a000-0000-4000-8000-000000000002` with a small SQL file. No app change is needed.
4. **Halloween crews** expire 48 h after the event (`ends_at`). Mondo has no end date, so its crews don't auto-delete.
5. **Ideas raised but not built:**
   - real Shazam and Apple Health, which need a native App Store app (taps and ratings are already logged in `feature_taps` and `feedback` to measure interest),
   - analytics beyond those two tables.
6. **Barbara reads feedback** in Supabase → Table Editor → `feedback` (stars, comment, name, crew, venue) and `feature_taps`.

## Code map (`src/`)

- `lib/store.ts`: all state, the offline outbox (IndexedDB), `crew_sync`, both modes, realtime, the clock-skew fix, Undo, feedback RPCs
- `lib/rules.ts`: pin age rules (fresh / idle / hidden)
- `lib/venue.ts`: types, `where()` labels, map geometry (`mapPos`, `placeAt` for tap-anywhere, angled `square` dance floor, `floorZone` with curved rows, `zone` shapes)
- `lib/push.ts`: subscribe and notification switches (sends the switches that apply in the current mode)
- `screens/MapScreen.tsx`: overview map (zoom, floors, penguins, tap-to-pin, smoking area)
- `screens/StageScreen.tsx`: Pin tab (Halloween close-ups, Mondo `ClubFloor` and DJ screen)
- `components/DjDisplay.tsx`: DJ screen, lineup sheet (rendered over the tab bar) and Premium rating
- `components/Penguin.tsx`: SVG penguin, accessories, signal badge; animations live in `styles.css`
- `screens/Overlays.tsx`: profile sheet (modes, notifications, ghost, SOS)
- `supabase/functions/push/index.ts`: who gets which notification
- `supabase/tests/*.sql`: SQL tests (run on plain Postgres after `supabase_stub.sql` and all migrations)

## Testing approach used so far

- `npx tsc -b`, `npx vitest run` (9 unit tests) and `npx vite build`.
- A local stack (Postgres 16, PostgREST, a small Node shim for Supabase auth, storage and REST, and Deno for the push function) with Playwright scripts running two phones at once. Those scripts lived in the old session's temporary folder and aren't in the repo, so a new session would need to rebuild that stack to repeat them.
- Last results: Halloween flow 38/38, Mondo flow 30+/30+, notification routing checked end to end with a fake push service.
