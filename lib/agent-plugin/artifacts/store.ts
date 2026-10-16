export const ARTIFACT_DB_NAME = 'document-ai-artifacts';
export interface ArtifactProvenance {
  conversation?: string;
  sources?: Array<{ title: string; connector: string }>;
}
export interface ArtifactVersion {
  version: number;
  text: string;
  createdAt: number;
}
export interface Artifact {
  id: string;
  title: string;
  updatedAt: number;
  versions: ArtifactVersion[];
  provenance: ArtifactProvenance;
}
export interface ArtifactSummary {
  id: string;
  title: string;
  updatedAt: number;
  version: number;
}
export interface ArtifactStore {
  create(input: { title: string; text: string; provenance: ArtifactProvenance }): Promise<Artifact>;
  list(): Promise<ArtifactSummary[]>;
  get(id: string): Promise<Artifact | undefined>;
  update(id: string, expectedVersion: number, input: { title: string; text: string }): Promise<Artifact>;
  delete(id: string): Promise<void>;
}
export class ArtifactError extends Error {
  constructor(readonly code: 'conflict' | 'limit' | 'missing' | 'invalid') {
    super(`Artifact ${code}`);
  }
}
function validate(title: string, text: string): void {
  if (!title.trim() || title.length > 200 || !text.trim()) throw new ArtifactError('invalid');
  if (new TextEncoder().encode(text).length > 128 * 1024) throw new ArtifactError('limit');
}
function provenance(input: ArtifactProvenance): ArtifactProvenance {
  if (
    (input.conversation?.length ?? 0) > 200 ||
    (input.sources?.length ?? 0) > 20 ||
    input.sources?.some((s) => !s.title || s.title.length > 200 || !s.connector || s.connector.length > 100)
  )
    throw new ArtifactError('limit');
  return {
    ...(input.conversation ? { conversation: input.conversation } : {}),
    ...(input.sources ? { sources: input.sources.map((s) => ({ title: s.title, connector: s.connector })) } : {}),
  };
}
/** Explicit local persistence, independent of conversation opt-in. History is capped, never silently pruned. */
export function createArtifactStore(): ArtifactStore {
  async function run<T>(
    mode: IDBTransactionMode,
    work: (tx: IDBTransaction, done: (value: T) => void, fail: (error: Error) => void) => void,
  ): Promise<T> {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const opening = indexedDB.open(ARTIFACT_DB_NAME, 1);
      opening.onupgradeneeded = () => {
        opening.result.createObjectStore('artifacts', { keyPath: 'id' });
        opening.result.createObjectStore('summaries', { keyPath: 'id' });
      };
      opening.onsuccess = () => resolve(opening.result);
      opening.onerror = () => reject(opening.error);
    });
    return new Promise<T>((resolve, reject) => {
      const tx = db.transaction(['artifacts', 'summaries'], mode);
      let result: T;
      let failure: Error | undefined;
      tx.oncomplete = () => {
        db.close();
        resolve(result);
      };
      tx.onabort = () => {
        db.close();
        reject(failure ?? tx.error ?? new Error('Artifact storage unavailable'));
      };
      try {
        work(
          tx,
          (value) => {
            result = value;
          },
          (error) => {
            failure = error;
            tx.abort();
          },
        );
      } catch (error) {
        failure = error instanceof Error ? error : new Error('Artifact storage unavailable');
        tx.abort();
      }
    });
  }
  function put(tx: IDBTransaction, a: Artifact): void {
    tx.objectStore('artifacts').put(a);
    tx.objectStore('summaries').put({
      id: a.id,
      title: a.title,
      updatedAt: a.updatedAt,
      version: a.versions.at(-1)!.version,
    });
  }
  return {
    async create(input) {
      validate(input.title, input.text);
      const origin = provenance(input.provenance);
      return run('readwrite', (tx, done, fail) => {
        const count = tx.objectStore('summaries').count();
        count.onsuccess = () => {
          if (count.result >= 50) return fail(new ArtifactError('limit'));
          const now = Date.now();
          const a: Artifact = {
            id: crypto.randomUUID(),
            title: input.title.trim(),
            updatedAt: now,
            versions: [{ version: 1, text: input.text, createdAt: now }],
            provenance: origin,
          };
          put(tx, a);
          done(a);
        };
      });
    },
    list: () =>
      run('readonly', (tx, done) => {
        const r = tx.objectStore('summaries').getAll(undefined, 50);
        r.onsuccess = () => done((r.result as ArtifactSummary[]).sort((a, b) => b.updatedAt - a.updatedAt));
      }),
    get: (id) =>
      run('readonly', (tx, done) => {
        const r = tx.objectStore('artifacts').get(id);
        r.onsuccess = () => done(r.result as Artifact | undefined);
      }),
    async update(id, expectedVersion, input) {
      validate(input.title, input.text);
      return run('readwrite', (tx, done, fail) => {
        const r = tx.objectStore('artifacts').get(id);
        r.onsuccess = () => {
          const a = r.result as Artifact | undefined;
          if (!a) return fail(new ArtifactError('missing'));
          if (a.versions.at(-1)!.version !== expectedVersion) return fail(new ArtifactError('conflict'));
          if (a.versions.length >= 20) return fail(new ArtifactError('limit'));
          const now = Date.now();
          a.title = input.title.trim();
          a.updatedAt = now;
          a.versions.push({ version: expectedVersion + 1, text: input.text, createdAt: now });
          put(tx, a);
          done(a);
        };
      });
    },
    delete: (id) =>
      run('readwrite', (tx, done) => {
        tx.objectStore('artifacts').delete(id);
        tx.objectStore('summaries').delete(id);
        done(undefined);
      }),
  };
}
