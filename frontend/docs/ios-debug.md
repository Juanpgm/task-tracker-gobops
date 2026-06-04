# iOS Debugging — Catatrack frontend

Three complementary debug paths for Safari iOS regressions and PWA validation.
**No single path is enough**: WebKit (CI) catches ~80 %, macOS Simulator catches
device-only quirks, BrowserStack validates on real hardware.

---

## Path A — Playwright WebKit (primary, free, headless on Linux/Win)

Backed by the same WebKit binary that powers macOS Safari. Runs locally and in
CI without a Mac.

```powershell
cd frontend
npm run install:webkit          # one-time
npm run test:ios                # iPhone 15 + iPhone SE + iPad Pro
npm run test:ios:headed         # see the browser
npm run test:ios:debug          # Playwright inspector
```

**Limitations**
- No native iOS gestures (force-touch, swipe-from-edge)
- Service workers behave slightly differently vs. iOS Safari 17+
- Push notifications cannot be triggered (`Notification` API exists but no real APN)

**Use for**: 100dvh regressions, modal scroll-lock, image lazy-load, IndexedDB
fallback, install UI presence, manifest validation.

---

## Path B — macOS VM + iOS Simulator (deep Safari Web Inspector)

The only way to inspect a live page running inside iOS Safari with full
JS/DOM/Network/Storage panels.

### Options

| Option | Cost | Effort | Notes |
|---|---|---|---|
| **MacInCloud / MacStadium** | ~$20/mo | Low | Browser-based macOS, install Xcode in their image |
| **OSX-KVM on Linux** | Free | High | Apple EULA forbids on non-Apple HW; legal grey area |
| **VMware on Windows** | Free | Medium | Requires unlocker; same legal caveat |
| **Borrow a Mac** | $0 | — | Fastest if you have access |

### Setup (any of the above)

1. Install **Xcode** from the App Store (8 GB).
2. Open `Xcode → Settings → Components` and download the iOS 17 simulator runtime.
3. Launch **Simulator** app → `File → Open Simulator → iPhone 15`.
4. In Simulator, open **Safari**.
5. On your dev box (Windows) expose Vite with ngrok:
   ```powershell
   ngrok http 5173
   ```
   Copy the `https://*.ngrok-free.app` URL.
6. Paste the URL in Simulator Safari.
7. On the Mac, open **Safari → Develop menu → Simulator → <your page>**. Web
   Inspector opens with full panels.

**Use for**: real CSS rendering bugs, touch event debugging, ITP behavior,
service worker lifecycle, install prompt verification, audio recording
permission flow.

---

## Path C — BrowserStack Live (real devices, release smoke)

Live remote sessions on real iPhones/iPads (no emulation). Critical before any
production deploy.

### Setup

1. Get a BrowserStack account (free trial: 100 min real device).
2. Generate an access key in Account Settings.
3. Export it:
   ```powershell
   $env:BROWSERSTACK_ACCESS_KEY = 'xxxxxxxxxxxx'
   ```
4. In one terminal, start Vite:
   ```powershell
   cd frontend
   npm run dev
   ```
5. In a second terminal, open the tunnel:
   ```powershell
   cd front-catatrack
   .\scripts\browserstack-tunnel.ps1
   ```
6. Go to <https://live.browserstack.com/dashboard>, pick an iOS device, browse
   to `http://localhost:5173`.

### Device matrix (recommended for each release)

| Device | iOS | Notes |
|---|---|---|
| iPhone SE (3rd gen) | 15 | Smallest screen + Touch ID |
| iPhone 12 | 15 | Most common in field |
| iPhone 14 | 16 | Dynamic Island layout |
| iPhone 15 Pro | 17 | Latest WebKit features |
| iPad Pro 11" M2 | 17 | Landscape + split view |

### Manual checklist per device

- [ ] Login flow (Firebase popup vs. redirect)
- [ ] PWA install banner appears
- [ ] "Añadir a inicio" creates icon with correct image
- [ ] Standalone launch loads without address bar
- [ ] Record audio note (mic permission)
- [ ] Take photo from camera input
- [ ] Offline mode (airplane → app shell still loads)
- [ ] Token persists after 24 h (close + reopen)
- [ ] No 100vh overflow on iPhone SE
- [ ] Modal blocks background scroll
- [ ] Push notifications received (iOS 16.4+, installed only)

---

## Quick triage flowchart

```
Bug reported on iPhone?
├── Reproducible in `npm run test:ios`?        → Fix locally with Path A
├── Visual / CSS only?                          → Path B (Simulator) for fast iteration
├── Touch / gesture / hardware feature?         → Path C (real device)
└── Push notification / install behavior?       → Path C only
```

---

## CI integration (GitHub Actions)

`webkit-iphone-15` and `webkit-iphone-se` projects run on `ubuntu-latest`. Add
to `.github/workflows/e2e.yml`:

```yaml
- name: Install Playwright WebKit
  run: npx playwright install --with-deps webkit
- name: iOS Safari e2e
  run: npm run test:ios
```
