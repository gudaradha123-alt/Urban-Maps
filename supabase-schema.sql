-- URBAN MAPS Stage 2: public issue reporting + photo storage.
-- Run this in Supabase Dashboard > SQL Editor using the project owner account.

create extension if not exists pgcrypto;

create table if not exists public.issues (
  id uuid primary key default gen_random_uuid(),
  category text not null check (char_length(category) between 1 and 120),
  description text not null check (char_length(description) between 1 and 1500),
  longitude double precision not null check (longitude between -180 and 180),
  latitude double precision not null check (latitude between -90 and 90),
  photo_url text,
  status text not null default 'Open' check (status in ('Open', 'Confirmed', 'Resolved')),
  created_at timestamptz not null default now()
);

create index if not exists issues_created_at_idx on public.issues (created_at desc);
create index if not exists issues_status_idx on public.issues (status);
alter table public.issues enable row level security;

-- This prototype intentionally permits public reading and anonymous submissions.
-- Add authentication, rate limiting, and moderation before production deployment.
drop policy if exists "Public can read urban issues" on public.issues;
create policy "Public can read urban issues" on public.issues
  for select to anon, authenticated using (true);

drop policy if exists "Visitors can submit urban issues" on public.issues;
create policy "Visitors can submit urban issues" on public.issues
  for insert to anon, authenticated
  with check (
    status = 'Open'
    and char_length(trim(category)) between 1 and 120
    and char_length(trim(description)) between 1 and 1500
    and longitude between -180 and 180
    and latitude between -90 and 90
  );

-- Public bucket so submitted image URLs can be shown on the map/report details later.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('issue-photos', 'issue-photos', true, 5242880, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set public = true, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif'];

drop policy if exists "Public can view issue photos" on storage.objects;
create policy "Public can view issue photos" on storage.objects
  for select to anon, authenticated using (bucket_id = 'issue-photos');

drop policy if exists "Visitors can upload issue photos" on storage.objects;
create policy "Visitors can upload issue photos" on storage.objects
  for insert to anon, authenticated
  with check (
    bucket_id = 'issue-photos'
    and (storage.foldername(name))[1] = 'reports'
    and lower(storage.filename(name)) ~ '\.(jpg|jpeg|png|webp|gif)$'
  );

-- Enable Realtime so other open app sessions can refresh when a report is submitted.
do $$
begin
  alter publication supabase_realtime add table public.issues;
exception when duplicate_object then null;
when undefined_object then null;
end $$;
