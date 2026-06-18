function getSpeechRecognitionCtor() {
  return globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition || null;
}

export function isSpeechRecognitionSupported() {
  return Boolean(getSpeechRecognitionCtor());
}

export function createSpeechRecognition() {
  const SpeechRecognitionCtor = getSpeechRecognitionCtor();
  if (!SpeechRecognitionCtor) {
    throw new Error("Ditado por voz indisponivel neste navegador.");
  }

  const recognition = new SpeechRecognitionCtor();
  recognition.lang = "pt-BR";
  recognition.interimResults = true;
  recognition.continuous = false;
  return recognition;
}

export function getSpeechSynthesis() {
  return globalThis.speechSynthesis || null;
}

export function isMediaRecorderSupported() {
  return Boolean(
    globalThis.MediaRecorder &&
      globalThis.navigator?.mediaDevices?.getUserMedia,
  );
}

export async function getMicrophoneStream() {
  if (!isMediaRecorderSupported()) {
    throw new Error("Gravacao de audio indisponivel neste navegador.");
  }

  return navigator.mediaDevices.getUserMedia({ audio: true });
}

export function pickPortugueseVoice(voices) {
  const normalizedVoices = Array.isArray(voices) ? voices : [];

  return (
    normalizedVoices.find((voice) => voice.lang === "pt-BR") ||
    normalizedVoices.find((voice) => voice.lang?.toLowerCase().startsWith("pt")) ||
    normalizedVoices[0] ||
    null
  );
}
