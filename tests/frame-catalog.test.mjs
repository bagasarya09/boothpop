import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const bundle = await build({ entryPoints: ['src/frame-catalog.ts'], bundle: true, write: false, format: 'esm', platform: 'browser' });
const { parseCatalogConfig, mapCatalogRows, fetchFrameCatalog } = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const config = { url: 'https://example.supabase.co', key: 'sb_publishable_test' };
const layouts = new Set(['strip4', 'grid4']);
const row = { id: 'maroon', name: 'Maroon Cute', layout_id: 'strip4', image_path: 'Maroon_Cute_Strip4.webp', is_active: true };

test('Supabase configuration permits only complete public client credentials', () => {
  assert.equal(parseCatalogConfig('', ''), null);
  assert.deepEqual(parseCatalogConfig(config.url + '/', config.key), config);
  assert.throws(() => parseCatalogConfig(config.url, ''));
  assert.throws(() => parseCatalogConfig(config.url, 'sb_secret_not_for_frontend'));
  assert.throws(() => parseCatalogConfig('http://example.supabase.co', config.key));
  assert.throws(() => parseCatalogConfig(config.url + '/wrong-path', config.key));
  assert.throws(() => parseCatalogConfig('https://user:pass@example.supabase.co', config.key));
});

test('Catalog keeps published templates only, maps storage paths, and honors an empty catalog', () => {
  const result = mapCatalogRows([row, { ...row, id: 'disabled', is_active: false }], config, layouts);
  assert.deepEqual(result, [{ id: 'maroon', name: 'Maroon Cute', layoutId: 'strip4', src: config.url + '/storage/v1/object/public/frames/Maroon_Cute_Strip4.webp' }]);
  assert.deepEqual(mapCatalogRows([], config, layouts), []);
});

test('Catalog rejects unsafe storage paths, unknown layouts, and duplicate IDs', () => {
  for (const change of [{ image_path: '../private.png' }, { image_path: 'https://other.example/x.webp' }, { layout_id: 'unknown' }, { name: '' }]) {
    assert.throws(() => mapCatalogRows([{ ...row, ...change }], config, layouts));
  }
  assert.throws(() => mapCatalogRows([row, row], config, layouts));
  assert.throws(() => mapCatalogRows({ error: 'not a list' }, config, layouts));
});

test('Catalog request is read-only, uses the publishable header, and asks for active rows in display order', async () => {
  const controller = new AbortController();
  const result = await fetchFrameCatalog(config, layouts, controller.signal, async (url, options) => {
    const parsed = new URL(url);
    assert.equal(parsed.pathname, '/rest/v1/frame_templates');
    assert.equal(parsed.searchParams.get('is_active'), 'eq.true');
    assert.equal(parsed.searchParams.get('order'), 'sort_order.asc,id.asc');
    assert.equal(options.method, undefined);
    assert.equal(options.headers.apikey, config.key);
    assert.equal(options.headers.Authorization, undefined);
    assert.equal(options.credentials, 'omit');
    assert.equal(options.signal, controller.signal);
    return new Response(JSON.stringify([row]), { status: 200 });
  });
  assert.equal(result.length, 1);
  await assert.rejects(fetchFrameCatalog(config, layouts, controller.signal, async () => new Response('', { status: 401 })));
});
