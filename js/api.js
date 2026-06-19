const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const DUCKDUCKGO_URL = "https://api.duckduckgo.com/";
const TAVILY_URL = "https://api.tavily.com/search";
const BRAVE_URL = "https://api.search.brave.com/res/v1/web/search";
const WEB_SEARCH_CACHE_KEY = "femicgpt:web-search-cache";
const DEFAULT_TEXT_MODEL = "qwen/qwen3.7-plus";
const DEFAULT_TEXT_PROVIDER = "openrouter";
const DEFAULT_DEEPSEEK_MODEL = "deepseek-v4-flash";
const DEFAULT_GROQ_MODEL = "openai/gpt-oss-20b";
const DEFAULT_IMAGE_MODEL = "fal-ai/flux/schnell";
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
  };
  const label = providerNames[provider] || "API";

  const endpointMap = {
    openrouter: { url: OPENROUTER_URL, key: settings.openRouterKey },
    deepseek: { url: DEEPSEEK_URL, key: settings.deepSeekKey },
    groq: { url: GROQ_URL, key: settings.groqKey },
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
    description: "Modelo Qwen recente via OpenRouter para uso geral e produtividade.",
    badges: ["Rapido", "Equilibrado", "Texto", "Web"],
    helperText: "Boa escolha para produtividade, conversa geral e pesquisas com resposta bem equilibrada.",
  },
  {
    value: "deepseek/deepseek-v4-pro",
    label: "DeepSeek V4 Pro",
    description: "DeepSeek recente via OpenRouter, com foco em qualidade de resposta.",
    badges: ["Qualidade", "Analise", "Texto", "Web"],
    helperText: "Melhor quando voce quer respostas mais densas, analise e acabamento acima de velocidade.",
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
    badges: ["Rapido", "Economico", "Texto"],
    helperText: "Ideal para conversas frequentes e respostas rapidas com custo mais leve.",
  },
  {
    value: "deepseek-v4-pro",
    label: "DeepSeek V4 Pro",
    description: "Modelo direto da DeepSeek com mais capacidade.",
    badges: ["Qualidade", "Analise", "Texto"],
    helperText: "Use quando quiser mais profundidade e consistencia em tarefas mais exigentes.",
  },
  {
    value: "deepseek-chat",
    label: "DeepSeek Chat",
    description: "Modelo legado compatível, mantido por conveniência.",
    badges: ["Legado", "Texto"],
    helperText: "Opcao mantida por compatibilidade para quem ja usa esse fluxo.",
  },
  {
    value: "deepseek-reasoner",
    label: "DeepSeek Reasoner",
    description: "Modelo legado de raciocínio, quando disponível na conta.",
    badges: ["Raciocinio", "Legado", "Texto"],
    helperText: "Serve para cadeias de raciocinio quando esse modelo ainda estiver habilitado na conta.",
  },
];

export const GROQ_MODELS = [
  {
    value: "openai/gpt-oss-20b",
    label: "GPT OSS 20B",
    description: "Modelo leve e rapido da Groq, compativel com browser search.",
    badges: ["Rapido", "Web", "Economico", "Texto"],
    helperText: "Melhor para velocidade e busca web com resposta curta ou media.",
  },
  {
    value: "openai/gpt-oss-120b",
    label: "GPT OSS 120B",
    description: "Modelo Groq mais forte para raciocinio e web search com mais profundidade.",
    badges: ["Qualidade", "Web", "Raciocinio", "Texto"],
    helperText: "Escolha quando quiser busca web com mais contexto e respostas mais robustas.",
  },
  {
    value: "llama-3.1-8b-instant",
    label: "Llama 3.1 8B Instant",
    description: "Opcao muito rapida e economica para chat geral na Groq.",
    badges: ["Rapido", "Economico", "Texto"],
    helperText: "Bom para respostas instantaneas e tarefas simples do dia a dia.",
  },
];

function findModelByProvider(provider, settings = {}) {
  if (provider === "deepseek") {
    return DEEPSEEK_MODELS.find((model) => model.value === settings.deepSeekModel) || null;
  }

  if (provider === "groq") {
    return GROQ_MODELS.find((model) => model.value === settings.groqModel) || null;
  }

  return OPENROUTER_MODELS.find((model) => model.value === settings.textModel) || null;
}

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
    globalSystemPrompt: "",
    tavilyKey: "",
    braveSearchKey: "",
    usageLimits: {
      tavilyDailyLimit: 30,
      braveDailyLimit: 65,
      groqTranscriptionDailyLimit: 20,
      e2bDailyLimit: 5,
      maxHistoryMessages: 12,
      tokenWarningLimit: 12000,
    },
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

export function getModelSelectionDetails(settings = {}) {
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

export async function collectWebSearchSources({ query, settings }) {
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

    // Fallback: Tavily > Brave > DuckDuckGo com cache
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

export async function sendTextMessage({ messages, settings, webSearchMode = false }) {
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
    resultado = await sendDeepSeekMessage({ messages, settings });
  } else if (settings.textProvider === "groq") {
    resultado = await sendGroqMessage({ messages, settings, webSearchMode });
  } else {
    const bodyObj = buildOpenRouterRequestBody({ messages, settings, webSearchMode });
    const endpoint = resolveEndpoint("openrouter", settings, bodyObj);
    const data = await chatFetch(endpoint.url, endpoint.headers, endpoint.body);

    const content = normalizeAssistantContent(data?.choices?.[0]?.message?.content);
    if (!content) {
      throw new Error("A resposta da OpenRouter veio vazia.");
    }

    resultado = { content, raw: data };
  }

  if (chaveCache) salvarCache(chaveCache, resultado.content);
  return resultado;
}

async function sendDeepSeekMessage({ messages, settings }) {
  const bodyObj = {
    model: settings.deepSeekModel || DEFAULT_DEEPSEEK_MODEL,
    messages,
    stream: false,
  };
  const endpoint = resolveEndpoint("deepseek", settings, bodyObj);
  const data = await chatFetch(endpoint.url, endpoint.headers, endpoint.body);

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
  const bodyObj = buildGroqRequestBody({ messages, settings, webSearchMode });
  const endpoint = resolveEndpoint("groq", settings, bodyObj);
  const data = await chatFetch(endpoint.url, endpoint.headers, endpoint.body);

  const content = normalizeAssistantContent(data?.choices?.[0]?.message?.content);
  if (!content) {
    throw new Error("A resposta da Groq veio vazia.");
  }

  return {
    content,
    raw: data,
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

// --- Streaming de respostas (efeito maquina de escrever) ---

function getProviderBody(provider, { messages, settings, webSearchMode }) {
  if (provider === "deepseek") {
    return {
      model: settings.deepSeekModel || DEFAULT_DEEPSEEK_MODEL,
      messages,
    };
  }

  if (provider === "groq") {
    return buildGroqRequestBody({ messages, settings, webSearchMode });
  }

  return buildOpenRouterRequestBody({ messages, settings, webSearchMode });
}

async function readStream(response, onChunk, signal) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let full = "";
  let buffer = "";

  if (signal) {
    signal.addEventListener("abort", () => reader.cancel(), { once: true });
  }

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n");
    buffer = parts.pop() || "";

    for (const part of parts) {
      const line = part.trim();
      if (!line || !line.startsWith("data:")) continue;

      const payload = line.slice(5).trim();
      if (payload === "[DONE]") continue;

      try {
        const json = JSON.parse(payload);
        const delta = json.choices?.[0]?.delta?.content || "";
        if (delta) {
          full += delta;
          onChunk?.(full);
        }
      } catch {
        // Linhas parciais ou mal formatadas nao interrompem o fluxo
      }
    }
  }

  // Processar resto do buffer apos o fim do stream
  if (buffer.trim()) {
    const line = buffer.trim();
    if (line.startsWith("data:")) {
      const payload = line.slice(5).trim();
      if (payload !== "[DONE]") {
        try {
          const json = JSON.parse(payload);
          const delta = json.choices?.[0]?.delta?.content || "";
          if (delta) full += delta;
          onChunk?.(full);
        } catch { /* ignorar */ }
      }
    }
  }

  return full;
}

export async function streamTextMessage({
  messages,
  settings,
  webSearchMode = false,
  onChunk = () => {},
  signal,
} = {}) {
  const provider = settings.textProvider || DEFAULT_TEXT_PROVIDER;

  if (provider === "deepseek" && webSearchMode) {
    throw new Error("Busca Web nao esta disponivel no DeepSeek direto.");
  }

  // Cache: verifica se ja temos esta resposta
  const model = settings.textModel || settings.deepSeekModel || settings.groqModel || "";
  const chaveCache = !webSearchMode ? getChaveCache(messages, model) : null;
  if (chaveCache) {
    const cached = lerCache(chaveCache);
    if (cached) {
      onChunk(cached);
      return { content: cached, streamed: false, fromCache: true };
    }
  }

  const rawBody = getProviderBody(provider, { messages, settings, webSearchMode });
  const { url, headers, body } = resolveEndpoint(provider, settings, { ...rawBody, stream: true });

  const controller = new AbortController();
  const watchdog = setTimeout(() => controller.abort(), 60000);

  if (signal) {
    signal.addEventListener("abort", () => controller.abort(), { once: true });
  }

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
    if (err.name === "AbortError") {
      throw new Error("A API demorou muito para responder. Tente novamente.");
    }
    throw new Error("Sem conexao com a API. Verifique internet e chave configurada.");
  }

  if (!response.ok) {
    clearTimeout(watchdog);
    const data = await response.json().catch(() => null);
    if (response.status === 429) {
      throw new Error("Muitas requisicoes por minuto. Aguarde e tente novamente.");
    }
    if (response.status === 401) {
      throw new Error("Chave de API invalida. Verifique nas configuracoes.");
    }
    throw new Error(extractErrorMessage(data, "Falha na API."));
  }

  try {
    const content = await readStream(response, onChunk, controller.signal);
    clearTimeout(watchdog);
    // Salva no cache apos sucesso
    if (chaveCache) salvarCache(chaveCache, content);
    return { content, streamed: true };
  } catch (err) {
    clearTimeout(watchdog);
    if (err.name === "AbortError") {
      throw new Error("A geracao da resposta foi interrompida.");
    }
    throw err;
  }
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
