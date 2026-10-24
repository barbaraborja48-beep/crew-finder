-- Update 7: Mondo Disko, tap anywhere.
-- Every spot on the plans now covers a patch of floor (a "zone", in plan pixels), so a tap
-- anywhere on either floor pins you there and is named after the spot it lands in. Taps that
-- miss every spot fall back to "Main room" (Planta 1) or "Balcony" (Planta 2).
-- The dance floor is the real one: 3×3 zones at 50.5°, front along the DJ booth, front-left by
-- Entrada Backstage, back-right by the old table 6 (measured from Barbara's drawing; the rows
-- aren't even thirds, hence rows/cols). "Outside" becomes the smoking area: the strip in
-- front of the building. The map is framed to fit it.

update public.venues set view_scale = .31, view_ox = -43, view_oy = 2,
  floors = '[{"n": 1, "name": "Planta 1", "map_url": "/assets/mondo-p1.webp", "map_w": 1536, "map_h": 1103, "view_scale": 0.31, "view_ox": -43, "view_oy": 2},
             {"n": 2, "name": "Planta 2", "map_url": "/assets/mondo-p2.webp", "map_w": 1536, "map_h": 1103, "view_scale": 0.31, "view_ox": -43, "view_oy": 2}]'
where id = 'e1e0a000-0000-4000-8000-000000000002';

insert into public.places (venue_id, id, type, name, near, n, x, y, floor, shape)
select 'e1e0a000-0000-4000-8000-000000000002', id, type, name, near, n, x, y, floor, shape::jsonb from (values
  -- Planta 1
  ('m-pista',   'stage',   'Dance floor', '',          1,    660, 662, 1,    '{"kind": "square", "cx": 788, "cy": 554, "w": 371, "h": 278, "angle": 50.5, "rows": [0.286, 0.674], "cols": [0.344, 0.668]}'),
  ('m-bar1',    'bar',     'Bar',         'WC',        null, 539, 410, 1,    '{"kind": "zone", "cx": 539, "cy": 410, "w": 170, "h": 150}'),
  ('m-bar2',    'bar',     'Bar',         'side wall', null, 497, 592, 1,    '{"kind": "zone", "cx": 497, "cy": 592, "w": 150, "h": 170}'),
  ('m-bar3',    'bar',     'Bar',         'entrance',  null, 980, 808, 1,    '{"kind": "zone", "cx": 980, "cy": 808, "w": 190, "h": 150}'),
  ('m-wc1',     'wc',      'WC',          '',          null, 648, 245, 1,    '{"kind": "zone", "cx": 648, "cy": 245, "w": 170, "h": 120}'),
  ('m-entrada', 'open',    'Entrance',    '',          null, 790, 860, 1,    '{"kind": "zone", "cx": 790, "cy": 870, "w": 220, "h": 110}'),
  ('m-main',    'open',    'Main room',   '',          null, 770, 540, 1,    '{"kind": "zone", "cx": 770, "cy": 540, "w": 860, "h": 860, "bg": true}'),
  -- Planta 2
  ('m-balcon',  'open',    'Balcony',     '',          null, 770, 540, 2,    '{"kind": "zone", "cx": 770, "cy": 540, "w": 840, "h": 860, "bg": true}'),
  ('m-bar4',    'bar',     'Bar',         'balcony',   null, 557, 360, 2,    '{"kind": "zone", "cx": 557, "cy": 360, "w": 170, "h": 150}'),
  ('m-wc2',     'wc',      'WC',          '',          null, 823, 305, 2,    '{"kind": "zone", "cx": 823, "cy": 305, "w": 160, "h": 110}'),
  ('m-coat',    'coat',    'Coat check',  '',          null, 1012, 672, 2,   '{"kind": "zone", "cx": 1012, "cy": 672, "w": 170, "h": 150}'),
  ('m-entrada2','open',    'Entrance',    '',          null, 875, 815, 2,    '{"kind": "zone", "cx": 875, "cy": 815, "w": 220, "h": 110}'),
  -- Outside, along the front of the building, on both floors
  ('m-fuera',   'outside', 'Smoking area', '',         null, 395, 1002, null, '{"kind": "zone", "cx": 741, "cy": 1002, "w": 806, "h": 83}')
) as t(id, type, name, near, n, x, y, floor, shape)
on conflict (venue_id, id) do update set type = excluded.type, name = excluded.name, near = excluded.near,
  n = excluded.n, x = excluded.x, y = excluded.y, floor = excluded.floor, shape = excluded.shape;
