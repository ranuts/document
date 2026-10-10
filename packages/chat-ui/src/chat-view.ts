import { ButtonBuilder, Div, View } from 'ranui/builder';
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
  readonly contextEl = Div().class('cui-context').build();
  readonly emptyActionsEl: HTMLDivElement;

  private readonly messagesEl: HTMLDivElement;
  private readonly emptyEl: HTMLDivElement;
  private readonly emptyTitle: HTMLDivElement;
  private readonly input: HTMLTextAreaElement;
  private readonly sendBtn: HTMLButtonElement;
  private readonly scrollBtn: HTMLButtonElement;
  private labels: ChatViewLabels;
  private running = false;
  private composing = false;
  private lastUserText = '';
  private readonly statusEl = Div().class('cui-status').attr('role', 'status').build();
  /** The agent bubble currently receiving streamed deltas, if any. */
  private liveMsg: HTMLDivElement | null = null;
  private liveText = '';

  constructor(private readonly options: ChatViewOptions) {
    ensureChatUiStyles();
    this.labels = options.labels ?? {};

    this.emptyTitle = Div()
      .text(this.labels.empty ?? '')
      .build();
    this.emptyActionsEl = Div().class('cui-empty-actions').build();
    this.emptyEl = Div().class('cui-empty').children(this.emptyTitle, this.emptyActionsEl).build();

    this.messagesEl = Div()
      .class('cui-messages')
      .attr('role', 'log')
      .attr('aria-busy', 'false')
      .attr('tabindex', '-1')
      .on(
        'scroll',
        throttle(() => this.updateScrollBtn(), 100),
      )
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
        if (this.running) this.options.onStop?.();
        else this.submit();
      })
      .build();
    this.sendBtn.innerHTML = ICON_SEND;

    const composer = Div()
      .class('cui-composer')
      .children(
        this.contextEl,
        this.input,
        Div().class('cui-composer-bar').children(this.actionsEl, this.sendBtn).build(),
      )
      .build();

    // Footer hosts the jump-to-latest button (floats just above it), the action
    // slot, and the composer.
    const footer = Div().class('cui-footer').children(this.scrollBtn, composer).build();

    this.el = Div().class('cui-root').children(this.messagesEl, this.statusEl, footer).build();
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

  /** Append a finished message and scroll to it. Returns the bubble element. */
  append(message: ChatMessage): HTMLDivElement {
    if ((message.role === 'status' || message.role === 'error') && this.liveMsg) {
      this.liveMsg.dataset.interrupted = 'true';
      this.liveMsg.querySelector('.cui-apply')?.remove();
      this.endStream();
    }
    if (message.role === 'user') this.lastUserText = message.text;
    const stick = this.nearBottom();
    this.emptyEl.remove();
    if (message.role === 'tool') {
      const last = this.messagesEl.lastElementChild;
      let group = last?.matches('.cui-activity') ? last : document.createElement('div');
      const item = Div().text(message.text).build();
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
      if (stick) this.scrollToEnd();
      else this.updateScrollBtn();
      return item;
    }

    const bubble = Div().class('cui-bubble').text(message.text).build();
    if (message.role === 'agent') renderMarkdown(bubble, message.text);
    const row = Div().class(`cui-msg cui-msg-${message.role}`).attr('data-role', message.role).children(bubble).build();

    const actions = Div().class('cui-message-actions').build();
    if (message.role === 'agent') {
      const copy = ButtonBuilder().class('cui-copy').attr('type', 'button').build();
      copy.innerHTML = ICON_COPY;
      copy.title = this.labels.copy ?? 'Copy';
      copy.setAttribute('aria-label', copy.title);
      copy.addEventListener('click', async () => {
        copy.disabled = true;
        try {
          await navigator.clipboard.writeText(row.dataset.source ?? message.text);
          copy.textContent = this.labels.copied ?? 'Copied';
        } catch {
          copy.textContent = this.labels.copyFailed ?? 'Could not copy';
        } finally {
          copy.disabled = false;
        }
      });
      actions.append(copy);
      if (
        this.options.onApplyMessage &&
        (this.options.canApplyMessage?.() ?? true) &&
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
        actions.append(apply);
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
    if (message.interrupted) row.dataset.interrupted = 'true';

    this.messagesEl.appendChild(row);
    this.updateRestoreState();
    if (stick) this.scrollToEnd();
    else this.updateScrollBtn();
    return bubble;
  }

  /**
   * Append streamed text to a live agent bubble, creating it on the first delta.
   * Call {@link endStream} when the turn completes.
   */
  appendDelta(delta: string): void {
    if (!delta) return;
    const stick = this.nearBottom();
    if (!this.liveMsg) {
      this.liveMsg = this.append({ role: 'agent', text: '' }).parentElement as HTMLDivElement;
      this.liveMsg.classList.add('cui-streaming');
    }
    const bubble = this.liveMsg.querySelector('.cui-bubble');
    this.liveText += delta;
    if (bubble) bubble.textContent = this.liveText;
    this.liveMsg.dataset.source = this.liveText;
    if (stick) this.scrollToEnd();
  }

  /** Finalise the current streaming bubble (removes the caret). */
  endStream(): void {
    const stick = this.nearBottom();
    const bubble = this.liveMsg?.querySelector<HTMLElement>('.cui-bubble');
    if (bubble) renderMarkdown(bubble, this.liveText);
    this.liveMsg?.classList.remove('cui-streaming');
    this.liveMsg = null;
    this.liveText = '';
    if (bubble && stick) this.scrollToEnd();
  }

  /** Mount a host-owned review card in chronological conversation order. */
  appendContent(content: HTMLElement): void {
    this.emptyEl.remove();
    this.messagesEl.append(content);
    this.scrollToEnd();
  }

  /** Toggle the running state: Send becomes Stop and the input locks. */
  setRunning(running: boolean): void {
    this.running = running;
    this.input.disabled = running;
    this.statusEl.textContent = running ? (this.labels.waiting ?? 'Thinking…') : '';
    if (!running) this.endStream();
    this.messagesEl.setAttribute('aria-busy', String(running));
    this.updateSendState();
  }

  /** Remove all messages and restore the empty state. */
  clear(): void {
    this.messagesEl.replaceChildren(this.emptyEl);
    this.emptyTitle.textContent = this.labels.empty ?? '';
    this.liveMsg = null;
    this.liveText = '';
    this.lastUserText = '';
    this.updateScrollBtn();
  }

  /** Current input text. */
  getInput(): string {
    return this.input.value;
  }

  /** Replace the input text (e.g. to prepend a quoted selection). */
  setInput(text: string): void {
    this.input.value = text;
    this.autoGrow();
    this.updateSendState();
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
    this.statusEl.textContent = this.running ? (labels.waiting ?? 'Thinking…') : '';
    for (const button of this.messagesEl.querySelectorAll<HTMLElement>('.cui-copy')) {
      button.title = labels.copy ?? 'Copy';
      button.setAttribute('aria-label', button.title);
    }
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
    this.updateSendState();
    if (this.emptyEl.parentElement) this.emptyTitle.textContent = labels.empty ?? '';
  }

  private submit(): void {
    const text = this.input.value;
    if (!text.trim() || this.running || this.options.canSend?.(text) === false) return;
    this.input.value = '';
    this.autoGrow();
    this.updateSendState();
    this.options.onSend(text);
  }

  /** Reflect run state + empty input on the send button (icon, disabled, title). */
  private updateSendState(): void {
    this.updateRestoreState();
    this.sendBtn.innerHTML = this.running ? ICON_STOP : ICON_SEND;
    this.sendBtn.classList.toggle('cui-send-stop', this.running);
    this.sendBtn.title = this.running ? (this.labels.stop ?? 'Stop') : (this.labels.send ?? 'Send');
    this.sendBtn.setAttribute('aria-label', this.sendBtn.title);
    // Disable unavailable submissions while idle; a running turn always keeps Stop available.
    this.sendBtn.disabled =
      !this.running && (this.input.value.trim() === '' || this.options.canSend?.(this.input.value) === false);
  }

  private updateRestoreState(): void {
    for (const button of this.messagesEl.querySelectorAll<HTMLButtonElement>('.cui-restore'))
      button.disabled = this.running || !!this.input.value.trim();
    for (const button of this.messagesEl.querySelectorAll<HTMLButtonElement>('.cui-apply'))
      button.disabled = this.running || (!!button.dataset.state && button.dataset.state !== 'retry');
  }

  private autoGrow(): void {
    this.input.style.height = 'auto';
    this.input.style.height = `${Math.min(this.input.scrollHeight, 160)}px`;
  }

  private nearBottom(): boolean {
    const el = this.messagesEl;
    return el.scrollHeight - el.scrollTop - el.clientHeight < STICK_THRESHOLD;
  }

  private scrollToEnd(smooth = false): void {
    const reduceMotion = smooth && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    this.messagesEl.scrollTo({
      top: this.messagesEl.scrollHeight,
      behavior: smooth && !reduceMotion ? 'smooth' : 'auto',
    });
    this.updateScrollBtn();
  }

  private updateScrollBtn(): void {
    const hidden = this.emptyEl.parentElement === this.messagesEl || this.nearBottom();
    // Keep focus in the conversation when its jump control disappears.
    if (hidden && document.activeElement === this.scrollBtn) this.messagesEl.focus({ preventScroll: true });
    this.scrollBtn.hidden = hidden;
  }
}
