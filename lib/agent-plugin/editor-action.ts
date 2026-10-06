interface BlockingEditorApi {
  isLongAction?(): boolean;
  sync_StartAction?(type: number, action: number): void;
  sync_EndAction?(type: number, action: number): void;
}

/** Hold the native interaction mask only while a document mutation is executing.
 * Runtime enum values must come from the target editor's Asc namespace.
 * This does not change collaborative global locks or manage history/paste cancellation.
 */
export async function withBlockingEditorAction<T>(
  api: BlockingEditorApi,
  codes: { BlockInteraction: number; ApplyChanges: number },
  work: (release: () => void) => Promise<T>,
): Promise<T> {
  if (
    typeof api.isLongAction !== 'function' ||
    typeof api.sync_StartAction !== 'function' ||
    typeof api.sync_EndAction !== 'function' ||
    !Number.isInteger(codes.BlockInteraction) ||
    codes.BlockInteraction < 0 ||
    !Number.isInteger(codes.ApplyChanges) ||
    codes.ApplyChanges < 0
  )
    throw new Error('Editor action API is unavailable');
  if (api.isLongAction()) throw new Error('Editor is busy');
  const end = api.sync_EndAction,
    type = codes.BlockInteraction,
    action = codes.ApplyChanges;
  api.sync_StartAction(type, action);
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    end.call(api, type, action);
  };
  try {
    return await work(release);
  } finally {
    release();
  }
}
