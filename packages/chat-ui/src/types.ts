/** Who a message belongs to. Drives bubble styling and the (optional) role chip. */
export type ChatRole = 'user' | 'agent' | 'tool' | 'status' | 'error';

/** A single rendered message. */
export interface ChatMessage {
  /** Opaque host provenance captured when this message is created; never sent to the model. */
  metadata?: Readonly<Record<string, unknown>>;
  role: ChatRole;
  text: string;
  interrupted?: true;
  /** Text-only result; no host write action may be reconstructed. */
  copyOnly?: true;
  /** Host-validated document content, distinct from ordinary chat prose. */
  documentArtifact?: true;
}

/** Text shown in the UI. Everything is optional so the component works untranslated. */
export interface ChatViewLabels {
  /** Accessible name for the conversation history. */
  conversation?: string;
  /** Send-button label (idle state). */
  send?: string;
  /** Send-button label while a queue-enabled host is answering. */
  queue?: string;
  /** Stop-control label (the Send button in legacy hosts). */
  stop?: string;
  /** Acknowledgement while a requested cancellation is still settling. */
  stopping?: string;
  /** Input placeholder. */
  placeholder?: string;
  /** Empty-state hint shown when there are no messages. */
  empty?: string;
  saveMessage?: string;
  savingMessage?: string;
  savedMessage?: string;
  saveFailed?: string;
  copy?: string;
  copied?: string;
  copyFailed?: string;
  restore?: string;
  /** Identifies only explicitly host-marked document content. */
  documentDraft?: string;
  /** Identifies retained output from a response that did not complete. */
  incomplete?: string;
  waiting?: string;
  /** Actual host request classification, distinct from tool planning. */
  routing?: string;
  /** Format locally measured waiting seconds; visual only, never a live announcement. */
  elapsed?: (seconds: number) => string;
  reading?: string;
  planning?: string;
  reviewing?: string;
  scrollLatest?: string;
  loadEarlier?: string;
  expandMessage?: string;
  applyMessage?: string;
  applyTip?: string;
  applying?: string;
  applied?: string;
  checkDocument?: string;
  /** Map a role to its display chip (e.g. localisation). Return '' to hide the chip. */
  role?: (role: ChatRole) => string;
}

export interface RestoreHistoryOptions {
  /** Maximum source messages per visible page, capped at 40; defaults to 40. */
  pageSize?: number;
}

export type MessageSaveOutcome = 'saved' | 'failed' | 'cancelled';
export interface ChatMessageAction {
  readonly id: string;
  readonly label: string;
  /** Explicit activation only; receives the original completed source. */
  run(text: string): void;
}

export interface ChatViewOptions {
  /** Opt into bounded incremental Markdown; legacy plain streaming remains the default. */
  streamingMarkdown?: boolean;
  /** Host readiness check; false preserves editable drafts and prevents submission. */
  canSend?: (text: string) => boolean;
  /** Optional explicit setup action while unavailable. It never consumes or queues the draft. */
  getSendPreparation?: () => { label: string; run: () => void; disabled?: boolean } | undefined;
  /** Finalize host input (e.g. dictation) after an explicit send. False cancels submission. */
  beforeSend?: () => boolean | Promise<boolean>;
  /** Called when the user submits the input (Enter or Send). Receives the original non-empty text. */
  onSend: (text: string) => void;
  /** Opt into accepting drafts during a run; the host owns ordering and execution. */
  onQueue?: (text: string) => void;
  /** Called synchronously by the first Stop activation during a run. */
  onStop?: () => void;
  /** Host-owned document operation; the model never executes this action. */
  canApplyMessage?: () => boolean;
  /** Only explicitly marked artifacts may offer host write actions. */
  requireDocumentArtifact?: boolean;
  /** Optional explicit persistence action owned by the host. */
  onSaveMessage?: (
    text: string,
    metadata?: Readonly<Record<string, unknown>>,
  ) => Promise<MessageSaveOutcome | void> | MessageSaveOutcome | void;
  /** At most two host-defined secondary actions; never inferred from response HTML. */
  getMessageActions?: (message: ChatMessage) => readonly ChatMessageAction[];
  onApplyMessage?: (text: string) => Promise<'verified' | 'sent' | 'retry' | 'failed'>;
  /** Initial labels; change later with {@link ChatView.setLabels}. */
  labels?: ChatViewLabels;
}

/** Ephemeral presentation state. Hosts keep draft text and conversation identity separately. */
export interface ChatNavigationSnapshot {
  readonly composer: {
    readonly fingerprint: string;
    readonly scrollTop: number;
    readonly start: number;
    readonly end: number;
    readonly direction: 'forward' | 'backward' | 'none';
    readonly focused: boolean;
  };
  readonly transcript: {
    readonly focused: boolean;
    readonly following: boolean;
    readonly interrupted: boolean;
    readonly top: number;
    readonly historyStart: number;
    readonly historyLength: number;
    readonly anchor?: { readonly fingerprint: string; readonly occurrence: number; readonly offset: number };
  };
}
