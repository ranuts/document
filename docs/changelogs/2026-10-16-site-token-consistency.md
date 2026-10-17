# Site design token consistency

The mobile header keeps a textual home destination on every page family, including
history and the embed demo. When navigation needs more room it wraps within its own
lane instead of shrinking the home link to zero. No app tile is used as header identity.

Confirmation dialogs use ranui's current `heading` API. Native footer actions and
destructive history triggers restore a usable keyboard focus target after dismissal. Destructive commands retain
their semantic default, hover and active colours, disabled controls stay quiet, and
keyboard focus is visible. The 404 illustration uses current theme and font roles.

Application density roles centralize 42px page actions, 32px inline commands and 44px
touch targets. History, page CTAs, demo controls, assistant queue, dictation, review and
result commands share the policy. The role stylesheet participates in offline asset
collection and deploy revalidation. Shared chat owns independent component defaults.

A CI-enforced audit covers authored CSS, shared chat, inline HTML styles and fresh
localized page output. It rejects undefined roles even behind fallbacks, missing role
stylesheet dependencies and unowned semantic metric literals. Browser regressions
cover real ranui rendering, all page families, seven locales, light/dark, narrow
layouts, touch commands and disabled hover feedback.
