-- Run after the stub + all migrations. No ERRORs expected.
create temp table t(k text, v text); grant all on t to anon, authenticated;
set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-4000-8000-0000000000a7', false);
\echo '--- A crew at Mondo Disko starts with its own meet spot'
insert into t select 'code', public.create_crew('mondo', 'e1e0a000-0000-4000-8000-000000000002');
insert into t select 'a', (public.join_crew((select v from t where k='code'), 'Ana', '#ff3bd4')).id::text;
select c.meet_spot_place_id, v.event_name from crews c join venues v on v.id = c.venue_id where invite_code = (select v from t where k='code');
\echo '--- Its first sync carries both floor plans and floor-tagged places'
select jsonb_array_length(r->'venue'->'floors') as floors,
       (select count(*) from jsonb_array_elements(r->'places') p where p->>'floor' = '2') as on_planta_2,
       (select p->>'id' from jsonb_array_elements(r->'places') p where p->>'type' = 'outside') as outside
from (select public.crew_sync((select v::uuid from t where k='a')) r) x;
\echo '--- Without a venue, crews still go to the Halloween map'
insert into t select 'code2', public.create_crew('default');
reset role;
select meet_spot_place_id, venue_id from crews where invite_code = (select v from t where k='code2');
