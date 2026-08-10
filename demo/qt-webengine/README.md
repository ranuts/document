# Qt WebEngine embed demo (issue #113 scenario)

Reproduces the host environment reported in
[issue #113](https://github.com/ranuts/document/issues/113): a PySide6 /
Qt WebEngine app embeds the document editor and opens a docx by posting
`document:open-buffer` with a base64 payload -- the only transport a native
host can use, since `runJavaScript()` cannot hand over a real ArrayBuffer.

Use it to debug and verify the embed pipeline against a real Qt WebEngine
(Chromium) runtime instead of guessing from desktop-browser behavior.

## Run

```bash
# 1. Serve the app locally (from the repo root)
pnpm run build
pnpm run preview        # http://127.0.0.1:4173

# 2. Set up Python (once)
cd demo/qt-webengine
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt

# 3. Launch the host
.venv/bin/python main.py
```

Options:

| Flag             | Default                          | Meaning                                   |
| ---------------- | -------------------------------- | ----------------------------------------- |
| `--url URL`      | `http://127.0.0.1:4173/?embed=1` | App URL (point it at a branch deploy too) |
| `--file PATH`    | `test/e2e/fixtures/minimal.docx` | Document to open                          |
| `--duration SEC` | `0` (stay open)                  | Auto-quit; prints TIMEOUT if not opened   |

## Reading the output

Every page console line is echoed to stdout prefixed with `[JS]`. The
injected diagnostic additionally reports the embed API events and the exact
`buf` handed to `asc_openDocument`. A healthy run ends with:

```
[JS] [QT-DIAG] asc_openDocument bufType=string bufHead="DOCY;v5;" bufLen=...
[JS] [QT-DIAG] event: onDocumentReady
RESULT: document opened successfully
```

If it fails, the `bufHead` value pinpoints the layer at fault:

| `bufHead`  | Diagnosis                                                        |
| ---------- | ---------------------------------------------------------------- |
| `DOCY;v5;` | Data is correct; look elsewhere (fonts, media, SDK errors)       |
| `RE9DWT`   | Double-base64 regression -- running pre-`8a9114b` code           |
| `UEsDB`    | Raw docx reached the editor; x2t conversion was skipped / failed |

Background: x2t emits `Editor.bin` as an ASCII text container
(`DOCY;v5;<len>;<base64>`), and the OnlyOffice SDK identifies a string `buf`
by literally checking its first characters -- it never base64-decodes it.
See `docs/explorations/2026-08-11-issue-113-base64-wrap-regression.md`.
