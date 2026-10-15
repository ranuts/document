# First microphone permission interrupted by model discovery

## Reproduction and cause

A clean Chrome profile can begin assistant dictation while its initial model
cache discovery is still pending. The cache check chooses Settings when no
remembered configuration or cached model exists. Previously, its view-revision
check covered explicit view changes but not interaction within Chat.

On the deployed site, a native Chrome speech probe captured `start`, followed
by the application calling `abort()`. The call stack passed through
`showView('settings')` after cache discovery. The chat view disappeared and the
recognition session closed without retaining a useful explanation. This can
race with the browser's first microphone permission prompt.

## Change

A chat click or draft input invalidates the pending default-view decision.
Clicks are captured before speech controls stop propagation. The background
check can still update the model inventory but cannot move an engaged user away
from Chat. Untouched first-use sessions still open Settings normally; explicit
Settings and view changes retain their existing behavior.

The change does not grant microphone permission, start another recognition
session automatically, load a model or submit a draft. Existing speech result,
Stop, Cancel and error handling remain authoritative.

## Verification

Three new unit regressions failed against the old code because cache completion
switched to Settings: permission still pending, recognition already listening,
and an edited draft. The panel, loading and speech unit suites pass after the
fix (176 tests), as do lint and application/workspace type checks.

A real-editor browser regression holds initial SDK discovery while microphone
permission is pending, releases it, then checks recognition results still reach
the composer and explicit Settings remains available. All nine selected Chromium
cases passed, including existing dictation across the four document editors and
Stop/resume. The production build passed.

A separate Chrome 155 probe against the fixed production build used generated
audio and native recognition, without mocking recognition results. It captured
`start`, `audiostart`, `speechstart` and `result`; the draft became nonempty,
Chat remained visible, and the application made no abort call. Browser
microphone permission was granted to the isolated automated context. This does
not verify the user's physical microphone, a manual permission dialog or their
recognition-service connection.
