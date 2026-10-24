-- Update 5: pins don't expire, and their times are right.
--
-- 1. The app now sends how long ago each pin or message happened ("a", in ms) instead
--    of only its own clock time. The server stamps it as "its now minus that", so a pin
--    that sat in the outbox for ten minutes shows as ten minutes old, and a phone with
--    the wrong time can't make pins look newer or older than they are.
-- 2. The iPhone Shortcut re-pins you ("still here") instead of adding time to a countdown.

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
    insert into messages (id, crew_id, member_id, type, text, photo_url, place_id, nx, ny, born, to_member)
    select (j->>'i')::uuid, m.crew_id, m.id, j->>'k', coalesce(j->>'tx', ''), j->>'u', j->>'p',
           (j->>'x')::real, (j->>'y')::real,
           case when j ? 'a' then v_now - make_interval(secs => greatest(0, (j->>'a')::double precision) / 1000)
                else to_timestamp((j->>'b')::double precision / 1000) end,
           (j->>'to')::uuid
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

-- One-touch pin from the iOS Shortcut. Called with the anon key, so it checks the
-- per-member secret itself.
--   p_type null            → re-pin at your last spot ("still here")
--   p_type 'wc'|'bar'|...  → pin at the nearest place of that type to your last spot
create or replace function public.quick_checkin(member_id uuid, secret text, p_type text default null) returns json
language plpgsql security definer set search_path = public as $$
declare
  v_member members;
  v_last checkins;
  v_place places;
  v_from places;
  v_venue uuid;
  v_id uuid;
  v_nx real := .5;
  v_ny real := .5;
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
    return json_build_object('ok', false, 'message', 'Open the app and pin once first.');
  else
    select * into v_place from places where venue_id = v_venue and id = v_last.place_id;
  end if;

  if v_last.id is not null and v_last.place_id = v_place.id then
    -- Same place: "still here". Keep the spot, reset the time.
    update checkins set born = now(), taps = taps + 1 where id = v_last.id;
    v_id := v_last.id;
    v_nx := v_last.nx;
    v_ny := v_last.ny;
  else
    v_id := gen_random_uuid();
    insert into checkins (id, crew_id, member_id, place_id, nx, ny, born, life_s, taps)
    values (v_id, v_member.crew_id, v_member.id, v_place.id, .5, .5, now(), 150, 1);
  end if;
  update members set last_seen = now() where id = v_member.id;

  v_label := case when v_place.type = 'stage' then v_place.name || ' · ' || zone_label(v_nx, v_ny)
                  when v_place.near <> '' then v_place.name || ' · by ' || v_place.near
                  else v_place.name end;
  return json_build_object('ok', true, 'message', 'Pinned · ' || v_label, 'place', v_label);
end $$;

revoke execute on function public.quick_checkin from public;
grant execute on function public.quick_checkin to anon, authenticated;
