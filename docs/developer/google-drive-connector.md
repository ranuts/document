# Optional Google Drive connector

The editor, local references, model configuration and artifacts do not require a Google account. Google authorization is requested only when a user explicitly connects Drive. This optional Cloudflare Pages Functions bridge is separate from model providers.

## Deployment

Deploy the repository's `functions/` directory alongside the built static site with Cloudflare Pages. A static-only deployment cannot provide these routes; its client must display connector unavailability without disabling local features. Production and preview origins need separate Google OAuth clients/configuration. Do not inherit production secrets into untrusted pull-request previews.

Configure these server-side Cloudflare environment bindings (never `VITE_*`, generated HTML, or frontend storage):

- `GOOGLE_CLIENT_ID`: OAuth web application client ID.
- `GOOGLE_CLIENT_SECRET`: the corresponding client secret.
- `GOOGLE_CONNECTOR_SECRET`: random high-entropy encryption secret, at least 32 characters. Rotate it to invalidate outstanding sessions and authorization flows.
- `GOOGLE_CONNECTOR_ORIGIN`: exact trusted HTTPS origin without a trailing slash, for example `https://edit.chaxus.com`. Incoming Host headers cannot choose the callback destination. Subpath deployments need a gateway or a separate root-origin deployment of these fixed routes.

Register the exact redirect URI `${GOOGLE_CONNECTOR_ORIGIN}/api/connectors/google/callback` with Google's OAuth web application, enable Drive API, and configure consent-screen audiences/test users. This version requests `https://www.googleapis.com/auth/drive.readonly` to browse and read supported files; this is broad read access and production publication may require Google's restricted-scope verification/security assessment. Explain that permission in the connection UI. It grants no writing permission. A narrower Picker-only flow would require a separate product implementation, not just a scope substitution.

Sessions last at most one hour and never request refresh tokens. Expired authorization requires explicit reconnect. The browser receives encrypted Secure, HttpOnly, SameSite=Lax, host-only cookies; neither OAuth tokens nor client secrets reach application JavaScript. The short authorization-flow cookie expires after ten minutes. AES-GCM binds cookie purpose and configured origin; the callback checks state and uses PKCE. Google authorization codes are single-use; the callback clears the flow cookie on success and failure. Cross-origin POST actions are rejected.

The callback uses a nonce-authorized inline script and same-origin `BroadcastChannel`, not `window.opener`, so the editor's COOP/COEP isolation does not need weakening. Open a blank popup synchronously from the user's gesture, call `start`, then navigate that popup to `authorizationUrl`. Listen to `document-google-connector`, treat its `{type:'google-connector-complete',success:boolean}` message as a refresh hint, and fetch `status` for authoritative state. The callback also displays a plain close-window instruction when script or popup behavior is unavailable. Do not log callback URLs: their query includes a short-lived authorization code.

## Browser API contract

All routes are same-origin under `/api/connectors/google`, use `credentials: 'same-origin'`, and return `Cache-Control: no-store`. Mutations require a same-origin `Origin` header.

| Route               | Method | Result                                                                                        |
| ------------------- | ------ | --------------------------------------------------------------------------------------------- |
| `/start`            | POST   | `{authorizationUrl}`; navigate the user-initiated popup                                       |
| `/callback`         | GET    | Google-owned redirect target; HTML completion page, no tokens                                 |
| `/status`           | GET    | `{configured:true,connected:boolean,expiresAt?:number}`; epoch milliseconds                   |
| `/list?pageToken=…` | GET    | `{files:[{id,name,mimeType,modifiedTime,size?}],nextPageToken?}`; 30 supported files per page |
| `/read?id=…`        | GET    | `{id,name,mimeType,modifiedTime?,text}`                                                       |
| `/disconnect`       | POST   | `{connected:false}`; attempts Google revocation and always clears local cookies               |

Missing server configuration returns HTTP 503 and `{configured:false,connected:false,error:'not_configured'}`. A static deployment may instead return an HTML 404; the client must distinguish that from successful JSON. Other sanitized error codes include `invalid_origin`, `method_not_allowed`, `reconnect_required`, `invalid_file`, `unsupported_file`, `source_too_large`, and `service_unavailable`. Upstream response bodies, access tokens and request secrets are never included in error output. Treat 401 as a disconnected state and offer explicit reconnect; do not automatically resend a user request.

Supported content is Google Docs exported as plain text and UTF-8 plain text, Markdown, CSV and JSON files. Binary Office/PDF files are deliberately excluded. Responses are streamed with a 128 KiB bound (including files with no Content-Length), a 15-second timeout and no upstream redirects. Only fixed Google API endpoints can be fetched; file IDs and supported MIME types are validated. The later AI request envelope has its own smaller budget, so selecting a file does not mean its entire text will fit into a model request. Display any truncation at that boundary.

Disconnect attempts token revocation even if the provider is temporarily unavailable, then removes local session cookies. A copied encrypted cookie remains usable until expiry if provider revocation fails; this stateless version does not claim server-side session deletion. Do not persist source text or send it to a model without the user's explicit attachment/request action.

## Verification

`pnpm exec vitest run test/unit/agent-google-connector.test.ts` covers missing configuration, trusted origin/method checks, encrypted cookies, state mismatch/tampering/expiry, callback replay without the flow cookie, server-only token exchange, supported listing/export, invalid URL/file IDs, streaming size bounds, unsupported MIME types, sanitized errors, revocation failure and session expiry. These deterministic tests mock Google. Live consent, restricted-scope verification and production Cloudflare deployment require real credentials and are separate deployment checks.

References: [Google server OAuth flow](https://developers.google.com/identity/protocols/oauth2/web-server), [Drive scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth), [Cloudflare Pages Functions](https://developers.cloudflare.com/pages/functions/).
