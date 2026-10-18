import type { PlaywrightTestConfig } from '@playwright/test';
export function playwrightArtifacts(
  report: string,
  results: string,
  env?: Record<string, string | undefined>,
): Pick<PlaywrightTestConfig, 'outputDir' | 'reporter'>;
