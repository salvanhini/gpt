const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const DUCKDUCKGO_URL = "https://api.duckduckgo.com/";
const TAVILY_URL = "https://api.tavily.com/search";
const BRAVE_URL = "https://api.search.brave.com/res/v1/web/search";
const WEB_SEARCH_CACHE_KEY = "femicgpt:web-search-cache";
const DEFAULT_TEXT_MODEL = "qwen/qwen3.7-plus";
const DEFAULT_TEXT_PROVIDER = "groq";
const DEFAULT_DEEPSEEK_MODEL = "deepseek-v4-flash";
const DEFAULT_GROQ_MODEL = "openai/gpt-oss-20b";
const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash";
const DEFAULT_IMAGE_PROVIDER = "pollinations";
const DEFAULT_IMAGE_MODEL_POLLINATIONS = "flux";
const DEFAULT_IMAGE_MODEL_FALAI = "fal-ai/flux/schnell";
const DEFAULT_OPENAI_TRANSCRIBE_MODEL = "gpt-4o-mini-transcribe";
const DEFAULT_OPENAI_TTS_MODEL = "gpt-4o-mini-tts";
const DEFAULT_OPENAI_TTS_VOICE = "coral";

// Configuracao do proxy backend (futuro)
const BACKEND_PROXY = {
  enabled: false,
  baseUrl: "",
};

// Resolve o endpoint e headers conforme o modo (direto vs proxy)
function resolveEndpoint(provider, settings, bodyObject) {
  if (BACKEND_PROXY.enabled) {
    return {
      url: `${BACKEND_PROXY.baseUrl.replace(/\/+$/, "")}/chat/completions`,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, ...bodyObject }),
    };
  }

  // Modo direto (padrao) — envia para a API do provedor com a chave
  const providerNames = {
    openrouter: "OpenRouter",
    deepseek: "DeepSeek",
    groq: "Groq",
    gemini: "Google Gemini",
  };
  const label = providerNames[provider] || "API";

  const endpointMap = {
    openrouter: { url: OPENROUTER_URL, key: settings.openRouterKey },
    deepseek: { url: DEEPSEEK_URL, key: settings.deepSeekKey },
    groq: { url: GROQ_URL, key: settings.groqKey },
    gemini: { url: GEMINI_URL, key: settings.geminiKey },
  };

  const endpoint = endpointMap[provider];
  if (!endpoint?.key) {
    throw new Error(`Adicione sua chave da ${label} nas configuracoes.`);
  }

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${endpoint.key}`,
  };

  if (provider === "openrouter") {
    headers["HTTP-Referer"] = globalThis.location?.href || "";
    headers["X-Title"] = "FEMIC GPT";
  }

  return {
    url: endpoint.url,
    headers,
    body: JSON.stringify(bodyObject),
  };
}

export const OPENROUTER_MODELS = [
  {
    value: "qwen/qwen3.7-plus",
    label: "Qwen 3.7 Plus",
    description: "Modelo Qwen equilibrado via OpenRouter.",
    badges: ["Rapido", "Equilibrado", "Texto", "Web"],
    helperText: "Melhor para produtividade, conversa geral e pesquisas com resposta equilibrada.",
  },
  {
    value: "deepseek/deepseek-v4-pro",
    label: "DeepSeek V4 Pro",
    description: "DeepSeek de alta qualidade via OpenRouter.",
    badges: ["Qualidade", "Analise", "Texto", "Web"],
    helperText: "Melhor para analises profundas e respostas mais densas.",
  },
  {
    value: "deepseek/deepseek-r1",
    label: "DeepSeek R1",
    description: "DeepSeek com raciocinio encadeado via OpenRouter.",
    badges: ["Raciocinio", "Thinking", "Texto", "Web"],
    helperText: "Melhor para problemas logicos, matematicos e cadeias de raciocinio.",
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

export const IMAGE_PROVIDER_OPTIONS = [
  { value: "pollinations", label: "Pollinations.ai (Gratis)" },
  { value: "fal-ai", label: "fal.ai (requer chave)" },
  { value: "pixazo", label: "Pixazo.ai (Flux Schnell)" },
];

const IMAGE_SIZE_DIMENSIONS = {
  landscape_4_3: { width: 1024, height: 768 },
  landscape_16_9: { width: 1280, height: 720 },
  landscape_3_2: { width: 1152, height: 768 },
  square_hd: { width: 1024, height: 1024 },
  square: { width: 1080, height: 1080 },
  portrait_4_3: { width: 768, height: 1024 },
  portrait_16_9: { width: 720, height: 1280 },
};

export const DEEPSEEK_MODELS = [
  {
    value: "deepseek-v4-flash",
    label: "DeepSeek V4 Flash",
    description: "Modelo rapido e barato da DeepSeek.",
    badges: ["Rapido", "Economico", "Texto"],
    helperText: "Melhor para respostas rapidas do dia a dia e conversas frequentes.",
  },
  {
    value: "deepseek-v4-pro",
    label: "DeepSeek V4 Pro",
    description: "Alta qualidade da DeepSeek para tarefas exigentes.",
    badges: ["Qualidade", "Analise", "Texto"],
    helperText: "Melhor para analises profundas, codigo complexo e tarefas que exigem raciocinio.",
  },
  {
    value: "deepseek-r1",
    label: "DeepSeek R1",
    description: "Modelo com raciocinio encadeado (thinking) da DeepSeek.",
    badges: ["Raciocinio", "Thinking", "Texto"],
    helperText: "Melhor para problemas logicos, matematicos e cadeias de raciocinio complexas.",
  },
];

export const GROQ_MODELS = [
  {
    value: "openai/gpt-oss-20b",
    label: "GPT OSS 20B",
    description: "Ultra rapido e leve para chat simples.",
    badges: ["Rapido", "Web", "Economico", "Texto"],
    helperText: "Melhor para perguntas rapidas, chat simples e tarefas do dia a dia.",
  },
  {
    value: "openai/gpt-oss-120b",
    label: "GPT OSS 120B",
    description: "Mais inteligente com busca web integrada.",
    badges: ["Qualidade", "Web", "Raciocinio", "Texto"],
    helperText: "Melhor para pesquisas, analises e tarefas que precisam de mais raciocinio.",
  },
  {
    value: "llama-3.1-8b-instant",
    label: "Llama 3.1 8B Instant",
    description: "Muito rapido e economico.",
    badges: ["Rapido", "Economico", "Texto"],
    helperText: "Melhor para tarefas simples e respostas instantaneas.",
  },
];

export const GEMINI_MODELS = [
  {
    value: "gemini-3.5-flash",
    label: "Gemini 3.5 Flash",
    description: "Modelo mais recente e rapido do Google.",
    badges: ["Rapido", "Multimodal", "Texto", "Web"],
    helperText: "Melhor para respostas rapidas, analise de imagens e tarefas gerais.",
  },
  {
    value: "gemini-2.5-flash",
    label: "Gemini 2.5 Flash",
    description: "Modelo rapido e versatile do Google.",
    badges: ["Rapido", "Multimodal", "Texto"],
    helperText: "Boa opcao para tarefas do dia a dia e analise de conteudo.",
  },
  {
    value: "gemini-1.5-flash",
    label: "Gemini 1.5 Flash",
    description: "Modelo anterior rapido do Google.",
    badges: ["Rapido", "Economico", "Multimodal", "Texto"],
    helperText: "Opcao economica para tarefas simples.",
  },
];

function findModelByProvider(provider, settings = {}) {
  if (provider === "deepseek") {
    return DEEPSEEK_MODELS.find((model) => model.value === settings.deepSeekModel) || null;
  }

  if (provider === "groq") {
    return GROQ_MODELS.find((model) => model.value === settings.groqModel) || null;
  }

  if (provider === "gemini") {
    return GEMINI_MODELS.find((model) => model.value === settings.geminiModel) || null;
  }

  return OPENROUTER_MODELS.find((model) => model.value === settings.textModel) || null;
}

const GROQ_BROWSER_SEARCH_MODELS = new Set([
  "openai/gpt-oss-20b",
  "openai/gpt-oss-120b",
]);

function buildOpenRouterSearchMessages(messages = []) {
  messages = messages || [];
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
    geminiKey: "",
    falKey: "",
    pixazoKey: "",
    imageProvider: DEFAULT_IMAGE_PROVIDER,
    openAIKey: "",
    textModel: DEFAULT_TEXT_MODEL,
    deepSeekModel: DEFAULT_DEEPSEEK_MODEL,
    groqModel: DEFAULT_GROQ_MODEL,
    geminiModel: DEFAULT_GEMINI_MODEL,
    imageModel: DEFAULT_IMAGE_MODEL_POLLINATIONS,
    imageSize: "landscape_4_3",
    globalSystemPrompt: "",
    openRouterEnabled: true,
    deepSeekEnabled: true,
    groqEnabled: true,
    geminiEnabled: true,
    openRouterSelectedModels: [],
    tavilyKey: "",
    braveSearchKey: "",
    usageLimits: {
      tavilyDailyLimit: 30,
      braveDailyLimit: 65,
      groqTranscriptionDailyLimit: 20,
      e2bDailyLimit: 5,
      maxHistoryMessages: 30,
      tokenWarningLimit: 12000,
    },
    emailJSMarcoServiceId: "",
    emailJSMarcoTemplateId: "",
    emailJSMarcoPublicKey: "",
    emailJSAlessandraServiceId: "",
    emailJSAlessandraTemplateId: "",
    emailJSAlessandraPublicKey: "",
    evolutionInstanceUrl: "",
    evolutionApiKey: "",
    evolutionInstanceName: "",
    openAITranscribeModel: DEFAULT_OPENAI_TRANSCRIBE_MODEL,
    openAITtsModel: DEFAULT_OPENAI_TTS_MODEL,
    openAITtsVoice: DEFAULT_OPENAI_TTS_VOICE,
  };
}

export async function fetchOpenRouterModels(apiKey) {
  if (!apiKey) {
    throw new Error("Chave da API OpenRouter necessaria.");
  }

  const response = await fetch("https://openrouter.ai/api/v1/models", {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!response.ok) {
    throw new Error("Falha ao buscar modelos da OpenRouter.");
  }

  const data = await response.json();
  return (data?.data || []).map((model) => ({
    id: model.id,
    name: model.name || model.id,
    contextLength: model.context_length || 0,
    pricing: model.pricing || {},
  }));
}

export function getTextProviderDisplayName(provider) {
  if (provider === "deepseek") {
    return "DeepSeek";
  }

  if (provider === "groq") {
    return "Groq";
  }

  if (provider === "gemini") {
    return "Google Gemini";
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

  if (provider === "gemini") {
    return Boolean(settings?.geminiKey);
  }

  return Boolean(settings?.openRouterKey);
}

export function getModelSelectionDetails(settings = {}) {
  settings = settings || {};
  const provider = settings.textProvider || DEFAULT_TEXT_PROVIDER;
  const model = findModelByProvider(provider, settings);

  return {
    provider,
    providerLabel: getTextProviderDisplayName(provider),
    value: model?.value || "",
    label: model?.label || "Modelo padrao",
    description: model?.description || "Modelo configurado para uso geral.",
    helperText: model?.helperText || "Modelo pronto para conversa geral.",
    badges: Array.isArray(model?.badges) ? model.badges : [],
  };
}

function getLatestUserQuery(messages = []) {
  messages = messages || [];
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
  messages = messages || [];
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
  settings = settings || {};
  const selectedModel = settings.groqModel || DEFAULT_GROQ_MODEL;
  if (!webSearchMode) {
    return selectedModel;
  }

  return GROQ_BROWSER_SEARCH_MODELS.has(selectedModel)
    ? selectedModel
    : DEFAULT_GROQ_MODEL;
}

export function buildGroqRequestBody(opts) {
  const { messages, settings, webSearchMode = false } = opts || {};
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

export function buildOpenRouterRequestBody(opts) {
  const { messages, settings, webSearchMode = false, thinkingEnabled = false } = opts || {};
  const body = {
    model: settings.textModel || DEFAULT_TEXT_MODEL,
    messages: webSearchMode ? buildOpenRouterSearchMessages(messages) : messages,
  };

  if (thinkingEnabled) {
    body.include_reasoning = true;
  }

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

// --- Web search cache ---

function readWebSearchCache() {
  try {
    return JSON.parse(localStorage.getItem(WEB_SEARCH_CACHE_KEY) || "{}") || {};
  } catch {
    return {};
  }
}

function writeWebSearchCache(cache) {
  try {
    localStorage.setItem(WEB_SEARCH_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Cache e apenas economia; falhas nao quebram o chat
  }
}

function getCachedWebSearch(query) {
  const cache = readWebSearchCache();
  const key = query.trim().toLowerCase().replace(/\s+/g, " ");
  return cache[key] || null;
}

function setCachedWebSearch(query, result) {
  const cache = readWebSearchCache();
  const key = query.trim().toLowerCase().replace(/\s+/g, " ");
  cache[key] = { ...result, fromCache: true };
  writeWebSearchCache(cache);
}

// --- Tavily ---

function buildTavilySearchBody(query, maxResults = 5) {
  return {
    query,
    search_depth: "basic",
    include_answer: false,
    include_raw_content: false,
    max_results: maxResults,
  };
}

function normalizeTavilyResults(data) {
  return (Array.isArray(data?.results) ? data.results : [])
    .filter((r) => r?.url && (r?.content || r?.title))
    .slice(0, 5)
    .map((r) => ({
      title: r.title || r.url,
      url: r.url,
      snippet: r.content || r.snippet || "",
      provider: "Tavily",
    }));
}

async function searchTavily(query, settings) {
  if (!settings?.tavilyKey) {
    throw new Error("Tavily sem chave configurada.");
  }

  let response;
  try {
    response = await fetch(TAVILY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${settings.tavilyKey}`,
      },
      body: JSON.stringify(buildTavilySearchBody(query)),
    });
  } catch {
    throw new Error("Nao foi possivel conectar a Tavily.");
  }

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(extractErrorMessage(data, "Falha ao consultar a Tavily."));
  }

  const results = normalizeTavilyResults(data);
  if (!results.length) {
    throw new Error("A Tavily nao retornou resultados suficientes.");
  }

  return {
    provider: "Tavily",
    citations: results,
    raw: data,
  };
}

// --- Brave ---

function buildBraveSearchUrl(query, count = 5) {
  const url = new URL(BRAVE_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("count", String(count));
  url.searchParams.set("safesearch", "moderate");
  url.searchParams.set("text_decorations", "false");
  return url.toString();
}

function normalizeBraveResults(data) {
  return (Array.isArray(data?.web?.results) ? data.web.results : [])
    .filter((r) => r?.url && (r?.description || r?.title))
    .slice(0, 5)
    .map((r) => ({
      title: r.title || r.url,
      url: r.url,
      snippet: r.description || (Array.isArray(r.extra_snippets) ? r.extra_snippets.join(" ") : ""),
      provider: "Brave",
    }));
}

async function searchBrave(query, settings) {
  if (!settings?.braveSearchKey) {
    throw new Error("Brave Search sem chave configurada.");
  }

  let response;
  try {
    response = await fetch(buildBraveSearchUrl(query), {
      headers: {
        Accept: "application/json",
        "X-Subscription-Token": settings.braveSearchKey,
      },
    });
  } catch {
    throw new Error("Nao foi possivel conectar ao Brave Search.");
  }

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(extractErrorMessage(data, "Falha ao consultar o Brave Search."));
  }

  const results = normalizeBraveResults(data);
  if (!results.length) {
    throw new Error("O Brave Search nao retornou resultados suficientes.");
  }

  return {
    provider: "Brave",
    citations: results,
    raw: data,
  };
}

// --- Coletor de fontes web (Tavily > Brave > DuckDuckGo) ---

function buildWebSearchContext(query, provider, citations) {
  const lines = [
    `Busca web para: ${query}`,
    `Provedor usado: ${provider}`,
    "",
    "Use as fontes abaixo para responder em portugues do Brasil e cite links relevantes:",
  ];

  citations.forEach((r, i) => {
    lines.push(`${i + 1}. ${r.title}`);
    lines.push(r.snippet);
    lines.push(r.url);
    lines.push("");
  });

  return lines.join("\n").trim();
}

async function collectWebSearchSources({ query, settings }) {
  if (!query?.trim()) {
    throw new Error("Digite uma pergunta valida para usar a Busca Web.");
  }

  const cached = getCachedWebSearch(query);
  if (cached) {
    return cached;
  }

  const errors = [];
  const providers = [
    ["tavily", () => searchTavily(query, settings)],
    ["brave", () => searchBrave(query, settings)],
    ["duckduckgo", () => searchDuckDuckGoFallback(query)],
  ];

  for (const [, search] of providers) {
    try {
      const result = await search();
      const normalizedResult = {
        content: buildWebSearchContext(query, result.provider, result.citations),
        provider: result.provider,
        sourceType: "web-search",
        webSearch: true,
        isFallback: result.isFallback || false,
        citations: result.citations,
        raw: result.raw,
      };
      setCachedWebSearch(query, normalizedResult);
      return normalizedResult;
    } catch (error) {
      errors.push(error);
    }
  }

  throw errors[errors.length - 1] || new Error("Nao foi possivel concluir a busca web.");
}

export async function runWebSearchQuery({ messages, settings }) {
  const query = getLatestUserQuery(messages);
  if (!query) {
    throw new Error("Digite uma pergunta valida para usar a Busca Web.");
  }

  if (settings.textProvider === "deepseek") {
    throw new Error("A Busca Web desta versao funciona com Groq ou OpenRouter. DeepSeek direto continua apenas no chat normal.");
  }

  if (settings.textProvider === "gemini") {
    throw new Error("A Busca Web desta versao funciona com Groq ou OpenRouter. Gemini continua apenas no chat normal.");
  }

  // Primeiro: Tavily > Brave > DuckDuckGo (provedores externos)
  try {
    const sources = await collectWebSearchSources({ query, settings });
    const reply = await sendTextMessage({
      messages: [
        ...messages,
        {
          role: "user",
          content: `Use a referencia abaixo para responder com base nas fontes consultadas:\n\n${sources.content}`,
        },
      ],
      settings,
      webSearchMode: false,
    });

    return {
      ...sources,
      content: `${reply.content}\n\nFontes consultadas:\n${sources.citations.map((item, index) => `${index + 1}. ${item.title}\n${item.url}`).join("\n")}`,
      answerProvider: getTextProviderDisplayName(settings.textProvider),
    };
  } catch (externalError) {
    // Fallback: busca web integrada do Groq/OpenRouter
    if (["groq", "openrouter"].includes(settings.textProvider)) {
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
      } catch (providerError) {
        throw providerError;
      }
    }
    throw externalError;
  }
}

async function chatFetch(url, headers, body) {
  const controller = new AbortController();
  const watchdog = setTimeout(() => controller.abort(), 30000);

  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers,
      body,
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(watchdog);
    if (err.name === "AbortError") throw new Error("A API demorou muito para responder. Tente novamente.");
    throw new Error("Sem conexao com a API. Verifique internet.");
  }

  clearTimeout(watchdog);

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    if (response.status === 429) throw new Error("Muitas requisicoes por minuto. Aguarde e tente novamente.");
    if (response.status === 401) throw new Error("Chave de API invalida. Verifique nas configuracoes.");
    throw new Error(extractErrorMessage(data, "Falha na API."));
  }

  return data;
}

export async function sendTextMessage({ messages, settings, webSearchMode = false, thinkingEnabled = false }) {
  // Cache: verifica resposta repetida antes de chamar a API
  const model = settings.textModel || settings.deepSeekModel || settings.groqModel || "";
  const chaveCache = !webSearchMode ? getChaveCache(messages, model) : null;
  if (chaveCache) {
    const cached = lerCache(chaveCache);
    if (cached) return { content: cached, fromCache: true };
  }

  let resultado;

  if (settings.textProvider === "deepseek") {
    if (webSearchMode) {
      throw new Error("A Busca Web desta versao funciona com Groq ou OpenRouter. DeepSeek direto continua apenas no chat normal.");
    }
    resultado = await sendDeepSeekMessage({ messages, settings, thinkingEnabled });
  } else if (settings.textProvider === "groq") {
    resultado = await sendGroqMessage({ messages, settings, webSearchMode });
  } else if (settings.textProvider === "gemini") {
    if (webSearchMode) {
      throw new Error("A Busca Web desta versao funciona com Groq ou OpenRouter. Gemini continua apenas no chat normal.");
    }
    resultado = await sendGeminiMessage({ messages, settings });
  } else {
    const bodyObj = buildOpenRouterRequestBody({ messages, settings, webSearchMode, thinkingEnabled });
    const endpoint = resolveEndpoint("openrouter", settings, bodyObj);
    const data = await chatFetch(endpoint.url, endpoint.headers, endpoint.body);

    const content = normalizeAssistantContent(data?.choices?.[0]?.message?.content);
    if (!content) {
      throw new Error("A resposta da OpenRouter veio vazia.");
    }

    const usage = data?.usage;
    const cachedTokens = usage?.prompt_tokens_details?.cached_tokens || 0;
    resultado = {
      content,
      raw: data,
      cachedTokens,
      promptTokens: usage?.prompt_tokens || 0,
      completionTokens: usage?.completion_tokens || 0,
    };
  }

  if (chaveCache) salvarCache(chaveCache, resultado.content);
  return resultado;
}

async function sendDeepSeekMessage({ messages, settings, thinkingEnabled = false }) {
  const bodyObj = {
    model: settings.deepSeekModel || DEFAULT_DEEPSEEK_MODEL,
    messages,
    stream: false,
  };

  if (thinkingEnabled && settings.deepSeekModel === "deepseek-r1") {
    bodyObj.thinking = { type: "enabled", budget_tokens: 4096 };
  }

  const endpoint = resolveEndpoint("deepseek", settings, bodyObj);
  const data = await chatFetch(endpoint.url, endpoint.headers, endpoint.body);

  const content = normalizeAssistantContent(data?.choices?.[0]?.message?.content);
  if (!content) {
    throw new Error("A resposta da DeepSeek veio vazia.");
  }

  const usage = data?.usage;
  const cachedTokens = usage?.prompt_cache_hit_tokens || 0;

  return {
    content,
    raw: data,
    cachedTokens,
    promptTokens: usage?.prompt_tokens || 0,
    completionTokens: usage?.completion_tokens || 0,
  };
}

async function sendGroqMessage({ messages, settings, webSearchMode = false }) {
  const bodyObj = buildGroqRequestBody({ messages, settings, webSearchMode });
  const endpoint = resolveEndpoint("groq", settings, bodyObj);
  const data = await chatFetch(endpoint.url, endpoint.headers, endpoint.body);

  const content = normalizeAssistantContent(data?.choices?.[0]?.message?.content);
  if (!content) {
    throw new Error("A resposta da Groq veio vazia.");
  }

  const usage = data?.usage;
  const cachedTokens = usage?.prompt_tokens_details?.cached_tokens || 0;

  return {
    content,
    raw: data,
    cachedTokens,
    promptTokens: usage?.prompt_tokens || 0,
    completionTokens: usage?.completion_tokens || 0,
  };
}

async function sendGeminiMessage({ messages, settings }) {
  const model = settings.geminiModel || DEFAULT_GEMINI_MODEL;
  const apiKey = settings.geminiKey;

  const contents = messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content || "" }],
    }));

  const systemInstruction = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");

  const bodyObj = {
    contents,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 8192,
    },
  };

  if (systemInstruction) {
    bodyObj.systemInstruction = { parts: [{ text: systemInstruction }] };
  }

  const url = `${GEMINI_URL}/${model}:generateContent?key=${apiKey}`;

  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bodyObj),
    });
  } catch {
    throw new Error("Sem conexao com a API do Google Gemini.");
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    if (response.status === 429) throw new Error("Muitas requisicoes por minuto. Aguarde e tente novamente.");
    if (response.status === 401) throw new Error("Chave de API do Gemini invalida. Verifique nas configuracoes.");
    throw new Error(data?.error?.message || "Falha na API do Google Gemini.");
  }

  const content = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  if (!content) {
    throw new Error("A resposta do Gemini veio vazia.");
  }

  const usage = data?.usageMetadata || {};

  return {
    content,
    raw: data,
    cachedTokens: 0,
    promptTokens: usage.promptTokenCount || 0,
    completionTokens: usage.candidatesTokenCount || 0,
  };
}

// --- Cache local de respostas (expira em 24h) ---

const CHAT_CACHE_KEY = "femicgpt:chat-cache";
const CHAT_CACHE_TTL = 24 * 60 * 60 * 1000;

function calcularHash(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

function getChaveCache(mensagens, modelo) {
  const ultima = [...mensagens].reverse().find((m) => m?.role === "user");
  if (!ultima?.content) return null;
  const texto = typeof ultima.content === "string" ? ultima.content.trim() : "";
  if (!texto) return null;
  return `chat::${modelo}::${calcularHash(texto.toLowerCase())}`;
}

function lerCache(resposta) {
  try {
    const dados = JSON.parse(localStorage.getItem(CHAT_CACHE_KEY) || "{}");
    const entrada = dados[resposta];
    if (entrada && Date.now() - entrada.ts < CHAT_CACHE_TTL) {
      return entrada.conteudo;
    }
    if (entrada) delete dados[resposta];
  } catch { /* ignorar */ }
  return null;
}

function salvarCache(chave, conteudo) {
  try {
    const dados = JSON.parse(localStorage.getItem(CHAT_CACHE_KEY) || "{}");
    dados[chave] = { conteudo, ts: Date.now() };
    localStorage.setItem(CHAT_CACHE_KEY, JSON.stringify(dados));
  } catch { /* cache nao deve quebrar o chat */ }
}

export async function generateImage({ prompt, settings }) {
  const provider = settings.imageProvider || DEFAULT_IMAGE_PROVIDER;

  if (provider === "fal-ai") {
    return generateImageFalAI({ prompt, settings });
  }

  if (provider === "pixazo") {
    return generateImagePixazo({ prompt, settings });
  }

  return generateImagePollinations({ prompt, settings });
}

async function generateImagePollinations({ prompt, settings }) {
  const model = settings.imageModel || DEFAULT_IMAGE_MODEL_POLLINATIONS;
  const sizeKey = settings.imageSize || "square";
  const dims = IMAGE_SIZE_DIMENSIONS[sizeKey] || IMAGE_SIZE_DIMENSIONS.square;
  const encodedPrompt = encodeURIComponent(prompt);
  const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${dims.width}&height=${dims.height}&nologo=true&model=${model}`;

  let response;
  try {
    response = await fetch(url);
  } catch {
    throw new Error("Nao foi possivel conectar ao Pollinations.ai. Verifique sua conexao com a internet.");
  }

  if (!response.ok) {
    throw new Error("Pollinations.ai falhou ao gerar a imagem. Tente novamente.");
  }

  const blob = await response.blob();
  if (!blob || blob.size < 1000) {
    throw new Error("O Pollinations.ai retornou uma imagem invalida.");
  }

  const imageUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

  return {
    url: imageUrl,
    prompt,
    raw: { provider: "pollinations", model, width: dims.width, height: dims.height },
  };
}

async function generateImageFalAI({ prompt, settings }) {
  if (!settings.falKey) {
    throw new Error("Adicione sua chave da fal.ai nas configuracoes.");
  }

  const sizeKey = settings.imageSize || "square";
  const dims = IMAGE_SIZE_DIMENSIONS[sizeKey] || IMAGE_SIZE_DIMENSIONS.square;

  let response;
  try {
    response = await fetch("https://fal.run/fal-ai/flux/schnell", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Key ${settings.falKey}`,
      },
      body: JSON.stringify({
        prompt,
        image_size: sizeKey,
        num_images: 1,
        num_inference_steps: 4,
        enable_safety_checker: false,
      }),
    });
  } catch {
    throw new Error("Nao foi possivel conectar a fal.ai. Verifique internet e chave.");
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(extractErrorMessage(data, "Falha ao gerar imagem na fal.ai."));
  }

  const imageUrl = data?.images?.[0]?.url || data?.image?.url;

  if (!imageUrl || typeof imageUrl !== "string") {
    throw new Error("A fal.ai nao retornou uma imagem valida.");
  }

  return {
    url: imageUrl,
    prompt,
    raw: data,
  };
}

async function generateImagePixazo({ prompt, settings }) {
  if (!settings.pixazoKey) {
    throw new Error("Adicione sua chave da Pixazo.ai nas configuracoes.");
  }

  const sizeKey = settings.imageSize || "square";
  const dims = IMAGE_SIZE_DIMENSIONS[sizeKey] || IMAGE_SIZE_DIMENSIONS.square;

  let response;
  try {
    response = await fetch("https://gateway.pixazo.ai/flux-1-schnell/v1/getData", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        "Ocp-Apim-Subscription-Key": settings.pixazoKey,
      },
      body: JSON.stringify({
        prompt,
        num_steps: 4,
        height: dims.height,
        width: dims.width,
      }),
    });
  } catch {
    throw new Error("Nao foi possivel conectar a Pixazo.ai. Verifique internet e chave.");
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(extractErrorMessage(data, "Falha ao gerar imagem na Pixazo.ai."));
  }

  const imageUrl = data?.output;

  if (!imageUrl || typeof imageUrl !== "string") {
    throw new Error("A Pixazo.ai nao retornou uma imagem valida.");
  }

  return {
    url: imageUrl,
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
