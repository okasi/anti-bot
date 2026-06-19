import { chromium, type Browser } from "patchright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  linearMousePath,
  linearScroll,
  linearTyping,
  openHarnessPage,
  organicMousePath,
  organicScroll,
  organicTyping,
  runBehavioralObserve,
  teleportMouse,
  triggeredSignalIds,
} from "../helpers/patchright-harness.js";
import { startTestServer, type TestServer } from "../helpers/test-server.js";

describe("patchright behavioral detection — automated interaction patterns", () => {
  let server: TestServer;
  let browser: Browser;

  beforeAll(async () => {
    server = await startTestServer();
    browser = await chromium.launch({ headless: true });
  });

  afterAll(async () => {
    await browser.close();
    await server.close();
  });

  it("flags linear mouse movement as suspicious", async () => {
    const { context, page } = await openHarnessPage(browser, server.baseUrl);
    await linearMousePath(page);

    const result = await runBehavioralObserve(page, 1_500);

    expect(triggeredSignalIds(result.signals)).toContain("linear-mouse-movement");
    expect(result.isLegitClient).toBe(false);

    await context.close();
  });

  it("flags teleport mouse jumps", async () => {
    const { context, page } = await openHarnessPage(browser, server.baseUrl);
    await teleportMouse(page);

    const result = await runBehavioralObserve(page, 1_000);

    expect(triggeredSignalIds(result.signals)).toContain("teleport-mouse");

    await context.close();
  });

  it("flags linear scroll patterns", async () => {
    const { context, page } = await openHarnessPage(browser, server.baseUrl);
    await linearScroll(page);

    const result = await runBehavioralObserve(page, 1_500);

    expect(triggeredSignalIds(result.signals)).toContain("linear-scroll");
    expect(result.isLegitClient).toBe(false);

    await context.close();
  });

  it("flags robotic typing intervals", async () => {
    const { context, page } = await openHarnessPage(browser, server.baseUrl);
    await linearTyping(page);

    const result = await runBehavioralObserve(page, 1_500);

    expect(triggeredSignalIds(result.signals)).toContain("linear-typing");
    expect(result.isLegitClient).toBe(false);

    await context.close();
  });

  it("flags click without preceding mouse movement", async () => {
    const { context, page } = await openHarnessPage(browser, server.baseUrl);
    await page.click("#click-target");

    const result = await runBehavioralObserve(page, 1_000);

    expect(triggeredSignalIds(result.signals)).toContain(
      "click-without-mouse-movement",
    );

    await context.close();
  });

  it("flags synthetic untrusted pointer events", async () => {
    const { context, page } = await openHarnessPage(browser, server.baseUrl);

    await page.evaluate(() => {
      const target = document.getElementById("click-target");
      target?.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true }),
      );
    });

    const result = await runBehavioralObserve(page, 1_000);

    expect(triggeredSignalIds(result.signals)).toContain("synthetic-events");

    await context.close();
  });

  it("combines multiple robotic signals into a high score", async () => {
    const { context, page } = await openHarnessPage(browser, server.baseUrl);
    await linearMousePath(page);
    await linearScroll(page);
    await linearTyping(page);
    await page.click("#click-target");

    const result = await runBehavioralObserve(page, 2_000);

    expect(result.suspicionScore).toBeGreaterThan(0.7);
    expect(result.isLegitClient).toBe(false);

    await context.close();
  });

  it("organic mouse and scroll stays below threshold", async () => {
    const { context, page } = await openHarnessPage(browser, server.baseUrl);
    await organicMousePath(page);
    await organicScroll(page);
    await organicTyping(page);

    const result = await runBehavioralObserve(page, 3_000);

    expect(result.suspicionScore).toBeLessThan(0.55);
    expect(result.isLegitClient).toBe(true);

    await context.close();
  });

  it("returns sample counts after observation", async () => {
    const { context, page } = await openHarnessPage(browser, server.baseUrl);
    await linearMousePath(page);

    const result = await page.evaluate(async () => {
      const detection = (window as any).__detection;
      const detector = detection.createBehavioralClientDetector({
        context: window,
        scoreThreshold: 0.55,
      });
      return detector.observe(1_000);
    });

    expect(result.sampleCounts.mouseMoves).toBeGreaterThan(0);
    expect(result.observationMs).toBeGreaterThan(0);

    await context.close();
  });
});
