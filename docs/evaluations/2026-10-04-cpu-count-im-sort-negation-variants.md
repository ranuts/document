# Negated sort variants after the bounded fix

Actual current CPU Excel IM tested three further requests. 请不要对 A1:B4 排序，保持原样。 produced actionable no-operation clarification. Do not sort A1:B4. Leave every cell unchanged. produced a generic could-not-complete error. 不要排序 A1:B4，只读取 B2 的值。 returned B2 and 30. All inspected A1:C4 cells stayed unchanged, with no preview cards or page errors.

Both no-op variants still reach inference: the prior whole-command guard deliberately covers a narrower Chinese form. The English generic error is a feedback gap; this evidence does not identify its internal parsing/validation cause. It should be traced before expanding guards or changing error mapping. No product code changed, and no inference output was substituted.

The verifier preserves these observed outcomes rather than treating the generic error as full acceptance. The inherited Undo/Redo concerns seed history and is excluded from acceptance. One desktop Chromium CPU run cannot prove all negation formulations or overall model instruction fidelity.
