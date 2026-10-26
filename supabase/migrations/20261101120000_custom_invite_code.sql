-- Update 11: pick your own invite code when you start a crew.
-- create_crew takes an optional p_code: 3 to 24 lowercase letters, numbers or dashes,
-- starting with a letter or number ("halloween-squad"). Empty = a random 8-character code,
-- as before. The old two-argument version is dropped first (a new parameter would otherwise
-- make a second function); phones on the older app call this one without p_code.

drop function if exists public.create_crew(text, uuid);
create or replace function public.create_crew(p_name text, p_venue uuid default null, p_code text default null) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_venue venues;
  v_code text := lower(trim(coalesce(p_code, '')));
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into v_venue from venues where id = coalesce(p_venue, (select id from venues order by event_end desc nulls last limit 1));
  if v_venue.id is null then raise exception 'no venue'; end if;
  if v_code <> '' then
    if v_code !~ '^[a-z0-9][a-z0-9-]{2,23}$' then raise exception 'bad code'; end if;
    if exists (select 1 from crews where invite_code = v_code) then raise exception 'code taken'; end if;
  else
    loop
      v_code := substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
      exit when not exists (select 1 from crews where invite_code = v_code);
    end loop;
  end if;
  insert into crews (name, venue_id, invite_code, meet_spot_place_id, meet_spot_note, ends_at)
  values (trim(p_name), v_venue.id, v_code, v_venue.default_meet, 'on the hour', v_venue.event_end);
  return v_code;
exception when unique_violation then
  raise exception 'code taken'; -- someone took it a moment earlier
end $$;

revoke execute on function public.create_crew from public, anon;
grant execute on function public.create_crew to authenticated;

select 'custom invite codes ready' as result;
