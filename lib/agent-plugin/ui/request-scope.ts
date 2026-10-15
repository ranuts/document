import type { ComposerContext } from './composer-context';

/** Immutable enqueue-time selection, including bounded spreadsheet values. */
export function snapshotComposerContext(snapshot: ComposerContext): ComposerContext {
  return Object.freeze({
    context: snapshot.context ? Object.freeze({ ...snapshot.context }) : null,
    text: snapshot.text,
    truncated: snapshot.truncated,
  });
}

/** Routing may prove plain conversation; an actual editor operation binds it permanently. */
export class RequestScopePolicy {
  private bound: boolean;
  readonly deferNative: boolean;
  constructor(snapshot: ComposerContext, options: { greeting: boolean; referenced: boolean }) {
    this.deferNative =
      !options.referenced &&
      !snapshot.text.length &&
      !snapshot.truncated &&
      !(snapshot.context?.selectionCharacters ?? 0) &&
      snapshot.context?.kind !== 'pdf';
    this.bound = !(this.deferNative || (options.greeting && !options.referenced));
  }
  get editorBound(): boolean {
    return this.bound;
  }
  bindEditor(): void {
    this.bound = true;
  }
}
