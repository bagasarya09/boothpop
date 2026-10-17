-- Snapshot of current local layouts/templates. Run after 01_schema.sql.
-- Existing IDs are kept unchanged when this seed is run again.
begin;

insert into public.photo_layouts (id, name_id, name_en, photo_count, width_px, height_px) values
  ('strip4', 'Strip 4 foto', '4 photo strip', 4, 720, 2140),
  ('strip3', 'Strip 3 foto', '3 photo strip', 3, 787, 1800),
  ('duo', 'Duo 2 foto', '2 photo duo', 2, 1122, 1800),
  ('grid4', 'Grid 4 foto', '4 photo grid', 4, 1800, 1513),
  ('grid6', 'Grid 6 foto', '6 photo grid', 6, 1500, 1800),
  ('mini75', 'Mini 3', 'Mini 3', 3, 713, 2140),
  ('strip9', 'Strip 2', 'Strip 2', 2, 713, 2140),
  ('strip15', 'Strip 3 persegi', '3 square strip', 3, 713, 2140),
  ('wide15', 'Strip 3 landscape', '3 landscape strip', 3, 856, 2140),
  ('wide17', 'Strip 4 landscape', '4 landscape strip', 4, 755, 2140),
  ('tall185', 'Strip 3 portrait', '3 portrait strip', 3, 578, 2140),
  ('pol75', 'Polaroid mini', 'Mini polaroid', 1, 1427, 2140),
  ('pol9', 'Polaroid portrait', 'Portrait polaroid', 1, 1427, 2140),
  ('pol10', 'Polaroid 10', 'Polaroid 10', 1, 1498, 2140),
  ('pol8', 'Polaroid 8', 'Polaroid 8', 1, 1873, 2140),
  ('pol11', 'Polaroid landscape', 'Landscape polaroid', 1, 2140, 1751)
on conflict (id) do nothing;

insert into public.frame_templates (id, name, layout_id, image_path, sort_order, is_active) values
  ('Spider_Strip', 'Spider Strip', 'pol11', 'Spider_Strip.webp', 1, false),
  ('MaroonCute_Strip4', 'Maroon Cute', 'strip4', 'Maroon_Cute_Strip4.webp', 2, false),
  ('BlueCute_Strip4', 'Blue Cute', 'strip4', 'Blue_Cute_Strip4.webp', 3, false),
  ('Sticker_Strip4', 'Sticker', 'strip4', 'Sticker_Strip4.webp', 4, false),
  ('RandomCute_Strip4', 'Random Cute', 'strip4', 'RandomCute_Strip4.webp', 5, false),
  ('Grid4_Maroon_Cute', 'Maroon Cute', 'grid4', 'Maroon_Cute_Grid4.webp', 6, false),
  ('Grid4-1_Maroon_Cute', 'Maroon Cute', 'wide17', 'Strip4-1_Maroon_Cute.webp', 7, false)
on conflict (id) do nothing;

commit;
