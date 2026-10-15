import { ButtonBuilder, Div, Span, View } from 'ranui/builder';

/** Selection disclosure owns presentation only; toggling never reads or changes the editor. */
export function createComposerSelection() {
  const el = Div().class('agent-quote-context').attr('data-open', 'false').build();
  const label = Span().class('agent-selection-label').build();
  const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  icon.classList.add('agent-selection-chevron');
  icon.setAttribute('viewBox', '0 0 20 20');
  icon.setAttribute('width', '16');
  icon.setAttribute('height', '16');
  icon.setAttribute('aria-hidden', 'true');
  icon.setAttribute('focusable', 'false');
  icon.innerHTML =
    '<path d="m6 8 4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>';
  const trigger = ButtonBuilder()
    .class('agent-selection-toggle')
    .attr('type', 'button')
    .attr('aria-expanded', 'false')
    .children(label)
    .build();
  trigger.append(icon);
  const text = View('pre').class('agent-quoted-text').attr('tabindex', '-1').build();
  const reveal = Div()
    .class('agent-selection-reveal')
    .attr('id', `agent-selection-${crypto.randomUUID()}`)
    .attr('aria-hidden', 'true')
    .children(Div().class('agent-selection-clip').children(text).build())
    .build();
  trigger.setAttribute('aria-controls', reveal.id);
  label.id = `${reveal.id}-label`;
  reveal.setAttribute('role', 'region');
  reveal.setAttribute('aria-labelledby', label.id);
  reveal.inert = true;
  trigger.addEventListener('click', () => {
    const open = trigger.getAttribute('aria-expanded') !== 'true';
    trigger.setAttribute('aria-expanded', String(open));
    el.dataset.open = String(open);
    reveal.setAttribute('aria-hidden', String(!open));
    reveal.inert = !open;
    text.tabIndex = open ? 0 : -1;
  });
  el.append(trigger, reveal);
  return { el, trigger, label, text, reveal };
}
