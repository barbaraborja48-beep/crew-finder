-- Run after the stub + all migrations. Expected values are in the column names.
create temp table t(k text, v text); grant all on t to anon, authenticated;
set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-4000-8000-0000000000e1', false);
insert into t select 'code', public.create_crew('stats', 'e1e0a000-0000-4000-8000-000000000001');
insert into t select 'a', (public.join_crew((select v from t where k='code'), 'Ana', '#ff3bd4')).id::text;
select set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-4000-8000-0000000000e1', false);
insert into t select 'b', (public.join_crew((select v from t where k='code'), 'Bea', '#b6ff3b')).id::text;

\echo '--- Events ride along with a sync; no member id is stored'
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-4000-8000-0000000000e1', false);
select public.crew_sync((select v::uuid from t where k='a'), null, 'x',
  jsonb_build_array(jsonb_build_object('i', 'cccccccc-0000-4000-8000-0000000000e1', 'p', 'brunch', 'x', .5, 'y', .5, 'a', 0, 't', 3)),
  '[]', jsonb_build_object('buddy', (select v from t where k='a')), null,
  jsonb_build_object('plan', '[{"k": "brunch|2026-10-31T20:00:00+01:00", "r": 10}]'::jsonb, 'plan_shared', true, 'mutes', jsonb_build_array((select v from t where k='b'))),
  '[{"i": "e1", "k": "open", "d": "dev1", "m": {"mode": "good"}, "a": 0}, {"i": "e2", "k": "pin_wait", "v": 2400, "d": "dev1", "a": 1000}, {"i": "e3", "k": "tour", "v": 5, "m": {"done": true}, "d": "dev1", "a": 60000}]'::jsonb)->'rejected' as rejected_expect_empty;
\echo '--- The same events resent after a lost reply are not counted twice'
select public.crew_sync((select v::uuid from t where k='a'), null, 'x', '[]', '[]', null, null, null,
  '[{"i": "e2", "k": "pin_wait", "v": 2400, "d": "dev1", "a": 1000}]'::jsonb)->'rejected' as resend_rejected_expect_empty;
select set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-4000-8000-0000000000e1', false);
select public.crew_sync((select v::uuid from t where k='b'), null, 'x',
  jsonb_build_array(jsonb_build_object('i', 'cccccccc-0000-4000-8000-0000000000e2', 'p', 'jail', 'x', .5, 'y', .5, 'a', 0)),
  jsonb_build_array(jsonb_build_object('i', 'dddddddd-0000-4000-8000-0000000000e1', 'k', 'text', 'tx', 'hi', 'a', 0)),
  jsonb_build_object('buddy', (select v from t where k='a')))->'rejected' as rejected_expect_empty;
\echo '--- Old app (7 arguments) still syncs'
select public.crew_sync((select v::uuid from t where k='b'), null, 'x', '[]', '[]', null, null)->'rejected' as old_app_rejected_expect_empty;
select has_table_privilege('app_events', 'select') as app_can_read_events_expect_f;
reset role;
select kind, value, meta, device, crew_id is not null as has_crew, venue_id is not null as has_venue, round(extract(epoch from now() - at)) as secs_ago from app_events order by id;

\echo '--- Night summary'
select public.save_night_stats() >= 1 as saved;
select members, pins, pin_taps, pins_by_place, messages_by_type, buddy_groups, buddied_members, plans, shared_plans, stars, mutes, notifications
from night_stats where crew_id = (select crew_id from members where id = (select v::uuid from t where k='a'));

\echo '--- The cleanup saves the totals before deleting the crew'
update night_stats set pins = 0 where crew_id = (select crew_id from members where id = (select v::uuid from t where k='a'));
update crews set ends_at = now() - interval '49 hours' where id = (select crew_id from members where id = (select v::uuid from t where k='a'));
select public.purge_old_crews() as crews_deleted_expect_1;
select pins as pins_kept_expect_2 from night_stats where crew_id = (select crew_id from app_events limit 1);
select count(*) as events_kept_expect_3 from app_events;
