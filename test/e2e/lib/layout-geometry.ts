import type { Locator } from '@playwright/test';

/** Read text independently of its control's padding and flexible layout frame. */
export async function textGeometry(locator: Locator) {
  return locator.evaluate((element) => {
    const panel = element.closest('.agent-panel')!;
    const origin = panel.getBoundingClientRect().left + Number.parseFloat(getComputedStyle(panel).borderLeftWidth);
    const frame = element.getBoundingClientRect();
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    let first: Text | undefined;
    let last: Text | undefined;
    while (walker.nextNode()) {
      const node = walker.currentNode as Text;
      if (!node.textContent?.trim()) continue;
      first ??= node;
      last = node;
    }
    if (!first || !last) throw new Error('The measured control has no text');
    range.setStart(first, 0);
    range.setEnd(last, last.length);
    const text = range.getBoundingClientRect();
    return {
      left: frame.left - origin,
      right: frame.right - origin,
      width: frame.width,
      height: frame.height,
      textLeft: text.left - origin,
      textWidth: text.width,
    };
  });
}

export async function contentGeometry(view: Locator) {
  return view.evaluate((element) => {
    const panel = element.closest('.agent-panel')!;
    const origin = panel.getBoundingClientRect().left + Number.parseFloat(getComputedStyle(panel).borderLeftWidth);
    const left = (node: Element) => node.getBoundingClientRect().left - origin;
    const header = element.querySelector('.agent-view-header')!;
    const back = header.querySelector<HTMLButtonElement>('.agent-view-back')!;
    const heading = header.querySelector('h2')!;
    const style = getComputedStyle(element);
    return {
      contentLeft: left(element) + Number.parseFloat(style.paddingLeft),
      headingLeft: left(heading),
      iconLeft: left(back.querySelector('svg')!),
      backLeft: left(back),
      backWidth: back.getBoundingClientRect().width,
      overflow: element.scrollWidth - element.clientWidth,
      headerBottom: header.getBoundingClientRect().bottom,
    };
  });
}

/** Frame alignment is distinct from a framed field's deliberately inset text. */
export async function frameLeft(locator: Locator) {
  return locator.evaluate((element) => {
    const panel = element.closest('.agent-panel')!;
    return (
      element.getBoundingClientRect().left -
      panel.getBoundingClientRect().left -
      Number.parseFloat(getComputedStyle(panel).borderLeftWidth)
    );
  });
}
