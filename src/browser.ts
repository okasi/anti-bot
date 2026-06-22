export {
  analyzeBehavioralSamples,
  aggregateSuspicionScore,
  buildBehavioralSignals,
  createBehavioralClientDetector,
  hasClickWithoutMouseMovement,
  hasLinearMouseMovement,
  hasLinearScroll,
  hasLinearTyping,
  hasNoMouseActivity,
  hasSyntheticEvents,
  hasTeleportMouse,
  resolveConfidence,
} from "./behavioral/index.js";
export {
  checkShaderF16Support,
  default,
  detectInstantClient,
  detectInstantClientAsync,
  isAutomationArtifacts,
  isChromiumBrowser,
  isEmptyPlugins,
  isMissingChromeObject,
  isSoftwareRenderer,
  isSuspiciousWebDriverDescriptor,
  isSuspiciousWindowDimensions,
} from "./detectInstantClient.js";
export type {
  BehavioralClientDetector,
  BehavioralClientResult,
  BehavioralDetectorOptions,
  BehavioralSampleCounts,
  BehavioralSamples,
  BehavioralSignal,
  ConfidenceLevel,
} from "./behavioral/types.js";
export type {
  ExtendedDocument,
  ExtendedNavigator,
  ExtendedWindow,
  InstantClientAsyncResult,
  InstantClientResult,
} from "./types.js";
