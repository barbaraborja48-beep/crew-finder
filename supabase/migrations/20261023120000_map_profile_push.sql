-- Update 2: full venue map (all 8 bars, picnic areas, food truck row with
-- real shapes), profile editing, chat history, and push notifications.

-- ─── map ─────────────────────────────────────────────────────────────────

alter table public.places drop constraint places_type_check;
alter table public.places add constraint places_type_check
  check (type in ('stage','wc','bar','water','medic','food','picnic','open'));

-- Outline on the map + close-up view, in map image pixels:
--   {"kind":"counter"|"trucks", "cx","cy" centre, "len" length, "angle" degrees, "depth"}
--   {"kind":"kiosk"|"tables", "cx","cy", "size"}
alter table public.places add column shape jsonb;

-- Show the whole venue (the old frame cut off the bar left of elrow).
update public.venues set view_scale = 0.315, view_ox = 0, view_oy = -74
where id = 'e1e0a000-0000-4000-8000-000000000001';

update public.places p set near = v.near, shape = v.shape::jsonb
from (values
  ('bar1', 'Brunch! & Medical', '{"kind":"counter","cx":1037,"cy":615,"len":75,"angle":0,"depth":22}'),
  ('bar2', 'La Plaza',          '{"kind":"kiosk","cx":510,"cy":688,"size":78}'),
  ('bar3', 'Industry City',     '{"kind":"counter","cx":150,"cy":528,"len":185,"angle":-52,"depth":34}'),
  ('bar4', 'elrow, right',      '{"kind":"counter","cx":382,"cy":995,"len":190,"angle":-65,"depth":30}'),
  ('food', '',                  '{"kind":"trucks","cx":572,"cy":738,"len":292,"angle":-36,"depth":40}')
) as v(id, near, shape)
where p.venue_id = 'e1e0a000-0000-4000-8000-000000000001' and p.id = v.id;

update public.places set type = 'picnic', x = 620, y = 622, shape = '{"kind":"tables","cx":580,"cy":632,"size":72}'
where venue_id = 'e1e0a000-0000-4000-8000-000000000001' and id = 'picnic';

insert into public.places (venue_id, id, type, name, near, x, y, shape)
select 'e1e0a000-0000-4000-8000-000000000001', id, type, name, near, x, y, shape::jsonb from (values
  ('bar5',    'bar',    'Bar',    'elrow, left',       38,  915, '{"kind":"counter","cx":57,"cy":930,"len":185,"angle":-62,"depth":30}'),
  ('bar6',    'bar',    'Bar',    'elrow, back',      133, 1160, '{"kind":"counter","cx":160,"cy":1135,"len":48,"angle":-30,"depth":22}'),
  ('bar7',    'bar',    'Bar',    'Brunch! & Entrada', 1040, 355, '{"kind":"counter","cx":1028,"cy":388,"len":135,"angle":0,"depth":30}'),
  ('bar8',    'bar',    'Bar',    'Brunch!, far end',  1180, 478, '{"kind":"kiosk","cx":1180,"cy":478,"size":50}'),
  ('picnic2', 'picnic', 'Picnic', 'elrow',            212,  765, '{"kind":"tables","cx":205,"cy":712,"size":72}'),
  ('picnic3', 'picnic', 'Picnic', 'Food trucks',      420,  772, '{"kind":"tables","cx":447,"cy":730,"size":72}')
) as t(id, type, name, near, x, y, shape)
on conflict (venue_id, id) do nothing;

-- ─── profile ─────────────────────────────────────────────────────────────
-- Names identify you when you rejoin, colors identify you on the map: both unique per crew.

create unique index members_crew_name on public.members (crew_id, lower(name));
create unique index members_crew_color on public.members (crew_id, lower(color));

-- ─── chat history ────────────────────────────────────────────────────────

alter table public.messages drop constraint messages_type_check;
alter table public.messages add constraint messages_type_check
  check (type in ('text','photo','loc','sys','sos','status'));
alter table public.messages add column to_member uuid references public.members on delete set null;

-- ─── push notifications ──────────────────────────────────────────────────

-- One row. The edge function fills in the VAPID keys on first use.
create table public.push_config (
  id int primary key default 1 check (id = 1),
  functions_url text,
  hook_secret text not null default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  vapid_public text,
  vapid_private text,
  vapid_subject text -- the app's address, recorded the first time a phone asks for the key
);
alter table public.push_config enable row level security; -- no policies: only the server can read it
revoke all on public.push_config from anon, authenticated;

-- Your project's functions address. Change this if you use a different Supabase project.
insert into public.push_config (functions_url) values ('https://ryqtifsfmhfzrgkrbxlm.supabase.co/functions/v1');

create table public.push_subscriptions (
  endpoint text primary key,
  member_id uuid not null references public.members on delete cascade,
  crew_id uuid not null references public.crews on delete cascade,
  p256dh text not null,
  auth text not null,
  updates boolean not null default true, -- check-ins at a new spot, status changes
  chat boolean not null default true,    -- chat messages (SOS and pings always come through)
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon, authenticated;

-- Save this phone's subscription for your member (replaces any older one for the same phone).
create function public.save_push_subscription(p_member uuid, p_endpoint text, p_p256dh text, p_auth text, p_updates boolean, p_chat boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_crew uuid;
begin
  select crew_id into v_crew from members where id = p_member and user_id = auth.uid();
  if v_crew is null then raise exception 'not your member'; end if;
  insert into push_subscriptions (endpoint, member_id, crew_id, p256dh, auth, updates, chat)
  values (p_endpoint, p_member, v_crew, p_p256dh, p_auth, p_updates, p_chat)
  on conflict (endpoint) do update set member_id = excluded.member_id, crew_id = excluded.crew_id,
    p256dh = excluded.p256dh, auth = excluded.auth, updates = excluded.updates, chat = excluded.chat;
end $$;

create function public.remove_push_subscription(p_endpoint text) returns void
language sql security definer set search_path = public as $$
  delete from push_subscriptions s using members m
  where s.endpoint = p_endpoint and m.id = s.member_id and m.user_id = auth.uid();
$$;

revoke execute on function public.save_push_subscription, public.remove_push_subscription from public, anon;
grant execute on function public.save_push_subscription, public.remove_push_subscription to authenticated;

-- Every new check-in spot and message pings the edge function, which sends the notifications.
do $$
begin
  create extension if not exists pg_net;
exception when others then
  raise notice 'pg_net not available: notifications will not be sent';
end $$;

create function public.push_hook() returns trigger
language plpgsql security definer set search_path = public as $$
declare c push_config;
begin
  if not exists (select 1 from push_subscriptions where crew_id = new.crew_id) then return new; end if;
  select * into c from push_config where id = 1;
  if c.functions_url is null then return new; end if;
  perform net.http_post(
    url := c.functions_url || '/push',
    body := jsonb_build_object('table', tg_table_name, 'record', to_jsonb(new)),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-hook-secret', c.hook_secret),
    timeout_milliseconds := 8000);
  return new;
exception when others then
  return new; -- a notification problem must never block a check-in or message
end $$;

create trigger checkins_push after insert on public.checkins for each row execute function public.push_hook();
create trigger messages_push after insert on public.messages for each row execute function public.push_hook();
