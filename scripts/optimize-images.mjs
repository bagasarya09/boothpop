import { readFile, writeFile, readdir, mkdir, rename, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';
import { createCanvas, loadImage } from '@napi-rs/canvas';

const root = fileURLToPath(new URL('../', import.meta.url));
const publicRoot = join(root, 'public');
const originals = join(root, 'assets', 'originals');
async function pngFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await pngFiles(path));
    else if (entry.isFile() && /\.png$/i.test(entry.name)) files.push(path);
  }
  return files;
}
const exists = async (path) => { try { await access(path); return true; } catch { return false; } };
const results = [];
for (const source of await pngFiles(publicRoot)) {
  const name = relative(publicRoot, source);
  const target = source.replace(/\.png$/i, '.webp');
  const backup = join(originals, name);
  if (await exists(backup)) throw new Error(`Original already exists: ${backup}. Rename the new design before converting it.`);
  if (await exists(target)) throw new Error(`WebP already exists: ${target}. Rename the new design before converting it.`);
  const bytes = await readFile(source);
  const image = await loadImage(bytes);
  const canvas = createCanvas(image.width, image.height), context = canvas.getContext('2d');
  context.drawImage(image, 0, 0);
  const encoded = await canvas.encode('webp', 92);
  const decoded = await loadImage(encoded);
  if (decoded.width !== image.width || decoded.height !== image.height) throw new Error(`Dimensions changed: ${name}`);
  const check = createCanvas(image.width, image.height), checkContext = check.getContext('2d');
  checkContext.drawImage(decoded, 0, 0);
  const before = context.getImageData(0, 0, image.width, image.height).data;
  const after = checkContext.getImageData(0, 0, image.width, image.height).data;
  for (let index = 3; index < before.length; index += 4) {
    if (before[index] !== after[index]) throw new Error(`Transparency changed: ${name}`);
  }
  await writeFile(target, encoded);
  results.push({ source, target, backup, name, width: image.width, height: image.height, before: bytes.length, after: encoded.length });
}

const manifestPath = join(publicRoot, 'frames', 'templates.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const replacements = new Map(results.map((item) => ['/' + relative(publicRoot, item.source).replaceAll('\\', '/'), '/' + relative(publicRoot, item.target).replaceAll('\\', '/')]));
for (const preset of manifest) preset.src = replacements.get(preset.src) ?? preset.src;
await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

// A separate small icon avoids downloading the full-resolution logo for a browser tab.
const logoPath = join(publicRoot, 'Logo_Boothpop.webp');
if (await exists(logoPath)) {
  const logo = await loadImage(logoPath), icon = createCanvas(64, 64), context = icon.getContext('2d');
  const scale = Math.min(64 / logo.width, 64 / logo.height);
  context.drawImage(logo, (64 - logo.width * scale) / 2, (64 - logo.height * scale) / 2, logo.width * scale, logo.height * scale);
  await writeFile(join(publicRoot, 'favicon.webp'), await icon.encode('webp', 92));
  const indexPath = join(root, 'index.html');
  const html = await readFile(indexPath, 'utf8');
  await writeFile(indexPath, html.replace(/<link\s+rel="icon"[^>]*>/, '<link rel="icon" type="image/webp" href="/favicon.webp" />'));
}
for (const item of results) {
  await mkdir(dirname(item.backup), { recursive: true });
  await rename(item.source, item.backup);
  console.log(`${item.name}: ${item.width} × ${item.height} px | ${(item.before / 1024).toFixed(1)} → ${(item.after / 1024).toFixed(1)} KB (${(100 * (1 - item.after / item.before)).toFixed(1)}% smaller)`);
}
if (results.length) {
  const before = results.reduce((sum, item) => sum + item.before, 0), after = results.reduce((sum, item) => sum + item.after, 0);
  console.log(`TOTAL: ${(before / 1024).toFixed(1)} → ${(after / 1024).toFixed(1)} KB (${(100 * (1 - after / before)).toFixed(1)}% smaller). Alpha channels verified pixel-by-pixel. Original PNGs saved outside public at assets/originals/.`);
} else console.log('No new PNG assets to convert.');
