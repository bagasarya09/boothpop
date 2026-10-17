import { build } from 'esbuild';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { layouts, geometry } from '../src/layout.mjs';

const bundle = await build({ entryPoints: ['src/frame-catalog.ts'], bundle: true, write: false, format: 'esm', platform: 'node' });
const { parseCatalogConfig, fetchFrameCatalog } = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const config = parseCatalogConfig(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_PUBLISHABLE_KEY);
if (!config) throw new Error('Configure .env.local with the project URL and publishable key first.');
const origin = 'http://localhost:5173';
const frames = await fetchFrameCatalog(config, new Set(layouts.map((item) => item.id)), AbortSignal.timeout(15000));
console.log(`Active templates: ${frames.length}`);
let errors = 0;
for (const frame of frames) {
  try {
  const response = await fetch(frame.src, { headers: { Origin: origin }, signal: AbortSignal.timeout(15000) });
  if (!response.ok) {
    let detail = '';
    try { const body = await response.json(); detail = String(body.message ?? body.error ?? ''); } catch {}
    throw new Error(`Image request failed (${response.status}): ${detail}`);
  }
  const cors = response.headers.get('access-control-allow-origin');
  if (cors !== '*' && cors !== origin) throw new Error(`Image cannot be used in a cross-origin canvas: ${frame.id}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > 10 * 1024 * 1024) throw new Error(`Frame exceeds 10 MB: ${frame.id}`);
  const image = await loadImage(bytes), g = geometry(layouts.find((item) => item.id === frame.layoutId));
  if (image.width !== g.width || image.height !== g.height) throw new Error(`Wrong dimensions: ${frame.id}`);
  const canvas = createCanvas(image.width, image.height), context = canvas.getContext('2d');
  context.drawImage(image, 0, 0);
  for (const slot of g.slots) {
    if (context.getImageData(Math.round(slot.x + slot.w / 2), Math.round(slot.y + slot.h / 2), 1, 1).data[3] > 20) throw new Error(`Photo opening is not transparent: ${frame.id}`);
  }
  console.log(`OK: ${frame.id} | ${image.width} × ${image.height} | public image, CORS, transparent opening centers`);
  } catch (error) { errors++; console.error(`FAILED: ${frame.id} | ${error.message}`); }
}
console.log('Read-only connection check complete. No database or Storage records changed.');
if (errors) process.exitCode = 1;
