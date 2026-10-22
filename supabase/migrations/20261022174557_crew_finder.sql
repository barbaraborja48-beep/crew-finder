-- Crew Finder schema.
-- No accounts: every device signs in anonymously (Supabase anonymous auth),
-- then joins a crew with an invite code. RLS lets you see only your own crew.

-- ─── tables ──────────────────────────────────────────────────────────────

create table public.venues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  event_name text not null default '',
  map_url text not null,
  map_w int not null,
  map_h int not null,
  view_scale real not null default 0.36,   -- how the 390×346 map frame shows the image
  view_ox real not null default -30,
  view_oy real not null default -86,
  event_end timestamptz
);

create table public.places (
  venue_id uuid not null references public.venues on delete cascade,
  id text not null,
  type text not null check (type in ('stage','wc','bar','water','medic','food','open')),
  name text not null,
  near text not null default '',
  n int,                       -- stage number shown as "Stage N"
  x real not null,             -- map IMAGE pixel coords
  y real not null,
  primary key (venue_id, id)
);

create table public.crews (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 40),
  venue_id uuid not null references public.venues,
  invite_code text not null unique,
  meet_spot_place_id text,
  meet_spot_note text not null default '',
  ends_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.members (
  id uuid primary key default gen_random_uuid(),
  crew_id uuid not null references public.crews on delete cascade,
  user_id uuid not null default auth.uid(),
  name text not null check (char_length(name) between 1 and 20),
  color text not null check (color ~ '^#[0-9a-fA-F]{6}$'),
  status int not null default 0 check (status between 0 and 3),
  note text not null default '' check (char_length(note) <= 40),
  battery int check (battery between 0 and 100),
  ghost boolean not null default false,
  last_seen timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (crew_id, user_id)
);

-- Kept apart from members so crewmates can't read each other's Shortcut secret.
create table public.member_secrets (
  member_id uuid primary key references public.members on delete cascade,
  secret text not null default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
);

create table public.checkins (
  id uuid primary key,                      -- client-generated, so retries upsert
  crew_id uuid not null references public.crews on delete cascade,
  member_id uuid not null references public.members on delete cascade,
  place_id text not null,
  nx real not null default 0.5 check (nx between 0 and 1),
  ny real not null default 0.5 check (ny between 0 and 1),
  born timestamptz not null,                -- time of the tap (client clock)
  life_s int not null check (life_s between 0 and 7200),  -- remaining time is capped at 600 s in app logic
  taps int not null default 1,
  created_at timestamptz not null default now()
);
create index checkins_crew_born on public.checkins (crew_id, born desc);
create index checkins_member_born on public.checkins (member_id, born desc);

create table public.messages (
  id uuid primary key,                      -- client-generated
  crew_id uuid not null references public.crews on delete cascade,
  member_id uuid not null references public.members on delete cascade,
  type text not null check (type in ('text','photo','loc','sys','sos')),
  text text not null default '' check (char_length(text) <= 500),
  photo_url text,
  place_id text,
  nx real,
  ny real,
  born timestamptz not null,
  created_at timestamptz not null default now()
);
create index messages_crew_born on public.messages (crew_id, born desc);

-- ─── helpers ─────────────────────────────────────────────────────────────

create function public.is_crew_member(p_crew uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from members where crew_id = p_crew and user_id = auth.uid());
$$;

create function public.owns_member(p_member uuid, p_crew uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from members where id = p_member and crew_id = p_crew and user_id = auth.uid());
$$;

-- "front L", "mid C", "back R", same thirds as the app.
create function public.zone_label(nx real, ny real) returns text
language sql immutable as $$
  select (case when ny < .333 then 'front' when ny < .666 then 'mid' else 'back' end) || ' ' ||
         (case when nx < .333 then 'L' when nx < .666 then 'C' else 'R' end);
$$;

-- ─── RLS ─────────────────────────────────────────────────────────────────

alter table public.venues enable row level security;
alter table public.places enable row level security;
alter table public.crews enable row level security;
alter table public.members enable row level security;
alter table public.member_secrets enable row level security;
alter table public.checkins enable row level security;
alter table public.messages enable row level security;

-- Supabase grants everything to anon/authenticated by default. Tighten it.
revoke all on all tables in schema public from anon;
revoke all on public.member_secrets from authenticated;
revoke insert, update, delete on public.venues, public.places, public.crews, public.members from authenticated;
grant update (meet_spot_place_id, meet_spot_note) on public.crews to authenticated;
grant update (name, color, status, note, battery, ghost, last_seen) on public.members to authenticated;
revoke delete on public.checkins, public.messages from authenticated;

create policy "venues readable" on public.venues for select to authenticated using (true);
create policy "places readable" on public.places for select to authenticated using (true);

create policy "see own crew" on public.crews for select to authenticated
  using (public.is_crew_member(id));
create policy "edit meet spot" on public.crews for update to authenticated
  using (public.is_crew_member(id)) with check (public.is_crew_member(id));

create policy "see crewmates" on public.members for select to authenticated
  using (public.is_crew_member(crew_id));
create policy "edit myself" on public.members for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "see crew checkins" on public.checkins for select to authenticated
  using (public.is_crew_member(crew_id));
create policy "add my checkins" on public.checkins for insert to authenticated
  with check (public.owns_member(member_id, crew_id));
create policy "update my checkins" on public.checkins for update to authenticated
  using (public.owns_member(member_id, crew_id)) with check (public.owns_member(member_id, crew_id));

create policy "see crew messages" on public.messages for select to authenticated
  using (public.is_crew_member(crew_id));
create policy "send my messages" on public.messages for insert to authenticated
  with check (public.owns_member(member_id, crew_id));
create policy "update my messages" on public.messages for update to authenticated
  using (public.owns_member(member_id, crew_id)) with check (public.owns_member(member_id, crew_id));

-- ─── RPCs ────────────────────────────────────────────────────────────────

-- Start a new crew. Returns the invite code; the caller then joins it.
create function public.create_crew(p_name text, p_venue uuid default null) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_venue venues;
  v_code text;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into v_venue from venues where id = coalesce(p_venue, (select id from venues order by event_end desc nulls last limit 1));
  if v_venue.id is null then raise exception 'no venue'; end if;
  loop
    v_code := substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
    exit when not exists (select 1 from crews where invite_code = v_code);
  end loop;
  insert into crews (name, venue_id, invite_code, meet_spot_place_id, meet_spot_note, ends_at)
  values (trim(p_name), v_venue.id, v_code, 'picnic', 'on the hour', v_venue.event_end);
  return v_code;
end $$;

-- What the join screen shows before you pick a name and color.
create function public.crew_preview(p_invite text) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'crew_name', c.name,
    'venue_name', v.name,
    'event_name', v.event_name,
    'taken_colors', coalesce((select json_agg(m.color) from members m where m.crew_id = c.id and m.user_id <> auth.uid()), '[]'::json),
    'members', (select count(*) from members m where m.crew_id = c.id))
  from crews c join venues v on v.id = c.venue_id
  where c.invite_code = lower(trim(p_invite));
$$;

-- Join (or rejoin and rename) a crew. Returns your member row.
create function public.join_crew(p_invite text, p_name text, p_color text) returns members
language plpgsql security definer set search_path = public as $$
declare
  v_crew crews;
  v_member members;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into v_crew from crews where invite_code = lower(trim(p_invite));
  if v_crew.id is null then raise exception 'invite not found'; end if;
  if (select count(*) from members where crew_id = v_crew.id and user_id <> auth.uid()) >= 12 then
    raise exception 'crew is full';
  end if;
  -- Same name already in the crew from another browser or device (an installed
  -- iPhone web app doesn't share storage with Safari): move that member here.
  select * into v_member from members
  where crew_id = v_crew.id and lower(name) = lower(trim(p_name)) and user_id <> auth.uid();
  if v_member.id is not null then
    delete from members where crew_id = v_crew.id and user_id = auth.uid();
    update members set user_id = auth.uid(), last_seen = now() where id = v_member.id returning * into v_member;
    insert into member_secrets (member_id) values (v_member.id) on conflict do nothing;
    return v_member;
  end if;
  if exists (select 1 from members where crew_id = v_crew.id and user_id <> auth.uid() and lower(color) = lower(p_color)) then
    raise exception 'color taken';
  end if;
  insert into members (crew_id, user_id, name, color)
  values (v_crew.id, auth.uid(), trim(p_name), lower(p_color))
  on conflict (crew_id, user_id) do update set name = excluded.name, color = excluded.color
  returning * into v_member;
  insert into member_secrets (member_id) values (v_member.id) on conflict do nothing;
  return v_member;
end $$;

-- Your own Shortcut secret (for the setup page).
create function public.my_shortcut_secret(p_member uuid) returns text
language sql stable security definer set search_path = public as $$
  select s.secret from member_secrets s join members m on m.id = s.member_id
  where m.id = p_member and m.user_id = auth.uid();
$$;

-- One-tap check-in from the iOS Shortcut. Called with the anon key, so it
-- checks the per-member secret itself.
--   p_type null            → extend your live dot (+60 s, taps+1), or re-light it at your last place, mid C
--   p_type 'wc'|'bar'|...  → check in at the nearest place of that type to your last spot
create function public.quick_checkin(member_id uuid, secret text, p_type text default null) returns json
language plpgsql security definer set search_path = public as $$
declare
  v_member members;
  v_last checkins;
  v_place places;
  v_from places;
  v_venue uuid;
  v_rem real;
  v_life int;
  v_id uuid;
  v_label text;
begin
  select m.* into v_member from members m join member_secrets s on s.member_id = m.id
  where m.id = quick_checkin.member_id and s.secret = quick_checkin.secret;
  if v_member.id is null then
    return json_build_object('ok', false, 'message', 'Not recognised. Redo the Shortcut setup in the app.');
  end if;
  if v_member.ghost then
    return json_build_object('ok', false, 'message', 'Ghost mode is on, nothing shared.');
  end if;

  select venue_id into v_venue from crews where id = v_member.crew_id;
  select * into v_last from checkins c where c.member_id = v_member.id order by born desc limit 1;

  if p_type is not null then
    select * into v_from from places where venue_id = v_venue and id = v_last.place_id;
    select * into v_place from places p where p.venue_id = v_venue and p.type = p_type
      order by (p.x - coalesce(v_from.x, 600)) ^ 2 + (p.y - coalesce(v_from.y, 600)) ^ 2 limit 1;
    if v_place.id is null then
      return json_build_object('ok', false, 'message', 'No ' || p_type || ' on this map.');
    end if;
  elsif v_last.id is null then
    return json_build_object('ok', false, 'message', 'Open the app and check in once first.');
  else
    select * into v_place from places where venue_id = v_venue and id = v_last.place_id;
  end if;

  v_rem := case when v_last.id is null then 0
                else extract(epoch from (v_last.born + make_interval(secs => v_last.life_s) - now())) end;

  if v_rem > 0 and v_last.place_id = v_place.id then
    -- Same place and still glowing: treat like a repeat tap.
    v_life := least(600, ceil(v_rem)::int + 60);
    update checkins set born = now(), life_s = v_life, taps = taps + 1 where id = v_last.id;
    v_id := v_last.id;
  else
    v_life := 150;
    v_id := gen_random_uuid();
    insert into checkins (id, crew_id, member_id, place_id, nx, ny, born, life_s, taps)
    values (v_id, v_member.crew_id, v_member.id, v_place.id, .5, .5, now(), v_life, 1);
  end if;
  update members set last_seen = now() where id = v_member.id;

  v_label := case when v_place.type = 'stage' then v_place.name || ' · ' || zone_label(
                    case when v_id = v_last.id then v_last.nx else .5 end,
                    case when v_id = v_last.id then v_last.ny else .5 end)
                  when v_place.near <> '' then v_place.name || ' · by ' || v_place.near
                  else v_place.name end;
  return json_build_object('ok', true,
    'message', 'Checked in · ' || v_label || ' · ' || (v_life / 60) || ':' || lpad((v_life % 60)::text, 2, '0'),
    'place', v_label, 'life_s', v_life);
end $$;

revoke execute on all functions in schema public from public, anon;
grant execute on function public.create_crew, public.crew_preview, public.join_crew,
  public.my_shortcut_secret, public.is_crew_member, public.owns_member, public.zone_label to authenticated;
grant execute on function public.quick_checkin to anon, authenticated;

-- ─── realtime ────────────────────────────────────────────────────────────

alter publication supabase_realtime add table public.checkins, public.messages, public.members, public.crews;

-- ─── photo storage ───────────────────────────────────────────────────────
-- Public-read bucket with random file names; only crew members can upload,
-- and only into their crew's folder: photos/<crew_id>/<uuid>.jpg

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', true, 1048576, array['image/jpeg'])
on conflict (id) do nothing;

create policy "crew uploads photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and public.is_crew_member(((storage.foldername(name))[1])::uuid));
create policy "crew reads photos" on storage.objects for select to authenticated
  using (bucket_id = 'photos' and public.is_crew_member(((storage.foldername(name))[1])::uuid));

-- ─── cleanup: delete crew data 48 h after the event ─────────────────────

create function public.purge_old_crews() returns int
language sql security definer set search_path = public as $$
  with gone as (delete from crews where ends_at < now() - interval '48 hours' returning 1)
  select count(*)::int from gone;
$$;
revoke execute on function public.purge_old_crews from authenticated;

do $$
begin
  create extension if not exists pg_cron with schema pg_catalog;
  perform cron.schedule('purge-old-crews', '17 * * * *', 'select public.purge_old_crews()');
exception when others then
  raise notice 'pg_cron not available, run select public.purge_old_crews() by hand after the event';
end $$;
