"""Reproduce the issue #113 host environment: PySide6 + Qt WebEngine.

Loads the document app in a QWebEngineView (the same embedding used by the
issue reporter), sends a docx as base64 via the document:open-buffer
postMessage API, and prints every page console message plus a diagnostic
trace of the buf actually handed to asc_openDocument.

Usage:
    python main.py [--url URL] [--file PATH] [--duration SECONDS]

Prerequisites: the app must be served locally first, e.g.
    pnpm run build && pnpm run preview   # serves http://127.0.0.1:4173

What a healthy run prints:
    [JS] [QT-DIAG] asc_openDocument bufType=string bufHead="DOCY;v5;" ...
    [JS] [QT-DIAG] event: onDocumentReady
    RESULT: document opened successfully

buf prefix cheat sheet when it fails:
    "DOCY;v5;"  data is correct, the problem is elsewhere
    "RE9DWT"    double-base64 regression (pre-8a9114b code)
    "UEsDB"     raw docx reached the editor without x2t conversion
"""

import argparse
import base64
import json
import sys
from pathlib import Path

from PySide6.QtCore import QTimer, QUrl
from PySide6.QtWebEngineCore import QWebEnginePage
from PySide6.QtWebEngineWidgets import QWebEngineView
from PySide6.QtWidgets import QApplication

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_FIXTURE = REPO_ROOT / 'test' / 'e2e' / 'fixtures' / 'minimal.docx'

# Installed after page load: reports embed API events and the exact buf shape
# that reaches asc_openDocument, mirroring the api.js logging the issue
# reporter used -- but without having to patch vendored files.
DIAGNOSTIC_JS = r"""
(() => {
  if (window.__qtDiagInstalled) return;
  window.__qtDiagInstalled = true;
  const log = (m) => console.log('[QT-DIAG] ' + m);
  window.addEventListener('message', (e) => {
    const d = e.data;
    if (d && typeof d === 'object' && (d.type || d.event)) log('event: ' + (d.type || d.event));
    if (d && typeof d === 'object' && d.type === 'document:error') log('error payload: ' + JSON.stringify(d.payload));
  }, true);
  const hook = setInterval(() => {
    const ed = window.editor;
    if (ed && typeof ed.sendCommand === 'function' && !ed.__qtDiagHooked) {
      ed.__qtDiagHooked = true;
      const orig = ed.sendCommand.bind(ed);
      ed.sendCommand = (cmd) => {
        if (cmd && cmd.command === 'asc_openDocument') {
          const buf = cmd.data && cmd.data.buf;
          const head = typeof buf === 'string' ? JSON.stringify(buf.slice(0, 8)) : Object.prototype.toString.call(buf);
          log('asc_openDocument bufType=' + typeof buf + ' bufHead=' + head + ' bufLen=' + (buf ? buf.length || buf.byteLength || 0 : 0));
          clearInterval(hook);
        }
        return orig(cmd);
      };
      log('sendCommand hooked');
    }
  }, 50);
})();
"""


class LoggingPage(QWebEnginePage):
    """Forward page console output to stdout, like the reporter's [JS Log]."""

    def __init__(self, parent, on_console):
        super().__init__(parent)
        self._on_console = on_console

    def javaScriptConsoleMessage(self, level, message, line_number, source_id):
        print(f'[JS] {message}', flush=True)
        self._on_console(message)


def main() -> int:
    parser = argparse.ArgumentParser(description='Qt WebEngine host demo for the document embed API (issue #113)')
    parser.add_argument('--url', default='http://127.0.0.1:4173/?embed=1', help='URL of the locally served app')
    parser.add_argument('--file', default=str(DEFAULT_FIXTURE), help='Document to open (docx/xlsx/pptx)')
    parser.add_argument(
        '--duration',
        type=int,
        default=0,
        help='Auto-quit after N seconds (0 = keep the window open until closed manually)',
    )
    args = parser.parse_args()

    doc_path = Path(args.file)
    if not doc_path.is_file():
        print(f'ERROR: file not found: {doc_path}', flush=True)
        return 2
    payload = doc_path.read_bytes()
    b64 = base64.b64encode(payload).decode('ascii')

    app = QApplication(sys.argv)
    state = {'ready': False}

    def on_console(message: str) -> None:
        if 'event: onDocumentReady' in message and not state['ready']:
            state['ready'] = True
            print('RESULT: document opened successfully', flush=True)
            if args.duration:
                QTimer.singleShot(1000, app.quit)

    view = QWebEngineView()
    page = LoggingPage(view, on_console)
    view.setPage(page)

    def on_load_finished(ok: bool) -> None:
        if not ok:
            print(f'ERROR: failed to load {args.url} -- is the preview server running?', flush=True)
            app.exit(1)
            return
        page.runJavaScript(DIAGNOSTIC_JS)
        message = json.dumps(
            {
                'type': 'document:open-buffer',
                'id': 'qt-demo',
                'payload': {'fileName': doc_path.name, 'base64': b64},
            }
        )
        # Small delay so the embed message listener is definitely installed.
        QTimer.singleShot(500, lambda: page.runJavaScript(f"window.postMessage({message}, '*');"))
        print(f'sent document:open-buffer ({len(payload)} bytes, base64 {len(b64)} chars)', flush=True)

    page.loadFinished.connect(on_load_finished)

    if args.duration:

        def on_timeout() -> None:
            if not state['ready']:
                print('RESULT: TIMEOUT -- document did not reach onDocumentReady', flush=True)
            app.quit()

        QTimer.singleShot(args.duration * 1000, on_timeout)

    view.resize(1280, 860)
    view.setWindowTitle('document embed demo (Qt WebEngine)')
    view.show()
    page.load(QUrl(args.url))
    return app.exec()


if __name__ == '__main__':
    sys.exit(main())
