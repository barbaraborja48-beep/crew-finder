-- Fix for projects that already ran 20261023120000_map_profile_push.sql:
-- Supabase rejects function calls without an API key, so the database now sends one.
alter table public.push_config add column if not exists api_key text;
update public.push_config set api_key = 'sb_publishable_8nB2ZwwUCbB9_QRZXxar2g_aO7lXXwy' where id = 1;

create or replace function public.push_hook() returns trigger
language plpgsql security definer set search_path = public as $$
declare c push_config;
begin
  if not exists (select 1 from push_subscriptions where crew_id = new.crew_id) then return new; end if;
  select * into c from push_config where id = 1;
  if c.functions_url is null then return new; end if;
  perform net.http_post(
    url := c.functions_url || '/push',
    body := jsonb_build_object('table', tg_table_name, 'record', to_jsonb(new)),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-hook-secret', c.hook_secret)
               || case when c.api_key is null then '{}'::jsonb else jsonb_build_object('apikey', c.api_key) end,
    timeout_milliseconds := 8000);
  return new;
exception when others then
  return new; -- a notification problem must never block a check-in or message
end $$;
