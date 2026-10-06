import { readFileSync } from 'node:fs';
import { expect, it, vi } from 'vitest';

it.each(['index.js', 'index.cjs'])(
  'validates a memory64 module rather than trusting the Memory constructor: %s',
  (file) => {
    const source = readFileSync(`packages/agent-core/node_modules/@wllama/wllama/esm/${file}`, 'utf8');
    const helper = source.match(/var isSupportMem64 = (\(\) => \{[\s\S]*?\n\});/)?.[1];
    expect(helper).toBeDefined();
    const validate = vi.fn((_bytes: Uint8Array) => false);
    const browser = { Memory: class {}, validate };
    const probe = new Function('WebAssembly', `return (${helper})();`);
    expect(probe(browser)).toBe(false);
    expect(validate).toHaveBeenCalledOnce();
    expect(Array.from(validate.mock.calls[0][0] as Uint8Array)).toEqual([0, 97, 115, 109, 1, 0, 0, 0, 5, 3, 1, 4, 1]);
    validate.mockReturnValue(true);
    expect(probe(browser)).toBe(true);
    validate.mockImplementation(() => {
      throw new Error('Unavailable');
    });
    expect(probe(browser)).toBe(false);
  },
);
