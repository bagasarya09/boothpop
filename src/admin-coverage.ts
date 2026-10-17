import type { Layout } from './canvas';

export function layoutCoverage(layouts: Layout[], templates: { layout_id: string; is_active: boolean }[]) {
  return layouts.map((layout) => {
    const matches = templates.filter((template) => template.layout_id === layout.id);
    return { layout, total: matches.length, active: matches.filter((template) => template.is_active).length };
  });
}
