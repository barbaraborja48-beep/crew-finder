-- Run after the stub + all migrations. Shows sizes and rules of crew_sync.
create temp table t(k text, v text); grant all on t to anon, authenticated;
set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-4000-8000-0000000000a1', false);
insert into t select 'code', public.create_crew('sync crew');
insert into t select 'a', (public.join_crew((select v from t where k='code'), 'Ana', '#ff3bd4')).id::text;
select set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-4000-8000-0000000000b2', false);
insert into t select 'l', (public.join_crew((select v from t where k='code'), 'Leo', '#b6ff3b')).id::text;
\echo '--- first sync for Leo: full state incl. venue + places'
insert into t select 'r1', public.crew_sync((select v::uuid from t where k='l'))::text;
select length(v) as bytes, (v::jsonb ? 'places') as has_places, jsonb_array_length(v::jsonb->'members') as members from t where k='r1';
insert into t select 'hash', (select v::jsonb->>'places_hash' from t where k='r1');
insert into t select 'cur', (select v::jsonb->>'now' from t where k='r1');
\echo '--- nothing new: tiny answer, no places'
select length(public.crew_sync((select v::uuid from t where k='l'), (select v::timestamptz from t where k='cur'), (select v from t where k='hash'))::text) as idle_bytes;
\echo '--- Ana checks in + messages + status in ONE call'
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-4000-8000-0000000000a1', false);
select public.crew_sync((select v::uuid from t where k='a'), now(), (select v from t where k='hash'),
  '[{"i":"11111111-0000-4000-8000-000000000001","p":"bar5","x":0.1,"y":0.4,"b":1792800000000,"l":150,"t":1}]',
  '[{"i":"22222222-0000-4000-8000-000000000001","k":"text","tx":"at the bar","b":1792800000000}]',
  '{"status":1,"note":"phone dying"}')->'rejected' as rejected;
\echo '--- Ana tries to overwrite Leo''s check-in and take his color (both refused)'
select set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-4000-8000-0000000000b2', false);
select public.crew_sync((select v::uuid from t where k='l'), null, (select v from t where k='hash'),
  '[{"i":"33333333-0000-4000-8000-000000000003","p":"jail","x":0.5,"y":0.5,"b":1792800000000,"l":150}]') is not null as leo_checked_in;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-4000-8000-0000000000a1', false);
select public.crew_sync((select v::uuid from t where k='a'), now(), (select v from t where k='hash'),
  '[{"i":"33333333-0000-4000-8000-000000000003","p":"elrow","x":0.9,"y":0.9,"b":1792800000000,"l":150}]', '[]', '{"color":"#b6ff3b"}')->'rejected' as rejected;
reset role; select place_id as leo_still_at from checkins where id = '33333333-0000-4000-8000-000000000003';
select color as ana_color from members where name = 'Ana';
\echo '--- Leo syncs since his cursor: gets only the delta'
set role authenticated; select set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-4000-8000-0000000000b2', false);
select length(r::text) as delta_bytes, jsonb_array_length(r->'checkins') as checkins, jsonb_array_length(r->'messages') as messages,
       (select string_agg(x->>'name' || ':' || (x->>'status'), ',') from jsonb_array_elements(r->'members') x) as members_changed, r ? 'places' as places
from (select public.crew_sync((select v::uuid from t where k='l'), (select v::timestamptz from t where k='cur'), (select v from t where k='hash')) r) q;
\echo '--- outsider gets {gone}'
select set_config('request.jwt.claim.sub', 'cccccccc-0000-4000-8000-0000000000c3', false);
select public.crew_sync((select v::uuid from t where k='a')) as outsider;
