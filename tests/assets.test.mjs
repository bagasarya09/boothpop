import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';
import { createCanvas, Image, loadImage } from '@napi-rs/canvas';
import { layouts, geometry, framePresets } from '../src/layout.mjs';

globalThis.Image = Image;
globalThis.document = { createElement() { return createCanvas(1, 1); } };
const bundle = await build({ entryPoints: ['src/canvas.ts'], bundle: true, write: false, format: 'esm', platform: 'browser' });
const { renderStrip } = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));

test('Every published WebP frame decodes, keeps transparent photo openings, and composites over photos', async () => {
  const sample = createCanvas(40, 40), sampleContext = sample.getContext('2d');
  sampleContext.fillStyle = '#de3040'; sampleContext.fillRect(0, 0, 40, 40);
  const photo = sample.toDataURL('image/png');
  for (const preset of framePresets) {
    assert.ok(preset.src.endsWith('.webp'));
    const bytes = await readFile(new URL('../public' + preset.src, import.meta.url));
    assert.equal(bytes.subarray(0, 4).toString(), 'RIFF');
    assert.equal(bytes.subarray(8, 12).toString(), 'WEBP');
    const image = await loadImage(bytes), layout = layouts.find((item) => item.id === preset.layoutId), g = geometry(layout);
    assert.deepEqual([image.width, image.height], [g.width, g.height]);
    const frame = createCanvas(g.width, g.height), frameContext = frame.getContext('2d');
    frameContext.drawImage(image, 0, 0);
    const output = await renderStrip(layout, Array(layout.count).fill(photo), { color: '#ffffff', filter: 'original', decoration: 'none', frame: 'data:image/webp;base64,' + bytes.toString('base64'), stickers: [] });
    for (const slot of g.slots) {
      const x = Math.round(slot.x + slot.w / 2), y = Math.round(slot.y + slot.h / 2);
      assert.equal(frameContext.getImageData(x, y, 1, 1).data[3], 0);
      assert.deepEqual(Array.from(output.getContext('2d').getImageData(x, y, 1, 1).data), [222, 48, 64, 255]);
    }
  }
});
