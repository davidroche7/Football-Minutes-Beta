/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_TITLE: string;
  readonly VITE_USE_API?: string;
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_TEAM_ID?: string;
  readonly VITE_ACTOR_ROLES?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
