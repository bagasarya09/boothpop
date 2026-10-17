import { geometry } from './layout.mjs';
import { loadImage, type Layout } from './canvas';

export const ADMIN_FRAME_TARGET_BYTES = 500 * 1024;
const MAX_FRAME_BYTES = 10 * 1024 * 1024;

export async function compressAdminFrame(canvas: Pick<HTMLCanvasElement, 'toBlob'>, original: Blob): Promise<Blob> {
  // Avoid recompressing WebP that is already small enough.
  if (original.type === 'image/webp' && original.size <= ADMIN_FRAME_TARGET_BYTES) return original;
  let best: Blob | null = original.type === 'image/webp' ? original : null;
  for (const quality of [0.92, 0.86, 0.80, 0.74]) {
    const result = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', quality));
    if (result?.type !== 'image/webp' || result.size === 0) {
      if (best) break;
      throw new Error('Browser belum mendukung konversi WebP. Upload file WebP atau coba browser lain.');
    }
    if (!best || result.size < best.size) best = result;
    if (best.size <= ADMIN_FRAME_TARGET_BYTES) break;
  }
  if (!best || best.size > MAX_FRAME_BYTES) throw new Error('Hasil WebP masih melebihi 10 MB. Kompres desain terlebih dahulu.');
  return best;
}

export function validateTemplateInput(name: string, sortOrder: number) {
  if (!name.trim() || name.trim().length > 100) throw new Error('Nama template wajib diisi, maksimal 100 karakter.');
  if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 999999) throw new Error('Urutan harus bilangan bulat antara 0 dan 999999.');
  return { name: name.trim(), sort_order: sortOrder };
}

export function checkFramePixels(layout: Layout, width: number, height: number, context: Pick<CanvasRenderingContext2D, 'getImageData'>) {
  const g = geometry(layout);
  if (width !== g.width || height !== g.height) throw new Error(`Ukuran gambar ${width} × ${height} px; layout ini membutuhkan ${g.width} × ${g.height} px.`);
  for (const [index, slot] of g.slots.entries()) {
    if (context.getImageData(Math.round(slot.x + slot.w / 2), Math.round(slot.y + slot.h / 2), 1, 1).data[3] > 20) {
      throw new Error(`Pusat lubang foto ${index + 1} harus transparan. Gunakan template posisi foto yang sesuai.`);
    }
  }
}

export async function prepareAdminFrame(file: File, layout: Layout): Promise<Blob> {
  if (!['image/png', 'image/webp'].includes(file.type)) throw new Error('Gunakan PNG atau WebP transparan.');
  if (file.size > MAX_FRAME_BYTES) throw new Error('Gambar maksimal 10 MB.');
  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const png = [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => header[index] === value);
  const webp = new TextDecoder().decode(header.slice(0, 4)) === 'RIFF' && new TextDecoder().decode(header.slice(8, 12)) === 'WEBP';
  if (!(file.type === 'image/png' ? png : webp)) throw new Error('Isi file tidak sesuai format PNG/WebP.');
  const source = URL.createObjectURL(file);
  try {
    const image = await loadImage(source);
    const g = geometry(layout);
    if (image.width !== g.width || image.height !== g.height) throw new Error(`Ukuran gambar ${image.width} × ${image.height} px; gunakan ${g.width} × ${g.height} px.`);
    const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
    const context = canvas.getContext('2d')!; context.drawImage(image, 0, 0);
    checkFramePixels(layout, image.width, image.height, context);
    const compressed = await compressAdminFrame(canvas, file);
    if (compressed === file) return file;
    const optimizedSource = URL.createObjectURL(compressed);
    try {
      const optimized = await loadImage(optimizedSource);
      if (optimized.width !== image.width || optimized.height !== image.height) throw new Error('Ukuran gambar berubah saat kompresi. Coba upload WebP yang sudah disiapkan.');
      const check = document.createElement('canvas'); check.width = image.width; check.height = image.height;
      const checkContext = check.getContext('2d')!; checkContext.drawImage(optimized, 0, 0);
      checkFramePixels(layout, check.width, check.height, checkContext);
      const before = context.getImageData(0, 0, image.width, image.height).data;
      const after = checkContext.getImageData(0, 0, image.width, image.height).data;
      for (let index = 3; index < before.length; index += 4) {
        if (before[index] !== after[index]) throw new Error('Transparansi berubah saat kompresi. Coba upload WebP yang sudah disiapkan.');
      }
      return compressed;
    } finally { URL.revokeObjectURL(optimizedSource); }
  } finally { URL.revokeObjectURL(source); }
}
