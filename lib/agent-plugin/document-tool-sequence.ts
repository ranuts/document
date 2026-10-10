import type { LLMProvider } from '@ranuts/agent-core/llm/types';
import type { DocumentContext } from './document-context';
import { generateDocumentToolPlan, parseDocumentToolPlan, type DocumentToolPlan } from './document-tool-plan';

/** `read <range>, then set <cell> to <literal>` -- the closed, model-free cell sequence. */
const CELL_SEQUENCE_PATTERNS = [
  /^(?:请)?读取\s*([A-Z]{1,3}[1-9]\d*:[A-Z]{1,3}[1-9]\d*)\s*的内容[，,]然后(?:将|把)\s*([A-Z]{1,3}[1-9]\d*)\s*设置为\s*([\s\S]+?)。?$/i,
  /^(?:please\s+)?read\s+([A-Z]{1,3}[1-9]\d*:[A-Z]{1,3}[1-9]\d*),\s*then\s+set\s+([A-Z]{1,3}[1-9]\d*)\s+to\s+([\s\S]+?)\.?$/i,
];
/** A read-then request in this shape is either the sequence above or a refusal -- never a plan. */
const READ_THEN_PATTERNS = [/^(?:请)?读取[\s\S]*[，,]然后/, /^(?:please\s+)?read\b[\s\S]*,\s*then\b/i];

function plansForCellSequence(request: string, context: DocumentContext): readonly DocumentToolPlan[] | null {
  const sequence = CELL_SEQUENCE_PATTERNS.map((pattern) => pattern.exec(request)).find(Boolean);
  if (!sequence) return null;
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

/**
 * True when a tool request is answered without a model.
 *
 * The closed cell phrase above is applied directly, and a read-then request in
 * that shape that does not match is refused locally. Everything else in this task
 * needs a model to choose the operation, so callers gating on model readiness must
 * ask this rather than assume the whole task does.
 *
 * A missing context (the editor is not ready yet) answers false: without knowing
 * the document kind there is nothing to apply a fixed phrase to.
 */
export function isModelFreeToolRequest(request: string, context: DocumentContext | null | undefined): boolean {
  if (context?.kind !== 'cell') return false;
  const text = request.trim();
  if (READ_THEN_PATTERNS.some((pattern) => pattern.test(text))) return true;
  return CELL_SEQUENCE_PATTERNS.some((pattern) => pattern.test(text));
}

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
    const sequence = plansForCellSequence(request.trim(), context);
    if (sequence) return sequence;
    // Do not send an unrecognized explicit sequence to a one-operation planner.
    if (READ_THEN_PATTERNS.some((pattern) => pattern.test(request.trim()))) throw new Error('agentToolNotChosen');
  }
  return Object.freeze([await generateDocumentToolPlan(provider, request, context, signal, options)]);
}
