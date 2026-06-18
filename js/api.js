const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const DEFAULT_TEXT_MODEL = "qwen/qwen3.7-plus";
const DEFAULT_TEXT_PROVIDER = "openrouter";
const DEFAULT_DEEPSEEK_MODEL = "deepseek-v4-flash";
const DEFAULT_IMAGE_MODEL = "fal-ai/flux/schnell";
const DEFAULT_OPENAI_TRANSCRIBE_MODEL = "gpt-4o-mini-transcribe";
const DEFAULT_OPENAI_TTS_MODEL = "gpt-4o-mini-tts";
const DEFAULT_OPENAI_TTS_VOICE = "coral";

export const OPENROUTER_MODELS = [
  {
    value: "qwen/qwen3.7-plus",
    label: "Qwen 3.7 Plus",
    description: "Modelo Qwen recente via OpenRouter para uso geral e produtividade.",
  },
  {
    value: "deepseek/deepseek-v4-pro",
    label: "DeepSeek V4 Pro",
    description: "DeepSeek recente via OpenRouter, com foco em qualidade de resposta.",
  },
];

export const IMAGE_SIZE_OPTIONS = [
  { value: "landscape_4_3", label: "Paisagem 4:3" },
  { value: "landscape_16_9", label: "Paisagem 16:9" },
  { value: "landscape_3_2", label: "Paisagem 3:2" },
  { value: "square_hd", label: "Quadrado HD" },
  { value: "square", label: "Quadrado" },
  { value: "portrait_4_3", label: "Retrato 4:3" },
  { value: "portrait_16_9", label: "Retrato 16:9" },
];

export const DEEPSEEK_MODELS = [
  {
    value: "deepseek-v4-flash",
    label: "DeepSeek V4 Flash",
    description: "Modelo direto da DeepSeek para respostas rápidas.",
  },
  {
    value: "deepseek-v4-pro",
    label: "DeepSeek V4 Pro",
    description: "Modelo direto da DeepSeek com mais capacidade.",
  },
  {
    value: "deepseek-chat",
    label: "DeepSeek Chat",
    description: "Modelo legado compatível, mantido por conveniência.",
  },
  {
    value: "deepseek-reasoner",
    label: "DeepSeek Reasoner",
    description: "Modelo legado de raciocínio, quando disponível na conta.",
  },
];

function extractErrorMessage(data, fallback) {
  if (!data) {
    return fallback;
  }

  if (typeof data === "string") {
    return data;
  }

  return (
    data?.error?.message ||
    data?.message ||
    data?.detail ||
    data?.reason ||
    fallback
  );
}

export function getDefaultSettings() {
  return {
    textProvider: DEFAULT_TEXT_PROVIDER,
    openRouterKey: "",
    deepSeekKey: "",
    falKey: "",
    openAIKey: "",
    textModel: DEFAULT_TEXT_MODEL,
    deepSeekModel: DEFAULT_DEEPSEEK_MODEL,
    imageModel: DEFAULT_IMAGE_MODEL,
    imageSize: "landscape_4_3",
    openAITranscribeModel: DEFAULT_OPENAI_TRANSCRIBE_MODEL,
    openAITtsModel: DEFAULT_OPENAI_TTS_MODEL,
    openAITtsVoice: DEFAULT_OPENAI_TTS_VOICE,
  };
}

export async function sendTextMessage({ messages, settings }) {
  if (settings.textProvider === "deepseek") {
    return sendDeepSeekMessage({ messages, settings });
  }

  if (!settings.openRouterKey) {
    throw new Error("Adicione sua chave da OpenRouter nas configurações.");
  }

  let response;
  try {
    response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${settings.openRouterKey}`,
        "HTTP-Referer": window.location.href,
        "X-Title": "FEMIC GPT",
      },
      body: JSON.stringify({
        model: settings.textModel || DEFAULT_TEXT_MODEL,
        messages,
      }),
    });
  } catch {
    throw new Error("Não foi possível conectar à OpenRouter. Verifique internet, chave e o modelo selecionado.");
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      extractErrorMessage(data, "Falha ao consultar a OpenRouter."),
    );
  }

  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("A resposta da OpenRouter veio vazia.");
  }

  return {
    content,
    raw: data,
  };
}

async function sendDeepSeekMessage({ messages, settings }) {
  if (!settings.deepSeekKey) {
    throw new Error("Adicione sua chave da DeepSeek nas configurações.");
  }

  let response;
  try {
    response = await fetch(DEEPSEEK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${settings.deepSeekKey}`,
      },
      body: JSON.stringify({
        model: settings.deepSeekModel || DEFAULT_DEEPSEEK_MODEL,
        messages,
        stream: false,
      }),
    });
  } catch {
    throw new Error("Não foi possível conectar à DeepSeek. Verifique internet, chave e modelo selecionado.");
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(extractErrorMessage(data, "Falha ao consultar a DeepSeek."));
  }

  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("A resposta da DeepSeek veio vazia.");
  }

  return {
    content,
    raw: data,
  };
}

export async function generateImage({ prompt, settings }) {
  if (!settings.falKey) {
    throw new Error("Adicione sua chave da fal.ai nas configurações.");
  }

  const model = settings.imageModel || DEFAULT_IMAGE_MODEL;
  let response;
  try {
    response = await fetch(`https://fal.run/${model}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Key ${settings.falKey}`,
      },
      body: JSON.stringify({
        prompt,
        image_size: settings.imageSize || "landscape_4_3",
        num_images: 1,
      }),
    });
  } catch {
    throw new Error("Não foi possível conectar à fal.ai. Verifique internet, chave e modelo de imagem.");
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(extractErrorMessage(data, "Falha ao gerar imagem na fal.ai."));
  }

  const images = data?.images || data?.data?.images || [];
  const image = images[0];
  const url = image?.url || image?.image?.url;

  if (!url) {
    throw new Error("A fal.ai não retornou uma imagem válida.");
  }

  return {
    url,
    prompt,
    raw: data,
  };
}

export async function transcribeAudio({ audioBlob, settings }) {
  if (!settings.openAIKey) {
    throw new Error("Adicione sua chave da OpenAI nas configurações de áudio.");
  }

  const file = new File([audioBlob], "femic-gpt-voice.webm", {
    type: audioBlob.type || "audio/webm",
  });
  const form = new FormData();
  form.append("file", file);
  form.append("model", settings.openAITranscribeModel || DEFAULT_OPENAI_TRANSCRIBE_MODEL);
  form.append("language", "pt");
  form.append("response_format", "json");

  let response;
  try {
    response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${settings.openAIKey}`,
      },
      body: form,
    });
  } catch {
    throw new Error("Não foi possível conectar à OpenAI para transcrever o áudio.");
  }

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(extractErrorMessage(data, "Falha ao transcrever o áudio."));
  }

  const text = data?.text?.trim();
  if (!text) {
    throw new Error("A transcrição veio vazia. Tente falar novamente.");
  }

  return text;
}

export async function generateSpeechAudio({ text, settings }) {
  if (!settings.openAIKey) {
    throw new Error("Adicione sua chave da OpenAI nas configurações de áudio.");
  }

  let response;
  try {
    response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${settings.openAIKey}`,
      },
      body: JSON.stringify({
        model: settings.openAITtsModel || DEFAULT_OPENAI_TTS_MODEL,
        voice: settings.openAITtsVoice || DEFAULT_OPENAI_TTS_VOICE,
        input: text.slice(0, 4096),
        instructions: "Fale em português do Brasil, com voz clara, natural e calma.",
        response_format: "mp3",
      }),
    });
  } catch {
    throw new Error("Não foi possível conectar à OpenAI para gerar a fala.");
  }

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(extractErrorMessage(data, "Falha ao gerar áudio da resposta."));
  }

  return response.blob();
}
