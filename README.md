# is-suspicious-client

Detect headless browsers, automation frameworks, and suspicious client behavior in the browser.

## Install

```bash
npm install is-suspicious-client
```

## Two detection modes

| Mode | API | Speed | What it checks |
| --- | --- | --- | --- |
| **Instant** | `detectInstantClient` | Immediate | Environment/fingerprint signals (WebDriver, WebGL, UA, plugins, etc.) |
| **Behavioral** | `createBehavioralClientDetector` | Long-running | Mouse, scroll, and typing patterns with weighted suspicion scoring |

---

## Instant detection

Runs synchronously against `window` — use this for first-pass gating on page load.

```ts
import { detectInstantClient } from "is-suspicious-client";

const result = detectInstantClient(window);

if (!result.isLegitClient) {
  console.warn("Suspicious environment", result);
}
```

### Instant + WebGPU (async)

On Chromium browsers, also validates WebGPU [`shader-f16`](https://scrapfly.io/web-scraping-tools/gpu-fingerprint/webgpu/shader-f16) support:

```ts
import { detectInstantClientAsync } from "is-suspicious-client";

const result = await detectInstantClientAsync(window);
console.log(result.isShaderF16Supported); // true | false | null
```

### Instant signals

| Flag | Description |
| --- | --- |
| `isWebDriver` | `navigator.webdriver` is set |
| `isPhantomJS` | PhantomJS globals detected |
| `isNightmare` | Nightmare.js marker detected |
| `isSelenium` | Selenium document markers detected |
| `isDomAutomation` | Chrome DOM automation globals detected |
| `isHeadless` | WebDriver or HeadlessChrome user agent |
| `isSuspiciousResolution` | Viewport smaller than Apple Watch Series 3 (38mm) |
| `isUserAgentValid` | User agent starts with `Mozilla/5.0 (` |
| `isWebGLSupported` | WebGL context can be created |
| `isModern` | Chrome ≥ 121, Firefox ≥ 128, or Safari ≥ 16.4 |
| `isMissingChromeObject` | Chromium UA without `window.chrome.runtime` |
| `isSoftwareRenderer` | WebGL reports SwiftShader, llvmpipe, or similar |
| `isSuspiciousWindowDimensions` | No browser chrome and window at screen origin |
| `isEmptyPlugins` | Chromium with zero `navigator.plugins` |
| `isAutomationArtifacts` | ChromeDriver, Puppeteer, or Playwright markers |
| `isSuspiciousWebDriverDescriptor` | `navigator.webdriver` patched or own-property tampering |
| `isChromium` | Chrome/Edge/Chromium user agent |
| `isShaderF16Supported` | WebGPU `shader-f16` feature (async, Chromium only) |
| `isLegitClient` | Combined pass/fail across applicable checks |

---

## Behavioral detection

Observes user interaction over time and produces a **weighted suspicion score** (0–1) with per-signal confidence. Use this after instant checks pass, or in parallel while the user interacts with the page.

```ts
import { createBehavioralClientDetector } from "is-suspicious-client";

const detector = createBehavioralClientDetector({
  context: window,
  minObservationMs: 5_000,
  scoreThreshold: 0.55,
  onUpdate: (result) => {
    console.log(result.suspicionScore, result.confidence, result.signals);
  },
});

// Option A: observe for a fixed duration
const result = await detector.observe(8_000);
console.log(result.isLegitClient, result.suspicionScore);

// Option B: manual lifecycle
detector.start();
// ... later
const live = detector.getResult();
detector.stop();
```

### Behavioral signals

Each signal has a `weight` (0–1) and `confidence` (`high` | `medium` | `low`). The overall `suspicionScore` aggregates triggered weights as `1 - Π(1 - weight)`.

| Signal | Weight | Confidence | Description |
| --- | --- | --- | --- |
| `no-mouse-activity` | 0.20 | low | Clicks without any mouse movement |
| `click-without-mouse-movement` | 0.35 | high | Click with no recent mouse path |
| `linear-mouse-movement` | 0.25 | medium | Unusually straight path, uniform speed |
| `teleport-mouse` | 0.40 | high | Implausible cursor jumps |
| `linear-scroll` | 0.30 | medium | Uniform scroll deltas and timing |
| `linear-typing` | 0.35 | high | Robotic or superhuman key intervals |
| `synthetic-events` | 0.50 | high | `isTrusted === false` on input events |

### Behavioral result

```ts
interface BehavioralClientResult {
  suspicionScore: number;       // 0–1
  confidence: "high" | "medium" | "low";
  signals: BehavioralSignal[];  // per-signal breakdown
  sampleCounts: {
    mouseMoves: number;
    scrolls: number;
    keyPresses: number;
    clicks: number;
    syntheticEvents: number;
  };
  observationMs: number;
  isLegitClient: boolean;       // suspicionScore < threshold
}
```

### Pure analysis (no listeners)

For testing or server-side replay of captured event samples:

```ts
import { analyzeBehavioralSamples } from "is-suspicious-client";

const result = analyzeBehavioralSamples({
  mouseMoves: [{ x: 0, y: 0, t: 0, isTrusted: true }, /* ... */],
  scrolls: [],
  keyPresses: [],
  clicks: [],
  observationMs: 5_000,
});
```

---

## API reference

```ts
import {
  // Instant
  detectInstantClient,
  detectInstantClientAsync,

  // Behavioral
  createBehavioralClientDetector,
  analyzeBehavioralSamples,

  // Helpers
  checkShaderF16Support,
  isChromiumBrowser,
  isSoftwareRenderer,
  isAutomationArtifacts,
} from "is-suspicious-client";
```

`detectSuspiciousClient` and `detectSuspiciousClientAsync` remain as deprecated aliases for backward compatibility.

## License

MIT
