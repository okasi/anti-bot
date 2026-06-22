// src/behavioral/analysis.ts
function mean(values) {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
function coefficientOfVariation(values) {
  if (values.length < 2) {
    return 1;
  }
  const average = mean(values);
  if (average === 0) {
    return 0;
  }
  const variance = values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length;
  return Math.sqrt(variance) / Math.abs(average);
}
function maxLineDeviation(points) {
  if (points.length < 3) {
    return 0;
  }
  const start = points[0];
  const end = points[points.length - 1];
  const lineLength = Math.hypot(end.x - start.x, end.y - start.y);
  if (lineLength === 0) {
    return 0;
  }
  let maxDeviation = 0;
  for (const point of points) {
    const area = Math.abs(
      (end.x - start.x) * (start.y - point.y) - (start.x - point.x) * (end.y - start.y)
    );
    maxDeviation = Math.max(maxDeviation, area / lineLength);
  }
  return maxDeviation;
}
function createSignal(id, description, triggered, weight, confidence) {
  return {
    id,
    description,
    triggered,
    weight,
    confidence,
    score: triggered ? weight : 0
  };
}
function hasLinearMouseMovement(mouseMoves) {
  if (mouseMoves.length < 6) {
    return false;
  }
  const speeds = [];
  for (let index = 1; index < mouseMoves.length; index += 1) {
    const previous = mouseMoves[index - 1];
    const current = mouseMoves[index];
    const elapsed = current.t - previous.t;
    if (elapsed <= 0) {
      continue;
    }
    speeds.push(
      Math.hypot(current.x - previous.x, current.y - previous.y) / elapsed
    );
  }
  if (speeds.length < 5) {
    return false;
  }
  const speedUniformity = coefficientOfVariation(speeds);
  const lineDeviation = maxLineDeviation(mouseMoves);
  return speedUniformity < 0.08 && lineDeviation < 4;
}
function hasTeleportMouse(mouseMoves) {
  for (let index = 1; index < mouseMoves.length; index += 1) {
    const previous = mouseMoves[index - 1];
    const current = mouseMoves[index];
    const elapsed = current.t - previous.t;
    const distance = Math.hypot(current.x - previous.x, current.y - previous.y);
    if (elapsed <= 20 && distance > 200) {
      return true;
    }
    if (distance > 600) {
      return true;
    }
  }
  return false;
}
function hasClickWithoutMouseMovement(mouseMoves, clicks) {
  if (clicks.length === 0) {
    return false;
  }
  return clicks.some((click) => {
    const recentMoves = mouseMoves.filter(
      (move) => move.t >= click.t - 2e3 && move.t <= click.t
    );
    return recentMoves.length === 0;
  });
}
function hasNoMouseActivity(mouseMoves, clicks) {
  return clicks.length > 0 && mouseMoves.length === 0;
}
function hasLinearScroll(scrollEvents) {
  if (scrollEvents.length < 4) {
    return false;
  }
  const deltas = scrollEvents.map((event) => Math.abs(event.deltaY));
  const intervals = [];
  for (let index = 1; index < scrollEvents.length; index += 1) {
    intervals.push(scrollEvents[index].t - scrollEvents[index - 1].t);
  }
  return coefficientOfVariation(deltas) < 0.1 && coefficientOfVariation(intervals) < 0.12;
}
function hasLinearTyping(keyPresses) {
  if (keyPresses.length < 5) {
    return false;
  }
  const intervals = [];
  for (let index = 1; index < keyPresses.length; index += 1) {
    intervals.push(keyPresses[index].t - keyPresses[index - 1].t);
  }
  const intervalUniformity = coefficientOfVariation(intervals);
  const averageInterval = mean(intervals);
  return intervalUniformity < 0.08 || averageInterval < 25;
}
function hasSyntheticEvents(samples) {
  const events = [
    ...samples.mouseMoves,
    ...samples.scrolls,
    ...samples.keyPresses,
    ...samples.clicks
  ];
  return events.some((event) => !event.isTrusted);
}
function buildBehavioralSignals(samples) {
  return [
    createSignal(
      "no-mouse-activity",
      "Clicks were recorded without any mouse movement",
      hasNoMouseActivity(samples.mouseMoves, samples.clicks),
      0.2,
      "low"
    ),
    createSignal(
      "click-without-mouse-movement",
      "At least one click had no recent mouse movement",
      hasClickWithoutMouseMovement(samples.mouseMoves, samples.clicks),
      0.35,
      "high"
    ),
    createSignal(
      "linear-mouse-movement",
      "Mouse path is unusually straight with uniform speed",
      hasLinearMouseMovement(samples.mouseMoves),
      0.25,
      "medium"
    ),
    createSignal(
      "teleport-mouse",
      "Mouse position jumped implausibly between events",
      hasTeleportMouse(samples.mouseMoves),
      0.4,
      "high"
    ),
    createSignal(
      "linear-scroll",
      "Scroll deltas and timing are overly uniform",
      hasLinearScroll(samples.scrolls),
      0.3,
      "medium"
    ),
    createSignal(
      "linear-typing",
      "Typing intervals are robotic or superhuman",
      hasLinearTyping(samples.keyPresses),
      0.35,
      "high"
    ),
    createSignal(
      "synthetic-events",
      "Observed pointer or keyboard events were not trusted",
      hasSyntheticEvents(samples),
      0.5,
      "high"
    )
  ];
}

// src/behavioral/scoring.ts
function aggregateSuspicionScore(signals) {
  const triggered = signals.filter((signal) => signal.triggered);
  if (triggered.length === 0) {
    return 0;
  }
  let score = 1;
  for (const signal of triggered) {
    score *= 1 - signal.weight;
  }
  return 1 - score;
}
function resolveConfidence(signals, sampleCounts, suspicionScore) {
  const totalSamples = sampleCounts.mouseMoves + sampleCounts.scrolls + sampleCounts.keyPresses + sampleCounts.clicks;
  const triggeredHigh = signals.filter(
    (signal) => signal.triggered && signal.confidence === "high"
  ).length;
  if (totalSamples < 5) {
    return "low";
  }
  if (triggeredHigh >= 2 || suspicionScore >= 0.75) {
    return "high";
  }
  if (suspicionScore >= 0.4 || totalSamples >= 20) {
    return "medium";
  }
  return "low";
}
function countSyntheticEvents(samples) {
  return [
    ...samples.mouseMoves,
    ...samples.scrolls,
    ...samples.keyPresses,
    ...samples.clicks
  ].filter((event) => !event.isTrusted).length;
}
function analyzeBehavioralSamples(samples, scoreThreshold = 0.55) {
  const signals = buildBehavioralSignals(samples);
  const suspicionScore = aggregateSuspicionScore(signals);
  const sampleCounts = {
    mouseMoves: samples.mouseMoves.length,
    scrolls: samples.scrolls.length,
    keyPresses: samples.keyPresses.length,
    clicks: samples.clicks.length,
    syntheticEvents: countSyntheticEvents(samples)
  };
  const confidence = resolveConfidence(signals, sampleCounts, suspicionScore);
  return {
    suspicionScore,
    confidence,
    signals,
    sampleCounts,
    observationMs: samples.observationMs,
    isLegitClient: suspicionScore < scoreThreshold
  };
}

// src/behavioral/index.ts
var DEFAULT_MIN_OBSERVATION_MS = 3e3;
var DEFAULT_SCORE_THRESHOLD = 0.55;
var DEFAULT_POLL_INTERVAL_MS = 1e3;
function createEmptySamples(observationMs = 0) {
  return {
    mouseMoves: [],
    scrolls: [],
    keyPresses: [],
    clicks: [],
    observationMs
  };
}
function createBehavioralClientDetector(options = {}) {
  const context = options.context ?? globalThis;
  const minObservationMs = options.minObservationMs ?? DEFAULT_MIN_OBSERVATION_MS;
  const scoreThreshold = options.scoreThreshold ?? DEFAULT_SCORE_THRESHOLD;
  const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  let samples = createEmptySamples();
  let startedAt = 0;
  let listeners = [];
  let pollTimer;
  let isActive = false;
  const getObservationMs = () => {
    if (startedAt === 0) {
      return samples.observationMs;
    }
    return Math.max(samples.observationMs, Date.now() - startedAt);
  };
  const evaluate = () => analyzeBehavioralSamples(
    {
      ...samples,
      observationMs: getObservationMs()
    },
    scoreThreshold
  );
  const addListener = (target, type, handler) => {
    target.addEventListener(type, handler, { passive: true });
    listeners.push({ target, type, handler });
  };
  const onMouseMove = (event) => {
    const mouseEvent = event;
    const sample = {
      x: mouseEvent.clientX,
      y: mouseEvent.clientY,
      t: Date.now(),
      isTrusted: mouseEvent.isTrusted
    };
    samples.mouseMoves.push(sample);
  };
  const onWheel = (event) => {
    const wheelEvent = event;
    const sample = {
      deltaY: wheelEvent.deltaY,
      t: Date.now(),
      isTrusted: wheelEvent.isTrusted
    };
    samples.scrolls.push(sample);
  };
  const onKeyDown = (event) => {
    const keyboardEvent = event;
    const sample = {
      t: Date.now(),
      isTrusted: keyboardEvent.isTrusted
    };
    samples.keyPresses.push(sample);
  };
  const onClick = (event) => {
    const mouseEvent = event;
    const sample = {
      x: mouseEvent.clientX,
      y: mouseEvent.clientY,
      t: Date.now(),
      isTrusted: mouseEvent.isTrusted
    };
    samples.clicks.push(sample);
  };
  const start = () => {
    if (isActive) {
      return;
    }
    isActive = true;
    startedAt = Date.now();
    addListener(context, "mousemove", onMouseMove);
    addListener(context, "wheel", onWheel);
    addListener(context, "keydown", onKeyDown);
    addListener(context, "click", onClick);
    if (options.onUpdate) {
      pollTimer = setInterval(() => {
        options.onUpdate?.(evaluate());
      }, pollIntervalMs);
    }
  };
  const stop = () => {
    if (!isActive) {
      return;
    }
    isActive = false;
    samples.observationMs = getObservationMs();
    for (const listener of listeners) {
      listener.target.removeEventListener(listener.type, listener.handler);
    }
    listeners = [];
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = void 0;
    }
  };
  const reset = () => {
    stop();
    samples = createEmptySamples();
    startedAt = 0;
  };
  const getResult = () => evaluate();
  const observe = (durationMs = minObservationMs) => new Promise((resolve) => {
    start();
    setTimeout(() => {
      stop();
      resolve(getResult());
    }, durationMs);
  });
  return {
    start,
    stop,
    reset,
    getResult,
    observe
  };
}

// src/webgpu.ts
function isChromiumBrowser(context) {
  const userAgent = context.navigator.userAgent;
  return userAgent.includes("Chrome/") || userAgent.includes("Edg/");
}
async function checkShaderF16Support(context) {
  if (!isChromiumBrowser(context)) {
    return true;
  }
  const gpu = context.navigator.gpu;
  if (!gpu) {
    return false;
  }
  try {
    const adapter = await gpu.requestAdapter();
    if (!adapter) {
      return false;
    }
    return adapter.features.has("shader-f16");
  } catch {
    return false;
  }
}

// src/checks.ts
var SOFTWARE_RENDERER_PATTERNS = [
  /swiftshader/i,
  /llvmpipe/i,
  /mesa offscreen/i,
  /software renderer/i
];
var WINDOW_AUTOMATION_KEY_PATTERNS = [
  /^cdc_[a-zA-Z0-9]+_/,
  /^__playwright/,
  /^__pw_/,
  /^_WEBDRIVER_ELEM_CACHE$/
];
var DOCUMENT_AUTOMATION_KEY_PATTERNS = [
  /^cdc_[a-zA-Z0-9]+_/,
  /^\$cdc_/,
  /^\$chrome_asyncScriptInfo$/,
  /^__webdriver/,
  /^__selenium/,
  /^__driver/
];
function hasMatchingKey(target, patterns) {
  for (const key of Object.getOwnPropertyNames(target)) {
    for (const pattern of patterns) {
      if (pattern.test(key)) {
        return true;
      }
    }
  }
  return false;
}
function isMissingChromeObject(context) {
  if (!isChromiumBrowser(context)) {
    return false;
  }
  const chrome = context.chrome;
  return chrome?.runtime === void 0;
}
function isSoftwareRenderer(context) {
  const canvas = context.document.createElement("canvas");
  const gl = canvas.getContext("webgl") ?? canvas.getContext("experimental-webgl");
  if (!gl) {
    return false;
  }
  const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
  if (!debugInfo) {
    return false;
  }
  const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
  if (typeof renderer !== "string") {
    return false;
  }
  return SOFTWARE_RENDERER_PATTERNS.some((pattern) => pattern.test(renderer));
}
function isSuspiciousWindowDimensions(context) {
  const noBrowserChrome = context.outerWidth === context.innerWidth && context.outerHeight === context.innerHeight;
  const zeroScreenOffset = context.screenX === 0 && context.screenY === 0 && context.outerWidth > 800;
  return noBrowserChrome && zeroScreenOffset;
}
function isEmptyPlugins(context) {
  if (!isChromiumBrowser(context)) {
    return false;
  }
  return context.navigator.plugins.length === 0;
}
function isAutomationArtifacts(context) {
  if (context.__playwright || context.__pw_manual || context._WEBDRIVER_ELEM_CACHE) {
    return true;
  }
  if (hasMatchingKey(context, WINDOW_AUTOMATION_KEY_PATTERNS)) {
    return true;
  }
  return hasMatchingKey(context.document, DOCUMENT_AUTOMATION_KEY_PATTERNS);
}
function isSuspiciousWebDriverDescriptor(context) {
  if (Object.prototype.hasOwnProperty.call(context.navigator, "webdriver")) {
    return true;
  }
  if (typeof Navigator === "undefined" || typeof window === "undefined") {
    return false;
  }
  if (!isChromiumBrowser(context)) {
    return false;
  }
  const prototypeDescriptor = Object.getOwnPropertyDescriptor(
    Navigator.prototype,
    "webdriver"
  );
  return !prototypeDescriptor;
}

// src/detectInstantClient.ts
function parseBrowserVersion(userAgent, pattern) {
  const match = userAgent.match(pattern);
  return parseFloat(match?.[1] ?? "0");
}
function detectSync(context) {
  const isWebDriver = Boolean(context.navigator?.webdriver);
  const isPhantomJS = Boolean(context.callPhantom || context._phantom);
  const isNightmare = Boolean(context.__nightmare);
  const isSelenium = Boolean(
    context.document.__selenium_unwrapped || context.document.__webdriver_evaluate || context.document.__driver_evaluate
  );
  const isDomAutomation = Boolean(
    context.domAutomation || context.domAutomationController
  );
  const isHeadless = Boolean(
    context.navigator.webdriver || context.navigator.userAgent.includes("Headless")
  );
  const isSuspiciousResolution = context.screen.width < 136 || context.screen.height < 170;
  const isUserAgentValid = context.navigator.userAgent.startsWith("Mozilla/5.0 (");
  const isWebGLSupported = Boolean(
    context.document.createElement("canvas").getContext("webgl")
  );
  const userAgent = context.navigator.userAgent;
  const isModern = userAgent.includes("Chrome/") && parseBrowserVersion(userAgent, /Chrome\/(\d+\.\d+)/) >= 121 || userAgent.includes("Firefox/") && parseBrowserVersion(userAgent, /Firefox\/(\d+\.\d+)/) >= 128 || userAgent.includes("Safari") && !userAgent.includes("Chrome") && parseBrowserVersion(userAgent, /Version\/(\d+\.\d+)/) >= 16.4;
  return {
    isWebDriver,
    isPhantomJS,
    isNightmare,
    isSelenium,
    isDomAutomation,
    isHeadless,
    isSuspiciousResolution,
    isUserAgentValid,
    isWebGLSupported,
    isModern,
    isMissingChromeObject: isMissingChromeObject(context),
    isSoftwareRenderer: isSoftwareRenderer(context),
    isSuspiciousWindowDimensions: isSuspiciousWindowDimensions(context),
    isEmptyPlugins: isEmptyPlugins(context),
    isAutomationArtifacts: isAutomationArtifacts(context),
    isSuspiciousWebDriverDescriptor: isSuspiciousWebDriverDescriptor(context)
  };
}
function computeIsLegitClient(checks) {
  const shaderF16Passes = checks.isShaderF16Supported === void 0 || checks.isShaderF16Supported === null || checks.isShaderF16Supported;
  return !checks.isWebDriver && !checks.isPhantomJS && !checks.isNightmare && !checks.isSelenium && !checks.isDomAutomation && !checks.isHeadless && !checks.isSuspiciousResolution && checks.isUserAgentValid && checks.isWebGLSupported && checks.isModern && !checks.isMissingChromeObject && !checks.isSoftwareRenderer && !checks.isSuspiciousWindowDimensions && !checks.isEmptyPlugins && !checks.isAutomationArtifacts && !checks.isSuspiciousWebDriverDescriptor && shaderF16Passes;
}
function detectInstantClient(context) {
  const checks = detectSync(context);
  const isChromium = isChromiumBrowser(context);
  return {
    ...checks,
    isChromium,
    isLegitClient: computeIsLegitClient({ ...checks})
  };
}
var detectInstantClient_default = detectInstantClient;
async function detectInstantClientAsync(context) {
  const checks = detectSync(context);
  const isChromium = isChromiumBrowser(context);
  const shaderF16Supported = isChromium ? await checkShaderF16Support(context) : null;
  return {
    ...checks,
    isChromium,
    isShaderF16Supported: shaderF16Supported,
    isLegitClient: computeIsLegitClient({
      ...checks,
      isShaderF16Supported: shaderF16Supported
    })
  };
}

export { aggregateSuspicionScore, analyzeBehavioralSamples, buildBehavioralSignals, checkShaderF16Support, createBehavioralClientDetector, detectInstantClient_default as default, detectInstantClient, detectInstantClientAsync, hasClickWithoutMouseMovement, hasLinearMouseMovement, hasLinearScroll, hasLinearTyping, hasNoMouseActivity, hasSyntheticEvents, hasTeleportMouse, isAutomationArtifacts, isChromiumBrowser, isEmptyPlugins, isMissingChromeObject, isSoftwareRenderer, isSuspiciousWebDriverDescriptor, isSuspiciousWindowDimensions, resolveConfidence };
//# sourceMappingURL=browser.js.map
//# sourceMappingURL=browser.js.map