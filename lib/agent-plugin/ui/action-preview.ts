import { Div, Span, View } from 'ranui/builder';
import { t } from '@ranuts/shared/i18n';
import { displayError } from './presentation';
import { buildSeries, type SeriesInput } from '../fill-series';
interface PreviewAction {
  target: { label: string; selectedText: string; reviewText?: string; context?: { kind: string; sheet?: string } };
  plan: { tool: string; input: Readonly<Record<string, unknown>> };
  isCurrent(): boolean;
  cancel(): void;
  apply(signal?: AbortSignal): Promise<'sent' | 'verified'>;
}

/** Transient, text-only preview. Proposed actions are never persisted/replayed. */
export class ActionPreview {
  readonly el = Div().class('agent-plan-preview').attr('role', 'region').build();
  private readonly title = Span().build();
  private readonly target = Span().class('agent-plan-target').build();
  private readonly beforeLabel = Span().build();
  private readonly before = View('pre').class('agent-plan-before').build();
  private readonly afterLabel = Span().build();
  private readonly content = View('pre').class('agent-plan-content').build();
  private readonly status = Span().class('agent-plan-status').attr('role', 'status').build();
  private readonly applyButton = View('r-button').class('agent-plan-apply').build();
  private readonly copyButton = View('r-button').class('agent-plan-copy').build();
  private readonly cancelButton = View('r-button').class('agent-plan-cancel').build();
  private action: PreviewAction | null = null;
  private settled = false;
  private returnFocus?: HTMLElement;
  private abort?: AbortController;
  private onApplied?: (outcome: 'sent' | 'verified') => void;
  private timer?: ReturnType<typeof setInterval>;
  private readonly updateLanguage = () => this.labels();
  constructor() {
    this.el.hidden = true;
    this.el.append(
      this.title,
      this.target,
      View('details')
        .class('agent-plan-original')
        .children(View('summary').children(this.beforeLabel).build(), this.before)
        .build(),
      this.afterLabel,
      this.content,
      this.status,
      Div().class('agent-plan-buttons').children([this.applyButton, this.copyButton, this.cancelButton]).build(),
    );
    this.applyButton.addEventListener('click', () => void this.apply());
    this.cancelButton.addEventListener('click', () => this.hide());
    this.copyButton.addEventListener('click', () => {
      void this.copy();
    });
    window.addEventListener('languagechange', this.updateLanguage);
    this.labels();
  }
  private labels(): void {
    this.title.textContent = t(this.action?.plan.tool === 'clear_document' ? 'agentClearDocument' : 'agentPlanTitle');
    this.el.setAttribute('aria-label', this.title.textContent);
    this.beforeLabel.textContent = t('agentPlanBefore');
    this.afterLabel.textContent = t('agentPlanAfter');
    this.applyButton.textContent = t(
      this.action?.plan.tool === 'clear_document'
        ? 'agentClearDocument'
        : this.action?.plan.tool === 'insert_text'
          ? this.action.target.selectedText
            ? 'agentReplaceContent'
            : 'agentInsertContent'
          : this.action?.plan.tool === 'replace_selection'
            ? 'agentReplaceContent'
            : 'agentPlanApply',
    );
    this.cancelButton.textContent = t(this.el.dataset.state === 'applying' ? 'agentStop' : 'agentPlanCancel');
    this.copyButton.textContent = t('agentCopy');
    const action = this.action;
    if (action)
      this.target.textContent = `${action.target.context?.kind === 'cell' ? ['Excel', action.target.context.sheet].filter(Boolean).join(' · ') : action.target.label} · ${
        action.plan.tool === 'clear_document'
          ? t('agentCurrentDocument')
          : action.plan.tool === 'fill_series'
            ? buildSeries(action.plan.input as unknown as SeriesInput).range
            : action.plan.tool === 'set_cell'
              ? action.plan.input.cell
              : t(action.target.selectedText ? 'agentPlanSelection' : 'agentPlanCursor')
      }`;
  }
  show(action: PreviewAction, onApplied?: (outcome: 'sent' | 'verified') => void): void {
    this.hide();
    this.action = action;
    this.returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
    this.abort = new AbortController();
    this.onApplied = onApplied;
    this.settled = false;
    this.el.dataset.state = 'pending';
    this.title.hidden = false;
    this.el.querySelector<HTMLElement>('.agent-plan-buttons')!.hidden = false;
    this.content.hidden = this.afterLabel.hidden = false;
    this.copyButton.hidden = action.plan.tool === 'clear_document';
    this.el.hidden = false;
    const original = action.plan.tool === 'clear_document' ? action.target.reviewText : action.target.selectedText;
    this.before.textContent = original?.slice(0, 8000) ?? '';
    this.before.hidden = this.beforeLabel.hidden = !original;
    this.before.parentElement!.hidden = !original;
    this.content.textContent = String(
      action.plan.tool === 'clear_document'
        ? t('agentClearDocument')
        : action.plan.tool === 'fill_series'
          ? buildSeries(action.plan.input as unknown as SeriesInput)
              .values.map((row) => row.join('\t'))
              .join('\n')
          : action.plan.tool === 'set_cell'
            ? action.plan.input.value
            : (action.plan.input.text ?? JSON.stringify(action.plan.input)),
    );
    this.status.textContent =
      action.plan.tool === 'clear_document' && original !== undefined
        ? t('agentClearImpact').replace('{count}', String(Array.from(original).length))
        : '';
    if (action.plan.tool === 'clear_document') this.afterLabel.hidden = this.content.hidden = true;
    this.applyButton.removeAttribute('disabled');
    this.labels();
    this.timer = setInterval(() => {
      if (!action.isCurrent()) this.invalidate();
    }, 500);
  }
  invalidate(): void {
    if (!this.action) return;
    this.abort?.abort();
    if (this.settled) return;
    this.action.cancel();
    this.settled = true;
    clearInterval(this.timer);
    this.applyButton.setAttribute('disabled', '');
    this.status.textContent = t('agentPlanExpired');
    this.finish('expired');
  }
  hide(): void {
    const restore = this.el.contains(document.activeElement);
    this.abort?.abort();
    this.action?.cancel();
    this.action = null;
    clearInterval(this.timer);
    this.el.hidden = true;
    if (restore && this.returnFocus?.isConnected) this.returnFocus.focus();
  }
  private async copy(): Promise<void> {
    const action = this.action;
    if (!action) return;
    try {
      await navigator.clipboard.writeText(this.content.textContent ?? '');
      if (this.action === action) this.copyButton.textContent = t('agentCopied');
    } catch {
      if (this.action === action) this.status.textContent = t('agentCopyFailed');
    }
  }
  private async apply(): Promise<void> {
    if (!this.action || this.settled) return;
    const action = this.action;
    this.settled = true;
    clearInterval(this.timer);
    this.applyButton.setAttribute('disabled', '');
    this.el.dataset.state = 'applying';
    this.copyButton.hidden = true;
    this.status.textContent = t('agentPlanApplying');
    this.labels();
    try {
      const result = await action.apply(this.abort?.signal);
      if (this.action === action && !this.abort?.signal.aborted) {
        this.onApplied?.(result);
        this.status.textContent = t(result === 'verified' ? 'agentPlanVerified' : 'agentPlanApplied');
        this.finish(result);
      }
    } catch (error) {
      if (this.action === action) {
        this.status.textContent = this.abort?.signal.aborted ? t('agentStopped') : displayError(error);
        this.finish('failed');
      }
    }
  }
  private finish(state: string): void {
    const restore = this.el.contains(document.activeElement);
    this.el.dataset.state = state;
    this.el.querySelector<HTMLElement>('.agent-plan-buttons')!.hidden = true;
    this.content.hidden = this.afterLabel.hidden = true;
    this.before.parentElement!.hidden = true;
    this.title.hidden = true;
    if (restore && this.returnFocus?.isConnected) this.returnFocus.focus();
  }
  dispose(): void {
    this.hide();
    window.removeEventListener('languagechange', this.updateLanguage);
  }
}
