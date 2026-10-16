import 'fake-indexeddb/auto';
import { beforeEach, expect, it } from 'vitest';
import { ARTIFACT_DB_NAME, createArtifactStore } from '../../lib/agent-plugin/artifacts/store';
beforeEach(async () => {
  await new Promise<void>((resolve) => {
    const r = indexedDB.deleteDatabase(ARTIFACT_DB_NAME);
    r.onsuccess = () => resolve();
  });
});
it('persists explicit saves and restores earlier text as a new version', async () => {
  const store = createArtifactStore();
  const first = await store.create({ title: 'Draft', text: 'one', provenance: { conversation: 'chat' } });
  const second = await store.update(first.id, 1, { title: 'Draft', text: 'two' });
  const restored = await store.update(first.id, 2, { title: 'Draft', text: second.versions[0].text });
  expect(restored.versions.map((v) => v.text)).toEqual(['one', 'two', 'one']);
  expect(await createArtifactStore().get(first.id)).toEqual(restored);
  expect(await store.list()).toEqual([{ id: first.id, title: 'Draft', updatedAt: restored.updatedAt, version: 3 }]);
  await store.delete(first.id);
  expect(await store.get(first.id)).toBeUndefined();
});
it('atomically rejects competing edits without losing versions', async () => {
  const store = createArtifactStore();
  const a = await store.create({ title: 'Draft', text: 'one', provenance: {} });
  const results = await Promise.allSettled(
    ['two', 'three'].map((text) => store.update(a.id, 1, { title: 'Draft', text })),
  );
  expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  expect((await store.get(a.id))?.versions).toHaveLength(2);
});
it('bounds text and version history without deleting saved versions', async () => {
  const store = createArtifactStore();
  await expect(store.create({ title: 'Draft', text: 'x'.repeat(131073), provenance: {} })).rejects.toThrow(
    'text-limit',
  );
  const a = await store.create({ title: 'Draft', text: 'one', provenance: {} });
  for (let version = 1; version < 20; version++)
    await store.update(a.id, version, { title: 'Draft', text: String(version) });
  await expect(store.update(a.id, 20, { title: 'Draft', text: 'extra' })).rejects.toThrow('version-limit');
  expect((await store.get(a.id))?.versions).toHaveLength(20);
});
it('limits artifact metadata independently of full text and rejects edits after deletion', async () => {
  const store = createArtifactStore();
  for (let i = 0; i < 50; i++) await store.create({ title: String(i), text: 'body', provenance: {} });
  await expect(store.create({ title: 'extra', text: 'body', provenance: {} })).rejects.toThrow('count-limit');
  const first = (await store.list())[0];
  await store.delete(first.id);
  await expect(store.update(first.id, 1, { title: 'new', text: 'body' })).rejects.toThrow('missing');
  await store.create({ title: 'replacement', text: 'body', provenance: {} });
  expect(await store.list()).toHaveLength(50);
});
it('copies bounded provenance and rejects invalid title and multibyte text', async () => {
  const store = createArtifactStore();
  const provenance = { sources: [{ title: 'reference', connector: 'local' }] };
  const a = await store.create({ title: ' Draft ', text: 'body', provenance });
  provenance.sources[0].title = 'changed';
  expect((await store.get(a.id))?.provenance.sources?.[0].title).toBe('reference');
  await expect(store.update(a.id, 1, { title: ' ', text: 'body' })).rejects.toThrow('invalid');
  await expect(store.update(a.id, 1, { title: 'title', text: '中'.repeat(44000) })).rejects.toThrow('text-limit');
  await expect(
    store.create({ title: 'title', text: 'body', provenance: { conversation: 'x'.repeat(201) } }),
  ).rejects.toThrow('limit');
});
it('persists independent structured snapshots and keeps atomic version ownership', async () => {
  const store = createArtifactStore();
  const payload = { kind: 'table' as const, columns: ['Name'], rows: [['first']] };
  const a = await store.create({
    title: 'Table',
    text: JSON.stringify(payload),
    payload,
    provenance: { sources: [{ title: 'Policy', connector: 'local' }] },
  });
  payload.rows[0][0] = 'changed';
  expect(a.versions[0].payload).toEqual({ kind: 'table', columns: ['Name'], rows: [['first']] });
  const next = { kind: 'slides' as const, slides: [{ title: 'Title', body: 'Body' }] };
  await store.update(a.id, 1, { title: 'Slides', text: JSON.stringify(next), payload: next });
  await expect(store.update(a.id, 1, { title: 'Stale', text: JSON.stringify(next), payload: next })).rejects.toThrow(
    'conflict',
  );
  expect((await store.get(a.id))?.provenance.sources?.[0].title).toBe('Policy');
  await expect(store.create({ title: 'bad', text: 'mismatch', payload: next, provenance: {} })).rejects.toThrow(
    'invalid',
  );
});
it('preserves full legacy capacity and rejects corrupted schemas on read without overwriting', async () => {
  const store = createArtifactStore();
  const a = await store.create({ title: 'Legacy', text: 'x'.repeat(131072), provenance: {} });
  expect((await store.get(a.id))?.versions[0].text.length).toBe(131072);
  await new Promise<void>((resolve, reject) => {
    const r = indexedDB.open(ARTIFACT_DB_NAME, 1);
    r.onsuccess = () => {
      const db = r.result;
      const tx = db.transaction('artifacts', 'readwrite');
      tx.objectStore('artifacts').put({ ...a, versions: [{ ...a.versions[0], schemaVersion: 2 }] });
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    };
  });
  await expect(store.get(a.id)).rejects.toThrow('invalid');
  await expect(store.update(a.id, 1, { title: 'bad', text: 'new' })).rejects.toThrow('invalid');
});
