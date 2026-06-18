function buildUserErrorMessage(error, fallback) {
  const message = error?.message || fallback;
  return message?.trim() ? message : fallback;
}

export function createVoiceController({
  state,
  render,
  getActiveChat,
  showToast,
  generateSpeechAudio,
  transcribeAudio,
  getSpeechSynthesis,
  createSpeechRecognition,
  pickPortugueseVoice,
  isSpeechRecognitionSupported,
  isMediaRecorderSupported,
  getMicrophoneStream,
  getSettings,
}) {
  function syncSpeechVoice() {
    const synth = getSpeechSynthesis();
    state.speechRecognitionSupported = isSpeechRecognitionSupported();
    state.speechSynthesisSupported = Boolean(synth);
    state.mediaRecorderSupported = isMediaRecorderSupported();

    if (!synth) {
      state.availableVoice = null;
      return;
    }

    const applyVoices = () => {
      state.availableVoice = pickPortugueseVoice(synth.getVoices());
    };

    applyVoices();

    if (!state.availableVoice) {
      synth.onvoiceschanged = () => {
        applyVoices();
        render();
      };
    }
  }

  function stopSpeaking() {
    const synth = getSpeechSynthesis();
    if (synth) {
      synth.cancel();
    }
    if (state.currentAudio) {
      state.currentAudio.pause();
      state.currentAudio.currentTime = 0;
    }
    if (state.currentAudioUrl) {
      URL.revokeObjectURL(state.currentAudioUrl);
    }
    state.currentAudio = null;
    state.currentAudioUrl = null;
    state.speakingMessageId = null;
  }

  function stopInput() {
    if (state.recognition) {
      state.recognition.stop();
    }
    if (state.mediaRecorder && state.mediaRecorder.state !== "inactive") {
      state.mediaRecorder.stop();
    }
    if (state.mediaStream) {
      state.mediaStream.getTracks().forEach((track) => track.stop());
    }
    state.isListening = false;
    state.recognition = null;
    state.mediaRecorder = null;
    state.mediaStream = null;
  }

  function canUseRecordedVoiceFallback() {
    state.mediaRecorderSupported = isMediaRecorderSupported();
    return Boolean(getSettings().openAIKey && state.mediaRecorderSupported);
  }

  function showUnsupportedVoiceInputMessage() {
    showToast(
      "Ditado nativo funciona melhor em Chrome ou Edge no computador. Nos demais navegadores, configure Audio (OpenAI) para usar o microfone.",
      "error",
    );
  }

  async function speakMessage(messageId) {
    syncSpeechVoice();
    const synth = getSpeechSynthesis();
    if (state.speakingMessageId === messageId) {
      stopSpeaking();
      render();
      return;
    }

    const chat = getActiveChat();
    const message = chat?.messages.find((item) => item.id === messageId);
    if (!message) {
      return;
    }

    if (synth) {
      stopSpeaking();
      const utterance = new SpeechSynthesisUtterance(message.content);
      utterance.lang = state.availableVoice?.lang || "pt-BR";
      utterance.rate = 1;
      if (state.availableVoice) {
        utterance.voice = state.availableVoice;
      }

      utterance.onend = () => {
        state.speakingMessageId = null;
        render();
      };
      utterance.onerror = () => {
        state.speakingMessageId = null;
        showToast("Nao foi possivel reproduzir a resposta em voz alta.", "error");
        render();
      };
      state.speakingMessageId = messageId;
      synth.speak(utterance);
      render();
      return;
    }

    try {
      stopSpeaking();
      state.speakingMessageId = messageId;
      render();
      const audioBlob = await generateSpeechAudio({
        text: message.content,
        settings: getSettings(),
      });
      const url = URL.createObjectURL(audioBlob);
      const audio = new Audio(url);
      state.currentAudioUrl = url;
      state.currentAudio = audio;
      audio.onended = () => {
        stopSpeaking();
        render();
      };
      audio.onerror = () => {
        stopSpeaking();
        showToast("Nao foi possivel tocar o audio gerado.", "error");
        render();
      };
      await audio.play();
      render();
    } catch (error) {
      stopSpeaking();
      showToast(buildUserErrorMessage(error, "Nao foi possivel gerar a fala da resposta."), "error");
      render();
    }
  }

  async function handleRecordedVoiceInput() {
    if (!isMediaRecorderSupported()) {
      showToast("Microfone indisponivel neste navegador.", "error");
      return;
    }

    if (!getSettings().openAIKey) {
      showToast("Adicione a chave da OpenAI em Configurações > Audio para usar o microfone neste navegador.", "error");
      return;
    }

    try {
      const stream = await getMicrophoneStream();
      const recorder = new MediaRecorder(stream);
      state.recordedAudioChunks = [];
      state.mediaStream = stream;
      state.mediaRecorder = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data?.size) {
          state.recordedAudioChunks.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const chunks = state.recordedAudioChunks;
        state.isListening = false;
        state.isVoiceProcessing = true;
        state.mediaRecorder = null;
        if (state.mediaStream) {
          state.mediaStream.getTracks().forEach((track) => track.stop());
        }
        state.mediaStream = null;
        render();

        try {
          const audioBlob = new Blob(chunks, { type: chunks[0]?.type || "audio/webm" });
          const text = await transcribeAudio({ audioBlob, settings: getSettings() });
          state.draftMessage = state.draftMessage
            ? `${state.draftMessage.trim()} ${text}`.trim()
            : text;
          showToast("Audio transcrito.", "success");
        } catch (error) {
          showToast(buildUserErrorMessage(error, "Falha ao transcrever audio."), "error");
        } finally {
          state.isVoiceProcessing = false;
          state.recordedAudioChunks = [];
          render();
        }
      };

      recorder.start();
      state.isListening = true;
      showToast("Gravando. Clique no microfone novamente para finalizar.", "info");
      render();
    } catch (error) {
      state.isListening = false;
      state.mediaRecorder = null;
      state.mediaStream = null;
      showToast(buildUserErrorMessage(error, "Nao foi possivel acessar o microfone."), "error");
      render();
    }
  }

  async function toggleInput() {
    state.speechRecognitionSupported = isSpeechRecognitionSupported();
    state.mediaRecorderSupported = isMediaRecorderSupported();

    if (state.isListening) {
      if (state.mediaRecorder && state.mediaRecorder.state !== "inactive") {
        state.mediaRecorder.stop();
      } else {
        stopInput();
      }
      render();
      return;
    }

    if (!window.isSecureContext) {
      showToast("O ditado por voz exige HTTPS ou localhost.", "error");
      return;
    }

    if (canUseRecordedVoiceFallback()) {
      await handleRecordedVoiceInput();
      return;
    }

    if (!state.speechRecognitionSupported) {
      showUnsupportedVoiceInputMessage();
      return;
    }

    const recognition = createSpeechRecognition();
    recognition.onresult = (event) => {
      const text = Array.from(event.results)
        .map((result) => result[0]?.transcript || "")
        .join(" ")
        .trim();

      state.draftMessage = text;
      render();
    };
    recognition.onerror = async (event) => {
      const errors = {
        "not-allowed": "Permissao do microfone negada.",
        "no-speech": "Nenhuma fala detectada. Tente novamente.",
        "audio-capture": "Nenhum microfone disponivel.",
        aborted: "Captura de voz interrompida.",
        network: "Servico de voz do navegador sem conexao.",
        "service-not-allowed": "Servico de voz nao disponivel.",
      };
      if (event.error === "service-not-allowed") {
        state.speechRecognitionSupported = false;
      }
      state.isListening = false;
      state.recognition = null;
      render();

      if (canUseRecordedVoiceFallback() && !["not-allowed", "audio-capture"].includes(event.error)) {
        showToast("Voz nativa falhou. Vou usar a transcricao por OpenAI.", "info");
        await handleRecordedVoiceInput();
        return;
      }

      showToast(
        (event.error === "service-not-allowed"
          ? "O servico de voz do navegador falhou aqui. Use Chrome/Edge no computador ou configure Audio (OpenAI) para usar o microfone."
          : errors[event.error]) ||
          `Nao foi possivel usar o microfone pelo navegador (${event.error || "erro desconhecido"}). Configure Audio (OpenAI) para usar o fallback.`,
        "error",
      );
    };
    recognition.onend = () => {
      state.isListening = false;
      state.recognition = null;
      render();
    };

    state.recognition = recognition;
    state.isListening = true;
    try {
      recognition.start();
      render();
    } catch (error) {
      state.isListening = false;
      state.recognition = null;
      render();

      if (canUseRecordedVoiceFallback()) {
        showToast("Voz nativa indisponivel. Vou usar a transcricao por OpenAI.", "info");
        await handleRecordedVoiceInput();
        return;
      }

      showToast(buildUserErrorMessage(error, "Nao foi possivel iniciar o ditado por voz neste navegador."), "error");
    }
  }

  return {
    syncSpeechVoice,
    stopSpeaking,
    stopInput,
    speakMessage,
    toggleInput,
  };
}
