# Evaluation archive integrity

`archive-integrity.json` pins exact bytes of existing raw receipts, frozen protocols, executed diagnostic drivers and historical analysis reports that conflict with automatic formatting or lint rules. It is a snapshot of committed evidence, not proof that an evaluation passed or that earlier provenance was independently verified.

`pnpm run format`, `pnpm run format:check` and `pnpm run lint:ts` first verify every listed SHA-256, parse archived JSON and check archived JavaScript syntax. Only those exact file paths are excluded from stylistic checks. New files, product code, tests, this policy, the manifest itself and the maintained writing model decision index remain subject to normal checks. There is no directory-wide evaluation exemption.

Do not rewrite a recorded driver or receipt to make an old result appear successful. Archive a corrected run under a new name and retain the original observation. Adding a file to the manifest requires review of its role and original bytes; regenerating hashes merely to accommodate changes defeats this gate. Hash matching does not validate model semantics, browser behavior, privacy or acceptance scope.

Use `pnpm run test:archive` to inspect archive integrity separately. Missing files, changed bytes, malformed JSON, invalid script syntax, duplicate entries and paths outside the flat evaluation archive fail the check. The frozen artifacts may require the documented local diagnostic environment to execute; syntax checking does not run them.
