\set ON_ERROR_STOP 0
\set A '''aaaaaaaa-0000-4000-8000-000000000001'''
\set B '''bbbbbbbb-0000-4000-8000-000000000002'''
\set C '''cccccccc-0000-4000-8000-000000000003'''
create temp table t(k text, v text); grant all on t to anon, authenticated;
set role authenticated;
\echo '--- A creates + joins'
select set_config('request.jwt.claim.sub', :A, false);
insert into t select 'code', public.create_crew('Halloween crew');
select (public.join_crew((select v from t where k='code'), 'Ana', '#FF3BD4')).color as a_color;
insert into t select 'a_member', id::text from members;
insert into t select 'crew', crew_id::text from members;
\echo '--- B previews, tries taken color, then joins'
select set_config('request.jwt.claim.sub', :B, false);
select public.crew_preview((select v from t where k='code'))->>'taken_colors' as taken;
select public.join_crew((select v from t where k='code'), 'Leo', '#ff3bd4');
select (public.join_crew((select v from t where k='code'), 'Leo', '#b6ff3b')).name as b_joined;
insert into t select 'b_member', id::text from members where user_id = auth.uid();
select count(*) as b_sees_members from members;
\echo '--- B cannot check in as A (expect RLS error)'
insert into checkins (id, crew_id, member_id, place_id, born, life_s) values (gen_random_uuid(), (select v::uuid from t where k='crew'), (select v::uuid from t where k='a_member'), 'brunch', now(), 150);
\echo '--- B cannot edit A, cannot move own row to another crew'
update members set note = 'hacked' where id = (select v::uuid from t where k='a_member');
update members set crew_id = gen_random_uuid() where user_id = auth.uid();
\echo '--- B cannot read secrets table'
select * from member_secrets;
\echo '--- A checks in, then upserts same id (repeat tap)'
select set_config('request.jwt.claim.sub', :A, false);
insert into t values ('ci', 'dddddddd-0000-4000-8000-000000000009');
insert into checkins (id, crew_id, member_id, place_id, nx, ny, born, life_s) values ((select v::uuid from t where k='ci'), (select v::uuid from t where k='crew'), (select v::uuid from t where k='a_member'), 'brunch', .2, .2, now(), 150);
insert into checkins (id, crew_id, member_id, place_id, nx, ny, born, life_s, taps) values ((select v::uuid from t where k='ci'), (select v::uuid from t where k='crew'), (select v::uuid from t where k='a_member'), 'brunch', .21, .2, now(), 200, 2)
  on conflict (id) do update set nx = excluded.nx, life_s = excluded.life_s, taps = excluded.taps;
insert into t select 'secret', public.my_shortcut_secret((select v::uuid from t where k='a_member'));
select length(v) as secret_len from t where k='secret';
update members set status = 1, note = 'front left!!' where user_id = auth.uid() returning name, status, note;
\echo '--- B sees the merged checkin; B cannot read A secret via RPC'
select set_config('request.jwt.claim.sub', :B, false);
select place_id, nx, life_s, taps from checkins;
select public.my_shortcut_secret((select v::uuid from t where k='a_member')) is null as b_gets_null;
\echo '--- C (outsider) sees nothing, cannot post'
select set_config('request.jwt.claim.sub', :C, false);
select (select count(*) from crews) crews, (select count(*) from members) members, (select count(*) from checkins) checkins;
insert into messages (id, crew_id, member_id, type, text, born) values (gen_random_uuid(), (select v::uuid from t where k='crew'), (select v::uuid from t where k='a_member'), 'text', 'hi', now());
\echo '--- storage: member uploads to own crew folder ok, outsider denied'
insert into storage.objects (bucket_id, name) values ('photos', (select v from t where k='crew') || '/x.jpg');
select set_config('request.jwt.claim.sub', :A, false);
insert into storage.objects (bucket_id, name) values ('photos', (select v from t where k='crew') || '/x.jpg') returning name like '%/x.jpg' as a_upload_ok;
\echo '--- anon (Shortcut): no table access; bad secret; good secret extends; water variant'
reset role; select set_config('request.jwt.claim.sub', '', false); set role anon;
select count(*) from checkins;
select public.quick_checkin((select v::uuid from t where k='a_member'), 'nope');
select public.quick_checkin((select v::uuid from t where k='a_member'), (select v from t where k='secret'));
select public.quick_checkin((select v::uuid from t where k='a_member'), (select v from t where k='secret'), 'water');
reset role;
select place_id, life_s, taps from checkins order by created_at;
\echo '--- B (no checkin yet) quick_checkin message'
insert into t select 'b_secret', secret from member_secrets where member_id = (select v::uuid from t where k='b_member');
set role anon;
select public.quick_checkin((select v::uuid from t where k='b_member'), (select v from t where k='b_secret'));
reset role;
\echo '--- purge'
update crews set ends_at = now() - interval '49 hours';
select public.purge_old_crews() as purged;
select (select count(*) from checkins) checkins_left, (select count(*) from members) members_left;
\echo '--- reclaim: new device D joins a fresh crew as Ana twice'
reset role; set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-4000-8000-000000000001', false);
insert into t select 'code2', public.create_crew('crew2');
select (public.join_crew((select v from t where k='code2'), 'Ana', '#ff3bd4')).id::text as ana_id \gset
select set_config('request.jwt.claim.sub', 'dddddddd-0000-4000-8000-00000000000d', false);
select (public.join_crew((select v from t where k='code2'), ' ana ', '#b6ff3b')).id::text = :'ana_id' as same_member_reclaimed;
select count(*) as d_sees_members, max(color) as color_kept from members;
