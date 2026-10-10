# Actual partial assistant history: diagnostic freeze

Use the same native 0.5B/capped-32/nonstream reproduction harness and pinned original request report. Extract the cancelled first request's actual text chunks; insert that exact text between the old and current user messages as assistant. Compare raw partial text alone versus the same partial plus the truthful host annotation `[已停止。]`. Both original user messages and system remain unchanged. Fresh engine each, same temperature 0.7/top_p 0.8, no new seed. Commit before inference; capture requests/outputs/identities and cleanup.

This is observed development data, not unused transfer or a production history change. Do not pretend the partial is a completed answer. A passing current label does not certify persistence, continuation, tools, switching or other languages/models. Retain failures/truncations and assess the current-instruction outcome separately from mechanics.
