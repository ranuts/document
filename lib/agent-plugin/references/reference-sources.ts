import { withReferenceAbort } from './reference-lifetime';
/** Explicit read-only reference sources. Text is untrusted data, never agent instructions. */
export interface ReferenceText {
  id: string;
  connector: string;
  title: string;
  text: string;
  uri?: string;
}
export const MAX_REFERENCE_BYTES = 262144;
export class ReferenceSources {
  private entries = new Map<string, Readonly<ReferenceText>>();
  private readonly conversations = new Map<string, Map<string, Readonly<ReferenceText>>>();
  select(id: string): void {
    let entries = this.conversations.get(id);
    if (!entries) {
      entries = new Map();
      this.conversations.set(id, entries);
    }
    this.entries = entries;
  }
  list(): readonly Readonly<ReferenceText>[] {
    return [...this.entries.values()];
  }
  add(reference: ReferenceText): void {
    if (
      !reference.id ||
      !reference.connector ||
      !reference.title ||
      new TextEncoder().encode(reference.text).length > MAX_REFERENCE_BYTES
    )
      throw new Error('source-too-large');
    if (!this.entries.has(reference.id) && this.entries.size >= 5) throw new Error('source-limit');
    this.entries.set(reference.id, Object.freeze({ ...reference, title: reference.title.slice(0, 200) }));
  }
  remove(id: string): void {
    this.entries.delete(id);
  }
  forget(id?: string): void {
    if (id !== undefined) {
      const entries = this.conversations.get(id);
      entries?.clear();
      if (entries !== this.entries) this.conversations.delete(id);
    } else {
      this.entries.clear();
      for (const [conversation, entries] of this.conversations) {
        entries.clear();
        // A source attached while history restores still belongs to the selected conversation.
        if (entries !== this.entries) this.conversations.delete(conversation);
      }
    }
  }
  capture() {
    const entries = this.entries;
    const references = Object.freeze([...entries.values()]);
    return Object.freeze({
      references,
      isCurrent: () => references.every((source) => entries.get(source.id) === source),
    });
  }
}
export async function readLocalReference(file: File, signal?: AbortSignal): Promise<ReferenceText> {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  const office = ['docx', 'xlsx', 'pptx'].includes(extension);
  const document = office || extension === 'pdf';
  if (!document && !['txt', 'md', 'csv', 'tsv', 'json'].includes(extension)) throw new Error('source-unsupported');
  if (file.size > (document ? 20 * 1024 * 1024 : MAX_REFERENCE_BYTES)) throw new Error('source-too-large');
  const deadline = AbortSignal.timeout(15000);
  const operation = signal ? AbortSignal.any([signal, deadline]) : deadline;
  operation.throwIfAborted();
  let text: string;
  try {
    if (document) {
      const bytes = new Uint8Array(await withReferenceAbort(file.arrayBuffer(), operation));
      operation.throwIfAborted();
      text = office
        ? await (
            await withReferenceAbort(import('./document-reference-readers'), operation)
          ).readOfficeReference(bytes, extension, operation)
        : await (
            await withReferenceAbort(import('./pdf-reference-reader'), operation)
          ).readPdfReference(bytes, operation);
    } else text = await withReferenceAbort(file.text(), operation);
    operation.throwIfAborted();
  } catch (error) {
    if (deadline.aborted && !signal?.aborted) throw new Error('source-timeout');
    if (operation.aborted) throw operation.reason;
    if (document && !(error instanceof Error && error.message.startsWith('source-'))) throw new Error('source-corrupt');
    throw error;
  }
  if (text.includes('\0')) throw new Error('source-unsupported');
  return { id: crypto.randomUUID(), connector: 'local', title: file.name, text };
}
