# Native CPU summary temperature diagnostic, frozen before inference

Runtime d71a1e8, exact default CPU Qwen3-0.6B Q4_K_M binary, same actual selected-text summary route and unchanged instructions/schema/budget. UI advanced generation temperature is the only changed request setting, via native numeric input/change. Record actual SDK request to confirm temperature; top_p remains 0.8, max_tokens 512. Fresh Chromium context per run, synthetic owned native Word. Actual host replacement and Undo/Redo/errors retained. No output repair, source seed/cache/SDK substitution or hidden retry.

Runs 1/2 repeat the two development fixtures in 3261efa at temperature 0, comparing with preserved earlier temperature 0.7 reports. This historical one-run comparison does not prove stochastic stability or causality.

Runs 3/4 use the following new fixture at temperatures 0.7 then 0:
Source: 维修记录：林珂于周二提交了周六停机检修的申请，但申请尚未批准。批准人是苏宁，只有完成安全检查后才能批准。目前安全检查尚未完成，周六停机仍是拟议安排。该记录用于设备维护协调。
Instruction: 压缩为一句中文摘要，保留人物、时间指向、未批准状态和安全检查前提，不要补充事实。
Criteria: 林珂 applies on Tuesday for proposed Saturday shutdown; 苏宁 approver; unapproved because prerequisite safety check incomplete; neither date binding nor status/roles changed. Shorter, one sentence, no invented facts.

Runs 5/6 use this new fixture at temperatures 0.7 then 0:
Source: 交付记录：赵芮提出周三交付首批样品，项目组尚未接受该日期。若顾言周一前确认检测结果，才可安排发货；目前检测结果仍在复核，没有完成确认。周三交付只是建议，尚未形成正式承诺。
Instruction: 压缩为一句中文摘要，保留建议日期、发货前提、确认期限和当前未确认状态，不要补充事实。
Criteria: 赵芮 proposed Wednesday delivery not accepted/committed; 顾言 must confirm test results before Monday for dispatch eligibility; results still under review/unconfirmed. Shorter, one sentence, no invented facts/date attachment shift. Preserve actor roles.

All outputs graded against these frozen criteria; mechanical edit verification does not imply semantic pass. New fixtures become development data after the first inference; paired one-run comparisons are not a held-out acceptance set, repeated-sampling study or justification to change defaults. Reject temperature-only hypothesis if reduced temperature still changes facts or ignores required format in any declared case. Document uncertain grading rather than normalize responses or relax criteria. Browser timing includes observer overhead; no broad latency/resource claim. No GPU/mobile/offline/privacy acceptance implied.
