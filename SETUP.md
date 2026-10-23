# Crew Finder: setup, step by step

This gets the app live for Elrow Halloween Takeover (31.10.26). Plan on about 45 minutes, and no coding. You need a laptop for steps 1 to 6 and an iPhone for step 7 onwards.

Do it **this week**. Supabase's free plan pauses a project after about a week with no activity, so set it up now, test it, and open the app once or twice before the 31st.

---

## 1. Create the Supabase project (5 min)

1. Go to [supabase.com](https://supabase.com) and sign up (GitHub or email).
2. Click **New project**.
3. Name: `crew-finder`. Region: **West EU (Ireland)** or **Central EU (Frankfurt)**, whichever is offered, since both are close to Madrid.
4. Set a database password and save it somewhere. The app never uses it, but Supabase asks for it.
5. Wait a minute or two while it sets up.

## 2. Create the database (5 min)

This step creates the tables, the privacy rules, the Elrow map pins, and the photo storage.

1. In the left sidebar, open **SQL Editor** and click **New query**.
2. Open `supabase/migrations/20261022174557_crew_finder.sql` from this project, copy everything, paste it in, and click **Run**. You should see "Success". A notice about `pg_cron` is fine.
3. New query again. Paste `supabase/migrations/20261022174600_seed_elrow.sql` and **Run**.
4. New query again. Paste `supabase/migrations/20261023120000_map_profile_push.sql` and **Run**. This adds all 8 bars, the picnic areas and food truck shapes, profile editing, chat history and notifications.
5. New query again. Paste `supabase/migrations/20261024120000_low_data_sync.sql` and **Run**. This is the low-data sync (one small request per update).
6. Check it worked: open **Table Editor** → `places`. You should see 29 rows (elrow, Brunch!, WC, Bar…).

> Already ran some of these before? Just run the ones you haven't. Each file is safe to run once on top of the previous ones.

> If you'd rather use the terminal: `npx supabase login`, `npx supabase link`, then `npx supabase db push`.

## 3. Turn on anonymous sign-ins (1 min)

Nobody makes an account. Each phone gets a silent anonymous login, and the invite code decides who sees what.

1. Sidebar → **Authentication**, then find the sign-in settings (currently **Sign In / Providers**).
2. Switch on **Allow anonymous sign-ins** and save.

Without this, joining fails with "Anonymous sign-ins are off".

## 4. Copy two values (2 min)

Click **Connect** at the top of the dashboard, or go to **Project Settings → API Keys**. You need:

- **Project URL**, which looks like `https://abcdefgh.supabase.co`
- **Publishable key**, which starts with `sb_publishable_`. If you only see an `anon` key under "Legacy", that works too.

Both are safe to put in the app. Your crew's data is protected by the database rules from step 2, not by hiding these keys. Never use the **secret** or `service_role` key here.

## 5. Put the code on GitHub (10 min)

1. Make a free account at [github.com](https://github.com) if you don't have one.
2. Click **+** → **New repository**. Name it `crew-finder`, set it to **Private**, and create it.
3. On the empty repo page, click **uploading an existing file**. Drag in everything from this project folder **except** `node_modules` and `dist` (if they exist). Click **Commit changes**.

(Or tell Claude to push it for you once the repo exists.)

## 6. Deploy on Vercel (5 min)

1. Go to [vercel.com](https://vercel.com) and sign up with your GitHub account.
2. **Add New → Project**, then pick the `crew-finder` repo and click **Import**.
3. Framework should say **Vite**. Leave the build settings alone.
4. Open **Environment Variables** and add two:
   - `VITE_SUPABASE_URL` = your Project URL
   - `VITE_SUPABASE_ANON_KEY` = your publishable key
5. Click **Deploy**. After a minute you get a link like `crew-finder-xyz.vercel.app`.

If you change the variables later, go to **Deployments → ⋯ → Redeploy**, because the values are baked in at build time.

Netlify works the same way: build command `npm run build`, publish folder `dist`, same two variables.

## 7. Start your crew (iPhone, 5 min)

1. Open your Vercel link in **Safari**.
2. **Start a crew** → name it → **Create crew**.
3. Pick your name and laser color → **Join crew**.
4. Tap **Share** → **Add to Home Screen** → **Add**.
5. Open **Crew** from the Home Screen. It starts fresh, because Home Screen apps keep their own storage, separate from Safari. Tap **I have a code**, enter the 8-letter code, and use **exactly the same name**. You'll be back in as the same person, with the same color.
6. **Crew tab → Invite friends** to send the link in WhatsApp. Each friend repeats steps 1, 3, 4 and 5.

## 8. Optional: one-tap "I'm here" Shortcut

**Crew tab → One-tap check-in for iPhone** walks each person through building it in the Shortcuts app. Every field has a copy button, and there's a **Test it from here** button at the end. The Shortcut can go on the Home Screen as a widget, on the Action button, or on Back Tap (Settings → Accessibility → Touch → Back Tap).

The Shortcut needs signal. Unlike the app, it can't queue.

## 9. Before you leave for the festival

- **Everyone: Ajustes → Apps → Mensajes → turn on "Enviar como SMS"** (Settings → Messages → Send as SMS). When there's no data, the app offers to text your spot or your SOS, and this lets iMessage fall back to a normal SMS. Text one or two people individually rather than a group: group texts need data.
- **Keep Data saver on** (your avatar → Data saver; it's on by default). Instead of a live connection, the app checks for news every minute while it's open, right after you do something, and whenever a notification arrives. In testing that's about 0.1 MB an hour instead of 6.7 MB.

- Everyone opens the Home Screen app **once that day with signal or wifi**. That caches the map and the latest crew state.
- Test without signal: put the phone in airplane mode, open the app, and tap a spot on a stage. The pill should say **Queued · no signal**. Turn airplane mode off and it flips to **Sent** within seconds.
- Agree on the meet spot (Crew tab, default is Picnic by La Plaza, on the hour).
- Low Power Mode is fine.

## 10. Turn on notifications (15 min, once)

The app can buzz your friends' phones when someone checks in somewhere new, changes status, pings, sends an SOS, or writes in chat. This needs a small server function on Supabase.

1. In Supabase, open **Edge Functions** in the left sidebar.
2. Click **Deploy a new function** → **Via Editor**.
3. Name it exactly `push`.
4. Delete the sample code. Open [supabase/functions/push/index.ts](https://github.com/barbaraborja48-beep/crew-finder/blob/main/supabase/functions/push/index.ts) on GitHub, click **Copy raw file**, and paste it in.
5. Click **Deploy** and wait for it to finish.
6. Open the function's settings (**Details** tab) and switch **off** the option to verify/enforce JWT. Save. The database calls this function directly, so it checks its own secret instead.
7. Seeing `MISSING_CREDENTIALS` if you open `https://ryqtifsfmhfzrgkrbxlm.supabase.co/functions/v1/push` in a browser is normal: Supabase wants an API key, which the app and database send but a browser tab doesn't. The real test is turning notifications on from your phone (below).
8. If you ran the database update **before 23 Oct**, also run these two small fixes in the SQL Editor, one after the other: [fix 1](https://github.com/barbaraborja48-beep/crew-finder/blob/main/supabase/fixes/2026-10-23_push_apikey.sql) and [fix 2](https://github.com/barbaraborja48-beep/crew-finder/blob/main/supabase/fixes/2026-10-23b_push_key_from_db.sql).

**On each phone** (it has to be the Home Screen app, not Safari): tap your avatar at the top right → switch on **Notifications** → **Allow**. You can mute check-ins or chat there. SOS and pings always come through.

If nothing arrives: in Supabase go to **Database → Extensions** and check that **pg_net** is on.

## 11. After the event

Crew data deletes itself **48 hours after 02:00 on 1 Nov**. A scheduled job does this if `pg_cron` was available, and you can check under **Integrations → Cron** for `purge-old-crews`. If it isn't there, run this in the SQL Editor on 3 Nov:

```sql
select public.purge_old_crews();
```

Photos live separately: **Storage → photos**, select all, delete.

---

## What to expect (honest limits)

- **The map only updates while the app is open.** iPhones freeze web apps in the background. Notifications (step 10) still arrive with the app closed, as long as that phone has some signal, and tapping one opens the app on the right screen.
- **Live updates** come over a realtime connection. When that drops (it will, at a festival), the app checks for news every 15 seconds while it's open.
- **Battery %** only shows for Android friends. iPhone Safari doesn't share it.
- **SOS** goes to your crew only. It also points you to the Safe Space on the map. It does not contact festival staff.
- **Bluetooth "friend nearby", the UWB arrow, real widgets and Live Activities** need a native iOS app. They were out of scope for the web version, as the design handoff says.
- **The Elrow map image** is the official sitemap, for personal use. The site tells search engines not to index it, but keep the link within your crew.
- **Joining needs signal once** (wifi at home is perfect). After that, everything works offline and syncs later.
