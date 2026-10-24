-- Run after the stub + all migrations. No ERRORs expected.
create temp table t(k text, v text); grant all on t to anon, authenticated;
set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-4000-8000-0000000000f1', false);
insert into t select 'code', public.create_crew('pins');
insert into t select 'a', (public.join_crew((select v from t where k='code'), 'Ana', '#ff3bd4')).id::text;
\echo '--- A pin that waited 10 minutes in the outbox, from a phone whose clock is 1 hour fast'
select public.crew_sync((select v::uuid from t where k='a'), null, 'x',
  jsonb_build_array(jsonb_build_object('i', 'cccccccc-0000-4000-8000-000000000001', 'p', 'brunch', 'x', .2, 'y', .3,
    'a', 600000, 'b', (extract(epoch from now() + interval '1 hour') * 1000)::bigint, 't', 1)),
  jsonb_build_array(jsonb_build_object('i', 'dddddddd-0000-4000-8000-000000000001', 'k', 'text', 'tx', 'hi',
    'a', 120000, 'b', (extract(epoch from now() + interval '1 hour') * 1000)::bigint)))->'rejected' as rejected;
reset role;
select round(extract(epoch from now() - born) / 60) as pin_minutes_old from checkins where id = 'cccccccc-0000-4000-8000-000000000001';
select round(extract(epoch from now() - born) / 60) as msg_minutes_old from messages where id = 'dddddddd-0000-4000-8000-000000000001';
\echo '--- Older app versions (no "a") still work'
set role authenticated;
select public.crew_sync((select v::uuid from t where k='a'), null, 'x',
  jsonb_build_array(jsonb_build_object('i', 'cccccccc-0000-4000-8000-000000000002', 'p', 'jail', 'x', .5, 'y', .5,
    'b', (extract(epoch from now() - interval '3 minutes') * 1000)::bigint, 'l', 150, 't', 1)))->'rejected' as rejected;
reset role;
select round(extract(epoch from now() - born) / 60) as old_app_minutes_old from checkins where id = 'cccccccc-0000-4000-8000-000000000002';
\echo '--- Shortcut: same place = still here (same pin, time reset, taps 2, spot kept)'
update checkins set born = now() - interval '40 minutes' where id = 'cccccccc-0000-4000-8000-000000000002'; -- the Brunch pin (10 min old) is now the latest
select public.quick_checkin((select v::uuid from t where k='a'), (select secret from member_secrets where member_id = (select v::uuid from t where k='a')))->>'message' as message;
select id = 'cccccccc-0000-4000-8000-000000000001' as same_pin, taps, round(extract(epoch from now() - born)) as secs_old, nx from checkins
where member_id = (select v::uuid from t where k='a') order by born desc limit 1;
\echo '--- Shortcut to a WC: a new pin'
select public.quick_checkin((select v::uuid from t where k='a'), (select secret from member_secrets where member_id = (select v::uuid from t where k='a')), 'wc')->>'message' as message;
select count(*) as pins from checkins where member_id = (select v::uuid from t where k='a');
