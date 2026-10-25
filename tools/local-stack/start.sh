#!/bin/bash
# (Re)start PostgREST, the shim and the push function against a fresh database.
pkill -f postgrest; pkill -f server.mjs; pkill -f "deno run"; sleep 1
/tmp/claude-0/-home-user-crew-finder/e60b497d-1d36-5b65-b899-677566efdfb6/scratchpad/reset.sh >/dev/null 2>&1 || { echo reset failed; exit 1; }
psql -h /opt/pg -p 54329 -U postgres -d pingu -qc "update push_config set functions_url='http://127.0.0.1:54321/functions/v1', vapid_subject='mailto:test@example.com'" 
nohup /opt/postgrest /opt/pgrst.conf > /opt/pgrst.log 2>&1 &
cd /opt/shim && nohup node server.mjs > /opt/shim.log 2>&1 &
SRK=$(node /opt/srk.cjs)
cd /opt/denocheck && cp /home/user/crew-finder/supabase/functions/push/index.ts . && SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_SERVICE_ROLE_KEY=$SRK DENO_CERT=/opt/shim/bundle.pem NODE_TLS_REJECT_UNAUTHORIZED=0 NODE_EXTRA_CA_CERTS=/opt/shim/cert.pem NO_PROXY=127.0.0.1,localhost no_proxy=127.0.0.1,localhost nohup /opt/denotool/node_modules/.bin/deno run -A --unsafely-ignore-certificate-errors=127.0.0.1 index.ts > /opt/deno-fn.log 2>&1 &
sleep 4; echo started
