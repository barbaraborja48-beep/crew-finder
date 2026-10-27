-- Update 12: insights, and a tidier festival map.
--
-- 1. app_events: a few moments the database can't see on its own, sent along with the syncs
--    phones already make (no extra requests): app opened, intro tour finished or skipped, how
--    long each pin waited for signal, low data mode switched, lineup opened. Each carries who
--    (member id and name), the crew and venue. Only readable from the Supabase dashboard.
-- 2. Saved before the 48 h cleanup deletes a crew, so the night can be looked at later:
--      night_stats     one row of totals per crew (pins per place and hour, message types,
--                      buddies, plans, most-starred sets, mutes, low data, notifications)
--      night_members   who was in it (name, colour, penguin, pins per place)
--      night_pins      every pin, with the person's name
--      night_messages  every message, with the sender's (and recipient's) name
--    purge_old_crews() now saves them first; select public.save_night_stats() saves every
--    crew right now. Only readable from the Supabase dashboard.
-- 3. crew_sync takes p_events. Older app versions keep working without it.
-- 4. The Halloween map without the poster title, legends and "Sitemap" (a new file name, so
--    phones that saved the old map pick up the new one).

create table if not exists public.app_events (
  id bigint generated always as identity primary key,
  eid text unique,   -- the phone's own id for it, so a resend after a lost reply counts once
  at timestamptz not null default now(),
  kind text not null,
  value double precision,
  meta jsonb,
  device text,       -- random per phone
  member_id uuid,    -- no links: events outlive the crew and its members
  member_name text,
  crew_id uuid,
  venue_id uuid
);
create index if not exists app_events_kind_at on public.app_events (kind, at);
alter table public.app_events enable row level security; -- no policies: dashboard only
revoke all on public.app_events from anon, authenticated;

create table if not exists public.night_stats (
  crew_id uuid primary key, -- no link: the crew itself is deleted after the event
  venue_id uuid,
  event text,
  crew_created timestamptz,
  members int,
  pins int,            -- spots pinned
  pin_taps int,        -- including "still here" re-pins
  pins_by_place jsonb, -- place id → spots
  pins_by_hour jsonb,  -- "2026-10-31 23" (Madrid time) → spots
  messages_by_type jsonb,
  buddy_groups int,
  buddied_members int,
  plans int,
  shared_plans int,
  stars jsonb,         -- "stage|start" → how many starred it
  mutes int,
  low_data int,
  notifications int,
  saved_at timestamptz not null default now()
);
alter table public.night_stats enable row level security;
revoke all on public.night_stats from anon, authenticated;

create table if not exists public.night_members (
  member_id uuid primary key, -- no links: kept after the crew is deleted
  crew_id uuid,
  crew_name text,
  event text,
  name text,
  color text,
  acc smallint,
  joined timestamptz,
  pins int,
  pins_by_place jsonb,
  saved_at timestamptz not null default now()
);
create table if not exists public.night_pins (
  id uuid primary key,
  crew_id uuid,
  member_id uuid,
  member_name text,
  place_id text,
  nx real,
  ny real,
  born timestamptz,
  first_pinned timestamptz,
  taps int
);
create table if not exists public.night_messages (
  id uuid primary key,
  crew_id uuid,
  member_id uuid,
  member_name text,
  type text,
  text text,
  photo_url text,
  place_id text,
  to_name text,
  meta jsonb,
  born timestamptz
);
alter table public.night_members enable row level security;
alter table public.night_pins enable row level security;
alter table public.night_messages enable row level security;
revoke all on public.night_members, public.night_pins, public.night_messages from anon, authenticated;

-- Save (or refresh) the totals for one crew, or every crew when called with no argument.
create or replace function public.save_night_stats(p_crew uuid default null) returns int
language plpgsql security definer set search_path = public as $$
declare v_saved int;
begin
  insert into night_stats as s (crew_id, venue_id, event, crew_created, members, pins, pin_taps, pins_by_place, pins_by_hour,
    messages_by_type, buddy_groups, buddied_members, plans, shared_plans, stars, mutes, low_data, notifications, saved_at)
  select c.id, c.venue_id, v.event_name, c.created_at,
    (select count(*) from members m where m.crew_id = c.id),
    (select count(*) from checkins k where k.crew_id = c.id),
    (select coalesce(sum(k.taps), 0) from checkins k where k.crew_id = c.id),
    (select coalesce(jsonb_object_agg(place_id, n), '{}') from (select place_id, count(*) n from checkins where crew_id = c.id group by 1) x),
    (select coalesce(jsonb_object_agg(h, n), '{}') from (select to_char(born at time zone 'Europe/Madrid', 'YYYY-MM-DD HH24') h, count(*) n from checkins where crew_id = c.id group by 1) x),
    (select coalesce(jsonb_object_agg(type, n), '{}') from (select type, count(*) n from messages where crew_id = c.id group by 1) x),
    (select count(*) from (select buddy from members where crew_id = c.id and buddy is not null group by buddy having count(*) > 1) g),
    (select coalesce(sum(k), 0) from (select count(*) k from members where crew_id = c.id and buddy is not null group by buddy having count(*) > 1) g),
    (select count(*) from member_prefs p where p.crew_id = c.id and jsonb_array_length(p.plan) > 0),
    (select count(*) from member_prefs p where p.crew_id = c.id and p.plan_shared and jsonb_array_length(p.plan) > 0),
    (select coalesce(jsonb_object_agg(k, n), '{}') from (select i->>'k' k, count(*) n from member_prefs p, jsonb_array_elements(p.plan) i where p.crew_id = c.id group by 1) x),
    (select count(*) from member_prefs p where p.crew_id = c.id and cardinality(p.mutes) > 0),
    (select count(*) from members m where m.crew_id = c.id and m.saver),
    (select count(distinct member_id) from push_subscriptions s where s.crew_id = c.id),
    now()
  from crews c join venues v on v.id = c.venue_id
  where p_crew is null or c.id = p_crew
  on conflict (crew_id) do update set members = excluded.members, pins = excluded.pins, pin_taps = excluded.pin_taps,
    pins_by_place = excluded.pins_by_place, pins_by_hour = excluded.pins_by_hour, messages_by_type = excluded.messages_by_type,
    buddy_groups = excluded.buddy_groups, buddied_members = excluded.buddied_members, plans = excluded.plans,
    shared_plans = excluded.shared_plans, stars = excluded.stars, mutes = excluded.mutes, low_data = excluded.low_data,
    notifications = excluded.notifications, saved_at = excluded.saved_at;
  get diagnostics v_saved = row_count;

  insert into night_members as x (member_id, crew_id, crew_name, event, name, color, acc, joined, pins, pins_by_place, saved_at)
  select m.id, m.crew_id, c.name, v.event_name, m.name, m.color, m.acc, m.created_at,
         (select count(*) from checkins k where k.member_id = m.id),
         (select coalesce(jsonb_object_agg(place_id, n), '{}') from (select place_id, count(*) n from checkins where member_id = m.id group by 1) y),
         now()
  from members m join crews c on c.id = m.crew_id join venues v on v.id = c.venue_id
  where p_crew is null or m.crew_id = p_crew
  on conflict (member_id) do update set name = excluded.name, color = excluded.color, acc = excluded.acc,
    pins = excluded.pins, pins_by_place = excluded.pins_by_place, saved_at = excluded.saved_at;

  insert into night_pins (id, crew_id, member_id, member_name, place_id, nx, ny, born, first_pinned, taps)
  select k.id, k.crew_id, k.member_id, m.name, k.place_id, k.nx, k.ny, k.born, k.created_at, k.taps
  from checkins k join members m on m.id = k.member_id
  where p_crew is null or k.crew_id = p_crew
  on conflict (id) do update set place_id = excluded.place_id, nx = excluded.nx, ny = excluded.ny, born = excluded.born, taps = excluded.taps;

  insert into night_messages (id, crew_id, member_id, member_name, type, text, photo_url, place_id, to_name, meta, born)
  select g.id, g.crew_id, g.member_id, m.name, g.type, g.text, g.photo_url, g.place_id, t.name, g.meta, g.born
  from messages g join members m on m.id = g.member_id left join members t on t.id = g.to_member
  where p_crew is null or g.crew_id = p_crew
  on conflict (id) do nothing;

  return v_saved;
end $$;

-- The cleanup (48 h after the event) now keeps the totals first. If saving them ever fails,
-- the crews are still deleted on time: the privacy promise comes before the stats.
create or replace function public.purge_old_crews() returns int
language plpgsql security definer set search_path = public as $$
declare v_gone int;
begin
  begin
    perform save_night_stats(id) from crews where ends_at < now() - interval '48 hours';
  exception when others then
    raise notice 'night stats not saved: %', sqlerrm;
  end;
  with gone as (delete from crews where ends_at < now() - interval '48 hours' returning 1)
  select count(*)::int into v_gone from gone;
  return v_gone;
end $$;
revoke execute on function public.save_night_stats, public.purge_old_crews from public, anon, authenticated;

drop function if exists public.crew_sync(uuid, timestamptz, text, jsonb, jsonb, jsonb, jsonb, jsonb);
create or replace function public.crew_sync(
  p_member uuid,
  p_since timestamptz default null,
  p_places text default null,
  p_checkins jsonb default '[]',
  p_messages jsonb default '[]',
  p_me jsonb default null,
  p_crew jsonb default null,
  p_prefs jsonb default null,
  p_events jsonb default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  m members;
  v_now timestamptz := clock_timestamp();
  v_since timestamptz;
  v_venue uuid;
  v_hash text;
  v_rejected text[] := '{}';
  v_out jsonb;
begin
  select * into m from members where id = p_member and user_id = auth.uid();
  if m.id is null then
    return jsonb_build_object('gone', true); -- crew deleted, or you rejoined on another phone
  end if;

  -- writes: each part on its own, so one bad item can't block the rest
  begin
    insert into checkins (id, crew_id, member_id, place_id, nx, ny, born, life_s, taps)
    select (c->>'i')::uuid, m.crew_id, m.id, c->>'p', (c->>'x')::real, (c->>'y')::real,
           case when c ? 'a' then v_now - make_interval(secs => greatest(0, (c->>'a')::double precision) / 1000)
                else to_timestamp((c->>'b')::double precision / 1000) end,
           coalesce((c->>'l')::int, 150), coalesce((c->>'t')::int, 1)
    from jsonb_array_elements(coalesce(p_checkins, '[]')) c
    on conflict (id) do update set place_id = excluded.place_id, nx = excluded.nx, ny = excluded.ny,
      born = excluded.born, life_s = excluded.life_s, taps = excluded.taps
      where checkins.member_id = m.id;
  exception when others then
    v_rejected := array_append(v_rejected, 'checkins');
  end;

  begin
    insert into messages (id, crew_id, member_id, type, text, photo_url, place_id, nx, ny, born, to_member, meta)
    select (j->>'i')::uuid, m.crew_id, m.id, j->>'k', coalesce(j->>'tx', ''), j->>'u', j->>'p',
           (j->>'x')::real, (j->>'y')::real,
           case when j ? 'a' then v_now - make_interval(secs => greatest(0, (j->>'a')::double precision) / 1000)
                else to_timestamp((j->>'b')::double precision / 1000) end,
           (j->>'to')::uuid, j->'m'
    from jsonb_array_elements(coalesce(p_messages, '[]')) j
    on conflict (id) do nothing;
  exception when others then
    v_rejected := array_append(v_rejected, 'messages');
  end;

  if p_me is not null then
    begin
      update members set
        name = coalesce(nullif(trim(p_me->>'name'), ''), name),
        color = coalesce(lower(p_me->>'color'), color),
        status = coalesce((p_me->>'status')::int, status),
        note = coalesce(p_me->>'note', note),
        battery = case when p_me ? 'battery' then (p_me->>'battery')::int else battery end,
        ghost = coalesce((p_me->>'ghost')::boolean, ghost),
        acc = coalesce((p_me->>'acc')::smallint, acc),
        net = case when p_me ? 'net' then (p_me->>'net')::smallint else net end,
        saver = coalesce((p_me->>'saver')::boolean, saver),
        buddy = case when p_me ? 'buddy' then (p_me->>'buddy')::uuid else buddy end,
        last_seen = now()
      where id = m.id;
    exception when others then
      v_rejected := array_append(v_rejected, 'me'); -- e.g. a name someone else in the crew already has
    end;
  end if;

  if p_crew is not null then
    update crews set
      meet_spot_place_id = coalesce(p_crew->>'meet_spot_place_id', meet_spot_place_id),
      meet_spot_note = coalesce(p_crew->>'meet_spot_note', meet_spot_note)
    where id = m.crew_id;
  end if;

  if p_prefs is not null then
    begin
      insert into member_prefs as x (member_id, crew_id, mutes, plan, plan_shared)
      values (m.id, m.crew_id,
              coalesce((select array_agg(e::uuid) from jsonb_array_elements_text(p_prefs->'mutes') e), '{}'),
              coalesce(p_prefs->'plan', '[]'), coalesce((p_prefs->>'plan_shared')::boolean, false))
      on conflict (member_id) do update set
        mutes = case when p_prefs ? 'mutes' then excluded.mutes else x.mutes end,
        plan = case when p_prefs ? 'plan' then excluded.plan else x.plan end,
        plan_shared = case when p_prefs ? 'plan_shared' then excluded.plan_shared else x.plan_shared end;
    exception when others then
      v_rejected := array_append(v_rejected, 'prefs');
    end;
  end if;

  -- app events, with who and where they happened
  if jsonb_typeof(p_events) = 'array' then
    begin
      insert into app_events (eid, at, kind, value, meta, device, member_id, member_name, crew_id, venue_id)
      select left(e->>'i', 24), v_now - make_interval(secs => least(greatest(0, coalesce((e->>'a')::double precision, 0)), 6048e5) / 1000),
             left(e->>'k', 24), (e->>'v')::double precision,
             case when jsonb_typeof(e->'m') = 'object' and length((e->'m')::text) <= 300 then e->'m' end,
             left(e->>'d', 16), m.id, m.name, m.crew_id, (select venue_id from crews where id = m.crew_id)
      from (select e from jsonb_array_elements(p_events) e limit 50) x
      where e->>'k' is not null
      on conflict (eid) do nothing;
    exception when others then
      v_rejected := array_append(v_rejected, 'events');
    end;
  end if;

  -- reads: a little overlap so rows committed at the same moment are never missed
  v_since := coalesce(p_since - interval '10 seconds', '-infinity'::timestamptz);
  select venue_id into v_venue from crews where id = m.crew_id;
  select md5(coalesce((select string_agg(to_jsonb(p)::text, ',' order by p.id) from places p where p.venue_id = v.id), '') || to_jsonb(v)::text)
    into v_hash from venues v where v.id = v_venue;

  v_out := jsonb_build_object(
    'now', v_now,
    'rejected', to_jsonb(v_rejected),
    'members', (select coalesce(jsonb_agg(to_jsonb(x) - 'crew_id' - 'user_id' - 'updated_at'), '[]')
                from members x where x.crew_id = m.crew_id and x.updated_at > v_since),
    'checkins', (select coalesce(jsonb_agg(jsonb_build_array(c.id, c.member_id, c.place_id, round(c.nx::numeric, 3), round(c.ny::numeric, 3),
                   (extract(epoch from c.born) * 1000)::bigint, c.life_s, c.taps, (extract(epoch from c.created_at) * 1000)::bigint)), '[]')
                 from (select * from checkins where crew_id = m.crew_id and updated_at > v_since and born > now() - interval '12 hours'
                       order by born desc limit 500) c),
    'messages', (select coalesce(jsonb_agg(jsonb_build_array(g.id, g.member_id, g.type, g.text, g.photo_url, g.place_id,
                   round(g.nx::numeric, 3), round(g.ny::numeric, 3), (extract(epoch from g.born) * 1000)::bigint, g.to_member, g.meta)), '[]')
                 from (select * from messages where crew_id = m.crew_id and updated_at > v_since order by born desc limit 300) g),
    'plans', (select coalesce(jsonb_agg(jsonb_build_array(x.member_id, case when x.plan_shared then x.plan end)), '[]')
              from member_prefs x where x.crew_id = m.crew_id and x.member_id <> m.id and x.updated_at > v_since)
  );
  if p_since is null then
    v_out := v_out || jsonb_build_object('prefs', (select jsonb_build_object('mutes', to_jsonb(x.mutes), 'plan', x.plan, 'plan_shared', x.plan_shared)
                                                   from member_prefs x where x.member_id = m.id));
  end if;
  if p_since is null or exists (select 1 from crews where id = m.crew_id and updated_at > v_since) then
    v_out := v_out || jsonb_build_object('crew', (select to_jsonb(c) - 'created_at' - 'updated_at' - 'ends_at' from crews c where c.id = m.crew_id));
  end if;
  if p_places is distinct from v_hash then
    v_out := v_out || jsonb_build_object(
      'places_hash', v_hash,
      'venue', (select to_jsonb(v) - 'event_end' from venues v where v.id = v_venue),
      'places', (select jsonb_agg(jsonb_strip_nulls(to_jsonb(p) - 'venue_id')) from places p where p.venue_id = v_venue));
  end if;
  return v_out;
end $$;

revoke execute on function public.crew_sync from public, anon;
grant execute on function public.crew_sync to authenticated;

-- 4 ─────────────────────────────────────────────────────────────────────
update public.venues set map_url = '/assets/elrow-map-v2.webp' where id = 'e1e0a000-0000-4000-8000-000000000001';

select 'insights ready' as result;
