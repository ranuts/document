/** A browser preference, never inferred from a shared document URL. */
const ENABLED_KEY = 'document-assistant-enabled';
export function readAssistantEnabled(): boolean {
  try {
    return localStorage.getItem(ENABLED_KEY) === 'true';
  } catch {
    return false;
  }
}
export function saveAssistantEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(ENABLED_KEY, String(enabled));
  } catch {
    /* Session state remains usable. */
  }
}
