# Actual CPU IM Stop and recovery

The production Word IM CPU fallback stopped after the first visible streaming delta. The composer unlocked in 27 ms, no error appeared, and the partial response remained unchanged after one second. The UI showed “Stopped.” and “Restore request”, without a preview card. After automatic engine reload reached “Model loaded”, a new greeting request counted tokens and generated normally.

The first driver attempted recovery while the model was still preparing; no generation action was emitted. Its failed raw report is retained. The corrected driver waits for actual readiness before sending. No product code was changed. Both use the normal product loader, observe worker actions only, and force CPU capability detection.

Evidence: `2026-10-04-cpu-count-im-stop.json` (early-send diagnostic), `2026-10-04-cpu-count-im-stop-ready.json` (successful ready recovery), and their matching probe scripts. This is one Chromium/default CPU path, not full offline or device certification.
