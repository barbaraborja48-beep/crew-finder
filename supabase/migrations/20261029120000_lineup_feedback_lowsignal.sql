-- Update 8: low-signal notifications, DJ lineup, feedback logs.
--
-- 1. Notifications only for what can't wait: SOS, pings and a new meet spot. New pins no longer
--    notify everyone (each notification costs every phone a little data, which adds up in a
--    packed crowd); they show up when people open the app or refresh.
-- 2. venues.lineup: the DJ screen's set times. Mondo Disko, Sat 24 → Sun 25 Oct 2026, Madrid
--    time. Clocks go back at 03:00 that night, hence +02 before and +01 after.
-- 3. feature_taps and feedback: who tapped the "coming in Premium" buttons (Shazam, steps) and
--    the ratings and comments they left. Only readable from the Supabase dashboard.

-- 1 ─────────────────────────────────────────────────────────────────────
drop trigger if exists checkins_push on public.checkins;
drop trigger if exists messages_push on public.messages;
create trigger messages_push after insert on public.messages for each row
  when (new.type = 'sos' or new.to_member is not null or (new.type = 'status' and new.text like 'set the meet spot%'))
  execute function public.push_hook();

-- 2 ─────────────────────────────────────────────────────────────────────
alter table public.venues add column if not exists lineup jsonb not null default '[]';
update public.venues set lineup = '[
  {"name": "doccudder",    "start": "2026-10-25T00:00:00+02:00", "end": "2026-10-25T02:00:00+02:00"},
  {"name": "Gerardo Niva", "start": "2026-10-25T02:00:00+02:00", "end": "2026-10-25T04:00:00+01:00"},
  {"name": "Pablo Bozzi",  "start": "2026-10-25T04:00:00+01:00", "end": "2026-10-25T06:00:00+01:00"}
]' where id = 'e1e0a000-0000-4000-8000-000000000002';

-- 3 ─────────────────────────────────────────────────────────────────────
create table if not exists public.feature_taps (
  id bigint generated always as identity primary key,
  feature text not null check (char_length(feature) <= 40),
  member_id uuid references public.members on delete set null,
  name text not null default '',
  crew text not null default '',
  venue text not null default '',
  created_at timestamptz not null default now()
);
create table if not exists public.feedback (
  id bigint generated always as identity primary key,
  feature text not null default '' check (char_length(feature) <= 40),
  stars smallint check (stars between 1 and 5),
  comment text not null default '' check (char_length(comment) <= 1000),
  member_id uuid references public.members on delete set null,
  name text not null default '',
  crew text not null default '',
  venue text not null default '',
  created_at timestamptz not null default now()
);
alter table public.feature_taps enable row level security; -- no policies: only the dashboard reads these
alter table public.feedback enable row level security;

create or replace function public.log_feature(p_member uuid, p_feature text) returns void
language plpgsql security definer set search_path = public as $$
declare m members;
begin
  select * into m from members where id = p_member and user_id = auth.uid();
  if m.id is null then return; end if;
  insert into feature_taps (feature, member_id, name, crew, venue)
  select left(p_feature, 40), m.id, m.name, c.name, v.event_name
  from crews c join venues v on v.id = c.venue_id where c.id = m.crew_id;
end $$;

create or replace function public.send_feedback(p_member uuid, p_feature text, p_stars int, p_comment text) returns void
language plpgsql security definer set search_path = public as $$
declare m members;
begin
  select * into m from members where id = p_member and user_id = auth.uid();
  if m.id is null then raise exception 'not your member'; end if;
  insert into feedback (feature, stars, comment, member_id, name, crew, venue)
  select left(coalesce(p_feature, ''), 40), case when p_stars between 1 and 5 then p_stars end, left(coalesce(p_comment, ''), 1000),
         m.id, m.name, c.name, v.event_name
  from crews c join venues v on v.id = c.venue_id where c.id = m.crew_id;
end $$;

revoke execute on function public.log_feature, public.send_feedback from public, anon;
grant execute on function public.log_feature, public.send_feedback to authenticated;
