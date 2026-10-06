import type { LLMProvider } from '@ranuts/agent-core/llm/types';
import type { DocumentContext } from './document-context';
import { generateDocumentToolPlan, parseDocumentToolPlan, type DocumentToolPlan } from './document-tool-plan';

/** Validate the entire literal sequence before any editor operation can run. */
export async function generateDocumentToolSequence(
  provider: LLMProvider,
  request: string,
  context: DocumentContext,
  signal: AbortSignal,
  options: { stableCapabilityPrefix?: boolean } = {},
): Promise<readonly DocumentToolPlan[]> {
  signal.throwIfAborted();
  if (!request.trim() || request.length > 8000) throw new Error('Invalid document operation request');
  if (context.kind === 'cell') {
    const sequence =
      /^(?:请)?读取\s*([A-Z]{1,3}[1-9]\d*:[A-Z]{1,3}[1-9]\d*)\s*的内容[，,]然后(?:将|把)\s*([A-Z]{1,3}[1-9]\d*)\s*设置为\s*([\s\S]+?)。?$/i.exec(
        request.trim(),
      ) ??
      /^(?:please\s+)?read\s+([A-Z]{1,3}[1-9]\d*:[A-Z]{1,3}[1-9]\d*),\s*then\s+set\s+([A-Z]{1,3}[1-9]\d*)\s+to\s+([\s\S]+?)\.?$/i.exec(
        request.trim(),
      );
    if (sequence) {
      const literal = sequence[3];
      const numeric = /^-?\d+(?:\.\d+)?$/.test(literal);
      let value: unknown;
      if (numeric) value = literal;
      else {
        try {
          value = JSON.parse(literal);
        } catch {
          throw new Error('agentToolNotChosen');
        }
      }
      if (typeof value !== 'string') throw new Error('agentToolNotChosen');
      return Object.freeze([
        parseDocumentToolPlan(JSON.stringify({ tool: 'get_range', input: { range: sequence[1] } }), context),
        parseDocumentToolPlan(
          JSON.stringify({
            tool: 'set_cell',
            input: { cell: sequence[2], value, ...(!numeric ? { valueType: 'text' } : {}) },
          }),
          context,
        ),
      ]);
    }
    // Do not send an unrecognized explicit sequence to a one-operation planner.
    if (
      /^(?:请)?读取[\s\S]*[，,]然后/.test(request.trim()) ||
      /^(?:please\s+)?read\b[\s\S]*,\s*then\b/i.test(request.trim())
    ) throw new Error('agentToolNotChosen');
  }
  return Object.freeze([await generateDocumentToolPlan(provider, request, context, signal, options)]);
}
