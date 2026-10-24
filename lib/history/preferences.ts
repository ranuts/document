/**
 * The autosave on/off preference. Kept apart from the scheduler in
 * ./autosave.ts so the /history page can read and write it without importing
 * the save pipeline (and with it the editor stack).
 */
import { localStorageGetItem, localStorageSetItem } from 'ranuts/utils';

const AUTOSAVE_PREF_KEY = 'document-autosave-enabled';

export function isAutosaveEnabled(): boolean {
  // Default on. Off by default would mean the feature does not exist for
  // almost everyone, and the loss it prevents happens before anyone goes
  // looking through settings.
  return localStorageGetItem(AUTOSAVE_PREF_KEY) !== 'false';
}

/** Store the preference only; an editor page also stops its running session (see setAutosaveEnabled). */
export function writeAutosavePreference(enabled: boolean): void {
  localStorageSetItem(AUTOSAVE_PREF_KEY, enabled ? 'true' : 'false');
}
