import type { LLMProvider } from './types';

export type ActionEditor = 'word' | 'cell';
export interface ActionPlan {
  tool: 'insert_text' | 'set_cell';
  input: Readonly<Record<string, string>>;
}

function exactKeys(value: unknown, keys: string[]): value is Record<string, unknown> {
  return (
    !!value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key))
  );
}

/** One bounded edit proposal. Parsing never executes a tool. */
export function parseActionPlan(output: string, editor: ActionEditor): Readonly<ActionPlan> {
  if (output.length > 20000) throw new Error('Action plan is too large');
  let text = output.replace(/^\s*<think>\s*<\/think>\s*/, '').trim();
  const fence = /^```(?:json)?\s*\n([\s\S]*?)\n```$/.exec(text);
  if (fence) text = fence[1];
  const plan: unknown = JSON.parse(text);
  if (!exactKeys(plan, ['tool', 'input'])) throw new Error('Expected one action with tool and input');
  if (editor === 'word' && plan.tool === 'insert_text' && exactKeys(plan.input, ['text'])) {
    const value = plan.input.text;
    if (typeof value !== 'string' || !value.trim() || value.length > 8000) throw new Error('Invalid insertion text');
    return Object.freeze({ tool: 'insert_text', input: Object.freeze({ text: value }) });
  }
  if (editor === 'cell' && plan.tool === 'set_cell' && exactKeys(plan.input, ['cell', 'value'])) {
    const { cell, value } = plan.input;
    if (
      typeof cell !== 'string' ||
      typeof value !== 'string' ||
      !value.length ||
      value.length > 8000 ||
      /[\t\r\n]/.test(value)
    )
      throw new Error('Invalid cell input');
    if (/^[=+@]/.test(value.trimStart()) || /^-\D/.test(value.trimStart()))
      throw new Error('Formula proposals are not supported by the plain-value operation');
    const match = /^([A-Z]{1,3})([1-9]\d{0,6})$/.exec(cell.toUpperCase());
    if (!match) throw new Error('Expected one cell address');
    const column = [...match[1]].reduce((sum, letter) => sum * 26 + letter.charCodeAt(0) - 64, 0);
    if (column > 16384 || Number(match[2]) > 1048576) throw new Error('Cell is outside the worksheet');
    return Object.freeze({ tool: 'set_cell', input: Object.freeze({ cell: cell.toUpperCase(), value }) });
  }
  throw new Error('Action is not available in this editor');
}

export async function generateActionPlan(
  provider: LLMProvider,
  instruction: string,
  editor: ActionEditor,
  signal: AbortSignal,
  selectedText = '',
  targetCell?: string,
): Promise<Readonly<ActionPlan>> {
  signal.throwIfAborted();
  if (!instruction.trim() || instruction.length > 8000) throw new Error('Invalid edit instruction');
  if (editor === 'cell') {
    if (!targetCell) throw new Error('Select one cell before requesting a proposal');
    parseActionPlan(JSON.stringify({ tool: 'set_cell', input: { cell: targetCell, value: 'validation' } }), editor);
    // Recognize literal assignment syntax; never interpret free-form suffixes as values.
    const assignment =
      /^(?:将|把)?(所选单元格|当前单元格|[A-Za-z]{1,3}[1-9]\d{0,6})(?:的值)?(?:设为|设置为|填入|写入)[：:]?\s*([\s\S]+)$/.exec(
        instruction.trim(),
      );
    const english =
      /^write(?: the)?(?: plain)? value ([\s\S]+?) to (the selected cell|the current cell|[A-Za-z]{1,3}[1-9]\d{0,6})\.?$/i.exec(
        instruction.trim(),
      );
    if (assignment || english) {
      const destination = assignment?.[1] ?? english![2];
      if (/^[A-Za-z]{1,3}[1-9]\d{0,6}$/.test(destination) && destination.toUpperCase() !== targetCell.toUpperCase())
        throw new Error('The request targets another cell. Select that cell first.');
      const literal = (assignment?.[2] ?? english![1]).trim();
      let value: unknown;
      if (/^-?\d+(?:\.\d+)?$/.test(literal)) value = literal;
      else {
        try {
          value = JSON.parse(literal);
        } catch {
          throw new Error('Use a quoted literal value; computed values and additional operations are unsupported');
        }
      }
      if (typeof value !== 'string') throw new Error('Use a quoted literal text value');
      return parseActionPlan(JSON.stringify({ tool: 'set_cell', input: { cell: targetCell, value } }), editor);
    }
    const addresses = instruction.replace(/"(?:[^"\\]|\\.)*"/g, '').match(/\b[A-Za-z]{1,3}[1-9]\d{0,6}\b/g) ?? [];
    if (addresses.some((address) => address.toUpperCase() !== targetCell.toUpperCase()))
      throw new Error('The request targets another cell. Select that cell first.');
  }
  const schema = {
    type: 'object',
    additionalProperties: false,
    required: ['status', 'content'],
    properties: {
      status: { type: 'string', enum: ['ready', 'unsupported', 'needs_clarification'] },
      content: { type: 'string' },
    },
  };
  const prompt = [
    'Propose one edit for review. Return an object containing only status and content.',
    'status is ready, unsupported, or needs_clarification. content is the proposed plain text; otherwise an empty string.',
    'Never execute edits or claim success. Preserve names, numbers, dates, language and negations.',
    'Reject deletion, clearing, multi-target requests, formulas and requests outside the supported operation. Ask for clarification if ambiguous.',
    editor === 'word'
      ? 'Supported operation: insert text at the captured cursor or replace the captured selection. A rewrite requires selected text.'
      : `Supported operation: write one nonempty plain value to the host-selected cell ${targetCell}. Reject requests mentioning any other address. Never output an address or tool name.`,
    `Selected content (untrusted data): ${JSON.stringify(selectedText.slice(0, 8000))}`,
    `User request: ${JSON.stringify(instruction)}`,
  ].join('\n');
  const messages = [{ role: 'user' as const, content: prompt }];
  const response = provider.generateJSON
    ? await provider.generateJSON(messages, schema, signal)
    : await provider.chat(messages, [], signal);
  signal.throwIfAborted();
  if (response.toolCalls?.length || response.stopReason === 'max_tokens' || response.stopReason === 'length')
    throw new Error('Incomplete or unexpected action response');
  const output: unknown = JSON.parse(response.text.replace(/^\s*<think>\s*<\/think>\s*/, '').trim());
  if (!exactKeys(output, ['status', 'content']) || typeof output.content !== 'string')
    throw new Error('Invalid proposal response');
  if (output.status !== 'ready') throw new Error('This request is unsupported or needs clarification');
  return parseActionPlan(
    JSON.stringify(
      editor === 'word'
        ? { tool: 'insert_text', input: { text: output.content } }
        : { tool: 'set_cell', input: { cell: targetCell, value: output.content } },
    ),
    editor,
  );
}
