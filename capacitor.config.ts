import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor configuration.
 *
 * Production (default): the app loads the local `dist` bundle bundled inside
 * the APK/IPA, supports offline mode, and never points at the Lovable sandbox.
 *
 * Development hot-reload: set the env var `CAP_ENV=dev` before running
 * `npx cap sync` / `npx cap run ios|android` to point WebView at the live
 * Lovable preview (useful for fast iteration on a physical device).
 *   CAP_ENV=dev npx cap sync
 *   CAP_ENV=dev npx cap run android
 */
const isDev = process.env.CAP_ENV === 'dev';

const DEV_SERVER_URL =
  'https://2f84ea3c-29cc-4df2-ab1d-da5d2ef488ee.lovableproject.com?forceHideBadge=true';

const config: CapacitorConfig = {
  appId: 'app.lovable.2f84ea3c29cc4df2ab1dda5d2ef488ee',
  appName: 'Budget Planner',
  webDir: 'dist',
  // In production no `server.url` → Capacitor serves the local `dist` bundle.
  // `androidScheme: 'https'` keeps cookies / Service Worker / OAuth happy.
  server: isDev
    ? {
        url: DEV_SERVER_URL,
        cleartext: true,
        androidScheme: 'https',
      }
    : {
        androidScheme: 'https',
      },
  android: {
    buildOptions: {
      keystorePath: undefined,
      keystoreAlias: undefined,
    },
  },
  ios: {
    scheme: 'Budget Planner',
    contentInset: 'automatic',
  },
};

export default config;
