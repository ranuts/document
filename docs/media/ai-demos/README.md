# AI assistant demos

**Experimental Beta.** AI answers and edits can be incomplete or incorrect. Check important results and review changes before relying on them.

Four silent, English walkthroughs use fictional project information and the local Qwen3 4B model. Each follows a complete workflow at normal speed, with time to read replies, inspect suggestions and see the result in the editor. Requests and replies use the running app. The model is already loaded when each recording starts; response times vary by model and device.

To try these yourself, open a file, open **AI Assistant**, turn it on, then load an on-device model or connect your AI service. Type a request, inspect any proposed changes and apply only what you want. You can cancel a proposal or undo an applied change.

| Demo                                                                                          | Length       | Shows                                                          |
| --------------------------------------------------------------------------------------------- | ------------ | -------------------------------------------------------------- |
| [Word](https://github.com/user-attachments/assets/8d1d6386-e33a-45f2-b968-b8695c8f7da9)       | 1 min 43 sec | Draft, write by asking, review a summary, apply, undo and redo |
| [Excel](https://github.com/user-attachments/assets/5bb253d7-3cc5-4f31-989e-0c88dcb1615c)      | 1 min 39 sec | Fill a column, calculate its total, sort and undo              |
| [PowerPoint](https://github.com/user-attachments/assets/db3fc7a7-b54e-4147-a7ca-e7f16243618e) | 1 min 43 sec | Create a slide, review its content, duplicate and undo         |
| [PDF](https://github.com/user-attachments/assets/f01c2da6-0669-4111-87c1-c4440f4a60e9)        | 2 min 9 sec  | Read a page, ask about its contents, review and cancel a note  |

## Word: draft, write and summarize

https://github.com/user-attachments/assets/8d1d6386-e33a-45f2-b968-b8695c8f7da9

[Download MP4](word-ai.mp4) · [English captions](word-ai.vtt)

Requests:

1. “Draft a launch update with a heading and three short bullets: design review done; user testing next; launch May 15.”
2. “Write the previous response into the document.”
3. Select the text, then ask: “Summarize the selected text in one sentence.”

The assistant drafts an update, then writes its heading and bullets into the actual Word file when asked. Read the proposed summary before applying it. **Undo** restores the original update; **Redo** reapplies the summary.

## Excel: fill, calculate and sort

https://github.com/user-attachments/assets/5bb253d7-3cc5-4f31-989e-0c88dcb1615c

[Download MP4](excel-ai.mp4) · [English captions](excel-ai.vtt)

Requests:

1. “Fill A1:A10 with the numbers 1 through 10.”
2. “Sum A1:A10 into B1.”
3. “Sort A1:A10 by A descending without header.”

Review and apply the proposed series. A1:A10 contains **1–10** and B1 shows **55**. The next request sorts the column from **10 to 1**. **Undo** restores the original order. The recorded values were checked directly in the worksheet.

## PowerPoint: create and duplicate a slide

https://github.com/user-attachments/assets/db3fc7a7-b54e-4147-a7ca-e7f16243618e

[Download MP4](pptx-ai.mp4) · [English captions](pptx-ai.vtt)

Requests:

1. “Create one slide titled ‘Spring launch’ with these points: Design review complete; User testing next; Launch on May 15. After creating it, reply Done.”
2. “Duplicate current slide.”

Inspect the proposed title and content, then apply them. Ask the assistant to duplicate the new slide. **Undo** removes the duplicate while preserving the first generated slide and the existing presentation. This demonstrates slide content and editing, not automatic slide design.

## PDF: read, ask and review a note

https://github.com/user-attachments/assets/f01c2da6-0669-4111-87c1-c4440f4a60e9

[Download MP4](pdf-ai.mp4) · [English captions](pdf-ai.vtt)

Requests:

1. “Read the text on PDF page 1.”
2. “What is the approved budget on this page?”
3. “Add a note to page 1: Check the launch date.”

The assistant reads the selectable text on page 1 and answers the budget question: **12,000 dollars**. It then prepares a page note for review. Read the proposal and select **Cancel** to leave the PDF unchanged.

## What to keep in mind

The local model can misunderstand requests or return unchanged text. A PDF page note may be saved even if the assistant’s follow-up reply fails; check the page before retrying to avoid duplicates. PDF assistance uses selectable text on the current page; it does not recognize scanned page images or rewrite PDF body text. Response times vary by model, document and device.
