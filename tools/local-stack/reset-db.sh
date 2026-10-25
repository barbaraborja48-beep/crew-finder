#!/bin/bash
# Fresh database: stub + every migration in order.
P="psql -h /opt/pg -p 54329 -U postgres -v ON_ERROR_STOP=1 -q"
$P -c 'drop database if exists pingu' -c 'create database pingu' >/dev/null
$P -d pingu -f /home/user/crew-finder/supabase/tests/supabase_stub.sql >/dev/null
for f in /home/user/crew-finder/supabase/migrations/*.sql; do $P -d pingu -f $f >/dev/null 2>/tmp/claude-0/-home-user-crew-finder/e60b497d-1d36-5b65-b899-677566efdfb6/scratchpad/err.log || { echo "FAIL $f"; $P -d pingu -f $f 2>&1 | grep -i error | head -5; exit 1; }; done
echo ok
