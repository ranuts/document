/**
 * Agent chat controller — the testable core behind the UI panel.
 *
 * Holds the conversation history, drives runAgent, and emits UI-facing "turns"
 * (user / agent / tool / status / error) through a callback. The DOM panel is a thin view
 * over this; all orchestration and state logic lives here so it can be unit
 * tested with a mock provider.
 */
import {
  assistantPresentation,
  AssistantDisplayStream,
  toolLabel,
  displayError,
  isVerifiedDocumentChange,
  documentToolTurnStatus,
  documentTaskStopText,
  documentTaskFailureText,
} from './presentation';
import { t } from '@ranuts/shared/i18n';
import { runAgent } from '@ranuts/agent-core/runtime';
import type { HistoryStorage } from './storage';
import type { RequestTiming } from './request-timing';
import type { AgentTool } from '@ranuts/agent-core/types';
import type { LLMMessage, LLMProvider, LLMResponse } from '@ranuts/agent-core/llm/types';

export interface ChatTurn {
  role: 'user' | 'agent' | 'tool' | 'status' | 'error';
  text: string;
  interrupted?: true;
  /** Text-only result; no host write action may be reconstructed. */
  copyOnly?: true;
  documentArtifact?: true;
}

export interface AgentChatControllerOptions {
  onUsage?: (usage: NonNullable<LLMResponse['usage']>) => void;
  tools?: Record<string, AgentTool>;
  /** Capture a fresh tool scope once at the start of each run. */
  getTools?: () => Record<string, AgentTool>;
  /** Host capability preflight; a reply ends the turn before model/tool execution. */
  prepareRun?: (request: string, signal: AbortSignal) => Promise<{ tools: Record<string, AgentTool>; reply?: string }>;
  maxIterations?: number;
  /** Called with each streamed assistant text delta (live-render the bubble). */
  onAgentDelta?: (delta: string) => void;
  /** Called when a streamed assistant turn completes (close the live bubble). */
  onAgentStreamEnd?: () => void;
  /** Persist/restore conversation history across reloads. */
  storage?: HistoryStorage;
  onContextTrimmed?: () => void;
  getRequestContext?: () => string | undefined;
  assertCurrent?: () => void;
}

export interface TurnRequest {
  prepareRun?: AgentChatControllerOptions['prepareRun'];
  reply?: string;
  maxIterations?: number;
  tools: Record<string, AgentTool>;
  getRequestContext(): string | undefined;
  assertCurrent(): void;
}

export interface TurnResult {
  turnId: string;
  status: 'success' | 'stopped' | 'failed' | 'limited' | 'review-pending' | 'superseded';
}

interface ActiveRun {
  abort: AbortController;
  externalMessages: LLMMessage[];
  timing?: RequestTiming;
}

export class AgentChatController {
  private history: LLMMessage[] = [];
  private activeRun: ActiveRun | null = null;

  constructor(
    private readonly provider: LLMProvider,
    private readonly onTurn: (turn: ChatTurn) => void,
    private readonly options: AgentChatControllerOptions = {},
  ) {
    // Restore prior conversation so a rebuilt controller (provider switch) or a
    // page reload continues with the model's full context.
    this.history = [...(options.storage?.load() ?? [])];
  }

  /** Whether a run is currently in progress (submission is unavailable). */
  isRunning(): boolean {
    return this.activeRun !== null;
  }

  /** Record verified host operations without invoking a language model. */
  recordExternalMessages(messages: LLMMessage[]): void {
    this.activeRun?.externalMessages.push(...messages);
    this.history.push(...messages);
    this.options.storage?.save(this.history);
  }

  /** Send a user instruction and run the agent loop, emitting turns as it goes. */
  async send(
    userText: string,
    presentation: { echoUser?: boolean; request?: TurnRequest; timing?: RequestTiming } = {},
  ): Promise<TurnResult> {
    const request = presentation.request;
    const assertCurrent = request?.assertCurrent ?? this.options.assertCurrent;
    const turnId = crypto.randomUUID();
    const text = userText.trim();
    if (!text || this.activeRun) return { turnId, status: this.activeRun ? 'superseded' : 'failed' };

    const run: ActiveRun = { abort: new AbortController(), externalMessages: [], timing: presentation.timing };
    this.activeRun = run;
    const current = () => this.activeRun === run;
    const live = () => current() && !run.abort.signal.aborted;
    const outcome = (status: TurnResult['status']): TurnResult => ({
      turnId,
      status: current() ? status : 'superseded',
    });
    const assertLive = () => {
      if (!live()) throw new DOMException('Turn no longer active', 'AbortError');
    };
    const saveHistory = () => {
      if (current()) this.options.storage?.save(this.history);
    };
    const emitTurn = (turn: ChatTurn) => {
      if (current()) this.onTurn(turn);
    };
    const priorHistory = [...this.history];
    let visibleAnswer = false;
    let documentOutcome: 'success' | 'stopped' | 'failed' | undefined;
    let toolFailed = false;
    let verifiedChanges = 0;
    let interruptedText = '';
    const saveStoppedTurn = () => {
      if (!current()) return;
      if (interruptedText) this.history.push({ role: 'assistant', content: interruptedText, interrupted: true });
      const status = { role: 'assistant' as const, content: t('agentStopped'), hostGuidance: 'status' as const };
      this.history.push(status);
      saveHistory();
      emitTurn({ role: 'status', text: status.content });
    };
    const emitDelta = (delta: string) => {
      if (!live()) return;
      if (delta) run.timing?.filteredText();
      visibleAnswer = true;
      if (this.options.onAgentDelta) {
        interruptedText += delta;
        this.options.onAgentDelta(delta);
      }
    };
    let displayStream = new AssistantDisplayStream(emitDelta);
    const resetSegment = () => {
      interruptedText = '';
      displayStream = new AssistantDisplayStream(emitDelta);
    };
    try {
      this.history.push({ role: 'user', content: text });
      saveHistory();
      assertLive();
      if (presentation.echoUser !== false) emitTurn({ role: 'user', text });
      assertLive();
      assertCurrent?.();
      const prepare = request ? request.prepareRun : this.options.prepareRun;
      const prepared = prepare ? await prepare(text, run.abort.signal) : request;
      if (!current()) return outcome('superseded');
      if (run.abort.signal.aborted) {
        saveStoppedTurn();
        return outcome('stopped');
      }
      assertCurrent?.();
      assertLive();
      if (prepared?.reply) {
        const receipt = { role: 'assistant' as const, content: prepared.reply, hostGuidance: 'tool' as const };
        this.history.push(receipt);
        saveHistory();
        emitTurn({ role: 'tool', text: prepared.reply });
        return outcome('failed');
      }
      const tools = prepared?.tools ?? request?.tools ?? this.options.getTools?.() ?? this.options.tools;
      assertLive();
      assertCurrent?.();
      const requestContext = (request?.getRequestContext ?? this.options.getRequestContext)?.();
      assertCurrent?.();
      assertLive();
      const result = await runAgent(this.provider, text, {
        tools,
        onFirstProviderText: () => {
          if (live()) run.timing?.providerText();
        },
        maxIterations: request?.maxIterations ?? this.options.maxIterations,
        history: priorHistory,
        onContextTrimmed: () => {
          if (live()) this.options.onContextTrimmed?.();
        },
        onToolExchange: (messages) => {
          if (!current()) return;
          resetSegment();
          this.history = [...messages, ...run.externalMessages];
          saveHistory();
        },
        requestContext,
        assertCurrent: () => {
          assertLive();
          assertCurrent?.();
        },
        signal: run.abort.signal,
        onEvent: (event) => {
          if (!live()) return;
          if (event.type === 'usage') {
            run.timing?.usage(event.usage);
            this.options.onUsage?.(event.usage);
          } else if (event.type === 'assistant_delta') {
            assertCurrent?.();
            displayStream.push(event.text);
          } else if (event.type === 'tool_call') {
            resetSegment();
            emitTurn({ role: 'tool', text: toolLabel(event.name) });
          } else if (event.type === 'tool_result') {
            const status = documentToolTurnStatus(event);
            if (status) documentOutcome = status;
            if (isVerifiedDocumentChange(event)) verifiedChanges++;
            if (event.isError) toolFailed = true;
            if (event.isError && !event.limitReason) emitTurn({ role: 'error', text: displayError(event.content) });
          } else if (event.type === 'assistant') {
            assertCurrent?.();
            // A streamed turn was already rendered via deltas — just close the
            // live bubble. Without a delta handler wired, fall back to emitting
            // the whole turn so the text is never lost.
            if (event.streamed && this.options.onAgentDelta) {
              displayStream.finish();
              if (!live()) return;
              this.options.onAgentStreamEnd?.();
            } else if (event.text) {
              const text = assistantPresentation(event.text);
              if (text) {
                run.timing?.filteredText();
                visibleAnswer = true;
                emitTurn({ role: 'agent', text });
              }
            }
            resetSegment();
          }
        },
      });
      if (!current()) return outcome('superseded');
      assertCurrent?.();
      this.history = [...result.messages, ...run.externalMessages];
      run.externalMessages = [];
      saveHistory();
      if (result.aborted || run.abort.signal.aborted) {
        saveStoppedTurn();
        return outcome('stopped');
      } else if (result.stoppedOnLimit) {
        const text = documentTaskStopText(result.limitReason, verifiedChanges);
        const receipt = { role: 'assistant' as const, content: text, hostGuidance: 'tool' as const };
        this.history.push(receipt);
        saveHistory();
        emitTurn({ role: 'tool', text });
        return outcome('limited');
      } else if (documentOutcome === 'stopped' || documentOutcome === 'failed') {
        return outcome(documentOutcome);
      } else if (!visibleAnswer && !result.completedByTool && documentOutcome !== 'success') {
        emitTurn({ role: 'error', text: t('agentRequestFailed') });
        return outcome('failed');
      }
      return outcome(toolFailed ? 'failed' : 'success');
    } catch (error) {
      if (current()) {
        if (run.abort.signal.aborted) {
          saveStoppedTurn();
          return outcome('stopped');
        } else {
          const guidance = documentTaskFailureText(error, verifiedChanges);
          if (interruptedText || verifiedChanges > 0) {
            const failure = { role: 'assistant' as const, content: guidance, hostGuidance: 'error' as const };
            if (interruptedText) this.history.push({ role: 'assistant', content: interruptedText, interrupted: true });
            this.history.push(failure);
            saveHistory();
          }
          emitTurn({ role: 'error', text: guidance });
          return outcome('failed');
        }
      }
      return outcome('superseded');
    } finally {
      if (current()) this.activeRun = null;
    }
  }

  /** Abort cooperatively once; the run stays active until its host promise settles. */
  stop(): void {
    if (this.activeRun && !this.activeRun.abort.signal.aborted) {
      this.activeRun.timing?.cancel('stopped');
      this.activeRun.abort.abort();
    }
  }

  /** Detach pending output and persistence when switching providers. Keeps stored history. */
  dispose(): void {
    this.activeRun?.timing?.cancel('superseded');
    this.stop();
    this.activeRun = null;
  }

  /** Clear the conversation history (and its persisted copy). */
  reset(): void {
    this.dispose();
    this.history = [];
    this.options.storage?.clear();
  }
}
