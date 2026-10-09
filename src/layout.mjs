import templates from '../public/frames/templates.json' with { type: 'json' };

export const layouts = [
  { id: 'strip4', count: 4, cols: 1, label: ['Strip 4 foto', '4 photo strip'] },
  { id: 'strip3', count: 3, cols: 1, label: ['Strip 3 foto', '3 photo strip'] },
  { id: 'duo', count: 2, cols: 1, label: ['Duo 2 foto', '2 photo duo'] },
  { id: 'grid4', count: 4, cols: 2, label: ['Grid 4 foto', '4 photo grid'] },
  { id: 'grid6', count: 6, cols: 2, label: ['Grid 6 foto', '6 photo grid'] },
];
// Daftar bingkai publik dikelola di public/frames/templates.json.
export const framePresets = templates;

const printLayouts = [
  ['mini75', 3, 2.5, 7.5, 'Mini 3', 'Mini 3'],
  ['strip9', 2, 3, 9, 'Strip 2', 'Strip 2'],
  ['strip15', 3, 5, 15, 'Strip 3 persegi', '3 square strip'],
  ['wide15', 3, 6, 15, 'Strip 3 landscape', '3 landscape strip'],
  ['wide17', 4, 6, 17, 'Strip 4 landscape', '4 landscape strip'],
  ['tall185', 3, 5, 18.5, 'Strip 3 portrait', '3 portrait strip'],
  ['pol75', 1, 5, 7.5, 'Polaroid mini', 'Mini polaroid'],
  ['pol9', 1, 6, 9, 'Polaroid portrait', 'Portrait polaroid'],
  ['pol10', 1, 7, 10, 'Polaroid 10', 'Polaroid 10'],
  ['pol8', 1, 7, 8, 'Polaroid 8', 'Polaroid 8'],
  ['pol11', 1, 11, 9, 'Polaroid landscape', 'Landscape polaroid'],
];
for (const [id, count, cmW, cmH, idLabel, enLabel] of printLayouts) {
  const printSize =
    (cmH === 9 && cmW === 11
      ? '11 × 9'
      : String(cmH).replace('.', ',') + ' × ' + String(cmW).replace('.', ',')) +
    ' cm';
  layouts.push({
    id,
    count,
    cols: 1,
    label: [idLabel, enLabel],
    cmW,
    cmH,
    printSize,
  });
}
export function geometry(layout) {
  if (layout.cmW && layout.cmH) {
    const ratio = layout.cmW / layout.cmH;
    const width = ratio > 1 ? 2140 : Math.round(2140 * ratio),
      height = ratio > 1 ? Math.round(2140 / ratio) : 2140;
    const pad = Math.round(width * 0.065),
      gap = Math.round(height * 0.012),
      footer = Math.round(height * 0.085);
    const slotW = width - 2 * pad,
      slotH =
        (height - 2 * pad - footer - gap * (layout.count - 1)) / layout.count;
    return {
      width,
      height,
      scale: width / 720,
      slots: Array.from({ length: layout.count }, (_, i) => ({
        x: pad,
        y: pad + i * (slotH + gap),
        w: slotW,
        h: slotH,
      })),
    };
  }

  const width = layout.cols === 1 ? 720 : 1440,
    pad = 48,
    gap = 24;
  const slotW = (width - pad * 2 - gap * (layout.cols - 1)) / layout.cols,
    slotH = Math.round(slotW * 0.75);
  const rows = Math.ceil(layout.count / layout.cols),
    height = pad * 2 + rows * slotH + (rows - 1) * gap + 100;
  const slots = Array.from({ length: layout.count }, (_, i) => ({
    x: pad + (i % layout.cols) * (slotW + gap),
    y: pad + Math.floor(i / layout.cols) * (slotH + gap),
    w: slotW,
    h: slotH,
  }));
  const scale = Math.max(1, 1800 / Math.max(width, height));
  return {
    width: Math.ceil(width * scale),
    height: Math.ceil(height * scale),
    scale,
    slots: slots.map((s) => ({
      x: s.x * scale,
      y: s.y * scale,
      w: s.w * scale,
      h: s.h * scale,
    })),
  };
}
