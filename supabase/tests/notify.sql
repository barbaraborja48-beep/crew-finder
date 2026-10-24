-- Run after the stub + all migrations (as the owner). Only SOS, pings and meet-spot changes call the push function.
-- as the owner (no RLS): one crew, two members, one push subscription
insert into crews (id, name, venue_id, invite_code) values ('cccccccc-0000-4000-8000-0000000000c2', 'n', 'e1e0a000-0000-4000-8000-000000000002', 'notifyt2');
insert into members (id, crew_id, user_id, name, color) values
  ('aaaaaaaa-0000-4000-8000-0000000000c2', 'cccccccc-0000-4000-8000-0000000000c2', gen_random_uuid(), 'Ana', '#ff3bd4'),
  ('bbbbbbbb-0000-4000-8000-0000000000c2', 'cccccccc-0000-4000-8000-0000000000c2', gen_random_uuid(), 'Leo', '#ff3bd4');
insert into push_subscriptions (member_id, crew_id, endpoint, p256dh, auth) values ('bbbbbbbb-0000-4000-8000-0000000000c2', 'cccccccc-0000-4000-8000-0000000000c2', 'https://x', 'k', 'a');
select count(*) as calls_0 from net.calls;
insert into checkins (id, crew_id, member_id, place_id, nx, ny, born, life_s) values (gen_random_uuid(), 'cccccccc-0000-4000-8000-0000000000c2', 'aaaaaaaa-0000-4000-8000-0000000000c2', 'm-bar1', .5, .5, now(), 150);
insert into messages (id, crew_id, member_id, type, text, born) values (gen_random_uuid(), 'cccccccc-0000-4000-8000-0000000000c2', 'aaaaaaaa-0000-4000-8000-0000000000c2', 'text', 'hi', now());
insert into messages (id, crew_id, member_id, type, text, born) values (gen_random_uuid(), 'cccccccc-0000-4000-8000-0000000000c2', 'aaaaaaaa-0000-4000-8000-0000000000c2', 'status', 'Lost', now());
select count(*) as calls_after_pin_text_status_expect_0 from net.calls;
insert into messages (id, crew_id, member_id, type, text, born) values (gen_random_uuid(), 'cccccccc-0000-4000-8000-0000000000c2', 'aaaaaaaa-0000-4000-8000-0000000000c2', 'sos', 'SOS', now());
insert into messages (id, crew_id, member_id, type, text, born, to_member) values (gen_random_uuid(), 'cccccccc-0000-4000-8000-0000000000c2', 'aaaaaaaa-0000-4000-8000-0000000000c2', 'sys', 'Ana pinged Leo', now(), 'bbbbbbbb-0000-4000-8000-0000000000c2');
insert into messages (id, crew_id, member_id, type, text, born) values (gen_random_uuid(), 'cccccccc-0000-4000-8000-0000000000c2', 'aaaaaaaa-0000-4000-8000-0000000000c2', 'status', 'set the meet spot: Entrance · Planta 1', now());
select count(*) as calls_after_sos_ping_meet_expect_3 from net.calls;
