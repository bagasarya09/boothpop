-- Run after 01_schema.sql. Does not grant admin status to any account automatically.
begin;

create schema if not exists boothpop_private;
revoke all on schema boothpop_private from public, anon, authenticated;
create table if not exists boothpop_private.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table boothpop_private.admins enable row level security;
revoke all on boothpop_private.admins from public, anon, authenticated;

create or replace function public.is_boothpop_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from boothpop_private.admins where user_id = (select auth.uid())
  );
$$;
revoke all on function public.is_boothpop_admin() from public, anon;
grant execute on function public.is_boothpop_admin() to authenticated;

grant select, insert, update, delete on public.frame_templates to authenticated;

drop policy if exists "boothpop_admin_read_frames" on public.frame_templates;
create policy "boothpop_admin_read_frames" on public.frame_templates
  for select to authenticated using ((select public.is_boothpop_admin()));
drop policy if exists "boothpop_admin_insert_frames" on public.frame_templates;
create policy "boothpop_admin_insert_frames" on public.frame_templates
  for insert to authenticated with check ((select public.is_boothpop_admin()));
drop policy if exists "boothpop_admin_update_frames" on public.frame_templates;
create policy "boothpop_admin_update_frames" on public.frame_templates
  for update to authenticated using ((select public.is_boothpop_admin())) with check ((select public.is_boothpop_admin()));
drop policy if exists "boothpop_admin_delete_frames" on public.frame_templates;
create policy "boothpop_admin_delete_frames" on public.frame_templates
  for delete to authenticated using ((select public.is_boothpop_admin()));

drop policy if exists "boothpop_admin_read_files" on storage.objects;
create policy "boothpop_admin_read_files" on storage.objects
  for select to authenticated using (bucket_id = 'frames' and (select public.is_boothpop_admin()));
drop policy if exists "boothpop_admin_upload_files" on storage.objects;
create policy "boothpop_admin_upload_files" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'frames' and name ~ '^[A-Za-z0-9_-]+\.(webp|png)$'
    and (select public.is_boothpop_admin())
  );
-- No overwrite policy: new designs use new filenames to avoid stale image caches.
drop policy if exists "boothpop_admin_delete_files" on storage.objects;
create policy "boothpop_admin_delete_files" on storage.objects
  for delete to authenticated using (
    bucket_id = 'frames' and (select public.is_boothpop_admin())
    and not exists (select 1 from public.frame_templates as frame where frame.image_path = storage.objects.name)
  );

commit;
