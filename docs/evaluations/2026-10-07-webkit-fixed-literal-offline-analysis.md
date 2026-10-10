# Isolated WebKit offline-navigation follow-up

Playwright 1.65.0-alpha-2026-10-07 with its matched WebKit 27.2 (revision 2370) completed both unchanged minimal literal-response cases. After actual service-worker control, setOffline(true) and stopped-origin navigation each returned status 200, fromServiceWorker true and exact LOCAL_LITERAL text. Both contexts and owned servers closed; browser closed and process exited 0.

Upstream [issue 42775](https://github.com/microsoft/playwright/issues/42775) is closed by [PR 42894](https://github.com/microsoft/playwright/pull/42894), merged October 5. This isolated installed-runner result establishes the local diagnostic path; it does not update project dependencies or retroactively pass older failures.

The runner/browser are installed under ignored scratch storage. To run the retained driver, copy it into scratch beside playwright-webkit-fix and set PLAYWRIGHT_BROWSERS_PATH to that isolated browsers directory. No app, editor, model, save/reopen, physical Safari/mobile or full offline acceptance is covered by this minimal response. Next work must test the actual product lifecycle using the matched diagnostic runtime.
