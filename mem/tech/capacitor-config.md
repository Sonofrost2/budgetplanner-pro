---
name: capacitor-config
description: Capacitor production-by-default config; opt-in dev hot-reload via CAP_ENV=dev
type: preference
---
# Capacitor configuration

`capacitor.config.ts` is **production by default**:
- No `server.url` → the APK/IPA loads the local `dist` bundle (offline-capable, store-ready).
- `androidScheme: 'https'` is always set to keep cookies, Service Worker, push and OAuth working.
- `ios.contentInset: 'automatic'` for proper safe-area handling.

**Dev hot-reload (opt-in)** — point WebView at the Lovable sandbox preview:
```bash
CAP_ENV=dev npx cap sync
CAP_ENV=dev npx cap run android   # or ios
```

**Why:** the previous config hardcoded `server.url` to the sandbox, which broke offline mode and was unsafe for store builds. Never re-add an unconditional `server.url`. If a sandbox URL must change, update `DEV_SERVER_URL` only.

**How to apply:** any time the user builds for the store / generates an APK / IPA, ensure no `CAP_ENV=dev` is set. After config changes, the user must run `npx cap sync` locally.
