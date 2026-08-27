---
title: Contact — report a bug or ask about the document editor
description: How to reach the people behind edit.chaxus.com — report a bug, a file that renders wrong, a security issue, or ask about embedding and self-hosting. Issues are handled publicly on GitHub.
eyebrow: Contact
breadcrumb: Contact
h1: Contact
lead: Every route below is public and traceable, so you can see what happened to your report.
---

## Report a bug or a file that renders wrong

**[Open an issue on GitHub](https://github.com/ranuts/document/issues)** — this is the fastest and most useful route.

Rendering problems are much easier to fix with a file that reproduces them. If the document is not sensitive, attaching it (or a trimmed-down version that still shows the problem) turns a vague report into a fixable one. If it _is_ sensitive, describe the structure instead: which format, roughly how large, what feature is involved (tables, embedded images, pivot tables, unusual fonts), and what you expected versus what you saw.

Useful to include:

- The file format and roughly what is in it
- Your browser and version
- What you did, what you expected, what actually happened
- Any error code shown on screen

## Ask about embedding or self-hosting

Both are supported and documented:

- **Embedding** — see the [Embed API reference](/help/embed-api) for the iframe and `postMessage` interface.
- **Self-hosting** — the [repository](https://github.com/ranuts/document) contains what you need to run your own copy. It is AGPL-3.0, so a modified hosted version must publish its source.

For questions that are not bug reports, [GitHub Discussions or an issue](https://github.com/ranuts/document/issues) still works and has the advantage that the answer helps the next person with the same question.

## Report a security issue

If you believe you have found a security problem, **please do not open a public issue first**. Report it privately through [GitHub's security advisory form](https://github.com/ranuts/document/security/advisories/new) so it can be fixed before the details are public.

## Who you are contacting

This project is built and maintained by **ranuts** — see [About](/about) for what that means and how to verify it. It is a personal open-source project, so replies come from a person and not a support desk: expect a real answer, but not a one-hour SLA.

## What we do not need from you

Worth stating plainly, because contact pages usually collect things:

- **We do not want your documents.** The editor never uploads them, and support does not need them either unless you choose to attach a file to an issue.
- **There is no account**, so there is nothing to recover, reset or delete.
- **There is no mailing list.** Watching the [repository](https://github.com/ranuts/document) is how you follow changes; the [changelog](/changelog) lists what shipped.
