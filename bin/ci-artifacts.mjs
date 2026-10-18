/** Separate passes must never clear each other's HTML reports or trace output. */
export function playwrightArtifacts(report, results, env = process.env) {
  return {
    outputDir: env.E2E_RESULTS_DIR || results,
    reporter: [['list'], ['html', { outputFolder: env.E2E_REPORT_DIR || report, open: 'never' }]],
  };
}
