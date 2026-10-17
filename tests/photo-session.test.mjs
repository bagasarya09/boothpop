import test from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import { build } from 'esbuild';

const bundle = await build({ entryPoints: ['src/photo-session.ts'], bundle: true, write: false, format: 'esm', platform: 'browser' });
const { readPhotoSession, savePhotoSession } = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const keys = new Map();
globalThis.sessionStorage = { getItem: key => keys.get(key) ?? null, setItem: (key, value) => keys.set(key, value) };
const snapshot = () => ({ version: 1, layoutId: 'strip3', step: 2, timer: 3, photos: [], captureShots: ['photo-one', '', ''], retake: null,
  color: '#FFFFFF', filter: 'warm', filterIntensity: 65, filmFx: { grain: 20, vignette: 0, lightLeak: 0 },
  decoration: 'none', frame: 'data:image/webp;base64,frame', stickers: [], exportFormat: 'gif', gifSeconds: 0.5 });

test('Photo session survives reload, preserves edits, isolates tabs, and clears on a new session', async () => {
  assert.equal(await readPhotoSession(), null);
  const original = snapshot();
  await savePhotoSession(original);
  assert.deepEqual(await readPhotoSession(), original);
  const firstTab = keys.get('boothpop-photo-session-id');
  keys.clear();
  assert.equal(await readPhotoSession(), null);
  keys.set('boothpop-photo-session-id', firstTab);
  assert.deepEqual((await readPhotoSession()).captureShots, ['photo-one', '', '']);
  const cleared = { ...original, step: 1, photos: [], captureShots: [], frame: null, stickers: [] };
  await savePhotoSession(cleared);
  assert.deepEqual(await readPhotoSession(), cleared);
});

test('Completed capture and completed retake recover into review during final flash', async () => {
  for (const retake of [null, 1]) {
    await savePhotoSession({ ...snapshot(), retake, photos: ['old-one', 'old-two', 'old-three'], captureShots: ['one', 'two', 'three'] });
    const recovered = await readPhotoSession();
    assert.equal(recovered.step, 3);
    assert.equal(recovered.retake, null);
    assert.deepEqual(recovered.photos, ['one', 'two', 'three']);
  }
});

test('Writes retain ordering and capture a copy before asynchronous persistence', async () => {
  const initial = snapshot();
  const first = savePhotoSession(initial);
  initial.captureShots[0] = 'mutated';
  await first;
  assert.equal((await readPhotoSession()).captureShots[0], 'photo-one');
  await Promise.all([savePhotoSession(snapshot()), savePhotoSession({ ...snapshot(), filter: 'cool' })]);
  assert.equal((await readPhotoSession()).filter, 'cool');
});

test('Storage failures are reported and do not poison later saves', async () => {
  const storage = globalThis.sessionStorage;
  globalThis.sessionStorage = { getItem() { throw new Error('Storage blocked'); } };
  await assert.rejects(savePhotoSession(snapshot()), /Storage blocked/);
  await assert.rejects(readPhotoSession(), /Storage blocked/);
  globalThis.sessionStorage = storage;
  await savePhotoSession(snapshot());
  assert.deepEqual(await readPhotoSession(), snapshot());
});
