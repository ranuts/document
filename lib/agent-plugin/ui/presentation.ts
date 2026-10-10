import { t, getLanguage, i18n, SHELL_LOCALES } from '@ranuts/shared/i18n';

const tools = new Set([
  'get_selection',
  'get_document_text',
  'get_presentation_text',
  'get_cell',
  'get_range',
  'get_ranges',
  'insert_text',
  'replace_selection',
  'set_cell',
  'add_comment',
  'set_review_mode',
  'set_bold',
  'set_paragraph_alignment',
  'sort_range',
  'sum_range',
  'slide_action',
  'add_slide_text',
]);

function withoutReasoning(text: string): string {
  return text.replace(/^\s*<think>[\s\S]*?<\/think>\s*/, '');
}

/** Presentation only: never change the messages supplied to the model. */
export function assistantPresentation(text: string): string {
  // Reasoning is a leading protocol region, not arbitrary text inside code/examples.
  const body = withoutReasoning(text);
  if (/^\s*<think>/.test(body)) return '';
  try {
    const value = JSON.parse(body);
    const calls = Array.isArray(value) ? value : [value];
    if (
      calls.length &&
      calls.every(
        (call) =>
          call &&
          tools.has(call.name) &&
          typeof call.arguments === 'object' &&
          call.arguments !== null &&
          Object.keys(call).every((key) => ['name', 'arguments', 'id'].includes(key)),
      )
    )
      return '';
  } catch {
    /* Normal prose and fenced JSON stay visible. */
  }
  return body;
}

export function toolLabel(name: string): string {
  if (name === 'sum_range') return t('agentReadCell');
  if (name === 'sort_range') return t('agentUpdateCell');
  if (name === 'slide_action') return t('agentExecute');
  if (name === 'get_selection') return t('agentReadSelection');
  if (name === 'get_document_text' || name === 'get_presentation_text') return t('agentReadDocument');
  if (name === 'get_cell' || name === 'get_range' || name === 'get_ranges') return t('agentReadCell');
  if (name === 'set_cell') return t('agentUpdateCell');
  if (tools.has(name)) return t('agentUpdateDocument');
  return t('agentExecute');
}

/** Only known product guidance is safe to display; SDK/network errors are private. */
export function displayError(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  if (
    [
      'Local model worker failed. Reload the model to retry.',
      'Local model worker communication failed. Reload the model to retry.',
      'Local model was unloaded, possibly because GPU resources were lost. Reload to retry.',
    ].includes(text)
  )
    return t('agentLocalModelReload');
  if (text === 'The output appears to use a different language. Try another model.')
    return t('agentWritingLanguageMismatch');
  if (text === 'agentWritingCurrencyChanged') return t('agentWritingCurrencyChanged');
  if (text === 'agentSummaryNotShorter') return t('agentSummaryNotShorter');
  if (['No rewrite was proposed', 'No summary was proposed', 'No translation was proposed'].includes(text))
    return t('agentWritingUnchanged');
  if (text === 'agentContextTooLong') return t('agentContextTooLong');
  if (text === 'agentWritingNeedsLocalService') return t('agentWritingNeedsLocalService');
  if (text === 'agentWritingOfflineNeedsDevice') return t('agentWritingOfflineNeedsDevice');
  if (text === 'Writing changed or omitted source numbers; review the request') return t('agentWritingNumbersChanged');
  if (text === 'agentToolNotChosen') return t('agentToolNotChosen');
  const office: Record<string, [string, string]> = {
    officeReviewSettingsLocked: [
      '文档的修订设置已锁定，未修改。',
      'Document review settings are locked; no change was made.',
    ],
    officeSlideLiteralTextChanged: [
      '生成的文本未逐字保留，请重试；未修改文档。',
      'Generated text did not preserve the supplied text. Try again; no change was made.',
    ],
    wordTrackedSelectionUnsupported: [
      '暂无法验证此修订选区，请选择同一段内的普通文字；未修改文档。',
      'This tracked selection cannot be verified yet. Select plain text within one paragraph; no change was made.',
    ],
    officeSumFormulaSource: [
      '写入求和公式暂不支持源区域已有公式，避免间接循环引用；可以只计算总和。',
      'Writing SUM requires a source range without formulas to avoid indirect circular references. Read-only summing is still available.',
    ],
    officeInvalidRange: [
      '请指定有效的 A1 区域和区域内的排序列，最多 5,000 个单元格。',
      'Specify a valid A1 range and a sort column inside it; maximum 5,000 cells.',
    ],
    officeRangeReadTooLarge: [
      '读取内容过多，请缩小读取区域后重试。',
      'The range contains too much text. Read a smaller range and try again.',
    ],
    officeInvalidTarget: [
      '求和目标必须是源区域之外的单个单元格。',
      'The SUM destination must be a single cell outside the source range.',
    ],
    officeSpreadsheetOnly: ['请在 Excel 表格中执行此操作。', 'This operation requires a spreadsheet.'],
    officeProtectedRange: ['该区域受保护，未执行修改。', 'The range is protected; no change was made.'],
    officeMergedTarget: ['请指定未合并的单元格，未执行修改。', 'Choose an unmerged cell; no change was made.'],
    officeTargetNotEmpty: [
      '求和目标必须为空且不能合并，请指定另一个单元格。',
      'Choose an empty, unmerged destination cell for SUM.',
    ],
    officeCellError: [
      '源区域包含错误值或计算溢出，请先检查数据。',
      'Check source cell errors or numeric overflow before summing.',
    ],
    officeSortUnsupported: [
      '暂不支持对公式、合并单元格、筛选区域、格式表或透视表排序。未执行排序。',
      'Sorting formulas, merged cells, filters, formatted tables or pivot tables is not supported yet. No sort was performed.',
    ],
    officeNumericSortOnly: [
      '当前排序列必须全部为数字且没有空值，请检查排序范围。',
      'The sort key must contain only numbers, with no blank cells. Check the range.',
    ],
    officePresentationOnly: [
      '请在普通 PPT 幻灯片视图中执行此操作。',
      'Use this operation in the normal presentation slide view.',
    ],
    officeInvalidSlide: ['请指定现有幻灯片的有效页码。', 'Specify a valid existing slide number.'],
    officeSelectOneSlide: [
      '请仅选中当前一页幻灯片，再执行复制。',
      'Select exactly the current slide before duplicating it.',
    ],
  };
  if (office[text]) return office[text][getLanguage().startsWith('zh') ? 0 : 1];
  if (Object.values(office).some((messages) => messages.includes(text))) return text;
  const guidance = new Map([
    ['No free text area', t('agentSlideNoRoom')],
    ['Native paste timed out', t('agentDocumentActionTimeout')],
    ['The change could not be verified. Check the document and use Undo if needed.', t('agentPlanUnverified')],
    ['This proposal has expired. Generate a new proposal.', t('agentPlanExpired')],
    ['Document is read-only', t('agentDocumentReadOnly')],
    ['Editor is still loading', t('agentEditorLoading')],
    ['No text selection', t('agentNoSelection')],
    ['Formatting is only available in the document body', t('agentWordOnly')],
    ['Bold formatting is unavailable', t('agentWordOnly')],
    ['Paragraph formatting is unavailable', t('agentWordOnly')],
    ['Formatting could not be verified. Check the document and use Undo if needed.', t('agentPlanUnverified')],
    ['Select exactly one cell before requesting an edit', t('agentSelectCell')],
    ['Presentation edit proposals are not available yet', t('agentSlidesUnavailable')],
  ]);
  if (guidance.has(text)) return guidance.get(text)!;
  const known = [
    'agentSummaryNotShorter',
    'agentWritingUnchanged',
    'agentWritingLanguageMismatch',
    'agentLocalModelReload',
    'agentWritingNumbersChanged',
    'agentWritingCurrencyChanged',
    'agentToolNotChosen',
    'agentWordOnly',
    'agentContextTooLong',
    'agentSlideNoRoom',
    'agentDocumentActionTimeout',
    'agentPlanUnverified',
    'agentDocumentReadOnly',
    'agentEditorLoading',
    'agentSelectCell',
    'agentSlidesUnavailable',
    'agentStopped',
    'agentMaxSteps',
    'agentNeedKey',
    'agentNoSelection',
    'agentNoCompletedAnswer',
    'agentParagraphSelectionConflict',
    'agentPlanExpired',
    'agentModelQuota',
    'agentModelSourceInvalid',
    'agentModelCleanupFailed',
    'agentModelLoadFailed',
    'agentNoWebGPU',
  ] as const;
  const translations = SHELL_LOCALES.map((language) => i18n.getMessages(language));
  const key = known.find((key) => text === key || translations.some((messages) => text === messages[key]));
  return key ? t(key) : t('agentRequestFailed');
}

/** Hold ambiguous leading JSON/reasoning until safe; normal prose still streams. */
export class AssistantDisplayStream {
  private buffer = '';
  private sent = 0;
  constructor(private readonly emit: (delta: string) => void) {}
  push(delta: string): void {
    this.buffer += delta;
    const start = withoutReasoning(this.buffer).trimStart();
    if (
      /^[{[]/.test(start) ||
      ('<think>'.startsWith(start) && start.length > 0) ||
      (start.startsWith('<think>') && !start.includes('</think>'))
    )
      return;
    this.flush(assistantPresentation(this.buffer));
  }
  finish(): void {
    this.flush(assistantPresentation(this.buffer));
    this.buffer = '';
    this.sent = 0;
  }
  private flush(text: string): void {
    const delta = text.slice(this.sent);
    if (delta) this.emit(delta);
    this.sent = text.length;
  }
}
