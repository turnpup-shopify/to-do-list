/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** VAPID public key for Web Push; injected at build time. */
  readonly VITE_VAPID_PUBLIC_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
