# PinGü handoff

Read this first in a new chat. It covers what the app is, where everything lives, how Barbara likes to work, what's done, and what's still open (as of 30 Oct 2026, the day before Halloween Takeover). Start with **Where we left off**.

## Who you're working with

- **Barbara Borja** owns the project. She has a business and marketing background, not a developer's. Her phone is set to Spanish, so give iPhone settings paths in Spanish when they come up.
- **Writing style:** natural and friendly, like explaining something to a smart friend. No em dashes, no corporate jargon, no press-release tone. Short steps, and links she can tap.
- **How she likes to work:**
  - Ask follow-up questions when something's unclear. Number them and include a recommendation, so she can answer with "yes".
  - **Show a preview (screenshots or a short video) before changing the live app.** Build on a branch and only merge to `main` once she says go (or clearly proceeds, for example by asking for the SQL link).
  - She wants speed, especially on event nights.
  - **Venue changes stay venue-specific.** When she asks for changes to Mondo Disko, the Halloween map must not change. She was upset once when it looked like it might, so say explicitly that the other venue is untouched.
- Every SQL change means she has to paste a file into Supabase. Always give her the direct GitHub link to the file on `main`, and say which order to run files in.

## Where we left off (30 Oct)

Everything on `main` is live and SQL 1 to 13 are run. Halloween Takeover is Sat 31 Oct.

1. **Waiting for Barbara's "go": branch `pingu-huddle`.** Buddies on any close-up (Halloween stages, bars, food, picnic; Mondo's dance floor) huddle 19 px apart, middle one in front, with one name line ("Lara, Mar, You") and a soft glow, instead of standing 46 px apart with a name each. Preview sent, every flow passes (`e2e/huddle.cjs` on that branch). On go: `git merge --no-ff pingu-huddle` into `main` and push. No SQL, no push function change, main map untouched.
2. **New address `clubpinguu.xyz`** (bought 27 Oct on Vercel, $11.25 a year, auto-renews). Attached to crew-finder: `clubpinguu.xyz` forwards (308) to `www.clubpinguu.xyz`, Vercel runs the DNS, registrant contact verified. At 16:15 UTC on 27 Oct the www address gave `ERR_CONNECTION_CLOSED` just after DNS went live, most likely the HTTPS certificate still being issued. **Confirm it opens on her phone.** If not, ask for a screenshot of Vercel → crew-finder → Settings → Domains. Keep `crew-finder-xi.vercel.app` working and don't redirect it: Home Screen apps belong to their address, so anyone who installed from the old one has to add the new one, join again and turn notifications back on.
3. **Text for friends** (the last line is her wording; she fills in the crew code, and the link once the new address works):
   > 🐧 **Meet PinGü**, our app for finding each other at Halloween Takeover, even with one bar of signal. Tap where you are and your penguin pops up on everyone's map.
   >
   > **Setup (1 min):**
   > 1. Open clubpinguu.xyz in Safari or Chrome
   > 2. Add it to your Home Screen: on iPhone, tap Share, then Add to Home Screen; on Android, tap ⋮, then Install app
   > 3. Open it from the icon, tap **I have a code**, type **[your code]**
   > 4. Tap your penguin (top right) and turn on notifications
   >
   > PinGü stores data for improvement purposes only.
   >
   > See you on the 31st 🎃
4. **Next requests, not started** (she asked, then paused them to start a new chat):
   - Find the map for a **Mondo Disko open-air event** and add it as a new venue. Her words: "mondo disko open krystal air event in Sala jowke". Confirm the event name, venue, date and the map source with her before building.
   - Same for **Fabrik's Halloween event**: find that event's own Halloween map, not the club's everyday plan, and add it as a venue.
   - How a venue is added: one migration like `20261027120000_mondo_disko.sql` (venue row with `map_url`, `map_w/h`, view framing, floors, `default_meet`, `event_end`, `lineup` JSON; `places` with coordinates on the image) plus the image in `public/assets/` under a new file name (phones cache maps by URL). The welcome page lists venues by `event_end`. Keep it venue-specific and tell her the other venues are untouched. Give her the GitHub link to the SQL file on `main` and its number in the run order (next is 14).
5. **Halloween insights dashboard, Sun 1 Nov.** A reminder (`trig_01J3zf2Z81gepPRGqqfGNFaS`) wakes the *previous* chat at 11:00 UTC to build it. If Barbara wants it in the new chat instead, set your own reminder there and delete that one. She wants names and messages, not only totals: busiest hours, top stages and places, who pinned most and where, feature use per person, pin wait times, most-starred sets, Premium demand, a message log per crew. Sources: `app_events`, `night_stats`, `night_members`, `night_pins`, `night_messages`, plus the live crews/members/checkins/messages/member_prefs, `feature_taps`, `feedback`. Use the Dashboard artifact type and read-only queries. Halloween crews are deleted around 02:00 Madrid on Tue 3 Nov; `purge_old_crews()` saves the night first, or run `select public.save_night_stats()` with her OK.

## Where things live

| What | Where |
|---|---|
| Code | https://github.com/barbaraborja48-beep/crew-finder (private), branch `main` |
| Live app | Vercel, deploys automatically from `main`: crew-finder-xi.vercel.app, and since 27 Oct clubpinguu.xyz (see above) |
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

## Added 27 Oct (merged to `main`; SQL 13 run)

- **Insights, with names** (Barbara wants to know who did what): `app_events` logs app opened (from the Home Screen or not, which mode), intro tour finished or skipped (cards seen), how long each pin waited for signal (tap to server, with mode and signal level), low data mode switched, lineup opened. Each row has the member's id and name, crew and venue, plus a random id per phone (`pingu-device`). Events wait on the phone (`store.track`, kv `events`, max 100) and ride along with the next `crew_sync` as `p_events`, each with its own id so a resend counts once. An older server without `p_events` makes the phone stop sending them (`eventsOff`) without losing the sync.
- **Each night is kept** before the 48 h cleanup: `night_stats` (per-crew totals: pins per place and hour, message types, buddies, plans, most-starred sets, mutes, low data, notifications), `night_members` (name, colour, accessory, pins per place), `night_pins` (every pin with its spot) and `night_messages` (every message with its text and photo link). `purge_old_crews()` saves all four first and still deletes on time if saving fails. `select public.save_night_stats()` saves every crew now. These stay until Barbara deletes them in Supabase.
- Small note at the bottom of the Crew tab: "PinGü stores data for improvement purposes only." (Barbara's wording; the same line goes in the text she sends friends)
- **Festival map without the poster text:** `public/assets/elrow-map-v2.webp` is the same map with the title, the sitemap legend and the printed stage names blacked out (our own stage labels stay). New file name on purpose: phones cache maps by URL, so an edited file under the old name would never reach them. SQL 13 points the venue at it. The old `elrow-map.webp` is kept for phones that haven't synced yet.
- **Map height:** the festival map frame ends at its lowest place (no empty band under it). The friends list has a drag handle (both venues): pull it up for a longer list, double-tap to reset, remembered per phone (`pingu-map-split`). When the frame is shorter than the map, the map keeps its size and slides up and down under one finger (`ZoomPan` `ch` prop), so pins and labels stay readable. Club plans: tap-to-pin still lands under the finger (tested).
- **Suggested spots** ("Let go" guesses, planned moves) are clearer: full colour penguin at 88% opacity, a slowly turning dashed ring and a "?" bubble in the member's colour, the name as "Mar?" in their colour, and a line in the list: "Probably at Bar · Industry City" or "Heading to WC".
- **Colours:** 17 swatches (two rows of 9 with the wheel): dropped a yellow, the gray, the light orange and the light pink; added a blue, a green and a teal. The last circle is a colour wheel (`input type=color`); very dark picks are lifted to 55% lightness, same hue, so they show on the black map. Label: "Select your PinGü color".
- **Welcome page:** "Find your crew with" and a big "PinGü!", subtext "Create a new crew or join an existing one with a crew code."
- A reminder is scheduled in this session for Sun 1 Nov 11:00 UTC to build the Halloween insights dashboard (Halloween crews are deleted ~02:00 Madrid, Tue 3 Nov), with names and messages.

## Added 26 Oct (merged to `main`; SQL 12 given to Barbara)

- **iPhone bottom gap fixed:** iOS 26 Home Screen apps get a viewport one status bar short (WebKit bug 301108), leaving a black strip under the tab bar. Fix: a standalone-only `min-height` on `html` in `styles.css`.
- **Layout:** the map is half the screen (festival map anchored at the top and capped where the image ends; club plans centred), the friends list fills the rest. Every stage close-up fits the screen above the footer. The festival lineup sheet is half the screen on every stage tab and scrolls inside. DJ screens are fully rounded on festival stages, and a `.dj-clip` layer makes Safari clip the lava blobs to the corners. Lineup rows no longer run off the right edge on iPhone (`.dj-row-main`).
- **Intro tour:** 4 or 5 cards after joining (Halloween adds "Never miss a set"), Skip any time, once per phone (`pingu-tour-done`), "Replay the intro" in the profile.
- **Looks:** 18 colours (two rows of 9) and 20 accessories (new: headphones, witch hat, cat ears, party hat, bucket hat, flower crown, halo, bandana, backwards cap, star shades).
- **Profile circle badges:** a symbol on top of each circle: where they are (Halloween stages use their logos, cut from the poster into `public/assets/logos/`; other places their icon) or their status. "Profile circles show: Where / Status" in the profile, per phone (`pingu-badge`).
- **Custom invite code:** the start screen suggests a code from the crew name (editable). Needs SQL 12; without it the app falls back to a random code.
- **Bug fixed on the way:** the low data mode choice was never restored after reopening the app (its storage key was read before it was defined, and the error was swallowed).
- Mondo: its map page is half the screen now too (flagged to Barbara); its pin page and lineup are unchanged.

## Added 25 Oct evening (merged to `main`, see status below)

- **Halloween map has no filter chips any more** (Barbara asked). Stages, bars, WC, food and so on always show; open areas stay hidden unless you jump to one (e.g. the meet spot).

- **Buddy up:** on a friend's page, "Buddy up" sends a request; they accept from a card on the Map or Crew tab. Everyone in a group (`members.buddy`, same id) is *shown* at the group's newest pin, huddled side by side, so anyone pinning moves them all. Worked out on each phone (`lib/social.ts` → `shownDots`), no copied pins. The pin message offers "Just me" (leave the group). "Let go" on a buddy's page lets them out and can guess where they went: a faded "Mar?" penguin until they pin (message type `guess`).
- **Mute a person:** bell on each row of the Crew tab and on their page. Stops their pins, chat, pings, buddy requests and planned moves for you; SOS and meet-spot changes still come through. Stored in `member_prefs.mutes` (not visible to the crew).
- **Halloween DJ screens:** every stage close-up has the DJ screen (35 sets from the poster, `venues.lineup` entries now carry `stage`). The main map shows "▶ DJ name" under each stage. Mondo keeps its single lineup, untouched.
- **My night:** stars in the lineup sheet (stage tabs + "My night" tab), reminders per set (off, at start, 5/10/15/30 min before; the last choice is the default), clashes with a switch-time picker, optional sharing (then it shows on your profile page for the crew). Next pick shows on the map. Reminders are sent by `fire_reminders()` every minute (pg_cron).
- **Plan a move:** "going to the WC in 10 min" with chosen friends (from their page or the Crew tab). They're notified now; at the time everyone in it gets "Meet Barbara at WC", faded penguins wait at the spot, and a card asks "I'm here" (pins you) or "Not going". Planner can cancel; others can say they can't make it (message type `move`, details in `messages.meta`).
- **Weak-signal fixes** (both venues): a stuck request is given up after 10 s instead of 20 (photos 30 s); retries at 1.5, 3, 6 then every 10 s; photos upload in their own lane so a stuck photo never holds up a pin; in good connection mode the live connection pauses while sends keep failing; the login is renewed while signal is good. Measured locally: stuck request 22 s → 12 s, pin behind a stuck photo 19 s → 0.3 s.
- **Vercel's paid plan won't help signal:** Vercel only serves the app files (cached on the phone). Pins go phone → Supabase (region: Ireland, which is fine for Madrid).

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
11. `20261031120000_buddies_plans_moves.sql`: buddies, mutes, Halloween lineup per stage, plans + reminders (pg_cron job `pingu-reminders`), planned moves, new `crew_sync` (adds `p_prefs`)
12. `20261101120000_custom_invite_code.sql`: `create_crew` takes an optional `p_code`
13. `20261102120000_insights_and_map.sql`: `app_events`, `night_stats`, `night_members`, `night_pins`, `night_messages`, `save_night_stats()`, cleanup saves the night first, `crew_sync` takes `p_events`, Halloween `map_url` → `elrow-map-v2.webp`

Plus two fixes she already ran: `supabase/fixes/2026-10-23_push_apikey.sql` and `2026-10-23b_push_key_from_db.sql`.

**Status (26 Oct):** 1 to 11 are run and the push function with buddies/moves/reminders is deployed (checked through the Supabase connection, read-only). **12 was just given to her**; until it runs, new crews get a random code. The push function didn't change on 26 Oct.

**Status (27 Oct):** 12 is run (checked: `create_crew(p_name, p_venue, p_code)`). The 27 Oct round is merged and **13 was just given to her**. Until it runs, phones keep their last 100 events and try again each time the app opens and still show the old festival map. No push function change.

**Status (30 Oct):** 1 to 13 are run (checked read-only: `night_members` exists, `crew_sync` takes `p_events`, the Halloween map is `elrow-map-v2.webp`). Halloween has 8 crews and 21 people. The push function hasn't changed since 26 Oct (version 5 is deployed).

## Open items

1. **Done:** SQL 11 ran, pg_cron and the `pingu-reminders` job are on, and the push function with mutes, buddies, moves and reminders is deployed (version 5). If the push function ever changes: Supabase → Edge Functions → push → Code → paste `supabase/functions/push/index.ts` → Deploy.
2. See **Where we left off** for the huddle branch, the new address, the next venues and Sunday's dashboard.
3. **Mondo lineup** was only set for Sat 24 → Sun 25 Oct. Barbara wants to do Mondo set lists later. Note: her "8 Nov, Chris Stassy" date is actually Brunch Electronik x BSMT LIVE at The Lenovo Garage (17:00–00:00, with DJ Tennis and DLOU), not Mondo. Open question whether to add that as a third venue. To change a lineup, update `venues.lineup` (JSON `{name, start, end}` in ISO with offset; festivals add `stage`) with a small SQL file.
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
- `screens/MapScreen.tsx`: overview map (zoom, floors, penguins, tap-to-pin, smoking area), frame height and the draggable list (`pingu-map-split`)
- `components/ZoomPan.tsx`: pinch, drag and +/- zoom; `ch` lets the map be taller than its frame and slide
- `store.track()` in `lib/store.ts`: app events for insights, sent with `crew_sync` as `p_events`
- `screens/StageScreen.tsx`: Pin tab (Halloween close-ups, Mondo `ClubFloor` and DJ screen)
- `components/DjDisplay.tsx`: DJ screen, lineup sheet (rendered over the tab bar) and Premium rating
- `components/Penguin.tsx`: SVG penguin, accessories, signal badge; animations live in `styles.css`
- `screens/Overlays.tsx`: profile sheet (modes, notifications, ghost, SOS)
- `lib/social.ts`: buddy groups (`shownDots`), invites, planned moves, faded suggestions, set plans (`planTimeline`, clashes, `normalizePlan`). Unit tests in `social.test.ts`
- `components/Social.tsx`: buddy/move/next-set cards, Plan a move sheet, Let go sheet
- `supabase/functions/push/index.ts`: who gets which notification (mutes, buddies, moves, reminders)
- `supabase/tests/*.sql`: SQL tests (run on plain Postgres after `supabase_stub.sql` and all migrations)

## Testing approach used so far

**Tools and gotchas from the 27 to 30 Oct chat:**
- The local stack lived in `/opt` of the old container. A new container has to set it up again from `tools/local-stack/README.md`.
- When a container idles, Postgres stops. Start it with `/usr/lib/postgresql/16/bin/pg_ctl` (remove a stale `postmaster.pid` first), then the stack's start script, which also resets the database. Reset between runs: a leftover crew makes "Create crew" fail.
- Run `vite preview` as a background job. It gets stopped after 2 hours.
- The container can't open outside websites (the live app, clubpinguu.xyz, registrars). Check deploys through the Vercel connection instead.
- Vercel connection: project calls work **without** `teamId`. With `team_qVTRPsh4CDUGnZTW1eDy0oMj` (slug `barbara-053f`) they're refused. It can't see certificates, get quotes or buy anything.
- Supabase connection: read-only `execute_sql` checks work. `apply_migration` timed out twice waiting for her approval, so she runs SQL files herself.
- Previews: iPhone 17 size (402 × 874), boards of screenshots side by side, sent with captions.
- Newer flows: `e2e/insights-map.cjs` (27 Oct round) and `e2e/mondo-split.cjs` (tap-to-pin on Mondo with the list pulled up).

- `npx tsc -b`, `npx vitest run` (9 unit tests) and `npx vite build`.
- The local stack and Playwright scripts are now in the repo: `tools/local-stack/` (see its README). Postgres 16 + PostgREST + a Node shim (auth, storage, realtime joins, pg_net and pg_cron stand-ins, fake HTTPS push service) + Deno running the real push function.
- Last results (27 Oct): 23 unit tests, the insights SQL test, and the Halloween, signal, polish, Mondo and 27 Oct flows all passing. Earlier (25 Oct evening): 23 unit tests, all SQL tests (new: `supabase/tests/buddies_plans.sql`), Halloween three-phone flow all passing (buddies, plans, reminders, moves, mute, notification routing), weak-signal timings above, and Mondo screens pixel-identical to the live version.
