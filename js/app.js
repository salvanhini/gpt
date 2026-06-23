import {
  BRASIL_AGENT_ID,
  NO_AGENT_ID,
  createAgent,
  deleteAgent,
  duplicateAgent,
  getEffectiveAgentSettings,
  getDefaultAgents,
  loadAgents,
  restoreDefaultAgents,
  SCIENCE_AGENT_ID,
  saveAgents,
  updateAgent,
} from "./agents.js";
import {
  createBrand,
  deleteBrand,
  loadBrands,
  saveBrands,
  updateBrand,
} from "./brands.js";
import {
  archiveConversation,
  archiveConversations,
  getAllArchived,
  restoreConversation,
  deleteArchived,
} from "./archiveStorage.js";
import {
  addMessage,
  createChat,
  getChatsByAgent,
  loadChats,
  saveChats,
  updateChatCategory,
  updateMessageCategory,
  updateChatTitle,
  updateMessageContent,
} from "./chat.js";
import {
  DEEPSEEK_MODELS,
  fetchOpenRouterModels,
  generateSpeechAudio,
  generateImage,
  getDefaultSettings,
  getTextProviderDisplayName,
  GEMINI_MODELS,
  GROQ_MODELS,
  hasTextProviderKey,
  IMAGE_PROVIDER_OPTIONS,
  IMAGE_SIZE_OPTIONS,
  OPENROUTER_MODELS,
  runWebSearchQuery,
  sendTextMessage,
  transcribeAudio,
} from "./api.js";
import {
  getSpeechSynthesis,
  createSpeechRecognition,
  getMicrophoneStream,
  isMediaRecorderSupported,
  isSpeechRecognitionSupported,
  pickPortugueseVoice,
} from "./audio.js";
import { processFiles } from "./fileProcessor.js";
import {
  formatCepSummary,
  formatCnpjSummary,
  inferBrasilLookupType,
  lookupCep,
  lookupCnpj,
} from "./brasilApi.js";
import {
  buildCreativeBrief,
  buildInstagramCopyFallback,
  buildInstagramCopyPrompt,
  buildInstagramImagePrompt,
  buildInstagramVariationPrompt,
  getInstagramFormatById,
  INSTAGRAM_FORMATS,
  isInstagramAgent,
} from "./instagramCreator.js";
import {
  buildPubMedContext,
  lookupPubMedArticles,
} from "./pubmed.js";
import { buildChatMessages } from "./messagePayload.js";
import {
  applyParsedBackup,
  buildBackupPayload,
  parseBackupPayload,
  readStorageJson,
  reconcileAppData,
  STORAGE_KEYS,
  writeStorageJson,
  normalizeSettingsWithFallback,
} from "./storage.js";
import { bindUIHandlers, renderApp, showToast, updateStreamingBubble, initLightbox } from "./ui.js";
import { createVoiceController } from "./voiceController.js";
import { incrementUsage } from "./usageTracker.js";
import { trackCost, getDailyCost, getMonthlyCost } from "./costTracker.js";
import { getMemoryFacts, removeMemoryFact, buildMemoryContext, autoExtractAndStore } from "./memory.js";
import {
  loadContacts,
  addContact,
  updateContact,
  deleteContact,
  addEmailRecord,
  loadEmailHistory,
  addWhatsAppRecord,
  loadWhatsAppHistory,
} from "./communicationStorage.js";
import { sendEmail } from "./emailService.js";
import { sendWhatsApp } from "./whatsappService.js";
import { exportChatAsPDF } from "./pdfGenerator.js";

const DRAFT_STORAGE_KEY = "femicgpt:draft";
let draftSaveTimer = null;
let bootSettingsFallbacks = [];

const state = {
  settings: loadSettings(),
  settingsFallbacks: bootSettingsFallbacks,
  agents: loadAgents(),
  brands: loadBrands(),
  chats: loadChats(),
  activeAgentId: null,
  activeChatId: null,
  activeCategory: "",
  viewMode: "chat",
  boardSearchQuery: "",
  pendingChatCategoryPicker: null,
  pendingMessageCategoryPicker: null,
  pendingAttachmentContext: null,
  imageMode: false,
  selectedBrandId: "",
  selectedTemplateId: "",
  pubmedMode: false,
  smartMode: false,
  pubmedResultLimit: 5,
  webSearchMode: false,
  thinkingEnabled: false,
  modelGuidanceCollapsed: false,
  agentSummaryCollapsed: true,
  creativeBriefCollapsed: true,
  instagramFormat: "story_9_16",
  creativeFormDraft: {
    objective: "",
    audience: "",
    headline: "",
    supportingText: "",
    cta: "",
    variationCount: "3",
  },
  isLoading: false,
  isListening: false,
  isVoiceProcessing: false,
  speakingMessageId: null,
  speechRecognitionSupported: isSpeechRecognitionSupported(),
  speechSynthesisSupported: Boolean(getSpeechSynthesis()),
  mediaRecorderSupported: isMediaRecorderSupported(),
  modals: {
    settings: false,
    agentForm: false,
    brandForm: false,
    renameChat: false,
    help: false,
    memory: false,
    emailCompose: false,
    whatsappCompose: false,
  },
  modalPayload: {},
  draftMessage: "",
  mobileSidebarOpen: false,
  sidebarCollapsed: false,
  archivedChats: [],
  showArchived: false,
  recognition: null,
  mediaRecorder: null,
  mediaStream: null,
  recordedAudioChunks: [],
  contacts: [],
  emailHistory: [],
  whatsappHistory: [],
  currentAudio: null,
  currentAudioUrl: null,
  availableVoice: null,
  modelOptions: OPENROUTER_MODELS,
  deepSeekModelOptions: DEEPSEEK_MODELS,
  groqModelOptions: GROQ_MODELS,
  geminiModelOptions: GEMINI_MODELS,
  openRouterAvailableModels: [],
  imageSizeOptions: IMAGE_SIZE_OPTIONS,
  imageProviderOptions: IMAGE_PROVIDER_OPTIONS,
  instagramFormats: INSTAGRAM_FORMATS,
};

function loadSettings() {
  const raw = readStorageJson(localStorage, STORAGE_KEYS.settings, {});
  const normalized = normalizeSettingsWithFallback(
    raw,
    getDefaultSettings(),
    OPENROUTER_MODELS,
    DEEPSEEK_MODELS,
    GROQ_MODELS,
  );

  bootSettingsFallbacks = normalized.fallbacks;

  if (normalized.fallbacks.length) {
    writeStorageJson(localStorage, STORAGE_KEYS.settings, normalized.settings);
  }

  return normalized.settings;
}

function saveSettings(settings) {
  writeStorageJson(localStorage, STORAGE_KEYS.settings, settings);
}

function loadViewState() {
  return readStorageJson(localStorage, STORAGE_KEYS.view, {});
}

function saveViewState() {
  writeStorageJson(localStorage, STORAGE_KEYS.view, {
    activeAgentId: state.activeAgentId,
    activeChatId: state.activeChatId,
    imageMode: state.imageMode,
    sidebarCollapsed: state.sidebarCollapsed,
    activeCategory: state.activeCategory,
    viewMode: state.viewMode,
    selectedBrandId: state.selectedBrandId,
    selectedTemplateId: state.selectedTemplateId,
    pubmedMode: state.pubmedMode,
    smartMode: state.smartMode,
    pubmedResultLimit: state.pubmedResultLimit,
    webSearchMode: state.webSearchMode,
    modelGuidanceCollapsed: state.modelGuidanceCollapsed,
    agentSummaryCollapsed: state.agentSummaryCollapsed,
    instagramFormat: state.instagramFormat,
    creativeFormDraft: state.creativeFormDraft,
  });
}

function hydratePersistentState() {
  const reconciled = reconcileAppData({
    agents: loadAgents(),
    chats: loadChats(),
    view: loadViewState(),
    defaultAgents: getDefaultAgents,
    createChat,
  });

  state.agents = reconciled.agents;
  state.brands = loadBrands();
  state.chats = reconciled.chats;
  state.activeAgentId = reconciled.activeAgentId;
  state.activeChatId = reconciled.activeChatId;
  state.imageMode = reconciled.view.imageMode;
  state.sidebarCollapsed = reconciled.view.sidebarCollapsed;
  state.activeCategory = reconciled.view.activeCategory || "";
  state.viewMode = reconciled.view.viewMode === "board" ? "board" : "chat";
  const hasSelectedBrand = state.brands.some((brand) => brand.id === reconciled.view.selectedBrandId);
  state.selectedBrandId = hasSelectedBrand ? reconciled.view.selectedBrandId : state.brands[0]?.id || "";
  const selectedBrand = state.brands.find((brand) => brand.id === state.selectedBrandId) || null;
  const hasSelectedTemplate = selectedBrand?.templates?.some((template) => template.id === reconciled.view.selectedTemplateId);
  state.selectedTemplateId = hasSelectedTemplate ? reconciled.view.selectedTemplateId : selectedBrand?.defaultTemplateId || "";
  state.pubmedMode = Boolean(reconciled.view.pubmedMode);
  state.smartMode = Boolean(reconciled.view.smartMode);
  state.pubmedResultLimit = Number(reconciled.view.pubmedResultLimit) > 0 ? Number(reconciled.view.pubmedResultLimit) : 5;
  state.webSearchMode = Boolean(reconciled.view.webSearchMode);
  state.modelGuidanceCollapsed = Boolean(reconciled.view.modelGuidanceCollapsed);
  state.agentSummaryCollapsed = Boolean(reconciled.view.agentSummaryCollapsed);
  state.instagramFormat = reconciled.view.instagramFormat || "story_9_16";
  state.creativeFormDraft = {
    objective: reconciled.view.creativeFormDraft?.objective || "",
    audience: reconciled.view.creativeFormDraft?.audience || "",
    headline: reconciled.view.creativeFormDraft?.headline || "",
    supportingText: reconciled.view.creativeFormDraft?.supportingText || "",
    cta: reconciled.view.creativeFormDraft?.cta || "",
    variationCount: reconciled.view.creativeFormDraft?.variationCount || "3",
  };

  if (isInstagramAgent(state.activeAgentId)) {
    state.imageMode = true;
  }

  saveAgents(state.agents);
  saveBrands(state.brands);
  saveChats(state.chats);
  writeStorageJson(localStorage, STORAGE_KEYS.view, reconciled.view);
}

function resetTransientState({ keepDraft = false } = {}) {
  voiceController.stopSpeaking();
  voiceController.stopInput();
  state.pendingAttachmentContext = null;
  state.pendingChatCategoryPicker = null;
  state.pendingMessageCategoryPicker = null;
  state.boardSearchQuery = "";
  state.isLoading = false;
  state.isVoiceProcessing = false;
  state.modalPayload = {};
  state.modals.settings = false;
  state.modals.agentForm = false;
  state.modals.brandForm = false;
  state.modals.renameChat = false;
  state.modals.help = false;
  state.mobileSidebarOpen = false;
  state.recordedAudioChunks = [];
  state.modals.memory = false;
  if (!keepDraft) {
    state.draftMessage = "";
  }
}

function loadImportedSettings(rawSettings) {
  const normalized = normalizeSettingsWithFallback(
    rawSettings,
    getDefaultSettings(),
    OPENROUTER_MODELS,
    DEEPSEEK_MODELS,
    GROQ_MODELS,
  );

  state.settingsFallbacks = normalized.fallbacks;
  if (normalized.fallbacks.length) {
    writeStorageJson(localStorage, STORAGE_KEYS.settings, normalized.settings);
  }

  return normalized.settings;
}

function buildUserErrorMessage(error, fallback) {
  const message = error?.message || fallback;
  return message?.trim() ? message : fallback;
}

function smartClassify(message) {
  const lower = message.toLowerCase().trim();

  // ── Web Search Detection ──
  const webKeywords = [
    "noticias", "noticia", "hoje", "ultimas", "ultimo", "lancamento",
    "novidade", "novidades", "recente", "recem", "atualizacao",
    "atualizado", "nova", "novo", "novas", "novos",
    "preco", "preço", "cotacao", "cotação", "valor", "custo",
    "quanto custa", "previsao", "previsão",
    "tempo", "clima", "temperatura", "chuva",
    "jogo", "jogos", "resultado", "campeonato", "partida", "placar",
    "tendencia", "tendência", "moda", "viral", "tendencias",
    "pesquisa sobre", "o que é", "o que e", "quem é", "quem e",
    "como funciona", "significado",
    "busque", "procure", "encontre", "pesquise",
    "busca na web", "busca na internet", "pesquisa na internet",
  ];
  const useWebSearch = webKeywords.some((kw) => lower.includes(kw));

  // ── Model Tier Detection ──
  let modelTier = "default";
  const len = message.length;

  if (len <= 80 && !lower.includes("```") && !lower.includes("codigo")) {
    modelTier = "fast";
  }

  const deepKeywords = [
    "analise", "análise", "analise detalhadamente", "analise profundamente",
    "explique detalhadamente", "explique profundamente",
    "compare", "comparação", "comparacao",
    "código", "codigo", "```", "refatore", "reescreva",
    "debug", "debugue",
    "arquitetura", "projete um",
  ];
  if (len > 500 || deepKeywords.some((kw) => lower.includes(kw))) {
    modelTier = "deep";
  }

  return { useWebSearch, modelTier };
}

function addAssistantErrorMessage(chatId, error) {
  addMessage(chatId, {
    role: "assistant",
    content: `Nao foi possivel concluir sua solicitacao.\n\nMotivo: ${buildUserErrorMessage(error, "Erro desconhecido.")}`,
    meta: {
      kind: "error",
      provider: "local",
      failed: true,
    },
  });
}

function ensureSeedData() {
  hydratePersistentState();
}

function syncActivePointers() {
  hydratePersistentState();
  saveViewState();
}

function getActiveAgent() {
  return state.agents.find((agent) => agent.id === state.activeAgentId) || null;
}

function getActiveSettings() {
  return getEffectiveAgentSettings(state.settings, getActiveAgent());
}

function getSelectedBrand() {
  return state.brands.find((brand) => brand.id === state.selectedBrandId) || null;
}

function getSelectedTemplate() {
  const brand = getSelectedBrand();
  return brand?.templates?.find((template) => template.id === state.selectedTemplateId) || null;
}

function getActiveChat() {
  return state.chats.find((chat) => chat.id === state.activeChatId) || null;
}

function applyAgentModeDefaults(agentId) {
  const agent = state.agents.find((item) => item.id === agentId);
  if (!agent) {
    return;
  }

  if (!isInstagramAgent(agentId) && agentId !== BRASIL_AGENT_ID) {
    if (agent.defaultImageMode === "on") state.imageMode = true;
    if (agent.defaultImageMode === "off") state.imageMode = false;
  }

  if (agent.defaultWebSearchMode === "on") state.webSearchMode = true;
  if (agent.defaultWebSearchMode === "off") state.webSearchMode = false;

  if (agentId === SCIENCE_AGENT_ID) {
    if (agent.defaultPubmedMode === "on") state.pubmedMode = true;
    if (agent.defaultPubmedMode === "off") state.pubmedMode = false;
  }
}

function refreshFromStorage() {
  state.agents = loadAgents();
  state.brands = loadBrands();
  state.chats = loadChats();
  hydratePersistentState();
}

function setModal(name, open, payload = {}) {
  state.modals[name] = open;
  state.modalPayload = open ? payload : {};
  if (open) {
    state.mobileSidebarOpen = false;
  }
  render();
}

function render() {
  try {
    refreshFromStorage();
    state.activeAgent = getActiveAgent();
    state.effectiveSettings = getActiveSettings();
    state.dailyCost = getDailyCost();
    state.monthlyCost = getMonthlyCost();
    state.memoryFacts = getMemoryFacts();
    renderApp(state);
    window.scrollTo(0, 0);
  } catch (error) {
    console.error("[FEMIC GPT] Erro ao renderizar:", error);
    const app = document.getElementById("app");
    if (app) {
      app.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;padding:2rem;text-align:center;font-family:sans-serif;">
        <div style="font-size:3rem;margin-bottom:1rem;">⚠️</div>
        <h1 style="font-size:1.5rem;font-weight:600;color:#1A365D;margin:0 0 0.5rem;">FEMIC GPT</h1>
        <p style="color:#5B7088;max-width:400px;">Ocorreu um erro ao carregar a interface.</p>
        <pre style="background:#f1f5f9;padding:1rem;border-radius:0.75rem;font-size:0.8rem;color:#991b1b;max-width:90%;overflow:auto;margin-top:1rem;">${escapeHtml(error?.message || "Erro desconhecido")}</pre>
        <button onclick="location.reload()" style="margin-top:1.5rem;padding:0.75rem 2rem;border-radius:999px;border:none;background:#1A365D;color:white;font-weight:600;cursor:pointer;">Recarregar</button>
      </div>`;
    }
  }
}

function escapeHtml(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function persistAndRender() {
  saveViewState();
  render();
}

function compactHistoryForPayload(messages = [], settings = getActiveSettings()) {
  messages = messages || [];
  settings = settings || {};
  const maxHistoryMessages = Math.max(4, Number(settings.usageLimits?.maxHistoryMessages) || 30);

  const mapear = (msg) => ({
    role: msg.role,
    content:
      msg.meta?.kind === "image"
        ? `[imagem gerada anteriormente]\nPrompt: ${msg.content}\nURL: ${msg.meta.imageUrl}`
        : msg.content,
  });

  if (messages.length <= maxHistoryMessages) {
    return messages.map(mapear);
  }

  const chat = getActiveChat();
  const recentMessages = messages.slice(-maxHistoryMessages);

  if (chat?.summary) {
    return [
      { role: "system", content: `Resumo da conversa ate aqui:\n${chat.summary}` },
      ...recentMessages.map(mapear),
    ];
  }

  const oldMessages = messages.slice(0, -maxHistoryMessages);
  const linhas = oldMessages.map((msg) => {
    const papel = msg.role === "user" ? "U" : "A";
    const texto = String(msg.content || "").replace(/\s+/g, " ").slice(0, 200);
    return `${papel}: ${texto}`;
  });

  return [
    { role: "system", content: `Resumo compacto do historico anterior:\n${linhas.join("\n")}` },
    ...recentMessages.map(mapear),
  ];
}

function buildTextPayload(userMessage) {
  const activeAgent = getActiveAgent();
  const activeChat = getActiveChat();
  const history = compactHistoryForPayload(activeChat?.messages || []);
  const memoryContext = buildMemoryContext();
  const imageDataUrls = (state.pendingAttachmentContext?.files || [])
    .filter((f) => f.imageDataUrl)
    .map((f) => ({ dataUrl: f.imageDataUrl, name: f.name }));

  return buildChatMessages({
    globalSystemPrompt: state.settings.globalSystemPrompt || "",
    agentSystemPrompt: activeAgent?.systemPrompt || "",
    responseStyle: activeAgent?.responseStyle || "",
    history,
    attachmentContext: state.pendingAttachmentContext?.combinedContext || "",
    referenceContext: memoryContext,
    userMessage,
    imageDataUrls,
  });
}

function buildTextPayloadWithReference(userMessage, referenceContext) {
  const activeAgent = getActiveAgent();
  const activeChat = getActiveChat();
  const history = compactHistoryForPayload(activeChat?.messages || []);
  const imageDataUrls = (state.pendingAttachmentContext?.files || [])
    .filter((f) => f.imageDataUrl)
    .map((f) => ({ dataUrl: f.imageDataUrl, name: f.name }));

  return buildChatMessages({
    globalSystemPrompt: state.settings.globalSystemPrompt || "",
    agentSystemPrompt: activeAgent?.systemPrompt || "",
    responseStyle: activeAgent?.responseStyle || "",
    history,
    attachmentContext: state.pendingAttachmentContext?.combinedContext || "",
    referenceContext,
    userMessage,
    imageDataUrls,
  });
}

function buildInstagramPayload() {
  const brand = getSelectedBrand();
  if (!brand) {
    throw new Error("Cadastre e selecione uma marca antes de gerar a arte.");
  }

  const creativeBrief = buildCreativeBrief(state.creativeFormDraft);
  const customPrompt = (state.draftMessage || "").trim();

  return {
    brand,
    format: getInstagramFormatById(state.instagramFormat),
    creativeBrief,
    customPrompt,
    variationCount: Math.min(Math.max(Number(state.creativeFormDraft.variationCount) || 1, 1), 4),
    prompt: buildInstagramImagePrompt({
      brand,
      formatId: state.instagramFormat,
      draft: state.creativeFormDraft,
      customPrompt,
    }),
  };
}

function canGenerateInstagramCopy() {
  return hasTextProviderKey(getActiveSettings());
}

function getActiveTextProviderLabel() {
  return getTextProviderDisplayName(getActiveSettings().textProvider);
}

function canUseWebSearch() {
  const provider = getActiveSettings().textProvider;
  return provider !== "deepseek" && provider !== "gemini";
}

function resetAttachments() {
  state.pendingAttachmentContext = null;
}

function addWebSearchMessage(chatId, searchResult) {
  addMessage(chatId, {
    role: "assistant",
    content: searchResult.content,
    meta: {
      kind: "text",
      provider: searchResult.provider,
      sourceType: searchResult.sourceType || "web-search",
      webSearch: true,
      isFallback: Boolean(searchResult.isFallback),
      citations: searchResult.citations || [],
      searchImages: searchResult.images || [],
      ...(searchResult.failed ? { failed: true } : {}),
    },
  });
}

async function resolveWebSearchForMessage(message, settingsOverride) {
  return runWebSearchQuery({
    messages: buildTextPayload(message),
    settings: settingsOverride || getActiveSettings(),
  });
}

async function handleSendMessage(rawMessage) {
  const isInstagramMode = isInstagramAgent(state.activeAgentId);
  const isPubMedMode = state.activeAgentId === SCIENCE_AGENT_ID && state.pubmedMode;
  const isBrasilAgent = state.activeAgentId === BRASIL_AGENT_ID;
  let message = String(rawMessage || "").trim();
  if (!message || state.isLoading) {
    if (!isInstagramMode || state.isLoading) {
      return;
    }
  }

  const activeChat = getActiveChat();
  if (!activeChat) {
    showToast("Nenhuma conversa ativa disponível.", "error");
    return;
  }

  let instagramPayload = null;
  if (isInstagramMode) {
    try {
      instagramPayload = buildInstagramPayload();
    } catch (error) {
      showToast(buildUserErrorMessage(error, "Nao foi possivel montar a arte."), "error");
      return;
    }
    message = [instagramPayload.creativeBrief, instagramPayload.customPrompt].filter(Boolean).join("\n\n---\n");
  }

  const textPayload = state.imageMode || isInstagramMode || isPubMedMode
    ? null
    : buildTextPayload(message);
  state.isLoading = true;

  try {
    addMessage(activeChat.id, {
      role: "user",
      content: message,
      meta: {
        kind: "text",
        attachments: state.pendingAttachmentContext?.files || [],
        instagramFormat: instagramPayload?.format.id || null,
        brandId: instagramPayload?.brand.id || null,
      },
    });

    state.draftMessage = "";
    try { localStorage.removeItem(DRAFT_STORAGE_KEY); } catch {}
    persistAndRender();
    if (isBrasilAgent) {
      const inferred = inferBrasilLookupType(message);
      if (inferred.type === "cep") {
        const result = await lookupCep(inferred.value);
        addMessage(activeChat.id, {
          role: "assistant",
          content: formatCepSummary(result),
          meta: {
            kind: "text",
            provider: "Brasil API",
            sourceType: "cep",
            brasilData: result,
          },
        });
      } else if (inferred.type === "cnpj") {
        const result = await lookupCnpj(inferred.value);
        addMessage(activeChat.id, {
          role: "assistant",
          content: formatCnpjSummary(result),
          meta: {
            kind: "text",
            provider: "Brasil API",
            sourceType: "cnpj",
            brasilData: result,
          },
        });
      } else if (state.webSearchMode) {
        if (!canUseWebSearch()) {
          addMessage(activeChat.id, {
            role: "assistant",
            content: "A Busca Web em tempo real desta versao funciona com Groq ou OpenRouter. Selecione um desses provedores no seletor de modelo para usar a internet aqui no chat.",
            meta: {
              kind: "text",
              provider: "local",
              sourceType: "web-search",
              webSearch: true,
              failed: true,
            },
          });
        } else {
          addWebSearchMessage(activeChat.id, await resolveWebSearchForMessage(message));
        }
      } else {
        addMessage(activeChat.id, {
          role: "assistant",
          content: "Envie um CEP com 8 dígitos ou um CNPJ com 14 dígitos para eu consultar os dados nacionais.",
          meta: {
            kind: "text",
            provider: "Brasil API",
            sourceType: "invalid",
            failed: true,
          },
        });
      }
    } else if (isPubMedMode) {
      const articles = await lookupPubMedArticles(message, {
        retmax: state.pubmedResultLimit,
      });

      if (!articles.length) {
        addMessage(activeChat.id, {
          role: "assistant",
          content: "Nao encontrei artigos relevantes na PubMed para essa busca. Tente reformular a pergunta com termos mais especificos.",
          meta: {
            kind: "text",
            provider: "PubMed",
            sourceType: "pubmed",
            articles: [],
            failed: true,
          },
        });
      } else {
        const reply = await sendTextMessage({
          messages: buildTextPayloadWithReference(message, buildPubMedContext(articles)),
          settings: getActiveSettings(),
        });

        const sources = articles
          .map((article) => `- ${article.title} (${article.year || "s.d."})\n  ${article.pubmedUrl}`)
          .join("\n");

        addMessage(activeChat.id, {
          role: "assistant",
          content: `${reply.content}\n\nFontes PubMed:\n${sources}`,
          meta: {
            kind: "text",
            provider: "PubMed",
            sourceType: "pubmed",
            articles,
          },
        });
      }
    } else
    if (state.imageMode || isInstagramMode) {
      if (isInstagramMode && instagramPayload) {
        let copyContent;
        try {
          if (canGenerateInstagramCopy()) {
            const copyReply = await sendTextMessage({
              messages: [
                {
                  role: "system",
                  content: "Você é um especialista em copy para Instagram e deve responder exatamente no formato pedido pelo usuário.",
                },
                {
                  role: "user",
                  content: buildInstagramCopyPrompt({
                    brand: instagramPayload.brand,
                    formatId: instagramPayload.format.id,
                    draft: state.creativeFormDraft,
                    variationCount: instagramPayload.variationCount,
                  }),
                },
              ],
              settings: getActiveSettings(),
            });
            copyContent = copyReply.content;
          } else {
            copyContent = buildInstagramCopyFallback({
              brand: instagramPayload.brand,
              draft: state.creativeFormDraft,
            });
          }
        } catch {
          copyContent = buildInstagramCopyFallback({
            brand: instagramPayload.brand,
            draft: state.creativeFormDraft,
          });
        }

        addMessage(activeChat.id, {
          role: "assistant",
          content: copyContent,
          meta: {
            kind: "text",
            provider: canGenerateInstagramCopy()
              ? getActiveTextProviderLabel()
              : "local",
            brandId: instagramPayload.brand.id,
            instagramFormat: instagramPayload.format.id,
            creativeBrief: instagramPayload.creativeBrief,
            copyKind: "instagram-caption",
          },
        });

        for (let index = 1; index <= instagramPayload.variationCount; index += 1) {
          const image = await generateImage({
            prompt: buildInstagramVariationPrompt({
              basePrompt: instagramPayload.prompt,
              variationIndex: index,
              totalVariations: instagramPayload.variationCount,
            }),
            settings: {
              ...getActiveSettings(),
              imageSize: instagramPayload.format.imageSize || state.settings.imageSize,
            },
          });

          addMessage(activeChat.id, {
            role: "assistant",
            content: `${instagramPayload.creativeBrief}\n\nVariação ${index} de ${instagramPayload.variationCount}`,
            meta: {
              kind: "image",
              imageUrl: image.url,
              provider: getActiveSettings().imageProvider === "fal-ai" ? "fal.ai" : "Pollinations.ai",
              brandId: instagramPayload.brand.id,
              instagramFormat: instagramPayload.format.id,
              creativeBrief: instagramPayload.creativeBrief,
              variationIndex: index,
              variationCount: instagramPayload.variationCount,
            },
          });
        }
      } else {
        const progressMsgId = crypto.randomUUID();
        addMessage(activeChat.id, {
          id: progressMsgId,
          role: "assistant",
          content: instagramPayload?.creativeBrief || message,
          meta: {
            kind: "image",
            generating: true,
            provider: getActiveSettings().imageProvider === "fal-ai" ? "fal.ai" : "Pollinations.ai",
            brandId: instagramPayload?.brand.id || null,
            instagramFormat: instagramPayload?.format.id || null,
            creativeBrief: instagramPayload?.creativeBrief || null,
          },
        });
        persistAndRender();

        const image = await generateImage({
          prompt: instagramPayload?.prompt || message,
          settings: {
            ...getActiveSettings(),
            imageSize: instagramPayload?.format.imageSize || state.settings.imageSize,
          },
        });

        updateMessageContent(activeChat.id, progressMsgId, instagramPayload?.creativeBrief || message, {
          meta: {
            kind: "image",
            generating: false,
            imageUrl: image.url,
            provider: getActiveSettings().imageProvider === "fal-ai" ? "fal.ai" : "Pollinations.ai",
            brandId: instagramPayload?.brand.id || null,
            instagramFormat: instagramPayload?.format.id || null,
            creativeBrief: instagramPayload?.creativeBrief || null,
          },
        });
      }
    } else {
      if (state.webSearchMode && !canUseWebSearch()) {
        addMessage(activeChat.id, {
          role: "assistant",
          content: "A Busca Web em tempo real desta versao funciona com Groq ou OpenRouter. Selecione um desses provedores no seletor de modelo para continuar.",
          meta: {
            kind: "text",
            provider: "local",
            sourceType: "web-search",
            webSearch: true,
            failed: true,
          },
        });
        resetAttachments();
        return;
      }

      // Smart mode: classifica e roteia sem mutar o estado global
      let activeSettings = getActiveSettings();
      let smartWebSearch = false;
      let actualProvider = activeSettings.textProvider;
      let actualModel = activeSettings.textModel || activeSettings.groqModel || activeSettings.deepSeekModel || "";

      if (state.smartMode && !isBrasilAgent) {
        const { useWebSearch, modelTier } = smartClassify(message);
        smartWebSearch = useWebSearch;

        if (modelTier === "fast" && !smartWebSearch) {
          if (activeSettings.groqKey) {
            activeSettings.textProvider = "groq";
            activeSettings.groqModel = "openai/gpt-oss-120b";
          } else {
            activeSettings.textProvider = "openrouter";
            activeSettings.textModel = "qwen/qwen3.7-plus";
          }
          actualProvider = activeSettings.textProvider;
          actualModel = activeSettings.groqModel || activeSettings.textModel || "";
        }
      }

      const shouldSearch = smartWebSearch || state.webSearchMode;

      if (shouldSearch) {
        addWebSearchMessage(activeChat.id, await resolveWebSearchForMessage(message, activeSettings));
      } else {
        const isStreamable = !state.thinkingEnabled && !shouldSearch && activeSettings.textProvider !== "deepseek" && activeSettings.textProvider !== "gemini";

        let responseContent;

        if (isStreamable) {
          const msgId = crypto.randomUUID();
          addMessage(activeChat.id, {
            id: msgId,
            role: "assistant",
            content: "",
            meta: { kind: "text", streaming: true, provider: getTextProviderDisplayName(actualProvider), model: actualModel },
          });
          persistAndRender();

          let fullContent = "";
          try {
            await sendTextMessage({
              messages: textPayload,
              settings: activeSettings,
              webSearchMode: false,
              thinkingEnabled: false,
              onChunk: (chunk) => {
                fullContent += chunk;
                updateMessageContent(activeChat.id, msgId, fullContent);
                updateStreamingBubble(msgId, fullContent);
              },
            });
          } catch (err) {
            if (!fullContent) throw err;
            fullContent += `\n\n*[Erro ao continuar a geracao: ${err.message}]*`;
          }

          updateMessageContent(activeChat.id, msgId, fullContent, { meta: { streaming: false } });
          saveChats(state.chats);
          persistAndRender();
          responseContent = fullContent;
        } else {
          const sendResult = await sendTextMessage({
            messages: textPayload,
            settings: activeSettings,
            webSearchMode: false,
            thinkingEnabled: state.thinkingEnabled,
          });
          addMessage(activeChat.id, {
            role: "assistant",
            content: sendResult.content,
            meta: {
              kind: "text",
              provider: getTextProviderDisplayName(actualProvider),
              cachedTokens: sendResult.cachedTokens || 0,
              promptTokens: sendResult.promptTokens || 0,
              completionTokens: sendResult.completionTokens || 0,
              model: actualModel,
            },
          });
          if (sendResult.promptTokens && sendResult.completionTokens) {
            trackCost(actualModel, sendResult.promptTokens, sendResult.completionTokens);
          }
          responseContent = sendResult.content;
        }

        const emailActionMatch = responseContent.match(/\[ENVIAR_EMAIL\]\s*\n([\s\S]*?)\n\[\/ENVIAR_EMAIL\]\s*\n([\s\S]*)/);
        if (emailActionMatch) {
          const headerBlock = emailActionMatch[1];
          const bodyText = emailActionMatch[2].trim();
          const toMatch = headerBlock.match(/Para:\s*(.+)/);
          const nameMatch = headerBlock.match(/Nome:\s*(.+)/);
          const subjectMatch = headerBlock.match(/Assunto:\s*(.+)/);
          const senderMatch = headerBlock.match(/Remetente:\s*(.+)/);
          if (toMatch) {
            const emailTo = toMatch[1].trim();
            const emailName = nameMatch ? nameMatch[1].trim() : "";
            const emailSubject = subjectMatch ? subjectMatch[1].trim() : "";
            const emailSender = senderMatch ? senderMatch[1].trim() : "marco";
            try {
              const emailResult = await sendEmail({
                toEmail: emailTo,
                toName: emailName,
                subject: emailSubject,
                message: bodyText,
                sender: emailSender,
                settings: state.settings,
              });
              await addEmailRecord({
                to: emailTo,
                toName: emailName,
                subject: emailSubject,
                body: bodyText,
                status: "sent",
              });
              state.emailHistory = await loadEmailHistory();
              addMessage(activeChat.id, {
                role: "assistant",
                content: `Email enviado com sucesso para ${emailTo}!`,
                meta: { kind: "text", provider: "email-system", sourceType: "email-send", emailSent: true },
              });
              showToast(`Email enviado para ${emailTo}.`, "success");
            } catch (emailError) {
              addMessage(activeChat.id, {
                role: "assistant",
                content: `Erro ao enviar email: ${emailError.message}`,
                meta: { kind: "text", provider: "email-system", sourceType: "email-send", failed: true },
              });
              showToast(emailError.message || "Erro ao enviar email.", "error");
            }
          }
        }

        const whatsappActionMatch = responseContent.match(/\[ENVIAR_WHATSAPP\]\s*\n([\s\S]*?)\n\[\/ENVIAR_WHATSAPP\]\s*\n([\s\S]*)/);
        if (whatsappActionMatch) {
          const headerBlock = whatsappActionMatch[1];
          const bodyText = whatsappActionMatch[2].trim();
          const numeroMatch = headerBlock.match(/Numero:\s*(.+)/);
          if (numeroMatch) {
            const whatsappNumber = numeroMatch[1].trim();
            try {
              const whatsappResult = await sendWhatsApp({
                to: whatsappNumber,
                message: bodyText,
                settings: state.settings,
              });
              await addWhatsAppRecord({
                to: whatsappNumber,
                message: bodyText,
                status: "sent",
              });
              state.whatsappHistory = await loadWhatsAppHistory();
              addMessage(activeChat.id, {
                role: "assistant",
                content: `Mensagem WhatsApp enviada com sucesso para ${whatsappNumber}!`,
                meta: { kind: "text", provider: "whatsapp-system", sourceType: "whatsapp-send", whatsappSent: true },
              });
              showToast(`WhatsApp enviado para ${whatsappNumber}.`, "success");
            } catch (whatsappError) {
              addMessage(activeChat.id, {
                role: "assistant",
                content: `Erro ao enviar WhatsApp: ${whatsappError.message}`,
                meta: { kind: "text", provider: "whatsapp-system", sourceType: "whatsapp-send", failed: true },
              });
              showToast(whatsappError.message || "Erro ao enviar WhatsApp.", "error");
            }
          }
        }
      }
    }

    resetAttachments();

    // Auto-extract memory facts from conversation
    if (activeChat?.messages?.length > 2) {
      autoExtractAndStore(activeChat.messages);
    }
  } catch (error) {
    addAssistantErrorMessage(activeChat.id, error);
    showToast(buildUserErrorMessage(error, "Erro ao enviar mensagem."), "error");
  } finally {
    state.isLoading = false;
    refreshFromStorage();
    persistAndRender();
    incrementUsage("textMessages");
    // Atualiza resumo acumulativo se houver mensagens demais
    const chat = getActiveChat();
    if (chat?.messages?.length > 40 && chat.summary !== false) {
      const maxMsg = Math.max(4, Number(state.settings.usageLimits?.maxHistoryMessages) || 30);
      const extras = chat.messages.length - maxMsg;
      if (extras > 10) {
        const antigas = chat.messages.slice(0, -(maxMsg + extras));
        const linhas = antigas.map((m) => {
          const p = m.role === "user" ? "U" : "A";
          return `${p}: ${String(m.content || "").replace(/\s+/g, " ").slice(0, 200)}`;
        });
        chat.summary = linhas.join("\n");
        saveChats(state.chats);
      }
    }
  }
}

function handleCreateChat() {
  const chat = createChat(state.activeAgentId);
  state.chats.push(chat);
  saveChats(state.chats);
  state.activeChatId = chat.id;
  state.viewMode = "chat";
  state.boardSearchQuery = "";
  state.mobileSidebarOpen = false;
  persistAndRender();
}

function handleSelectAgent(agentId) {
  state.activeAgentId = agentId;
  const chats = getChatsByAgent(agentId);
  if (chats.length) {
    state.activeChatId = chats[0].id;
  } else {
    const chat = createChat(agentId);
    state.chats.push(chat);
    saveChats(state.chats);
    state.activeChatId = chat.id;
  }

  state.mobileSidebarOpen = false;
  state.viewMode = "chat";
  state.boardSearchQuery = "";
  if (isInstagramAgent(agentId)) {
    state.imageMode = true;
    state.selectedBrandId = state.selectedBrandId || state.brands[0]?.id || "";
    const brand = state.brands.find((item) => item.id === state.selectedBrandId);
    state.selectedTemplateId = brand?.defaultTemplateId || "";
  } else if (agentId === BRASIL_AGENT_ID) {
    state.imageMode = false;
  }
  applyAgentModeDefaults(agentId);
  persistAndRender();
}

function handleSelectChat(chatId) {
  const chat = state.chats.find((item) => item.id === chatId);
  if (!chat) {
    return;
  }

  state.activeAgentId = chat.agentId;
  state.activeChatId = chatId;
  state.viewMode = "chat";
  state.mobileSidebarOpen = false;
  state.pendingChatCategoryPicker = null;
  if (isInstagramAgent(chat.agentId)) {
    state.imageMode = true;
  } else if (chat.agentId === BRASIL_AGENT_ID) {
    state.imageMode = false;
  }
  applyAgentModeDefaults(chat.agentId);
  persistAndRender();
}

function handleDeleteChat(chatId) {
  const chat = state.chats.find((item) => item.id === chatId);
  if (!chat) {
    return;
  }

  if (!window.confirm("Excluir esta conversa?")) {
    return;
  }

  state.chats = state.chats.filter((item) => item.id !== chatId);

  if (!state.chats.length) {
    state.chats.push(createChat(state.activeAgentId));
  }

  if (state.activeChatId === chatId) {
    const nextForAgent = state.chats.find((item) => item.agentId === state.activeAgentId);
    if (nextForAgent) {
      state.activeChatId = nextForAgent.id;
    } else {
      const chat = createChat(state.activeAgentId);
      state.chats.push(chat);
      state.activeChatId = chat.id;
    }
  }

  saveChats(state.chats);
  showToast("Conversa excluída.", "success");
  persistAndRender();
}

function handleArchiveChat(chatId) {
  const chat = state.chats.find((item) => item.id === chatId);
  if (!chat) return;

  archiveConversation(chat);
  state.chats = state.chats.filter((item) => item.id !== chatId);

  if (!state.chats.length) {
    state.chats.push(createChat(state.activeAgentId));
  }

  if (state.activeChatId === chatId) {
    const nextForAgent = state.chats.find((item) => item.agentId === state.activeAgentId);
    if (nextForAgent) {
      state.activeChatId = nextForAgent.id;
    } else {
      const newChat = createChat(state.activeAgentId);
      state.chats.push(newChat);
      state.activeChatId = newChat.id;
    }
  }

  saveChats(state.chats);
  showToast("Conversa arquivada.", "success");
  persistAndRender();
}

function handleQuickModelChange(value) {
  const [provider, model] = value.split("::");
  if (!provider || !model) {
    return;
  }

  if (provider === "openrouter" && state.settings.openRouterEnabled === false) {
    showToast("OpenRouter esta desabilitado. Ative nas configuracoes.", "error");
    return;
  }

  if (provider === "deepseek" && state.settings.deepSeekEnabled === false) {
    showToast("DeepSeek esta desabilitado. Ative nas configuracoes.", "error");
    return;
  }

  if (provider === "groq" && state.settings.groqEnabled === false) {
    showToast("Groq esta desabilitado. Ative nas configuracoes.", "error");
    return;
  }

  if (provider === "gemini" && state.settings.geminiEnabled === false) {
    showToast("Google Gemini esta desabilitado. Ative nas configuracoes.", "error");
    return;
  }

  state.settings = {
    ...state.settings,
    textProvider: provider,
    ...(provider === "deepseek"
      ? { deepSeekModel: model }
      : provider === "groq"
        ? { groqModel: model }
        : provider === "gemini"
          ? { geminiModel: model }
          : { textModel: model }),
  };

  saveSettings(state.settings);
  state.settingsFallbacks = [];
  showToast(`Modelo ativo: ${getTextProviderDisplayName(provider)}`, "success");
  persistAndRender();
}

function handleChangeImageSize(value) {
  state.settings = {
    ...state.settings,
    imageSize: value,
  };

  saveSettings(state.settings);
  persistAndRender();
}

function handleSetChatCategory(chatId, category) {
  try {
    updateChatCategory(chatId, category);
    state.chats = loadChats();
    state.pendingChatCategoryPicker = null;
    persistAndRender();
  } catch (error) {
    showToast(error.message || "Erro ao definir categoria.", "error");
  }
}

function handleRenameChat(chatId) {
  const chat = state.chats.find((item) => item.id === chatId);
  if (!chat) return;
  setModal("renameChat", true, { chatId, title: chat.title });
}

function handleSaveChatRename(formValues) {
  const chatId = formValues.chatId?.toString() || "";
  const newTitle = formValues.title?.toString().trim() || "";
  if (!chatId) return;
  if (!newTitle) {
    showToast("Digite um nome para a conversa.", "error");
    return;
  }

  const chat = state.chats.find((item) => item.id === chatId);
  if (!chat) {
    showToast("Conversa não encontrada.", "error");
    return;
  }

  if (newTitle === chat.title) {
    setModal("renameChat", false);
    return;
  }

  try {
    updateChatTitle(chatId, newTitle);
    state.chats = loadChats();
    state.modals.renameChat = false;
    state.modalPayload = {};
    showToast("Conversa renomeada.", "success");
    persistAndRender();
  } catch (error) {
    showToast(error.message || "Erro ao renomear conversa.", "error");
  }
}

function handleSetMessageCategory(messageId, category) {
  const chat = getActiveChat();
  if (!chat) {
    return;
  }

  try {
    updateMessageCategory(chat.id, messageId, category);
    state.chats = loadChats();
    state.pendingMessageCategoryPicker = null;
    persistAndRender();
  } catch (error) {
    showToast(error.message || "Erro ao definir categoria da mensagem.", "error");
  }
}

function handleToggleCategoryPicker(chatId) {
  state.pendingChatCategoryPicker =
    state.pendingChatCategoryPicker === chatId ? null : chatId;
  state.pendingMessageCategoryPicker = null;
  render();
}

function handleToggleMessageCategoryPicker(messageId) {
  state.pendingMessageCategoryPicker =
    state.pendingMessageCategoryPicker === messageId ? null : messageId;
  state.pendingChatCategoryPicker = null;
  render();
}

function handleFilterByCategory(category) {
  state.activeCategory = state.activeCategory === category ? "" : category;
  persistAndRender();
}

function handleToggleBoardView() {
  state.viewMode = state.viewMode === "board" ? "chat" : "board";
  state.boardSearchQuery = "";
  persistAndRender();
}

function handleTogglePubMedMode() {
  state.pubmedMode = !state.pubmedMode;
  persistAndRender();
}

function handleToggleWebSearchMode() {
  state.webSearchMode = !state.webSearchMode;
  persistAndRender();
}

function handleToggleSmartMode() {
  state.smartMode = !state.smartMode;
  showToast(state.smartMode ? "Modo automático ativado" : "Modo automático desativado");
  persistAndRender();
}

function handleToggleThinkingMode() {
  state.thinkingEnabled = !state.thinkingEnabled;
  showToast(state.thinkingEnabled ? "Thinking mode ativado" : "Thinking mode desativado");
  persistAndRender();
}

function handleTogglePinChat(chatId) {
  const chat = state.chats.find((c) => c.id === chatId);
  if (!chat) return;
  chat.pinned = !chat.pinned;
  saveChats(state.chats);
  showToast(chat.pinned ? "Conversa fixada" : "Conversa desafixada");
  persistAndRender();
}

async function handleToggleShowArchived() {
  state.showArchived = !state.showArchived;
  if (state.showArchived) {
    try {
      state.archivedChats = await getAllArchived();
    } catch (err) {
      console.error("[FEMIC GPT] Erro ao carregar arquivadas:", err);
      state.archivedChats = [];
    }
  }
  persistAndRender();
}

async function handleRestoreArchived(chatId) {
  try {
    const chat = await restoreConversation(chatId);
    if (chat) {
      state.chats.push(chat);
      saveChats(state.chats);
      state.archivedChats = state.archivedChats.filter((c) => c.id !== chatId);
      showToast("Conversa restaurada com sucesso!");
      persistAndRender();
    }
  } catch (err) {
    console.error("[FEMIC GPT] Erro ao restaurar:", err);
    showToast("Erro ao restaurar conversa.", "error");
  }
}

async function handleDeleteArchived(chatId) {
  try {
    await deleteArchived(chatId);
    state.archivedChats = state.archivedChats.filter((c) => c.id !== chatId);
    showToast("Conversa arquivada excluída permanentemente.");
    persistAndRender();
  } catch (err) {
    console.error("[FEMIC GPT] Erro ao excluir arquivada:", err);
    showToast("Erro ao excluir conversa arquivada.", "error");
  }
}

function handleToggleModelGuidance() {
  state.modelGuidanceCollapsed = !state.modelGuidanceCollapsed;
  persistAndRender();
}

function handleChangePubMedResultLimit(value) {
  const parsed = Number(value);
  state.pubmedResultLimit = parsed > 0 ? parsed : 5;
  persistAndRender();
}

function handleSearchChats(query) {
  state.boardSearchQuery = query;
  render();
  requestAnimationFrame(() => {
    const searchInput = document.querySelector('[data-action="search-chats"]');
    if (searchInput) {
      searchInput.focus();
      searchInput.selectionStart = searchInput.selectionEnd = searchInput.value.length;
    }
  });
}

function handleSaveSettings(formValues) {
  state.settings = {
    ...state.settings,
    openRouterKey: formValues.openRouterKey?.trim() || state.settings.openRouterKey || "",
    deepSeekKey: formValues.deepSeekKey?.trim() || state.settings.deepSeekKey || "",
    groqKey: formValues.groqKey?.trim() || state.settings.groqKey || "",
    geminiKey: formValues.geminiKey?.trim() || state.settings.geminiKey || "",
    e2bKey: formValues.e2bKey?.trim() || state.settings.e2bKey || "",
    tavilyKey: formValues.tavilyKey?.trim() || state.settings.tavilyKey || "",
    braveSearchKey: formValues.braveSearchKey?.trim() || state.settings.braveSearchKey || "",
    falKey: formValues.falKey?.trim() || state.settings.falKey || "",
    pixazoKey: formValues.pixazoKey?.trim() || state.settings.pixazoKey || "",
    imageProvider: formValues.imageProvider || state.settings.imageProvider || "pollinations",
    openAIKey: formValues.openAIKey?.trim() || state.settings.openAIKey || "",
    imageModel: formValues.imageModel?.trim() || getDefaultSettings().imageModel,
    imageSize: formValues.imageSize || state.settings.imageSize || "landscape_4_3",
    globalSystemPrompt: formValues.globalSystemPrompt?.toString().trim() || "",
    openRouterEnabled: formValues.openRouterEnabled === "on" || formValues.openRouterEnabled === true,
    deepSeekEnabled: formValues.deepSeekEnabled === "on" || formValues.deepSeekEnabled === true,
    groqEnabled: formValues.groqEnabled === "on" || formValues.groqEnabled === true,
    geminiEnabled: formValues.geminiEnabled === "on" || formValues.geminiEnabled === true,
    openAITranscribeModel: formValues.openAITranscribeModel?.trim() || getDefaultSettings().openAITranscribeModel,
    openAITtsModel: formValues.openAITtsModel?.trim() || getDefaultSettings().openAITtsModel,
    openAITtsVoice: formValues.openAITtsVoice?.trim() || getDefaultSettings().openAITtsVoice,
    usageLimits: {
      tavilyDailyLimit: Math.max(0, Number(formValues.tavilyDailyLimit) || 30),
      braveDailyLimit: Math.max(0, Number(formValues.braveDailyLimit) || 65),
      groqTranscriptionDailyLimit: Math.max(0, Number(formValues.groqTranscriptionDailyLimit) || 20),
      e2bDailyLimit: Math.max(0, Number(formValues.e2bDailyLimit) || 5),
      maxHistoryMessages: Math.max(4, Number(formValues.maxHistoryMessages) || 12),
      tokenWarningLimit: Math.max(0, Number(formValues.tokenWarningLimit) || 12000),
    },
    emailJSMarcoServiceId: formValues.emailJSMarcoServiceId?.trim() || "",
    emailJSMarcoTemplateId: formValues.emailJSMarcoTemplateId?.trim() || "",
    emailJSMarcoPublicKey: formValues.emailJSMarcoPublicKey?.trim() || "",
    emailJSAlessandraServiceId: formValues.emailJSAlessandraServiceId?.trim() || "",
    emailJSAlessandraTemplateId: formValues.emailJSAlessandraTemplateId?.trim() || "",
    emailJSAlessandraPublicKey: formValues.emailJSAlessandraPublicKey?.trim() || "",
    evolutionInstanceUrl: formValues.evolutionInstanceUrl?.trim() || "",
    evolutionApiKey: formValues.evolutionApiKey?.trim() || "",
    evolutionInstanceName: formValues.evolutionInstanceName?.trim() || "",
  };

  saveSettings(state.settings);
  state.settingsFallbacks = [];
  state.modals.settings = false;
  showToast("Configurações salvas no navegador.", "success");
  persistAndRender();
}

async function handleSendEmailNow({ toEmail, toName, subject, message, sender }) {
  try {
    await sendEmail({ toEmail, toName, subject, message, sender, settings: state.settings });
    await addEmailRecord({ to: toEmail, toName: toName || "", subject: subject || "", body: message, status: "sent" });
    state.emailHistory = await loadEmailHistory();
    showToast(`Email enviado para ${toEmail}.`, "success");
    state.modals.emailCompose = false;
    persistAndRender();
  } catch (error) {
    showToast(error.message || "Erro ao enviar email.", "error");
  }
}

async function handleSendWhatsAppNow({ number, text }) {
  try {
    await sendWhatsApp({ number, text, settings: state.settings });
    await addWhatsAppRecord({ to: number, toName: "", message: text, status: "sent" });
    state.whatsappHistory = await loadWhatsAppHistory();
    showToast(`WhatsApp enviado para ${number}.`, "success");
    state.modals.whatsappCompose = false;
    persistAndRender();
  } catch (error) {
    showToast(error.message || "Erro ao enviar WhatsApp.", "error");
  }
}

function handleOpenEmailCompose(contact) {
  state.modalPayload = { contact: contact || null };
  setModal("emailCompose", true);
}

function handleOpenWhatsAppCompose(contact) {
  state.modalPayload = { contact: contact || null };
  setModal("whatsappCompose", true);
}

function handleOpenBrandModal(brandId = "") {
  const brand = state.brands.find((item) => item.id === brandId) || null;
  setModal("brandForm", true, { brand });
}

function handleSaveBrand(formValues) {
  const payload = {
    name: formValues.name?.toString() || "",
    primaryColor: formValues.primaryColor?.toString() || "#1D4ED8",
    secondaryColor: formValues.secondaryColor?.toString() || "#0F172A",
    logoUrl: formValues.logoUrl?.toString() || "",
    templateStyle: formValues.templateStyle?.toString() || "",
    templateNotes: formValues.templateNotes?.toString() || "",
    templates: state.modalPayload.brand?.templates || [],
    defaultTemplateId: state.modalPayload.brand?.defaultTemplateId || "",
  };

  if (!payload.name.trim()) {
    showToast("Preencha o nome da marca.", "error");
    return;
  }

  let brand;
  try {
    if (formValues.id) {
      brand = updateBrand(formValues.id.toString(), payload);
      showToast("Marca atualizada.", "success");
    } else {
      brand = createBrand(payload);
      showToast("Marca criada.", "success");
    }
  } catch (error) {
    showToast(error.message || "Nao foi possivel salvar a marca.", "error");
    return;
  }

  state.brands = loadBrands();
  state.selectedBrandId = brand.id;
  state.selectedTemplateId = brand.defaultTemplateId || "";
  state.modals.brandForm = false;
  state.modalPayload = {};
  persistAndRender();
}

function handleDeleteBrand(brandId) {
  if (!window.confirm("Excluir esta marca?")) {
    return;
  }

  try {
    deleteBrand(brandId);
    state.brands = loadBrands();
    if (state.selectedBrandId === brandId) {
      state.selectedBrandId = state.brands[0]?.id || "";
      state.selectedTemplateId = state.brands[0]?.defaultTemplateId || "";
    }
    if (state.modalPayload.brand?.id === brandId) {
      state.modalPayload = {};
      state.modals.brandForm = false;
    }
    showToast("Marca removida.", "success");
    persistAndRender();
  } catch (error) {
    showToast(error.message || "Nao foi possivel excluir a marca.", "error");
  }
}

function handleSaveAgent(formValues) {
  const payload = {
    name: formValues.name?.toString() || "",
    emoji: formValues.emoji?.toString() || "✨",
    description: formValues.description?.toString() || "",
    systemPrompt: formValues.systemPrompt?.toString() || "",
    modelOverrideEnabled: formValues.modelOverrideEnabled === "on",
    textProvider: formValues.textProvider?.toString() || "",
    textModel: formValues.textModel?.toString() || "",
    deepSeekModel: formValues.deepSeekModel?.toString() || "",
    groqModel: formValues.groqModel?.toString() || "",
    geminiModel: formValues.geminiModel?.toString() || "",
    defaultImageMode: formValues.defaultImageMode?.toString() || "inherit",
    defaultWebSearchMode: formValues.defaultWebSearchMode?.toString() || "inherit",
    defaultPubmedMode: formValues.defaultPubmedMode?.toString() || "inherit",
    responseStyle: formValues.responseStyle?.toString() || "",
  };

  if (!payload.name.trim() || !payload.description.trim() || !payload.systemPrompt.trim()) {
    showToast("Preencha nome, descrição e system prompt.", "error");
    return;
  }

  let agent;
  try {
    if (formValues.id) {
      agent = updateAgent(formValues.id.toString(), payload);
      showToast("Agente atualizado.", "success");
    } else {
      agent = createAgent(payload);
      showToast("Agente criado.", "success");
    }
  } catch (error) {
    showToast(error.message || "Não foi possível salvar o agente.", "error");
    return;
  }

  state.modals.agentForm = false;
  state.activeAgentId = agent.id;

  const existingChat = getChatsByAgent(agent.id)[0];
  if (existingChat) {
    state.activeChatId = existingChat.id;
  } else {
    const chat = createChat(agent.id);
    state.chats = loadChats();
    state.chats.push(chat);
    saveChats(state.chats);
    state.activeChatId = chat.id;
  }

  persistAndRender();
}

function handleDuplicateAgent(agentId) {
  try {
    const agent = duplicateAgent(agentId);
    state.agents = loadAgents();
    state.activeAgentId = agent.id;
    state.modals.agentForm = true;
    state.modalPayload = { agent };
    showToast("Agente duplicado.", "success");
    persistAndRender();
  } catch (error) {
    showToast(error.message || "Não foi possível duplicar o agente.", "error");
  }
}

function handleRestoreDefaultAgents() {
  if (!window.confirm("Restaurar os agentes padrão? Seus agentes customizados serão preservados.")) {
    return;
  }

  state.agents = restoreDefaultAgents();
  const activeStillExists = state.agents.some((agent) => agent.id === state.activeAgentId);
  if (!activeStillExists) {
    state.activeAgentId = state.agents[0]?.id || null;
  }
  showToast("Agentes padrão restaurados.", "success");
  persistAndRender();
}

function handleDeleteAgent(agentId) {
  if (!window.confirm("Excluir este agente? As conversas ligadas a ele também serão removidas.")) {
    return;
  }

  try {
    deleteAgent(agentId);
    state.chats = loadChats().filter((chat) => chat.agentId !== agentId);
    if (!state.chats.length) {
      const fallbackAgentId = loadAgents()[0]?.id;
      state.chats = fallbackAgentId ? [createChat(fallbackAgentId)] : [];
    }
    saveChats(state.chats);
    state.agents = loadAgents();
    state.activeAgentId = state.agents[0]?.id || null;
    state.activeChatId = state.chats.find((chat) => chat.agentId === state.activeAgentId)?.id || state.chats[0]?.id || null;
    if (state.modalPayload.agent?.id === agentId) {
      state.modalPayload = {};
    }
    syncActivePointers();
    showToast("Agente removido.", "success");
    persistAndRender();
  } catch (error) {
    showToast(error.message || "Não foi possível excluir o agente.", "error");
  }
}

function handleEditAgent(agentId) {
  const agent = state.agents.find((item) => item.id === agentId);
  if (!agent) {
    return;
  }

  setModal("agentForm", true, { agent });
}

async function handleAttachFiles(fileList) {
  try {
    state.pendingAttachmentContext = await processFiles(fileList);
    showToast("Arquivos preparados para o próximo envio.", "success");
    persistAndRender();
  } catch (error) {
    showToast(error.message || "Falha ao processar arquivos.", "error");
  }
}

function handleCopyMessage(messageId) {
  const chat = getActiveChat();
  const message = chat?.messages?.find((item) => item.id === messageId);
  if (!message) {
    return;
  }

  const text = message.content;
  navigator.clipboard.writeText(text).then(() => {
    showToast("Texto copiado para a área de transferência.", "success");
  }).catch(() => {
    showToast("Não foi possível copiar o texto.", "error");
  });
}

function handleCreativeFieldChange(field, value) {
  state.creativeFormDraft = {
    ...state.creativeFormDraft,
    [field]: value,
  };
  saveViewState();
}

function handleSelectBrand(brandId) {
  state.selectedBrandId = brandId;
  const brand = state.brands.find((item) => item.id === brandId) || null;
  state.selectedTemplateId = brand?.defaultTemplateId || "";
  saveViewState();
  render();
}

function handleSelectInstagramFormat(formatId) {
  state.instagramFormat = formatId;
  saveViewState();
  render();
}

function applyTemplateToDraft(template) {
  if (!template) {
    return;
  }

  state.selectedTemplateId = template.id;
  state.instagramFormat = template.formatId || state.instagramFormat;
  state.creativeFormDraft = {
    ...state.creativeFormDraft,
    objective: template.objective || "",
    audience: template.audience || "",
    headline: template.headline || "",
    supportingText: template.supportingText || "",
    cta: template.cta || "",
    variationCount: String(template.variationCount || 1),
  };
}

function handleSelectBrandTemplate(templateId) {
  const brand = getSelectedBrand();
  const template = brand?.templates?.find((item) => item.id === templateId) || null;
  if (!template) {
    state.selectedTemplateId = "";
    saveViewState();
    render();
    return;
  }

  applyTemplateToDraft(template);
  saveViewState();
  render();
}

function handleSaveCurrentAsTemplate() {
  const brand = getSelectedBrand();
  if (!brand) {
    showToast("Selecione uma marca antes de salvar um template.", "error");
    return;
  }

  const templateName = window.prompt("Nome do template:", `${brand.name} · ${getInstagramFormatById(state.instagramFormat).label}`);
  if (!templateName || !templateName.trim()) {
    return;
  }

  const nextTemplates = [
    ...(brand.templates || []),
    {
      id: `template-${crypto.randomUUID()}`,
      name: templateName.trim(),
      formatId: state.instagramFormat,
      objective: state.creativeFormDraft.objective || "",
      audience: state.creativeFormDraft.audience || "",
      headline: state.creativeFormDraft.headline || "",
      supportingText: state.creativeFormDraft.supportingText || "",
      cta: state.creativeFormDraft.cta || "",
      variationCount: Number(state.creativeFormDraft.variationCount) || 1,
      createdAt: new Date().toISOString(),
    },
  ];

  const updatedBrand = updateBrand(brand.id, {
    templates: nextTemplates,
    defaultTemplateId: nextTemplates[nextTemplates.length - 1].id,
  });
  state.brands = loadBrands();
  state.selectedTemplateId = updatedBrand.defaultTemplateId || "";
  showToast("Template salvo para esta marca.", "success");
  persistAndRender();
}

function handleDeleteBrandTemplate(templateId) {
  const brand = getSelectedBrand();
  if (!brand) {
    return;
  }

  if (!window.confirm("Excluir este template da marca?")) {
    return;
  }

  const nextTemplates = (brand.templates || []).filter((template) => template.id !== templateId);
  const updatedBrand = updateBrand(brand.id, {
    templates: nextTemplates,
    defaultTemplateId: nextTemplates[0]?.id || "",
  });
  state.brands = loadBrands();
  state.selectedTemplateId = updatedBrand.defaultTemplateId || "";
  showToast("Template removido.", "success");
  persistAndRender();
}

function handleBrandLogoUpload(file) {
  const reader = new FileReader();
  reader.onload = () => {
    const value = typeof reader.result === "string" ? reader.result : "";
    const input = document.querySelector('input[name="logoUrl"]');
    if (input) {
      input.value = value;
    }
    const preview = document.getElementById("brand-logo-preview");
    if (preview instanceof HTMLImageElement) {
      preview.src = value;
      preview.classList.remove("hidden");
    }
  };
  reader.readAsDataURL(file);
}

const voiceController = createVoiceController({
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
  getSettings: () => state.settings,
});

const MAX_CHATS = 50;
const MAX_MESSAGES_PER_CHAT = 200;

async function pruneStorage() {
  let changed = false;

  // Poda de mensagens por conversa
  for (const chat of state.chats) {
    if (chat.messages && chat.messages.length > MAX_MESSAGES_PER_CHAT) {
      const excess = chat.messages.length - MAX_MESSAGES_PER_CHAT;
      chat.messages = chat.messages.slice(excess);
      changed = true;
    }
  }

  // Poda de conversas (mantem fixadas, arquiva antes de remover)
  if (state.chats.length > MAX_CHATS) {
    const sorted = [...state.chats].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return new Date(a.updatedAt) - new Date(b.updatedAt);
    });
    const toArchive = sorted.slice(0, state.chats.length - MAX_CHATS);
    if (toArchive.length > 0) {
      try {
        await archiveConversations(toArchive);
      } catch (err) {
        console.error("[FEMIC GPT] Erro ao arquivar conversas:", err);
      }
      const removedIds = new Set(toArchive.map((c) => c.id));
      state.chats = state.chats.filter((c) => !removedIds.has(c.id));
      changed = true;
      showToast(`${toArchive.length} conversa(s) antiga(s) arquivada(s) automaticamente.`, "info");
    }
  }

  if (changed) {
    saveChats(state.chats);
  }
}

function initialize() {
  try {
    ensureSeedData();
    syncActivePointers();
    voiceController.syncSpeechVoice();
    initLightbox();
    pruneStorage().catch((err) => console.error("[FEMIC GPT] Erro na poda:", err));
  } catch (error) {
    console.error("[FEMIC GPT] Erro na inicializacao:", error);
  }

  try {
    const savedDraft = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (savedDraft) state.draftMessage = savedDraft;
  } catch {}

  bindUIHandlers({
    onSelectAgent: handleSelectAgent,
    onDeleteAgent: handleDeleteAgent,
    onEditAgent: handleEditAgent,
    onSelectChat: handleSelectChat,
    onDeleteChat: handleDeleteChat,
    onArchiveChat: handleArchiveChat,
    onCreateChat: handleCreateChat,
    onOpenSettings: () => {
      setModal("settings", true);
    },
    onOpenHelp: () => setModal("help", true),
    onOpenMemory: () => setModal("memory", true),
    onApplyGlobalPromptTemplate: () => {
      const template = `## IDENTIDADE E COMPORTAMENTO
Voce e o FEMIC GPT, um assistente de IA profissional, eficiente e objetivo. Responda SEMPRE em português do Brasil. Seja claro, direto e util. Evite respostas longas desnecessarias. Quando a tarefa pedir profundidade, sim. Para perguntas simples, seja conciso.

## REGRAS GERAIS
1. Responda em portugues do Brasil, exceto se o usuario pedir outro idioma
2. Seja profissional mas acessivel
3. Quando nao souber a resposta, diga honestamente
4. Use formatacao (listas, negrito, titulos) para organizar informacoes
5. Quando o usuario pedir para "enviar", "mandar" ou "disparar", isso significa ACAO via blocos abaixo

## MEMORIA
O sistema mantem memoria persistente sobre voce. Use os fatos conhecidos para personalizar respostas sem precisar perguntar novamente.

## OTIMIZACAO DE RESPOSTAS
- Perguntas simples: resposta direta em 1-3 linhas
- Analises: use estrutura com topicos e subtopicos
- Codigo: sempre em blocos de codigo com linguagem identificada
- Listas: use marcadores ou numeracao
- Email formal: estrutura com saudacao, corpo, despedida

## FUNCOES DE COMUNICACAO

Voce pode enviar emails e mensagens WhatsApp diretamente pelo chat. Quando o usuario pedir para enviar um email ou WhatsApp, use os blocos de acao abaixo.

### REGRAS DE ENVIO
- Cada pedido de envio e um email/WhatsApp NOVO e DIFERENTE
- NAO reenvie emails ou mensagens anteriores
- Sempre baseie o conteudo no pedido ATUAL do usuario
- Se o usuario pedir "envie outro email", isso significa um email NOVO com conteudo NOVO
- NAO repita conteudos de emails enviados anteriormente na conversa
- Se so pediu para redigir (nao enviar), NAO use o bloco, apenas apresente o texto

### ENVIO DE EMAIL

Quando o usuario pedir para ENVIAR um email, responda EXATAMENTE neste formato:

[ENVIAR_EMAIL]
Para: email@exemplo.com
Nome: Nome do Destinatario
Assunto: Assunto do Email
Remetente: marco
[/ENVIAR_EMAIL]

(texto do email aqui)

- Remetente deve ser "marco" ou "alessandra"
- Se o usuario nao informar o remetente, pergunte quem deve enviar

Exemplo:
Usuario: "Envie um email para joao@exemplo.com dizendo que a reuniao e amanha as 14h"
Voce:
[ENVIAR_EMAIL]
Para: joao@exemplo.com
Nome: Joao
Assunto: Reuniao Amanha
Remetente: marco
[/ENVIAR_EMAIL]

Ola Joao,

Gostaria de informar que a reuniao esta marcada para amanha as 14h.

Atenciosamente,
Marco

### ENVIO DE WHATSAPP

Quando o usuario pedir para ENVIAR uma mensagem WhatsApp, responda EXATAMENTE neste formato:

[ENVIAR_WHATSAPP]
Numero: 5511999999999
[/ENVIAR_WHATSAPP]

(texto da mensagem aqui)

- O numero deve conter codigo do pais (ex: 55 para Brasil)
- Se o usuario nao informar o codigo do pais, pergunte
- Mensagens WhatsApp devem ser claras e diretas
- Cada mensagem e NOVA, nao repita mensagens anteriores

Exemplo:
Usuario: "Envie um WhatsApp para 11999998888 dizendo que estou a caminho"
Voce:
[ENVIAR_WHATSAPP]
Numero: 5511999998888
[/ENVIAR_WHATSAPP]

Ola! Estou a caminho. Chego em instantes.`;
      const textarea = document.querySelector('textarea[name="globalSystemPrompt"]');
      if (textarea) {
        textarea.value = template;
        textarea.dispatchEvent(new Event("input", { bubbles: true }));
      }
      showToast("Prompt de exemplo aplicado. Clique em Salvar para gravar.", "success");
    },
    onOpenAgentModal: () => setModal("agentForm", true),
    onOpenBrandModal: handleOpenBrandModal,
    onCloseModal: (name) => setModal(name, false),
    onToggleImageMode: () => {
      if (isInstagramAgent(state.activeAgentId)) {
        return;
      }
      state.imageMode = !state.imageMode;
      persistAndRender();
    },
    onToggleVoice: () => voiceController.toggleInput(),
    onSpeakMessage: (messageId) => voiceController.speakMessage(messageId),
    onCopyMessage: handleCopyMessage,
    onAttachFiles: handleAttachFiles,
    onSetChatCategory: handleSetChatCategory,
    onSetMessageCategory: handleSetMessageCategory,
    onRenameChat: handleRenameChat,
    onExportChatPDF: async () => {
      const chat = getActiveChat();
      if (!chat || chat.messages.length === 0) {
        showToast("A conversa esta vazia.", "info");
        return;
      }
      try {
        await exportChatAsPDF(chat.messages, chat.title);
        showToast("PDF exportado com sucesso.", "success");
      } catch (error) {
        showToast(error.message || "Erro ao exportar PDF.", "error");
      }
    },
    onClearChat: () => {
      const chat = getActiveChat();
      if (!chat || chat.messages.length === 0) {
        showToast("A conversa ja esta vazia.", "info");
        return;
      }
      chat.messages = [];
      chat.titleMode = "auto";
      saveChats(state.chats);
      persistAndRender();
      showToast("Historico da conversa limpo.", "success");
    },
    onToggleCategoryPicker: handleToggleCategoryPicker,
    onToggleMessageCategoryPicker: handleToggleMessageCategoryPicker,
    onFilterByCategory: handleFilterByCategory,
    onToggleBoardView: handleToggleBoardView,
    onSearchChats: handleSearchChats,
    onTogglePubMedMode: handleTogglePubMedMode,
    onToggleCreativeBrief: () => {
      state.creativeBriefCollapsed = !state.creativeBriefCollapsed;
      render();
    },
    onToggleWebSearchMode: handleToggleWebSearchMode,
    onToggleSmartMode: handleToggleSmartMode,
    onToggleThinkingMode: handleToggleThinkingMode,
    onTogglePinChat: handleTogglePinChat,
    onToggleShowArchived: handleToggleShowArchived,
    onRestoreArchived: handleRestoreArchived,
    onDeleteArchived: handleDeleteArchived,
    onToggleModelGuidance: handleToggleModelGuidance,
    onToggleAgentSummary: () => {
      state.agentSummaryCollapsed = !state.agentSummaryCollapsed;
      persistAndRender();
    },
    onChangePubMedResultLimit: handleChangePubMedResultLimit,
    onClearAttachments: () => {
      resetAttachments();
      persistAndRender();
    },
    onSendMessage: handleSendMessage,
    onSaveSettings: handleSaveSettings,
    onSaveChatRename: handleSaveChatRename,
    onSaveAgent: handleSaveAgent,
    onDuplicateAgent: handleDuplicateAgent,
    onRestoreDefaultAgents: handleRestoreDefaultAgents,
    onSaveBrand: handleSaveBrand,
    onDeleteBrand: handleDeleteBrand,
    onQuickModelChange: handleQuickModelChange,
    onChangeImageSize: handleChangeImageSize,
    onCreativeFieldChange: handleCreativeFieldChange,
    onSelectBrand: handleSelectBrand,
    onSelectInstagramFormat: handleSelectInstagramFormat,
    onSelectBrandTemplate: handleSelectBrandTemplate,
    onSaveCurrentAsTemplate: handleSaveCurrentAsTemplate,
    onDeleteBrandTemplate: handleDeleteBrandTemplate,
    onBrandLogoUpload: handleBrandLogoUpload,
    onDraftChange: (value) => {
      state.draftMessage = value;
      clearTimeout(draftSaveTimer);
      draftSaveTimer = setTimeout(() => {
        try { localStorage.setItem(DRAFT_STORAGE_KEY, value); } catch {}
      }, 500);
    },
    onToggleSidebar: () => {
      state.mobileSidebarOpen = !state.mobileSidebarOpen;
      render();
    },
    onToggleSidebarCollapse: () => {
      state.sidebarCollapsed = !state.sidebarCollapsed;
      persistAndRender();
    },
    onRemoveMemoryFact: (factId) => {
      removeMemoryFact(factId);
      showToast("Fato removido da memoria.", "success");
      persistAndRender();
    },
    onExportData: () => {
      const backup = buildBackupPayload(localStorage);

      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `femicgpt-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast("Backup exportado com sucesso.", "success");
    },
    onImportData: async (file) => {
      try {
        if (!window.confirm("Importar dados substituirá todas as conversas, agentes e configurações atuais. Continuar?")) {
          return;
        }

        const text = await file.text();
        const backup = parseBackupPayload(text);

        applyParsedBackup(localStorage, backup);

        resetTransientState();
        hydratePersistentState();
        state.settings = loadImportedSettings(
          readStorageJson(localStorage, STORAGE_KEYS.settings, {}),
        );
        state.brands = loadBrands();
        showToast("Dados importados com sucesso.", "success");
        persistAndRender();
        if (state.settingsFallbacks.length) {
          state.settingsFallbacks.forEach((fallback) => {
            showToast(
              `Modelo salvo da ${getTextProviderDisplayName(fallback.provider)} ficou indisponível. Usei ${fallback.nextValue} automaticamente.`,
              "info",
            );
          });
          state.settingsFallbacks = [];
        }
      } catch (error) {
        showToast(buildUserErrorMessage(error, "Falha ao importar: arquivo inválido."), "error");
      }
    },
    onFetchOpenRouterModels: async () => {
      const key = state.settings.openRouterKey;
      if (!key) {
        showToast("Adicione a chave da OpenRouter primeiro.", "error");
        return;
      }
      showToast("Buscando modelos...", "info");
      try {
        const models = await fetchOpenRouterModels(key);
        state.openRouterAvailableModels = models;
        persistAndRender();
        showToast(`${models.length} modelos encontrados.`, "success");
      } catch (err) {
        showToast(buildUserErrorMessage(err, "Falha ao buscar modelos."), "error");
      }
    },
    onToggleOpenRouterModel: (modelId) => {
      const current = state.settings.openRouterSelectedModels || [];
      const next = current.includes(modelId)
        ? current.filter((id) => id !== modelId)
        : [...current, modelId];
      state.settings = { ...state.settings, openRouterSelectedModels: next };
      saveSettings(state.settings);
      persistAndRender();
    },
    onOpenEmailCompose: handleOpenEmailCompose,
    onSendEmailNow: handleSendEmailNow,
    onOpenWhatsAppCompose: handleOpenWhatsAppCompose,
    onSendWhatsAppNow: handleSendWhatsAppNow,
  });

  document.addEventListener("click", (event) => {
    if (state.pendingChatCategoryPicker && !event.target.closest("[data-action='toggle-category-picker'], [data-action='set-chat-category'], .category-picker")) {
      state.pendingChatCategoryPicker = null;
      render();
    }
    if (state.pendingMessageCategoryPicker && !event.target.closest("[data-action='toggle-message-category-picker'], [data-action='set-message-category'], .category-picker")) {
      state.pendingMessageCategoryPicker = null;
      render();
    }
  });

  window.addEventListener("beforeunload", () => {
    voiceController.stopSpeaking();
    voiceController.stopInput();
  });

  render();

  if (state.settingsFallbacks.length) {
    state.settingsFallbacks.forEach((fallback) => {
      showToast(
        `Modelo salvo da ${getTextProviderDisplayName(fallback.provider)} ficou indisponível. Usei ${fallback.nextValue} automaticamente.`,
        "info",
      );
    });
    state.settingsFallbacks = [];
  }
}

initialize();
