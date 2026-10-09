import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createCanvas, Image } from '@napi-rs/canvas';
import { layouts, geometry } from '../src/layout.mjs';

const bundle = await build({ entryPoints: ['src/filters.ts', 'src/canvas.ts'], outdir: 'unused', bundle: true, write: false, format: 'esm', platform: 'browser' });
const modules = {};
for (const file of bundle.outputFiles) {
  modules[file.path.endsWith('filters.js') ? 'filters' : 'canvas'] = await import('data:text/javascript;base64,' + Buffer.from(file.text).toString('base64'));
}
const { applyPhotoFilter, photoFilters } = modules.filters;
const { renderStrip } = modules.canvas;
globalThis.Image = Image;
globalThis.document = { createElement() { return createCanvas(1, 1); } };
const pixel = (filter, rgb = [90, 140, 190]) => {
  const bytes = new Uint8ClampedArray([...rgb, 173]);
  applyPhotoFilter(bytes, 1, 1, filter);
  return Array.from(bytes);
};

test('All ten filters preserve alpha; Original and unknown filters preserve pixels', () => {
  assert.deepEqual(photoFilters.map((filter) => filter.name), ['Original', 'Natural', 'Bright', 'B&W', 'Sepia', 'Vintage', 'Warm', 'Cool', 'Pastel', 'Film']);
  assert.deepEqual(pixel('original'), [90, 140, 190, 173]);
  assert.deepEqual(pixel('unknown'), pixel('original'));
  const results = photoFilters.map((filter) => pixel(filter.id));
  assert.ok(results.every((result) => result[3] === 173));
  assert.equal(new Set(results.map((result) => result.join(','))).size, 10);
});

test('Filters produce their expected light, color, and saturation changes', () => {
  const brightness = (channels) => channels.slice(0, 3).reduce((sum, value) => sum + value, 0);
  assert.ok(brightness(pixel('bright')) > brightness(pixel('original')));
  const warm = pixel('warm', [120, 120, 120]), cool = pixel('cool', [120, 120, 120]);
  assert.ok(warm[0] > warm[2]);
  assert.ok(cool[2] > cool[0]);
  const bw = pixel('bw');
  assert.equal(bw[0], bw[1]); assert.equal(bw[1], bw[2]);
  const sepia = pixel('sepia');
  assert.ok(sepia[0] > sepia[1] && sepia[1] > sepia[2]);
  const pastel = pixel('pastel');
  assert.ok(pastel[2] - pastel[0] < 100);
  assert.ok(pixel('natural')[2] - pixel('natural')[0] > 100);
});

test('Film grain is repeatable and edges are darker than the center', () => {
  const bytes = Uint8ClampedArray.from(Array.from({ length: 81 }, () => [128, 128, 128, 173]).flat());
  const other = bytes.slice();
  applyPhotoFilter(bytes, 9, 9, 'film');
  applyPhotoFilter(other, 9, 9, 'film');
  assert.deepEqual(bytes, other);
  assert.ok(bytes[0] < bytes[40 * 4]);
});

test('Every filter reaches the canvas photo without recoloring frame or sticker', async () => {
  const sample = createCanvas(40, 40);
  sample.getContext('2d').fillStyle = '#5a8cbe'; sample.getContext('2d').fillRect(0, 0, 40, 40);
  const image = sample.toDataURL('image/png');
  const layout = layouts.find((item) => item.id === 'pol11');
  const factor = 400 / geometry(layout).width;
  const slot = geometry(layout).slots[0];
  const colors = [];
  for (const filter of photoFilters) {
    const canvas = await renderStrip(layout, [image], { color: '#f6ce46', filter: filter.id, decoration: 'none', frame: null, stickers: [{ id: 'test', src: image, x: 90, y: 90, size: 10, rotation: 0 }] }, 400);
    const context = canvas.getContext('2d');
    const photo = Array.from(context.getImageData(Math.round((slot.x + slot.w / 2) * factor), Math.round((slot.y + slot.h / 2) * factor), 1, 1).data);
    colors.push(photo.join(','));
    assert.deepEqual(Array.from(context.getImageData(2, 2, 1, 1).data), [246, 206, 70, 255]);
    assert.deepEqual(Array.from(context.getImageData(Math.round(canvas.width * 0.9), Math.round(canvas.height * 0.9), 1, 1).data), [90, 140, 190, 255]);
  }
  assert.equal(new Set(colors).size, 10);
});

test('Filter strength restores originals at zero and interpolates effects at 50 percent', () => {
  const original = new Uint8ClampedArray([90, 140, 190, 173]);
  for (const filter of photoFilters) {
    const zero = original.slice(), half = original.slice(), full = original.slice();
    applyPhotoFilter(zero, 1, 1, filter.id, 0);
    applyPhotoFilter(half, 1, 1, filter.id, 50);
    applyPhotoFilter(full, 1, 1, filter.id, 100);
    assert.deepEqual(zero, original);
    for (let channel = 0; channel < 3; channel++) {
      assert.ok(Math.abs(half[channel] - (original[channel] + full[channel]) / 2) <= 1);
    }
    assert.equal(full[3], 173);
  }
});

test('Independent Film FX work on Original and at zero filter intensity', () => {
  const source = Uint8ClampedArray.from(Array.from({ length: 81 }, () => [120, 120, 120, 173]).flat());
  for (const key of ['grain', 'vignette', 'lightLeak']) {
    const effects = { grain: 0, vignette: 0, lightLeak: 0, [key]: 100 };
    const original = source.slice(), zeroFilter = source.slice(), repeat = source.slice();
    applyPhotoFilter(original, 9, 9, 'original', 100, effects);
    applyPhotoFilter(zeroFilter, 9, 9, 'bw', 0, effects);
    applyPhotoFilter(repeat, 9, 9, 'original', 100, effects);
    assert.notDeepEqual(original, source);
    assert.deepEqual(original, zeroFilter);
    assert.deepEqual(original, repeat);
    assert.ok(Array.from(original).every((value, index) => index % 4 !== 3 || value === 173));
    if (key === 'vignette') {
      assert.ok(original[0] < original[40 * 4]);
      assert.equal(original[40 * 4], 120);
    }
    if (key === 'lightLeak') {
      assert.ok(original[0] > original[1] && original[1] > original[2]);
      assert.ok(original[0] > original[8 * 4]);
    }
  }
});

test('Canvas exports respect filter strength and FX while keeping border colors intact', async () => {
  const sample = createCanvas(20, 20);
  sample.getContext('2d').fillStyle = '#5a8cbe'; sample.getContext('2d').fillRect(0, 0, 20, 20);
  const image = sample.toDataURL('image/png'), layout = layouts.find((item) => item.id === 'pol11');
  const zero = await renderStrip(layout, [image], { color: '#ffffff', filter: 'bw', filterIntensity: 0, decoration: 'none', frame: null, stickers: [] }, 400);
  const slot = geometry(layout).slots[0], factor = 400 / geometry(layout).width;
  const x = Math.round((slot.x + slot.w / 2) * factor), y = Math.round((slot.y + slot.h / 2) * factor);
  assert.deepEqual(Array.from(zero.getContext('2d').getImageData(x, y, 1, 1).data), [90, 140, 190, 255]);
  const fx = await renderStrip(layout, [image], { color: '#ffffff', filter: 'original', filmFx: { grain: 0, vignette: 0, lightLeak: 100 }, decoration: 'none', frame: null, stickers: [] }, 400);
  assert.notDeepEqual(fx.getContext('2d').getImageData(x, y, 1, 1).data, zero.getContext('2d').getImageData(x, y, 1, 1).data);
  assert.deepEqual(Array.from(fx.getContext('2d').getImageData(1, 1, 1, 1).data), [255, 255, 255, 255]);
});
