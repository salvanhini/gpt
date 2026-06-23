import test from "node:test";
import assert from "node:assert/strict";

import { createVoiceController } from "../js/voiceController.js";

function createController(overrides = {}) {
  const state = {
    isListening: true,
    recognition: {
      stopped: false,
      stop() {
        this.stopped = true;
      },
    },
    mediaRecorder: {
      state: "recording",
      stopped: false,
      stop() {
        this.stopped = true;
      },
    },
    mediaStream: {
      tracks: [
        {
          stopped: false,
          stop() {
            this.stopped = true;
          },
        },
      ],
      getTracks() {
        return this.tracks;
      },
    },
    ...overrides.state,
  };
  const calls = {
    render: 0,
    toasts: [],
    microphone: 0,
    recognitionStarts: 0,
  };
  const recognition =
    overrides.recognition ||
    {
      start() {
        calls.recognitionStarts += 1;
      },
      stop() {},
    };

  return {
    state,
    calls,
    recognition,
    controller: createVoiceController({
      state,
      render: () => {
        calls.render += 1;
      },
      getActiveChat: () => null,
      showToast: (message, type) => {
        calls.toasts.push({ message, type });
      },
      transcribeAudio: async () => "",
      getSpeechSynthesis: () => null,
      createSpeechRecognition: () => recognition,
      pickPortugueseVoice: () => null,
      isSpeechRecognitionSupported: () => overrides.nativeSupported ?? false,
      isMediaRecorderSupported: () => overrides.recorderSupported ?? false,
      getMicrophoneStream: async () => {
        calls.microphone += 1;
        return (
          overrides.microphoneStream || {
            getTracks: () => [],
          }
        );
      },
      getSettings: () => overrides.settings || {},
    }),
  };
}

test("stopInput clears active recognition, recorder and stream state", () => {
  const { state, controller } = createController();

  controller.stopInput();

  assert.equal(state.isListening, false);
  assert.equal(state.recognition, null);
  assert.equal(state.mediaRecorder, null);
  assert.equal(state.mediaStream, null);
});

test("toggleInput starts native recognition before recorded fallback when the API exists", async () => {
  globalThis.window = { isSecureContext: true };
  const { state, calls, controller } = createController({
    nativeSupported: true,
    recorderSupported: true,
    settings: { openAIKey: "sk-test" },
    state: { isListening: false },
  });

  await controller.toggleInput();

  assert.equal(calls.recognitionStarts, 1);
  assert.equal(calls.microphone, 0);
  assert.equal(state.isListening, true);
});

test("service-not-allowed clears native state and starts recorded fallback when configured", async () => {
  globalThis.window = { isSecureContext: true };
  let onerror;
  const recognition = {
    start() {},
    set onerror(handler) {
      onerror = handler;
    },
    set onresult(_handler) {},
    set onend(_handler) {},
    stop() {},
  };
  const { state, calls, controller } = createController({
    recognition,
    nativeSupported: true,
    recorderSupported: true,
    settings: { openAIKey: "sk-test" },
    state: { isListening: false },
  });

  await controller.toggleInput();
  await onerror({ error: "service-not-allowed" });

  assert.equal(state.recognition, null);
  assert.equal(calls.microphone, 1);
});

test("network error clears native state and starts recorded fallback when configured", async () => {
  globalThis.window = { isSecureContext: true };
  let onerror;
  const recognition = {
    start() {},
    set onerror(handler) {
      onerror = handler;
    },
    set onresult(_handler) {},
    set onend(_handler) {},
    stop() {},
  };
  const { state, calls, controller } = createController({
    recognition,
    nativeSupported: true,
    recorderSupported: true,
    settings: { openAIKey: "sk-test" },
    state: { isListening: false },
  });

  await controller.toggleInput();
  await onerror({ error: "network" });

  assert.equal(state.recognition, null);
  assert.equal(calls.microphone, 1);
});

test("not-allowed clears native state without starting recorded fallback", async () => {
  globalThis.window = { isSecureContext: true };
  let onerror;
  const recognition = {
    start() {},
    set onerror(handler) {
      onerror = handler;
    },
    set onresult(_handler) {},
    set onend(_handler) {},
    stop() {},
  };
  const { state, calls, controller } = createController({
    recognition,
    nativeSupported: true,
    recorderSupported: true,
    settings: { openAIKey: "sk-test" },
    state: { isListening: false },
  });

  await controller.toggleInput();
  await onerror({ error: "not-allowed" });

  assert.equal(state.recognition, null);
  assert.equal(calls.microphone, 0);
});

test("toggleInput blocks insecure contexts before starting native recognition", async () => {
  globalThis.window = { isSecureContext: false };
  const { state, calls, controller } = createController({
    nativeSupported: true,
    state: { isListening: false },
  });

  await controller.toggleInput();

  assert.equal(calls.recognitionStarts, 0);
  assert.equal(state.isListening, false);
  assert.match(calls.toasts[0].message, /HTTPS ou localhost/);
});
