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
.cui-root { --cui-accent:#171717; --cui-accent-contrast:#fff; --cui-bg:#fff; --cui-user-bg:#f4f4f4; --cui-text:#171717; --cui-muted:#737373; --cui-border:#e5e5e5; position:relative; display:flex; flex-direction:column; min-height:0; height:100%; background:var(--cui-bg); color:var(--cui-text); font-size:14px; line-height:1.65; -webkit-font-smoothing:antialiased; }
.cui-messages { flex:1 1 auto; min-height:0; overflow:auto; overflow-x:hidden; padding:24px 20px; display:flex; flex-direction:column; gap:24px; overscroll-behavior:contain; scrollbar-width:thin; }
.cui-empty { margin:auto; max-width:260px; padding:32px 8px; text-align:left; font-size:22px; font-weight:500; line-height:1.45; letter-spacing:-.035em; color:var(--cui-text); }
.cui-empty-actions { margin-top:20px; font-size:12px; letter-spacing:0; font-weight:400; }
.cui-empty-actions button { font:inherit; color:var(--cui-muted); border:1px solid var(--cui-border); background:transparent; padding:7px 12px; border-radius:8px; cursor:pointer; }
.cui-msg { display:flex; flex-direction:column; gap:8px; min-width:0; }
.cui-bubble { white-space:pre-wrap; overflow-wrap:anywhere; }
.cui-msg-user { align-self:flex-end; max-width:88%; }
.cui-msg-user .cui-bubble { background:var(--cui-user-bg); padding:10px 14px; border-radius:16px; }
.cui-msg-agent { align-self:stretch; }
.cui-msg-agent .cui-bubble { white-space:normal; }
.cui-bubble p { margin:0 0 12px; }
.cui-bubble p:last-child { margin-bottom:0; }
.cui-bubble h2,.cui-bubble h3,.cui-bubble h4,.cui-bubble h5,.cui-bubble h6 { font-size:1.08em; line-height:1.45; margin:20px 0 8px; font-weight:600; }
.cui-bubble :is(h2,h3,h4,h5,h6):first-child { margin-top:0; }
.cui-bubble ul,.cui-bubble ol { padding-left:22px; margin:8px 0 14px; }
.cui-bubble li { padding-left:2px; margin:4px 0; }
.cui-bubble blockquote { margin:12px 0; border-left:2px solid var(--cui-border); padding-left:12px; color:var(--cui-muted); }
.cui-bubble code { font-family:ui-monospace,monospace; font-size:.88em; background:var(--cui-user-bg); padding:2px 4px; border-radius:4px; }
.cui-bubble pre { margin:12px 0; background:var(--cui-user-bg); padding:12px; border-radius:10px; overflow:auto; white-space:pre; }
.cui-bubble pre code { padding:0; background:none; }
.cui-bubble a { color:var(--cui-text); text-underline-offset:3px; }
.cui-table { overflow:auto; }
.cui-table table { border-collapse:collapse; font-size:13px; }
.cui-table th,.cui-table td { border-bottom:1px solid var(--cui-border); padding:8px; text-align:left; }
.cui-message-actions { display:flex; gap:8px; }
.cui-message-actions button { border:0; background:transparent; color:var(--cui-muted); cursor:pointer; font:inherit; font-size:11px; min-height:28px; padding:4px; border-radius:6px; }
.cui-message-actions button:hover { color:var(--cui-text); background:var(--cui-user-bg); }
.cui-message-actions button:disabled { opacity:.5; cursor:default; }
.cui-root button:focus-visible { outline:2px solid var(--cui-accent); outline-offset:3px; }
.cui-streaming .cui-message-actions { display:none; }
.cui-streaming .cui-bubble { white-space:pre-wrap; }
.cui-activity { color:var(--cui-muted); font-size:12px; margin:-10px 0; white-space:pre-wrap; overflow-wrap:anywhere; }
.cui-activity summary { cursor:pointer; padding:6px 0; }
.cui-activity ul { list-style:none; margin:4px 0 8px 5px; border-left:1px solid var(--cui-border); padding-left:16px; }
.cui-activity li { padding:4px 0; }
.cui-msg-status { color:var(--cui-muted); font-size:12px; }
.cui-msg-error .cui-bubble { padding:12px; border:1px solid var(--cui-border); border-radius:10px; font-size:13px; }
.cui-status { flex:0 0 auto; padding:0 20px 12px; color:var(--cui-muted); font-size:12px; }
.cui-status:empty { display:none; }
.cui-footer { position:relative; flex:0 0 auto; padding:12px 16px 16px; }
.cui-scroll-bottom { position:absolute; top:-40px; left:50%; transform:translateX(-50%); width:32px; height:32px; box-sizing:border-box; padding:0; display:flex; align-items:center; justify-content:center; border:1px solid var(--cui-border); border-radius:50%; background:var(--cui-bg); color:var(--cui-muted); cursor:pointer; box-shadow:0 2px 6px #00000012; }
.cui-scroll-bottom[hidden] { display:none; }
.cui-composer { display:flex; flex-direction:column; padding:12px; border:1px solid var(--cui-border); border-radius:12px; background:var(--cui-bg); }
.cui-composer:focus-within { border-color:var(--cui-muted); }
.cui-composer-bar { display:flex; align-items:center; gap:8px; margin-top:12px; }
.cui-actions { display:flex; flex:1; min-width:0; align-items:center; gap:6px; font-size:12px; flex-wrap:wrap; }
.cui-input { min-width:0; width:100%; box-sizing:border-box; resize:none; border:0; outline:none; background:transparent; padding:0; font:inherit; line-height:1.5; color:inherit; max-height:160px; min-height:40px; }
.cui-input::placeholder { color:var(--cui-muted); }
.cui-send { flex:0 0 auto; width:30px; height:30px; box-sizing:border-box; padding:0; display:flex; align-items:center; justify-content:center; border:0; border-radius:8px; cursor:pointer; background:var(--cui-accent); color:var(--cui-accent-contrast); }
.cui-send:disabled { opacity:.35; cursor:default; }
.cui-streaming .cui-bubble::after { content:''; display:inline-block; width:6px; height:6px; margin-left:5px; border-radius:50%; background:currentColor; vertical-align:middle; }
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
