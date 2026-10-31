-- Update 14: a third venue, Mondo Krystal at Terraza Jowke (Alcorcón), the open-air one.
-- Halloween Takeover and Mondo Disko at Sala But don't change.
--   Map: /assets/jowke-map.webp (714×2000), Barbara's render turned upright (DJ at the top, like
--   her drawing of the dance floor), the red pins taken off and the pool covered as dance floor.
--   Tap anywhere to pin, like Sala But. One floor, so there are no floor buttons.
--   venues.closed  parts of the plan that are shut off: drawn hatched, taps there don't pin
--                  (here: the two rooms at the far end).
--   The dance floor is a "fan": rows are rings around the DJ (front front, front, center, back,
--   back back), columns are two lines out from the DJ (left, middle, right).
--   The entrance is a "door": tapping it asks "arriving or leaving, and in how long?" and tells
--   the crew ("Barbara is arriving in 10 minutes"). Nothing new on the server for that: it's a
--   status message, so it follows "Pin notifications".
-- New place type 'rest' (the inside / rest area).
-- Crews here are kept until 48 h after Sun 1 Nov 23:00, so one crew works for both days.

alter table public.venues add column if not exists closed jsonb not null default '[]';

alter table public.places drop constraint if exists places_type_check;
alter table public.places add constraint places_type_check
  check (type in ('stage','wc','bar','water','medic','food','picnic','open','coat','outside','rest'));

insert into public.venues (id, name, event_name, map_url, map_w, map_h, view_scale, view_ox, view_oy, event_end, default_meet, floors, closed)
values ('e1e0a000-0000-4000-8000-000000000003', 'Terraza Jowke', 'Mondo Krystal', '/assets/jowke-map.webp', 714, 2000, .5462, 0, 0,
  '2026-11-01 23:00:00+01', 'j-entrada',
  '[{"n": 1, "name": "Terraza", "map_url": "/assets/jowke-map.webp", "map_w": 714, "map_h": 2000, "view_scale": 0.5462, "view_ox": 0, "view_oy": 0}]',
  '[{"x": 223, "y": 1251, "w": 303, "h": 664}]')
on conflict (id) do update set name = excluded.name, event_name = excluded.event_name, map_url = excluded.map_url,
  map_w = excluded.map_w, map_h = excluded.map_h, view_scale = excluded.view_scale, view_ox = excluded.view_ox, view_oy = excluded.view_oy,
  event_end = excluded.event_end, default_meet = excluded.default_meet, floors = excluded.floors, closed = excluded.closed;

-- Coordinates are pixels on /assets/jowke-map.webp.
insert into public.places (venue_id, id, type, name, near, n, x, y, floor, shape)
select 'e1e0a000-0000-4000-8000-000000000003', id, type, name, near, n, x, y, null, shape::jsonb from (values
  ('j-pista',   'stage',   'Dance floor',        '',            1,    380, 450,  '{"kind": "fan", "x": 60, "y": 0, "w": 654, "h": 745, "djx": 258, "djy": 240, "radii": [165, 252, 339, 448], "rows": ["front front", "front", "center", "back", "back back"], "cols": [67, 92], "poly": [[253, 40], [713, 545], [713, 740], [73, 740], [73, 330], [113, 150]]}'),
  ('j-bar1',    'bar',     'Bar',                'dance floor', null, 548, 370,  '{"kind": "zone", "cx": 548, "cy": 370, "w": 440, "h": 70, "angle": 49.8}'),
  ('j-bar2',    'bar',     'Bar',                'DJ booth',    null, 183, 459,  '{"kind": "zone", "cx": 183, "cy": 459, "w": 110, "h": 170}'),
  ('j-dentro',  'rest',    'Inside / rest area', '',            null, 262, 1190, '{"kind": "zone", "cx": 368, "cy": 990, "w": 310, "h": 500}'),
  ('j-bar3',    'bar',     'Bar',                'inside',      null, 363, 992,  '{"kind": "zone", "cx": 363, "cy": 992, "w": 150, "h": 240}'),
  ('j-wc1',     'wc',      'WC',                 'inside',      null, 495, 942,  '{"kind": "zone", "cx": 495, "cy": 942, "w": 80, "h": 190}'),
  ('j-wc2',     'wc',      'WC / water',         '',            null, 120, 1101, '{"kind": "zone", "cx": 120, "cy": 1101, "w": 90, "h": 200}'),
  ('j-entrada', 'open',    'Entrance',           '',            null, 45,  975,  '{"kind": "zone", "cx": 45, "cy": 975, "w": 90, "h": 100, "door": true}'),
  ('j-fuera',   'outside', 'Outside',            '',            null, 60,  1250, '{"kind": "zone", "cx": 109, "cy": 1561, "w": 218, "h": 712}'),
  -- Anything else on the venue: the terrace below the dance floor and the path beside it.
  -- (Taps on the empty space around the building don't pin.)
  ('j-terraza', 'open',    'Terrace',            '',            null, 265, 1370, '{"kind": "zone", "cx": 265, "cy": 1370, "w": 530, "h": 1260, "bg": true}'),
  ('j-camino',  'open',    'Walkway',            '',            null, 57,  390,  '{"kind": "zone", "cx": 57, "cy": 390, "w": 115, "h": 700, "bg": true}')
) as t(id, type, name, near, n, x, y, shape)
on conflict (venue_id, id) do update set type = excluded.type, name = excluded.name, near = excluded.near,
  n = excluded.n, x = excluded.x, y = excluded.y, floor = excluded.floor, shape = excluded.shape;

-- Set times from Mondo's "Horarios" post for Sat 31 Oct (Madrid, +01:00). "note" shows small
-- next to the times (extended set, vinyl set).
-- Krystal at Jowke, 15:00 → 23:00.
update public.venues set lineup = '[
  {"name": "DJ Swisherman", "start": "2026-10-31T15:00:00+01:00", "end": "2026-10-31T17:00:00+01:00"},
  {"name": "The Hacker", "start": "2026-10-31T17:00:00+01:00", "end": "2026-10-31T18:30:00+01:00"},
  {"name": "RUIZ OSC1", "start": "2026-10-31T18:30:00+01:00", "end": "2026-10-31T20:00:00+01:00"},
  {"name": "Jeff Mills", "note": "extended set", "start": "2026-10-31T20:00:00+01:00", "end": "2026-10-31T23:00:00+01:00"}
]' where id = 'e1e0a000-0000-4000-8000-000000000003';

-- The afterparty at Sala But (Mondo Disko), 00:00 → 06:00 on Sun 1 Nov. Replaces the 24/25 Oct
-- lineup, which is over. Only the lineup changes: Sala But's map and spots stay as they are.
update public.venues set lineup = '[
  {"name": "DJ Swisherman", "note": "vinyl set", "start": "2026-11-01T00:00:00+01:00", "end": "2026-11-01T01:30:00+01:00"},
  {"name": "The Hacker", "start": "2026-11-01T01:30:00+01:00", "end": "2026-11-01T03:00:00+01:00"},
  {"name": "Gerardo Niva", "start": "2026-11-01T03:00:00+01:00", "end": "2026-11-01T04:30:00+01:00"},
  {"name": "RUIZ OSC1", "note": "vinyl set", "start": "2026-11-01T04:30:00+01:00", "end": "2026-11-01T06:00:00+01:00"}
]' where id = 'e1e0a000-0000-4000-8000-000000000002';

select 'mondo krystal ready' as result;
