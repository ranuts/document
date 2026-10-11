import { Div, Span, View } from 'ranui/builder';
import { t } from '@ranuts/shared/i18n';
import { displayError } from './presentation';
import { buildSeries, type SeriesInput } from '../fill-series';
import { textDifference, type ChangeReview } from './change-review';
export interface PreviewAction {
  target: {
    label: string;
    selectedText: string;
    reviewText?: string;
    editor?: string;
    context?: { kind: string; sheet?: string; page?: number };
  };
  plan: { tool: string; input: Readonly<Record<string, unknown>> };
  isCurrent(): boolean;
  cancel(): void;
  apply(signal?: AbortSignal): Promise<'sent' | 'verified'>;
  readonly review?: ChangeReview;
  readonly result?: unknown;
  revise?(text: string): PreviewAction;
}

/** Transient, text-only preview. Proposed actions are never persisted/replayed. */
export class ActionPreview {
  readonly el = Div().class('agent-plan-preview').attr('role', 'region').attr('tabindex', '-1').build();
  private readonly title = Span().build();
  private readonly target = Span().class('agent-plan-target').build();
  private readonly beforeLabel = Span().build();
  private readonly before = View('pre').class('agent-plan-before').build();
  private readonly afterLabel = Span().build();
  private readonly content = View('pre').class('agent-plan-content').build();
  private readonly status = Span().class('agent-plan-status').attr('role', 'status').build();
  private readonly applyButton = View('r-button').attr('type', 'primary').class('agent-plan-apply').build();
  private readonly copyButton = View('r-button').attr('type', 'text').class('agent-plan-copy').build();
  private readonly cancelButton = View('r-button').attr('type', 'text').class('agent-plan-cancel').build();
  private readonly editButton = View('r-button').attr('type', 'text').class('agent-plan-edit').build();
  private readonly refineButton = View('r-button').attr('type', 'text').class('agent-plan-refine').build();
  private readonly draft = document.createElement('textarea');
  private readonly saveButton = View('r-button').attr('type', 'primary').class('agent-plan-save').build();
  private readonly discardButton = View('r-button').attr('type', 'text').class('agent-plan-discard').build();
  private readonly editor = Div().class('agent-plan-editor').build();
  private readonly comparison = Div().class('agent-plan-comparison').build();
  private readonly record = document.createElement('details');
  private action: PreviewAction | null = null;
  private settled = false;
  private refining = false;
  private returnFocus?: HTMLElement;
  private abort?: AbortController;
  private onApplied?: (outcome: 'sent' | 'verified', action: PreviewAction) => void;
  private onRefine?: (action: PreviewAction) => void;
  private timer?: ReturnType<typeof setInterval>;
  private readonly updateLanguage = () => {
    this.labels();
    if (this.action && !this.settled && this.editor.hidden) this.renderComparison(this.action.review);
  };
  constructor() {
    this.draft.className = 'agent-plan-draft';
    this.draft.maxLength = 8000;
    this.editor.hidden = true;
    this.editor.append(
      this.draft,
      Div().class('agent-plan-buttons').children(this.saveButton, this.discardButton).build(),
    );
    this.record.className = 'agent-plan-record';
    this.record.hidden = true;
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
      this.comparison,
      this.editor,
      this.record,
      this.status,
      Div()
        .class('agent-plan-buttons agent-plan-primary-buttons')
        .children([this.applyButton, this.editButton, this.refineButton, this.copyButton, this.cancelButton])
        .build(),
    );
    this.applyButton.addEventListener('click', () => void this.apply());
    this.cancelButton.addEventListener('click', () => this.hide());
    this.copyButton.addEventListener('click', () => {
      void this.copy();
    });
    this.editButton.addEventListener('click', () => this.edit());
    this.refineButton.addEventListener('click', () => {
      const action = this.pending();
      if (action && !this.refining) this.onRefine?.(action);
    });
    this.saveButton.addEventListener('click', () => this.save());
    this.discardButton.addEventListener('click', () => this.discard());
    this.draft.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        this.discard();
      }
    });
    window.addEventListener('languagechange', this.updateLanguage);
    this.labels();
  }
  private labels(): void {
    this.title.textContent = t(
      this.action?.plan.tool === 'add_pdf_comment'
        ? 'agentAddPdfComment'
        : this.action?.plan.tool === 'clear_document'
          ? 'agentClearDocument'
          : 'agentPlanTitle',
    );
    this.el.setAttribute('aria-label', this.title.textContent);
    this.beforeLabel.textContent = t(
      this.action?.review?.kind === 'text' && this.action.review.anchor ? 'agentSelectionAnchor' : 'agentPlanBefore',
    );
    this.afterLabel.textContent = t('agentPlanAfter');
    this.applyButton.textContent = t(
      this.action?.plan.tool === 'add_pdf_comment'
        ? 'agentAddPdfComment'
        : this.action?.plan.tool === 'clear_document'
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
    this.editButton.textContent = t('agentEditProposal');
    this.refineButton.textContent = t('agentRefineProposal');
    this.saveButton.textContent = t('agentSaveProposal');
    this.discardButton.textContent = t('agentDiscardProposal');
    this.draft.setAttribute('aria-label', t('agentEditProposal'));
    const summary = this.record.querySelector('summary');
    if (summary) summary.textContent = t('agentViewChanges');
    const action = this.action;
    if (action) {
      const context = action.target.context;
      if (action.plan.tool === 'clear_document') {
        this.target.textContent = t('agentCurrentDocument');
        return;
      }
      if (context?.kind === 'cell') {
        const range =
          action.plan.tool === 'fill_series'
            ? buildSeries(action.plan.input as unknown as SeriesInput).range
            : (action.plan.input.range ?? action.plan.input.cell);
        const destination = action.plan.tool === 'sum_range' ? action.plan.input.target : undefined;
        this.target.textContent =
          [context.sheet, range ? `${range}${destination ? ` → ${destination}` : ''}` : undefined]
            .filter(Boolean)
            .join(' · ') || t('agentCurrentDocument');
        return;
      }
      if (context?.kind === 'pdf') {
        this.target.textContent = t('agentPdfPageContext', {
          page: String(action.plan.input.page ?? context.page ?? ''),
        });
        return;
      }
      if (context?.kind === 'slide') {
        const page =
          context.page === undefined ? t('agentCurrentDocument') : t('agentSlideContext', { page: context.page });
        this.target.textContent = [
          page,
          action.target.selectedText
            ? t(action.plan.tool === 'replace_selection' ? 'agentPlanSelection' : 'agentSelectionAnchor')
            : undefined,
        ]
          .filter(Boolean)
          .join(' · ');
        return;
      }
      this.target.textContent = `${context?.kind === 'word' || action.target.editor === 'word' ? t('agentCurrentDocument') : action.target.label} · ${
        action.plan.tool === 'clear_document'
          ? t('agentCurrentDocument')
          : action.plan.tool === 'fill_series'
            ? buildSeries(action.plan.input as unknown as SeriesInput).range
            : action.plan.tool === 'set_cell'
              ? action.plan.input.cell
              : ['add_comment', 'add_slide_text', 'add_pdf_comment'].includes(action.plan.tool)
                ? t(action.target.selectedText ? 'agentSelectionAnchor' : 'agentCurrentDocument')
                : t(action.target.selectedText ? 'agentPlanSelection' : 'agentPlanCursor')
      }`;
    }
  }
  show(
    action: PreviewAction,
    onApplied?: (outcome: 'sent' | 'verified', action: PreviewAction) => void,
    onRefine?: (action: PreviewAction) => void,
  ): void {
    this.hide();
    this.action = action;
    this.returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
    this.abort = new AbortController();
    this.onApplied = onApplied;
    this.onRefine = onRefine;
    this.refineButton.hidden = !onRefine;
    this.settled = false;
    this.refining = false;
    for (const button of [this.editButton, this.refineButton, this.saveButton]) button.removeAttribute('disabled');
    this.el.dataset.state = 'pending';
    this.el.removeAttribute('aria-busy');
    this.title.hidden = false;
    this.el.querySelector<HTMLElement>('.agent-plan-primary-buttons')!.hidden = false;
    this.editor.hidden = true;
    this.draft.hidden = false;
    this.draft.disabled = false;
    this.editor.querySelector<HTMLElement>('.agent-plan-buttons')!.hidden = false;
    this.record.hidden = true;
    this.record.open = false;
    this.record.replaceChildren();
    this.content.hidden = this.afterLabel.hidden = false;
    this.copyButton.hidden = action.plan.tool === 'clear_document';
    this.el.hidden = false;
    const original = action.plan.tool === 'clear_document' ? action.target.reviewText : action.target.selectedText;
    this.before.textContent = original?.slice(0, 8000) ?? '';
    this.before.hidden = this.beforeLabel.hidden = !original;
    this.before.parentElement!.hidden = !original;
    this.content.textContent = String(
      action.plan.tool === 'slide_action'
        ? action.plan.input.action === 'add'
          ? t('agentReviewAddSlide')
          : action.plan.input.action === 'duplicate'
            ? t('agentReviewDuplicateSlide')
            : t('agentSlideContext', { page: String(action.plan.input.page ?? '') })
        : action.plan.tool === 'clear_document'
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
    this.editButton.hidden =
      !action.revise ||
      !['insert_text', 'replace_selection', 'add_slide_text', 'add_comment', 'add_pdf_comment'].includes(
        action.plan.tool,
      );
    this.renderComparison(action.review);
    this.applyButton.removeAttribute('disabled');
    this.labels();
    this.timer = setInterval(() => {
      if (!action.isCurrent()) this.invalidate();
    }, 500);
  }
  /** Only a live pending proposal can be used as unexecuted refinement context. */
  pending(): PreviewAction | undefined {
    return !this.settled && this.action?.isCurrent() ? this.action : undefined;
  }
  /** Retain the original permission while a candidate revision is generated. */
  setRefining(value: boolean): void {
    this.refining = value;
    if (this.settled || !this.action) return;
    if (!this.action.isCurrent()) {
      this.invalidate();
      return;
    }
    this.el.toggleAttribute('aria-busy', value);
    if (value) this.el.setAttribute('aria-busy', 'true');
    for (const button of [this.applyButton, this.editButton, this.refineButton, this.saveButton])
      button.toggleAttribute('disabled', value);
    this.draft.disabled = value;
  }
  private renderComparison(review?: ChangeReview): void {
    this.comparison.replaceChildren();
    this.comparison.hidden = !review;
    if (!review) return;
    if (review.kind === 'cells') {
      const table = document.createElement('table');
      const caption = document.createElement('caption');
      caption.textContent = t('agentCellImpact').replace('{count}', String(review.total));
      table.append(caption);
      const head = table.createTHead().insertRow();
      for (const text of [t('agentReviewCell'), t('agentPlanBefore'), t('agentPlanAfter')]) {
        const th = document.createElement('th');
        th.scope = 'col';
        th.textContent = text;
        head.append(th);
      }
      const body = table.createTBody();
      for (const change of review.rows) {
        const row = body.insertRow();
        const th = document.createElement('th');
        th.scope = 'row';
        th.textContent = change.address;
        row.append(th);
        const before = row.insertCell();
        before.textContent = change.before || t('agentEmptyCell');
        if (change.formula) {
          const formula = document.createElement('code');
          formula.textContent = `${t('agentReviewFormula')}: ${change.formula}`;
          before.append(document.createElement('br'), formula);
        }
        row.insertCell().textContent = change.after || t('agentEmptyCell');
      }
      this.comparison.append(table);
      if (review.sampled) {
        const note = document.createElement('p');
        note.textContent = t('agentReviewSample');
        this.comparison.append(note);
      }
      this.content.hidden = this.afterLabel.hidden = true;
      this.before.parentElement!.hidden = true;
    } else {
      const diff = textDifference(review.before.slice(0, 8000), review.after.slice(0, 8000));
      const pre = document.createElement('pre');
      pre.className = 'agent-plan-diff';
      pre.append(document.createTextNode(diff.prefix));
      for (const [tag, value, label] of [
        ['del', diff.removed, t('agentRemoved')],
        ['ins', diff.added, t('agentAdded')],
      ]) {
        if (!value) continue;
        const mark = document.createElement(tag);
        mark.append(document.createTextNode(`${label}: ${value}`));
        pre.append(mark);
      }
      pre.append(document.createTextNode(diff.suffix));
      this.comparison.append(pre);
      if (review.before.length > 8000 || review.after.length > 8000) {
        const note = document.createElement('p');
        note.textContent = t('agentReviewSample');
        this.comparison.append(note);
      }
      // Additions retain a separate selection anchor; they never imply deletion.
      if (review.anchor) this.before.textContent = review.anchor.slice(0, 8000);
      this.before.parentElement!.hidden = !review.anchor;
      this.content.hidden = this.afterLabel.hidden = true;
    }
  }
  private edit(): void {
    if (this.refining || !this.pending() || !this.action?.revise || this.editButton.hidden) return;
    this.draft.value = String(this.action.plan.input.text ?? '');
    this.editor.hidden = false;
    this.comparison.hidden = true;
    this.el.querySelector<HTMLElement>('.agent-plan-primary-buttons')!.hidden = true;
    this.draft.focus();
  }
  private discard(): void {
    this.editor.hidden = true;
    this.comparison.hidden = !this.action?.review;
    this.el.querySelector<HTMLElement>('.agent-plan-primary-buttons')!.hidden = this.settled;
    if (!this.settled) this.focusReview();
  }
  private save(): void {
    if (!this.action?.revise || this.settled || this.refining) return;
    if (!this.action.isCurrent()) {
      this.invalidate();
      return;
    }
    try {
      const replacement = this.action.revise(this.draft.value);
      this.show(replacement, this.onApplied, this.onRefine);
      this.focusReview();
    } catch (error) {
      this.status.textContent = displayError(error);
      this.draft.focus();
    }
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
  /** A successful refinement replaces the prior inert record; it never revives permission. */
  supersede(): void {
    if (!this.action || !['pending', 'expired'].includes(this.el.dataset.state ?? '')) return;
    this.invalidate();
    this.el.dataset.state = 'superseded';
    this.status.textContent = t('agentPlanSuperseded');
  }
  private focusReview(): void {
    // r-button's closed shadow root has no public imperative focus API. Return
    // focus to the named review group so the next Tab reaches its controls.
    this.el.focus();
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
    if (!this.action || this.settled || this.refining) return;
    const action = this.action;
    this.settled = true;
    clearInterval(this.timer);
    this.applyButton.setAttribute('disabled', '');
    this.el.dataset.state = 'applying';
    this.el.setAttribute('aria-busy', 'true');
    this.editButton.hidden = this.refineButton.hidden = true;
    this.copyButton.hidden = true;
    this.status.textContent = t('agentPlanApplying');
    this.labels();
    try {
      const result = await action.apply(this.abort?.signal);
      if (this.action === action && !this.abort?.signal.aborted) {
        this.onApplied?.(result, action);
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
    this.el.removeAttribute('aria-busy');
    this.el.querySelector<HTMLElement>('.agent-plan-primary-buttons')!.hidden = true;
    this.editor.hidden = true;
    this.editor.querySelector<HTMLElement>('.agent-plan-buttons')!.hidden = true;
    this.record.replaceChildren();
    const summary = document.createElement('summary');
    summary.textContent = t('agentViewChanges');
    this.record.append(summary);
    if (this.comparison.childNodes.length) {
      const comparison = this.comparison.cloneNode(true) as HTMLElement;
      comparison.hidden = false;
      this.record.append(comparison);
      if (this.action?.review?.kind === 'text' && this.action.review.anchor) {
        const anchor = document.createElement('p');
        anchor.textContent = `${t('agentSelectionAnchor')}: ${this.action.review.anchor.slice(0, 8000)}`;
        this.record.append(anchor);
      }
    } else {
      for (const [label, value] of [
        [t('agentPlanBefore'), this.before.textContent],
        [t('agentPlanAfter'), this.content.textContent],
      ]) {
        const heading = document.createElement('p');
        heading.textContent = label;
        const pre = document.createElement('pre');
        pre.textContent = value;
        this.record.append(heading, pre);
      }
    }
    this.record.hidden = false;
    this.comparison.hidden = true;
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
