/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_EXT?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
