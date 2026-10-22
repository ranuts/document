/** Block presentation shared by answer prose and artifact readers. */
export const MARKDOWN_BLOCK_CSS = `
.cui-markdown { --cui-code-inset:var(--ran-space-4, 16px); --cui-code-surface:var(--ran-color-bg-subtle, #fafafa); --cui-code-ink:var(--ran-color-text, #171717); --cui-code-rule:var(--ran-color-border, #e5e5e5); --cui-code-muted:var(--ran-color-text-secondary, #737373); }
.cui-markdown .cui-table { max-width:100%; box-sizing:border-box; overflow:auto; overscroll-behavior-x:contain; scrollbar-width:thin; margin-block:var(--ran-space-4, 16px); border-block:1px solid var(--cui-code-rule); }
.cui-markdown .cui-table table { width:100%; border-collapse:collapse; font-size:var(--ran-text-copy-2, 14px); line-height:1.65; overflow-wrap:normal; font-variant-numeric:tabular-nums; }
.cui-markdown .cui-table :is(th,td) { min-width:var(--ran-space-16, 64px); padding:var(--ran-space-3, 12px) var(--ran-space-4, 16px); text-align:left; vertical-align:top; border-bottom:1px solid var(--cui-code-rule); }
.cui-markdown .cui-table :is(th,td):first-child { padding-inline-start:0; }
.cui-markdown .cui-table :is(th,td):last-child { padding-inline-end:0; }
.cui-markdown .cui-table th { color:var(--cui-code-muted); font-weight:var(--ran-text-label-weight, 500); font-size:var(--ran-text-label-2, 13px); background:transparent; }
.cui-markdown .cui-table tbody tr:last-child td { border-bottom:0; }
.cui-markdown .cui-code { min-width:0; max-width:100%; box-sizing:border-box; overflow:hidden; margin-block:var(--ran-space-4, 16px); border:1px solid var(--cui-code-rule); border-radius:var(--ran-radius-sm, 6px); background:var(--cui-code-surface); color:var(--cui-code-ink); }
.cui-markdown .cui-code-header { display:flex; align-items:center; justify-content:space-between; gap:var(--ran-space-3, 12px); min-height:var(--ran-space-10, 40px); padding-inline:var(--cui-code-inset); border-bottom:1px solid var(--cui-code-rule); font-family:var(--ran-font-family, system-ui, sans-serif); font-size:var(--ran-text-label-3, 12px); line-height:1.5; color:var(--cui-code-muted); }
.cui-markdown .cui-code-language { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.cui-markdown .cui-code-copy { display:inline-flex; align-items:center; justify-content:center; gap:var(--ran-space-2, 8px); flex-shrink:0; min-height:var(--ran-size-7, 32px); padding:var(--ran-space-1, 4px) var(--ran-space-2, 8px); margin-inline-end:calc(-1 * var(--ran-space-2, 8px)); border:0; border-radius:var(--ran-radius-sm, 6px); background:transparent; color:inherit; font:inherit; cursor:pointer; }
.cui-markdown .cui-code-copy svg { display:block; width:var(--ran-size-1, 16px); height:var(--ran-size-1, 16px); flex-shrink:0; }
.cui-markdown .cui-code-copy:hover:not(:disabled) { background:var(--ran-color-bg-muted, #f4f4f4); color:var(--cui-code-ink); }
.cui-markdown .cui-code-copy:disabled { cursor:wait; }
.cui-markdown .cui-code pre { box-sizing:border-box; max-width:100%; overflow:auto; overscroll-behavior-x:contain; scrollbar-width:thin; margin:0; padding:var(--cui-code-inset); border:0; border-radius:0; background:transparent; color:inherit; white-space:pre; text-wrap:nowrap; font:var(--ran-text-copy-2, 14px)/1.65 var(--ran-font-mono, ui-monospace, monospace); tab-size:2; }
.cui-markdown .cui-code pre code { display:block; min-width:max-content; padding:0; border-radius:0; background:none; color:inherit; font:inherit; white-space:inherit; }
.cui-markdown > :is(.cui-code,.cui-table):first-child { margin-block-start:0; }
.cui-markdown > :is(.cui-code,.cui-table):last-child { margin-block-end:0; }
.cui-markdown .cui-code-token { color:var(--cui-token-light, inherit); }
.cui-markdown :is(.cui-code-copy,.cui-code pre,.cui-table):focus-visible { outline:2px solid var(--ran-color-link, #0070f3); outline-offset:-2px; }
:root:is([data-ran-theme='dark'],[theme='dark'],.dark) .cui-code-token { color:var(--cui-token-dark, inherit); }
@media (prefers-color-scheme:dark) { :root:not([data-ran-theme='light']):not([theme='light']):not(.light) .cui-code-token { color:var(--cui-token-dark, inherit); } }
@media (pointer:coarse) { .cui-markdown .cui-code-copy { min-height:var(--cui-control-touch, 44px); } .cui-markdown .cui-code-header { min-height:var(--cui-control-touch, 44px); } }
`;
export function ensureMarkdownStyles(): void {
  if (typeof document === 'undefined' || document.getElementById('cui-markdown-styles')) return;
  const style = document.createElement('style');
  style.id = 'cui-markdown-styles';
  style.textContent = MARKDOWN_BLOCK_CSS;
  document.head.append(style);
}
