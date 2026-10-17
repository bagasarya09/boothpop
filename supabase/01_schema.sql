-- Run in Supabase Dashboard > SQL Editor on the intended new BOOTHPOP project.
-- This prepares template metadata only. PNG/GIF user photos are not stored here.
begin;

create table if not exists public.photo_layouts (
  id text primary key,
  name_id text not null,
  name_en text not null,
  photo_count integer not null check (photo_count > 0),
  width_px integer not null check (width_px > 0),
  height_px integer not null check (height_px > 0)
);

create table if not exists public.frame_templates (
  id text primary key,
  name text not null check (length(trim(name)) between 1 and 100),
  layout_id text not null references public.photo_layouts(id),
  image_path text not null unique check (image_path ~ '^[A-Za-z0-9_-]+\.(webp|png)$'),
  sort_order integer not null default 0 check (sort_order >= 0),
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists frame_templates_published_order
  on public.frame_templates (layout_id, sort_order, id) where is_active = true;

alter table public.photo_layouts enable row level security;
alter table public.frame_templates enable row level security;

-- Visitors (including signed-in non-admin users) can only read public metadata.
-- Editing is done through the Supabase Dashboard until admin access is implemented.
revoke all on public.photo_layouts, public.frame_templates from anon, authenticated;
grant select on public.photo_layouts, public.frame_templates to anon, authenticated;
grant all on public.photo_layouts, public.frame_templates to service_role;

drop policy if exists "boothpop_read_layouts" on public.photo_layouts;
create policy "boothpop_read_layouts" on public.photo_layouts
  for select to anon, authenticated using (true);

drop policy if exists "boothpop_read_active_frames" on public.frame_templates;
create policy "boothpop_read_active_frames" on public.frame_templates
  for select to anon, authenticated using (is_active = true);

commit;
