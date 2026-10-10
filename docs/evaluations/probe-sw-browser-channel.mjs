// Owned isolated browser only; preserve the pinned two-build probe and its reports.
import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
const channel = process.env.SW_BROWSER_CHANNEL || 'chromium';
const reportPath = process.env.TWO_BUILD_REPORT;
if (!reportPath) throw Error('A unique TWO_BUILD_REPORT is required');
const originalLaunch = chromium.launch.bind(chromium);
const launchOptions = [];
chromium.launch = options => {
  const actual = {...options, channel};
  launchOptions.push(actual);
  return originalLaunch(actual);
};
await import('./probe-vendor-csp-two-build.mjs');
const report = JSON.parse(await fs.readFile(reportPath,'utf8'));
report.browserDriver = {channel, launchOptions, sha256:createHash('sha256').update(await fs.readFile(new URL(import.meta.url))).digest('hex'), scope:'Only launch channel overridden; owned fresh browser, no existing user browser state'};
await fs.writeFile(reportPath,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({channel,passed:report.passed,completeMigrationPassed:report.completeMigrationPassed,error:report.error}));
