import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { CatalogConfig } from './frame-catalog';
import { validateTemplateInput } from './admin-frame';

export type AdminTemplate = { id: string; name: string; layout_id: string; image_path: string; sort_order: number; is_active: boolean; created_at: string };
export function createAdminClient(config: CatalogConfig) {
  return createClient(config.url, config.key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'boothpop-admin-session' } });
}
export async function requireAdmin(client: SupabaseClient) {
  const { data, error } = await client.rpc('is_boothpop_admin');
  if (error) throw new Error('Hak admin belum dapat diperiksa. Pastikan SQL 04_admin_access.sql sudah dijalankan dan koneksi tersedia.');
  if (data !== true) throw new Error('Akun ini belum ditetapkan sebagai admin BOOTHPOP.');
}
export async function listAdminTemplates(client: SupabaseClient) {
  await requireAdmin(client);
  const rows: AdminTemplate[] = [];
  for (let offset = 0; ; offset += 200) {
    const { data, error } = await client.from('frame_templates').select('*').order('sort_order').order('id').range(offset, offset + 199);
    if (error) throw new Error('Daftar template gagal dimuat. Coba muat ulang.');
    rows.push(...(data as AdminTemplate[]));
    if (data.length < 200) return rows;
  }
}
export async function addAdminTemplate(client: SupabaseClient, input: { name: string; sortOrder: number; layoutId: string; active: boolean; blob: Blob }) {
  await requireAdmin(client);
  const fields = validateTemplateInput(input.name, input.sortOrder);
  if (input.blob.type !== 'image/webp' || input.blob.size === 0 || input.blob.size > 10 * 1024 * 1024) throw new Error('Siapkan gambar WebP yang valid, maksimal 10 MB, sebelum upload.');
  const id = 'frame_' + crypto.randomUUID().replaceAll('-', '');
  const imagePath = id + '.webp';
  const { error: uploadError } = await client.storage.from('frames').upload(imagePath, input.blob, { contentType: input.blob.type, upsert: false, cacheControl: '3600' });
  if (uploadError) throw new Error('Upload ditolak atau koneksi terputus. Periksa hak admin, bucket frames, dan batas file.');
  const { error } = await client.from('frame_templates').insert({ id, ...fields, layout_id: input.layoutId, image_path: imagePath, is_active: input.active });
  if (error) {
    const { error: cleanupError } = await client.storage.from('frames').remove([imagePath]);
    throw new Error(cleanupError ? `Metadata gagal disimpan. File ${imagePath} masih ada di Storage; periksa melalui Dashboard.` : 'Metadata gagal disimpan. Upload dibersihkan; silakan coba lagi.');
  }
}
export async function editAdminTemplate(client: SupabaseClient, id: string, input: { name: string; sortOrder: number; active: boolean }) {
  await requireAdmin(client);
  const fields = validateTemplateInput(input.name, input.sortOrder);
  const { data, error } = await client.from('frame_templates').update({ ...fields, is_active: input.active }).eq('id', id).select('id');
  if (error || data?.length !== 1) throw new Error('Template gagal diperbarui atau akses admin sudah dicabut.');
}
export async function deleteAdminTemplate(client: SupabaseClient, row: AdminTemplate) {
  await requireAdmin(client);
  const { data, error } = await client.from('frame_templates').delete().eq('id', row.id).select('id');
  if (error || data?.length !== 1) throw new Error('Template gagal dihapus atau akses admin sudah dicabut.');
  const { error: fileError } = await client.storage.from('frames').remove([row.image_path]);
  return fileError ? `Template dihapus dari katalog, tetapi file ${row.image_path} belum terhapus dari Storage. Bersihkan melalui Dashboard.` : null;
}
