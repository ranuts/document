import type { PlaywrightTestConfig } from '@playwright/test';
export function balanceTestFiles(files: string[], timings: Record<string, number>, total: number): string[][];
export function selectShard(shards: string[][], shard: string): string[];
export function ciTestMatch(suite: 'preview' | 'pages' | 'browsers'): Pick<PlaywrightTestConfig, 'testMatch'>;
