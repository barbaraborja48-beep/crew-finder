-- Minimal stand-ins for what Supabase provides.
do $$ begin create role anon nologin; create role authenticated nologin; exception when duplicate_object then null; end $$;
create schema auth; create schema storage;
grant usage on schema public, auth, storage to anon, authenticated;
create function auth.uid() returns uuid language sql stable as
  $$ select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''), current_setting('request.jwt.claims', true)::jsonb->>'sub')::uuid $$;
grant execute on function auth.uid() to anon, authenticated;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;
grant all on storage.objects to authenticated;
create function storage.foldername(name text) returns text[] language sql immutable as
  $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
create publication supabase_realtime;
-- Supabase's default: everything in public is granted to the API roles.
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on functions to anon, authenticated;
do $$ begin create role authenticator login noinherit; exception when duplicate_object then null; end $$;
grant anon, authenticated to authenticator;
-- Fake pg_net: record outgoing calls instead of making them.
create schema if not exists net;
create table net.calls (id serial, url text, body jsonb, headers jsonb);
create function net.http_post(url text, body jsonb default '{}', params jsonb default '{}', headers jsonb default '{}', timeout_milliseconds int default 5000)
returns bigint language sql as $$ insert into net.calls (url, body, headers) values (url, body, headers) returning id::bigint $$;
do $$ begin create role service_role nologin bypassrls; exception when duplicate_object then null; end $$;
grant service_role to authenticator;
grant usage on schema public to service_role;
alter default privileges in schema public grant all on tables to service_role;
