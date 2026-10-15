import { ButtonBuilder, Div, Span, View } from 'ranui/builder';
import { t, getLanguage } from '@ranuts/shared/i18n';
import { WRITING_LANGUAGES, type WritingLanguage } from '@ranuts/agent-core/llm/writing-task';
import type { ComposerContext } from './composer-context';
import type { DocumentToolTarget } from '../document-tool-action';
import type { RequestIntent } from './request-intent';
import type { RequestSourceScope } from './request-context';
export interface HostReadTask {
  readonly taskId: string;
  readonly scope: Exclude<RequestSourceScope, 'metadata'>;
}
export interface StagedRequestIntent extends RequestIntent {
  readonly hostRead?: HostReadTask;
}
const hostReads = new WeakMap<
  HostReadTask,
  { target: DocumentToolTarget; current(): boolean; snapshotCurrent(): boolean; revoked: boolean }
>();
/** Trust survives consumption by reference, never serialization or reconstruction. */
export function isCurrentHostRead(task: HostReadTask | undefined): task is HostReadTask {
  const record = task && hostReads.get(task);
  return !!record && !record.revoked && record.current();
}
export function revokeHostRead(task: HostReadTask | undefined): void {
  const record = task && hostReads.get(task);
  if (record) record.revoked = true;
}
export function hostReadTarget(task: HostReadTask): DocumentToolTarget {
  if (!isCurrentHostRead(task) || !hostReads.get(task)!.snapshotCurrent()) throw new Error('agentPlanExpired');
  return hostReads.get(task)!.target;
}
function readScope(id: string, snapshot: ComposerContext): HostReadTask['scope'] | undefined {
  if (!['read', 'explain', 'analyze', 'slides', 'outline', 'page', 'points', 'summarize'].includes(id)) return;
  if (snapshot.context?.kind === 'pdf') return 'pdf-page';
  if (['summarize', 'analyze'].includes(id) || (id === 'explain' && !!snapshot.text.trim())) return 'selection';
  return 'document';
}

interface Task {
  id: string;
  label: Parameters<typeof t>[0];
  prompt: Parameters<typeof t>[0];
  task: RequestIntent['task'];
}
const polish: Task = { id: 'polish', label: 'agentEntryPolish', prompt: 'agentEntryPolishPrompt', task: 'rewrite' };
const summarize: Task = {
  id: 'summarize',
  label: 'agentEntrySummarize',
  prompt: 'agentEntrySummarizePrompt',
  task: 'summarize',
};
const compose: Task = { id: 'compose', label: 'agentEntryCompose', prompt: 'agentEntryComposePrompt', task: 'compose' };
const read: Task = { id: 'read', label: 'agentEntryRead', prompt: 'agentEntryReadPrompt', task: 'tools' };
const explain: Task = { id: 'explain', label: 'agentEntryExplain', prompt: 'agentEntryExplainPrompt', task: 'tools' };
const page: Task = { id: 'page', label: 'agentEntryPage', prompt: 'agentEntryPagePrompt', task: 'chat' };
const points: Task = { id: 'points', label: 'agentEntryPoints', prompt: 'agentEntryPointsPrompt', task: 'chat' };
const analyze: Task = { id: 'analyze', label: 'agentEntryAnalyze', prompt: 'agentEntryAnalyzePrompt', task: 'tools' };
const outline: Task = { id: 'outline', label: 'agentEntryOutline', prompt: 'agentEntryOutlinePrompt', task: 'chat' };
const slides: Task = { id: 'slides', label: 'agentEntrySlides', prompt: 'agentEntrySlidesPrompt', task: 'tools' };
/** Host-owned provenance. Clicking only stages a draft; explicit Send owns execution. */
export function createTaskEntry(options: {
  getInput(): string;
  setInput(text: string): void;
  focus(): void;
  session(): string;
  readonly(): boolean;
  capture(): ComposerContext;
  captureTarget(): DocumentToolTarget;
  onStage(intent: StagedRequestIntent): void;
}) {
  const el = View('section').class('agent-task-entry').build();
  const scope = Span().class('agent-task-scope').build();
  const tasks = Div().class('agent-task-list').build();
  const help = View('p').class('agent-task-help').attr('role', 'status').build();
  el.append(scope, tasks, help);
  let staged: {
    text: string;
    intent: StagedRequestIntent;
    session: string;
    snapshot: string;
    target: DocumentToolTarget;
    readonly: boolean;
  } | null = null;
  let signature = '';
  const fingerprint = (snapshot: ComposerContext) => JSON.stringify(snapshot);
  const fresh = (snapshot?: ComposerContext) =>
    !!staged &&
    staged.session === options.session() &&
    staged.readonly === options.readonly() &&
    staged.target.isCurrent(false) &&
    staged.snapshot === fingerprint(snapshot ?? options.capture());
  const inputChanged = (text: string) => {
    if (staged && staged.text !== text) {
      revokeHostRead(staged.intent.hostRead);
      staged = null;
    }
  };
  const check = (text: string) => {
    inputChanged(text);
    if (!staged) return true;
    if (fresh()) return true;
    help.textContent = t('agentEntryChanged');
    return false;
  };
  const consume = (text: string): StagedRequestIntent | null => {
    inputChanged(text);
    const intent = staged && fresh() ? staged.intent : null;
    if (!intent) revokeHostRead(staged?.intent.hostRead);
    staged = null;
    return intent;
  };
  const eligible = (snapshot: ComposerContext, readonly: boolean): Task[] => {
    const context = snapshot.context;
    const selected = !!snapshot.text.trim() && !snapshot.truncated;
    return !context
      ? []
      : snapshot.truncated
        ? [read, explain]
        : context.kind === 'pdf'
          ? [page, points]
          : context.kind === 'cell'
            ? selected
              ? [analyze, summarize, explain]
              : [read, explain]
            : context.kind === 'slide'
              ? selected && !readonly
                ? [polish, summarize, slides]
                : [slides, outline]
              : selected
                ? readonly
                  ? [summarize, explain]
                  : [polish, summarize, explain]
                : readonly
                  ? [read, explain]
                  : [compose, read, explain];
  };
  const update = (snapshot: ComposerContext) => {
    const context = snapshot.context;
    const selected = !!snapshot.text.trim() && !snapshot.truncated;
    const readonly = options.readonly();
    scope.textContent =
      context?.kind === 'cell'
        ? `${context.sheet ?? 'Excel'} · ${context.range ?? t('agentCurrentDocument')}`
        : context?.kind === 'slide'
          ? t('agentSlideContext', { page: context.page ?? '—' })
          : context?.kind === 'pdf'
            ? t('agentEntryPdfScope', { page: context.page ?? '—' })
            : selected
              ? t('agentSelectionContext', { count: snapshot.text.length })
              : t('agentCurrentDocument');
    const items = eligible(snapshot, readonly);
    const next = JSON.stringify([items.map((item) => item.id), getLanguage()]);
    if (next !== signature) {
      signature = next;
      tasks.replaceChildren(
        ...items.map((item) => {
          const button = ButtonBuilder()
            .attr('type', 'button')
            .attr('data-task', item.id)
            .class('agent-task-action')
            .text(t(item.label))
            .build();
          button.addEventListener('click', () => {
            if (options.getInput().trim()) {
              help.textContent = t('agentEntryDraftPresent');
              options.focus();
              return;
            }
            const snapshot = options.capture();
            if (!eligible(snapshot, options.readonly()).some((task) => task.id === item.id)) {
              update(snapshot);
              help.textContent = t('agentEntryChanged');
              return;
            }
            try {
              const target = options.captureTarget();
              const shellLanguage = getLanguage();
              const locale = shellLanguage === 'zh' ? 'zh-CN' : shellLanguage;
              const language = (
                WRITING_LANGUAGES.includes(locale as WritingLanguage) ? locale : 'en'
              ) as WritingLanguage;
              const session = options.session();
              const readonly = options.readonly();
              const snapshotKey = fingerprint(snapshot);
              const source = readScope(item.id, snapshot);
              const hostRead = source ? Object.freeze({ taskId: item.id, scope: source }) : undefined;
              if (hostRead)
                hostReads.set(hostRead, {
                  target,
                  revoked: false,
                  current: () =>
                    options.session() === session && options.readonly() === readonly && target.isCurrent(false),
                  snapshotCurrent: () => fingerprint(options.capture()) === snapshotKey,
                });
              const intent: StagedRequestIntent = Object.freeze({
                task: item.task,
                language,
                ...(hostRead ? { hostRead } : {}),
              });
              const text = t(item.prompt);
              options.setInput(text);
              staged = {
                text,
                intent,
                session: options.session(),
                snapshot: fingerprint(snapshot),
                target,
                readonly: options.readonly(),
              };
              options.onStage(intent);
              help.textContent = t('agentEntryStaging');
              options.focus();
            } catch {
              help.textContent = t('agentEditorLoading');
            }
          });
          return button;
        }),
      );
    }
    help.textContent =
      staged && !fresh(snapshot)
        ? t('agentEntryChanged')
        : !context
          ? t('agentEditorLoading')
          : snapshot.truncated
            ? t('agentEntrySmaller')
            : readonly
              ? t('agentEntryReadOnly')
              : t('agentEntryStaging');
  };
  return { el, update, inputChanged, check, consume };
}
