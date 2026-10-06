# Stopped history: native export and reload

Product `ecdaee2`; frozen browser driver/protocol `e64e90b`. The owned scratch browser enabled the native opt-in local history setting, created a new session and ran an actual streamed story using local Qwen2.5 0.5B CPU. It explicitly stopped and recovered through the native product path. No saved fixture, message injection or output replacement was used.

The downloaded native export contains the original user request, exactly the displayed interrupted assistant source, and a separate assistant stopped message with `hostGuidance: status`. The active session ID is recorded. After a full page reload and explicit native restore, the same session displayed byte-identical assistant source and a separate stopped row with its existing recovery action. The saving preference remained enabled. Existing diagnostic sessions in the owned profile were preserved and are included in the raw export.

The native Word document remained unchanged. Browser errors, error guidance and previews were all zero; the browser context closed. Run `python3 docs/evaluations/verify-stop-history-durable.py` for frozen-source/asset binding, export content and restored-row checks.

This proves the observed native export and page-reload restore path, not a physical OS reboot, installed-PWA offline recovery, cross-device storage or model quality. The model was not sent a new request after restore in this run. Subsequent inference and native Stop worker recovery were separately observed in `2026-10-05-stop-history-repair.json`; these scopes must not be combined into an unperformed offline or restart acceptance claim.
