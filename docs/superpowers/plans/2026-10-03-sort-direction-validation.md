# Validate explicit sorting direction before applying a document tool

Observed production defect: Qwen3.5-0.8B executes an English ascending request as descending and reports success. Native verification checks the generated plan, so it cannot detect this disagreement.

Use explicit English ascending/descending and Chinese 升序/降序 cues to constrain the sort schema. Reject mismatching generated sort parameters before returning a plan, including providers that ignore schemas. Reject sort plans when both directions occur or bounded same-sentence negation mentions a direction, rather than guessing which clause governs. Simple recognized negations include intervening range addresses. Do not rewrite a returned plan, add previews, or claim full natural-language intent validation. Requests without recognized direction retain existing planning behavior; broader language/negation semantics remain unproven.

1. Add failing planner regressions for opposite directions, matching directions, schema enums and conflicting cues.
2. Implement application-side direction constraint plus post-generation validation.
3. Run relevant tests, full checks and production build.
4. Retest actual 0.8B English/Chinese IM sorting and 1.7B behavior. Correct sorting or an unchanged document with an error is required for an opposite-direction response; successful capability is separately recorded.
