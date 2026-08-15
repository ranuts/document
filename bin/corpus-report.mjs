#!/usr/bin/env node
// Merge the per-worker corpus row files (JSON lines) written by test/e2e/corpus.spec.ts into
// one JSON + a markdown table (stdout, and $GITHUB_STEP_SUMMARY when set).
// Usage: node bin/corpus-report.mjs [test-results]
import { readdirSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { join, basename } from 'node:path';

const dir = process.argv[2] || 'test-results';
const parts = readdirSync(dir).filter((f) => /^corpus-rows-\d+\.jsonl$/.test(f));
if (parts.length === 0) {
  console.log('corpus-report: no per-worker row files found in ' + dir);
  process.exit(0);
}
let total = 0;
let kept = 0;
const rows = [];
for (const f of parts) {
  for (const line of readFileSync(join(dir, f), 'utf8').split('\n')) {
    if (!line.trim()) continue;
    const r = JSON.parse(line);
    total = Math.max(total, r.total || 0);
    kept = Math.max(kept, r.kept || 0);
    if (r.row) rows.push(r.row);
  }
}
rows.sort((a, b) => a.file.localeCompare(b.file));
const isBad = (r) =>
  !String(r.open).startsWith('ok') ||
  r.edit === 'fatal' ||
  String(r.save).startsWith('fail') ||
  String(r.saveEdited || '').startsWith('fail') ||
  String(r.content || '').startsWith('fail') ||
  String(r.visual || '').startsWith('fail') ||
  (r.ascErrors && r.ascErrors.length > 0) ||
  r.fatalDialog;
const bad = rows.filter(isBad);
const byExt = {};
for (const r of rows) {
  const ext = (r.file.split('.').pop() || '').toLowerCase();
  byExt[ext] ??= { total: 0, bad: 0 };
  byExt[ext].total++;
  if (isBad(r)) byExt[ext].bad++;
}
writeFileSync(
  join(dir, 'corpus-report.json'),
  JSON.stringify({ total, kept, ran: rows.length, findings: bad.length, rows }, null, 2),
);

// L4 timing (strategy section 3): open seconds parsed from "ok (load Ns)",
// save milliseconds from "ok (NNNms, ...)". Reported, not yet thresholded.
const pct = (arr, p) => {
  if (!arr.length) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
};
for (const r of rows) {
  const ext = (r.file.split('.').pop() || '').toLowerCase();
  const load = /load (\d+)s/.exec(String(r.open));
  const save = /ok \((\d+)ms/.exec(String(r.save));
  byExt[ext].loads ??= [];
  byExt[ext].saves ??= [];
  if (load) byExt[ext].loads.push(Number(load[1]));
  if (save) byExt[ext].saves.push(Number(save[1]));
}

const lines = [];
lines.push(
  `## Corpus matrix: ${rows.length} files ran (${kept} kept of ${total} discovered), ${bad.length} with findings`,
);
lines.push('');
lines.push('| ext | files | findings | open p50/p95 (s) | save p50/p95 (ms) |');
lines.push('| --- | ---: | ---: | ---: | ---: |');
for (const [ext, v] of Object.entries(byExt).sort()) {
  const fmt = (arr) => (arr && arr.length ? `${pct(arr, 50)} / ${pct(arr, 95)}` : '-');
  lines.push(`| ${ext} | ${v.total} | ${v.bad} | ${fmt(v.loads)} | ${fmt(v.saves)} |`);
}
if (bad.length) {
  lines.push('');
  lines.push('| file | open | edit | save | save after edit | content (L2) | visual (L3) | asc errors | dialog |');
  lines.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- |');
  for (const r of bad) {
    const esc = (v) =>
      String(v ?? '')
        .replace(/\|/g, '\\|')
        .slice(0, 120);
    lines.push(
      `| ${esc(basename(r.file))} | ${esc(r.open)} | ${esc(r.edit)} | ${esc(r.save)} | ${esc(r.saveEdited)} | ${esc(r.content)} | ${esc(r.visual)} | ${esc(JSON.stringify(r.ascErrors))} | ${esc(r.fatalDialog)} |`,
    );
  }
}
const md = lines.join('\n');
console.log(md);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, md + '\n');
