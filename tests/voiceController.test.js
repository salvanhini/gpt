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

  return {
    state,
    controller: createVoiceController({
      state,
      render: () => {},
      getActiveChat: () => null,
      showToast: () => {},
      generateSpeechAudio: async () => new Blob(),
      transcribeAudio: async () => "",
      getSpeechSynthesis: () => null,
      createSpeechRecognition: () => {
        throw new Error("unused");
      },
      pickPortugueseVoice: () => null,
      isSpeechRecognitionSupported: () => false,
      isMediaRecorderSupported: () => false,
      getMicrophoneStream: async () => {
        throw new Error("unused");
      },
      settings: {},
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
