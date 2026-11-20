import type { UserConfig } from 'vite';

/** Configure an app-owned web/runner. The callback form allows additional Vite plugins. */
export function definePwaConfig(runner: string, overrides?: UserConfig): UserConfig;
