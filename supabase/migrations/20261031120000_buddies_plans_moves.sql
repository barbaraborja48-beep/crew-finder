-- Update 10: buddies, muting, set plans with reminders, planned moves, Halloween DJ screens.
--
-- 1. Halloween lineup: every set, per stage (venues.lineup entries now carry "stage").
--    Mondo's lineup has no stage and keeps working as before.
-- 2. Buddy up: members.buddy is a group id. Everyone with the same id moves together on the
--    map (the app shows the group at its newest pin). Letting someone go clears theirs.
-- 3. messages.meta: extra details for the new message types
--      buddy  "wants to buddy up" (to_member = who's invited)
--      move   a planned move: {in: minutes, with: [member ids]}, or {cancel: id} / {decline: id}
--      guess  "probably at WC" for someone who wandered off: {letgo: true} also lets them go
-- 4. member_prefs: who you muted and your set plan (shared with the crew only if you say so).
--    Not readable directly; crew_sync hands out your own and the shared plans.
-- 5. reminders: set reminders and planned moves, sent by a job that runs every minute.
-- The rest of the app, the Mondo venue and existing crews don't change.

-- 1 ─────────────────────────────────────────────────────────────────────
-- Sat 31 Oct 2026, Madrid time (+01, clocks went back on the 25th). Sets after midnight are 1 Nov.
update public.venues set lineup = (
  select jsonb_agg(jsonb_build_object('stage', s, 'name', n,
           'start', to_char(d + a, 'YYYY-MM-DD"T"HH24:MI:SS"+01:00"'),
           'end', to_char(d + b, 'YYYY-MM-DD"T"HH24:MI:SS"+01:00"')) order by s, a)
  from (values
    ('elrow', 'Esther Bronchal',            '14:00'::interval, '16:30'::interval),
    ('elrow', 'Rendher B2B Easttown',       '16:30', '18:00'),
    ('elrow', 'The Martinez Brothers',      '18:00', '19:30'),
    ('elrow', 'Manda Moor B2B Sirus Hood',  '19:30', '21:00'),
    ('elrow', 'Crusy B2B Calussa',          '21:00', '22:30'),
    ('elrow', 'Chelina Manuhutu',           '22:30', '24:00'),
    ('elrow', 'Marco Faraone',              '24:00', '26:00'),
    ('brunch', 'Julia Linkogel',            '14:00', '16:00'),
    ('brunch', 'Mariano Mellino',           '16:00', '20:00'),
    ('brunch', 'Kölsch',                    '20:00', '22:00'),
    ('brunch', 'Maceo Plex',                '22:00', '24:00'),
    ('brunch', 'Colyn',                     '24:00', '26:00'),
    ('industry', 'Mika Heggemann',          '14:00', '16:00'),
    ('industry', 'ØTTA',                    '16:00', '18:00'),
    ('industry', 'DJ Gigola',               '18:00', '19:30'),
    ('industry', 'Prada2000',               '19:30', '21:00'),
    ('industry', 'Fatima Hajji',            '21:00', '23:00'),
    ('industry', 'Anxhela',                 '23:00', '24:30'),
    ('industry', 'Lee Ann Roberts',         '24:30', '26:00'),
    ('plaza', 'Elrondealdo',                '14:00', '15:30'),
    ('plaza', 'Andreales',                  '15:30', '17:00'),
    ('plaza', 'Barna92',                    '17:00', '18:30'),
    ('plaza', 'Ryota',                      '18:30', '20:00'),
    ('plaza', 'What So Not',                '20:00', '21:30'),
    ('plaza', 'Yosef',                      '21:30', '23:00'),
    ('plaza', 'Panteros666',                '23:00', '24:30'),
    ('plaza', 'Inexxstable B2B Clandestine','24:30', '26:00'),
    ('jail', 'Kerco',                       '14:00', '15:30'),
    ('jail', 'Djanu B2B Mr. Martin',        '15:30', '17:00'),
    ('jail', 'Cortezz',                     '17:00', '18:30'),
    ('jail', 'Oravla Ziur',                 '18:30', '20:00'),
    ('jail', 'Yins',                        '20:00', '21:30'),
    ('jail', 'Hadex',                       '21:30', '23:00'),
    ('jail', 'Javi Galan',                  '23:00', '24:30'),
    ('jail', 'Yannik',                      '24:30', '26:00')
  ) as t(s, n, a, b), (select timestamp '2026-10-31 00:00' as d) day
) where id = 'e1e0a000-0000-4000-8000-000000000001';

-- 2 ─────────────────────────────────────────────────────────────────────
alter table public.members add column if not exists buddy uuid;
grant update (buddy) on public.members to authenticated;

-- 3 ─────────────────────────────────────────────────────────────────────
alter table public.messages add column if not exists meta jsonb;
alter table public.messages drop constraint if exists messages_type_check;
alter table public.messages add constraint messages_type_check
  check (type in ('text','photo','loc','sys','sos','status','buddy','move','guess'));

-- 4 ─────────────────────────────────────────────────────────────────────
create table if not exists public.member_prefs (
  member_id uuid primary key references public.members on delete cascade,
  crew_id uuid not null references public.crews on delete cascade,
  mutes uuid[] not null default '{}',          -- no pin, chat or ping notifications from these people
  plan jsonb not null default '[]',            -- [{k: "stage|start", r: minutes before (null = no reminder), f: switch time}]
  plan_shared boolean not null default false,  -- crewmates can see your plan on your profile
  updated_at timestamptz not null default now()
);
alter table public.member_prefs enable row level security; -- no policies: crew_sync hands it out
revoke all on public.member_prefs from anon, authenticated;
create index if not exists member_prefs_crew on public.member_prefs (crew_id, updated_at);
drop trigger if exists member_prefs_touch on public.member_prefs;
create trigger member_prefs_touch before update on public.member_prefs for each row execute function public.touch_updated_at();

-- 5 ─────────────────────────────────────────────────────────────────────
create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members on delete cascade, -- who gets it
  crew_id uuid not null references public.crews on delete cascade,
  kind text not null check (kind in ('set', 'move')),
  ref text not null,           -- plan item key, or the move message id
  due_at timestamptz not null,
  title text not null,
  body text not null default '',
  open text not null default 'map',
  place text,                  -- the stage to open, for set reminders
  sent_at timestamptz
);
alter table public.reminders enable row level security;
revoke all on public.reminders from anon, authenticated;
create index if not exists reminders_due on public.reminders (due_at) where sent_at is null;

-- "WC", "Bar · elrow, left", "Brunch!"
create or replace function public.place_label(p_venue uuid, p_place text) returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select case when p.type <> 'stage' and p.near <> '' then p.name || ' · ' || p.near else p.name end
                   from places p where p.venue_id = p_venue and p.id = p_place), 'the spot');
$$;

-- Your plan changed: redo your upcoming set reminders.
create or replace function public.plan_reminders() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_venue uuid;
begin
  if tg_op = 'UPDATE' and new.plan is not distinct from old.plan then return new; end if;
  delete from reminders where member_id = new.member_id and kind = 'set' and sent_at is null;
  select venue_id into v_venue from crews where id = new.crew_id;
  insert into reminders (member_id, crew_id, kind, ref, due_at, title, body, open, place)
  select new.member_id, new.crew_id, 'set', i->>'k', t.at - make_interval(mins => (i->>'r')::int),
         case when i ? 'f' and (i->>'r')::int = 0 then 'Time to switch: ' || (e->>'name')
              when i ? 'f' then 'Switch to ' || (e->>'name') || ' in ' || (i->>'r') || ' min'
              when (i->>'r')::int = 0 then (e->>'name') || ' starts now'
              else (e->>'name') || ' in ' || (i->>'r') || ' min' end,
         place_label(v_venue, e->>'stage') || ' · ' || to_char(t.at at time zone 'Europe/Madrid', 'HH24:MI'),
         'stage', e->>'stage'
  from jsonb_array_elements(new.plan) i
  join venues v on v.id = v_venue
  cross join lateral jsonb_array_elements(v.lineup) e
  cross join lateral (select coalesce((i->>'f')::timestamptz, (e->>'start')::timestamptz) as at) t
  where (e->>'stage') || '|' || (e->>'start') = i->>'k'
    and jsonb_typeof(i->'r') = 'number'
    and t.at - make_interval(mins => (i->>'r')::int) > now();
  return new;
end $$;
drop trigger if exists member_prefs_plan on public.member_prefs;
create trigger member_prefs_plan after insert or update on public.member_prefs for each row execute function public.plan_reminders();

-- New planned move: remind everyone in it when it's time. Cancel/decline: drop those reminders.
-- Letting someone go: clear their buddy group (only if they're in yours).
create or replace function public.message_effects() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_venue uuid;
  v_at timestamptz;
  v_where text;
  v_sender text;
begin
  if new.type = 'guess' and coalesce((new.meta->>'letgo')::boolean, false) and new.to_member is not null then
    update members t set buddy = null
    from members me
    where me.id = new.member_id and t.id = new.to_member and t.crew_id = new.crew_id and t.buddy = me.buddy;
  end if;
  if new.type <> 'move' or new.meta is null then return new; end if;
  if new.meta ? 'cancel' then
    delete from reminders where kind = 'move' and ref = new.meta->>'cancel' and sent_at is null;
    return new;
  end if;
  if new.meta ? 'decline' then
    delete from reminders where kind = 'move' and ref = new.meta->>'decline' and member_id = new.member_id and sent_at is null;
    return new;
  end if;
  if coalesce((new.meta->>'in')::int, 0) <= 0 then return new; end if; -- "now": the first notification says it all
  v_at := new.born + make_interval(mins => (new.meta->>'in')::int);
  select venue_id into v_venue from crews where id = new.crew_id;
  v_where := place_label(v_venue, new.place_id);
  select name into v_sender from members where id = new.member_id;
  insert into reminders (member_id, crew_id, kind, ref, due_at, title, body, open)
  select m.id, new.crew_id, 'move', new.id::text, v_at,
         case when m.id = new.member_id then 'Time to go: ' || v_where else 'Meet ' || v_sender || ' at ' || v_where end,
         case when m.id = new.member_id
              then 'Meeting ' || coalesce((select string_agg(o.name, ', ') from members o where o.crew_id = new.crew_id
                     and o.id::text in (select jsonb_array_elements_text(new.meta->'with'))), 'your crew')
              else 'Your penguins wait there until you confirm' end,
         'map'
  from members m
  where m.crew_id = new.crew_id
    and (m.id = new.member_id or m.id::text in (select jsonb_array_elements_text(coalesce(new.meta->'with', '[]'))));
  return new;
exception when others then
  return new; -- extras must never block a message
end $$;
drop trigger if exists messages_effects on public.messages;
create trigger messages_effects after insert on public.messages for each row execute function public.message_effects();

-- Every minute: send what's due (skipping anything more than 15 minutes late).
create or replace function public.fire_reminders() returns int
language plpgsql security definer set search_path = public as $$
declare
  c push_config;
  r reminders;
  n int := 0;
begin
  select * into c from push_config where id = 1;
  for r in
    update reminders set sent_at = now()
    where sent_at is null and due_at <= now() + interval '20 seconds' and due_at > now() - interval '15 minutes'
    returning *
  loop
    n := n + 1;
    if c.functions_url is null then continue; end if;
    perform net.http_post(
      url := c.functions_url || '/push',
      body := jsonb_build_object('reminder', to_jsonb(r)),
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-hook-secret', c.hook_secret)
                 || case when c.api_key is null then '{}'::jsonb else jsonb_build_object('apikey', c.api_key) end,
      timeout_milliseconds := 8000);
  end loop;
  return n;
end $$;
revoke execute on function public.fire_reminders, public.plan_reminders, public.message_effects, public.place_label from public, anon, authenticated;

do $$
begin
  create extension if not exists pg_cron with schema pg_catalog;
  perform cron.schedule('pingu-reminders', '* * * * *', 'select public.fire_reminders()');
exception when others then
  raise notice 'pg_cron not available: turn it on in Database → Extensions, then run this file again';
end $$;

-- 6 ─────────────────────────────────────────────────────────────────────
-- crew_sync with buddies, message details and your prefs. The old version is dropped first
-- (a new parameter makes a new function otherwise); phones on the older app keep working,
-- they just don't send the new parts.
--   p_prefs  {mutes: [ids], plan: [...], plan_shared: bool}   (only what changed)
-- Replies also carry
--   prefs  your own, on a first sync (so a new phone gets them back)
--   plans  [[member, plan or null]] crewmates' plans that changed (null = not shared)
drop function if exists public.crew_sync(uuid, timestamptz, text, jsonb, jsonb, jsonb, jsonb);
create or replace function public.crew_sync(
  p_member uuid,
  p_since timestamptz default null,
  p_places text default null,
  p_checkins jsonb default '[]',
  p_messages jsonb default '[]',
  p_me jsonb default null,
  p_crew jsonb default null,
  p_prefs jsonb default null
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

-- Show what got set up (look at the result below the editor).
select
  (select jsonb_array_length(lineup) from venues where id = 'e1e0a000-0000-4000-8000-000000000001') as halloween_sets,
  exists (select 1 from pg_extension where extname = 'pg_cron') as reminders_job_ready;
