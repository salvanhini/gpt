const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const DUCKDUCKGO_URL = "https://api.duckduckgo.com/";
const DEFAULT_TEXT_MODEL = "qwen/qwen3.7-plus";
const DEFAULT_TEXT_PROVIDER = "openrouter";
const DEFAULT_DEEPSEEK_MODEL = "deepseek-v4-flash";
const DEFAULT_GROQ_MODEL = "openai/gpt-oss-20b";
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

export const GROQ_MODELS = [
  {
    value: "openai/gpt-oss-20b",
    label: "GPT OSS 20B",
    description: "Modelo leve e rapido da Groq, compativel com browser search.",
  },
  {
    value: "openai/gpt-oss-120b",
    label: "GPT OSS 120B",
    description: "Modelo Groq mais forte para raciocinio e web search com mais profundidade.",
  },
  {
    value: "llama-3.1-8b-instant",
    label: "Llama 3.1 8B Instant",
    description: "Opcao muito rapida e economica para chat geral na Groq.",
  },
];

const GROQ_BROWSER_SEARCH_MODELS = new Set([
  "openai/gpt-oss-20b",
  "openai/gpt-oss-120b",
]);

function buildOpenRouterSearchMessages(messages = []) {
  const searchInstruction = {
    role: "system",
    content:
      "Quando a busca web estiver ativa, use informacoes atuais da internet, responda em portugues do Brasil e cite as fontes com links no final quando relevante.",
  };

  if (messages.some((message) => message.role === "system")) {
    return messages.map((message, index) => {
      if (index !== 0 || message.role !== "system") {
        return message;
      }

      return {
        ...message,
        content: `${searchInstruction.content}\n\n${message.content}`,
      };
    });
  }

  return [searchInstruction, ...messages];
}

function flattenDuckDuckGoTopics(topics = []) {
  return topics.flatMap((topic) => {
    if (Array.isArray(topic?.Topics)) {
      return flattenDuckDuckGoTopics(topic.Topics);
    }

    return topic ? [topic] : [];
  });
}

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
    groqKey: "",
    falKey: "",
    openAIKey: "",
    textModel: DEFAULT_TEXT_MODEL,
    deepSeekModel: DEFAULT_DEEPSEEK_MODEL,
    groqModel: DEFAULT_GROQ_MODEL,
    imageModel: DEFAULT_IMAGE_MODEL,
    imageSize: "landscape_4_3",
    openAITranscribeModel: DEFAULT_OPENAI_TRANSCRIBE_MODEL,
    openAITtsModel: DEFAULT_OPENAI_TTS_MODEL,
    openAITtsVoice: DEFAULT_OPENAI_TTS_VOICE,
  };
}

export function getTextProviderDisplayName(provider) {
  if (provider === "deepseek") {
    return "DeepSeek";
  }

  if (provider === "groq") {
    return "Groq";
  }

  return "OpenRouter";
}

export function hasTextProviderKey(settings, provider = settings?.textProvider) {
  if (provider === "deepseek") {
    return Boolean(settings?.deepSeekKey);
  }

  if (provider === "groq") {
    return Boolean(settings?.groqKey);
  }

  return Boolean(settings?.openRouterKey);
}

function getLatestUserQuery(messages = []) {
  const latestUserMessage = [...messages].reverse().find((message) => message?.role === "user");
  return String(latestUserMessage?.content || "").trim();
}

function normalizeAssistantContent(content) {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => item?.text || item?.content || "")
      .filter(Boolean)
      .join("\n\n");
  }

  return "";
}

function buildGroqSearchMessages(messages = []) {
  const searchInstruction = {
    role: "system",
    content:
      "Quando a busca web estiver ativa, consulte a internet para responder com informacoes atuais, organize uma sintese clara em portugues do Brasil e cite as fontes relevantes com links no final.",
  };

  if (messages.some((message) => message.role === "system")) {
    return messages.map((message, index) => {
      if (index !== 0 || message.role !== "system") {
        return message;
      }

      return {
        ...message,
        content: `${searchInstruction.content}\n\n${message.content}`,
      };
    });
  }

  return [searchInstruction, ...messages];
}

function getGroqModelForRequest(settings, webSearchMode = false) {
  const selectedModel = settings.groqModel || DEFAULT_GROQ_MODEL;
  if (!webSearchMode) {
    return selectedModel;
  }

  return GROQ_BROWSER_SEARCH_MODELS.has(selectedModel)
    ? selectedModel
    : DEFAULT_GROQ_MODEL;
}

export function buildGroqRequestBody({ messages, settings, webSearchMode = false }) {
  const body = {
    model: getGroqModelForRequest(settings, webSearchMode),
    messages: webSearchMode ? buildGroqSearchMessages(messages) : messages,
    stream: false,
  };

  if (webSearchMode) {
    body.tool_choice = "required";
    body.tools = [{ type: "browser_search" }];
  }

  return body;
}

export function buildOpenRouterRequestBody({ messages, settings, webSearchMode = false }) {
  const body = {
    model: settings.textModel || DEFAULT_TEXT_MODEL,
    messages: webSearchMode ? buildOpenRouterSearchMessages(messages) : messages,
  };

  if (webSearchMode) {
    body.tools = [
      {
        type: "openrouter:web_search",
        parameters: {
          max_results: 5,
          search_context_size: "medium",
        },
      },
    ];
  }

  return body;
}

export function buildDuckDuckGoSearchUrl(query) {
  const url = new URL(DUCKDUCKGO_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("no_html", "1");
  url.searchParams.set("no_redirect", "1");
  url.searchParams.set("skip_disambig", "1");
  return url.toString();
}

export function normalizeDuckDuckGoResults(data = {}) {
  const results = [];

  if (data?.AbstractText && data?.AbstractURL) {
    results.push({
      title: data?.Heading || "Resposta direta",
      url: data.AbstractURL,
      snippet: data.AbstractText,
    });
  }

  const topics = flattenDuckDuckGoTopics(data?.RelatedTopics || [])
    .filter((topic) => topic?.Text && topic?.FirstURL)
    .slice(0, 5)
    .map((topic) => ({
      title: topic.Text.split(" - ")[0] || "Resultado relacionado",
      url: topic.FirstURL,
      snippet: topic.Text,
    }));

  return [...results, ...topics];
}

function buildDuckDuckGoSummary(query, results = []) {
  const lines = [
    `Busca leve DuckDuckGo para: ${query}`,
    "",
    "Encontrei estas referencias iniciais:",
  ];

  results.forEach((result, index) => {
    lines.push(`${index + 1}. ${result.title}`);
    lines.push(`${result.snippet}`);
    lines.push(result.url);
    lines.push("");
  });

  return lines.join("\n").trim();
}

export async function searchDuckDuckGoFallback(query) {
  if (!query.trim()) {
    throw new Error("Nao foi possivel montar a busca leve sem uma pergunta valida.");
  }

  let response;
  try {
    response = await fetch(buildDuckDuckGoSearchUrl(query));
  } catch {
    throw new Error("Nao foi possivel conectar ao fallback DuckDuckGo.");
  }

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(extractErrorMessage(data, "Falha ao consultar o fallback DuckDuckGo."));
  }

  const results = normalizeDuckDuckGoResults(data);
  if (!results.length) {
    throw new Error("O fallback DuckDuckGo nao encontrou resultados suficientes para essa busca.");
  }

  return {
    content: buildDuckDuckGoSummary(query, results),
    provider: "DuckDuckGo",
    sourceType: "web-search",
    webSearch: true,
    isFallback: true,
    citations: results,
    raw: data,
  };
}

export async function runWebSearchQuery({ messages, settings }) {
  const query = getLatestUserQuery(messages);
  if (!query) {
    throw new Error("Digite uma pergunta valida para usar a Busca Web.");
  }

  if (settings.textProvider === "deepseek") {
    throw new Error("A Busca Web desta versao funciona com Groq ou OpenRouter. DeepSeek direto continua apenas no chat normal.");
  }

  try {
    const reply = await sendTextMessage({
      messages,
      settings,
      webSearchMode: true,
    });

    return {
      content: reply.content,
      provider: getTextProviderDisplayName(settings.textProvider),
      sourceType: "web-search",
      webSearch: true,
      isFallback: false,
      citations: [],
      raw: reply.raw,
    };
  } catch (error) {
    if (!["groq", "openrouter"].includes(settings.textProvider)) {
      throw error;
    }

    const fallback = await searchDuckDuckGoFallback(query);
    return {
      ...fallback,
      error,
    };
  }
}

export async function sendTextMessage({ messages, settings, webSearchMode = false }) {
  if (settings.textProvider === "deepseek") {
    if (webSearchMode) {
      throw new Error("A Busca Web desta versao funciona com Groq ou OpenRouter. DeepSeek direto continua apenas no chat normal.");
    }
    return sendDeepSeekMessage({ messages, settings });
  }

  if (settings.textProvider === "groq") {
    return sendGroqMessage({ messages, settings, webSearchMode });
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
      body: JSON.stringify(buildOpenRouterRequestBody({ messages, settings, webSearchMode })),
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

  const content = normalizeAssistantContent(data?.choices?.[0]?.message?.content);
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

  const content = normalizeAssistantContent(data?.choices?.[0]?.message?.content);
  if (!content) {
    throw new Error("A resposta da DeepSeek veio vazia.");
  }

  return {
    content,
    raw: data,
  };
}

async function sendGroqMessage({ messages, settings, webSearchMode = false }) {
  if (!settings.groqKey) {
    throw new Error("Adicione sua chave da Groq nas configuracoes.");
  }

  let response;
  try {
    response = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${settings.groqKey}`,
      },
      body: JSON.stringify(buildGroqRequestBody({ messages, settings, webSearchMode })),
    });
  } catch {
    throw new Error("Nao foi possivel conectar a Groq. Verifique internet, chave e modelo selecionado.");
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(extractErrorMessage(data, "Falha ao consultar a Groq."));
  }

  const content = normalizeAssistantContent(data?.choices?.[0]?.message?.content);
  if (!content) {
    throw new Error("A resposta da Groq veio vazia.");
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
