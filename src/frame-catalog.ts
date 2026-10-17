export type FramePreset = { id: string; name: string; layoutId: string; src: string };
export type CatalogConfig = { url: string; key: string };

export function parseCatalogConfig(url: string | undefined, key: string | undefined): CatalogConfig | null {
  if (!url?.trim() && !key?.trim()) return null;
  if (!url?.trim() || !key?.trim()) throw new Error('Supabase URL and publishable key are both required.');
  const parsed = new URL(url.trim());
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash || !['', '/'].includes(parsed.pathname)) {
    throw new Error('Supabase URL must be an HTTPS project origin.');
  }
  if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(key.trim())) throw new Error('Use a Supabase publishable key, never a secret key.');
  return { url: parsed.origin, key: key.trim() };
}

export function mapCatalogRows(rows: unknown, config: CatalogConfig, layoutIds: Set<string>): FramePreset[] {
  if (!Array.isArray(rows)) throw new Error('Invalid template catalog response.');
  const ids = new Set<string>();
  const frames: FramePreset[] = [];
  for (const row of rows) {
    if (row?.is_active !== true) continue;
    if (typeof row.id !== 'string' || !/^[A-Za-z0-9_-]+$/.test(row.id) || ids.has(row.id)
      || typeof row.name !== 'string' || !row.name.trim() || row.name.length > 100
      || typeof row.layout_id !== 'string' || !layoutIds.has(row.layout_id)
      || typeof row.image_path !== 'string' || !/^[A-Za-z0-9_-]+\.(png|webp)$/.test(row.image_path)) {
      throw new Error('Invalid template metadata.');
    }
    ids.add(row.id);
    frames.push({ id: row.id, name: row.name, layoutId: row.layout_id, src: `${config.url}/storage/v1/object/public/frames/${encodeURIComponent(row.image_path)}` });
  }
  return frames;
}

export async function fetchFrameCatalog(config: CatalogConfig, layoutIds: Set<string>, signal: AbortSignal, request: typeof fetch = fetch) {
  const url = new URL('/rest/v1/frame_templates', config.url);
  url.searchParams.set('select', 'id,name,layout_id,image_path,is_active');
  url.searchParams.set('is_active', 'eq.true');
  url.searchParams.set('order', 'sort_order.asc,id.asc');
  const response = await request(url.href, { headers: { apikey: config.key, Accept: 'application/json' }, signal, cache: 'no-store', credentials: 'omit' });
  if (!response.ok) throw new Error('Template catalog request failed: ' + response.status);
  return mapCatalogRows(await response.json(), config, layoutIds);
}
