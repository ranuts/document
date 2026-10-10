import { Wllama as BaseWllama } from '@wllama/wllama/esm/index.js';
export { CacheManager } from '@wllama/wllama/esm/index.js';
export declare class Wllama extends BaseWllama {
  countChatTokens(options: Record<string, unknown>): Promise<{ promptTokens: number; contextTokens: number }>;
}
