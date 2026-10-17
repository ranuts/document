# Site token consistency evidence

Five baseline contracts failed before implementation: modal heading, zero-size mobile
home links, removed/fallback-masked roles, enabled hover feedback on disabled queue
controls, and incomplete destructive button state hooks. These were reproduced before
owner-level changes; the evidence log is a local verification artifact, not repository
content.

The application role layer is shared by source-generated and handwritten page heads.
The token audit resolves HTML from its linked stylesheet dependencies, so removing the
application layer cannot pass merely because some unrelated page defines its roles.
Shared chat intentionally owns its standalone touch target role and real foundation
fallbacks. Negative fixtures cover unknown foundation roles, removed local aliases,
missing consumer dependencies and literal semantic metric drift.

The first browser run found that retaining the wordmark alone was insufficient in the
320px embed header: its non-shrinking nav/theme controls could still consume all space.
The fix reserves a readable brand lane and lets navigation wrap. The same run verified
history open, search, paging, single delete, cancel, clear, download and stored reopening.
Subsequent browser verification uses a fresh isolated port/build after final source edits.

The real keyboard regression also exposed a modal integration mismatch: ranui's
focusable selector cannot discover a button hidden behind another component's closed
shadow root. Native modal footer actions and native destructive history triggers
participate in the modal's supported focus contract. Escape and Cancel restore a
real button that Enter can use again; no private shadow references or temporary
host tabindex workaround is shipped. Default, hover and active destructive colours
are measured from rendered surfaces and meet 4.5:1 contrast in both themes.
