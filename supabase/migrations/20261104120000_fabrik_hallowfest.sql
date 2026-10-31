-- Update 15: a fourth venue, Hallowfest at Fabrik (Humanes de Madrid), Sat 31 Oct 17:00 → closing.
-- Set up like Halloween Takeover: a festival map with six stages (each with its close-up and DJ
-- screen), the haunted house, the doors, parking, bus stops and the patio. Other venues don't change.
--   Map: /assets/fabrik-map.webp (1026×855), Fabrik's "Accesos" poster with the title, the red door
--   boxes and the printed room names taken off (the app draws its own labels), the empty end of
--   the parking cut off and the greys lifted (the app dims festival maps). The Hangar is half
--   hidden on the poster (behind its door box), so its pin sits on the part you can see.
--   No bars, WC or water on the poster, so none here yet.
--   New place types: 'door' (entrances; the card also offers "Arriving / leaving") and 'attraction'
--   (Gran Pasaje del Terror).
-- Lineup: Fabrik's Hallowfest timetable, 53 sets. "Closing" sets end at 07:00 (no time printed).
-- The poster overlaps two sets on the Hangar (Dany Gomez from 21:00, Darius Syrossian from 03:00);
-- kept as printed.

alter table public.places drop constraint if exists places_type_check;
alter table public.places add constraint places_type_check
  check (type in ('stage','wc','bar','water','medic','food','picnic','open','coat','outside','rest','door','attraction'));

insert into public.venues (id, name, event_name, map_url, map_w, map_h, view_scale, view_ox, view_oy, event_end, default_meet)
values ('e1e0a000-0000-4000-8000-000000000004', 'Fabrik', 'Hallowfest', '/assets/fabrik-map.webp', 1026, 855, .3801, 0, 0,
  '2026-11-01 07:00:00+01', 'f-patio')
on conflict (id) do update set name = excluded.name, event_name = excluded.event_name, map_url = excluded.map_url,
  map_w = excluded.map_w, map_h = excluded.map_h, view_scale = excluded.view_scale, view_ox = excluded.view_ox, view_oy = excluded.view_oy,
  event_end = excluded.event_end, default_meet = excluded.default_meet;

-- Coordinates are pixels on /assets/fabrik-map.webp. Stages are numbered like the timetable's columns.
insert into public.places (venue_id, id, type, name, near, n, x, y)
select 'e1e0a000-0000-4000-8000-000000000004', id, type, name, near, n, x, y from (values
  ('f-main',        'stage',      'Main Room',              '',          1,    425,  540),
  ('f-area19',      'stage',      'Area 19',                '',          2,    880,  95),
  ('f-club',        'stage',      'Club Area',              '',          3,    635,  450),
  ('f-crystal',     'stage',      'Crystal 360º',           '',          4,    465,  350),
  ('f-hangar',      'stage',      'Hangar',                 '',          5,    340,  240),
  ('f-satelite',    'stage',      'Satélite',               '',          6,    585,  612),
  ('f-terror',      'attraction', 'Gran Pasaje del Terror', '',          null, 100,  600),
  ('f-p-hangar',    'door',       'Puerta Hangar',          '',          null, 169,  393),
  ('f-p-area19',    'door',       'Puerta Area 19',         '',          null, 664,  298),
  ('f-p-hotel',     'door',       'Puerta Hotel',           '',          null, 715,  366),
  ('f-p-main',      'door',       'Main Room door',         '',          null, 244,  656),
  ('f-p-reservados','door',       'Reserved tables door',   'Main Room', null, 321,  698),
  ('f-patio',       'open',       'Patio',                  '',          null, 280,  430),
  ('f-parking',     'open',       'Parking',                '',          null, 65,   300),
  ('f-bus',         'open',       'Bus stops 496–498',      '',          null, 35,   727)
) as t(id, type, name, near, n, x, y)
on conflict (venue_id, id) do update set type = excluded.type, name = excluded.name, near = excluded.near,
  n = excluded.n, x = excluded.x, y = excluded.y;

-- Fabrik's timetable (Madrid time, +01:00). "note" shows small next to the times.
update public.venues set lineup = '[
  {"name": "Rods", "stage": "f-main", "start": "2026-10-31T19:00:00+01:00", "end": "2026-10-31T20:00:00+01:00"},
  {"name": "Cesar Almena", "stage": "f-main", "start": "2026-10-31T20:00:00+01:00", "end": "2026-10-31T22:00:00+01:00"},
  {"name": "Inox Traxx", "stage": "f-main", "start": "2026-10-31T22:00:00+01:00", "end": "2026-10-31T23:30:00+01:00"},
  {"name": "Future.666", "stage": "f-main", "start": "2026-10-31T23:30:00+01:00", "end": "2026-11-01T01:00:00+01:00"},
  {"name": "Supergloss", "stage": "f-main", "start": "2026-11-01T01:00:00+01:00", "end": "2026-11-01T02:30:00+01:00"},
  {"name": "Charlotte de Witte", "stage": "f-main", "start": "2026-11-01T02:30:00+01:00", "end": "2026-11-01T04:30:00+01:00"},
  {"name": "Nastia", "stage": "f-main", "start": "2026-11-01T04:30:00+01:00", "end": "2026-11-01T06:00:00+01:00"},
  {"name": "Cesar Almena & Nuke", "stage": "f-main", "start": "2026-11-01T06:00:00+01:00", "end": "2026-11-01T07:00:00+01:00", "note": "closing"},
  {"name": "Reborn", "stage": "f-area19", "start": "2026-10-31T17:00:00+01:00", "end": "2026-10-31T18:30:00+01:00"},
  {"name": "Yeyo", "stage": "f-area19", "start": "2026-10-31T18:30:00+01:00", "end": "2026-10-31T20:00:00+01:00", "note": "One Life"},
  {"name": "D-Block & S-te-Fan", "stage": "f-area19", "start": "2026-10-31T20:00:00+01:00", "end": "2026-10-31T21:30:00+01:00", "note": "journey set"},
  {"name": "Zatox", "stage": "f-area19", "start": "2026-10-31T21:30:00+01:00", "end": "2026-10-31T22:30:00+01:00"},
  {"name": "Malice", "stage": "f-area19", "start": "2026-10-31T22:30:00+01:00", "end": "2026-10-31T23:30:00+01:00"},
  {"name": "Panic & Promo", "stage": "f-area19", "start": "2026-10-31T23:30:00+01:00", "end": "2026-11-01T00:30:00+01:00"},
  {"name": "Endymion", "stage": "f-area19", "start": "2026-11-01T00:30:00+01:00", "end": "2026-11-01T01:30:00+01:00"},
  {"name": "Tha Playah", "stage": "f-area19", "start": "2026-11-01T01:30:00+01:00", "end": "2026-11-01T02:30:00+01:00"},
  {"name": "Brennan Heart", "stage": "f-area19", "start": "2026-11-01T02:30:00+01:00", "end": "2026-11-01T03:30:00+01:00"},
  {"name": "Sickmode", "stage": "f-area19", "start": "2026-11-01T03:30:00+01:00", "end": "2026-11-01T04:30:00+01:00"},
  {"name": "Guizcore vs The Dope Doctor", "stage": "f-area19", "start": "2026-11-01T04:30:00+01:00", "end": "2026-11-01T05:30:00+01:00"},
  {"name": "Ender", "stage": "f-area19", "start": "2026-11-01T05:30:00+01:00", "end": "2026-11-01T07:00:00+01:00", "note": "closing"},
  {"name": "Tørrico", "stage": "f-club", "start": "2026-10-31T21:00:00+01:00", "end": "2026-10-31T22:00:00+01:00"},
  {"name": "Bigotek", "stage": "f-club", "start": "2026-10-31T22:00:00+01:00", "end": "2026-10-31T23:00:00+01:00"},
  {"name": "Radness", "stage": "f-club", "start": "2026-10-31T23:00:00+01:00", "end": "2026-11-01T00:00:00+01:00"},
  {"name": "Dub Elements", "stage": "f-club", "start": "2026-11-01T00:00:00+01:00", "end": "2026-11-01T01:00:00+01:00"},
  {"name": "Los Ruinas", "stage": "f-club", "start": "2026-11-01T01:00:00+01:00", "end": "2026-11-01T02:00:00+01:00"},
  {"name": "Selecta", "stage": "f-club", "start": "2026-11-01T02:00:00+01:00", "end": "2026-11-01T03:30:00+01:00"},
  {"name": "Parkineos", "stage": "f-club", "start": "2026-11-01T03:30:00+01:00", "end": "2026-11-01T04:30:00+01:00"},
  {"name": "Bluntz vs Tasuik", "stage": "f-club", "start": "2026-11-01T04:30:00+01:00", "end": "2026-11-01T06:00:00+01:00"},
  {"name": "Yeyo vs Raúl Ortiz", "stage": "f-club", "start": "2026-11-01T06:00:00+01:00", "end": "2026-11-01T07:00:00+01:00", "note": "closing"},
  {"name": "Rafa XL vs Yvan Corrochano", "stage": "f-crystal", "start": "2026-10-31T18:00:00+01:00", "end": "2026-10-31T19:30:00+01:00"},
  {"name": "Davy vs Bgormor", "stage": "f-crystal", "start": "2026-10-31T19:30:00+01:00", "end": "2026-10-31T21:00:00+01:00"},
  {"name": "Di Carlo vs Paco García", "stage": "f-crystal", "start": "2026-10-31T21:00:00+01:00", "end": "2026-10-31T22:30:00+01:00"},
  {"name": "Julio Posadas vs DJ Neil", "stage": "f-crystal", "start": "2026-10-31T22:30:00+01:00", "end": "2026-11-01T00:00:00+01:00"},
  {"name": "A. Pareja vs V. Belenguer", "stage": "f-crystal", "start": "2026-11-01T00:00:00+01:00", "end": "2026-11-01T01:30:00+01:00"},
  {"name": "Christian Millán vs Ismael Lora", "stage": "f-crystal", "start": "2026-11-01T01:30:00+01:00", "end": "2026-11-01T03:00:00+01:00"},
  {"name": "Carlos Nasville", "stage": "f-crystal", "start": "2026-11-01T03:00:00+01:00", "end": "2026-11-01T03:15:00+01:00", "note": "live"},
  {"name": "Raúl Ortiz vs Chimo Bayo vs Paco Pil", "stage": "f-crystal", "start": "2026-11-01T03:15:00+01:00", "end": "2026-11-01T05:30:00+01:00"},
  {"name": "Skudero vs Metralla", "stage": "f-crystal", "start": "2026-11-01T05:30:00+01:00", "end": "2026-11-01T07:00:00+01:00", "note": "closing"},
  {"name": "Axao", "stage": "f-hangar", "start": "2026-10-31T17:00:00+01:00", "end": "2026-10-31T18:00:00+01:00"},
  {"name": "Alexander Som B2B Javi Reina", "stage": "f-hangar", "start": "2026-10-31T18:00:00+01:00", "end": "2026-10-31T20:00:00+01:00"},
  {"name": "Michael Rod", "stage": "f-hangar", "start": "2026-10-31T20:00:00+01:00", "end": "2026-10-31T21:30:00+01:00"},
  {"name": "Dany Gomez", "stage": "f-hangar", "start": "2026-10-31T21:00:00+01:00", "end": "2026-10-31T23:00:00+01:00"},
  {"name": "Seb Zito", "stage": "f-hangar", "start": "2026-10-31T23:00:00+01:00", "end": "2026-11-01T00:30:00+01:00"},
  {"name": "Detlef", "stage": "f-hangar", "start": "2026-11-01T00:30:00+01:00", "end": "2026-11-01T02:00:00+01:00"},
  {"name": "Joey Daniel", "stage": "f-hangar", "start": "2026-11-01T02:00:00+01:00", "end": "2026-11-01T03:30:00+01:00"},
  {"name": "Darius Syrossian", "stage": "f-hangar", "start": "2026-11-01T03:00:00+01:00", "end": "2026-11-01T05:00:00+01:00"},
  {"name": "Anthony Godfather", "stage": "f-hangar", "start": "2026-11-01T05:00:00+01:00", "end": "2026-11-01T07:00:00+01:00", "note": "closing"},
  {"name": "Sāshā", "stage": "f-satelite", "start": "2026-10-31T22:00:00+01:00", "end": "2026-10-31T23:00:00+01:00"},
  {"name": "Nuke", "stage": "f-satelite", "start": "2026-10-31T23:00:00+01:00", "end": "2026-11-01T01:00:00+01:00"},
  {"name": "Svetec", "stage": "f-satelite", "start": "2026-11-01T01:00:00+01:00", "end": "2026-11-01T02:30:00+01:00"},
  {"name": "Triptykh", "stage": "f-satelite", "start": "2026-11-01T02:30:00+01:00", "end": "2026-11-01T04:00:00+01:00"},
  {"name": "In Verruf", "stage": "f-satelite", "start": "2026-11-01T04:00:00+01:00", "end": "2026-11-01T05:30:00+01:00"},
  {"name": "KSN", "stage": "f-satelite", "start": "2026-11-01T05:30:00+01:00", "end": "2026-11-01T07:00:00+01:00", "note": "closing"}
]' where id = 'e1e0a000-0000-4000-8000-000000000004';

select 'hallowfest ready' as result,
  (select jsonb_array_length(lineup) from venues where id = 'e1e0a000-0000-4000-8000-000000000004') as sets;
