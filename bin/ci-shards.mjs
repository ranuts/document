import { readdirSync, readFileSync } from 'node:fs';

// Longest-processing-time assignment uses measured per-file execution time,
// not file order or equal test counts. New specs receive the median weight.
export function balanceTestFiles(files, timings, total) {
  if (!Number.isInteger(total) || total < 1) throw new Error('Shard count must be a positive integer');
  const measured = Object.values(timings)
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b);
  const fallback = measured[Math.floor(measured.length / 2)] || 1;
  const weight = (file) => (timings[file] > 0 ? timings[file] : fallback);
  const shards = Array.from({ length: total }, () => []);
  const loads = Array(total).fill(0);
  for (const file of [...new Set(files)].sort((a, b) => weight(b) - weight(a) || a.localeCompare(b))) {
    const index = loads.indexOf(Math.min(...loads));
    shards[index].push(file);
    loads[index] += weight(file);
  }
  return shards.map((files) => files.sort());
}

export function selectShard(shards, shard) {
  const match = /^(\d+)\/(\d+)$/.exec(shard);
  if (!match || Number(match[2]) !== shards.length) throw new Error(`Invalid CI shard: ${shard}`);
  const selected = shards[Number(match[1]) - 1];
  if (!selected?.length) throw new Error(`Empty or invalid CI shard: ${shard}`);
  return selected;
}

export function ciTestMatch(suite) {
  const shard = process.env.E2E_SHARD;
  if (!shard) return {};
  const total = Number(shard.split('/')[1]);
  const files = readdirSync(new URL('../test/e2e/', import.meta.url), { recursive: true })
    .filter((file) => file.endsWith('.spec.ts'))
    .map((file) => file.replaceAll('\\', '/'));
  const timings = JSON.parse(readFileSync(new URL('./ci-shard-timings.json', import.meta.url), 'utf8'));
  return {
    testMatch: selectShard(balanceTestFiles(files, timings[suite], total), shard).map((file) => `**/test/e2e/${file}`),
  };
}
