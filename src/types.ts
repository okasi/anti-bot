export interface ExtendedDocument extends Document {
  __selenium_unwrapped?: unknown;
  __webdriver_evaluate?: unknown;
  __driver_evaluate?: unknown;
}

export interface ExtendedNavigator extends Omit<Navigator, "gpu"> {
  gpu?: GPU;
}

export interface ExtendedWindow extends Omit<Window, "document" | "navigator"> {
  callPhantom?: unknown;
  _phantom?: unknown;
  __nightmare?: unknown;
  chrome?: unknown;
  domAutomation?: unknown;
  domAutomationController?: unknown;
  document: ExtendedDocument;
  navigator: ExtendedNavigator;
}

export interface SuspiciousClientResult {
  isWebDriver: boolean;
  isPhantomJS: boolean;
  isNightmare: boolean;
  isSelenium: boolean;
  isDomAutomation: boolean;
  isHeadless: boolean;
  isSuspiciousResolution: boolean;
  isUserAgentValid: boolean;
  isWebGLSupported: boolean;
  isModern: boolean;
  isChromium: boolean;
  isLegitClient: boolean;
}

export interface SuspiciousClientAsyncResult extends SuspiciousClientResult {
  /** `true`/`false` on Chromium; `null` when the check does not apply */
  isShaderF16Supported: boolean | null;
}
