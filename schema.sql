-- Run in Supabase SQL Editor.
create table if not exists public.videos (
  id uuid primary key,
  title text not null,
  category text not null,
  description text default '',
  video_url text not null,
  thumbnail_url text default '',
  published boolean not null default false,
  views bigint not null default 0,
  created_at timestamptz not null default now()
);

alter table public.videos enable row level security;

create policy "public can read published videos"
on public.videos for select
using (published = true);

create policy "authenticated admins can insert"
on public.videos for insert
to authenticated
with check (true);

create policy "authenticated admins can update"
on public.videos for update
to authenticated
using (true) with check (true);

create policy "authenticated admins can delete"
on public.videos for delete
to authenticated
using (true);

create or replace function public.increment_video_views(video_id uuid)
returns void language sql security definer as $$
 update public.videos set views=views+1 where id=video_id and published=true;
$$;

-- Storage:
-- Create two buckets in Supabase Dashboard:
--   videos      (Public)
--   thumbnails  (Public)
--
-- For a real production site, replace broad authenticated storage policies
-- with an admin role/claim and server-side authorization.

-- After creating an admin account in Authentication → Users,
-- use its authenticated session to access admin.html.
