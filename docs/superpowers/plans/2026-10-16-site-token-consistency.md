# Site token consistency implementation plan

> Execute with subagent-driven-development. One implementation owner at a time; independent spec review followed by code quality review. The approved design is `docs/superpowers/specs/2026-10-16-site-token-consistency-design.md`.

1. Add failing regression cases for the six approved findings: missing mobile home link, rendered confirmation heading, undefined roles, disabled/danger states and control density. Capture RED evidence.
2. Implement owner-level fixes and a small shared application token layer if required. Update all authored/generated consumers and offline/build dependencies. Keep interaction safety and page/compact/touch hierarchy.
3. Add CI-enforced first-party token validation and all-site browser regression. Include negative audit fixtures and real component rendering. Update design documentation with explicit exceptions and ownership.
4. Run focused tests, inspect the implementation, obtain spec review then quality review, and fix all findings. Record test and review evidence.
5. Run full unit coverage, format, lint/typecheck, build and appropriate browser suites. Create and attach one PR, inspect deployed preview, wait for every CI check to pass, and perform final review of the exact final head. Leave merge to the user.
