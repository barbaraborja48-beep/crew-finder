-- Update 4: PinGü penguins.
--   acc    the one accessory your penguin wears (0 none, 1-9, see src/components/Penguin.tsx)
--   net    your signal, 0 (none) to 3 (great): how fast your penguin moves on friends' phones
--   saver  data saver on: a small leaf badge on your penguin
-- Each is a byte or two, sent only when it changes. Colors can now repeat in a crew;
-- accessories tell same-colored penguins apart.

alter table public.members add column if not exists acc smallint not null default 0 check (acc between 0 and 20);
alter table public.members add column if not exists net smallint check (net between 0 and 3);
alter table public.members add column if not exists saver boolean not null default true;
grant update (acc, net, saver) on public.members to authenticated;

drop index if exists public.members_crew_color;

-- Join without the "color taken" rule.
create or replace function public.join_crew(p_invite text, p_name text, p_color text) returns members
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
  -- Same name already in the crew from another browser or device: move that member here.
  select * into v_member from members
  where crew_id = v_crew.id and lower(name) = lower(trim(p_name)) and user_id <> auth.uid();
  if v_member.id is not null then
    delete from members where crew_id = v_crew.id and user_id = auth.uid();
    update members set user_id = auth.uid(), last_seen = now() where id = v_member.id returning * into v_member;
    insert into member_secrets (member_id) values (v_member.id) on conflict do nothing;
    return v_member;
  end if;
  insert into members (crew_id, user_id, name, color)
  values (v_crew.id, auth.uid(), trim(p_name), lower(p_color))
  on conflict (crew_id, user_id) do update set name = excluded.name, color = excluded.color
  returning * into v_member;
  insert into member_secrets (member_id) values (v_member.id) on conflict do nothing;
  return v_member;
end $$;

-- Sync now also carries accessory, signal and data saver.
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
        acc = coalesce((p_me->>'acc')::smallint, acc),
        net = case when p_me ? 'net' then (p_me->>'net')::smallint else net end,
        saver = coalesce((p_me->>'saver')::boolean, saver),
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
