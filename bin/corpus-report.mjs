#!/usr/bin/env node
// Merge the per-worker corpus reports written by test/e2e/corpus.spec.ts into
// one JSON + a markdown table (stdout, and $GITHUB_STEP_SUMMARY when set).
// Usage: node bin/corpus-report.mjs [test-results]
import { readdirSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { join, basename } from 'node:path';

const dir = process.argv[2] || 'test-results';
const parts = readdirSync(dir).filter((f) => /^corpus-report-\d+\.json$/.test(f));
if (parts.length === 0) {
  console.log('corpus-report: no per-worker reports found in ' + dir);
  process.exit(0);
}
let total = 0;
let kept = 0;
const rows = [];
for (const f of parts) {
  const r = JSON.parse(readFileSync(join(dir, f), 'utf8'));
  total = Math.max(total, r.total || 0);
  kept = Math.max(kept, r.kept || 0);
  rows.push(...(r.rows || []));
}
rows.sort((a, b) => a.file.localeCompare(b.file));
const isBad = (r) =>
  !String(r.open).startsWith('ok') ||
  r.edit === 'fatal' ||
  String(r.save).startsWith('fail') ||
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

const lines = [];
lines.push(
  `## Corpus matrix: ${rows.length} files ran (${kept} kept of ${total} discovered), ${bad.length} with findings`,
);
lines.push('');
lines.push('| ext | files | findings |');
lines.push('| --- | ---: | ---: |');
for (const [ext, v] of Object.entries(byExt).sort()) lines.push(`| ${ext} | ${v.total} | ${v.bad} |`);
if (bad.length) {
  lines.push('');
  lines.push('| file | open | edit | save | asc errors | dialog |');
  lines.push('| --- | --- | --- | --- | --- | --- |');
  for (const r of bad) {
    const esc = (v) =>
      String(v ?? '')
        .replace(/\|/g, '\\|')
        .slice(0, 120);
    lines.push(
      `| ${esc(basename(r.file))} | ${esc(r.open)} | ${esc(r.edit)} | ${esc(r.save)} | ${esc(JSON.stringify(r.ascErrors))} | ${esc(r.fatalDialog)} |`,
    );
  }
}
const md = lines.join('\n');
console.log(md);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, md + '\n');
