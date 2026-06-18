function getSpeechRecognitionCtor() {
  return globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition || null;
}

function getSpeechRecognitionCtorFromEnv(env) {
  return env?.SpeechRecognition || env?.webkitSpeechRecognition || null;
}

function isMobileUserAgent(userAgent = "") {
  return /android|iphone|ipad|ipod|mobile/i.test(userAgent);
}

function hasSupportedChromiumBrand(brands) {
  const normalizedBrands = Array.isArray(brands)
    ? brands.map((entry) => (entry?.brand || "").toLowerCase())
    : [];

  if (!normalizedBrands.length) {
    return null;
  }

  if (normalizedBrands.some((brand) => brand.includes("opera") || brand.includes("brave"))) {
    return false;
  }

  return normalizedBrands.some(
    (brand) =>
      brand.includes("google chrome") ||
      brand.includes("microsoft edge") ||
      brand.includes("chromium"),
  );
}

export function isNativeSpeechRecognitionBrowserSupported(env = globalThis) {
  const recognitionCtor = getSpeechRecognitionCtorFromEnv(env);
  if (!recognitionCtor) {
    return false;
  }

  if (env?.isSecureContext === false) {
    return false;
  }

  const navigatorLike = env?.navigator;
  if (!navigatorLike) {
    return true;
  }

  const brandSupport = hasSupportedChromiumBrand(navigatorLike.userAgentData?.brands);
  if (brandSupport !== null) {
    const platform = navigatorLike.userAgentData?.platform || navigatorLike.platform || "";
    if (/android|ios/i.test(platform)) {
      return false;
    }

    return brandSupport;
  }

  const userAgent = navigatorLike.userAgent || "";
  if (isMobileUserAgent(userAgent)) {
    return false;
  }

  const isEdge = /edg\//i.test(userAgent);
  const isChrome = /chrome\//i.test(userAgent) || /chromium\//i.test(userAgent);
  const isOpera = /opr\/|opera/i.test(userAgent);
  const isBrave = /brave/i.test(userAgent);

  return (isEdge || isChrome) && !isOpera && !isBrave;
}

export function isSpeechRecognitionSupported() {
  return isNativeSpeechRecognitionBrowserSupported(globalThis);
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
