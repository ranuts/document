import { ButtonBuilder, Div, Span, View } from 'ranui/builder';
import { throttle } from 'ranuts/utils';
import { ensureChatUiStyles } from './styles';
import { renderMarkdown } from './markdown';
import type { ChatMessage, ChatViewLabels, ChatViewOptions } from './types';

const ICON_SEND =
  '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5"/><path d="M5 12l7-7 7 7"/></svg>';
const ICON_STOP =
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><rect x="5" y="5" width="14" height="14" rx="3"/></svg>';
const ICON_DOWN =
  '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="M19 12l-7 7-7-7"/></svg>';
const ICON_COPY =
  '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V4H4v12h4"/></svg>';
const ICON_COPIED =
  '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 4 4L19 6"/></svg>';
const ICON_COPY_ERROR =
  '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v6m0 4h.01"/></svg>';
const ICON_DRAFT =
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/></svg>';

/** Distance (px) from the bottom within which we keep auto-scrolling on new content. */
const STICK_THRESHOLD = 60;

/**
 * A framework-free chat UI: a scrolling message list with streaming support and
 * a modern, auto-growing composer whose icon button doubles as Send / Stop.
 *
 * The DOM is built with the ranui `builder` (View/Div/Span/ButtonBuilder); the
 * scroll handler is throttled with ranuts. Mount {@link ChatView.el} anywhere,
 * drive it with {@link ChatView.append}/{@link ChatView.appendDelta}/
 * {@link ChatView.setRunning}, and receive input via the `onSend`/`onStop`
 * callbacks. No backend assumptions.
 */
export class ChatView {
  /** Root element — append this to your container. */
  readonly el: HTMLDivElement;
  /**
   * An action slot directly above the input row. Populate it with your own
   * controls (toggles, quick actions) for an IM-style compose toolbar; it
   * collapses when empty.
   */
  readonly actionsEl: HTMLDivElement;
  /** Host-owned pending requests, separate from executed conversation messages. */
  readonly pendingEl = Div().class('cui-pending').build();
  readonly contextEl = Div().class('cui-context').build();
  readonly emptyActionsEl: HTMLDivElement;

  private readonly messagesEl: HTMLDivElement;
  private readonly emptyEl: HTMLDivElement;
  private readonly emptyTitle: HTMLDivElement;
  private readonly input: HTMLTextAreaElement;
  private readonly sendBtn: HTMLButtonElement;
  private readonly stopBtn: HTMLButtonElement;
  private readonly scrollBtn: HTMLButtonElement;
  private labels: ChatViewLabels;
  private running = false;
  private stopping = false;
  private readonly interruptedRenders = new Set<{ frame?: number; timer?: ReturnType<typeof setTimeout> }>();
  private preparingSend = false;
  private submissionRevision = 0;
  private activity: 'responding' | 'routing' | 'reading' | 'planning' | 'reviewing' = 'responding';
  private respondingHasText = false;
  private presentationCleared = false;
  private waitStartedAt: number | null = null;
  private elapsedTimer?: ReturnType<typeof setInterval>;
  private composing = false;
  private lastUserText = '';
  private readonly statusEl = Div().class('cui-status').attr('role', 'status').attr('aria-atomic', 'true').build();
  // The visual clock is outside live regions so its ticks do not interrupt reading.
  private readonly elapsedEl = Span().class('cui-elapsed').attr('aria-hidden', 'true').build();
  private readonly progressEl = Div().class('cui-progress').children(this.statusEl, this.elapsedEl).build();
  private readonly feedbackEl = Div().class('cui-feedback').attr('role', 'status').attr('aria-atomic', 'true').build();
  private readonly resizeObserver?: ResizeObserver;
  private inputWidth = 0;
  private inputNeedsResize = false;
  private layoutFrame?: number;
  // Content mutations consume this state; only scrolling, jumping to the end,
  // or clearing a conversation may change it. Reflow is not reader intent.
  private following = true;
  private scrollHeight = 0;
  private viewportHeight = 0;
  private disposed = false;
  private readonly copyTimers = new Map<HTMLButtonElement, ReturnType<typeof setTimeout>>();
  /** The agent bubble currently receiving streamed deltas, if any. */
  private liveMsg: HTMLDivElement | null = null;
  private liveText = '';
  private liveNode: Text | null = null;
  private pendingText = '';
  private actionRunning = false;
  private actionHasDraft = false;
  private appendBatchDepth = 0;
  private appendBatchChanged = false;

  constructor(private readonly options: ChatViewOptions) {
    ensureChatUiStyles();
    this.labels = options.labels ?? {};

    this.emptyTitle = Div()
      .text(this.labels.empty ?? '')
      .build();
    this.emptyActionsEl = Div().class('cui-empty-actions').build();
    this.emptyEl = Div().class('cui-empty').children(this.emptyTitle, this.emptyActionsEl).build();

    const updateScroll = throttle(() => this.updateScrollBtn(), 100);
    this.messagesEl = Div()
      .class('cui-messages')
      .attr('role', 'log')
      .attr('aria-busy', 'false')
      .attr('tabindex', '-1')
      .on('scroll', () => {
        // Reflow can emit scroll before ResizeObserver. Changed geometry does
        // not establish that the reader intentionally scrolled away.
        const unchanged =
          this.scrollHeight === this.messagesEl.scrollHeight && this.viewportHeight === this.messagesEl.clientHeight;
        if (!this.scrollHeight || unchanged || this.nearBottom()) this.following = this.nearBottom();
        this.recordScrollGeometry();
        updateScroll();
      })
      .children(this.emptyEl)
      .build();

    // Jump-to-latest button — appears when the user scrolls up.
    this.scrollBtn = ButtonBuilder()
      .class('cui-scroll-bottom')
      .attr('hidden', '')
      .attr('type', 'button')
      .aria('label', 'Scroll to latest')
      .on('click', () => this.scrollToEnd(true))
      .build();
    this.scrollBtn.innerHTML = ICON_DOWN;

    // Compose toolbar slot: host-populated controls just above the input.
    this.actionsEl = Div().class('cui-actions').build();

    // Composer: rounded container holding the textarea + a circular icon button.
    this.input = View<HTMLTextAreaElement>('textarea')
      .class('cui-input')
      .attr('rows', '1')
      .on('compositionstart', () => {
        this.composing = true;
      })
      .on('compositionend', () => {
        this.composing = false;
      })
      .on('beforeinput', () => {
        this.submissionRevision++;
      })
      .on('input', () => {
        this.autoGrow();
        this.updateSendState();
      })
      .on('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && !this.composing && e.keyCode !== 229) {
          e.preventDefault();
          this.submit();
        }
      })
      .build();
    this.input.placeholder = this.labels.placeholder ?? '';

    this.sendBtn = ButtonBuilder()
      .class('cui-send')
      .attr('type', 'button')
      .on('click', () => {
        if (this.running && !this.options.onQueue) this.requestStop();
        else this.submit();
      })
      .build();
    this.sendBtn.innerHTML = ICON_SEND;
    this.stopBtn = ButtonBuilder()
      .class('cui-stop')
      .attr('type', 'button')
      .on('click', () => this.requestStop())
      .build();
    this.stopBtn.innerHTML = ICON_STOP;
    this.stopBtn.hidden = true;

    const composer = Div()
      .class('cui-composer')
      .children(
        this.contextEl,
        this.input,
        Div().class('cui-composer-bar').children(this.actionsEl, this.stopBtn, this.sendBtn).build(),
      )
      .build();

    // Footer hosts the jump-to-latest button (floats just above it), the action
    // slot, and the composer.
    const footer = Div().class('cui-footer').children(this.scrollBtn, this.pendingEl, composer).build();

    this.el = Div().class('cui-root').children(this.messagesEl, this.progressEl, footer, this.feedbackEl).build();
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver((entries) => {
        if (this.disposed) return;
        for (const entry of entries) {
          if (
            entry.target === this.input &&
            entry.contentRect.width > 0 &&
            entry.contentRect.width !== this.inputWidth
          ) {
            this.inputWidth = entry.contentRect.width;
            this.inputNeedsResize = true;
          }
        }
        // Write in the next frame, outside observer delivery. Resizing a sibling
        // viewport here can otherwise produce undelivered-notification errors.
        this.scheduleLayout();
      });
      this.observeLayout();
    }
    this.setLabels(this.labels);
    this.updateSendState();
  }

  /** Last completed answer; activity, status and error messages are never document content. */
  getLastAnswer(): string {
    const rows = this.messagesEl.querySelectorAll<HTMLElement>(
      '.cui-msg-agent:not(.cui-streaming):not([data-interrupted])',
    );
    return rows.length ? (rows[rows.length - 1].dataset.source ?? '') : '';
  }

  getLastDocumentBody(): string {
    const rows = this.messagesEl.querySelectorAll<HTMLElement>(
      '.cui-msg-agent[data-document-artifact]:not(.cui-streaming):not([data-interrupted])',
    );
    return rows.length ? (rows[rows.length - 1].dataset.source ?? '') : '';
  }

  /** Append a finished message and scroll to it. Returns the bubble element. */
  append(message: ChatMessage): HTMLElement {
    if ((message.role === 'status' || message.role === 'error') && this.liveMsg) {
      this.interruptStream();
    }
    if (message.role === 'user') this.lastUserText = message.text;
    const stick = this.following;
    this.emptyEl.remove();
    if (message.role === 'tool') {
      const last = this.messagesEl.lastElementChild;
      let group = last?.matches('.cui-activity') ? last : document.createElement('div');
      const item = Span().text(message.text).build();
      if (group !== last) {
        group.className = 'cui-activity';
        group.append(item);
        this.messagesEl.append(group);
      } else {
        let previous: Element;
        if (group.tagName !== 'DETAILS') {
          previous = group.firstElementChild!;
          const details = document.createElement('details');
          details.className = 'cui-activity';
          details.append(document.createElement('summary'), document.createElement('ul'));
          this.resizeObserver?.unobserve(group);
          group.replaceWith(details);
          group = details;
        } else {
          previous = group.querySelector('summary')!.firstElementChild!;
        }
        const li = document.createElement('li');
        li.append(previous);
        group.querySelector('ul')!.append(li);
        group.querySelector('summary')!.replaceChildren(item);
      }
      this.finishAppendLayout(stick);
      this.resizeObserver?.observe(group);
      return item;
    }

    const bubble = Div().class('cui-bubble').text(message.text).build();
    if (message.role === 'agent') renderMarkdown(bubble, message.text);
    const row = Div().class(`cui-msg cui-msg-${message.role}`).attr('data-role', message.role).children(bubble).build();

    const actions = Div().class('cui-message-actions').build();
    if (message.role === 'agent') {
      const copy = ButtonBuilder().class('cui-copy').attr('type', 'button').build();
      this.updateCopyButton(copy);
      copy.addEventListener('click', async () => {
        if (this.disposed || copy.disabled) return;
        clearTimeout(this.copyTimers.get(copy));
        this.copyTimers.delete(copy);
        this.feedbackEl.textContent = '';
        copy.disabled = true;
        let state: 'copied' | 'failed';
        try {
          await navigator.clipboard.writeText(row.dataset.source ?? message.text);
          state = 'copied';
        } catch {
          state = 'failed';
        } finally {
          copy.disabled = false;
        }
        if (this.disposed || !this.messagesEl.contains(row)) return;
        copy.dataset.state = state;
        this.updateCopyButton(copy);
        this.feedbackEl.textContent = copy.title;
        this.copyTimers.set(
          copy,
          setTimeout(() => {
            this.copyTimers.delete(copy);
            delete copy.dataset.state;
            this.updateCopyButton(copy);
          }, 1800),
        );
      });
      actions.append(copy);
      if (
        this.options.onApplyMessage &&
        (this.options.canApplyMessage?.() ?? true) &&
        (!this.options.requireDocumentArtifact || message.documentArtifact === true) &&
        !message.interrupted &&
        !message.copyOnly
      ) {
        const apply = ButtonBuilder().class('cui-apply').attr('type', 'button').build();
        apply.textContent = this.labels.applyMessage ?? 'Write to document';
        apply.title = this.labels.applyTip ?? 'Insert at the cursor or replace the selected text';
        apply.addEventListener('click', async () => {
          const source = row.dataset.source ?? message.text;
          if (apply.disabled || this.running || !source.trim()) return;
          apply.disabled = true;
          apply.dataset.state = 'pending';
          apply.textContent = this.labels.applying ?? 'Writing…';
          let result: 'verified' | 'sent' | 'retry' | 'failed';
          try {
            result = await this.options.onApplyMessage!(source);
          } catch {
            result = 'failed';
          }
          apply.dataset.state = result;
          apply.textContent =
            result === 'verified'
              ? (this.labels.applied ?? 'Written')
              : result === 'retry'
                ? (this.labels.applyMessage ?? 'Write to document')
                : (this.labels.checkDocument ?? 'Check document');
          apply.disabled = result !== 'retry' || this.running;
        });
        actions.prepend(apply);
      }
    }
    if ((message.role === 'error' || message.role === 'status') && this.lastUserText) {
      const draft = this.lastUserText;
      const restore = ButtonBuilder().class('cui-restore').attr('type', 'button').build();
      restore.textContent = this.labels.restore ?? 'Restore request';
      restore.addEventListener('click', () => {
        if (this.running || this.input.value.trim()) return;
        this.setInput(draft);
        this.focus();
      });
      actions.append(restore);
    }
    if (actions.childElementCount) row.append(actions);
    row.dataset.source = message.text;
    if (message.documentArtifact) row.dataset.documentArtifact = 'true';
    if (message.interrupted) row.dataset.interrupted = 'true';
    if (message.role === 'agent') this.updateResultPresentation(row);

    this.messagesEl.appendChild(row);
    this.resizeObserver?.observe(row);
    this.updateRestoreState(row);
    this.finishAppendLayout(stick);
    return bubble;
  }

  /** Append finished messages in order, measuring and scrolling only after the batch. */
  appendMany(messages: readonly ChatMessage[]): void {
    if (this.disposed || !messages.length) return;
    this.appendBatchDepth++;
    try {
      for (const message of messages) {
        if (this.disposed) break;
        this.append(message);
      }
    } finally {
      this.appendBatchDepth--;
      if (!this.appendBatchDepth && this.appendBatchChanged) {
        this.appendBatchChanged = false;
        if (!this.disposed) {
          if (!this.following) this.recordScrollGeometry();
          this.finishAppendLayout(this.following);
        }
      }
    }
  }

  private finishAppendLayout(stick: boolean): void {
    if (this.appendBatchDepth) this.appendBatchChanged = true;
    else if (stick) this.scrollToEnd();
    else this.updateScrollBtn();
  }

  /**
   * Append streamed text to a live agent bubble, creating it on the first delta.
   * Call {@link endStream} when the turn completes.
   */
  appendDelta(delta: string, metadata: Pick<ChatMessage, 'documentArtifact'> = {}): void {
    if (!delta || this.disposed || this.stopping) return;
    const firstForPhase = !this.respondingHasText;
    this.respondingHasText = true;
    if (!this.liveMsg) {
      this.liveMsg = this.append({ role: 'agent', text: '', ...metadata }).parentElement as HTMLDivElement;
      this.liveMsg.classList.add('cui-streaming');
      this.liveNode = document.createTextNode('');
      this.liveMsg.querySelector('.cui-bubble')?.replaceChildren(this.liveNode);
    }
    if (firstForPhase) this.updateActivity();
    this.liveText += delta;
    this.pendingText += delta;
    this.scheduleLayout();
  }

  /** Finalise the current streaming bubble (removes the caret). */
  endStream(): void {
    if (this.stopping || this.disposed) return;
    const stick = this.following;
    this.flushStream();
    if (this.liveMsg) this.liveMsg.dataset.source = this.liveText;
    const bubble = this.liveMsg?.querySelector<HTMLElement>('.cui-bubble');
    if (bubble) renderMarkdown(bubble, this.liveText);
    this.liveMsg?.classList.remove('cui-streaming');
    this.liveMsg = null;
    this.liveNode = null;
    this.liveText = '';
    this.updateActivity();
    if (bubble && stick) this.finishAppendLayout(stick);
  }

  /** Only explicit stream completion can make a preview available for writing. */
  private interruptStream(deferMarkdown = false): void {
    const row = this.liveMsg;
    if (!row) return;
    const text = this.liveText;
    this.flushStream();
    row.dataset.source = text;
    row.dataset.interrupted = 'true';
    row.querySelector('.cui-apply')?.remove();
    this.updateResultPresentation(row);
    row.classList.remove('cui-streaming');
    this.liveMsg = null;
    this.liveNode = null;
    this.liveText = '';
    if (!deferMarkdown) {
      const bubble = row.querySelector<HTMLElement>('.cui-bubble');
      if (bubble) renderMarkdown(bubble, text);
      this.updateActivity();
      if (bubble && this.following) this.finishAppendLayout(true);
      return;
    }
    // A frame followed by a task lets the acknowledgement paint before parsing
    // a potentially large partial answer. Capture row/source, never the next stream.
    const work: { frame?: number; timer?: ReturnType<typeof setTimeout> } = {};
    this.interruptedRenders.add(work);
    work.frame = requestAnimationFrame(() => {
      work.frame = undefined;
      if (!this.interruptedRenders.has(work)) return;
      work.timer = setTimeout(() => {
        this.interruptedRenders.delete(work);
        if (this.disposed || !this.messagesEl.contains(row) || row.dataset.source !== text) return;
        const bubble = row.querySelector<HTMLElement>('.cui-bubble');
        if (bubble) renderMarkdown(bubble, text);
        this.scheduleLayout();
      }, 0);
    });
  }

  /** Freeze visible output and acknowledge cancellation until the host settles. */
  requestStop(): void {
    if (!this.running || this.stopping || this.disposed) return;
    const restoreFocus = document.activeElement === this.sendBtn || document.activeElement === this.stopBtn;
    this.stopping = true;
    this.messagesEl.setAttribute('aria-busy', 'true');
    this.updateActivity();
    this.updateSendState();
    if (restoreFocus) this.input.focus({ preventScroll: true });
    this.interruptStream(true);
    this.options.onStop?.();
  }

  private cancelInterruptedRenders(): void {
    for (const work of this.interruptedRenders) {
      if (work.frame !== undefined) cancelAnimationFrame(work.frame);
      if (work.timer !== undefined) clearTimeout(work.timer);
    }
    this.interruptedRenders.clear();
  }

  /** Result identity follows host metadata, never model prose or tool receipts. */
  private updateResultPresentation(row: HTMLElement): void {
    if (!row.hasAttribute('data-document-artifact') && !row.hasAttribute('data-interrupted')) return;
    let header = row.querySelector<HTMLElement>('.cui-result-header');
    if (!header) {
      const icon = Span().class('cui-result-icon').attr('aria-hidden', 'true').build();
      icon.innerHTML = ICON_DRAFT;
      header = Div().class('cui-result-header').children(icon, Span().class('cui-result-label').build()).build();
      row.prepend(header);
    }
    const label = row.hasAttribute('data-interrupted')
      ? (this.labels.incomplete ?? 'Incomplete response')
      : (this.labels.documentDraft ?? 'Document draft');
    header.querySelector<HTMLElement>('.cui-result-label')!.textContent = label;
    row.setAttribute('role', 'article');
    row.setAttribute('aria-label', label);
  }

  /** Mount a host-owned review card in chronological conversation order. */
  appendContent(content: HTMLElement): void {
    this.emptyEl.remove();
    const stick = this.following;
    this.messagesEl.append(content);
    this.resizeObserver?.observe(content);
    this.finishAppendLayout(stick);
  }

  /** Update run presentation; optional queue hosts retain an independent Send control. */
  setRunning(running: boolean): void {
    const restore =
      !running && this.running && (document.activeElement === this.sendBtn || document.activeElement === this.stopBtn);
    if (running && !this.running) {
      this.respondingHasText = false;
      this.presentationCleared = false;
    }
    this.running = running;
    if (!running) this.stopping = false;
    if (!running) this.activity = 'responding';
    this.updateActivity();
    if (!running) this.interruptStream();
    this.messagesEl.setAttribute('aria-busy', String(running && (this.stopping || this.activity !== 'reviewing')));
    this.updateSendState();
    if (restore) this.input.focus({ preventScroll: true });
  }

  /** Host-reported activity, not inferred model thoughts or estimated progress. */
  setActivity(activity: 'responding' | 'routing' | 'reading' | 'planning' | 'reviewing'): void {
    if (activity !== this.activity) this.respondingHasText = false;
    this.activity = activity;
    this.messagesEl.setAttribute('aria-busy', String(this.running && (this.stopping || activity !== 'reviewing')));
    this.updateActivity();
  }

  private updateActivity(): void {
    // Host phases describe actual work; the clock measures waiting, not inference progress.
    this.el.dataset.activity = this.running ? (this.stopping ? 'stopping' : this.activity) : 'idle';
    const text =
      !this.running ||
      this.disposed ||
      this.presentationCleared ||
      (this.respondingHasText && this.activity === 'responding' && !this.stopping)
        ? ''
        : this.stopping
          ? (this.labels.stopping ?? 'Stopping…')
          : this.activity === 'reviewing'
            ? (this.labels.reviewing ?? 'Review the proposed change to continue.')
            : this.activity === 'reading'
              ? (this.labels.reading ?? 'Reading content…')
              : this.activity === 'routing'
                ? (this.labels.routing ?? 'Understanding your request…')
                : this.activity === 'planning'
                  ? (this.labels.planning ?? 'Preparing task…')
                  : (this.labels.waiting ?? 'Generating a response…');
    if (this.statusEl.textContent !== text) this.statusEl.textContent = text;
    this.progressEl.hidden = !text;
    this.updateWaitClock(!!text && !this.stopping && this.activity !== 'reviewing');
  }

  private updateWaitClock(waiting: boolean): void {
    this.elapsedEl.hidden = !waiting;
    if (!waiting) {
      if (this.elapsedTimer !== undefined) clearInterval(this.elapsedTimer);
      this.elapsedTimer = undefined;
      this.waitStartedAt = null;
      this.elapsedEl.textContent = '';
      return;
    }
    this.waitStartedAt ??= performance.now();
    this.updateElapsed();
    this.elapsedTimer ??= setInterval(() => this.updateElapsed(), 1000);
  }

  private updateElapsed(): void {
    if (this.waitStartedAt === null || this.disposed) return;
    const seconds = Math.max(0, Math.floor((performance.now() - this.waitStartedAt) / 1000));
    const text = this.labels.elapsed?.(seconds) ?? `${seconds}s`;
    if (this.elapsedEl.textContent !== text) this.elapsedEl.textContent = text;
  }

  /** Remove all messages and restore the empty state. */
  clear(): void {
    this.submissionRevision++;
    this.cancelInterruptedRenders();
    // Clear the rendered feedback without claiming that the host's run stopped.
    this.presentationCleared = true;
    this.respondingHasText = false;
    this.updateWaitClock(false);
    if (this.layoutFrame !== undefined) cancelAnimationFrame(this.layoutFrame);
    this.layoutFrame = undefined;
    this.pendingText = '';
    this.liveNode = null;
    this.clearCopyFeedback();
    this.resizeObserver?.disconnect();
    this.messagesEl.replaceChildren(this.emptyEl);
    this.emptyTitle.textContent = this.labels.empty ?? '';
    this.liveMsg = null;
    this.liveText = '';
    this.updateActivity();
    this.lastUserText = '';
    this.following = true;
    this.observeLayout();
    this.updateScrollBtn();
  }

  /** Current input text. */
  getInput(): string {
    return this.input.value;
  }

  /** Replace the draft and notify composer controls, including host readiness. */
  setInput(text: string): void {
    this.input.value = text;
    this.input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  /** Refresh host readiness without changing the draft or submitting it. */
  refreshSendAvailability(): void {
    this.updateSendState();
  }

  focus(): void {
    this.input.focus();
  }

  /** Update labels (e.g. on a language change) and re-apply them live. */
  setLabels(labels: ChatViewLabels): void {
    this.labels = labels;
    this.messagesEl.setAttribute('aria-label', labels.conversation?.trim() || 'Conversation');
    this.input.placeholder = labels.placeholder ?? '';
    this.input.setAttribute('aria-label', labels.placeholder ?? 'Message');
    this.scrollBtn.setAttribute('aria-label', labels.scrollLatest ?? 'Scroll to latest');
    this.updateActivity();
    for (const button of this.messagesEl.querySelectorAll<HTMLButtonElement>('.cui-copy'))
      this.updateCopyButton(button);
    for (const button of this.messagesEl.querySelectorAll<HTMLElement>('.cui-apply')) {
      const state = button.dataset.state;
      button.title = labels.applyTip ?? 'Insert at the cursor or replace the selected text';
      button.textContent =
        state === 'verified'
          ? (labels.applied ?? 'Written')
          : state === 'pending'
            ? (labels.applying ?? 'Writing…')
            : state === 'failed' || state === 'sent'
              ? (labels.checkDocument ?? 'Check document')
              : (labels.applyMessage ?? 'Write to document');
    }
    for (const button of this.messagesEl.querySelectorAll('.cui-restore'))
      button.textContent = labels.restore ?? 'Restore request';
    for (const header of this.messagesEl.querySelectorAll<HTMLElement>('.cui-result-header'))
      this.updateResultPresentation(header.parentElement!);
    this.updateSendState();
    if (this.emptyEl.parentElement) this.emptyTitle.textContent = labels.empty ?? '';
  }

  private async submit(): Promise<void> {
    const text = this.input.value;
    if (
      !text.trim() ||
      (this.running && !this.options.onQueue) ||
      this.composing ||
      this.preparingSend ||
      this.disposed
    )
      return;
    if (this.options.canSend?.(text) === false) {
      const preparation = this.options.getSendPreparation?.();
      if (preparation && !preparation.disabled) preparation.run();
      this.updateSendState();
      return;
    }
    const revision = this.submissionRevision;
    if (this.options.beforeSend) {
      try {
        const preparation = this.options.beforeSend();
        if (typeof preparation === 'boolean') {
          if (!preparation) return;
        } else {
          this.preparingSend = true;
          this.updateSendState();
          if (!(await preparation)) return;
        }
      } catch {
        // A failed input preparation must leave the editable draft intact.
        return;
      } finally {
        this.preparingSend = false;
        this.updateSendState();
      }
    }
    const readyText = this.input.value;
    if (
      this.disposed ||
      revision !== this.submissionRevision ||
      (this.running && !this.options.onQueue) ||
      this.composing ||
      !readyText.trim()
    )
      return;
    if (this.options.canSend?.(readyText) === false) return;
    this.setInput('');
    if (this.options.onQueue && document.activeElement === this.sendBtn) this.input.focus({ preventScroll: true });
    if (this.running && this.options.onQueue) this.options.onQueue(readyText);
    else this.options.onSend(readyText);
  }

  /** Reflect run state + empty input on the send button (icon, disabled, title). */
  private updateSendState(): void {
    const hasDraft = !!this.input.value.trim();
    if (this.actionRunning !== this.running || this.actionHasDraft !== hasDraft) {
      this.actionRunning = this.running;
      this.actionHasDraft = hasDraft;
      this.updateRestoreState();
    }
    const legacyStop = this.running && !this.options.onQueue;
    const unavailable = !legacyStop && hasDraft && this.options.canSend?.(this.input.value) === false;
    const preparation = unavailable ? this.options.getSendPreparation?.() : undefined;
    if (preparation) this.sendBtn.textContent = preparation.label;
    else this.sendBtn.innerHTML = legacyStop ? ICON_STOP : ICON_SEND;
    this.sendBtn.classList.toggle('cui-send-prepare', !!preparation);
    this.sendBtn.classList.toggle('cui-send-stop', !!legacyStop);
    this.sendBtn.title = legacyStop
      ? this.stopping
        ? (this.labels.stopping ?? 'Stopping…')
        : (this.labels.stop ?? 'Stop')
      : (preparation?.label ?? (this.running ? (this.labels.queue ?? 'Queue request') : (this.labels.send ?? 'Send')));
    this.sendBtn.setAttribute('aria-label', this.sendBtn.title);
    this.sendBtn.disabled = legacyStop
      ? this.stopping
      : this.preparingSend || !hasDraft || (unavailable && (!preparation || !!preparation.disabled));
    this.stopBtn.classList.toggle('cui-send-stop', !!this.options.onQueue && this.running);
    this.stopBtn.hidden = !this.options.onQueue || !this.running;
    this.stopBtn.disabled = this.stopping;
    this.stopBtn.title = this.stopping ? (this.labels.stopping ?? 'Stopping…') : (this.labels.stop ?? 'Stop');
    this.stopBtn.setAttribute('aria-label', this.stopBtn.title);
  }

  private updateRestoreState(parent: HTMLElement = this.messagesEl): void {
    for (const button of parent.querySelectorAll<HTMLButtonElement>('.cui-restore'))
      button.disabled = this.running || !!this.input.value.trim();
    for (const button of parent.querySelectorAll<HTMLButtonElement>('.cui-apply'))
      button.disabled = this.running || (!!button.dataset.state && button.dataset.state !== 'retry');
  }

  private autoGrow(): void {
    this.input.style.height = 'auto';
    this.input.style.height = `${Math.min(this.input.scrollHeight, 160)}px`;
  }

  /** Release layout observers and transient feedback when the host unmounts. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.cancelInterruptedRenders();
    this.running = false;
    this.updateActivity();
    this.messagesEl.setAttribute('aria-busy', 'false');
    if (this.layoutFrame !== undefined) cancelAnimationFrame(this.layoutFrame);
    this.layoutFrame = undefined;
    this.pendingText = '';
    this.liveNode = null;
    this.resizeObserver?.disconnect();
    this.clearCopyFeedback();
  }

  private observeLayout(): void {
    if (this.disposed) return;
    for (const element of [this.messagesEl, this.input, this.emptyEl]) this.resizeObserver?.observe(element);
  }

  /** One DOM write and scroll measurement per frame, shared with resize work. */
  private scheduleLayout(): void {
    if (this.disposed || this.layoutFrame !== undefined) return;
    this.layoutFrame = requestAnimationFrame(() => {
      this.layoutFrame = undefined;
      if (this.disposed) return;
      this.flushStream();
      if (this.inputNeedsResize) {
        this.inputNeedsResize = false;
        this.autoGrow();
      }
      if (this.following) this.scrollToEnd();
      else {
        this.recordScrollGeometry();
        this.updateScrollBtn();
      }
    });
  }

  private flushStream(): void {
    if (!this.liveMsg || !this.pendingText) return;
    this.liveNode?.appendData(this.pendingText);
    this.pendingText = '';
  }

  private clearCopyFeedback(): void {
    for (const timer of this.copyTimers.values()) clearTimeout(timer);
    this.copyTimers.clear();
    this.feedbackEl.textContent = '';
  }

  private updateCopyButton(button: HTMLButtonElement): void {
    const state = button.dataset.state;
    button.innerHTML = state === 'copied' ? ICON_COPIED : state === 'failed' ? ICON_COPY_ERROR : ICON_COPY;
    button.title =
      state === 'copied'
        ? (this.labels.copied ?? 'Copied')
        : state === 'failed'
          ? (this.labels.copyFailed ?? 'Could not copy')
          : (this.labels.copy ?? 'Copy');
    button.setAttribute('aria-label', button.title);
  }

  private nearBottom(): boolean {
    const el = this.messagesEl;
    return el.scrollHeight - el.scrollTop - el.clientHeight < STICK_THRESHOLD;
  }

  private recordScrollGeometry(): void {
    this.scrollHeight = this.messagesEl.scrollHeight;
    this.viewportHeight = this.messagesEl.clientHeight;
  }

  private scrollToEnd(smooth = false): void {
    this.following = true;
    const reduceMotion = smooth && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    this.messagesEl.scrollTo({
      top: this.messagesEl.scrollHeight,
      behavior: smooth && !reduceMotion ? 'smooth' : 'auto',
    });
    this.recordScrollGeometry();
    this.updateScrollBtn();
  }

  private updateScrollBtn(): void {
    if (this.disposed) return;
    const hidden = this.emptyEl.parentElement === this.messagesEl || this.nearBottom();
    // Keep focus in the conversation when its jump control disappears.
    if (hidden && document.activeElement === this.scrollBtn) this.messagesEl.focus({ preventScroll: true });
    this.scrollBtn.hidden = hidden;
  }
}
