import { preserveNativeRedo, type RedoHistory, type RedoHistoryPoint } from './native-redo';

/** Own the single history point created synchronously by a pending Word paste.
 * Seal before yielding to fonts/images. Roll back only an unchanged owned point,
 * after native paste cleanup has completed and released its busy state.
 */
export function beginWordPasteHistory(
  history: RedoHistory & { Remove_LastPoint?(): void },
  isCurrent: () => boolean,
  undo: () => void,
) {
  const current = () => {
    try {
      return isCurrent();
    } catch {
      return false;
    }
  };
  const fail = (): never => {
    throw new Error('Document change could not be verified');
  };
  const index = history.Index;
  const array = history.Points;
  const original = [...array];
  const prefix = original.slice(0, index + 1).map((point) => ({ point, items: [...point.Items] }));
  const keys = ['SavedIndex', 'UserSavedIndex', 'ForceSave', 'LastState'] as const;
  const metadata = keys.map((key) => ({ key, present: key in history, value: history[key] }));
  const previous = array[index];
  const additional = previous?.Additional;
  const hadAdditional = !!previous && 'Additional' in previous;
  const redo = preserveNativeRedo(history, current);
  let marker: RedoHistoryPoint | undefined;
  let items: unknown[] = [];
  let finished = false;
  const prefixIntact = () =>
    prefix.every(
      ({ point, items }, offset) =>
        array[offset] === point &&
        point.Items.length === items.length &&
        items.every((item, at) => point.Items[at] === item),
    );
  const ownsPoint = () =>
    current() &&
    history.Points === array &&
    prefixIntact() &&
    !!marker &&
    history.Index === index + 1 &&
    array.length === index + 2 &&
    array[index + 1] === marker;
  const owned = () =>
    ownsPoint() && marker!.Items.length === items.length && items.every((item, at) => marker!.Items[at] === item);
  return {
    isPending: owned,
    ownsPoint,
    seal() {
      if (
        finished ||
        marker ||
        !current() ||
        history.Points !== array ||
        !prefixIntact() ||
        history.Index !== index + 1 ||
        array.length !== index + 2
      )
        fail();
      marker = array[index + 1];
      items = [...marker.Items];
    },
    rollback() {
      if (finished) return;
      if (marker) {
        const emptyAlreadyRemoved =
          items.length === 0 &&
          marker.Items.length === 0 &&
          current() &&
          history.Points === array &&
          prefixIntact() &&
          history.Index === index &&
          array.length === index + 1;
        if (!emptyAlreadyRemoved && !owned()) fail();
        if (items.length) undo();
        else if (!emptyAlreadyRemoved) {
          if (typeof history.Remove_LastPoint !== 'function') fail();
          history.Remove_LastPoint!();
          if (
            !current() ||
            history.Points !== array ||
            !prefixIntact() ||
            history.Index !== index ||
            array.length !== index + 1
          )
            fail();
        }
        if (
          !current() ||
          history.Points !== array ||
          !prefixIntact() ||
          history.Index !== index ||
          array.length !== index + (items.length ? 2 : 1) ||
          (items.length > 0 && array[index + 1] !== marker) ||
          marker.Items.length !== items.length ||
          items.some((item, at) => marker!.Items[at] !== item)
        )
          fail();
        if (items.length) array.pop();
      } else if (
        !current() ||
        history.Points !== array ||
        history.Index !== index ||
        !prefixIntact() ||
        array.length !== original.length ||
        original.some((point, at) => array[at] !== point)
      )
        fail();
      redo.restore();
      for (const { key, present, value } of metadata) {
        if (present) Object.assign(history, { [key]: value });
        else delete history[key];
      }
      if (previous) {
        if (hadAdditional) previous.Additional = additional;
        else delete previous.Additional;
      }
      finished = true;
    },
    commit() {
      if (finished) return;
      // A completed insertion legitimately appends items to the sealed point.
      if (
        !current() ||
        history.Points !== array ||
        !prefixIntact() ||
        !marker ||
        history.Index !== index + 1 ||
        array.length !== index + 2 ||
        array[index + 1] !== marker
      )
        fail();
      redo.discard();
      finished = true;
    },
  };
}
