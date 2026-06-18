import { describe, expect, it, vi } from "vitest";
import detectSuspiciousClient, {
  detectSuspiciousClientAsync,
  isChromiumBrowser,
} from "../src/detectSuspiciousClient.js";
import type { ExtendedWindow } from "../src/types.js";

function createMockContext(
  overrides: Partial<ExtendedWindow> = {},
): ExtendedWindow {
  const canvas = {
    getContext: vi.fn().mockReturnValue({}),
  };

  const baseDocument = {
    createElement: vi.fn().mockReturnValue(canvas),
  };

  const baseNavigator = {
    webdriver: false,
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  };

  const baseScreen = {
    width: 1920,
    height: 1080,
  };

  const {
    document: documentOverrides,
    navigator: navigatorOverrides,
    screen: screenOverrides,
    ...rest
  } = overrides;

  return {
    ...rest,
    document: {
      ...baseDocument,
      ...documentOverrides,
    } as ExtendedWindow["document"],
    navigator: {
      ...baseNavigator,
      ...navigatorOverrides,
    } as ExtendedWindow["navigator"],
    screen: {
      ...baseScreen,
      ...screenOverrides,
    } as ExtendedWindow["screen"],
  } as ExtendedWindow;
}

describe("detectSuspiciousClient", () => {
  it("flags a clean browser as legit", () => {
    const result = detectSuspiciousClient(createMockContext());

    expect(result.isLegitClient).toBe(true);
    expect(result.isChromium).toBe(true);
    expect(result.isWebDriver).toBe(false);
  });

  it("flags webdriver clients", () => {
    const result = detectSuspiciousClient(
      createMockContext({
        navigator: { webdriver: true },
      }),
    );

    expect(result.isWebDriver).toBe(true);
    expect(result.isHeadless).toBe(true);
    expect(result.isLegitClient).toBe(false);
  });

  it("flags selenium markers", () => {
    const result = detectSuspiciousClient(
      createMockContext({
        document: { __selenium_unwrapped: true },
      }),
    );

    expect(result.isSelenium).toBe(true);
    expect(result.isLegitClient).toBe(false);
  });

  it("flags suspicious resolutions", () => {
    const result = detectSuspiciousClient(
      createMockContext({
        screen: { width: 100, height: 100 } as ExtendedWindow["screen"],
      }),
    );

    expect(result.isSuspiciousResolution).toBe(true);
    expect(result.isLegitClient).toBe(false);
  });

  it("flags invalid user agents", () => {
    const result = detectSuspiciousClient(
      createMockContext({
        navigator: {
          userAgent: "python-requests/2.31.0",
        } as ExtendedWindow["navigator"],
      }),
    );

    expect(result.isUserAgentValid).toBe(false);
    expect(result.isLegitClient).toBe(false);
  });
});

describe("isChromiumBrowser", () => {
  it("detects Chrome user agents", () => {
    expect(
      isChromiumBrowser(
        createMockContext({
          navigator: {
            userAgent:
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
          } as ExtendedWindow["navigator"],
        }),
      ),
    ).toBe(true);
  });

  it("detects Edge user agents", () => {
    expect(
      isChromiumBrowser(
        createMockContext({
          navigator: {
            userAgent:
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36 Edg/121.0.0.0",
          } as ExtendedWindow["navigator"],
        }),
      ),
    ).toBe(true);
  });

  it("does not flag Firefox", () => {
    expect(
      isChromiumBrowser(
        createMockContext({
          navigator: {
            userAgent:
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0",
          } as ExtendedWindow["navigator"],
        }),
      ),
    ).toBe(false);
  });
});

describe("detectSuspiciousClientAsync", () => {
  it("requires shader-f16 on Chromium browsers", async () => {
    const context = createMockContext({
      navigator: {
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        gpu: {
          requestAdapter: vi.fn().mockResolvedValue({
            features: new Set(["shader-f16"]),
          }),
        },
      } as ExtendedWindow["navigator"],
    });

    const result = await detectSuspiciousClientAsync(context);

    expect(result.isShaderF16Supported).toBe(true);
    expect(result.isLegitClient).toBe(true);
  });

  it("flags Chromium without shader-f16 support", async () => {
    const context = createMockContext({
      navigator: {
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        gpu: {
          requestAdapter: vi.fn().mockResolvedValue({
            features: new Set<string>(),
          }),
        },
      } as ExtendedWindow["navigator"],
    });

    const result = await detectSuspiciousClientAsync(context);

    expect(result.isShaderF16Supported).toBe(false);
    expect(result.isLegitClient).toBe(false);
  });

  it("skips shader-f16 on non-Chromium browsers", async () => {
    const context = createMockContext({
      navigator: {
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0",
      } as ExtendedWindow["navigator"],
    });

    const result = await detectSuspiciousClientAsync(context);

    expect(result.isShaderF16Supported).toBe(null);
    expect(result.isLegitClient).toBe(true);
  });
});
