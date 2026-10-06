/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_LOCAL_MODEL_ID?: string;
  readonly VITE_LOCAL_MODEL_URL?: string;
  readonly VITE_LOCAL_MODEL_LIB_URL?: string;
  /**
   * Cloudflare Web Analytics beacon token. When unset, analytics is disabled
   * and no external request is made — keeps forks and local dev tracking-free.
   * The token is a public client-side value, so exposing it in the build is safe.
   */
  readonly VITE_CF_BEACON_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
