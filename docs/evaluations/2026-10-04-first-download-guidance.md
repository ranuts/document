# First-download failure guidance

The fresh model-cache test identified a generic load error that offered retry/model selection but omitted the first download's network requirement. Update the existing failure message in all seven shell languages to state that the first model download requires internet. Keep retry/model selection guidance, with no new controls, dialogs or confirmation flow. The wording states a download requirement, not that every load failure is caused by network; importing local model files remains available.

Build passed before tests. Full unit suite: 116 files / 4256 tests passed, with existing asynchronous rejection-handled warnings. Source lint excluding existing .scratch vendor copies, TypeScript and Docker config passed.

Actual Chromium replay of a fresh no-storage context, automatic mode with GPU unavailable and all external HTTP blocked showed the new English message in both the panel note and chat error. Model-load button was enabled after failure; manual retry performed another static GGUF HEAD attempt and returned the updated guidance. No page errors or observed cloud inference requests. Browser closed. This is an English runtime check plus seven localized source updates, not physical-device or full-offline navigation acceptance. No model download performed.

Run verify-first-download-guidance-browser.py to check probe identity, message presence, retry and observed request scope in the raw report. The earlier blocked-download report retains the previous generic wording for historical comparison. Broader writing quality remains unaccepted.
