-- Update 6: a second venue, Mondo Disko at Sala But, with two floors.
--   venues.floors   the floor plans: [{n, name, map_url, map_w, map_h, view_scale, view_ox, view_oy}]
--                   (empty for single-map venues like the Halloween one)
--   venues.default_meet  the meet spot a new crew starts with
--   places.floor    which floor a place is on; empty = shown on every floor (e.g. outside)
-- New place types: 'coat' (coat check) and 'outside' (fresh air / smoke break).
-- The Halloween venue and its crews don't change.

alter table public.venues add column if not exists floors jsonb not null default '[]';
alter table public.venues add column if not exists default_meet text;
alter table public.places add column if not exists floor smallint;

alter table public.places drop constraint if exists places_type_check;
alter table public.places add constraint places_type_check
  check (type in ('stage','wc','bar','water','medic','food','picnic','open','coat','outside'));

update public.venues set default_meet = 'picnic' where id = 'e1e0a000-0000-4000-8000-000000000001';

-- Coordinates are pixels on the floor plans (/assets/mondo-p1.webp and -p2.webp, 1536×1103).
-- The VIP tables (red, 1–8 and 1P–8P) are drawn on the plans but aren't places.
insert into public.venues (id, name, event_name, map_url, map_w, map_h, view_scale, view_ox, view_oy, event_end, default_meet, floors)
values ('e1e0a000-0000-4000-8000-000000000002', 'Sala But', 'Mondo Disko', '/assets/mondo-p1.webp', 1536, 1103, .36, -83, -46, null, 'm-entrada',
  '[{"n": 1, "name": "Planta 1", "map_url": "/assets/mondo-p1.webp", "map_w": 1536, "map_h": 1103, "view_scale": 0.36, "view_ox": -83, "view_oy": -46},
    {"n": 2, "name": "Planta 2", "map_url": "/assets/mondo-p2.webp", "map_w": 1536, "map_h": 1103, "view_scale": 0.36, "view_ox": -83, "view_oy": -46}]')
on conflict (id) do update set name = excluded.name, event_name = excluded.event_name, map_url = excluded.map_url,
  view_scale = excluded.view_scale, view_ox = excluded.view_ox, view_oy = excluded.view_oy,
  default_meet = excluded.default_meet, floors = excluded.floors;

insert into public.places (venue_id, id, type, name, near, n, x, y, floor)
select 'e1e0a000-0000-4000-8000-000000000002', id, type, name, near, n, x, y, floor from (values
  -- Planta 1: the main room
  ('m-pista',   'stage',   'Dance floor', '',          1,    700,  590, 1),
  ('m-bar1',    'bar',     'Bar',         'WC',        null, 539,  410, 1),
  ('m-bar2',    'bar',     'Bar',         'side wall', null, 497,  592, 1),
  ('m-bar3',    'bar',     'Bar',         'entrance',  null, 980,  808, 1),
  ('m-wc1',     'wc',      'WC',          '',          null, 648,  245, 1),
  ('m-entrada', 'open',    'Entrance',    '',          null, 790,  860, 1),
  -- Planta 2: the balcony ring around the room
  ('m-balcon',  'open',    'Balcony',     '',          null, 520,  560, 2),
  ('m-bar4',    'bar',     'Bar',         'balcony',   null, 557,  360, 2),
  ('m-wc2',     'wc',      'WC',          '',          null, 823,  305, 2),
  ('m-coat',    'coat',    'Coat check',  '',          null, 1012, 672, 2),
  ('m-entrada2','open',    'Entrance',    '',          null, 875,  815, 2),
  -- Outside the building, shown on both floors
  ('m-fuera',   'outside', 'Outside',     '',          null, 1250, 650, null)
) as t(id, type, name, near, n, x, y, floor)
on conflict (venue_id, id) do update set type = excluded.type, name = excluded.name, near = excluded.near,
  n = excluded.n, x = excluded.x, y = excluded.y, floor = excluded.floor;

-- New crews start with their venue's own meet spot.
create or replace function public.create_crew(p_name text, p_venue uuid default null) returns text
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
  values (trim(p_name), v_venue.id, v_code, v_venue.default_meet, 'on the hour', v_venue.event_end);
  return v_code;
end $$;

revoke execute on function public.create_crew from public, anon;
grant execute on function public.create_crew to authenticated;
