# Sequence history in actual IM

Two actual current CPU Excel IM runs completed the literal read-before-write sequence, enabled local history saving through the visible settings checkbox, downloaded the real JSON export, and reloaded the page. The active session contained exactly the original user request, complete pre-write range result with B2=30, and verified final write status. Each result retained hostGuidance=tool. The reused profile retained earlier saved sessions; inactive sessions are not assumed empty. After reload, the restored activity and user request matched the original content exactly.

The second run also created a new conversation: it had no prior activity results. Switching back to the exported active session restored the exact two-step activity. The original save preference was false and was restored through the checkbox after verification. No conversation content was sent externally or inference output replaced. Existing browser profile model caches were reused.

The verifier checks actual exported messages, the active session, restored UI and completed-conversation switching. It does not certify a switch during an executing sequence, full browser-process restart for this exact sequence, or cancellation between steps. Those failure-path requirements remain open. No product code changed.

The first verifier incorrectly required all inactive sessions to be empty, which failed because the second run preserved the first run’s saved session. That assumption was removed; raw exports were unchanged. New-conversation emptiness and restoration checks still pass.
