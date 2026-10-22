-- Elrow Halloween Takeover · Recinto Iberdrola Music, Madrid · 31.10.26 14:00–02:00
-- Coordinates are pixels on /assets/elrow-map.webp (1214×1520).

insert into public.venues (id, name, event_name, map_url, map_w, map_h, event_end) values
  ('e1e0a000-0000-4000-8000-000000000001', 'Recinto Iberdrola Music', 'Halloween Takeover',
   '/assets/elrow-map.webp', 1214, 1520, '2026-11-01 02:00:00+01');

insert into public.places (venue_id, id, type, name, near, n, x, y)
select 'e1e0a000-0000-4000-8000-000000000001', id, type, name, near, n, x, y from (values
  ('elrow',    'stage', 'elrow',          '',              1,  230,  880),
  ('brunch',   'stage', 'Brunch!',        '',              2, 1045,  475),
  ('industry', 'stage', 'Industry City',  '',              3,  255,  525),
  ('plaza',    'stage', 'La Plaza',       '',              4,  540,  535),
  ('jail',     'stage', 'The Jail',       '',              5,  355,  400),
  ('wc1',      'wc',    'WC',             'Salida',        null, 530,  340),
  ('wc2',      'wc',    'WC',             'Brunch!',       null, 1128, 370),
  ('wc3',      'wc',    'WC',             'Food trucks',   null, 870,  690),
  ('wc4',      'wc',    'WC',             'Industry City', null, 128,  660),
  ('wc5',      'wc',    'WC',             'elrow',         null, 233, 1161),
  ('bar1',     'bar',   'Bar',            'Brunch!',       null, 1040, 656),
  ('bar2',     'bar',   'Bar',            'La Plaza',      null, 511,  694),
  ('bar3',     'bar',   'Bar',            'Industry City', null, 155,  483),
  ('bar4',     'bar',   'Bar',            'elrow',         null, 414, 1006),
  ('water1',   'water', 'Water',          'Food trucks',   null, 780,  672),
  ('water2',   'water', 'Water',          'Industry City', null, 128,  733),
  ('med1',     'medic', 'Medical',        'Brunch!',       null, 989,  594),
  ('med2',     'medic', 'Medical',        'Industry City', null, 128,  805),
  ('safe',     'medic', 'Safe Space',     'Brunch!',       null, 928,  644),
  ('food',     'food',  'Food trucks',    '',              null, 611,  767),
  ('picnic',   'open',  'Picnic',         'La Plaza',      null, 655,  611),
  ('entrada',  'open',  'Entrada',        '',              null, 775,  306),
  ('paseo',    'open',  'Paseo',          'main walkway',  null, 728,  539)
) as t(id, type, name, near, n, x, y);
