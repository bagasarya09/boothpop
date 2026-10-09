export const photoFilters = [
  { id: 'original', name: 'Original', description: ['Warna asli foto.', 'Original photo colors.'] },
  { id: 'natural', name: 'Natural', description: ['Warna dan kontras sedikit lebih hidup.', 'A gentle boost to color and contrast.'] },
  { id: 'bright', name: 'Bright', description: ['Foto lebih terang dengan bayangan lebih lembut.', 'Brighter photos with softer shadows.'] },
  { id: 'bw', name: 'B&W', description: ['Hitam putih klasik.', 'Classic black and white.'] },
  { id: 'sepia', name: 'Sepia', description: ['Nuansa cokelat klasik.', 'Classic brown tones.'] },
  { id: 'vintage', name: 'Vintage', description: ['Warna pudar dengan nuansa hangat retro.', 'Faded colors with a warm retro tone.'] },
  { id: 'warm', name: 'Warm', description: ['Nuansa keemasan yang hangat.', 'Warm golden tones.'] },
  { id: 'cool', name: 'Cool', description: ['Nuansa biru yang sejuk.', 'Cool blue tones.'] },
  { id: 'pastel', name: 'Pastel', description: ['Warna lembut dengan kontras rendah.', 'Soft colors with lower contrast.'] },
  { id: 'film', name: 'Film', description: ['Kontras sinematik, grain halus, dan tepi sedikit gelap.', 'Cinematic contrast, subtle grain, and softly darkened edges.'] },
] as const;

export type FilmFx = { grain: number; vignette: number; lightLeak: number };
export const defaultFilmFx: FilmFx = { grain: 0, vignette: 0, lightLeak: 0 };
const percent = (value: number) => Number.isFinite(value) ? Math.max(0, Math.min(100, value)) / 100 : 0;

// Filter intensity blends with the original; Film FX are applied independently.
export function applyPhotoFilter(pixels: Uint8ClampedArray, width: number, height: number, filter: string, intensity = 100, fx: FilmFx = defaultFilmFx) {
  const strength = percent(intensity);
  const known = filter !== 'original' && photoFilters.some((item) => item.id === filter);
  const grainAmount = percent(fx.grain), vignetteAmount = percent(fx.vignette), leakAmount = percent(fx.lightLeak);
  if ((!known || strength === 0) && !grainAmount && !vignetteAmount && !leakAmount) return;
  let saturation = 1, contrast = 1, exposure = 1, lift = 0;
  let redShift = 0, greenShift = 0, blueShift = 0;
  switch (filter) {
    case 'natural': saturation = 1.06; contrast = 1.03; break;
    case 'bright': exposure = 1.12; contrast = 0.96; lift = 6; break;
    case 'vintage': saturation = 0.78; contrast = 0.85; lift = 12; redShift = 12; greenShift = 4; blueShift = -12; break;
    case 'warm': redShift = 16; greenShift = 5; blueShift = -12; break;
    case 'cool': redShift = -12; greenShift = 3; blueShift = 16; break;
    case 'pastel': saturation = 0.70; contrast = 0.78; lift = 22; break;
    case 'film': saturation = 0.92; contrast = 1.14; lift = 4; redShift = 5; blueShift = -5; break;
  }
  const slope = saturation * exposure * contrast;
  for (let offset = 0; offset < pixels.length; offset += 4) {
    const red = pixels[offset], green = pixels[offset + 1], blue = pixels[offset + 2];
    const luminance = 0.299 * red + 0.587 * green + 0.114 * blue;
    const position = offset / 4;
    const nx = (position % width) / Math.max(1, width - 1);
    const ny = Math.floor(position / width) / Math.max(1, height - 1);
    const radius = Math.min(1, ((nx - 0.5) ** 2 + (ny - 0.5) ** 2) * 2);
    let seed = 0;
    if (filter === 'film' || grainAmount) {
      seed = Math.imul(position + 1, 374761393);
      seed = Math.imul(seed ^ (seed >>> 13), 1274126177);
    }
    const noise = ((seed ^ (seed >>> 16)) >>> 0) / 4294967295 * 2 - 1;
    let grain = 0, vignette = 1;
    if (filter === 'film') {
      vignette = 1 - 0.10 * radius;
      // Stable grain avoids random flicker between previews and GIF frames.
      grain = noise * 3;
    }
    const base = luminance * (1 - saturation) * exposure * contrast + 128 * (1 - contrast) + lift;
    let r = red, g = green, b = blue;
    if (known && strength > 0) {
      let filteredR = (red * slope + base + redShift) * vignette + grain;
      let filteredG = (green * slope + base + greenShift) * vignette + grain;
      let filteredB = (blue * slope + base + blueShift) * vignette + grain;
      if (filter === 'bw') filteredR = filteredG = filteredB = luminance;
      if (filter === 'sepia') {
        filteredR = 0.393 * red + 0.769 * green + 0.189 * blue;
        filteredG = 0.349 * red + 0.686 * green + 0.168 * blue;
        filteredB = 0.272 * red + 0.534 * green + 0.131 * blue;
      }
      r += (Math.max(0, Math.min(255, filteredR)) - red) * strength;
      g += (Math.max(0, Math.min(255, filteredG)) - green) * strength;
      b += (Math.max(0, Math.min(255, filteredB)) - blue) * strength;
    }
    const darkness = 1 - 0.65 * vignetteAmount * radius;
    r = r * darkness + noise * 24 * grainAmount;
    g = g * darkness + noise * 24 * grainAmount;
    b = b * darkness + noise * 24 * grainAmount;
    if (leakAmount) {
      // Warm light entering from the upper-left edge; screen blending lifts highlights.
      const glow = Math.exp(-((nx / 0.35) ** 2 + ((ny - 0.2) / 0.8) ** 2)) * leakAmount * 0.85;
      r = 255 - (255 - Math.max(0, Math.min(255, r))) * (1 - glow);
      g = 255 - (255 - Math.max(0, Math.min(255, g))) * (1 - glow * 0.45);
      b = 255 - (255 - Math.max(0, Math.min(255, b))) * (1 - glow * 0.12);
    }
    // Uint8ClampedArray clamps channels to 0..255; alpha is left untouched.
    pixels[offset] = r;
    pixels[offset + 1] = g;
    pixels[offset + 2] = b;
  }
}
