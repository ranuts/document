import { Style } from 'ranui/builder';

/**
 * Component styles, injected once into the document head on first construction
 * (so consumers don't need a separate CSS import). All classes are `cui-`
 * prefixed and variables are overridable via the `.cui-root` scope.
 *
 * Visual language follows modern AI chat UIs: bubble-less, full-width assistant
 * text for readability; a compact accent bubble for the user; a rounded composer
 * with aligned send and stop controls; subtle tool/error chips.
 */
export const CHAT_UI_CSS = `
.cui-root { --cui-control-touch:44px; --cui-accent:var(--ran-color-primary, #171717); --cui-accent-contrast:var(--ran-color-primary-text, #fff); --cui-bg:var(--ran-color-bg, #fff); --cui-user-bg:var(--ran-color-bg-muted, #f4f4f4); --cui-text:var(--ran-color-text, #171717); --cui-muted:var(--ran-color-text-secondary, #737373); --cui-border:var(--ran-color-border, #e5e5e5); --cui-surface:var(--ran-color-bg-subtle, var(--cui-user-bg)); position:relative; display:flex; flex-direction:column; min-height:0; height:100%; background:var(--cui-bg); color:var(--cui-text); font-family:var(--ran-font-family, system-ui, sans-serif); font-size:var(--ran-text-copy-2, 14px); line-height:1.7; -webkit-font-smoothing:antialiased; }
.cui-messages { flex:1 1 auto; min-height:0; overflow:auto; overflow-x:hidden; padding:var(--ran-space-6, 24px) var(--ran-space-4, 16px); display:flex; flex-direction:column; gap:calc(var(--ran-space-4, 16px) + var(--ran-space-1, 4px)); overscroll-behavior:contain; scrollbar-width:thin; }
.cui-load-earlier, .cui-history-expand { align-self:flex-start; max-width:100%; padding:var(--ran-space-2, 8px) var(--ran-space-3, 12px); border:1px solid var(--cui-border); border-radius:var(--ran-radius-sm, 6px); background:transparent; color:var(--cui-muted); font:inherit; font-size:var(--ran-text-label-3, 12px); cursor:pointer; }
.cui-load-earlier:focus-visible, .cui-history-expand:focus-visible { outline:2px solid var(--ran-color-link, currentColor); outline-offset:2px; }
.cui-history-expand { display:block; margin-top:var(--ran-space-2, 8px); }
.cui-load-earlier[hidden] { display:none; }
.cui-empty { margin:auto; max-width:260px; padding:var(--ran-space-8, 32px) var(--ran-space-2, 8px); text-align:left; font-size:var(--ran-text-heading-3, 20px); font-weight:500; line-height:1.45; letter-spacing:-.035em; color:var(--cui-text); }
.cui-empty-actions { margin-top:var(--ran-space-4, 16px); font-size:var(--ran-text-label-3, 12px); letter-spacing:0; font-weight:400; }
.cui-empty-actions button { font:inherit; color:var(--cui-muted); border:1px solid var(--cui-border); background:transparent; padding:var(--ran-space-1, 4px) var(--ran-space-3, 12px); min-height:var(--ran-size-7, 32px); border-radius:var(--ran-radius-sm, 6px); cursor:pointer; }
.cui-msg { display:flex; flex-direction:column; gap:var(--ran-space-2, 8px); min-width:0; }
.cui-bubble { white-space:pre-wrap; overflow-wrap:anywhere; }
.cui-msg-user { align-self:flex-end; max-width:88%; }
.cui-msg-user .cui-bubble { background:var(--cui-user-bg); padding:var(--ran-space-2, 8px) var(--ran-space-3, 12px); border-radius:var(--ran-radius-lg, 16px); }
.cui-msg-agent { align-self:stretch; }
/* Host-marked drafts keep their identity header and full reading width.
   Review receipts keep their separate disclosure without nesting surfaces. */
.cui-msg-agent[data-document-artifact] { box-sizing:border-box; padding:0; gap:var(--ran-space-3, 12px); border:0; border-radius:0; background:transparent; }
.cui-result-header { display:flex; align-items:center; min-width:0; gap:var(--ran-space-2, 8px); color:var(--cui-muted); font-size:var(--ran-text-label-3, 12px); font-weight:var(--ran-text-label-weight, 500); line-height:1.5; }
.cui-result-icon { display:inline-flex; flex:0 0 var(--ran-size-1, 16px); align-items:center; justify-content:center; }
.cui-result-icon svg { width:var(--ran-size-1, 16px); height:var(--ran-size-1, 16px); }
.cui-result-label { overflow-wrap:anywhere; }
.cui-msg-agent[data-document-artifact] .cui-message-actions { border-top:1px solid var(--cui-border); padding-top:var(--ran-space-2, 8px); }
.cui-msg-agent[data-interrupted] .cui-result-icon { opacity:.65; }
.cui-msg-agent .cui-bubble { white-space:normal; line-height:1.75; }
.cui-bubble.cui-stream-raw,.cui-stream-raw { white-space:pre-wrap; }
.cui-bubble p { margin:0 0 var(--ran-space-3, 12px); }
.cui-bubble p:last-child { margin-bottom:0; }
.cui-bubble h2,.cui-bubble h3,.cui-bubble h4,.cui-bubble h5,.cui-bubble h6 { font-size:inherit; line-height:1.4; margin:var(--ran-space-6, 24px) 0 var(--ran-space-2, 8px); font-weight:var(--ran-text-heading-weight, 600); text-wrap:pretty; }
.cui-bubble h2 { font-size:var(--ran-text-heading-3, 20px); letter-spacing:var(--ran-text-heading-tracking, -.03em); }
.cui-bubble h3 { font-size:var(--ran-text-heading-4, 16px); }
.cui-bubble :is(h2,h3,h4,h5,h6):first-child { margin-top:0; }
.cui-bubble ul,.cui-bubble ol { padding-left:var(--ran-space-6, 24px); margin:var(--ran-space-2, 8px) 0 var(--ran-space-3, 12px); }
.cui-bubble li { padding-left:calc(var(--ran-space-1, 4px) / 2); margin:var(--ran-space-1, 4px) 0; }
.cui-bubble blockquote { margin:var(--ran-space-3, 12px) 0; border-left:2px solid var(--cui-border); padding-left:var(--ran-space-3, 12px); color:var(--cui-muted); }
.cui-bubble code { font-family:var(--ran-font-mono, ui-monospace, monospace); font-size:.88em; background:var(--cui-user-bg); padding:calc(var(--ran-space-1, 4px) / 2) var(--ran-space-1, 4px); border-radius:var(--ran-radius-sm, 6px); }
.cui-bubble pre { margin:var(--ran-space-3, 12px) 0; border:1px solid var(--cui-border); background:var(--cui-user-bg); padding:var(--ran-space-3, 12px); border-radius:var(--ran-radius-sm, 6px); overflow:auto; white-space:pre; line-height:1.55; }
.cui-bubble pre code { padding:0; background:none; font-size:inherit; }
.cui-bubble pre { font-size:var(--ran-text-label-2, 13px); tab-size:2; text-wrap:nowrap; }
.cui-bubble > :first-child { margin-top:0; }
.cui-bubble > :last-child { margin-bottom:0; }
.cui-bubble li > p { margin:0 0 var(--ran-space-2, 8px); }
.cui-bubble li > :last-child { margin-bottom:0; }
.cui-bubble li > :is(ul,ol) { margin-bottom:0; }
.cui-bubble pre,.cui-table { max-width:100%; box-sizing:border-box; overscroll-behavior-x:contain; }
.cui-bubble a { color:var(--cui-text); text-underline-offset:3px; }
.cui-table { overflow:auto; margin:var(--ran-space-3, 12px) 0; border:1px solid var(--cui-border); border-radius:var(--ran-radius-sm, 6px); }
.cui-table table { border-collapse:collapse; font-size:var(--ran-text-label-2, 13px); line-height:1.55; min-width:100%; overflow-wrap:normal; }
.cui-table th,.cui-table td { border-bottom:1px solid var(--cui-border); padding:var(--ran-space-2, 8px) var(--ran-space-3, 12px); text-align:left; vertical-align:top; }
.cui-table th { background:var(--cui-user-bg); font-weight:var(--ran-text-label-weight, 500); font-size:var(--ran-text-label-2, 13px); }
.cui-table tr:last-child td { border-bottom:0; }
.cui-message-actions { display:flex; align-items:center; flex-wrap:wrap; gap:var(--ran-space-1, 4px); }
.cui-message-actions button { border:0; background:transparent; color:var(--cui-muted); cursor:pointer; font:inherit; font-size:var(--ran-text-label-3, 12px); min-height:var(--ran-size-7, 32px); padding:var(--ran-space-1, 4px) var(--ran-space-2, 8px); border-radius:var(--ran-radius-sm, 6px); }
.cui-message-actions button:hover:not(:disabled) { color:var(--cui-text); background:var(--cui-user-bg); }
.cui-message-actions button:disabled { opacity:.5; cursor:default; }
.cui-message-actions .cui-apply { color:var(--cui-text); font-weight:var(--ran-text-label-weight, 500); }
.cui-message-actions .cui-save[data-state='saved'] { color:var(--cui-text); }
.cui-message-actions .cui-follow-up { padding-inline:var(--ran-space-1, 4px); }
.cui-message-actions .cui-copy { flex:0 0 var(--ran-size-7, 32px); width:var(--ran-size-7, 32px); padding:0; display:inline-flex; align-items:center; justify-content:center; }
.cui-message-actions .cui-copy svg { flex-shrink:0; }
.cui-apply-status { color:var(--cui-muted); font-size:var(--ran-text-label-3, 12px); }
.cui-feedback { position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip-path:inset(50%); white-space:nowrap; border:0; }
.cui-root :is(button,summary,pre,.cui-table):focus-visible { outline:2px solid var(--ran-color-link, #0070f3); outline-offset:3px; }
.cui-streaming .cui-message-actions { display:none; }
.cui-streaming .cui-bubble { white-space:pre-wrap; }
.cui-streaming.cui-streaming-markdown .cui-bubble { white-space:normal; }
.cui-activity { box-sizing:border-box; color:var(--cui-muted); font-size:var(--ran-text-label-3, 12px); line-height:1.6; padding:var(--ran-space-1, 4px) 0 var(--ran-space-1, 4px) var(--ran-space-3, 12px); border-left:1px solid var(--cui-border); white-space:pre-wrap; overflow-wrap:anywhere; }
.cui-activity summary { cursor:pointer; padding:var(--ran-space-1, 4px) 0; border-radius:var(--ran-radius-sm, 6px); }
.cui-activity ul { list-style:none; margin:var(--ran-space-1, 4px) 0 0; padding-left:var(--ran-space-4, 16px); }
.cui-activity li { padding:var(--ran-space-1, 4px) 0; }
.cui-msg-status { color:var(--cui-muted); font-size:var(--ran-text-label-3, 12px); }
.cui-msg-error .cui-bubble { padding:var(--ran-space-2, 8px) var(--ran-space-3, 12px); border-left:2px solid var(--cui-border); border-radius:0 var(--ran-radius-sm, 6px) var(--ran-radius-sm, 6px) 0; background:var(--cui-surface); font-size:var(--ran-text-label-2, 13px); line-height:1.6; }
.cui-reasoning { min-width:0; --ran-reasoning-color:var(--cui-muted); --ran-reasoning-font-size:var(--ran-text-label-2, 13px); --ran-reasoning-border-color:var(--cui-border); --ran-disclosure-color:var(--cui-muted); --ran-disclosure-summary-color:var(--cui-muted); --ran-disclosure-font-size:var(--ran-text-label-2, 13px); --ran-disclosure-row-height:var(--ran-size-7, 32px); --ran-disclosure-transition:var(--ran-motion-duration-fast, 150ms); --ran-disclosure-toggle-duration:var(--ran-motion-duration-base, 200ms); }
.cui-reasoning-notice { margin:var(--ran-space-1, 4px) 0 0 var(--ran-space-3, 12px); color:var(--cui-muted); font-size:var(--ran-text-label-3, 12px); }
.cui-progress { flex:0 0 auto; display:flex; align-items:baseline; gap:var(--ran-space-3, 12px); margin:0 var(--ran-space-4, 16px); padding:var(--ran-space-2, 8px) 0; min-width:0; }
.cui-status { flex:1; min-width:0; display:flex; align-items:center; gap:var(--ran-space-2, 8px); color:var(--cui-muted); font-size:var(--ran-text-label-3, 12px); line-height:1.5; }
.cui-elapsed { flex:0 0 auto; margin-left:auto; color:var(--cui-muted); font-size:var(--ran-text-label-3, 12px); line-height:1.5; font-variant-numeric:tabular-nums; white-space:nowrap; }
.cui-progress[hidden],.cui-elapsed[hidden] { display:none; }
.cui-status:empty { display:none; }
/* One activity cue at a time: the waiting row gives way to the live-text
   cursor when responding. A human review is a resting state, not loading. */
.cui-root:is([data-activity="responding"],[data-activity="routing"],[data-activity="reading"],[data-activity="planning"]) .cui-status::before { content:''; flex:0 0 auto; width:12px; height:12px; box-sizing:border-box; border:1.5px solid var(--cui-border); border-top-color:currentColor; border-right-color:currentColor; border-radius:50%; animation:cui-loading-turn 1s linear infinite; }
.cui-footer { position:relative; flex:0 0 auto; padding:var(--ran-space-3, 12px) var(--ran-space-4, 16px) var(--ran-space-4, 16px); }
.cui-scroll-bottom { position:absolute; top:-40px; left:50%; transform:translateX(-50%); width:var(--ran-size-7, 32px); height:var(--ran-size-7, 32px); box-sizing:border-box; padding:0; display:flex; align-items:center; justify-content:center; border:1px solid var(--cui-border); border-radius:50%; background:var(--cui-bg); color:var(--cui-muted); cursor:pointer; box-shadow:var(--ran-shadow-elevated, none); }
.cui-scroll-bottom[hidden] { display:none; }
.cui-composer { display:flex; flex-direction:column; min-width:0; gap:var(--ran-space-3, 12px); padding:var(--ran-space-3, 12px); border:1px solid var(--cui-border); border-radius:var(--ran-radius-md, 12px); background:var(--cui-bg); }
.cui-pending:empty { display:none; }
.cui-stop[hidden] { display:none; }
.cui-root .cui-stop { background:transparent; color:var(--cui-text); border:0; }
.cui-composer:focus-within { border-color:var(--cui-muted); outline:1px solid var(--cui-border); outline-offset:0; }
.cui-composer-bar { display:flex; align-items:center; min-width:0; min-height:var(--ran-size-7, 32px); gap:var(--ran-space-2, 8px); }
.cui-actions { display:flex; flex:1; min-width:0; align-items:center; gap:var(--ran-space-1, 4px); font-size:var(--ran-text-label-3, 12px); flex-wrap:wrap; }
.cui-context:empty { display:none; }
.cui-input { min-width:0; width:100%; box-sizing:border-box; resize:none; overflow-y:auto; border:0; outline:none; background:transparent; padding:0; font:inherit; line-height:1.5; color:inherit; max-height:160px; min-height:3em; scrollbar-width:thin; }
.cui-input::placeholder { color:var(--cui-muted); }
.cui-send, .cui-stop { flex:0 0 auto; width:var(--ran-size-7, 32px); height:var(--ran-size-7, 32px); box-sizing:border-box; padding:0; display:flex; align-items:center; justify-content:center; border:0; border-radius:var(--ran-radius-sm, 6px); cursor:pointer; background:var(--cui-accent); color:var(--cui-accent-contrast); transition:scale var(--ran-motion-duration-fast, 150ms) var(--ran-motion-ease-standard, ease); }
.cui-send:active:not(:disabled), .cui-stop:active:not(:disabled) { scale:.94; }
.cui-send:hover:not(:disabled) { background:color-mix(in srgb, var(--cui-accent) 85%, var(--cui-bg)); }
.cui-root .cui-stop:hover:not(:disabled) { background:var(--cui-user-bg); border-color:var(--cui-muted); }
.cui-send:disabled, .cui-stop:disabled { background:var(--cui-surface); color:var(--cui-muted); opacity:.5; cursor:default; }
@media (pointer:coarse) {
  .cui-reasoning { --ran-disclosure-row-height:var(--cui-control-touch); }
  .cui-send, .cui-stop, .cui-scroll-bottom { width:var(--cui-control-touch); height:var(--cui-control-touch); }
  .cui-message-actions button, .cui-empty-actions button, .cui-load-earlier, .cui-history-expand { min-height:var(--cui-control-touch); }
  .cui-message-actions .cui-copy { width:var(--cui-control-touch); flex-basis:var(--cui-control-touch); }
}
.cui-root .cui-send.cui-send-prepare { width:auto; max-width:100%; padding:0 var(--ran-space-2, 8px); font:inherit; font-size:var(--ran-text-label-3, 12px); background:transparent; color:var(--cui-text); border:1px solid var(--cui-border); }
.cui-streaming:not(.cui-streaming-markdown) .cui-bubble::after { content:''; display:inline-block; width:6px; height:6px; margin-left:var(--ran-space-1, 4px); border-radius:50%; background:currentColor; vertical-align:middle; }
.cui-root[data-activity="responding"] .cui-streaming:not(.cui-streaming-markdown) .cui-bubble::after { animation:cui-answer-pulse 1.4s ease-in-out infinite; }
@keyframes cui-loading-turn { to { transform:rotate(360deg); } }
@keyframes cui-answer-pulse { 0%,100% { opacity:.45; transform:scale(.85); } 50% { opacity:1; transform:scale(1.15); } }
@media (prefers-reduced-motion:reduce) {
  .cui-send, .cui-stop { transition:none; scale:1; }
  .cui-root[data-activity] .cui-status::before,.cui-root[data-activity] .cui-streaming .cui-bubble::after { animation:none; transform:none; opacity:1; }
}
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
