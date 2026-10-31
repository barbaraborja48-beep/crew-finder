-- Update 16 (31 Oct, during the night): Barbara's fixes for Mondo Krystal at Jowke, and WC / water
-- buttons. Halloween Takeover and Sala But don't change. Run after SQL 15 (Hallowfest).
--
-- Jowke:
--   The Pin page looks like Sala But's (she didn't like the render): a grid with her five rows
--   (front front … back back, her rings around the DJ "unrolled") and three columns ("grid": angle
--   and radius breakpoints, rows dip in the middle like Sala But's). WC / water and Inside / rest
--   either side of the DJ screen, Bar and Outside buttons on the edges. Spots stay on the same
--   map box, so nobody's pin moves.
--   The small bar by the DJ booth is no longer its own spot: that patch of floor is "front left ·
--   by bar" / "center left · by bar" (dance floor "near"; a "Bar" button on the left pins you
--   there). Pins already there move onto the dance floor at the same point on the map, and a meet
--   spot there becomes the dance floor.
-- Hallowfest:
--   WC and Water by each stage, as buttons under every stage's close-up. They sit next to their
--   stage on the map, with no icon of their own ("noIcon"), since the poster doesn't show where they are.

update public.places set shape = (shape - 'cut') || '{"near": [{"x": 128, "y": 374, "w": 110, "h": 170, "label": "by bar"}], "grid": {"a": [155, 92, 67, 12], "r": [100, 165, 252, 339, 448, 600], "bulge": 0.07}}'
where venue_id = 'e1e0a000-0000-4000-8000-000000000003' and id = 'j-pista';

-- j-bar2 (zone cx 183, cy 459, 110×170) → the same map point on the dance floor (box x 60, y 0, 654×745).
update public.checkins c set place_id = 'j-pista',
  nx = ((183 + (c.nx - 0.5) * 110) - 60) / 654,
  ny = (459 + (c.ny - 0.5) * 170) / 745
from public.crews cr
where cr.id = c.crew_id and cr.venue_id = 'e1e0a000-0000-4000-8000-000000000003' and c.place_id = 'j-bar2';

update public.messages m set place_id = 'j-pista',
  nx = ((183 + (coalesce(m.nx, 0.5) - 0.5) * 110) - 60) / 654,
  ny = (459 + (coalesce(m.ny, 0.5) - 0.5) * 170) / 745
from public.crews cr
where cr.id = m.crew_id and cr.venue_id = 'e1e0a000-0000-4000-8000-000000000003' and m.place_id = 'j-bar2';

update public.crews set meet_spot_place_id = 'j-pista'
where venue_id = 'e1e0a000-0000-4000-8000-000000000003' and meet_spot_place_id = 'j-bar2';

delete from public.places where venue_id = 'e1e0a000-0000-4000-8000-000000000003' and id = 'j-bar2';

-- Hallowfest: WC to the right of each stage, Water to the left (image px on /assets/fabrik-map.webp).
insert into public.places (venue_id, id, type, name, near, n, x, y, shape)
select 'e1e0a000-0000-4000-8000-000000000004', s.id || k.suffix, k.type, k.name, s.name, null,
  s.x + k.dx, s.y + 8,
  jsonb_build_object('kind', 'zone', 'cx', s.x + k.dx, 'cy', s.y + 8, 'w', 30, 'h', 24, 'of', s.id, 'noIcon', true)
from public.places s
cross join (values ('-wc', 'wc', 'WC', 40), ('-water', 'water', 'Water', -40)) as k(suffix, type, name, dx)
where s.venue_id = 'e1e0a000-0000-4000-8000-000000000004' and s.type = 'stage'
on conflict (venue_id, id) do update set type = excluded.type, name = excluded.name, near = excluded.near,
  x = excluded.x, y = excluded.y, shape = excluded.shape;

select 'fixes ready' as result,
  (select count(*) from places where venue_id = 'e1e0a000-0000-4000-8000-000000000004' and type in ('wc', 'water')) as hallowfest_wc_water,
  (select count(*) from places where venue_id = 'e1e0a000-0000-4000-8000-000000000003' and id = 'j-bar2') as jowke_bar_by_dj;
