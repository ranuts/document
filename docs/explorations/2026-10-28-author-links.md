# Linking edit.chaxus.com back to its author

chaxus.com links to edit.chaxus.com, but nothing on edit linked back. Search
engines and assistants therefore could not tell that edit, the ran sites and
chaxus.com share one author. The chaxus.com side is adding JSON-LD with a
Person node at `https://chaxus.com/#person`. This change makes edit refer to
the same node.

## What changed

- **Footer link.** Every generated page (homepages and content pages, all seven
  locales) has a `rel="author"` link in the footer. zh-CN pages point to
  `https://chaxus.com/zh/`; every other locale points to
  `https://chaxus.com/`, since chaxus.com has only those two languages. The
  link text is localized in `bin/pages/ui.mjs` (`byAuthor`).
- **Structured data.** `siteEntities()` now defines the Person once per page,
  and `WebSite` and the full `WebApplication` node reference it as both
  `author` and `publisher`. The `appStub()` on documentation pages stays a
  stub.
  - The values (`@id`, `name`, `url`, `sameAs`) live only in `AUTHOR` in
    `bin/pages/constants.mjs`.
  - They must match chaxus.com and ran exactly, because the graph merges on
    `@id`.
- **llms.txt** states the author in its opening lines.

## Tests and reverse validation

`test/unit/landing-pages.test.ts` gains three checks:

- every page that carries the site node names the Person, with exact values,
  as author and publisher of the site and the full app node;
- every generated page links the author in its footer with the locale's URL;
- llms.txt names the author before its first section.

With the generator, `index.html` and `llms.txt` changes reverted, all 355 new
cases fail (177 pages for each of the first two checks, plus llms.txt). With
the change, all pass. The existing graph check (no unresolved `@id` reference)
still passes, because the Person is defined in the same graph that refers to
it.

## Rendered

Checked in a real browser against the Vite dev server, at 1280 px on `/`,
`/zh-CN/` and `/help`, and at 390 px on `/` and `/zh-CN/help`. The link uses
the existing footer link style. The Chinese label wraps onto its own line on a
phone, and no page scrolls horizontally.
