# WebKit offline save and reopen: text preserved, resource gate fails

Fresh WebKit 27.2 restored the default CPU model offline, inserted the exact requested text, and passed native Undo/Redo. Native Save produced a 25,859-byte DOCX. ZIP CRC checks passed; document.xml contains exactly `WEBKIT_OFFLINE_WRITE_20261007`. Native reopening in a new offline page restored exactly that text plus the Word paragraph terminator.

The error-free runtime gate failed. Reopening requested `/sdkjs/common/Images/fonts_thumbnail.png.bin`, which was not available offline; the request failed with a service-worker response error and the page reported TypeError Load failed plus the thumbnail URL. This does not imply document text corruption, but prevents complete offline acceptance. Service-worker update/spelling failures also remain in the ledger. The browser/context closed.

No diagnostic font prefetch was added. This is a same-browser-context page lifecycle, not browser-process restart or physical Safari/mobile. Next work must establish the required font UI resource caching rather than suppressing the error. Generative multilingual fidelity remains open.
