import { ASC_RESTRICTION_NONE, ASC_RESTRICTION_VIEW, editorSendCommand, getSdkEditorApi } from './sdk-api';

/**
 * Readonly is a runtime restriction, never a mount-time permission: the editor
 * always mounts with edit rights and is locked afterwards, so the switch works
 * in both directions without rebuilding (a view-mode mount is a one-way door).
 */
let isReadonlyMode = false;

export function setReadonlyMode(readonly: boolean): void {
  isReadonlyMode = readonly;

  // Primary path: the SDK restriction API switches the live editor between
  // view and edit in place, no rebuild. The editor must be mounted with full
  // edit permissions for this to be reversible (see
  // createPersonalEditorInstance: restriction is applied after load, never
  // via permissions.edit=false at mount).
  const api = getSdkEditorApi();
  if (api) {
    if (readonly) {
      api.asc_setRestriction?.(ASC_RESTRICTION_VIEW);
    } else {
      api.asc_removeRestriction?.(ASC_RESTRICTION_VIEW);
      api.asc_setRestriction?.(ASC_RESTRICTION_NONE);
    }
  }

  // Fallback/legacy path; harmless no-op on builds that ignore the command.
  editorSendCommand({
    command: 'processRightsChange',
    data: {
      enabled: !readonly,
      message: readonly ? 'Readonly mode' : '',
    } as any,
  });
}

export function getReadonlyMode(): boolean {
  return isReadonlyMode;
}

/** Record the mode a newly created editor is being mounted in. */
export function setReadonlyState(readonly: boolean): void {
  isReadonlyMode = readonly;
}
