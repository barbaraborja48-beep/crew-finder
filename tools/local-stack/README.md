# Local stack (testing only, never deployed)

Everything PinGü needs from Supabase, on one machine, so features can be tried on several
simulated phones before Barbara sees them. Paths assume a cloud session (`/opt`).

| Piece | What it does |
|---|---|
| Postgres 16 on port 54329, socket in `/opt/pg` | `reset-db.sh` loads `supabase/tests/supabase_stub.sql` + every migration |
| PostgREST (`/opt/postgrest`, config `pgrst.conf`) | the REST API, port 3001 |
| `shim.mjs` (needs `pg`, `ws`; run from `/opt/shim`) | port 54321: anonymous auth, REST proxy, photo store, realtime joins (phones show "Live"), forwards `net.calls` to the push function, runs `fire_reminders()` every 5 s, test knobs (`/_test/slow?down=1`, `hangNext=ms`, `storage=ms`). Port 54322: fake HTTPS push service (`/_test/pushes` lists what each phone got) |
| Deno running `supabase/functions/push/index.ts` | port 8000, the real push function |
| `npx vite build` with `VITE_SUPABASE_URL=http://localhost:54321`, then `vite preview` | the app on port 4173 |

Setup once: Postgres from apt (`/usr/lib/postgresql/16`, data in `/opt/pg/data`), PostgREST
v12 static binary from GitHub releases into `/opt`, `npm i pg ws` in `/opt/shim` (copy
`shim.mjs` there as `server.mjs`, make `key.pem`/`cert.pem` with openssl), Deno via
`npm i --prefix /opt/denotool deno`.

`start.sh` resets the database and (re)starts PostgREST, the shim and the push function.
Run it on its own: it uses `pkill -f`, which also kills a shell whose command line mentions those names.

Then: `node e2e/halloween.cjs` (three phones), `node e2e/signal.cjs` (weak-signal timings;
`APP=http://localhost:4174` to time another build), `SHOTS=dir node e2e/mondo.cjs` (screens to
pixel-compare two builds). Screenshots land in `/opt/e2e/shots` unless `SHOTS` is set.
