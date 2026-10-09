import { readFile, stat, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { layouts, geometry } from '../src/layout.mjs';

const root = new URL('../public/frames/', import.meta.url);
const presets = JSON.parse(await readFile(new URL('templates.json', root), 'utf8'));
if (!Array.isArray(presets)) throw new Error('templates.json harus berisi array [ ... ].');
const ids = new Set();
const files = await readdir(root);
let errors = 0;
for (const preset of presets) {
  try {
    if (!preset || typeof preset !== 'object') throw new Error('Entri template harus berupa object.');
    for (const key of ['id', 'name', 'layoutId', 'src']) {
      if (typeof preset[key] !== 'string' || !preset[key].trim()) {
        throw new Error(`Kolom ${key} wajib diisi dengan teks.`);
      }
    }
    if (ids.has(preset.id)) throw new Error(`ID duplikat: ${preset.id}.`);
    ids.add(preset.id);
    const layout = layouts.find((item) => item.id === preset.layoutId);
    if (!layout) throw new Error(`layoutId tidak dikenal: ${preset.layoutId}. Lihat PANDUAN-BINGKAI.md.`);
    if (!/^\/frames\/[A-Za-z0-9_-]+\.png$/.test(preset.src)) {
      throw new Error('src harus /frames/nama-file.png (huruf, angka, tanda - atau _).');
    }
    const filename = preset.src.slice('/frames/'.length);
    if (!files.includes(filename)) throw new Error(`File ${filename} tidak ditemukan. Periksa huruf besar/kecil.`);
    const path = fileURLToPath(new URL(filename, root));
    if ((await stat(path)).size > 10 * 1024 * 1024) throw new Error('PNG melebihi 10 MB.');
    const bytes = await readFile(path);
    if (!bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
      throw new Error('File harus berupa PNG asli, bukan gambar lain yang diganti ekstensi.');
    }
    const expected = geometry(layout);
    const image = await loadImage(bytes);
    if (image.width !== expected.width || image.height !== expected.height) {
      throw new Error(`Ukuran ${image.width} × ${image.height}; layout ${layout.id} membutuhkan ${expected.width} × ${expected.height} px.`);
    }
    const canvas = createCanvas(image.width, image.height);
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0);
    for (const [index, slot] of expected.slots.entries()) {
      const alpha = context.getImageData(Math.round(slot.x + slot.w / 2), Math.round(slot.y + slot.h / 2), 1, 1).data[3];
      if (alpha > 20) throw new Error(`Pusat lubang foto ${index + 1} belum transparan. Gunakan template dari aplikasi.`);
    }
    console.log(`OK: ${preset.name} → ${layout.label[0]} (${image.width} × ${image.height} px)`);
  } catch (error) {
    errors++;
    console.error(`GAGAL: ${preset?.name ?? '(tanpa nama)'} — ${error.message}`);
  }
}
if (errors) {
  console.error(`${errors} template perlu diperbaiki.`);
  process.exitCode = 1;
} else {
  console.log(`${presets.length} template valid. Periksa juga seluruh area foto melalui preview aplikasi.`);
}
