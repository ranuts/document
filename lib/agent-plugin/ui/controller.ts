/**
 * Agent chat controller — the testable core behind the UI panel.
 *
 * Holds the conversation history, drives runAgent, and emits UI-facing "turns"
 * (user / agent / tool / status / error) through a callback. The DOM panel is a thin view
 * over this; all orchestration and state logic lives here so it can be unit
 * tested with a mock provider.
 */
import { assistantPresentation, AssistantDisplayStream, toolLabel, displayError } from './presentation';
import { t } from '@ranuts/shared/i18n';
import { runAgent } from '@ranuts/agent-core/runtime';
import type { HistoryStorage } from './storage';
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
  maxIterations?: number;
  /** Called with each streamed assistant text delta (live-render the bubble). */
  onAgentDelta?: (delta: string) => void;
  /** Called when a streamed assistant turn completes (close the live bubble). */
  onAgentStreamEnd?: () => void;
  /** Persist/restore conversation history across reloads. */
  storage?: HistoryStorage;
  onContextTrimmed?: () => void;
  getRequestContext?: () => string | undefined;
}

export class AgentChatController {
  private history: LLMMessage[] = [];
  private externalMessages: LLMMessage[] = [];
  private running = false;
  private revision = 0;
  private abortController: AbortController | null = null;

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
    return this.running;
  }

  /** Record verified host operations without invoking a language model. */
  recordExternalMessages(messages: LLMMessage[]): void {
    if (this.running) this.externalMessages.push(...messages);
    this.history.push(...messages);
    this.options.storage?.save(this.history);
  }

  /** Send a user instruction and run the agent loop, emitting turns as it goes. */
  async send(userText: string): Promise<void> {
    const text = userText.trim();
    if (!text || this.running) return;

    this.running = true;
    const revision = this.revision;
    this.abortController = new AbortController();
    const priorHistory = [...this.history];
    this.history.push({ role: 'user', content: text });
    this.options.storage?.save(this.history);
    this.onTurn({ role: 'user', text });
    let visibleAnswer = false;
    let calledTool = false;
    let interruptedText = '';
    const saveStoppedTurn = () => {
      if (interruptedText) this.history.push({ role: 'assistant', content: interruptedText, interrupted: true });
      const status = { role: 'assistant' as const, content: t('agentStopped'), hostGuidance: 'status' as const };
      this.history.push(status);
      this.options.storage?.save(this.history);
      this.onTurn({ role: 'status', text: status.content });
    };
    const emitDelta = (delta: string) => {
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
      const result = await runAgent(this.provider, text, {
        tools: this.options.getTools?.() ?? this.options.tools,
        maxIterations: this.options.maxIterations,
        history: priorHistory,
        onContextTrimmed: this.options.onContextTrimmed,
        onToolExchange: (messages) => {
          if (revision !== this.revision) return;
          resetSegment();
          this.history = [...messages, ...this.externalMessages];
          this.options.storage?.save(this.history);
        },
        requestContext: this.options.getRequestContext?.(),
        signal: this.abortController.signal,
        onEvent: (event) => {
          if (revision !== this.revision) return;
          if (event.type === 'usage') {
            this.options.onUsage?.(event.usage);
          } else if (event.type === 'assistant_delta') {
            if (!this.abortController?.signal.aborted) displayStream.push(event.text);
          } else if (event.type === 'tool_call') {
            resetSegment();
            calledTool = true;
            this.onTurn({ role: 'tool', text: toolLabel(event.name) });
          } else if (event.type === 'tool_result' && event.isError) {
            this.onTurn({ role: 'error', text: displayError(event.content) });
          } else if (event.type === 'assistant') {
            // A streamed turn was already rendered via deltas — just close the
            // live bubble. Without a delta handler wired, fall back to emitting
            // the whole turn so the text is never lost.
            if (event.streamed && this.options.onAgentDelta) {
              displayStream.finish();
              this.options.onAgentStreamEnd?.();
            } else if (event.text) {
              const text = assistantPresentation(event.text);
              if (text) {
                visibleAnswer = true;
                this.onTurn({ role: 'agent', text });
              }
            }
            resetSegment();
          }
        },
      });
      if (revision !== this.revision) return;
      this.history = [...result.messages, ...this.externalMessages];
      this.externalMessages = [];
      this.options.storage?.save(this.history);
      if (result.aborted) {
        saveStoppedTurn();
      } else if (result.stoppedOnLimit) {
        this.onTurn({ role: 'error', text: t('agentMaxSteps') });
      } else if (!visibleAnswer && !calledTool) {
        this.onTurn({ role: 'error', text: t('agentRequestFailed') });
      }
    } catch (error) {
      if (revision === this.revision) {
        if (this.abortController?.signal.aborted) saveStoppedTurn();
        else {
          const guidance = displayError(error);
          if (interruptedText) {
            const failure = { role: 'assistant' as const, content: guidance, hostGuidance: 'error' as const };
            this.history.push({ role: 'assistant', content: interruptedText, interrupted: true }, failure);
            this.options.storage?.save(this.history);
          }
          this.onTurn({ role: 'error', text: guidance });
        }
      }
    } finally {
      this.externalMessages = [];
      this.running = false;
      this.abortController = null;
    }
  }

  /** Request the current run to stop after the in-flight model call returns. */
  stop(): void {
    this.abortController?.abort();
  }

  /** Detach pending output and persistence when switching providers. Keeps stored history. */
  dispose(): void {
    this.revision++;
    this.stop();
  }

  /** Clear the conversation history (and its persisted copy). */
  reset(): void {
    this.dispose();
    this.history = [];
    this.externalMessages = [];
    this.options.storage?.clear();
  }
}
