import test from 'node:test';
import assert from 'node:assert/strict';
import { createCanvas, Image } from '@napi-rs/canvas';
import { build } from 'esbuild';
import { layouts, geometry } from '../src/layout.mjs';

const result = await build({ entryPoints: ['src/slideshow.ts'], bundle: true, write: false, format: 'esm', platform: 'node' });
globalThis.Image = Image;
globalThis.document = { createElement() { return createCanvas(1, 1); } };
const { slideshowGif, slideshowLayout, slideshowOptions } = await import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64'));
const options = { color: '#ffffff', filter: 'original', decoration: 'none', frame: null, stickers: [] };
function photo(color) {
  const canvas = createCanvas(40, 40);
  canvas.getContext('2d').fillStyle = color;
  canvas.getContext('2d').fillRect(0, 0, 40, 40);
  return canvas.toDataURL('image/png');
}

// Parse block boundaries rather than matching byte patterns inside compressed data.
function gifFrames(buffer) {
  const bytes = new Uint8Array(buffer);
  const word = (offset) => bytes[offset] | bytes[offset + 1] << 8;
  let offset = 13, delay = 0;
  const frames = [];
  const palette = (size) => {
    const colors = Array.from({ length: size }, (_, index) => Array.from(bytes.slice(offset + index * 3, offset + index * 3 + 3)));
    offset += size * 3;
    return colors;
  };
  const subBlocks = () => { while (bytes[offset]) { offset += 1 + bytes[offset]; } offset++; };
  const globalPalette = bytes[10] & 128 ? palette(1 << ((bytes[10] & 7) + 1)) : [];
  while (offset < bytes.length && bytes[offset] !== 0x3b) {
    const marker = bytes[offset++];
    if (marker === 0x21) {
      const label = bytes[offset++];
      if (label === 0xf9) delay = word(offset + 2);
      subBlocks();
    } else if (marker === 0x2c) {
      const width = word(offset + 4), height = word(offset + 6), packed = bytes[offset + 8];
      offset += 9;
      const colors = packed & 128 ? palette(1 << ((packed & 7) + 1)) : globalPalette;
      offset++; subBlocks();
      frames.push({ width, height, delay, colors });
    } else throw new Error('Invalid GIF block');
  }
  assert.equal(bytes[offset], 0x3b);
  return frames;
}

test('Slideshow has exactly one photo opening, independent of the print layout', () => {
  assert.equal(slideshowLayout.count, 1);
  assert.equal(geometry(slideshowLayout).slots.length, 1);
});

test('Three-photo strip becomes a single-photo GIF in source order with faster intervals', async () => {
  const layout = layouts.find((item) => item.id === 'strip3');
  const photos = [photo('#ff0000'), photo('#00ff00'), photo('#0000ff')];
  const originals = [...photos];
  for (const seconds of [0.5, 1, 2]) {
    const updates = [];
    const blob = await slideshowGif(layout, photos, options, seconds, (done, total) => updates.push([done, total]));
    assert.equal(blob.type, 'image/gif');
    const buffer = await blob.arrayBuffer();
    const bytes = Buffer.from(buffer);
    assert.equal(bytes.subarray(0, 6).toString(), 'GIF89a');
    assert.ok(bytes.includes(Buffer.from('NETSCAPE2.0')));
    const frames = gifFrames(buffer);
    assert.equal(frames.length, 3);
    assert.ok(frames.every((frame) => frame.delay === seconds * 100 && Math.max(frame.width, frame.height) === 800));
    assert.ok(frames.every((frame) => frame.width > frame.height));
    for (const [index, frame] of frames.entries()) {
      assert.ok(frame.colors.some((color) => color[index] > 200 && color[(index + 1) % 3] < 40 && color[(index + 2) % 3] < 40));
    }
    assert.deepEqual(updates, [[1, 3], [2, 3], [3, 3]]);
    assert.deepEqual(photos, originals);
  }
});

test('GIF rejects one-photo and incomplete sessions', async () => {
  await assert.rejects(slideshowGif(layouts.find((item) => item.id === 'pol11'), [photo('#000')], options, 0.5));
  await assert.rejects(slideshowGif(layouts[0], [photo('#000'), photo('#fff')], options, 0.5));
});

test('GIF options omit the template without changing the selected PNG frame or other effects', () => {
  const selected = { ...options, frame: 'selected-frame.png', filter: 'warm', filterIntensity: 40, filmFx: { grain: 12, vignette: 20, lightLeak: 5 } };
  const gifOptions = slideshowOptions(selected);
  assert.equal(gifOptions.frame, null);
  assert.equal(selected.frame, 'selected-frame.png');
  assert.deepEqual(gifOptions, { ...selected, frame: null });
});

test('GIF export ignores selected frame even if it cannot be loaded', async () => {
  const layout = layouts.find((item) => item.id === 'duo');
  const photos = [photo('#ff0000'), photo('#0000ff')];
  const plain = await slideshowGif(layout, photos, options, 0.5);
  const selected = await slideshowGif(layout, photos, { ...options, frame: 'invalid-frame-must-not-load' }, 0.5);
  assert.deepEqual(await selected.arrayBuffer(), await plain.arrayBuffer());
});
