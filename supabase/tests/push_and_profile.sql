-- Run after the stub + all migrations. Expected ERRORs are marked.
create temp table t(k text, v text); grant all on t to anon, authenticated;
set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-4000-8000-000000000001', false);
insert into t select 'code', public.create_crew('push crew');
insert into t select 'a', (public.join_crew((select v from t where k='code'), 'Ana', '#ff3bd4')).id::text;
insert into t select 'crew', crew_id::text from members limit 1;
\echo '--- no subscriptions yet: a check-in makes no HTTP call'
insert into checkins (id, crew_id, member_id, place_id, born, life_s) values (gen_random_uuid(), (select v::uuid from t where k='crew'), (select v::uuid from t where k='a'), 'bar5', now(), 150);
reset role; select count(*) as calls_before from net.calls; set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-4000-8000-000000000001', false);
\echo '--- Ana saves a subscription; direct table access is blocked (expect 2 ERRORs)'
select public.save_push_subscription((select v::uuid from t where k='a'), 'https://push.example/ana', 'p', 'au', true, false);
select * from push_subscriptions;
select * from push_config;
\echo '--- Leo joins; tries to save a subscription for Ana (expect ERROR not your member)'
select set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-4000-8000-000000000002', false);
insert into t select 'l', (public.join_crew((select v from t where k='code'), 'Leo', '#b6ff3b')).id::text;
select public.save_push_subscription((select v::uuid from t where k='a'), 'https://push.example/x', 'p', 'au', true, true);
\echo '--- Leo messages: status + ping go through the trigger'
insert into messages (id, crew_id, member_id, type, text, born) values (gen_random_uuid(), (select v::uuid from t where k='crew'), (select v::uuid from t where k='l'), 'status', 'Lost', now());
insert into messages (id, crew_id, member_id, type, text, to_member, born) values (gen_random_uuid(), (select v::uuid from t where k='crew'), (select v::uuid from t where k='l'), 'sys', 'Leo pinged Ana', (select v::uuid from t where k='a'), now());
\echo '--- Leo cannot take Ana''s color or name (expect 2 ERRORs: unique)'
update members set color = '#FF3BD4' where user_id = auth.uid();
update members set name = 'ana' where user_id = auth.uid();
update members set name = 'Leonardo', color = '#ffc83b' where user_id = auth.uid() returning name, color;
reset role;
select count(*) as calls, min(url) as url, bool_and(headers ? 'x-hook-secret') as signed,
       string_agg(body->>'table' || ':' || coalesce(body->'record'->>'type', body->'record'->>'place_id'), ', ') as what from net.calls;
\echo '--- Ana removes her subscription; next check-in makes no call'
set role authenticated; select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-4000-8000-000000000001', false);
select public.remove_push_subscription('https://push.example/ana');
insert into checkins (id, crew_id, member_id, place_id, born, life_s) values (gen_random_uuid(), (select v::uuid from t where k='crew'), (select v::uuid from t where k='a'), 'bar4', now(), 150);
reset role; select count(*) as calls_after_unsubscribe from net.calls;
