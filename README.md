# is-suspicious-client

Detect headless browsers, automation frameworks, and other suspicious client signals in the browser.

## Install

```bash
npm install is-suspicious-client
```

## Usage

### Synchronous checks

```ts
import detectSuspiciousClient from "is-suspicious-client";

const result = detectSuspiciousClient(window);

if (!result.isLegitClient) {
  console.warn("Suspicious client detected", result);
}
```

### Async checks (includes WebGPU `shader-f16` on Chromium)

On Chrome, Edge, and other Chromium browsers, real clients typically expose the WebGPU [`shader-f16`](https://scrapfly.io/web-scraping-tools/gpu-fingerprint/webgpu/shader-f16) feature. Bots and patched automation stacks often do not.

```ts
import { detectSuspiciousClientAsync } from "is-suspicious-client";

const result = await detectSuspiciousClientAsync(window);

console.log(result.isShaderF16Supported); // true | false | null (null = not Chromium)
console.log(result.isLegitClient);
```

## Signals

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
| `isChromium` | Chrome/Edge/Chromium user agent |
| `isShaderF16Supported` | WebGPU `shader-f16` feature (async, Chromium only) |
| `isLegitClient` | Combined pass/fail across applicable checks |

## API

```ts
import detectSuspiciousClient, {
  detectSuspiciousClientAsync,
  checkShaderF16Support,
  isChromiumBrowser,
} from "is-suspicious-client";
```

- `detectSuspiciousClient(context)` — sync detection
- `detectSuspiciousClientAsync(context)` — sync checks plus WebGPU `shader-f16` on Chromium
- `checkShaderF16Support(context)` — standalone async WebGPU check
- `isChromiumBrowser(context)` — whether the user agent is Chromium-based

## License

MIT
