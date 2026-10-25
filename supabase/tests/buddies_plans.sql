-- Run after the stub + all migrations. No ERRORs expected.
-- Buddies, mutes, shared plans, set reminders and planned moves.
create temp table t(k text, v text); grant all on t to anon, authenticated;
set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-4000-8000-0000000000b1', false);
insert into t select 'code', public.create_crew('buddies', 'e1e0a000-0000-4000-8000-000000000001');
insert into t select 'a', (public.join_crew((select v from t where k='code'), 'Barbara', '#ff3bd4')).id::text;
select set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-4000-8000-0000000000b1', false);
insert into t select 'b', (public.join_crew((select v from t where k='code'), 'Lara', '#b6ff3b')).id::text;
select set_config('request.jwt.claim.sub', 'cccccccc-0000-4000-8000-0000000000b1', false);
insert into t select 'c', (public.join_crew((select v from t where k='code'), 'Mar', '#ffc83b')).id::text;

\echo '--- Halloween crews get every set, with its stage'
select jsonb_array_length(v.lineup) as sets_expect_35, count(distinct e->>'stage') as stages_expect_5
from venues v, jsonb_array_elements(v.lineup) e where v.id = 'e1e0a000-0000-4000-8000-000000000001' group by v.lineup;

\echo '--- Lara and Mar join Barbara''s group (buddy = her id)'
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-4000-8000-0000000000b1', false);
select public.crew_sync((select v::uuid from t where k='a'), null, 'x', '[]', '[]', jsonb_build_object('buddy', (select v from t where k='a')))->'rejected' as rejected;
select set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-4000-8000-0000000000b1', false);
select public.crew_sync((select v::uuid from t where k='b'), null, 'x', '[]', '[]', jsonb_build_object('buddy', (select v from t where k='a')))->'rejected' as rejected;
select set_config('request.jwt.claim.sub', 'cccccccc-0000-4000-8000-0000000000b1', false);
select public.crew_sync((select v::uuid from t where k='c'), null, 'x', '[]', '[]', jsonb_build_object('buddy', (select v from t where k='a')))->'rejected' as rejected;
select count(*) filter (where (m->>'buddy') = (select v from t where k='a')) as in_group_expect_3
from jsonb_array_elements(public.crew_sync((select v::uuid from t where k='c'))->'members') m;

\echo '--- Lara tries to let Barbara go from a group she isn''t in after leaving: nothing happens'
select set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-4000-8000-0000000000b1', false);
select public.crew_sync((select v::uuid from t where k='b'), null, 'x', '[]', '[]', '{"buddy": null}')->'rejected' as rejected;
select public.crew_sync((select v::uuid from t where k='b'), null, 'x', '[]',
  jsonb_build_array(jsonb_build_object('i', 'eeeeeeee-0000-4000-8000-0000000000b1', 'k', 'guess', 'tx', 'let Barbara go', 'a', 0,
    'to', (select v from t where k='a'), 'm', '{"letgo": true}'::jsonb)))->'rejected' as rejected;
reset role;
select buddy is not null as barbara_still_grouped from members where id = (select v::uuid from t where k='a');

\echo '--- Barbara lets Mar go and guesses the WC'
set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-4000-8000-0000000000b1', false);
select public.crew_sync((select v::uuid from t where k='a'), null, 'x', '[]',
  jsonb_build_array(jsonb_build_object('i', 'eeeeeeee-0000-4000-8000-0000000000b2', 'k', 'guess', 'tx', 'thinks Mar went to WC', 'a', 0,
    'p', 'wc1', 'x', .5, 'y', .5, 'to', (select v from t where k='c'), 'm', '{"letgo": true}'::jsonb)))->'rejected' as rejected;
reset role;
select buddy is null as mar_let_go from members where id = (select v::uuid from t where k='c');
select meta->>'letgo' as meta_kept from messages where id = 'eeeeeeee-0000-4000-8000-0000000000b2';

\echo '--- Mutes and a shared plan; Mar sees the plan, not the mutes'
set role authenticated;
select public.crew_sync((select v::uuid from t where k='a'), null, 'x', '[]', '[]', null, null,
  jsonb_build_object('mutes', jsonb_build_array((select v from t where k='b')),
    'plan', '[{"k": "brunch|2026-10-31T20:00:00+01:00", "r": 10}, {"k": "plaza|2026-10-31T20:00:00+01:00", "r": 5, "f": "2026-10-31T21:00:00+01:00"}, {"k": "jail|2026-10-31T14:00:00+01:00", "r": null}]'::jsonb,
    'plan_shared', true))->'rejected' as rejected;
select (public.crew_sync((select v::uuid from t where k='a'))->'prefs'->'mutes') = jsonb_build_array((select v from t where k='b')) as own_mutes_come_back;
select set_config('request.jwt.claim.sub', 'cccccccc-0000-4000-8000-0000000000b1', false);
select jsonb_array_length(p->1) as plan_items_seen_expect_3, p::text like '%mutes%' as leaks_mutes
from jsonb_array_elements(public.crew_sync((select v::uuid from t where k='c'))->'plans') p where p->>0 = (select v from t where k='a');
select has_table_privilege('member_prefs', 'select') as can_read_prefs_directly;
reset role;

\echo '--- Set reminders: one per upcoming pick with a reminder (the Jail pick has none)'
select title, body, to_char(due_at at time zone 'Europe/Madrid', 'HH24:MI') as due, place from reminders where kind = 'set' order by due_at;

\echo '--- Plan stops being shared: Mar gets null'
set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-4000-8000-0000000000b1', false);
select public.crew_sync((select v::uuid from t where k='a'), null, 'x', '[]', '[]', null, null, '{"plan_shared": false}')->'rejected' as rejected;
select set_config('request.jwt.claim.sub', 'cccccccc-0000-4000-8000-0000000000b1', false);
select p->1 as plan_when_private from jsonb_array_elements(public.crew_sync((select v::uuid from t where k='c'))->'plans') p where p->>0 = (select v from t where k='a');
reset role;
select count(*) as reminders_kept_expect_2 from reminders where kind = 'set';

\echo '--- Planned move: Barbara + Lara to the WC in 10 min'
set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-4000-8000-0000000000b1', false);
select public.crew_sync((select v::uuid from t where k='a'), null, 'x', '[]',
  jsonb_build_array(jsonb_build_object('i', 'ffffffff-0000-4000-8000-0000000000b1', 'k', 'move', 'tx', 'going to WC in 10 min', 'a', 0,
    'p', 'wc1', 'x', .5, 'y', .5, 'm', jsonb_build_object('in', 10, 'with', jsonb_build_array((select v from t where k='b'))))))->'rejected' as rejected;
reset role;
select m.name, r.title, r.body, round(extract(epoch from r.due_at - now()) / 60) as in_min from reminders r join members m on m.id = r.member_id where r.kind = 'move' order by m.name;

\echo '--- Lara declines: only her reminder goes'
set role authenticated;
select set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-4000-8000-0000000000b1', false);
select public.crew_sync((select v::uuid from t where k='b'), null, 'x', '[]',
  jsonb_build_array(jsonb_build_object('i', 'ffffffff-0000-4000-8000-0000000000b2', 'k', 'move', 'tx', 'can''t make it', 'a', 0,
    'm', jsonb_build_object('decline', 'ffffffff-0000-4000-8000-0000000000b1'))))->'rejected' as rejected;
reset role;
select count(*) as move_reminders_expect_1 from reminders where kind = 'move';

\echo '--- Due reminders go out once (fake pg_net records the call)'
update reminders set due_at = now() - interval '1 minute' where kind = 'move';
delete from net.calls;
select public.fire_reminders() as fired_expect_1, public.fire_reminders() as again_expect_0;
select body->'reminder'->>'title' as sent from net.calls;

\echo '--- Barbara cancels a second move: its reminders go'
set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-4000-8000-0000000000b1', false);
select public.crew_sync((select v::uuid from t where k='a'), null, 'x', '[]',
  jsonb_build_array(jsonb_build_object('i', 'ffffffff-0000-4000-8000-0000000000b3', 'k', 'move', 'tx', 'bar in 5', 'a', 0, 'p', 'bar1',
    'm', jsonb_build_object('in', 5, 'with', jsonb_build_array((select v from t where k='c')))),
    jsonb_build_object('i', 'ffffffff-0000-4000-8000-0000000000b4', 'k', 'move', 'tx', 'cancelled', 'a', 0,
    'm', jsonb_build_object('cancel', 'ffffffff-0000-4000-8000-0000000000b3'))))->'rejected' as rejected;
reset role;
select count(*) as cancelled_left_expect_0 from reminders where ref = 'ffffffff-0000-4000-8000-0000000000b3';

\echo '--- Messages come back with their details (11th field)'
set role authenticated;
select (select g->>10 from jsonb_array_elements(public.crew_sync((select v::uuid from t where k='a'))->'messages') g where g->>0 = 'ffffffff-0000-4000-8000-0000000000b1') as meta;
reset role;
