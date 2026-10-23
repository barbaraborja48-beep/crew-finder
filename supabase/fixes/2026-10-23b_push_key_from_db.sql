-- Phones get the notification key from the database instead of calling the
-- function directly (iPhone Safari blocks that call: "Load failed").
-- If the key doesn't exist yet, the database asks the function to make one.
create or replace function public.push_public_key(p_origin text default null) returns text
language plpgsql security definer set search_path = public as $$
declare c push_config;
begin
  select * into c from push_config where id = 1;
  if c.vapid_subject is null and p_origin like 'https://%' then
    update push_config set vapid_subject = p_origin where id = 1;
  end if;
  if c.vapid_public is null and c.functions_url is not null then
    perform net.http_post(
      url := c.functions_url || '/push',
      body := jsonb_build_object('init', true),
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-hook-secret', c.hook_secret)
                 || case when c.api_key is null then '{}'::jsonb else jsonb_build_object('apikey', c.api_key) end,
      timeout_milliseconds := 8000);
  end if;
  return c.vapid_public;
end $$;
revoke execute on function public.push_public_key from public, anon;
grant execute on function public.push_public_key to authenticated;
