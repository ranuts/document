# Long conversation export and deletion

[Production browser report](2026-10-03-im-long-history-export-delete.json) exercises real Restore, Export download, cancel deletion, delete current and delete all controls in isolated desktop Chromium. The twelve conversations each contain sixty synthetic messages; these are storage/rendering fixtures, not model-generated dialogue. The existing isolated profile's prior IndexedDB state was restored in the harness cleanup.

- Export downloaded 804006 bytes and contained all twelve conversations and 720 messages. Entire session records matched the seeded fixtures, including long titles and message text. Top-level keys were exactly `version`, `activeId`, `sessions`, `exportedAt`; model/provider settings were absent.
- Cancelling the current-conversation deletion preserved the exported session records exactly.
- Confirming current-conversation deletion left eleven session records, exactly equal to the original remaining records, in both the download and IndexedDB.
- Confirming deletion of all history left zero visible messages and zero disk sessions. The disk retained its revision tombstone (revision 3). Export correctly represented one new empty in-memory conversation with zero messages.

The overall browser check passed without captured page errors. No product source changed. Existing destructive-history confirmations were exercised; no confirmation or preview was added to document editing. This is ordinary application-level deletion, not forensic secure erasure of browser storage or deletion of previously exported files. Concurrent-tab conflicts, real-device accessibility, long model context and private-browsing storage restrictions remain separate verification requirements.
