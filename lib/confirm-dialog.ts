/**
 * A confirmation dialog built from the design system's modal, replacing
 * `window.confirm`.
 *
 * The native dialog was never a styling decision, it was a shortcut, and it
 * shows: it renders as the browser's chrome ("edit.chaxus.com says"), it cannot
 * carry the site's typography or theme, and on a page whose whole subject is
 * the user's own documents it looks like something the page did not mean to
 * say. It is also modal to the whole tab, which is more interruption than
 * "delete this one file" deserves.
 *
 * Resolves true when confirmed, false for every other way out -- cancel, the
 * close button, Escape, or a click on the mask. Callers only ever ask "did they
 * say yes?", so every dismissal is a no.
 */
import 'ranui/modal';
import 'ranui/button';
import { Div, View } from 'ranui/builder';
import '../styles/confirm-dialog.css';

export interface ConfirmOptions {
  title: string;
  body: string;
  /** Label of the confirming action, e.g. "Delete". */
  confirmLabel: string;
  cancelLabel: string;
  /** Marks the confirming action as destructive (see .confirm-ok styling). */
  danger?: boolean;
}

export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  if (typeof document === 'undefined') return Promise.resolve(false);

  return new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = (confirmed: boolean): void => {
      if (settled) return;
      settled = true;
      resolve(confirmed);
      // Let the close animation run before the element leaves the DOM.
      modal.removeAttribute('open');
      window.setTimeout(() => modal.remove(), 300);
    };

    const cancel = View('r-button')
      .class('confirm-cancel')
      .attr('type', 'text')
      .text(options.cancelLabel)
      .on('click', () => finish(false))
      .build();

    const confirm = View('r-button')
      .class(options.danger ? 'confirm-ok confirm-ok-danger' : 'confirm-ok')
      // ranui ships primary and warning only; "danger" is a primary button
      // wearing the danger token, applied through the component's --ran-btn-*
      // hook in styles/history.css.
      .attr('type', 'primary')
      .text(options.confirmLabel)
      .on('click', () => finish(true))
      .build();

    const modal = View('r-modal')
      .class('confirm-dialog')
      .attr('title', options.title)
      .children(
        Div().class('confirm-body').text(options.body).build(),
        Div().class('confirm-actions').attr('slot', 'footer').children(cancel, confirm).build(),
      )
      // Escape, the mask and the close button all mean "no"; the component
      // fires `close` for each of them.
      .on('close', () => finish(false))
      .build();

    document.body.appendChild(modal);
    // Set after insertion so the component is upgraded and can animate in.
    modal.setAttribute('open', 'true');
  });
}
