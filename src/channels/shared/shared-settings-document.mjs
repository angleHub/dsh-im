import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const updates = new Map();

export async function updateSharedSettingsDocument(path, update) {
  const key = resolve(path);
  const previous = updates.get(key) ?? Promise.resolve();
  const current = previous.catch(() => undefined).then(async () => {
    let document;
    try {
      document = JSON.parse(await readFile(key, 'utf8'));
    } catch (error) {
      if (error?.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error;
    }
    if (!document || typeof document !== 'object' || Array.isArray(document)
      || document.version !== 1) document = { version: 1 };
    const next = update(document);
    await mkdir(dirname(key), { recursive: true, mode: 0o700 });
    const temporary = `${key}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporary, `${JSON.stringify(next, null, 2)}\n`, {
        encoding: 'utf8', mode: 0o600, flag: 'wx',
      });
      await rename(temporary, key);
    } finally {
      await unlink(temporary).catch((error) => {
        if (error.code !== 'ENOENT') throw error;
      });
    }
    return next;
  });
  updates.set(key, current);
  try {
    return await current;
  } finally {
    if (updates.get(key) === current) updates.delete(key);
  }
}
