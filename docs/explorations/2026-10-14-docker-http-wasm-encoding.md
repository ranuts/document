# Docker WASM decoding on ordinary HTTP (#267)

## Cause

Chrome decodes `Content-Encoding: br` on trustworthy origins, including HTTPS
and loopback HTTP. On ordinary `http://<server-ip>`, the same response fails
with `ERR_CONTENT_DECODING_FAILED` and the converter reports `Failed to fetch`.
The vendored file is valid Brotli: it decompresses to the existing 42,111,200-byte
WASM module. Neither a corrupt binary nor double compression caused this case.

A probe using static-web-server 2.42.0 and the repository's original `sws.toml`
loaded the module on loopback HTTP and failed on a non-loopback HTTP origin.
The old Docker E2E base URL was loopback and therefore hid the failure.

## Change

`bin/prepare-docker-wasm.mjs public` re-encodes the image builder's copy as gzip
before Vite copies it and `bin/build.sh` hashes the served vendor tree for the
service worker. `sws.toml` declares `Content-Encoding: gzip`. The loader URL
retains its opaque `.br` suffix; the response header describes the actual bytes.
Pages and Vite keep the repository's Brotli file and header. The browser still
decodes the response natively, including the streaming-instantiation path.
Gzip costs 10,058,136 transport bytes versus Brotli's 6,898,179.

## Regression coverage

- `docker-wasm.test.ts` runs the packaging script on the real vendor file and
  checks gzip framing, identical decoded bytes, and unchanged source bytes.
- `hosting-contract.test.ts` pins the gzip response header and build ordering.
- `docker-cache-headers.spec.ts` fetches and compiles the real module from
  `http://document-http.test`, mapped to the container by Chromium's resolver.
  It asserts `isSecureContext === false`; loopback HTTP cannot substitute here.
  This test failed with `TypeError: Failed to fetch` before the fix and passed
  against the re-encoded payload served by static-web-server 2.42.0.

This addresses WASM transport only. Secure-context features such as service
workers and cross-origin isolation retain their existing browser requirements.
