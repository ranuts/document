# Reopened Unicode sample rendering — 2026-10-04

Reopened actual saved Word/Excel/PPT short samples in a new desktop Chromium context at 1440×1000. Hashes bind files to the prior IM Save report and screenshots to this executed driver. No new AI inference, text mutation or Save occurred. Native editor load readiness was observed before a 1500ms rendering wait and screenshot capture. Context and browser closed; owned process exited 0; no page errors.

Visual inspection of all three screenshots shows the full short marker with Chinese 四季, Japanese 日本 and ä, without obvious missing-glyph boxes. Word shows the expected line on the page. Excel displays its B2 text extending into empty cells to the right and repeats it in the formula bar; this is not a general column-width or populated-neighbor readability acceptance. PPT displays the marker near the top-left inside the slide, above empty title/subtitle placeholders. The placeholders' editor prompts are not inserted marker text.

Native reopened PPT marker box: x=10.16, y=5.715, width=220.1433, height=10.17mm on a 338.6667×190.5mm slide; content summary height is 7.62mm. The short box is within the slide and the measured content height is less than box height. This native summary metric alone does not establish text width, glyph bounding rectangles or long/multiline overflow. Visual inspection supports only this short observed sample.

The scoped verifier checks driver/file/screenshot hashes, native readiness and short PPT box/content-height measurements. It is not a pixel or font judge. Screenshots remain at recorded owned scratch paths and are not durable repository fixtures. Network was available, service workers blocked, no external-request logging or forced offline. No physical devices, cross-browser font identity, typography certification, long-text tests, all format fidelity or Save/reopen rerun. No headers were experimentally changed in this rendering follow-up; the preceding IM run used injected isolation headers. Read-only evidence required no product build/test repetition.

An initial capture overlapped formatting of its newly created driver, causing the recorded driver SHA to differ from final source. Preserve that raw report as `2026-10-04-unicode-saved-render-before.json`; its screenshot paths are mutable and are overwritten by the corrected run, so it is not a current screenshot/probe-hash acceptance artifact. A sequential rerun with fixed driver bytes supplies the final report.

Independent read-only review inspected the three final screenshots and found no Critical/Important evidence issue; it confirmed the narrow visual observations and limits above. Final driver hash, screenshot hashes and layout verifier pass.

No product defect was established by these short screenshots. Next exercise longer/multiline PPT content with native layout and visual checks, while retaining native document styles and the compact direct-edit workflow.
