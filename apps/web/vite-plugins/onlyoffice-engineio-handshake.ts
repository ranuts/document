import type { Connect, Plugin } from 'vite';

// Serve a minimal Engine.IO v4 + Socket.IO v4 handshake for OnlyOffice polling.
//
// Protocol details:
//   Engine.IO v4 framing: "{byteLen}:{packet}" where packet = "{eiotype}{data}"
//     eiotype 0 = open, 4 = message, 6 = noop
//   Socket.IO v4 runs on top of Engine.IO type 4:
//     "40{json}"  = namespace CONNECT (json must include socket sid in v4)
//     "42[...]"   = EVENT
//
// First GET (no ?sid): send open-packet + socket.io namespace-connect.
// Subsequent GETs (?sid=fakesid): send noop so the client keeps polling.
// POST: acknowledge the client's socket.io frames with "ok".
//
// The document is loaded separately via asc_openDocumentFromBytes in onAppReady.
export function onlyofficeEngineIOHandshake(): Plugin {
  const SID = 'fakesid';
  const middleware: Connect.NextHandleFunction = (req, res, next) => {
    if (req.url && /\/doc\/[^/]+\/c\//.test(req.url)) {
      const url = new URL(req.url, 'http://localhost');
      const hasSid = url.searchParams.has('sid');
      res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
      res.setHeader('Cache-Control', 'no-store');
      if (req.method === 'POST') {
        res.end('ok');
        return;
      }
      if (!hasSid) {
        const open = JSON.stringify({ sid: SID, upgrades: [], pingInterval: 25000, pingTimeout: 5000 });
        const nsConnect = `40{"sid":"${SID}"}`;
        const body = `${1 + open.length}:0${open}${nsConnect.length}:${nsConnect}`;
        res.end(body);
      } else {
        res.end('1:6');
      }
      return;
    }
    if (req.url && /(^|\/)document_editor_service_worker\.js(?:\?|$)/.test(req.url)) {
      res.statusCode = 404;
      res.setHeader('Cache-Control', 'no-store');
      res.end();
      return;
    }
    next();
  };

  return {
    name: 'onlyoffice-engineio-handshake',
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}
