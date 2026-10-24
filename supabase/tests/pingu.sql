-- Run after the stub + all migrations.
create temp table t(k text, v text); grant all on t to anon, authenticated;
set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-4000-8000-0000000000e1', false);
insert into t select 'code', public.create_crew('pingu');
insert into t select 'a', (public.join_crew((select v from t where k='code'), 'Ana', '#ff3bd4')).id::text;
\echo '--- Leo joins with the SAME color (now allowed)'
select set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-4000-8000-0000000000e2', false);
insert into t select 'l', (public.join_crew((select v from t where k='code'), 'Leo', '#FF3BD4')).id::text;
select (select v from t where k='l') is not null as leo_joined_same_color;
insert into t select 'cur', public.crew_sync((select v::uuid from t where k='l'))->>'now';
\echo '--- Ana sets accessory 7 (pink wig), signal 2, data saver off'
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-4000-8000-0000000000e1', false);
select public.crew_sync((select v::uuid from t where k='a'), now(), null, '[]', '[]', '{"acc":7,"net":2,"saver":false}')->'rejected' as rejected;
\echo '--- Leo sees it in his next small sync'
select set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-4000-8000-0000000000e2', false);
select x->>'name' as name, x->>'acc' as acc, x->>'net' as net, x->>'saver' as saver
from jsonb_array_elements(public.crew_sync((select v::uuid from t where k='l'), (select v::timestamptz from t where k='cur'), 'x')->'members') x
where x->>'name' = 'Ana';
\echo '--- Leo cannot set Ana''s accessory directly (expect permission/RLS: 0 rows)'
update members set acc = 1 where name = 'Ana' and crew_id = (select crew_id from members where id = (select v::uuid from t where k='l'));
reset role; select acc as ana_acc_still from members where id = (select v::uuid from t where k='a');
