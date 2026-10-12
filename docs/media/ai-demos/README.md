# AI assistant demos

**Experimental Beta.** AI answers and edits can be incomplete or incorrect. Check important results and review changes before relying on them.

Four short, silent demos show the English interface with fictional project information and the local Qwen3 4B model. All prompts, replies and changes come from the running app. Model preparation is omitted and waiting intervals are cut for a concise tour; the clips are not a speed benchmark. The videos also display **Experimental Beta · Waits shortened** throughout.

To try these yourself, open a file, open **AI Assistant**, turn it on, then load an on-device model or connect your AI service. Type a request, inspect any proposed changes and apply only what you want. You can cancel a proposal or undo an applied change.

| Demo                                                                                          | Length     | Shows                                 |
| --------------------------------------------------------------------------------------------- | ---------- | ------------------------------------- |
| [Word](https://github.com/user-attachments/assets/97bf02e6-293c-44e3-b042-4334e03a7db5)       | 16 seconds | Draft, insert, undo and redo          |
| [Excel](https://github.com/user-attachments/assets/fc68c9d5-4cb5-4a80-a29d-46665af1a409)      | 14 seconds | Fill a column and calculate its total |
| [PowerPoint](https://github.com/user-attachments/assets/c8dda2cc-80f1-4c12-acc2-80469bd41007) | 16 seconds | Review and create a slide             |
| [PDF](https://github.com/user-attachments/assets/25355bc0-57cb-4a3d-a465-87dff2b68b4e)        | 17 seconds | Read a page and review a note         |

## Word: draft, insert and undo

https://github.com/user-attachments/assets/97bf02e6-293c-44e3-b042-4334e03a7db5

[Download MP4](word-ai.mp4) · [English captions](word-ai.vtt)

Request: “Draft a launch update with a heading and three short bullets: design review done; user testing next; launch May 15.”

The assistant produces a short update. **Write to document** inserts the heading and bullet points in the actual Word file. **Undo** removes the change; **Redo** restores it.

## Excel: fill and calculate

https://github.com/user-attachments/assets/fc68c9d5-4cb5-4a80-a29d-46665af1a409

[Download MP4](excel-ai.mp4) · [English captions](excel-ai.vtt)

Requests:

1. “Fill A1:A10 with the numbers 1 through 10.”
2. “Sum A1:A10 into B1.”

Review and apply the proposed cell changes. A1:A10 contains the numbers **1–10**; B1 shows their total, **55**. Both results were read back from the worksheet.

## PowerPoint: create a slide

https://github.com/user-attachments/assets/c8dda2cc-80f1-4c12-acc2-80469bd41007

[Download MP4](pptx-ai.mp4) · [English captions](pptx-ai.vtt)

Request: “Create a slide titled ‘Spring launch’ with these three points: Design review complete; User testing next; Launch on May 15.”

Inspect the proposed title and content, then apply them. The new slide appears in the presentation. This is a content creation demo, not automatic slide design.

## PDF: read and review a note

https://github.com/user-attachments/assets/25355bc0-57cb-4a3d-a465-87dff2b68b4e

[Download MP4](pdf-ai.mp4) · [English captions](pdf-ai.vtt)

Requests:

1. “Read the text on PDF page 1.”
2. “Add a note to page 1: Check the launch date.”

The assistant reads the selectable text on page 1 and prepares a page note for review. **Cancel** dismisses the proposal, leaving the PDF unchanged.

## What to keep in mind

The local model can misunderstand requests or return unchanged text. A PDF page note may be saved even if the assistant’s follow-up reply fails; check the page before retrying to avoid duplicates. PDF assistance uses selectable text on the current page; it does not recognize scanned page images or rewrite PDF body text. Response times vary by model, document and device.
