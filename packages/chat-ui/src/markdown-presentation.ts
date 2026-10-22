import { CODE_HIGHLIGHT_LIMIT, codeLanguage, highlightCode } from './markdown-highlight';
import { ensureMarkdownStyles } from './markdown-styles';
export interface MarkdownLabels {
  copy?: string;
  copied?: string;
  copyFailed?: string;
  codeBlock?: string;
  table?: string;
}
interface CodePresentation {
  frame: HTMLElement;
  button: HTMLButtonElement;
  label: HTMLElement;
  language: HTMLElement;
  named: boolean;
  state?: 'copied' | 'failed';
  timer?: ReturnType<typeof setTimeout>;
  pending: boolean;
  abort: AbortController;
}
const COPY =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></svg>';
const COPIED =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>';
/** Owns presentation work only: source, history, persistence and host actions stay outside. */
export class MarkdownPresentation {
  private readonly codes = new Set<CodePresentation>();
  private readonly tables = new Set<HTMLElement>();
  private disposed = false;
  private disabled = false;
  constructor(
    private readonly root: HTMLElement,
    private labels: MarkdownLabels = {},
  ) {
    ensureMarkdownStyles();
  }
  table(wrapper: HTMLElement): void {
    wrapper.setAttribute('role', 'region');
    wrapper.setAttribute('aria-label', this.labels.table ?? 'Table');
    this.tables.add(wrapper);
  }
  code(source: string, info: string | undefined, complete: boolean): HTMLElement {
    const frame = document.createElement('div');
    frame.className = 'cui-code';
    const header = document.createElement('div');
    header.className = 'cui-code-header';
    const language = document.createElement('span');
    language.className = 'cui-code-language';
    const { id, label: languageName } = codeLanguage(info);
    language.textContent = languageName || (this.labels.codeBlock ?? 'Code');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'cui-code-copy';
    const icon = document.createElement('span');
    icon.innerHTML = COPY; // Constant application icon, never model content.
    const label = document.createElement('span');
    label.className = 'cui-code-copy-label';
    label.setAttribute('role', 'status');
    label.setAttribute('aria-live', 'polite');
    label.setAttribute('aria-atomic', 'true');
    button.append(icon, label);
    header.append(language, button);
    const pre = document.createElement('pre');
    pre.tabIndex = 0;
    const code = document.createElement('code');
    code.textContent = source;
    pre.append(code);
    frame.append(header, pre);
    const record: CodePresentation = {
      frame,
      button,
      label,
      language,
      named: !!languageName,
      pending: false,
      abort: new AbortController(),
    };
    this.codes.add(record);
    button.disabled = this.disabled;
    this.update(record);
    button.addEventListener(
      'click',
      async () => {
        if (!this.owns(record) || record.pending || this.disabled) return;
        clearTimeout(record.timer);
        record.pending = true;
        button.disabled = true;
        let state: 'copied' | 'failed';
        try {
          await navigator.clipboard.writeText(source);
          state = 'copied';
        } catch {
          state = 'failed';
        }
        if (!this.owns(record)) return;
        record.pending = false;
        button.disabled = this.disabled;
        record.state = state;
        this.update(record);
        record.timer = setTimeout(() => {
          if (!this.owns(record)) return;
          record.state = undefined;
          this.update(record);
        }, 2000);
      },
      { signal: record.abort.signal },
    );
    if (complete && id && source.length <= CODE_HIGHLIGHT_LIMIT) {
      // The synchronous render inserts its fragment before this microtask runs.
      queueMicrotask(() => {
        if (!this.owns(record)) return;
        void highlightCode(source, id)
          .then((lines) => {
            if (!this.owns(record) || code.textContent !== source) return;
            const selection = window.getSelection();
            if (
              selection &&
              !selection.isCollapsed &&
              (code.contains(selection.anchorNode) ||
                code.contains(selection.focusNode) ||
                (selection.rangeCount && selection.getRangeAt(0).intersectsNode(code)))
            )
              return;
            const fragment = document.createDocumentFragment();
            for (const [index, line] of lines.entries()) {
              if (index) fragment.append(document.createTextNode('\n'));
              for (const token of line) {
                const span = document.createElement('span');
                span.className = 'cui-code-token';
                span.textContent = token.content;
                const styles = token.htmlStyle;
                if (styles && typeof styles !== 'string') {
                  if (styles['--shiki-light']) span.style.setProperty('--cui-token-light', styles['--shiki-light']);
                  if (styles['--shiki-dark']) span.style.setProperty('--cui-token-dark', styles['--shiki-dark']);
                }
                fragment.append(span);
              }
            }
            // Preserve exact newlines/tabs even if a grammar normalizes a boundary.
            if (fragment.textContent !== source) return;
            const left = pre.scrollLeft,
              top = pre.scrollTop;
            code.replaceChildren(fragment);
            pre.scrollLeft = left;
            pre.scrollTop = top;
          })
          .catch(() => {
            /* Plain literal code remains a complete fallback. */
          });
      });
    }
    return frame;
  }
  private owns(record: CodePresentation): boolean {
    return !this.disposed && this.codes.has(record) && this.root.contains(record.frame) && record.frame.isConnected;
  }
  private update(record: CodePresentation): void {
    record.label.textContent =
      record.state === 'copied'
        ? (this.labels.copied ?? 'Copied')
        : record.state === 'failed'
          ? (this.labels.copyFailed ?? 'Could not copy')
          : (this.labels.copy ?? 'Copy');
    record.button.title = record.label.textContent;
    record.button.dataset.state = record.state ?? 'idle';
    record.button.firstElementChild!.innerHTML = record.state === 'copied' ? COPIED : COPY;
    record.button.setAttribute('aria-label', record.label.textContent);
    if (!record.named) record.language.textContent = this.labels.codeBlock ?? 'Code';
  }
  setDisabled(disabled: boolean): void {
    this.disabled = disabled;
    for (const record of this.codes) record.button.disabled = disabled || record.pending;
  }
  setLabels(labels: MarkdownLabels): void {
    this.labels = labels;
    this.reconcile();
    for (const code of this.codes) this.update(code);
    for (const table of this.tables) table.setAttribute('aria-label', labels.table ?? 'Table');
  }
  /** Called after node reconciliation, including stream cache reuse. */
  reconcile(): void {
    for (const record of this.codes) if (!this.root.contains(record.frame)) this.release(record);
    for (const table of this.tables) if (!this.root.contains(table)) this.tables.delete(table);
  }
  releaseTree(target: Node): void {
    for (const record of this.codes) if (target.contains(record.frame)) this.release(record);
    for (const table of this.tables) if (target.contains(table)) this.tables.delete(table);
  }
  private release(record: CodePresentation): void {
    clearTimeout(record.timer);
    record.abort.abort();
    this.codes.delete(record);
  }
  dispose(): void {
    this.disposed = true;
    for (const record of this.codes) this.release(record);
    this.tables.clear();
  }
}
