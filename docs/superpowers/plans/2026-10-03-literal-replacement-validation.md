# Preserve supplied literal replacement text

Observed after frontend whitespace fix: exact Chinese replacement request reaches planner with two final spaces, but generated text drops them and native output matches the shortened plan with success feedback.

Recognize bounded affirmative English/Chinese commands explicitly introducing a terminal literal replacement payload. Everything after the delimiter is data, including whitespace and instruction-like text. For those Word requests, constrain schema to replace_selection with the exact payload (or unsupported); independently reject another tool or altered text. Never repair model parameters after generation. Keep other requests on existing planning behavior; do not claim general intent understanding.

Add failing regressions for altered whitespace/facts/tool and matching exact schemas, language variants, whitespace-only payload and unrelated/negated requests. Implement, build, run tests/lint on stable packages, and retest actual multiline replacement plus native Undo/Redo. No new UI.
