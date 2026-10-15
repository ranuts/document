import { Lexer, type Token, type TokensList } from 'marked';
import { renderMarkdownTokens } from './markdown';

/** Input bound, not a promise that a synchronous lexer can be preempted. */
export const STREAMING_MARKDOWN_LIMIT = 8000;
// Flatten a bounded working copy before lexing: cached token/raw substrings must
// not retain the growing full response through V8 substring backing storage.
const ownInput = (text: string): string => ` ${text}`.slice(1);
interface Block {
  raw: string;
  tokens?: Token[];
  nodes?: Node[];
  key?: string;
  provisional?: boolean;
}

/** One stream's conservative block cache. Original source remains owned by ChatView. */
export class StreamingMarkdown {
  private source = '';
  private blocks: Block[] = [];
  private stable = 0;
  private references = false;
  private label = false;
  private bracket = false;
  private escaped = false;
  constructor(private readonly target: HTMLElement) {}

  update(source: string, complete = false): void {
    if (source === this.source && !complete) return;
    if (!source.startsWith(this.source)) {
      this.stable = 0;
      this.references = this.label = this.bracket = this.escaped = false;
      this.source = '';
    }
    // Conservative, linear cross-chunk reference candidate detection. The lexer
    // also checks actual definitions at every nesting level on bounded inputs.
    for (let index = this.source.length; index < source.length; index++) {
      const char = source[index];
      if (this.escaped) {
        this.escaped = false;
        continue;
      }
      if (char === '\\') {
        this.escaped = true;
        continue;
      }
      if (char === '\n' || char === '\r') this.bracket = false;
      else if (char === '[') {
        this.label = true;
        this.bracket = false;
      } else if (char === ']' && this.label) {
        this.bracket = true;
        this.label = false;
      } else {
        if (char === ':' && this.bracket) this.references = true;
        this.bracket = false;
      }
    }
    this.source = source;
    if (this.references) {
      this.whole(source, complete);
      return;
    }
    if (complete && source.length <= STREAMING_MARKDOWN_LIMIT) {
      this.whole(source, true);
      return;
    }
    let keep = this.stable;
    // A blank line alone cannot freeze a list/setext boundary. Retain two blocks.
    for (let index = this.blocks.length - 3; index >= keep; index--) {
      if (this.blocks[index].tokens && this.blocks[index].raw.replace(/\r\n|\r/g, '\n').endsWith('\n\n')) {
        keep = index + 1;
        break;
      }
    }
    let offset = 0;
    for (let index = 0; index < keep; index++) {
      const block = this.blocks[index];
      if (!source.startsWith(block.raw, offset)) {
        this.whole(source, complete);
        return;
      }
      offset += block.raw.length;
    }
    const tail = source.slice(offset);
    if (tail.length > STREAMING_MARKDOWN_LIMIT) {
      this.replace(keep, [{ raw: tail }], !complete);
      this.stable = keep;
      return;
    }
    try {
      const input = ownInput(tail);
      const tokens = Lexer.lex(input);
      if (Object.keys(tokens.links).length) {
        this.references = true;
        this.whole(source, complete);
        return;
      }
      const blocks = this.split(input, tokens);
      this.replace(keep, blocks, !complete);
      this.stable = keep;
    } catch {
      this.raw(source);
    }
  }

  /** Stop flush: exact raw tail only, with no lexing or token rendering. */
  raw(source: string): void {
    let offset = 0;
    for (const block of this.blocks.slice(0, this.stable)) offset += block.raw.length;
    this.replace(this.stable, [{ raw: source.slice(offset) }], true);
  }

  private whole(source: string, complete: boolean): void {
    this.stable = 0;
    if (source.length > STREAMING_MARKDOWN_LIMIT) {
      this.replace(0, [{ raw: source }], !complete);
      return;
    }
    try {
      const input = ownInput(source);
      const tokens = Lexer.lex(input);
      // Reference definitions can disappear from token.raw. Rendering the original
      // whole token list retains global inline resolution without trusting offsets.
      const blocks = Object.keys(tokens.links).length
        ? tokens.map((token) => ({ raw: token.raw, tokens: [token] }))
        : this.split(input, tokens);
      this.replace(0, blocks, !complete);
    } catch {
      this.replace(0, [{ raw: source }], !complete);
    }
  }

  private split(source: string, tokens: TokensList): Block[] {
    const normalized = source.replace(/\r\n|\r/g, '\n');
    const offsets = [0];
    for (let index = 0; index < source.length; index++) {
      if (source[index] === '\r' && source[index + 1] === '\n') index++;
      offsets.push(index + 1);
    }
    const groups: Block[] = [];
    for (const token of tokens) {
      if (token.type === 'space' && groups.length) groups[groups.length - 1].raw += token.raw;
      else groups.push({ raw: token.raw, tokens: [token] });
    }
    let offset = 0;
    for (const block of groups) {
      if (!normalized.startsWith(block.raw, offset)) return [{ raw: source, tokens }];
      const end = offset + block.raw.length;
      block.raw = source.slice(offsets[offset], offsets[end]);
      offset = end;
    }
    if (offset !== normalized.length) return [{ raw: source, tokens }];
    return groups;
  }

  private replace(keep: number, blocks: Block[], provisional: boolean): void {
    const previous = this.blocks.slice(keep);
    for (let index = 0; index < blocks.length; index++) {
      const block = blocks[index];
      const old = previous[index];
      const key = block.tokens ? JSON.stringify(block.tokens) : undefined;
      if (old?.nodes && old.raw === block.raw && old.key === key && old.provisional === provisional) {
        block.nodes = old.nodes;
      } else if (!block.tokens && !old?.tokens && old?.nodes && block.raw.startsWith(old.raw)) {
        const text = old.nodes[0].firstChild as Text;
        text.appendData(block.raw.slice(old.raw.length));
        block.nodes = old.nodes;
      } else {
        const fragment = document.createDocumentFragment();
        if (block.tokens) renderMarkdownTokens(fragment, block.tokens, provisional);
        else {
          const raw = document.createElement('span');
          raw.className = 'cui-stream-raw';
          raw.append(document.createTextNode(block.raw));
          fragment.append(raw);
        }
        const nodes = Array.from(fragment.childNodes);
        block.nodes =
          old?.nodes?.length === nodes.length && nodes.every((node, i) => node.isEqualNode(old.nodes![i]))
            ? old.nodes
            : nodes;
      }
      block.key = key;
      block.provisional = provisional;
    }
    const prefix = this.blocks.slice(0, keep);
    let index = prefix.reduce((count, block) => count + (block.nodes?.length ?? 0), 0);
    for (const node of blocks.flatMap((block) => block.nodes ?? [])) {
      if (this.target.childNodes[index] !== node) this.target.insertBefore(node, this.target.childNodes[index] ?? null);
      index++;
    }
    while (this.target.childNodes.length > index) this.target.lastChild!.remove();
    this.blocks = [...prefix, ...blocks];
  }
}
