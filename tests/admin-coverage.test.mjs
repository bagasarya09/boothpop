import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { layouts } from '../src/layout.mjs';

const bundle = await build({ entryPoints: ['src/admin-coverage.ts'], bundle: true, write: false, format: 'esm', platform: 'browser' });
const { layoutCoverage } = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));

test('Coverage distinguishes missing designs, inactive-only designs, and several designs for one layout', () => {
  const coverage = layoutCoverage(layouts, [
    { layout_id: 'strip4', is_active: true },
    { layout_id: 'strip4', is_active: false },
    { layout_id: 'strip4', is_active: true },
    { layout_id: 'grid4', is_active: false },
  ]);
  assert.equal(coverage.length, layouts.length);
  assert.deepEqual(coverage.filter((item) => item.total > 0).map((item) => item.layout.id), ['strip4', 'grid4']);
  assert.equal(coverage.find((item) => item.layout.id === 'strip4').total, 3);
  assert.equal(coverage.find((item) => item.layout.id === 'strip4').active, 2);
  assert.equal(coverage.find((item) => item.layout.id === 'grid4').total, 1);
  assert.equal(coverage.find((item) => item.layout.id === 'grid4').active, 0);
  assert.equal(coverage.filter((item) => item.total === 0).length, layouts.length - 2);
});

test('An empty catalog lists every layout as needing a template', () => {
  const coverage = layoutCoverage(layouts, []);
  assert.ok(coverage.every((item) => item.total === 0 && item.active === 0));
  assert.deepEqual(coverage.map((item) => item.layout.id), layouts.map((layout) => layout.id));
});
