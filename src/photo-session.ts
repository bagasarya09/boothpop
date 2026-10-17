import type { Sticker } from './canvas';
import type { FilmFx } from './filters';
import { layouts } from './layout.mjs';

export type PhotoSession = {
  version: 1; layoutId: string; step: number; timer: number;
  photos: string[]; captureShots: string[]; retake: number | null;
  color: string; filter: string; filterIntensity: number; filmFx: FilmFx;
  decoration: string; frame: string | null; stickers: Sticker[];
  exportFormat: 'png' | 'gif'; gifSeconds: 0.5 | 1 | 2;
};

function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('boothpop-photo-session', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('sessions');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Session storage is blocked'));
  });
}

// One record per tab: refresh restores it without mixing simultaneous sessions.
function sessionKey() {
  let key = sessionStorage.getItem('boothpop-photo-session-id');
  if (!key) { key = crypto.randomUUID(); sessionStorage.setItem('boothpop-photo-session-id', key); }
  return key;
}

export async function readPhotoSession(): Promise<PhotoSession | null> {
  const key = sessionKey(), db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('sessions', 'readonly');
      const request = tx.objectStore('sessions').get(key);
      tx.oncomplete = () => {
        const value = request.result;
        const layout = layouts.find(item => item.id === value?.layoutId);
        if (value?.version !== 1 || !layout || !Array.isArray(value.photos) || !Array.isArray(value.captureShots)) { resolve(null); return; }
        // A refresh during the final flash should open review, including retakes.
        if (value.step === 2 && value.captureShots.length === layout.count && value.captureShots.every((photo: unknown) => typeof photo === 'string' && photo.length > 0)) {
          resolve({ ...value, photos: [...value.captureShots], step: 3, retake: null });
        } else resolve(value);
      };
      tx.onabort = () => reject(tx.error);
    });
  } finally { db.close(); }
}

let writes: Promise<void> = Promise.resolve();
export function savePhotoSession(value: PhotoSession): Promise<void> {
  const snapshot = structuredClone(value);
  const operation = writes.catch(() => {}).then(async () => {
    const key = sessionKey(), db = await database();
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('sessions', 'readwrite');
        tx.objectStore('sessions').put(snapshot, key);
        tx.oncomplete = () => resolve();
        tx.onabort = () => reject(tx.error);
        tx.onerror = () => reject(tx.error);
      });
    } finally { db.close(); }
  });
  writes = operation;
  return operation;
}
