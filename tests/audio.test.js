import test from "node:test";
import assert from "node:assert/strict";

import {
  hasNativeSpeechRecognition,
  isSpeechRecognitionSupportedInContext,
} from "../js/audio.js";

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

test("detects native speech recognition by constructor presence", () => {
  assert.equal(hasNativeSpeechRecognition(buildEnv()), true);
  assert.equal(hasNativeSpeechRecognition(buildEnv({ hasCtor: false })), false);
});

test("allows native speech recognition attempts in secure contexts", () => {
  const supported = isSpeechRecognitionSupportedInContext(
    buildEnv({
      userAgent:
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
    }),
  );

  assert.equal(supported, true);
});

test("does not reject Brave-like brand sets before trying native speech", () => {
  const supported = isSpeechRecognitionSupportedInContext(
    buildEnv({
      brands: [
        { brand: "Chromium", version: "136" },
        { brand: "Brave", version: "136" },
      ],
      platform: "Linux",
    }),
  );

  assert.equal(supported, true);
});

test("does not reject mobile Chromium before trying native speech", () => {
  const supported = isSpeechRecognitionSupportedInContext(
    buildEnv({
      userAgent:
        "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Mobile Safari/537.36",
    }),
  );

  assert.equal(supported, true);
});

test("rejects insecure contexts even when the API exists", () => {
  const supported = isSpeechRecognitionSupportedInContext(
    buildEnv({
      isSecureContext: false,
      userAgent:
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
    }),
  );

  assert.equal(supported, false);
});

test("rejects browsers without the recognition constructor", () => {
  const supported = isSpeechRecognitionSupportedInContext(
    buildEnv({
      hasCtor: false,
      userAgent:
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
    }),
  );

  assert.equal(supported, false);
});
