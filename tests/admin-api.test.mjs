import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const bundle = await build({ entryPoints: ['src/admin-api.ts'], bundle: true, write: false, format: 'esm', platform: 'browser' });
const { addAdminTemplate, editAdminTemplate, deleteAdminTemplate } = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const input = { name: 'Template', sortOrder: 2, layoutId: 'strip4', active: false, blob: new Blob(['image'], { type: 'image/webp' }) };

test('Mutation helpers reject a non-admin before touching metadata or Storage', async () => {
  const client = { rpc: async () => ({ data: false, error: null }), from() { throw new Error('Must not touch metadata'); }, get storage() { throw new Error('Must not touch Storage'); } };
  await assert.rejects(addAdminTemplate(client, input), /belum ditetapkan/);
  await assert.rejects(editAdminTemplate(client, 'test', { name: 'Name', sortOrder: 0, active: true }), /belum ditetapkan/);
  await assert.rejects(deleteAdminTemplate(client, { id: 'test', image_path: 'test.webp' }), /belum ditetapkan/);
});

test('Upload uses an immutable name and cleans up the new file when metadata fails', async () => {
  let uploaded, removed;
  const client = {
    rpc: async () => ({ data: true, error: null }),
    storage: { from(bucket) { assert.equal(bucket, 'frames'); return {
      async upload(path, blob, options) { uploaded = path; assert.equal(blob, input.blob); assert.equal(options.upsert, false); return { error: null }; },
      async remove(paths) { removed = paths; return { error: null }; },
    }; } },
    from(table) { assert.equal(table, 'frame_templates'); return { async insert(row) { assert.equal(row.image_path, uploaded); assert.equal(row.is_active, false); return { error: { message: 'Database failed' } }; } }; },
  };
  await assert.rejects(addAdminTemplate(client, input), /Upload dibersihkan/);
  assert.match(uploaded, /^frame_[a-f0-9]+\.webp$/);
  assert.deepEqual(removed, [uploaded]);
});

test('Delete removes metadata first and reports incomplete Storage cleanup', async () => {
  const operations = [];
  const client = {
    rpc: async () => ({ data: true, error: null }),
    from() { return { delete() { operations.push('metadata'); return { eq() { return { async select() { return { data: [{ id: 'test' }], error: null }; } }; } }; } }; },
    storage: { from() { return { async remove(paths) { operations.push('storage'); assert.deepEqual(paths, ['test.webp']); return { error: { message: 'Network failed' } }; } }; } },
  };
  const warning = await deleteAdminTemplate(client, { id: 'test', image_path: 'test.webp' });
  assert.deepEqual(operations, ['metadata', 'storage']);
  assert.match(warning, /belum terhapus/);
});
