/**
 * The parts of the shell every page shares: the language switcher, the GitHub
 * mark the header and footer both draw, and the route helper that puts a slug
 * under a locale's prefix.
 */
import { Div, View } from 'ranui/builder';
import { LOCALES, MENU_ORDER } from './locales.mjs';

/**
 * The language switcher: a disclosure button over a list of real links.
 *
 * Links, not a listbox. Switching language is navigation, so the entries are
 * `<a href>` -- middle-clickable, copyable, crawlable, and readable by assistive
 * tech as the set of links they are. WAI-ARIA's own guidance reserves `menu`
 * (and, further off, `combobox`) for commands and form values; a disclosure over
 * links is the pattern for this. The `<r-select>` this replaces announced itself
 * as a combobox, which is a form field.
 *
 * Each entry carries `lang` so a screen reader pronounces it in that language
 * rather than in the page's -- "日本語" read with English phonetics is noise, and
 * these labels exist precisely for readers who cannot read the current page.
 *
 * Aligned to the trigger's leading edge, so the panel's rows start where the
 * trigger's own label does -- 5px apart, which reads as one column rather than
 * two. It was `bottom-end` first, back when the panel was a guessed 152px wide:
 * that overhung the trigger by 67px on the left, and put the menu's labels 65px
 * off the trigger's. Sizing the panel to its content removed the reason for the
 * end alignment along with the overhang. There is 236px of room to the right of
 * the trigger at desktop width, and on a phone the boundary shift pulls the
 * panel back on screen by itself.
 *
 * Built with ranui's builder, which runs here as well as in a browser: with no
 * `document` it falls back to ranui's own DOM mock, and `serialize()` returns
 * the markup either way. Both environments matter, because vitest renders these
 * same pages under jsdom. Attributes and text are escaped on the way out, which
 * is the part hand-written HTML gets wrong quietly.
 */
export const langMenu = (locale, locales, ui, hrefFor) =>
  View('r-popover')
    .attrs({
      class: 'lang-menu',
      placement: 'bottom',
      trigger: 'click',
      // The host *is* the button. r-popover puts `tabindex`, `aria-haspopup`
      // and `aria-expanded` on itself, so a <button> inside it would be a
      // second tab stop carrying the accessible name while the state stayed
      // outside -- a screen reader would never announce "Language, collapsed"
      // as one control. `role` and the name go here instead, which is also what
      // ARIA's disclosure pattern asks for: one button, reporting its own state.
      role: 'button',
      'aria-label': `${ui.langAria}: ${LOCALES[locale].label}`,
    })
    .children(
      View('span')
        .attrs({ class: 'lang-trigger' })
        .children(
          View('svg')
            .attrs({ class: 'langmark', 'aria-hidden': 'true', viewBox: '0 0 16 16' })
            .children(
              View('circle')
                .attrs({ cx: '8', cy: '8', r: '6.25', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5' })
                .build(),
              View('path')
                .attrs({
                  d: 'M1.75 8h12.5M8 1.75c1.7 1.8 2.6 3.9 2.6 6.25S9.7 12.45 8 14.25M8 1.75c-1.7 1.8-2.6 3.9-2.6 6.25s.9 4.45 2.6 6.25',
                  fill: 'none',
                  stroke: 'currentColor',
                  'stroke-width': '1.2',
                })
                .build(),
            )
            .build(),
          View('span').attrs({ class: 'lang-current' }).text(LOCALES[locale].label).build(),
          View('svg')
            .attrs({ class: 'lang-caret', 'aria-hidden': 'true', viewBox: '0 0 12 12' })
            .children(
              View('path')
                .attrs({
                  d: 'M2.75 4.5 6 7.75 9.25 4.5',
                  fill: 'none',
                  stroke: 'currentColor',
                  'stroke-width': '1.4',
                  'stroke-linecap': 'round',
                  'stroke-linejoin': 'round',
                })
                .build(),
            )
            .build(),
        )
        .build(),
      View('r-content')
        .children(
          Div()
            .class('lang-list')
            .children(
              ...MENU_ORDER.filter((l) => locales.includes(l)).map((l) =>
                View('a')
                  .attrs({
                    class: l === locale ? 'lang-option is-current' : 'lang-option',
                    href: hrefFor(l),
                    lang: LOCALES[l].lang,
                    hreflang: LOCALES[l].lang,
                    // `attrs` drops null, so only the current entry carries this.
                    'aria-current': l === locale ? 'page' : null,
                  })
                  .text(LOCALES[l].label)
                  .build(),
              ),
            )
            .build(),
        )
        .build(),
    )
    .serialize();

export function routeFor(locale, slug) {
  return `${LOCALES[locale].prefix}/${slug}`;
}
