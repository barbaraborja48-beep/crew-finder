-- Update 3: low-data sync.
-- One request per sync: the phone sends everything it has queued and gets back
-- only what changed since its last sync, in a compact format.

-- ─── change tracking ─────────────────────────────────────────────────────

alter table public.checkins add column if not exists updated_at timestamptz not null default now();
alter table public.messages add column if not exists updated_at timestamptz not null default now();
alter table public.members add column if not exists updated_at timestamptz not null default now();
alter table public.crews add column if not exists updated_at timestamptz not null default now();

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists checkins_touch on public.checkins;
drop trigger if exists messages_touch on public.messages;
drop trigger if exists members_touch on public.members;
drop trigger if exists crews_touch on public.crews;
create trigger checkins_touch before update on public.checkins for each row execute function public.touch_updated_at();
create trigger messages_touch before update on public.messages for each row execute function public.touch_updated_at();
create trigger members_touch before update on public.members for each row execute function public.touch_updated_at();
create trigger crews_touch before update on public.crews for each row execute function public.touch_updated_at();

create index if not exists checkins_crew_updated on public.checkins (crew_id, updated_at);
create index if not exists messages_crew_updated on public.messages (crew_id, updated_at);
create index if not exists members_crew_updated on public.members (crew_id, updated_at);

-- ─── the sync call ───────────────────────────────────────────────────────
-- Writes (compact keys to save bytes):
--   p_checkins  [{i id, p place, x nx, y ny, b born ms, l life_s, t taps}]
--   p_messages  [{i, k type, tx text, u photo_url, p, x, y, b, to}]
--   p_me        {name, color, status, note, battery, ghost}   (only what changed)
--   p_crew      {meet_spot_place_id, meet_spot_note}
-- Reads, everything since p_since (null = first sync):
--   checkins  [[id, member, place, nx, ny, born ms, life_s, taps, created ms]]
--   messages  [[id, member, type, text, photo_url, place, nx, ny, born ms, to_member]]
--   members, crew as objects; venue + places only when p_places (a hash) is out of date.

create or replace function public.crew_sync(
  p_member uuid,
  p_since timestamptz default null,
  p_places text default null,
  p_checkins jsonb default '[]',
  p_messages jsonb default '[]',
  p_me jsonb default null,
  p_crew jsonb default null
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
           to_timestamp((c->>'b')::double precision / 1000), (c->>'l')::int, coalesce((c->>'t')::int, 1)
    from jsonb_array_elements(coalesce(p_checkins, '[]')) c
    on conflict (id) do update set place_id = excluded.place_id, nx = excluded.nx, ny = excluded.ny,
      born = excluded.born, life_s = excluded.life_s, taps = excluded.taps
      where checkins.member_id = m.id;
  exception when others then
    v_rejected := array_append(v_rejected, 'checkins');
  end;

  begin
    insert into messages (id, crew_id, member_id, type, text, photo_url, place_id, nx, ny, born, to_member)
    select (j->>'i')::uuid, m.crew_id, m.id, j->>'k', coalesce(j->>'tx', ''), j->>'u', j->>'p',
           (j->>'x')::real, (j->>'y')::real, to_timestamp((j->>'b')::double precision / 1000), (j->>'to')::uuid
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
        last_seen = now()
      where id = m.id;
    exception when others then
      v_rejected := array_append(v_rejected, 'me'); -- e.g. someone grabbed that color a moment earlier
    end;
  end if;

  if p_crew is not null then
    update crews set
      meet_spot_place_id = coalesce(p_crew->>'meet_spot_place_id', meet_spot_place_id),
      meet_spot_note = coalesce(p_crew->>'meet_spot_note', meet_spot_note)
    where id = m.crew_id;
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
                   round(g.nx::numeric, 3), round(g.ny::numeric, 3), (extract(epoch from g.born) * 1000)::bigint, g.to_member)), '[]')
                 from (select * from messages where crew_id = m.crew_id and updated_at > v_since order by born desc limit 300) g)
  );
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
