/**
 * `post` belongs to the embed demo page, not to the app.
 *
 * `public/embed-demo.html` defines it: a promise-returning wrapper over the
 * `postMessage` protocol in `lib/embed-api.ts`, which is how most of this
 * suite drives a real editor (`post('document:open-buffer', …)`,
 * `post('document:save', …)`). Thirty-five specs used to declare it
 * identically; it is declared once here instead, and this file is ambient, so
 * nothing has to import it.
 *
 * It resolves or rejects with whatever the protocol answers, which is why the
 * return type is deliberately loose.
 */
declare function post(type: string, payload?: Record<string, unknown>): Promise<any>;
