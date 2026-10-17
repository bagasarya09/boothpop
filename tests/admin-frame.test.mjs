import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { layouts, geometry } from '../src/layout.mjs';

const bundle = await build({ entryPoints: ['src/admin-frame.ts'], bundle: true, write: false, format: 'esm', platform: 'browser' });
const { checkFramePixels, validateTemplateInput, compressAdminFrame, ADMIN_FRAME_TARGET_BYTES } = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
test('Admin input validates names and integer display order', () => {
  assert.deepEqual(validateTemplateInput('  Maroon  ', 3), { name: 'Maroon', sort_order: 3 });
  for (const [name, sort] of [['', 0], ['x'.repeat(101), 1], ['Valid', -1], ['Valid', 1.5], ['Valid', NaN]]) assert.throws(() => validateTemplateInput(name, sort));
});
test('All layouts accept transparent holes and reject wrong dimensions or opaque photo centers', () => {
  for (const layout of layouts) {
    const g = geometry(layout), canvas = createCanvas(g.width, g.height), context = canvas.getContext('2d');
    checkFramePixels(layout, g.width, g.height, context);
    assert.throws(() => checkFramePixels(layout, g.width * 2, g.height * 2, context));
    const slot = g.slots[0]; context.fillRect(Math.round(slot.x + slot.w / 2), Math.round(slot.y + slot.h / 2), 1, 1);
    assert.throws(() => checkFramePixels(layout, g.width, g.height, context));
  }
});

test('Compression lowers quality until the size target is reached', async () => {
  const qualities = [];
  const canvas = { toBlob(callback, type, quality) {
    assert.equal(type, 'image/webp'); qualities.push(quality);
    callback(new Blob([new Uint8Array(quality > 0.8 ? ADMIN_FRAME_TARGET_BYTES + 100 : 100)], { type }));
  } };
  const compressed = await compressAdminFrame(canvas, new Blob(['PNG'], { type: 'image/png' }));
  assert.deepEqual(qualities, [0.92, 0.86, 0.8]);
  assert.equal(compressed.type, 'image/webp');
  assert.equal(compressed.size, 100);
});

test('Small WebP is preserved; unsupported PNG fallback is not uploaded as WebP', async () => {
  const original = new Blob(['webp'], { type: 'image/webp' });
  assert.equal(await compressAdminFrame({ toBlob() { throw new Error('Must not recompress'); } }, original), original);
  await assert.rejects(compressAdminFrame({ toBlob(callback) { callback(new Blob(['png fallback'], { type: 'image/png' })); } }, new Blob(['png'], { type: 'image/png' })), /belum mendukung/);
});

test('Compression keeps the smallest valid WebP even when the target cannot be met', async () => {
  let attempts = 0;
  const result = await compressAdminFrame({ toBlob(callback, type) {
    attempts++;
    callback(new Blob([new Uint8Array(ADMIN_FRAME_TARGET_BYTES + (5 - attempts) * 100)], { type }));
  } }, new Blob(['png'], { type: 'image/png' }));
  assert.equal(attempts, 4);
  assert.equal(result.size, ADMIN_FRAME_TARGET_BYTES + 100);
});

test('Real WebP encoding preserves canvas dimensions and every alpha value', async () => {
  const native = createCanvas(96, 128), context = native.getContext('2d');
  context.fillStyle = '#800020'; context.fillRect(0, 0, 96, 128);
  context.clearRect(8, 8, 80, 90);
  context.fillStyle = 'rgba(20,100,200,0.5)'; context.fillRect(10, 100, 50, 20);
  const blob = await compressAdminFrame({ toBlob(callback, type, quality) {
    native.encode('webp', quality * 100).then((buffer) => callback(new Blob([buffer], { type })));
  } }, new Blob([native.toBuffer('image/png')], { type: 'image/png' }));
  const decoded = await loadImage(Buffer.from(await blob.arrayBuffer()));
  assert.deepEqual([decoded.width, decoded.height], [96, 128]);
  const afterCanvas = createCanvas(96, 128), afterContext = afterCanvas.getContext('2d'); afterContext.drawImage(decoded, 0, 0);
  const before = context.getImageData(0, 0, 96, 128).data, after = afterContext.getImageData(0, 0, 96, 128).data;
  for (let index = 3; index < before.length; index += 4) assert.equal(after[index], before[index]);
});
