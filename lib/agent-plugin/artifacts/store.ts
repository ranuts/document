import { validatePayload, payloadText, type ArtifactPayload } from './payload';
export const ARTIFACT_DB_NAME = 'document-ai-artifacts';
export interface ArtifactProvenance {
  conversation?: string;
  sources?: Array<{ title: string; connector: string }>;
}
export interface ArtifactVersion {
  version: number;
  text: string;
  createdAt: number;
  schemaVersion?: 1;
  payload?: ArtifactPayload;
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
  create(input: {
    title: string;
    text: string;
    payload?: ArtifactPayload;
    provenance: ArtifactProvenance;
  }): Promise<Artifact>;
  list(): Promise<ArtifactSummary[]>;
  get(id: string): Promise<Artifact | undefined>;
  update(
    id: string,
    expectedVersion: number,
    input: { title: string; text: string; payload?: ArtifactPayload },
  ): Promise<Artifact>;
  delete(id: string): Promise<void>;
}
export class ArtifactError extends Error {
  constructor(
    readonly code: 'conflict' | 'limit' | 'text-limit' | 'count-limit' | 'version-limit' | 'missing' | 'invalid',
  ) {
    super(`Artifact ${code}`);
  }
}
function validate(title: string, text: string): void {
  if (typeof title !== 'string' || typeof text !== 'string' || !title.trim() || title.length > 200 || !text.trim())
    throw new ArtifactError('invalid');
  if (new TextEncoder().encode(text).length > 128 * 1024) throw new ArtifactError('text-limit');
}
function provenance(input: ArtifactProvenance): ArtifactProvenance {
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    Object.keys(input).some((k) => !['conversation', 'sources'].includes(k))
  )
    throw new ArtifactError('limit');
  if (input.conversation !== undefined && (typeof input.conversation !== 'string' || input.conversation.length > 200))
    throw new ArtifactError('limit');
  if (
    input.sources !== undefined &&
    (!Array.isArray(input.sources) ||
      input.sources.length > 20 ||
      Object.keys(input.sources).length !== input.sources.length ||
      !Array.from({ length: input.sources.length }, (_, i) => Object.hasOwn(input.sources!, i)).every(Boolean) ||
      input.sources.some(
        (s) =>
          !s ||
          typeof s !== 'object' ||
          Object.keys(s).some((k) => !['title', 'connector'].includes(k)) ||
          typeof s.title !== 'string' ||
          !s.title ||
          s.title.length > 200 ||
          typeof s.connector !== 'string' ||
          !s.connector ||
          s.connector.length > 100,
      ))
  )
    throw new ArtifactError('limit');
  return {
    ...(input.conversation ? { conversation: input.conversation } : {}),
    ...(input.sources ? { sources: input.sources.map((s) => ({ title: s.title, connector: s.connector })) } : {}),
  };
}
function content(input: {
  text: string;
  payload?: ArtifactPayload;
}): Pick<ArtifactVersion, 'text' | 'payload' | 'schemaVersion'> {
  if (input.payload === undefined) return { text: input.text };
  try {
    const payload = validatePayload(input.payload);
    const text = payloadText(payload);
    if (input.text !== text) throw new Error('Mismatched payload');
    return { text, payload, schemaVersion: 1 };
  } catch {
    throw new ArtifactError('invalid');
  }
}
function readArtifact(value: unknown): Artifact {
  const a = value as Artifact;
  if (
    !a ||
    typeof a !== 'object' ||
    Object.keys(a).some((k) => !['id', 'title', 'updatedAt', 'versions', 'provenance'].includes(k)) ||
    typeof a.id !== 'string' ||
    !a.id ||
    a.id.length > 200 ||
    !Number.isFinite(a.updatedAt) ||
    !Array.isArray(a.versions) ||
    !a.versions.length ||
    a.versions.length > 20 ||
    Object.keys(a.versions).length !== a.versions.length ||
    !Array.from({ length: a.versions.length }, (_, i) => Object.hasOwn(a.versions, i)).every(Boolean)
  )
    throw new ArtifactError('invalid');
  const origin = provenance(a.provenance);
  const versions = a.versions.map((v, i) => {
    if (
      !v ||
      v.version !== i + 1 ||
      !Number.isFinite(v.createdAt) ||
      (v.schemaVersion !== undefined && v.schemaVersion !== 1) ||
      !!v.payload !== (v.schemaVersion === 1) ||
      Object.keys(v).some((k) => !['version', 'text', 'createdAt', 'payload', 'schemaVersion'].includes(k))
    )
      throw new ArtifactError('invalid');
    validate(a.title, v.text);
    return { version: v.version, createdAt: v.createdAt, ...content(v) };
  });
  return { id: a.id, title: a.title, updatedAt: a.updatedAt, versions, provenance: origin };
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
      const body = content(input);
      validate(input.title, body.text);
      const origin = provenance(input.provenance);
      return run('readwrite', (tx, done, fail) => {
        const count = tx.objectStore('summaries').count();
        count.onsuccess = () => {
          if (count.result >= 50) return fail(new ArtifactError('count-limit'));
          const now = Date.now();
          const a: Artifact = {
            id: crypto.randomUUID(),
            title: input.title.trim(),
            updatedAt: now,
            versions: [{ version: 1, ...body, createdAt: now }],
            provenance: origin,
          };
          put(tx, a);
          done(a);
        };
      });
    },
    list: () =>
      run('readonly', (tx, done, fail) => {
        const r = tx.objectStore('summaries').getAll(undefined, 50);
        r.onsuccess = () => {
          try {
            const summaries = r.result as ArtifactSummary[];
            if (
              summaries.some(
                (s) =>
                  !s ||
                  typeof s.id !== 'string' ||
                  !s.id ||
                  s.id.length > 200 ||
                  typeof s.title !== 'string' ||
                  !s.title.trim() ||
                  s.title.length > 200 ||
                  !Number.isFinite(s.updatedAt) ||
                  !Number.isInteger(s.version) ||
                  s.version < 1 ||
                  s.version > 20 ||
                  Object.keys(s).some((k) => !['id', 'title', 'updatedAt', 'version'].includes(k)),
              )
            )
              throw new ArtifactError('invalid');
            done(summaries.sort((a, b) => b.updatedAt - a.updatedAt));
          } catch (e) {
            fail(e as Error);
          }
        };
      }),
    get: (id) =>
      run('readonly', (tx, done, fail) => {
        const r = tx.objectStore('artifacts').get(id);
        r.onsuccess = () => {
          try {
            done(r.result ? readArtifact(r.result) : undefined);
          } catch (e) {
            fail(e as Error);
          }
        };
      }),
    async update(id, expectedVersion, input) {
      const body = content(input);
      validate(input.title, body.text);
      return run('readwrite', (tx, done, fail) => {
        const r = tx.objectStore('artifacts').get(id);
        r.onsuccess = () => {
          let a: Artifact | undefined;
          try {
            a = r.result ? readArtifact(r.result) : undefined;
          } catch (e) {
            return fail(e as Error);
          }
          if (!a) return fail(new ArtifactError('missing'));
          if (a.versions.at(-1)!.payload && !body.payload) return fail(new ArtifactError('invalid'));
          if (a.versions.at(-1)!.version !== expectedVersion) return fail(new ArtifactError('conflict'));
          if (a.versions.length >= 20) return fail(new ArtifactError('version-limit'));
          const now = Date.now();
          a.title = input.title.trim();
          a.updatedAt = now;
          a.versions.push({ version: expectedVersion + 1, ...body, createdAt: now });
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
