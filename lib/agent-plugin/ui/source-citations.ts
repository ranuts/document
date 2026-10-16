import { sourcePreview } from './source-preview';
import type { SourceEvidence } from './request-context';
/** The host supplies only request-final evidence. Model-created ids never create authority. */
export function presentSourceCitations(
  bubble: HTMLElement,
  metadata: Readonly<Record<string, unknown>> | undefined,
  openLabel: string,
  truncatedLabel?: string,
): void {
  if (!Array.isArray(metadata?.evidence)) return;
  const sources = new Map<string, SourceEvidence>();
  for (const source of metadata.evidence.slice(0, 5))
    if (source && /^S[1-5]$/.test(source.id) && typeof source.text === 'string' && typeof source.title === 'string')
      sources.set(source.id, source);
  let activePreview: { id: string; el: HTMLDetailsElement } | undefined;
  const triggers: HTMLButtonElement[] = [];
  const sync = () => {
    for (const trigger of triggers)
      trigger.setAttribute(
        'aria-expanded',
        String(activePreview?.id === trigger.dataset.sourceId && activePreview.el.open),
      );
  };
  const walker = document.createTreeWalker(bubble, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    if (!node.parentElement?.closest('a,button,pre,code,.agent-source-preview') && /\[S[1-5]\]/.test(node.data))
      nodes.push(node);
  }
  for (const node of nodes) {
    const fragment = document.createDocumentFragment();
    let offset = 0;
    for (const match of node.data.matchAll(/\[(S[1-5])\]/g)) {
      const source = sources.get(match[1]);
      if (!source) continue;
      fragment.append(document.createTextNode(node.data.slice(offset, match.index)));
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'agent-source-citation';
      button.textContent = match[0];
      button.setAttribute('aria-label', `${openLabel}: ${source.title}`);
      button.setAttribute('aria-expanded', 'false');
      button.dataset.sourceId = source.id;
      triggers.push(button);
      button.addEventListener('click', () => {
        if (activePreview?.id === source.id && activePreview.el.open) {
          activePreview.el.remove();
          activePreview = undefined;
          sync();
          return;
        }
        activePreview?.el.remove();
        const preview = sourcePreview(source, openLabel, '', truncatedLabel) as HTMLDetailsElement;
        activePreview = { id: source.id, el: preview };
        preview.open = true;
        preview.addEventListener('toggle', sync);
        bubble.append(preview);
        sync();
      });
      fragment.append(button);
      offset = match.index! + match[0].length;
    }
    fragment.append(document.createTextNode(node.data.slice(offset)));
    node.replaceWith(fragment);
  }
}
