/** Who a message belongs to. Drives bubble styling and the (optional) role chip. */
export type ChatRole = 'user' | 'agent' | 'tool' | 'status' | 'error';

/** A single rendered message. */
export interface ChatMessage {
  role: ChatRole;
  text: string;
  interrupted?: true;
  /** Text-only result; no host write action may be reconstructed. */
  copyOnly?: true;
}

/** Text shown in the UI. Everything is optional so the component works untranslated. */
export interface ChatViewLabels {
  /** Accessible name for the conversation history. */
  conversation?: string;
  /** Send-button label (idle state). */
  send?: string;
  /** Send-button label while a turn is running (acts as Stop). */
  stop?: string;
  /** Input placeholder. */
  placeholder?: string;
  /** Empty-state hint shown when there are no messages. */
  empty?: string;
  copy?: string;
  copied?: string;
  copyFailed?: string;
  restore?: string;
  waiting?: string;
  scrollLatest?: string;
  applyMessage?: string;
  applyTip?: string;
  applying?: string;
  applied?: string;
  checkDocument?: string;
  /** Map a role to its display chip (e.g. localisation). Return '' to hide the chip. */
  role?: (role: ChatRole) => string;
}

export interface ChatViewOptions {
  /** Host readiness check; false preserves editable drafts and prevents submission. */
  canSend?: (text: string) => boolean;
  /** Called when the user submits the input (Enter or Send). Receives the original non-empty text. */
  onSend: (text: string) => void;
  /** Called when the user clicks Send while a turn is running (i.e. Stop). */
  onStop?: () => void;
  /** Host-owned document operation; the model never executes this action. */
  canApplyMessage?: () => boolean;
  onApplyMessage?: (text: string) => Promise<'verified' | 'sent' | 'retry' | 'failed'>;
  /** Initial labels; change later with {@link ChatView.setLabels}. */
  labels?: ChatViewLabels;
}
