import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

async function inspect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) { await inspect(path); continue; }
    if (!/\.(js|css|html|map)$/.test(entry.name)) continue;
    const content = await readFile(path, 'utf8');
    if (/AdminPage|boothpop-admin-session|is_boothpop_admin|admin-app|#admin/.test(content)) {
      throw new Error(`Public build contains admin code: ${path}`);
    }
  }
}

await inspect('dist');
console.log('Public build verified: admin route, UI, and API code are excluded.');
