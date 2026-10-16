/** Flat view chrome: callers retain navigation, labels and operation ownership. */
export function createViewHeader(heading: HTMLElement, back?: HTMLButtonElement): HTMLElement {
  const header = document.createElement('div');
  header.className = 'agent-view-header';
  if (back) header.append(back);
  header.append(heading);
  return header;
}

export function labelViewBack(back: HTMLButtonElement, destination: string): void {
  back.classList.add('agent-view-back');
  back.setAttribute('aria-label', destination);
  back.title = destination;
  back.innerHTML =
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m14 6-6 6 6 6"/></svg>';
}
