# Speech toolbar stability

## Observed failure

The first microphone click changed the real DOCX composer's height from 134px
(idle) to 180.375px (listening). The privacy paragraph was inserted into the
composer flow, status padding changed between states, and cancellation was
added and removed from the toolbar. The conversation pane consequently shrank,
which explains the large apparent flash. Rendering also replaced the microphone
and cancellation SVG nodes on every state update.

## Change

Keep microphone, language, live state, cancellation and privacy in one compact
compose toolbar. Reserve the status and cancellation lanes in idle state, retain
SVG identity, and limit animation to the actual permission/finalization spinner.
Listening has a steady selected stop button. Privacy and full error details use the existing ranui `r-popover` with its
body-level portal, so opening them does not resize the draft. Passive disclosures
close after three seconds; pointer hover or keyboard focus pauses this timer.
Escape dismisses the disclosure before cancelling dictation. Recording and
finalization status remain visible, and errors remain inline after their popover
closes. The info control can reopen the full current error.

The interaction follows the compact voice button and processing-state treatment
in [AI Elements Speech Input](https://elements.ai-sdk.dev/components/speech-input).
The application retains its editable interim transcript, recognition-language
selector, cancellation policy and existing ranui tokens.

## Verification

- Red-before-green unit regression: status lived outside the toolbar and icons
  were remounted. It now preserves toolbar containment and both SVG nodes.
- Red-before-green real DOCX regression: composer height differed by 46.375px
  when listening. Starting, listening and finishing now preserve its bounds.
- Real DOCX, XLSX, PPTX and PDF editor E2E: unchanged composer/message-pane
  geometry, Stop followed by Send waits for the final transcript, a single
  request is sent, cancellation restores a 12-line draft, and disclosure
  keyboard opening/dismissal preserves geometry and returns focus.
- DOCX at the minimum 320px panel width: no toolbar overflow or state movement;
  reduced-motion preference disables spinner animation. A further failing
  assertion caught a truncated listening label at this width: active status now
  uses the reserved language lane, and the disabled selector returns on idle.
  The full listening label fits without moving microphone or trailing controls.
  Persistent error feedback uses the same lane so it does not collapse into a
  one-letter fragment.
- Speech unit suite: 25 passing; focused formatting/lint and TypeScript checking
  passed. Existing bounded two-second finalization, late-event isolation,
  manual-edit preservation and recognition-error tests remain covered.
- Real portal hover testing caught a stacking mismatch: the default dropdown
  layer was behind the assistant panel. The speech popover now shares the
  existing application select-portal layer; no vendor code was modified.
- Real browser privacy tests cover passive expiry, keyboard-focus retention,
  portalled-content hover retention, Escape and outside-click dismissal. Error
  text remains accessible and can be reopened after passive popover expiry.

Browser speech events and the AI endpoint are controlled in E2E. Editor frames,
composer components and browser layout are real. Physical microphone recognition,
external browser speech-service latency and operating-system permission prompts
were not verified by these tests.
