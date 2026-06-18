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
      "Ditado nativo indisponivel neste navegador. Configure Audio (OpenAI) para usar o microfone por fallback.",
      "error",
    );
  }

  function pickBestVoice() {
    const synth = getSpeechSynthesis();
    if (!synth) return null;
    const voices = synth.getVoices();
    return (
      voices.find((v) => v.name.includes("Google português do Brasil")) ||
      voices.find((v) => v.lang === "pt-BR") ||
      voices.find((v) => v.lang?.toLowerCase().startsWith("pt")) ||
      voices[0] ||
      null
    );
  }

  async function speakMessage(messageId) {
    syncSpeechVoice();

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

    stopSpeaking();
    state.speakingMessageId = messageId;
    render();

    if (getSpeechSynthesis()) {
      const success = await speakNativeOptimized(message.content);
      if (!success && state.speakingMessageId !== null) {
        if (state.availableVoice) {
          showToast("Voz nativa falhou neste navegador. Usando fallback por OpenAI.", "info");
        }
        await speakOpenAiFallback(message.content);
      }
    } else {
      await speakOpenAiFallback(message.content);
    }

    state.speakingMessageId = null;
    render();
  }

  function isNavegadorCompativelComVozNativa() {
    if (!getSpeechSynthesis()) return false;
    if (state.availableVoice) return true;
    const synth = getSpeechSynthesis();
    try {
      const utterance = new SpeechSynthesisUtterance("teste");
      synth.speak(utterance);
      synth.cancel();
      return true;
    } catch {
      return false;
    }
  }

  function speakNativeOptimized(text) {
    return new Promise((resolve) => {
      const synth = getSpeechSynthesis();
      if (!synth || !text.trim()) {
        resolve(false);
        return;
      }

      const frases = text.match(/[^.!?]+[.!?]?/g) || [text];
      let index = 0;
      const voice = pickBestVoice();
      let started = false;

      function falarProximaFrase() {
        if (index >= frases.length) {
          resolve(true);
          return;
        }

        if (state.speakingMessageId === null) {
          resolve(false);
          return;
        }

        const utterance = new SpeechSynthesisUtterance(frases[index].trim());
        utterance.lang = voice?.lang || "pt-BR";
        if (voice) utterance.voice = voice;
        utterance.rate = 1.12;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;

        utterance.onstart = () => { started = true; };
        utterance.onend = () => {
          if (!started) {
            resolve(false);
            return;
          }
          index++;
          falarProximaFrase();
        };
        utterance.onerror = (e) => {
          if (e?.error === "canceled") {
            resolve(true);
          } else {
            resolve(false);
          }
        };

        try {
          synth.speak(utterance);
        } catch {
          resolve(false);
        }
      }

      falarProximaFrase();
    });
  }

  async function speakOpenAiFallback(text) {
    if (!getSettings().openAIKey) {
      showToast("Configure Audio (OpenAI) para leitura em voz alta neste navegador.", "error");
      return;
    }
    try {
      const audioBlob = await generateSpeechAudio({
        text,
        settings: getSettings(),
      });
      const url = URL.createObjectURL(audioBlob);
      const audio = new Audio(url);
      state.currentAudioUrl = url;
      state.currentAudio = audio;
      await new Promise((resolve, reject) => {
        audio.onended = resolve;
        audio.onerror = reject;
        audio.play().catch(reject);
      });
    } catch (error) {
      showToast(buildUserErrorMessage(error, "Nao foi possivel gerar a fala da resposta."), "error");
    }
  }

  async function startRecordedFallbackInput() {
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

  async function startNativeSpeechInput() {
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
      state.isListening = false;
      state.recognition = null;
      render();

      if (canUseRecordedVoiceFallback() && !["not-allowed", "audio-capture", "no-speech"].includes(event.error)) {
        showToast("Voz nativa falhou. Vou usar a transcricao por OpenAI.", "info");
        await startRecordedFallbackInput();
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
        await startRecordedFallbackInput();
        return;
      }

      showToast(buildUserErrorMessage(error, "Nao foi possivel iniciar o ditado por voz neste navegador."), "error");
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

    if (state.speechRecognitionSupported) {
      await startNativeSpeechInput();
      return;
    }

    if (canUseRecordedVoiceFallback()) {
      await startRecordedFallbackInput();
      return;
    }

    showUnsupportedVoiceInputMessage();
  }

  return {
    syncSpeechVoice,
    stopSpeaking,
    stopInput,
    speakMessage,
    toggleInput,
  };
}
