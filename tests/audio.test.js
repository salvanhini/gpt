import test from "node:test";
import assert from "node:assert/strict";

import { isNativeSpeechRecognitionBrowserSupported } from "../js/audio.js";

function buildEnv({
  hasCtor = true,
  isSecureContext = true,
  userAgent = "",
  brands,
  platform,
} = {}) {
  const env = {
    isSecureContext,
    navigator: {},
  };

  if (hasCtor) {
    env.SpeechRecognition = function SpeechRecognition() {};
  }

  if (userAgent) {
    env.navigator.userAgent = userAgent;
  }

  if (brands || platform) {
    env.navigator.userAgentData = {};
  }

  if (brands) {
    env.navigator.userAgentData.brands = brands;
  }

  if (platform) {
    env.navigator.userAgentData.platform = platform;
  }

  return env;
}

test("accepts Chrome desktop in secure context", () => {
  const supported = isNativeSpeechRecognitionBrowserSupported(
    buildEnv({
      userAgent:
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
    }),
  );

  assert.equal(supported, true);
});

test("accepts Edge desktop in secure context", () => {
  const supported = isNativeSpeechRecognitionBrowserSupported(
    buildEnv({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36 Edg/136.0.0.0",
    }),
  );

  assert.equal(supported, true);
});

test("rejects insecure contexts even when the API exists", () => {
  const supported = isNativeSpeechRecognitionBrowserSupported(
    buildEnv({
      isSecureContext: false,
      userAgent:
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
    }),
  );

  assert.equal(supported, false);
});

test("rejects Brave-like brand sets that usually fail the service path", () => {
  const supported = isNativeSpeechRecognitionBrowserSupported(
    buildEnv({
      brands: [
        { brand: "Chromium", version: "136" },
        { brand: "Brave", version: "136" },
      ],
      platform: "Linux",
    }),
  );

  assert.equal(supported, false);
});

test("rejects mobile Chromium where native dictation is unreliable", () => {
  const supported = isNativeSpeechRecognitionBrowserSupported(
    buildEnv({
      userAgent:
        "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Mobile Safari/537.36",
    }),
  );

  assert.equal(supported, false);
});

test("rejects browsers without the recognition constructor", () => {
  const supported = isNativeSpeechRecognitionBrowserSupported(
    buildEnv({
      hasCtor: false,
      userAgent:
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
    }),
  );

  assert.equal(supported, false);
});
