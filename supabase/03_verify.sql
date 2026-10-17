-- Read-only checks. Run after creating tables, seeding data, and uploading images.
select
  (select count(*) from public.photo_layouts) as layout_count,
  (select count(*) from public.frame_templates) as template_count,
  (select count(*) from storage.objects where bucket_id = 'frames') as uploaded_files;

select frame.id, frame.name, frame.layout_id, layout.width_px, layout.height_px,
  frame.image_path, frame.is_active,
  exists (
    select 1 from storage.objects as object
    where object.bucket_id = 'frames' and object.name = frame.image_path
  ) as file_uploaded
from public.frame_templates as frame
join public.photo_layouts as layout on layout.id = frame.layout_id
order by frame.sort_order, frame.id;

select tablename, rowsecurity as rls_enabled
from pg_tables
where schemaname = 'public' and tablename in ('photo_layouts', 'frame_templates');

select tablename, policyname, roles, cmd, qual
from pg_policies
where schemaname = 'public' and tablename in ('photo_layouts', 'frame_templates');

select id, public, file_size_limit, allowed_mime_types
from storage.buckets where id = 'frames';
