import { JSONParser } from '@streamparser/json';

/** Presentation preview only. The caller still validates the full schema response. */
export class JsonTextStream {
  private readonly parser = new JSONParser({
    paths: ['$.kind', '$.text'],
    keepStack: true,
    emitPartialTokens: true,
    emitPartialValues: true,
  });
  private prefix = '';
  private trailingSurrogate = '';
  private started = false;
  private failed = false;
  private length = 0;
  private text = '';
  private sent = '';
  private answer: boolean;

  constructor(
    private readonly emit: (delta: string) => void,
    options: { answerOnly?: boolean } = {},
  ) {
    this.answer = !options.answerOnly;
    this.parser.onError = () => {
      this.failed = true;
    };
    this.parser.onValue = ({ key, value, partial }) => {
      if (key === 'kind' && !partial) this.answer = value === 'answer';
      if (key === 'text' && typeof value === 'string') this.text = value;
      if (this.answer) this.flush(this.text);
    };
  }

  push(delta: string): void {
    if (this.failed || !delta) return;
    this.length += delta.length;
    if (this.length > 20000) {
      this.failed = true;
      return;
    }
    if (!this.started) {
      this.prefix += delta;
      const start = this.prefix.trimStart();
      if (!start || '<think>'.startsWith(start)) return;
      if (start.startsWith('<think>')) {
        const end = start.indexOf('</think>');
        if (end < 0) return;
        this.prefix = start.slice(end + '</think>'.length);
        if (!this.prefix.trim()) return;
      }
      this.started = true;
      delta = this.prefix;
      this.prefix = '';
    }
    // TextEncoder must receive a complete UTF-16 pair when string chunks split
    // an emoji; encoding its halves independently would produce replacement text.
    delta = this.trailingSurrogate + delta;
    this.trailingSurrogate = '';
    const last = delta.charCodeAt(delta.length - 1);
    if (last >= 0xd800 && last <= 0xdbff) {
      this.trailingSurrogate = delta.slice(-1);
      delta = delta.slice(0, -1);
    }
    if (delta) this.parser.write(delta);
  }

  /** A preview becomes complete only when it agrees with the validated text. */
  finish(text: string): void {
    if (this.started && !this.parser.isEnded) this.parser.end();
    if (this.failed || this.trailingSurrogate || !text.startsWith(this.sent))
      throw new Error('Invalid structured stream');
    this.flush(text);
  }

  private flush(text: string): void {
    if (this.failed || !text.startsWith(this.sent)) {
      this.failed = true;
      return;
    }
    const delta = text.slice(this.sent.length);
    this.sent = text;
    if (delta) this.emit(delta);
  }
}
