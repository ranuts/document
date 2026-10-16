import type { RedoHistory } from './native-redo';
export interface CompletedPaste {
  available(): boolean;
  undo(): boolean;
  dispose(): void;
}
interface PasteOptions {
  current(): boolean;
  allowedDescription: number;
  undo(): void;
  observe(invalidate: () => void): () => void;
}
interface Proof {
  history: RedoHistory;
  points: RedoHistory['Points'];
  index: number;
  snapshot: Array<{ point: RedoHistory['Points'][number]; description?: number; items: unknown[] }>;
  options: PasteOptions;
}
function intact(proof: Proof): boolean {
  return (
    proof.history.Points === proof.points &&
    proof.points.length === proof.snapshot.length &&
    proof.snapshot.every(
      ({ point, description, items }, at) =>
        proof.points[at] === point &&
        point.Description === description &&
        point.Items.length === items.length &&
        items.every((item, i) => point.Items[i] === item),
    )
  );
}
// Keeping native ownership in one clearable slot prevents an old DOM receipt from
// retaining an old document, prefix snapshots, callbacks or API after disposal.
function ownProof(initial: Proof | undefined): CompletedPaste | undefined {
  let owned: Proof | undefined = initial;
  initial = undefined;
  let remove: (() => void) | undefined;
  const dispose = () => {
    owned = undefined;
    const cleanup = remove;
    remove = undefined;
    try {
      cleanup?.();
    } catch {
      /* A destroyed SDK may already have removed its registry. */
    }
  };
  const available = () => {
    const proof = owned;
    try {
      if (proof && proof.options.current() && proof.history.Index === proof.index && intact(proof)) return true;
    } catch {
      /* Fail closed. */
    }
    dispose();
    return false;
  };
  try {
    remove = owned!.options.observe(dispose);
  } catch {
    dispose();
    return undefined;
  }
  if (!owned) {
    dispose();
    return undefined;
  }
  return {
    available,
    dispose,
    undo() {
      if (!available()) return false;
      const proof = owned!;
      dispose();
      proof.options.undo();
      if (proof.history.Index !== proof.index - 1 || !intact(proof)) throw new Error('agentUndoUnverified');
      return true;
    },
  };
}
/** Exact, volatile completed-paste proof; a synchronous guard precedes one Undo. */
export function captureCompletedPaste(history: RedoHistory, options: PasteOptions): CompletedPaste | undefined {
  const index = history.Index,
    points = history.Points;
  if (
    !Number.isInteger(index) ||
    index < 0 ||
    index !== points.length - 1 ||
    !Number.isInteger(options.allowedDescription) ||
    points[index]?.Description !== options.allowedDescription ||
    !points[index].Items.length
  )
    return undefined;
  try {
    if (!options.current()) return undefined;
  } catch {
    return undefined;
  }
  return ownProof({
    history,
    points,
    index,
    options,
    snapshot: points.map((point) => ({ point, description: point.Description, items: [...point.Items] })),
  });
}
// Native proof is never serialized into a tool response or persisted message.
const results = new WeakMap<object, CompletedPaste>();
export function bindCompletedPaste<T extends object>(result: T, receipt?: CompletedPaste): T {
  if (receipt) results.set(result, receipt);
  return result;
}
export function takeCompletedPaste(result: unknown): CompletedPaste | undefined {
  if (!result || typeof result !== 'object') return undefined;
  const receipt = results.get(result);
  results.delete(result);
  return receipt;
}
