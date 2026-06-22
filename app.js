import {
  createBehavioralClientDetector,
  detectInstantClient,
  detectInstantClientAsync,
} from "./browser.js";

const INSTANT_LABELS = {
  isWebDriver: "navigator.webdriver is true",
  isPhantomJS: "PhantomJS globals on window",
  isNightmare: "Nightmare.js marker present",
  isSelenium: "Selenium markers on document",
  isDomAutomation: "DOM automation controller globals",
  isHeadless: "HeadlessChrome or webdriver in UA",
  isSuspiciousResolution: "Screen smaller than 136×170",
  isUserAgentValid: "User-Agent starts with Mozilla/5.0",
  isWebGLSupported: "WebGL context available",
  isModern: "Chrome 121+ / Firefox 128+ / Safari 16.4+",
  isMissingChromeObject: "Chromium without chrome.runtime",
  isSoftwareRenderer: "SwiftShader or llvmpipe renderer",
  isSuspiciousWindowDimensions: "No browser chrome at screen origin",
  isEmptyPlugins: "navigator.plugins length is zero",
  isAutomationArtifacts: "Playwright / ChromeDriver artifacts",
  isSuspiciousWebDriverDescriptor: "Patched webdriver property",
  isChromium: "Chromium-based browser",
  isShaderF16Supported: "WebGPU shader-f16 support (async only)",
  isLegitClient: "All instant checks passed",
};

const INSTANT_ORDER = [
  "isLegitClient",
  "isWebDriver",
  "isHeadless",
  "isAutomationArtifacts",
  "isSelenium",
  "isPhantomJS",
  "isNightmare",
  "isDomAutomation",
  "isSuspiciousWebDriverDescriptor",
  "isMissingChromeObject",
  "isEmptyPlugins",
  "isSoftwareRenderer",
  "isSuspiciousResolution",
  "isSuspiciousWindowDimensions",
  "isUserAgentValid",
  "isWebGLSupported",
  "isModern",
  "isChromium",
  "isShaderF16Supported",
];

let instantFilter = "all";
let lastInstantResult = null;

const instantVerdict = document.getElementById("instant-verdict");
const instantLabel = document.getElementById("instant-label");
const instantStatus = document.getElementById("instant-status");
const instantBadge = document.getElementById("instant-badge");
const instantTable = document.getElementById("instant-table");
const instantCount = document.getElementById("instant-count");

const behavioralVerdict = document.getElementById("behavioral-verdict");
const behavioralLabel = document.getElementById("behavioral-label");
const behavioralStatus = document.getElementById("behavioral-status");
const behavioralBadge = document.getElementById("behavioral-badge");
const behavioralSignals = document.getElementById("behavioral-signals");
const scoreFill = document.getElementById("score-fill");
const scoreText = document.getElementById("score-text");

const summaryInstantValue = document.getElementById("summary-instant-value");
const summaryInstantMeta = document.getElementById("summary-instant-meta");
const summaryBehavioralValue = document.getElementById("summary-behavioral-value");
const summaryBehavioralMeta = document.getElementById("summary-behavioral-meta");

const POSITIVE_FLAGS = new Set([
  "isUserAgentValid",
  "isWebGLSupported",
  "isModern",
  "isChromium",
]);

function isFlagBad(key, value) {
  if (key === "isLegitClient") {
    return !value;
  }
  if (key === "isShaderF16Supported") {
    return value === false;
  }
  if (POSITIVE_FLAGS.has(key)) {
    return !value;
  }
  return Boolean(value);
}

function statusForFlag(key, value) {
  if (key === "isShaderF16Supported") {
    if (value === null) {
      return { label: "N/A", tone: "neutral" };
    }
    return { label: value ? "legit" : "fail", tone: value ? "ok" : "bad" };
  }

  const bad = isFlagBad(key, value);
  return { label: bad ? "fail" : "legit", tone: bad ? "bad" : "ok" };
}

function setVerdict(container, iconEl, labelEl, badgeEl, isLegit, label, pending = false) {
  container.classList.remove("verdict--legit", "verdict--suspicious", "verdict--pending");
  if (pending) {
    container.classList.add("verdict--pending");
    iconEl.textContent = "◌";
    badgeEl.textContent = "Pending";
    badgeEl.className = "pill pill--neutral";
    return;
  }

  container.classList.add(isLegit ? "verdict--legit" : "verdict--suspicious");
  iconEl.textContent = isLegit ? "✓" : "!";
  labelEl.textContent = label;
  badgeEl.textContent = isLegit ? "Legit" : "Suspicious";
  badgeEl.className = `pill ${isLegit ? "pill--ok" : "pill--bad"}`;
}

function countInstantFlags(result) {
  let failed = 0;
  let total = 0;
  for (const key of INSTANT_ORDER) {
    if (key === "isLegitClient" || !(key in result)) {
      continue;
    }
    total += 1;
    if (isFlagBad(key, result[key])) {
      failed += 1;
    }
  }
  return { failed, total, legit: total - failed };
}

function renderInstantRows(result) {
  lastInstantResult = result;
  instantTable.replaceChildren();

  const counts = countInstantFlags(result);
  instantCount.textContent = `${counts.failed} fail · ${counts.legit} legit · ${counts.total} checks`;

  let visibleRows = 0;

  for (const key of INSTANT_ORDER) {
    if (!(key in result) || !(key in INSTANT_LABELS)) {
      continue;
    }

    const value = result[key];
    const bad = isFlagBad(key, value);
    const show =
      instantFilter === "all" ||
      (instantFilter === "fail" && bad) ||
      (instantFilter === "legit" && !bad);

    if (!show) {
      continue;
    }

    visibleRows += 1;

    const row = document.createElement("tr");
    row.className = key === "isLegitClient" ? "is-summary" : bad ? "is-triggered" : "is-clear";

    const nameCell = document.createElement("td");
    nameCell.innerHTML = `<span class="flag-name">${key}</span>`;

    const descCell = document.createElement("td");
    descCell.innerHTML = `<span class="flag-desc">${INSTANT_LABELS[key]}</span>`;

    const stateCell = document.createElement("td");
    const status = statusForFlag(key, value);
    stateCell.innerHTML = `<span class="status-pill status-pill--${status.tone}">${status.label}</span>`;

    row.append(nameCell, descCell, stateCell);
    instantTable.appendChild(row);
  }

  if (visibleRows === 0) {
    const row = document.createElement("tr");
    row.className = "is-empty";
    row.innerHTML =
      '<td colspan="3">No flags match this filter. Try <strong>All</strong> or switch filters.</td>';
    instantTable.appendChild(row);
  }
}

function updateInstantSummary(result) {
  const counts = countInstantFlags(result);
  summaryInstantValue.textContent = result.isLegitClient ? "Legit client" : "Suspicious";
  summaryInstantValue.style.color = result.isLegitClient ? "var(--ok)" : "var(--bad)";
  summaryInstantMeta.textContent = result.isLegitClient
    ? "All instant checks legit"
    : `${counts.failed} of ${counts.total} checks failed`;
}

async function runInstant() {
  instantStatus.textContent = "Running detectInstantClient…";
  const result = detectInstantClient(window);
  renderInstantRows(result);
  updateInstantSummary(result);
  setVerdict(
    instantVerdict,
    instantVerdict.querySelector(".verdict__icon"),
    instantLabel,
    instantBadge,
    result.isLegitClient,
    result.isLegitClient
      ? "This browser passes instant checks"
      : "One or more instant checks failed",
  );
  instantStatus.textContent = navigator.userAgent;
}

async function runAsync() {
  instantStatus.textContent = "Running detectInstantClientAsync (includes WebGPU)…";
  const result = await detectInstantClientAsync(window);
  renderInstantRows(result);
  updateInstantSummary(result);
  setVerdict(
    instantVerdict,
    instantVerdict.querySelector(".verdict__icon"),
    instantLabel,
    instantBadge,
    result.isLegitClient,
    result.isLegitClient
      ? "This browser passes instant + WebGPU checks"
      : "Instant or WebGPU checks failed",
  );
  const shader =
    result.isShaderF16Supported === null
      ? "shader-f16: not checked in sync path"
      : `shader-f16: ${result.isShaderF16Supported ? "supported" : "not supported"}`;
  instantStatus.textContent = shader;
}

function renderBehavioral(result) {
  const percent = Math.round(result.suspicionScore * 100);
  scoreFill.style.width = `${percent}%`;
  scoreText.textContent = result.suspicionScore.toFixed(3);

  setVerdict(
    behavioralVerdict,
    behavioralVerdict.querySelector(".verdict__icon"),
    behavioralLabel,
    behavioralBadge,
    result.isLegitClient,
    result.isLegitClient ? "Behavior looks human-like" : "Behavior looks automated",
  );

  const failedSignals = result.signals.filter((signal) => signal.triggered).length;
  behavioralStatus.textContent = `Observed ${result.observationMs}ms · ${result.sampleCounts.mouseMoves} mouse moves · ${result.sampleCounts.clicks} clicks · ${failedSignals} signals failed`;

  summaryBehavioralValue.textContent = result.isLegitClient ? "Legit" : "Suspicious";
  summaryBehavioralValue.style.color = result.isLegitClient ? "var(--ok)" : "var(--bad)";
  summaryBehavioralMeta.textContent = `Score ${result.suspicionScore.toFixed(3)} (threshold 0.55)`;

  behavioralSignals.replaceChildren();
  if (result.signals.length === 0) {
    const empty = document.createElement("li");
    empty.className = "signal-card";
    empty.innerHTML =
      '<div class="signal-card__body"><span class="signal-card__id">No signals yet</span><span class="signal-card__desc">Start observation after interacting in the zone above.</span></div><span class="signal-card__state">Run observe</span>';
    behavioralSignals.appendChild(empty);
    return;
  }

  for (const signal of result.signals) {
    const item = document.createElement("li");
    item.className = `signal-card${signal.triggered ? " is-triggered" : ""}`;
    item.innerHTML = `
      <div class="signal-card__body">
        <span class="signal-card__id">${signal.id}</span>
        <span class="signal-card__desc">${signal.description}</span>
      </div>
      <span class="signal-card__state">${signal.triggered ? "fail" : "legit"}</span>
    `;
    behavioralSignals.appendChild(item);
  }
}

async function startBehavioral() {
  const button = document.getElementById("start-behavioral");
  button.disabled = true;
  behavioralStatus.textContent = "Observing your interaction for 3 seconds…";
  setVerdict(
    behavioralVerdict,
    behavioralVerdict.querySelector(".verdict__icon"),
    behavioralLabel,
    behavioralBadge,
    false,
    "Observing…",
    true,
  );

  try {
    const detector = createBehavioralClientDetector({
      context: window,
      scoreThreshold: 0.55,
    });
    const result = await detector.observe(3_000);
    renderBehavioral(result);
  } finally {
    button.disabled = false;
  }
}

document.getElementById("run-instant").addEventListener("click", () => {
  void runInstant();
});
document.getElementById("run-async").addEventListener("click", () => {
  void runAsync();
});
document.getElementById("start-behavioral").addEventListener("click", () => {
  void startBehavioral();
});

document.getElementById("inject-webdriver").addEventListener("click", () => {
  Object.defineProperty(navigator, "webdriver", {
    get: () => true,
    configurable: true,
  });
  instantStatus.textContent = "Injected navigator.webdriver = true — re-running checks";
  void runInstant();
});

document.getElementById("inject-playwright").addEventListener("click", () => {
  window.__playwright = { version: "demo" };
  instantStatus.textContent = "Injected window.__playwright — re-running checks";
  void runInstant();
});

for (const chip of document.querySelectorAll(".chip")) {
  chip.addEventListener("click", () => {
    for (const other of document.querySelectorAll(".chip")) {
      other.classList.remove("chip--active");
    }
    chip.classList.add("chip--active");
    instantFilter = chip.dataset.filter ?? "all";
    if (lastInstantResult) {
      renderInstantRows(lastInstantResult);
    }
  });
}

const installSnippet = document.querySelector(".install-snippet");
const copyInstall = document.getElementById("copy-install");
if (copyInstall && installSnippet) {
  copyInstall.addEventListener("click", async () => {
    const text = installSnippet.textContent?.trim() ?? "";
    try {
      await navigator.clipboard.writeText(text);
      copyInstall.textContent = "Copied!";
      setTimeout(() => {
        copyInstall.textContent = "Copy";
      }, 1500);
    } catch {
      copyInstall.textContent = "Failed";
      setTimeout(() => {
        copyInstall.textContent = "Copy";
      }, 1500);
    }
  });
}

void runInstant();
