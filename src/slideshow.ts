import { renderStrip, type Layout, type Options } from './canvas';

// A single photo opening, independent of the selected printable strip/grid.
export const slideshowLayout: Layout = { id: 'slideshow', count: 1, cols: 1, label: ['Slideshow', 'Slideshow'] };

export async function slideshowGif(
  layout: Layout, photos: string[], options: Options, seconds: 0.5 | 1 | 2,
  onProgress: (completed: number, total: number) => void = () => {},
) {
  if (photos.length < 2 || photos.length !== layout.count) throw new Error('GIF needs at least two photos and a complete layout.');
  if (![0.5, 1, 2].includes(seconds)) throw new Error('Invalid slideshow interval');
  const { GIFEncoder, quantize, applyPalette } = await import('gifenc');
  const gif = GIFEncoder();
  for (let index = 0; index < photos.length; index++) {
    // Multi-opening PNG overlays do not fit the single-photo slideshow layout.
    const canvas = await renderStrip(slideshowLayout, [photos[index]], { ...options, frame: null }, 800);
    const pixels = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
    const palette = quantize(pixels, 256);
    gif.writeFrame(applyPalette(pixels, palette), canvas.width, canvas.height, { palette, delay: seconds * 1000, repeat: 0 });
    onProgress(index + 1, photos.length);
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  gif.finish();
  return new Blob([new Uint8Array(gif.bytes()).buffer], { type: 'image/gif' });
}
