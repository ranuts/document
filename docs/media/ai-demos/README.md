# AI assistant demos

**Experimental Beta.** The AI assistant is still being developed. It can misunderstand requests or produce incomplete or incorrect answers and edits. Review suggestions and check important results before relying on them. Capabilities and response times depend on your model and device.

These silent screen recordings use the English interface, English captions and fictional project information. They were recorded with the local Qwen3 4B model in a browser. Model preparation is left out; the prompts, replies, reviews and editor changes are recorded from the running application.

To try a demo yourself, open a document, open **AI Assistant**, then load a local model or connect your AI service. Type the request shown below. Some changes require review before applying; you can cancel them or use the editor's **Undo** after applying.

## Word: draft and insert

https://github.com/user-attachments/assets/89b21740-0c96-4b21-885f-27efa6e7fa53

[Watch video](https://github.com/user-attachments/assets/89b21740-0c96-4b21-885f-27efa6e7fa53) · [Download MP4](word-ai.mp4) · [English captions](word-ai.vtt)

Request: “Write a short project update about our spring launch. Include a heading and three concise bullet points. Mention the design review is complete, user testing is next, and launch is May 15.”

The assistant drafts a heading and three bullet points. **Write into document** inserts the formatted content into the Word document. The demo then uses **Undo** and **Redo** in the editor to show that the change is reversible.

## Excel: fill and calculate

https://github.com/user-attachments/assets/18dbe96f-bb07-46e9-88f7-5a7a6370b630

[Watch video](https://github.com/user-attachments/assets/18dbe96f-bb07-46e9-88f7-5a7a6370b630) · [Download MP4](excel-ai.mp4) · [English captions](excel-ai.vtt)

Requests:

1. “Fill cells A1:A10 with the numbers 1 through 10, one number per row.”
2. “Sum A1:A10 into B1.”

Review the proposed cell changes and apply them. The assistant fills A1:A10 with the requested numbers, then puts their sum, **55**, in B1. The results appear in the actual worksheet.

## PowerPoint: create a slide

https://github.com/user-attachments/assets/3450551b-b557-4a0b-8a2a-5b05d2c458fe

[Watch video](https://github.com/user-attachments/assets/3450551b-b557-4a0b-8a2a-5b05d2c458fe) · [Download MP4](pptx-ai.mp4) · [English captions](pptx-ai.vtt)

Request: “Create a slide titled ‘Spring launch’ with these three points: Design review complete; User testing next; Launch on May 15.”

Review the proposed slide content and apply it. The new slide appears in the presentation. Answers about slides can be inaccurate with a small local model; check them against the presentation.

## PDF: read and review a note

https://github.com/user-attachments/assets/e786a45c-f73a-48c0-8334-19544fa32c7e

[Watch video](https://github.com/user-attachments/assets/e786a45c-f73a-48c0-8334-19544fa32c7e) · [Download MP4](pdf-ai.mp4) · [English captions](pdf-ai.vtt)

Requests:

1. “Read the text on PDF page 1.”
2. “Add a note to page 1: Check the launch date.”

The assistant reads and displays the selectable text on page 1, then prepares a page note for review. The demo chooses **Cancel**, leaving the PDF unchanged. **Current limitation:** A page note can be saved even when the assistant’s follow-up reply fails. Check the note on the page before retrying to avoid adding it twice. A page note does **not** rewrite PDF body text. These features do not recognize text in scanned page images, and an answer about the current page is not a review of the entire PDF.
