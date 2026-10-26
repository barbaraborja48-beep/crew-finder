-- Run after the stub + all migrations. Expected values are in the column names.
create temp table t(k text, v text); grant all on t to anon, authenticated;
set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-4000-8000-0000000000c1', false);
select public.create_crew('Halloween squad', 'e1e0a000-0000-4000-8000-000000000001', 'Halloween-Squad') as code_expect_halloween_squad;
\set ON_ERROR_STOP 0
select public.create_crew('Copycat', null, 'halloween-squad') as taken_expect_error;
select public.create_crew('Bad', null, 'no spaces') as bad_expect_error;
\set ON_ERROR_STOP 1
select length(public.create_crew('Random', null, '')) as random_len_expect_8;
select length(public.create_crew('Old app', 'e1e0a000-0000-4000-8000-000000000002')) as old_app_len_expect_8;
select (public.crew_preview('HALLOWEEN-SQUAD'))->>'crew_name' as preview_expect_halloween_squad;
reset role;
