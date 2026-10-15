import { ButtonBuilder, Div, Span, View } from 'ranui/builder';
import { throttle } from 'ranuts/utils';
import { ensureChatUiStyles } from './styles';
import { renderMarkdown } from './markdown';
import { StreamingMarkdown, STREAMING_MARKDOWN_LIMIT } from './streaming-markdown';
import type { ChatMessage, ChatViewLabels, ChatViewOptions, RestoreHistoryOptions } from './types';

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
  private restoredHistory: readonly ChatMessage[] = [];
  private historyStart = 0;
  private historyPageSize = 40;
  private historyRevision = 0;
  private earlierButton?: HTMLButtonElement;
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
  private nativeScrollTarget?: number;
  // Delivery from a canceled animation cannot establish fresh reader intent.
  // The next scrolling gesture or explicit jump releases this interruption.
  private nativeScrollInterrupted = false;
  private scrollHeight = 0;
  private viewportHeight = 0;
  private disposed = false;
  private readonly copyTimers = new Map<HTMLButtonElement, ReturnType<typeof setTimeout>>();
  /** The agent bubble currently receiving streamed deltas, if any. */
  private liveMsg: HTMLDivElement | null = null;
  private liveText = '';
  private presentationCallback?: () => void;
  private presentationCandidate?: HTMLElement;
  private liveMarkdown?: StreamingMarkdown;
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
        if (this.disposed || this.emptyEl.parentElement === this.messagesEl) return;
        if (this.nativeScrollTarget !== undefined) {
          this.scrollToEnd();
          return;
        }
        // Reflow can emit scroll before ResizeObserver. Changed geometry does
        // not establish that the reader intentionally scrolled away.
        const unchanged =
          this.scrollHeight === this.messagesEl.scrollHeight && this.viewportHeight === this.messagesEl.clientHeight;
        if (!this.nativeScrollInterrupted && (!this.scrollHeight || unchanged || this.nearBottom()))
          this.following = this.nearBottom();
        this.recordScrollGeometry();
        updateScroll();
      })
      .children(this.emptyEl)
      .build();
    this.messagesEl.addEventListener('scrollend', (event) => {
      if (!this.disposed && event.target === this.messagesEl && this.nativeScrollTarget !== undefined)
        this.scrollToEnd(true);
    });
    this.messagesEl.addEventListener('wheel', () => this.readerScrollIntent(), { passive: true });
    this.messagesEl.addEventListener('touchmove', () => this.readerScrollIntent(), { passive: true });
    const ownPointerIntent = (event: Event) => {
      if (event.target === this.messagesEl) this.readerScrollIntent();
    };
    this.messagesEl.addEventListener('pointerdown', ownPointerIntent);
    this.messagesEl.addEventListener('mousedown', (event) => {
      // Pointer-enabled browsers also emit mousedown for the same gesture.
      // Processing it twice would release the interruption established above.
      if (typeof window.PointerEvent === 'undefined') ownPointerIntent(event);
    });
    this.messagesEl.addEventListener('keydown', (event) => {
      if (
        event.defaultPrevented ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        !['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key) ||
        (event.target instanceof Element && event.target.closest('input,textarea,select,[contenteditable]'))
      )
        return;
      this.readerScrollIntent();
    });

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
    return rows.length ? (rows[rows.length - 1].dataset.source ?? '') : this.restoredAnswer(false);
  }

  getLastDocumentBody(): string {
    const rows = this.messagesEl.querySelectorAll<HTMLElement>(
      '.cui-msg-agent[data-document-artifact]:not(.cui-streaming):not([data-interrupted])',
    );
    return rows.length ? (rows[rows.length - 1].dataset.source ?? '') : this.restoredAnswer(true);
  }

  /** Append a finished message and scroll to it. Returns the bubble element. */
  append(message: ChatMessage): HTMLElement {
    if ((message.role === 'status' || message.role === 'error') && this.liveMsg) {
      this.interruptStream();
    }
    if (message.role === 'user') this.lastUserText = message.text;
    const bubble = this.renderMessage(message, this.messagesEl, this.lastUserText);
    if (message.role === 'agent' && message.text && this.presentationCallback) this.presentationCandidate = bubble;
    this.finishAppendLayout(this.following);
    return bubble;
  }

  /** Construct history rows without changing the active stream or recovery request. */
  private renderMessage(
    message: ChatMessage,
    destination: HTMLElement,
    request: string,
    restored = false,
  ): HTMLElement {
    this.emptyEl.remove();
    const preview = restored && message.text.length > 8000;
    const visibleText = preview ? message.text.slice(0, 8000) : message.text;
    if (message.role === 'tool') {
      const last = destination.lastElementChild;
      let group = last?.matches('.cui-activity') ? last : document.createElement('div');
      const item = Span().text(visibleText).build();
      if (group !== last) {
        group.className = 'cui-activity';
        if (restored) {
          group = document.createElement('details');
          group.className = 'cui-activity';
          const summary = document.createElement('summary');
          summary.append(item);
          group.append(summary, document.createElement('ul'));
        } else group.append(item);
        destination.append(group);
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
      this.resizeObserver?.observe(group);
      if (preview) this.addHistoryExpansion(item, item, message, false);
      return item;
    }

    const bubble = Div().class('cui-bubble').text(visibleText).build();
    if (message.role === 'agent') {
      if (restored || this.options.streamingMarkdown) {
        try {
          if (this.options.streamingMarkdown && visibleText.length > STREAMING_MARKDOWN_LIMIT)
            bubble.classList.add('cui-stream-raw');
          else renderMarkdown(bubble, visibleText);
        } catch {
          bubble.textContent = visibleText;
          if (this.options.streamingMarkdown) bubble.classList.add('cui-stream-raw');
        }
      } else renderMarkdown(bubble, visibleText);
    }
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
    if ((message.role === 'error' || message.role === 'status') && request) {
      const draft = request;
      const restore = ButtonBuilder().class('cui-restore').attr('type', 'button').build();
      restore.textContent = this.labels.restore ?? 'Restore request';
      restore.addEventListener('click', () => {
        if (this.running || this.input.value.trim()) return;
        this.setInput(draft);
        this.focus();
      });
      actions.append(restore);
    }
    if (preview) this.addHistoryExpansion(row, bubble, message, message.role === 'agent');
    if (actions.childElementCount) row.append(actions);
    row.dataset.source = message.text;
    if (message.documentArtifact) row.dataset.documentArtifact = 'true';
    if (message.interrupted) row.dataset.interrupted = 'true';
    if (message.role === 'agent') this.updateResultPresentation(row);

    destination.appendChild(row);
    this.resizeObserver?.observe(row);
    this.updateRestoreState(row);
    return bubble;
  }

  /** Replace presentation with a bounded recent window; full source stays available. */
  restoreHistory(messages: readonly ChatMessage[], options: RestoreHistoryOptions = {}): void {
    if (this.disposed) return;
    this.clear();
    this.restoredHistory = messages.map((message) => ({ ...message }));
    const requestedSize = options.pageSize ?? 40;
    this.historyPageSize = Number.isFinite(requestedSize) ? Math.max(1, Math.min(40, Math.floor(requestedSize))) : 40;
    this.historyStart = messages.length;
    const owner = this.historyRevision;
    if (!messages.length) return;
    this.earlierButton = ButtonBuilder()
      .class('cui-load-earlier')
      .attr('type', 'button')
      .on('click', () => {
        if (!this.disposed && owner === this.historyRevision) this.loadEarlierHistory();
      })
      .build();
    this.earlierButton.textContent = this.labels.loadEarlier ?? 'Load earlier messages';
    this.messagesEl.prepend(this.earlierButton);
    this.prependHistoryWindow();
    this.lastUserText = this.priorHistoryRequest(messages.length);
    this.finishAppendLayout(true);
  }

  private restoredAnswer(documentOnly: boolean): string {
    for (let index = this.restoredHistory.length - 1; index >= 0; index--) {
      const message = this.restoredHistory[index];
      if (message.role === 'agent' && !message.interrupted && (!documentOnly || message.documentArtifact))
        return message.text;
    }
    return '';
  }

  private priorHistoryRequest(before: number): string {
    for (let index = before - 1; index >= 0; index--)
      if (this.restoredHistory[index].role === 'user') return this.restoredHistory[index].text;
    return '';
  }

  private addHistoryExpansion(row: HTMLElement, bubble: HTMLElement, message: ChatMessage, markdown: boolean): void {
    const owner = this.historyRevision;
    const expand = ButtonBuilder()
      .class('cui-history-expand')
      .attr('type', 'button')
      .text(this.labels.expandMessage ?? 'Show full message')
      .build();
    expand.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (this.disposed || owner !== this.historyRevision || !this.messagesEl.contains(row)) return;
      const ownedFocus = document.activeElement === expand;
      if (markdown) {
        try {
          renderMarkdown(bubble, message.text);
        } catch {
          bubble.textContent = message.text;
        }
      } else bubble.textContent = message.text;
      expand.remove();
      if (ownedFocus) this.messagesEl.focus({ preventScroll: true });
    });
    row.append(expand);
  }

  private prependHistoryWindow(): void {
    const end = this.historyStart;
    const start = Math.max(0, end - this.historyPageSize);
    const fragment = document.createElement('div');
    let request = this.priorHistoryRequest(start);
    for (let index = start; index < end; index++) {
      const message = this.restoredHistory[index];
      if (message.role === 'user') request = message.text;
      this.renderMessage(message, fragment, request, true);
    }
    const previous = fragment.lastElementChild;
    const next = this.earlierButton?.nextElementSibling;
    if (previous?.matches('details.cui-activity') && next?.matches('details.cui-activity')) {
      const priorItems = previous.querySelector('ul')!;
      const summaryItem = document.createElement('li');
      summaryItem.append(...Array.from(previous.querySelector('summary')!.childNodes));
      priorItems.append(summaryItem);
      next.querySelector('ul')!.prepend(...Array.from(priorItems.children));
      this.resizeObserver?.unobserve(previous);
      previous.remove();
    }
    this.earlierButton?.after(...Array.from(fragment.children));
    this.historyStart = start;
    if (this.earlierButton) this.earlierButton.hidden = !start;
  }

  private loadEarlierHistory(): void {
    if (!this.historyStart || this.disposed) return;
    if (this.nativeScrollTarget !== undefined) this.readerScrollIntent();
    const bounds = this.messagesEl.getBoundingClientRect();
    const candidates = [
      ...this.messagesEl.querySelectorAll<HTMLElement>('.cui-bubble, .cui-activity summary, .cui-activity li'),
      ...Array.from(this.messagesEl.children).filter((node) => node !== this.earlierButton),
    ];
    const anchor =
      candidates.find((node) => {
        const rect = node.getBoundingClientRect();
        return rect.bottom > bounds.top && rect.top < bounds.bottom;
      }) ??
      candidates[0] ??
      this.earlierButton?.nextElementSibling;
    const top = anchor?.getBoundingClientRect().top ?? 0;
    const focused = document.activeElement;
    this.following = false;
    this.prependHistoryWindow();
    if (anchor) this.messagesEl.scrollTop += anchor.getBoundingClientRect().top - top;
    this.recordScrollGeometry();
    this.updateScrollBtn();
    if (focused === this.earlierButton && this.earlierButton?.hidden) this.messagesEl.focus({ preventScroll: true });
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
    else {
      if (stick) this.scrollToEnd();
      else this.updateScrollBtn();
      this.notifyPresentation();
    }
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
      if (this.options.streamingMarkdown) this.liveMsg.classList.add('cui-streaming-markdown');
      this.liveNode = document.createTextNode('');
      const bubble = this.liveMsg.querySelector<HTMLElement>('.cui-bubble')!;
      bubble.replaceChildren(this.liveNode);
      if (this.options.streamingMarkdown) {
        bubble.classList.remove('cui-stream-raw');
        this.liveMarkdown = new StreamingMarkdown(bubble);
      }
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
    if (this.liveMarkdown) {
      this.liveMarkdown.update(this.liveText, true);
      this.pendingText = '';
    } else this.flushStream();
    if (this.liveMsg) this.liveMsg.dataset.source = this.liveText;
    const bubble = this.liveMsg?.querySelector<HTMLElement>('.cui-bubble');
    if (bubble && !this.liveMarkdown) renderMarkdown(bubble, this.liveText);
    if (bubble && this.liveText && this.presentationCallback) this.presentationCandidate = bubble;
    this.liveMarkdown = undefined;
    this.liveMsg?.classList.remove('cui-streaming', 'cui-streaming-markdown');
    this.liveMsg = null;
    this.liveNode = null;
    this.liveText = '';
    this.updateActivity();
    if (bubble) this.finishAppendLayout(stick);
  }

  /** Only explicit stream completion can make a preview available for writing. */
  private interruptStream(deferMarkdown = false): void {
    const row = this.liveMsg;
    if (!row) return;
    const text = this.liveText;
    const markdown = this.liveMarkdown;
    this.flushStream(false);
    this.liveMarkdown = undefined;
    row.dataset.source = text;
    row.dataset.interrupted = 'true';
    row.querySelector('.cui-apply')?.remove();
    this.updateResultPresentation(row);
    row.classList.remove('cui-streaming', 'cui-streaming-markdown');
    this.liveMsg = null;
    this.liveNode = null;
    this.liveText = '';
    if (!deferMarkdown) {
      const bubble = row.querySelector<HTMLElement>('.cui-bubble');
      if (markdown) markdown.update(text, true);
      else if (bubble) renderMarkdown(bubble, text);
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
        if (markdown) markdown.update(text, true);
        else if (bubble) renderMarkdown(bubble, text);
        this.scheduleLayout();
      }, 0);
    });
  }

  /** Freeze visible output and acknowledge cancellation until the host settles. */
  requestStop(): void {
    this.observePresentation();
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
    this.observePresentation();
    this.resetNativeScroll();
    this.submissionRevision++;
    this.historyRevision++;
    this.restoredHistory = [];
    this.historyStart = 0;
    this.earlierButton = undefined;
    this.cancelInterruptedRenders();
    // Clear the rendered feedback without claiming that the host's run stopped.
    this.presentationCleared = true;
    this.respondingHasText = false;
    this.updateWaitClock(false);
    if (this.layoutFrame !== undefined) cancelAnimationFrame(this.layoutFrame);
    this.layoutFrame = undefined;
    this.pendingText = '';
    this.liveNode = null;
    this.liveMarkdown = undefined;
    this.clearCopyFeedback();
    this.resizeObserver?.disconnect();
    this.messagesEl.replaceChildren(this.emptyEl);
    this.messagesEl.scrollTop = 0;
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
    if (this.earlierButton) this.earlierButton.textContent = labels.loadEarlier ?? 'Load earlier messages';
    for (const button of this.messagesEl.querySelectorAll<HTMLButtonElement>('.cui-history-expand'))
      button.textContent = labels.expandMessage ?? 'Show full message';
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
    let restoreFocus = !!this.options.onQueue && document.activeElement === this.sendBtn;
    if (this.options.beforeSend) {
      const movedFocus = (event: FocusEvent) => {
        if (event.target !== this.sendBtn) restoreFocus = false;
      };
      if (restoreFocus) document.addEventListener('focusin', movedFocus);
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
        document.removeEventListener('focusin', movedFocus);
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
    if (restoreFocus) this.input.focus({ preventScroll: true });
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
    this.observePresentation();
    this.resetNativeScroll();
    this.disposed = true;
    this.historyRevision++;
    this.restoredHistory = [];
    this.earlierButton = undefined;
    this.cancelInterruptedRenders();
    this.running = false;
    this.updateActivity();
    this.messagesEl.setAttribute('aria-busy', 'false');
    if (this.layoutFrame !== undefined) cancelAnimationFrame(this.layoutFrame);
    this.layoutFrame = undefined;
    this.pendingText = '';
    this.liveNode = null;
    this.liveMarkdown = undefined;
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
      if (this.following && this.emptyEl.parentElement !== this.messagesEl) this.scrollToEnd();
      else {
        this.recordScrollGeometry();
        this.updateScrollBtn();
      }
      this.notifyPresentation();
    });
  }

  /** Arm one request-owned DOM observation; replacement and cancellation discard the old owner. */
  observePresentation(callback?: () => void): void {
    this.presentationCallback = this.disposed ? undefined : callback;
    this.presentationCandidate = undefined;
  }

  private notifyPresentation(): void {
    const callback = this.presentationCallback;
    const candidate = this.presentationCandidate;
    if (
      !callback ||
      !candidate ||
      this.disposed ||
      this.appendBatchDepth ||
      !this.el.isConnected ||
      !candidate.isConnected ||
      document.visibilityState !== 'visible'
    )
      return;
    try {
      if (typeof candidate.checkVisibility === 'function') {
        if (
          !candidate.checkVisibility({ opacityProperty: true, visibilityProperty: true, contentVisibilityAuto: true })
        )
          return;
      } else {
        // Older engines: cap ancestor work and leave deeper/unobservable trees unmeasured.
        let ancestor: HTMLElement | null = candidate;
        for (let visited = 0; ancestor && visited < 16; visited++, ancestor = ancestor.parentElement) {
          const style = getComputedStyle(ancestor);
          if (
            style.visibility === 'hidden' ||
            style.visibility === 'collapse' ||
            style.display === 'none' ||
            style.opacity === '0'
          )
            return;
        }
        if (ancestor) return;
      }
      const viewport = this.messagesEl.getBoundingClientRect();
      const left = Math.max(0, viewport.left);
      const top = Math.max(0, viewport.top);
      const right = Math.min(window.innerWidth, viewport.right);
      const bottom = Math.min(window.innerHeight, viewport.bottom);
      if (left >= right || top >= bottom) return;
      // Conservative bounded probe: never create a Range spanning a growing reply.
      const text = document.createTreeWalker(candidate, NodeFilter.SHOW_TEXT);
      for (let visited = 0, node = text.nextNode(); node && visited < 16; visited++, node = text.nextNode()) {
        const sample = (node as Text).data.slice(0, 64);
        const start = sample.search(/\S/);
        if (start < 0) continue;
        const range = document.createRange();
        range.setStart(node, start);
        range.setEnd(node, sample.length);
        for (const rect of range.getClientRects()) {
          if (
            rect.width <= 0 ||
            rect.height <= 0 ||
            rect.right <= left ||
            rect.left >= right ||
            rect.bottom <= top ||
            rect.top >= bottom
          )
            continue;
          this.presentationCallback = undefined;
          this.presentationCandidate = undefined;
          callback();
          return;
        }
      }
    } catch {
      /* Unsupported geometry/diagnostics never affect chat behavior. */
    }
  }

  private flushStream(format = true): void {
    if (!this.liveMsg || !this.pendingText) return;
    if (this.liveMarkdown) {
      if (format) this.liveMarkdown.update(this.liveText);
      else this.liveMarkdown.raw(this.liveText);
    } else this.liveNode?.appendData(this.pendingText);
    if (this.presentationCallback)
      this.presentationCandidate = this.liveMsg.querySelector<HTMLElement>('.cui-bubble') ?? undefined;
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
    if (this.disposed) return;
    this.following = true;
    this.nativeScrollInterrupted = false;
    if (this.emptyEl.parentElement === this.messagesEl) {
      this.updateScrollBtn();
      return;
    }
    const native = smooth || this.nativeScrollTarget !== undefined;
    const reduceMotion = native && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (native && !reduceMotion) {
      const floor = Math.max(0, this.messagesEl.scrollHeight - this.messagesEl.clientHeight);
      // Native progress is not a reader gesture. Only measured current-floor
      // arrival settles ownership, including browsers without scrollend.
      if (Math.abs(this.messagesEl.scrollTop - floor) <= 1) this.nativeScrollTarget = undefined;
      else if (smooth || this.nativeScrollTarget !== floor) {
        this.nativeScrollTarget = floor;
        this.messagesEl.scrollTo({ top: this.messagesEl.scrollHeight, behavior: 'smooth' });
      }
    } else {
      this.nativeScrollTarget = undefined;
      this.messagesEl.scrollTo({ top: this.messagesEl.scrollHeight, behavior: 'auto' });
    }
    this.recordScrollGeometry();
    this.updateScrollBtn();
  }

  private readerScrollIntent(): void {
    if (this.disposed) return;
    if (this.nativeScrollTarget === undefined) {
      this.nativeScrollInterrupted = false;
      return;
    }
    this.nativeScrollTarget = undefined;
    this.nativeScrollInterrupted = true;
    this.following = false;
    // An instant command at the current offset aborts actual native motion.
    this.messagesEl.scrollTo({ top: this.messagesEl.scrollTop, behavior: 'instant' });
    this.recordScrollGeometry();
    this.updateScrollBtn();
  }

  private resetNativeScroll(): void {
    if (this.nativeScrollTarget !== undefined)
      this.messagesEl.scrollTo({ top: this.messagesEl.scrollTop, behavior: 'instant' });
    this.nativeScrollTarget = undefined;
    this.nativeScrollInterrupted = false;
  }

  private updateScrollBtn(): void {
    if (this.disposed) return;
    const hidden = this.emptyEl.parentElement === this.messagesEl || this.nearBottom();
    // Keep focus in the conversation when its jump control disappears.
    if (hidden && document.activeElement === this.scrollBtn) this.messagesEl.focus({ preventScroll: true });
    this.scrollBtn.hidden = hidden;
  }
}
