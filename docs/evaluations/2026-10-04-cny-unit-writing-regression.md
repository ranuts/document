# Explicit renminbi labels

The currency vocabulary already supports localized currency names but interpreted 780元人民币 as the ambiguous bare 元 symbol, causing a false refusal against 780 CNY. Add the explicit compound labels 元人民币 and 人民币元 to CNY. Longest-label matching preserves the amount association. Bare 元 and ¥ remain ambiguous literals; no currency conversion or amount/date relaxation.

The initial test mistakenly classified the legitimate JPY→日元 localization as a substitution; that assertion was removed before implementation. Corrected pre-change tests reproduced the actual 元人民币 refusal. Added seven tests cover the two explicit labels, both directions of conversion, and rejection of JPY→bare 元 or renminbi labels. Existing tests retain broader numeric/date/currency safeguards.

Build passed; 116 test files / 4256 tests passed. Source lint excluding existing .scratch vendor copies, TypeScript and Docker config passed. The full suite emitted existing rejection-handled warnings.

Actual default Qwen 1.7B WebGPU replayed the eight known same-language fixtures on the current production build. Every captured input and raw output text exactly matched the pre-fix report. The approved-payment example now applies its same formal Chinese result with 780元人民币 and preserved date, amount, count, approval and payment direction. Its native Undo/Redo are exact. The missing-date/not-approved output and changed-number English output remain refused and source preserved. Other application outcomes are unchanged. Six edits, two refusals; no previews, no harness errors, served bundle unchanged during replay. Browser closed; no Save.

This removes a currency-label false refusal, not the overall factual-quality gate. The other applied summaries still have previously documented omission/style failures. Run verify-cny-unit-writing-regression.py to check captured-input/raw-output equality, current native mechanics and the one changed application outcome against both reports.
