/**
 * OTA (Over-The-Air) web-bundle update flow via @capgo/capacitor-updater.
 *
 * Publication flow (each time you ship a new web bundle):
 *   1. `npm run build`  → produces `dist/`
 *   2. `npx @capgo/cli bundle zip -p ./dist`  → creates a zip of the bundle
 *   3. `npx @capgo/cli bundle upload --channel production`
 *        → uploads the new version to Capgo
 *   4. Installed APK/IPA apps poll Capgo on startup, download the new bundle
 *      in the background, and swap it in at the next app launch.
 *
 * No new store submission is required — only native/Capacitor plugin changes
 * still need a Play Store / App Store release.
 *
 * Alternative: Capacitor Appflow "Live Updates" from Ionic offers the same
 * capability with a managed CI pipeline (channels: production, staging,
 * dev). It is a paid Ionic subscription. Capgo is chosen here because it
 * is open-source, self-hostable, and has a free tier for small apps.
 */
import { Capacitor } from '@capacitor/core';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { toast } from 'sonner';

let initialized = false;

export async function initCapgoOTA() {
  if (initialized) return;
  initialized = true;

  // Only run on real native platforms (iOS/Android). No-op on web/PWA.
  if (!Capacitor.isNativePlatform()) return;

  try {
    // Tell the native side that the JS layer booted correctly — this marks
    // the currently-loaded bundle as "known good" so Capgo won't roll back.
    await CapacitorUpdater.notifyAppReady();

    // If a newer bundle was downloaded during the previous session and is
    // now active, let the user know.
    CapacitorUpdater.addListener('appReady', async () => {
      const current = await CapacitorUpdater.current();
      if (current?.bundle?.version && current.bundle.version !== 'builtin') {
        toast.success('Application mise à jour', {
          description: `Version ${current.bundle.version} appliquée.`,
        });
      }
    });

    // Auto-download & install: Capgo checks the channel, downloads the new
    // bundle in the background, and swaps it in at the next launch. We just
    // surface progress / errors.
    CapacitorUpdater.addListener('downloadComplete', () => {
      toast('Nouvelle version téléchargée', {
        description: 'Elle sera active au prochain lancement.',
      });
    });

    CapacitorUpdater.addListener('updateFailed', (info) => {
      // Silent unless debugging — Capgo will retry on next launch.
      console.warn('[capgo] update failed', info);
    });
  } catch (err) {
    console.warn('[capgo] init error', err);
  }
}