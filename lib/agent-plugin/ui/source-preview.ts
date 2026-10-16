import { renderSearchText } from './search-highlight';
import { safeSourceUri, sourceExcerpt } from '../connectors/reference-search';
export { safeSourceUri, sourceMatches } from '../connectors/reference-search';
export function sourcePreview(
  source: { title: string; text: string; uri?: string; truncated?: boolean },
  label: string,
  query = '',
  truncatedLabel = '…',
): HTMLElement {
  const details = document.createElement('details');
  details.className = 'agent-source-preview';
  const summary = document.createElement('summary');
  query = query.replace(/\s+/gu, ' ').trim().toLocaleLowerCase();
  renderSearchText(summary, source.title, query);
  const window = sourceExcerpt(source.text, query);
  const excerpt = document.createElement('pre');
  details.addEventListener('toggle', () => {
    if (details.open) renderSearchText(excerpt, window.text, query);
    else excerpt.replaceChildren();
  });
  details.append(summary, excerpt);
  if (window.partial || source.truncated) {
    const partial = document.createElement('small');
    partial.textContent = truncatedLabel;
    details.append(partial);
  }
  const uri = safeSourceUri(source.uri);
  if (uri) {
    const link = document.createElement('a');
    link.href = uri;
    link.textContent = label;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    details.append(link);
  }
  return details;
}
