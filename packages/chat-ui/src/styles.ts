import { Style } from 'ranui/builder';

/**
 * Component styles, injected once into the document head on first construction
 * (so consumers don't need a separate CSS import). All classes are `cui-`
 * prefixed and variables are overridable via the `.cui-root` scope.
 *
 * Visual language follows modern AI chat UIs: bubble-less, full-width assistant
 * text for readability; a compact accent bubble for the user; a rounded composer
 * with an embedded circular send button; subtle tool/error chips.
 */
export const CHAT_UI_CSS = `
.cui-root {
  --cui-accent: #4f46e5;
  --cui-accent-contrast: #fff;
  --cui-bg: #fff;
  --cui-user-bg: #eef0ff;
  --cui-text: #1f2937;
  --cui-muted: #9ca3af;
  --cui-border: #e7e8ec;
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  background: var(--cui-bg);
  color: var(--cui-text);
  font-size: 14px;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}

/* ── Messages ─────────────────────────────────────────────────────────────*/
.cui-messages {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 18px 16px;
  display: flex;
  flex-direction: column;
  gap: 18px;
  overscroll-behavior: contain;
}
.cui-empty {
  margin: auto;
  color: var(--cui-muted);
  text-align: center;
  font-size: 13px;
  padding: 24px;
  max-width: 80%;
}
.cui-msg {
  display: flex;
  flex-direction: column;
  gap: 4px;
  animation: cui-rise 0.18s ease;
}
@keyframes cui-rise {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: none; }
}
.cui-role {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--cui-muted);
  padding: 0 2px;
}
.cui-bubble {
  white-space: pre-wrap;
  word-break: break-word;
  overflow-wrap: anywhere;
}

/* User: compact accent bubble, right-aligned. */
.cui-msg-user {
  align-self: flex-end;
  align-items: flex-end;
  max-width: 88%;
}
.cui-msg-user .cui-bubble {
  background: var(--cui-user-bg);
  color: var(--cui-text);
  padding: 9px 13px;
  border-radius: 16px 16px 4px 16px;
}

/* Assistant: bubble-less, full width for readable long-form answers. */
.cui-msg-agent {
  align-self: stretch;
}

/* Tool: a subtle inline status chip. */
.cui-msg-tool {
  align-self: flex-start;
}
.cui-msg-tool .cui-bubble {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #f4f5f7;
  color: #6b7280;
  font-size: 12px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  padding: 4px 10px;
  border-radius: 999px;
}
.cui-msg-tool .cui-bubble::before {
  content: '';
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #a3a3a3;
}

/* Error: subtle red block. */
.cui-msg-error {
  align-self: stretch;
}
.cui-msg-error .cui-bubble {
  background: #fef2f2;
  color: #b91c1c;
  border: 1px solid #fecaca;
  padding: 9px 13px;
  border-radius: 10px;
}

/* Streaming caret. */
.cui-streaming .cui-bubble::after {
  content: '';
  display: inline-block;
  width: 7px;
  height: 1.05em;
  margin-left: 3px;
  border-radius: 1px;
  vertical-align: text-bottom;
  background: var(--cui-accent);
  opacity: 0.7;
  animation: cui-blink 1s steps(2, start) infinite;
}
@keyframes cui-blink { to { visibility: hidden; } }

/* ── Footer (jump-to-latest + actions + composer) ─────────────────────────*/
.cui-footer {
  position: relative;
  flex: 0 0 auto;
  padding: 8px 12px 12px;
}
.cui-scroll-bottom {
  position: absolute;
  top: -46px;
  left: 50%;
  transform: translateX(-50%);
  width: 32px;
  height: 32px;
  /* A round button is round only if its 32px includes the UA's own 1px 6px
     button padding and this 1px border. Declared here rather than left to a
     host reset: this file ships in @ranuts/chat-ui, and a host without one
     renders these as ellipses (which is exactly what happened to the site's
     own launcher when its CSS framework went away). */
  box-sizing: border-box;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--cui-border);
  border-radius: 50%;
  background: var(--cui-bg);
  color: #4b5563;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
  transition: opacity 0.15s, transform 0.15s;
}
.cui-scroll-bottom:hover { color: var(--cui-text); }
.cui-hidden {
  opacity: 0;
  pointer-events: none;
  transform: translateX(-50%) translateY(6px);
}

/* Compose toolbar: host-populated quick actions just above the composer. */
.cui-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  padding: 0 4px 8px;
  font-size: 13px;
}
.cui-actions:empty {
  display: none;
}

/* Composer: rounded container with the textarea + an embedded send button. */
.cui-composer {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  padding: 8px 8px 8px 14px;
  border: 1px solid var(--cui-border);
  border-radius: 22px;
  background: var(--cui-bg);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  transition: border-color 0.15s, box-shadow 0.15s;
}
.cui-composer:focus-within {
  border-color: var(--cui-accent);
  box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.12);
}
.cui-input {
  flex: 1 1 auto;
  resize: none;
  border: none;
  outline: none;
  background: transparent;
  padding: 4px 0;
  font: inherit;
  line-height: 1.5;
  color: inherit;
  max-height: 160px;
}
.cui-input::placeholder { color: var(--cui-muted); }
.cui-send {
  flex: 0 0 auto;
  width: 32px;
  height: 32px;
  /* Same reason as .cui-scroll-bottom: the 32px circle owns its own box. */
  box-sizing: border-box;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  background: var(--cui-accent);
  color: var(--cui-accent-contrast);
  transition: background 0.15s, opacity 0.15s;
}
.cui-send:hover { filter: brightness(1.06); }
.cui-send:disabled {
  background: #e5e7eb;
  color: #b0b4bb;
  cursor: default;
}
.cui-send-stop { background: #6b7280; }
`;

let injected = false;

/** Inject the component stylesheet once per document (built via the ranui builder). */
export function ensureChatUiStyles(): void {
  if (injected || typeof document === 'undefined') return;
  if (document.getElementById('cui-styles')) {
    injected = true;
    return;
  }
  document.head.appendChild(Style().id('cui-styles').text(CHAT_UI_CSS).build());
  injected = true;
}
