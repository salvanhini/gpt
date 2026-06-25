import {
  BRASIL_AGENT_ID,
  createAgent,
  deleteAgent,
  duplicateAgent,
  getEffectiveAgentSettings,
  getDefaultAgents,
  loadAgents,
  restoreDefaultAgents,
  SCIENCE_AGENT_ID,
  IMAGE_PROMPTER_ID,
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
  addChatAttachments,
  clearChatAttachments,
  createChat,
  getChatsByAgent,
  loadChats,
  removeChatAttachment,
  saveChats,
  updateChatCategory,
  updateMessageCategory,
  updateChatTitle,
  updateMessageContent,
} from "./chat.js";
import {
  fetchOpenRouterModels,
  generateImage,
  getDefaultSettings,
  getTextProviderDisplayName,
  GEMINI_MODELS,
  GROQ_MODELS,
  FAL_IMAGE_MODELS,
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
import { processFiles, buildCombinedContext } from "./fileProcessor.js";
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
  buildBackupPayloadWithSecrets,
  decryptBackupSecrets,
  parseBackupPayload,
  readStorageJson,
  reconcileAppData,
  STORAGE_KEYS,
  writeStorageJson,
  normalizeSettingsWithFallback,
} from "./storage.js";
import { bindUIHandlers, renderApp, showToast, initLightbox, mountPendingCharts } from "./ui.js";
import { createVoiceController } from "./voiceController.js";
import { incrementUsage } from "./usageTracker.js";
import { trackCost, getDailyCost, getMonthlyCost } from "./costTracker.js";
import { addMemoryFact, getMemoryFacts, removeMemoryFact, buildMemoryContext, autoExtractAndStore, getLongTermSummary, generateLongTermSummary, shouldGenerateSummary } from "./memory.js";
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
import { gerarRelatorioPremium, gerarPDFFromContent, exportChatAsPremiumPDF, exportMessageAsPremiumPDF } from "./reportGenerator.js";
import {
  exportChatAsDOCX,
  exportChatAsCSV,
  exportChatAsJSON,
  exportChatAsExcel,
  exportChatAsPowerPoint,
  exportChatAsWord,
  exportTasksAsDOCX,
  exportTasksAsCSV,
  exportTasksAsExcel,
  exportMessageAsDOCX,
} from "./exportManager.js";
import { initTaskSystem, getPendingTasks, getTasksByType, addTask, completeTask, deleteTask, parseTaskCommand, checkOverdueTasks } from "./taskSystem.js";
import {
  getSupabaseUser,
  isSupabaseConfigured,
  restoreFromSupabaseIfEmpty,
  initSupabase,
  bootstrapSupabase,
  signInSupabaseWithOtp,
  signOutSupabase,
} from "./supabaseSync.js";

const DRAFT_STORAGE_KEY = "femicgpt:draft";
const IMAGE_PROVIDER_LABELS = { "fal-ai": "fal.ai", pixazo: "Pixazo.ai", wavespeed: "WaveSpeed.ai", pollinations: "Pollinations.ai" };
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
  smartMode: true,
  pubmedResultLimit: 5,
  webSearchMode: false,
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
    tasks: false,
  },
  modalPayload: {},
  draftMessage: "",
  mobileSidebarOpen: false,
  sidebarCollapsed: false,
  archivedChats: [],
  tasks: [],
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
  groqModelOptions: GROQ_MODELS,
  geminiModelOptions: GEMINI_MODELS,
  openRouterAvailableModels: [],
  imageSizeOptions: IMAGE_SIZE_OPTIONS,
  imageProviderOptions: IMAGE_PROVIDER_OPTIONS,
  falImageModelOptions: FAL_IMAGE_MODELS,
  instagramFormats: INSTAGRAM_FORMATS,
  supabaseUser: null,
};

function loadSettings() {
  const raw = readStorageJson(localStorage, STORAGE_KEYS.settings, {});
  const normalized = normalizeSettingsWithFallback(
    raw,
    getDefaultSettings(),
    OPENROUTER_MODELS,
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

async function generateFileFromContent(format, fileName, content) {
  const safeFileName = fileName.replace(/[^a-zA-Z0-9_-]/g, "_").substring(0, 100);

  if (format === "pdf") {
    return await gerarPDFFromContent(content, fileName);
  }

  if (format === "xlsx") {
    const singleMsg = [{ role: "assistant", content, createdAt: new Date().toISOString() }];
    await exportChatAsExcel(singleMsg, fileName);
    return { fileName: `${safeFileName}.xlsx`, blobUrl: null, directDownload: true };
  }

  if (format === "csv") {
    const singleMsg = [{ role: "assistant", content, createdAt: new Date().toISOString() }];
    exportChatAsCSV(singleMsg, fileName);
    return { fileName: `${safeFileName}.csv`, blobUrl: null, directDownload: true };
  }

  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const blobUrl = URL.createObjectURL(blob);
  return { fileName: `${safeFileName}.txt`, blobUrl };
}

function updateMessageMeta(chatId, messageId, metaUpdate) {
  const chats = loadChats();
  const chat = chats.find((c) => c.id === chatId);
  if (!chat) return;
  const message = chat.messages.find((m) => m.id === messageId);
  if (!message) return;
  Object.assign(message.meta, metaUpdate);
  chat.updatedAt = new Date().toISOString();
  saveChats(chats);
}

let pesquisaCheckInterval = null;

async function checkAndAutoExecutePesquisa() {
  try {
    state.tasks = await getPendingTasks();
    const pesquisaOverdue = (await getTasksByType("pesquisa").catch(() => []))
      .filter((t) => new Date(t.dataExecucao) <= new Date());
    for (const task of pesquisaOverdue) {
      await completeTask(task.id);
      state.webSearchMode = true;
      showToast(`🔍 Pesquisa automatica: "${task.texto.slice(0, 50)}"`, "info");
      await handleSendMessage(task.texto);
      state.webSearchMode = false;
    }
    state.tasks = await getPendingTasks();
    persistAndRender();
  } catch {}
}

function startPesquisaWatcher() {
  if (pesquisaCheckInterval) clearInterval(pesquisaCheckInterval);
  pesquisaCheckInterval = setInterval(checkAndAutoExecutePesquisa, 3600000);
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

function getActiveChatAttachments() {
  return getActiveChat()?.attachments || [];
}

function getActiveAttachmentContext() {
  const files = getActiveChatAttachments();
  return {
    files,
    combinedContext: buildCombinedContext(files),
  };
}

function syncPendingAttachmentContext() {
  const context = getActiveAttachmentContext();
  state.pendingAttachmentContext = context.files.length ? context : null;
  return state.pendingAttachmentContext;
}

function applyAgentModeDefaults(agentId) {
  const agent = state.agents.find((item) => item.id === agentId);
  if (!agent) {
    return;
  }

  if (!isInstagramAgent(agentId)) {
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
  syncPendingAttachmentContext();
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
    state.recommendedModel = getRecommendedModelForContext();
    state.recommendedModelActive = isRecommendedModelActive(state.recommendedModel);
    state.dailyCost = getDailyCost();
    state.monthlyCost = getMonthlyCost();
    state.memoryFacts = getMemoryFacts();
    renderApp(state);
    if (typeof mountPendingCharts === "function") mountPendingCharts();
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
  const WINDOW_SIZE = 10;

  const mapear = (msg) => ({
    role: msg.role,
    content:
      msg.meta?.kind === "image"
        ? `[imagem gerada anteriormente]\nPrompt: ${msg.content}\nURL: ${msg.meta.imageUrl}`
        : msg.content,
  });

  if (messages.length <= WINDOW_SIZE) {
    return messages.map(mapear);
  }

  const recentMessages = messages.slice(-WINDOW_SIZE);
  const longTermSummary = getLongTermSummary();

  if (longTermSummary) {
    return [
      { role: "system", content: `Resumo de longo prazo da conversa:\n${longTermSummary}` },
      ...recentMessages.map(mapear),
    ];
  }

  const oldMessages = messages.slice(0, -WINDOW_SIZE);
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

function isDocumentFocusedMessage(message = "") {
  return /\b(pdf|anexo|arquivo|documento|artigo|resum|sintetiz|extraia|leia|ebook|paper)\b/i.test(message);
}

function getHistoryForPayload(activeChat, userMessage) {
  const messages = activeChat?.messages || [];
  if (!activeChat?.documentContextUpdatedAt || !isDocumentFocusedMessage(userMessage)) {
    return messages;
  }
  const updatedAt = new Date(activeChat.documentContextUpdatedAt).getTime();
  return messages.filter((message) => {
    const createdAt = new Date(message.createdAt || 0).getTime();
    return Number.isFinite(createdAt) && createdAt >= updatedAt;
  });
}

function getAttachmentVisualPages(files = []) {
  return files.flatMap((file) => {
    const visualPages = Array.isArray(file.visualPages) ? file.visualPages : [];
    return visualPages
      .filter((page) => page.dataUrl)
      .map((page) => ({
        dataUrl: page.dataUrl,
        name: `${file.name || "PDF"} - pagina ${page.pageNumber || ""}`.trim(),
      }));
  });
}

function hasAttachmentVisualPages(files = getActiveChatAttachments()) {
  return getAttachmentVisualPages(files).length > 0;
}

function asksForActiveDocument(message = "") {
  return /\b(pdf|anexo|arquivo|documento|artigo|ebook|paper)\b/i.test(message)
    && /\b(resum|sintetiz|leia|ler|analise|extraia|explique)\b/i.test(message);
}

function asksForDocumentAction(message = "") {
  return /\b(resum|sintetiz|leia|ler|analise|analisar|extraia|extrair|explique|fichamento|pontos principais|principais pontos|sumari|tabela|compare|comparar)\b/i.test(message);
}

function asksForExplicitWebSearch(message = "") {
  return /\b(busca web|web search|internet|online|google|noticia|noticias|notícias|atualizado|atualizada|hoje|agora|tempo real|sites externos|fontes externas)\b/i.test(message);
}

function shouldPrioritizeActiveDocuments(message = "", files = getActiveChatAttachments()) {
  return files.length > 0 && asksForDocumentAction(message) && !asksForExplicitWebSearch(message);
}

function getSettingsForVisualDocuments(baseSettings = getActiveSettings()) {
  if (!hasAttachmentVisualPages()) return baseSettings;
  if (baseSettings.geminiKey) {
    return {
      ...baseSettings,
      textProvider: "gemini",
      geminiModel: baseSettings.geminiModel || "gemini-3.5-flash",
    };
  }
  if (baseSettings.openRouterKey) {
    return {
      ...baseSettings,
      textProvider: "openrouter",
      textModel: "qwen/qwen3.7-plus",
    };
  }
  return baseSettings;
}

function buildDocumentFocusContext(files = []) {
  if (!files.length) return "";
  return [
    "Documentos ativos nesta conversa:",
    ...files.map((file, index) => {
      const meta = file.documentMeta || {};
      const status = file.status || meta.extractionMethod || "lido";
      return `${index + 1}. ${file.name} (${String(file.type || "").toUpperCase()}) - status: ${status}; paginas: ${meta.pages || "n/d"}; leitura visual: ${meta.visualPagesRendered || 0} pagina(s).`;
    }),
    "",
    "Responda com base apenas nos documentos ativos acima e no conteudo fornecido agora. Ignore respostas antigas sobre arquivos removidos ou substituidos.",
  ].join("\n");
}

function buildTextPayload(userMessage) {
  const activeAgent = getActiveAgent();
  const activeChat = getActiveChat();
  const attachmentContext = getActiveAttachmentContext();
  const activeFiles = attachmentContext.files || [];
  const history = compactHistoryForPayload(getHistoryForPayload(activeChat, userMessage));
  const memoryContext = buildMemoryContext();
  const imageDataUrls = [
    ...activeFiles
      .filter((f) => f.imageDataUrl)
      .map((f) => ({ dataUrl: f.imageDataUrl, name: f.name })),
    ...getAttachmentVisualPages(activeFiles),
  ];
  const documentFocusContext = buildDocumentFocusContext(activeFiles);

  return buildChatMessages({
    globalSystemPrompt: state.settings.globalSystemPrompt || "",
    agentSystemPrompt: activeAgent?.systemPrompt || "",
    responseStyle: activeAgent?.responseStyle || "",
    history,
    attachmentContext: attachmentContext.combinedContext || "",
    referenceContext: [documentFocusContext, memoryContext].filter(Boolean).join("\n\n"),
    userMessage,
    imageDataUrls,
  });
}

function buildTextPayloadWithReference(userMessage, referenceContext) {
  const activeAgent = getActiveAgent();
  const activeChat = getActiveChat();
  const attachmentContext = getActiveAttachmentContext();
  const activeFiles = attachmentContext.files || [];
  const history = compactHistoryForPayload(getHistoryForPayload(activeChat, userMessage));
  const imageDataUrls = [
    ...activeFiles
      .filter((f) => f.imageDataUrl)
      .map((f) => ({ dataUrl: f.imageDataUrl, name: f.name })),
    ...getAttachmentVisualPages(activeFiles),
  ];
  const documentFocusContext = buildDocumentFocusContext(activeFiles);

  return buildChatMessages({
    globalSystemPrompt: state.settings.globalSystemPrompt || "",
    agentSystemPrompt: activeAgent?.systemPrompt || "",
    responseStyle: activeAgent?.responseStyle || "",
    history,
    attachmentContext: attachmentContext.combinedContext || "",
    referenceContext: [documentFocusContext, referenceContext].filter(Boolean).join("\n\n"),
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
  return provider !== "gemini";
}

function getRecommendedModelForContext() {
  const attachments = getActiveChatAttachments();
  const activeSettings = getActiveSettings();
  const hasManyDocuments = attachments.length >= 2;
  const hasDocuments = attachments.length > 0;
  const hasOpenRouter = Boolean(activeSettings.openRouterKey);
  const hasGroq = Boolean(activeSettings.groqKey);
  const hasGemini = Boolean(activeSettings.geminiKey);

  if (state.webSearchMode) {
    if (hasGroq) {
      return {
        provider: "groq",
        model: "openai/gpt-oss-120b",
        label: "Groq GPT OSS 120B",
        reason: hasDocuments ? "melhor para combinar pesquisa web com documentos" : "melhor para pesquisa web rápida",
      };
    }
    if (hasOpenRouter) {
      return {
        provider: "openrouter",
        model: "qwen/qwen3.7-plus",
        label: "Qwen 3.7 Plus",
        reason: "boa alternativa para pesquisa com contexto longo",
      };
    }
    if (hasGemini) {
      return {
        provider: "gemini",
        model: activeSettings.geminiModel || "gemini-3.5-flash",
        label: "Gemini 3.5 Flash",
        reason: "melhor opção configurada para documentos quando não há Groq/OpenRouter",
      };
    }
    return {
      provider: "openrouter",
      model: "qwen/qwen3.7-plus",
      label: "Qwen 3.7 Plus",
      reason: "recomendado para pesquisa com documentos; configure a chave OpenRouter para usar",
    };
  }

  if (hasManyDocuments) {
    if (hasOpenRouter) {
      return {
        provider: "openrouter",
        model: "qwen/qwen3.7-plus",
        label: "Qwen 3.7 Plus",
        reason: "melhor equilíbrio para vários artigos e custo controlado",
      };
    }
    if (hasGemini) {
      return {
        provider: "gemini",
        model: activeSettings.geminiModel || "gemini-3.5-flash",
        label: "Gemini 3.5 Flash",
        reason: "forte para leitura de vários documentos",
      };
    }
  }

  if (hasDocuments) {
    return hasOpenRouter
      ? {
          provider: "openrouter",
          model: "qwen/qwen3.7-plus",
          label: "Qwen 3.7 Plus",
          reason: "bom contexto para documentos anexados",
        }
      : hasGemini
        ? {
            provider: "gemini",
            model: activeSettings.geminiModel || "gemini-3.5-flash",
            label: "Gemini 3.5 Flash",
            reason: "forte para leitura de documentos",
          }
      : {
          provider: "openrouter",
          model: "qwen/qwen3.7-plus",
          label: "Qwen 3.7 Plus",
          reason: "recomendado para documentos; configure a chave OpenRouter para usar",
        };
  }

  if (hasGroq) {
    return {
      provider: "groq",
      model: "openai/gpt-oss-20b",
      label: "Groq GPT OSS 20B",
      reason: "rápido e econômico para perguntas simples",
    };
  }

  return {
    provider: "openrouter",
    model: "qwen/qwen3.5-flash-02-23",
    label: "Qwen 3.5 Flash",
    reason: "rápido e barato para respostas curtas",
  };
}

function isRecommendedModelActive(recommendation = getRecommendedModelForContext()) {
  const settings = getActiveSettings();
  if (recommendation.provider !== settings.textProvider) return false;
  if (recommendation.provider === "groq") return settings.groqModel === recommendation.model;
  if (recommendation.provider === "gemini") return settings.geminiModel === recommendation.model;
  return settings.textModel === recommendation.model;
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

  const taskMatch = parseTaskCommand(message);
  if (taskMatch) {
    try {
      await addTask(taskMatch.texto, taskMatch.recorrencia, taskMatch.tipo);
      const label = taskMatch.recorrencia === "unica" ? "unica" : taskMatch.recorrencia;
      const tipoLabel = taskMatch.tipo === "pesquisa" ? "🔍 pesquisa" : "lembrete";
      showToast(`Tarefa criada: "${taskMatch.texto.slice(0, 60)}" (${label}, ${tipoLabel})`, "success");
      state.tasks = await getPendingTasks();
      persistAndRender();
    } catch (e) {
      showToast("Erro ao criar tarefa.", "error");
    }
    return;
  }

  const activeChat = getActiveChat();
  if (!activeChat) {
    showToast("Nenhuma conversa ativa disponível.", "error");
    return;
  }

  const activeAttachmentsSnapshot = getActiveChatAttachments();
  const prioritizeActiveDocuments = shouldPrioritizeActiveDocuments(message, activeAttachmentsSnapshot);

  if (asksForActiveDocument(message) && activeAttachmentsSnapshot.length === 0) {
    addMessage(activeChat.id, {
      role: "user",
      content: message,
      meta: { kind: "text", attachments: [] },
    });
    addMessage(activeChat.id, {
      role: "assistant",
      content: "Não há documento ativo nesta conversa. Anexe o PDF ou artigo e peça o resumo novamente.",
      meta: {
        kind: "text",
        provider: "local",
        sourceType: "document-missing",
        failed: true,
      },
    });
    persistAndRender();
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
        attachments: activeAttachmentsSnapshot,
        instagramFormat: instagramPayload?.format.id || null,
        brandId: instagramPayload?.brand.id || null,
      },
    });

    state.draftMessage = "";
    try { localStorage.removeItem(DRAFT_STORAGE_KEY); } catch { console.warn("[FEMIC GPT] Erro ao limpar draft"); }
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
    if (state.activeAgentId === IMAGE_PROMPTER_ID) {
      const progressMsgId = crypto.randomUUID();
      const activeAgent = getActiveAgent();
      addMessage(activeChat.id, {
        id: progressMsgId,
        role: "assistant",
        content: "",
        meta: {
          kind: "text",
          provider: "local",
          generating: true,
        },
      });
      persistAndRender();

      try {
        const imageDataUrls = (getActiveAttachmentContext().files || [])
          .filter((f) => f.imageDataUrl)
          .map((f) => ({ dataUrl: f.imageDataUrl, name: f.name }));

        const payload = buildChatMessages({
          globalSystemPrompt: state.settings.globalSystemPrompt || "",
          agentSystemPrompt: activeAgent?.systemPrompt || "",
          responseStyle: activeAgent?.responseStyle || "",
          history: getActiveChat()?.messages?.slice(-20) || [],
          attachmentContext: "",
          referenceContext: "",
          userMessage: message,
          imageDataUrls,
        });

        const reply = await sendTextMessage({
          messages: payload,
          settings: getActiveSettings(),
        });

        const replyContent = reply.content || "";
        const promptMatch = replyContent.match(/\[IMAGE_PROMPT\]\s*([\s\S]*?)\s*\[\/IMAGE_PROMPT\]/i);
        const extractedPrompt = promptMatch ? promptMatch[1].trim() : replyContent.trim();

        updateMessageContent(activeChat.id, progressMsgId, replyContent, {
          meta: {
            kind: "text",
            provider: getTextProviderDisplayName(getActiveSettings().textProvider),
            model: getActiveSettings().textModel || getActiveSettings().groqModel || "",
          },
        });

        if (extractedPrompt) {
          const imageMsgId = crypto.randomUUID();
          addMessage(activeChat.id, {
            id: imageMsgId,
            role: "assistant",
            content: extractedPrompt,
            meta: {
              kind: "image",
              generating: true,
              provider: IMAGE_PROVIDER_LABELS[getActiveSettings().imageProvider] || "Pollinations.ai",
            },
          });
          persistAndRender();

          const editImageBase64 = imageDataUrls.length > 0 ? imageDataUrls[0].dataUrl : undefined;

          const image = await generateImage({
            prompt: extractedPrompt,
            settings: getActiveSettings(),
            editImageBase64,
          });

          updateMessageContent(activeChat.id, imageMsgId, extractedPrompt, {
            meta: {
              kind: "image",
              generating: false,
              imageUrl: image.url,
              provider: IMAGE_PROVIDER_LABELS[getActiveSettings().imageProvider] || "Pollinations.ai",
            },
          });
        }
      } catch (error) {
        updateMessageContent(activeChat.id, progressMsgId, `Erro ao gerar prompt/imagem: ${buildUserErrorMessage(error, "Erro desconhecido.")}`, {
          meta: {
            kind: "text",
            provider: "local",
            failed: true,
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
              provider: IMAGE_PROVIDER_LABELS[getActiveSettings().imageProvider] || "Pollinations.ai",
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
            provider: IMAGE_PROVIDER_LABELS[getActiveSettings().imageProvider] || "Pollinations.ai",
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
            provider: IMAGE_PROVIDER_LABELS[getActiveSettings().imageProvider] || "Pollinations.ai",
            brandId: instagramPayload?.brand.id || null,
            instagramFormat: instagramPayload?.format.id || null,
            creativeBrief: instagramPayload?.creativeBrief || null,
          },
        });
      }
    } else {
      if (state.webSearchMode && !prioritizeActiveDocuments && !canUseWebSearch()) {
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
        return;
      }

      // Smart mode: classifica e roteia sem mutar o estado global
      let activeSettings = getSettingsForVisualDocuments(getActiveSettings());
      let smartWebSearch = false;
      let actualProvider = activeSettings.textProvider;
      let actualModel = activeSettings.textModel || activeSettings.groqModel || "";
      if (actualProvider === "gemini") actualModel = activeSettings.geminiModel || "";

      if (hasAttachmentVisualPages() && !["gemini", "openrouter"].includes(activeSettings.textProvider)) {
        addMessage(activeChat.id, {
          role: "assistant",
          content: "Este PDF precisa de leitura visual porque o texto extraído veio fraco ou vazio. Configure Gemini ou OpenRouter para eu ler as páginas como imagem e resumir corretamente.",
          meta: {
            kind: "text",
            provider: "local",
            sourceType: "document-visual-required",
            failed: true,
          },
        });
        return;
      }

      if (state.webSearchMode && !isBrasilAgent && !prioritizeActiveDocuments) {
        if (state.smartMode) {
          const classified = smartClassify(message);
          smartWebSearch = classified.useWebSearch;

          if (classified.modelTier === "fast" && !smartWebSearch) {
            if (activeSettings.groqKey) {
              activeSettings.textProvider = "groq";
              activeSettings.groqModel = "openai/gpt-oss-120b";
            } else {
              activeSettings.textProvider = "openrouter";
              activeSettings.textModel = "qwen/qwen3.5-flash-02-23";
            }
            actualProvider = activeSettings.textProvider;
            actualModel = activeSettings.groqModel || activeSettings.textModel || "";
          }
        } else {
          smartWebSearch = true;
        }
      }

      const shouldSearch = smartWebSearch;

      if (shouldSearch) {
        addWebSearchMessage(activeChat.id, await resolveWebSearchForMessage(message, activeSettings));
      } else {
        const msgId = crypto.randomUUID();
        addMessage(activeChat.id, {
          id: msgId,
          role: "assistant",
          content: "",
          meta: { kind: "text", provider: getTextProviderDisplayName(actualProvider), model: actualModel },
        });
        persistAndRender();

        const sendResult = await sendTextMessage({
          messages: textPayload,
          settings: activeSettings,
          webSearchMode: false,
        });
        updateMessageContent(activeChat.id, msgId, sendResult.content, {
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
        const responseContent = sendResult.content;

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

        const fileActionMatch = responseContent.match(/\[CRIAR_ARQUIVO:(\w+)\]\s*\n([\s\S]*?)\n\[\/CRIAR_ARQUIVO\]/);
        if (fileActionMatch) {
          const format = fileActionMatch[1].toLowerCase();
          const headerBlock = fileActionMatch[2];
          const fileContent = responseContent.split(/\[\/CRIAR_ARQUIVO\]/)[1]?.trim() || "";

          // Detect JSON metadata → route to reportGenerator
          const trimmedHeader = headerBlock.trim();
          if (format === "pdf" && trimmedHeader.startsWith("{") && trimmedHeader.endsWith("}")) {
            try {
              const metadata = JSON.parse(trimmedHeader);
              const { gerarRelatorioPremium } = await import("./reportGenerator.js");
              await gerarRelatorioPremium(metadata, fileContent || "");
              showToast("Relatorio premium gerado com sucesso!", "success");
            } catch (reportError) {
              showToast(reportError.message || "Erro ao gerar relatorio.", "error");
            }
          } else {
            const titleMatch = headerBlock.match(/titulo:\s*(.+)/i);
            const fileName = titleMatch ? titleMatch[1].trim() : "arquivo";

            if (fileContent) {
              try {
                const result = await generateFileFromContent(format, fileName, fileContent);
                updateMessageMeta(activeChat.id, msgId, {
                  fileExport: { format, fileName: result.fileName, blobUrl: result.blobUrl },
                });
                showToast(`Arquivo ${format.toUpperCase()} gerado com sucesso!`, "success");
              } catch (fileError) {
                showToast(fileError.message || "Erro ao gerar arquivo.", "error");
              }
            }
          }
        }

        const taskActionMatch = responseContent.match(/\[CRIAR_TAREFA\]\s*\n([\s\S]*?)\n\[\/CRIAR_TAREFA\]/);
        if (taskActionMatch) {
          const headerBlock = taskActionMatch[1];
          const textMatch = headerBlock.match(/texto:\s*(.+)/i);
          const recMatch = headerBlock.match(/recorrencia:\s*(.+)/i);
          const tipoMatch = headerBlock.match(/tipo:\s*(.+)/i);
          const taskText = textMatch ? textMatch[1].trim() : "";
          const taskRec = recMatch ? recMatch[1].trim().toLowerCase() : "unica";
          const taskTipo = tipoMatch ? tipoMatch[1].trim().toLowerCase() : "manual";
          if (taskText) {
            try {
              await addTask(taskText, taskRec, taskTipo);
              state.tasks = await getPendingTasks();
              showToast(`Tarefa criada: "${taskText.slice(0, 60)}" (${taskRec})`, "success");
              addMessage(activeChat.id, {
                role: "assistant",
                content: `Tarefa criada com sucesso: "${taskText}" (${taskRec}${taskTipo === "pesquisa" ? ", com pesquisa" : ""}).`,
                meta: { kind: "text", provider: "local", taskCreated: true },
              });
            } catch (taskError) {
              showToast(taskError.message || "Erro ao criar tarefa.", "error");
            }
          }
        }
      }
    }

    // Auto-extract memory facts from conversation
    if (activeChat?.messages?.length >= 1) {
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

    // Generate long-term summary when needed (every 10 messages beyond window)
    try {
      const chat = getActiveChat();
      if (chat?.messages?.length > 10 && shouldGenerateSummary(chat.messages.length)) {
        const activeSettings = getActiveSettings();
        if (state.settings.autoSummary !== false) {
          generateLongTermSummary(chat.messages, getLongTermSummary(), activeSettings).catch(() => {});
        }
      }
    } catch { /* ignore */ }
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
    ...(provider === "groq"
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

function handleApplyRecommendedModel() {
  const recommendation = getRecommendedModelForContext();
  handleQuickModelChange(`${recommendation.provider}::${recommendation.model}`);
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
    groqKey: formValues.groqKey?.trim() || state.settings.groqKey || "",
    geminiKey: formValues.geminiKey?.trim() || state.settings.geminiKey || "",
    e2bKey: formValues.e2bKey?.trim() || state.settings.e2bKey || "",
    tavilyKey: formValues.tavilyKey?.trim() || state.settings.tavilyKey || "",
    serperKey: formValues.serperKey?.trim() || state.settings.serperKey || "",
    exaKey: formValues.exaKey?.trim() || state.settings.exaKey || "",
    webSearchProvider: formValues.webSearchProvider || state.settings.webSearchProvider || "auto",
    falKey: formValues.falKey?.trim() || state.settings.falKey || "",
    pixazoKey: formValues.pixazoKey?.trim() || state.settings.pixazoKey || "",
    imageProvider: formValues.imageProvider || state.settings.imageProvider || "pollinations",
    openAIKey: formValues.openAIKey?.trim() || state.settings.openAIKey || "",
    imageModel: formValues.imageModel?.trim() || getDefaultSettings().imageModel,
    falImageModel: formValues.falImageModel || state.settings.falImageModel || getDefaultSettings().falImageModel,
    imageSize: formValues.imageSize || state.settings.imageSize || "landscape_4_3",
    globalSystemPrompt: formValues.globalSystemPrompt?.toString().trim() || "",
    openRouterEnabled: formValues.openRouterEnabled === "on" || formValues.openRouterEnabled === true,
    groqEnabled: formValues.groqEnabled === "on" || formValues.groqEnabled === true,
    geminiEnabled: formValues.geminiEnabled === "on" || formValues.geminiEnabled === true,
    textProvider: formValues.textProvider?.trim() || state.settings.textProvider || getDefaultSettings().textProvider,
    textModel: formValues.textModel?.trim() || state.settings.textModel || getDefaultSettings().textModel,
    groqModel: formValues.groqModel?.trim() || state.settings.groqModel || getDefaultSettings().groqModel,
    geminiModel: formValues.geminiModel?.trim() || state.settings.geminiModel || getDefaultSettings().geminiModel,
    openRouterSelectedModels: formValues.openRouterSelectedModels !== undefined
      ? formValues.openRouterSelectedModels
      : state.settings.openRouterSelectedModels || [],
    wavespeedImageModel: formValues.wavespeedImageModel || state.settings.wavespeedImageModel || "system",
    wavespeedKey: formValues.wavespeedKey?.trim() || state.settings.wavespeedKey || "",
    openAITranscribeModel: formValues.openAITranscribeModel?.trim() || getDefaultSettings().openAITranscribeModel,
    whisperModel: formValues.whisperModel || getDefaultSettings().whisperModel,
    usageLimits: {
      tavilyDailyLimit: Math.max(0, Number(formValues.tavilyDailyLimit) || 30),
      serperDailyLimit: Math.max(0, Number(formValues.serperDailyLimit) || 65),
      exaDailyLimit: Math.max(0, Number(formValues.exaDailyLimit) || 100),
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
    supabaseConfig: {
      url: formValues.supabaseUrl?.trim() || "",
      key: formValues.supabaseKey?.trim() || "",
    },
    summaryProvider: formValues.summaryProvider || "groq",
    summaryModel: formValues.summaryModel?.trim() || "",
    autoSummary: formValues.autoSummary === "on" || formValues.autoSummary === true,
  };

  if (state.settings.supabaseConfig?.url && state.settings.supabaseConfig?.key) {
    initSupabase(state.settings.supabaseConfig.url, state.settings.supabaseConfig.key);
  }

  saveSettings(state.settings);
  state.settingsFallbacks = [];
  state.modals.settings = false;
  showToast("Configurações salvas no navegador.", "success");
  persistAndRender();
}

async function refreshSupabaseUser() {
  state.supabaseUser = await getSupabaseUser();
  render();
}

async function handleSupabaseLogin(email) {
  const normalizedEmail = String(email || "").trim();
  if (!normalizedEmail) {
    showToast("Digite seu email para receber o link de login.", "info");
    return;
  }
  try {
    await signInSupabaseWithOtp(normalizedEmail);
    showToast("Link de login enviado para seu email.", "success");
  } catch (error) {
    showToast(error.message || "Erro ao enviar login Supabase.", "error");
  }
}

async function handleSupabaseLogout() {
  try {
    await signOutSupabase();
    state.supabaseUser = null;
    showToast("Você saiu do Supabase.", "success");
    persistAndRender();
  } catch (error) {
    showToast(error.message || "Erro ao sair do Supabase.", "error");
  }
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
    const chat = getActiveChat();
    if (!chat) {
      showToast("Nenhuma conversa ativa disponível para receber documentos.", "error");
      return;
    }
    const newProcessed = await processFiles(fileList);
    addChatAttachments(chat.id, newProcessed.files);
    state.chats = loadChats();
    syncPendingAttachmentContext();
    const total = getActiveChatAttachments().length;
    showToast(`${total} documento(s) na biblioteca desta conversa.`, "success");
    persistAndRender();
  } catch (error) {
    showToast(error.message || "Falha ao processar arquivos.", "error");
  }
}

function handleRemoveAttachment(attachmentId) {
  const chat = getActiveChat();
  if (!chat) return;
  try {
    removeChatAttachment(chat.id, attachmentId);
    state.chats = loadChats();
    syncPendingAttachmentContext();
    persistAndRender();
  } catch (error) {
    showToast(error.message || "Não foi possível remover o documento.", "error");
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
    bootstrapSupabase(state.settings.supabaseConfig);
    refreshSupabaseUser().catch(() => {});
    voiceController.syncSpeechVoice();
    initLightbox();
    try {
      const saved = readStorageJson(localStorage, STORAGE_KEYS.openRouterModels);
      if (saved) state.openRouterAvailableModels = saved;
    } catch { console.warn("[FEMIC GPT] Erro ao restaurar modelos OpenRouter"); }
    initTaskSystem().then(async () => {
      try { state.tasks = await getPendingTasks(); } catch { state.tasks = []; }
      const overdue = await checkOverdueTasks().catch(() => []);
      if (overdue.length > 0) {
        showToast(`${overdue.length} tarefa(s) atrasada(s). Clique para revisar.`, "info", () => {
          setModal("tasks", true);
        });
      }
      await checkAndAutoExecutePesquisa();
      startPesquisaWatcher();
    }).catch(() => {});

    // Extract memory facts from all chats (one-time on load)
    try {
      const allChats = loadChats();
      for (const chat of allChats) {
        if (chat.messages?.length >= 1) autoExtractAndStore(chat.messages);
      }
    } catch { /* ignore */ }

    // Restore from Supabase if localStorage is empty
    try {
      if (isSupabaseConfigured() && state.chats.length === 0) {
        restoreFromSupabaseIfEmpty().then((restored) => {
          if (restored) {
            state.chats.push(restored);
            saveChats(state.chats);
            state.activeChatId = restored.id;
            showToast("Conversas restauradas da nuvem.", "success");
            persistAndRender();
          }
        }).catch(() => {});
      }
    } catch { /* ignore */ }

    pruneStorage().catch((err) => console.error("[FEMIC GPT] Erro na poda:", err));
  } catch (error) {
    console.error("[FEMIC GPT] Erro na inicializacao:", error);
    showToast("Erro ao inicializar. Recarregue a pagina.", "error");
  }

  try {
    const savedDraft = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (savedDraft) state.draftMessage = savedDraft;
  } catch { console.warn("[FEMIC GPT] Erro ao ler rascunho"); }

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
    onOpenTasks: async () => {
      try {
        state.tasks = await getPendingTasks();
      } catch { state.tasks = []; }
      setModal("tasks", true);
    },
    onCompleteTask: async (taskId) => {
      try {
        await completeTask(Number(taskId));
        state.tasks = await getPendingTasks();
        persistAndRender();
      } catch { console.warn("[TASK] Erro ao concluir tarefa"); }
    },
    onDeleteTask: async (taskId) => {
      try {
        await deleteTask(Number(taskId));
        state.tasks = await getPendingTasks();
        persistAndRender();
      } catch { console.warn("[TASK] Erro ao excluir tarefa"); }
    },
    onExportTasksDOCX: async () => {
      const tasks = state.tasks || [];
      if (tasks.length === 0) {
        showToast("Nenhuma tarefa para exportar.", "info");
        return;
      }
      try {
        await exportTasksAsDOCX(tasks);
        showToast("Tarefas exportadas em DOCX.", "success");
      } catch (error) {
        showToast(error.message || "Erro ao exportar tarefas.", "error");
      }
    },
    onExportTasksCSV: () => {
      const tasks = state.tasks || [];
      if (tasks.length === 0) {
        showToast("Nenhuma tarefa para exportar.", "info");
        return;
      }
      try {
        exportTasksAsCSV(tasks);
        showToast("Tarefas exportadas em CSV.", "success");
      } catch (error) {
        showToast(error.message || "Erro ao exportar tarefas.", "error");
      }
    },
    onExportTasksExcel: async () => {
      const tasks = state.tasks || [];
      if (tasks.length === 0) {
        showToast("Nenhuma tarefa para exportar.", "info");
        return;
      }
      try {
        await exportTasksAsExcel(tasks);
        showToast("Tarefas exportadas em Excel.", "success");
      } catch (error) {
        showToast(error.message || "Erro ao exportar tarefas.", "error");
      }
    },
    onExecuteTask: async (taskId) => {
      const tasks = state.tasks || [];
      const task = tasks.find((t) => t.id === Number(taskId));
      if (!task) { showToast("Tarefa nao encontrada.", "error"); return; }
      try {
        await completeTask(Number(taskId));
        state.tasks = await getPendingTasks();
        state.webSearchMode = true;
        persistAndRender();
        showToast(`Executando pesquisa: "${task.texto.slice(0, 60)}"`, "info");
        await handleSendMessage(task.texto);
        state.webSearchMode = false;
      } catch (error) {
        showToast(error.message || "Erro ao executar tarefa.", "error");
      }
    },
    onOpenMemory: () => setModal("memory", true),
    onApplyGlobalPromptTemplate: () => {
      const defaults = getDefaultSettings();
      const defaultPrompt = defaults.globalSystemPrompt || "";
      if (defaultPrompt) {
        state.settings.globalSystemPrompt = defaultPrompt;
        saveSettings(state.settings);
        showToast("Prompt global restaurado para o padrao do sistema.", "success");
        persistAndRender();
      }
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
    onRemoveAttachment: handleRemoveAttachment,
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
        await exportChatAsPremiumPDF(chat.messages, chat.title);
        showToast("PDF exportado com sucesso.", "success");
      } catch (error) {
        showToast(error.message || "Erro ao exportar PDF.", "error");
      }
    },
    onExportChatDOCX: async () => {
      const chat = getActiveChat();
      if (!chat || chat.messages.length === 0) {
        showToast("A conversa esta vazia.", "info");
        return;
      }
      try {
        await exportChatAsDOCX(chat.messages, chat.title);
        showToast("DOCX exportado com sucesso.", "success");
      } catch (error) {
        showToast(error.message || "Erro ao exportar DOCX.", "error");
      }
    },
    onExportChatCSV: () => {
      const chat = getActiveChat();
      if (!chat || chat.messages.length === 0) {
        showToast("A conversa esta vazia.", "info");
        return;
      }
      try {
        exportChatAsCSV(chat.messages, chat.title);
        showToast("CSV exportado com sucesso.", "success");
      } catch (error) {
        showToast(error.message || "Erro ao exportar CSV.", "error");
      }
    },
    onExportChatJSON: () => {
      const chat = getActiveChat();
      if (!chat || chat.messages.length === 0) {
        showToast("A conversa esta vazia.", "info");
        return;
      }
      try {
        exportChatAsJSON(chat.messages, chat.title);
        showToast("JSON exportado com sucesso.", "success");
      } catch (error) {
        showToast(error.message || "Erro ao exportar JSON.", "error");
      }
    },
    onExportChatExcel: async () => {
      const chat = getActiveChat();
      if (!chat || chat.messages.length === 0) {
        showToast("A conversa esta vazia.", "info");
        return;
      }
      try {
        await exportChatAsExcel(chat.messages, chat.title);
        showToast("Excel exportado com sucesso.", "success");
      } catch (error) {
        showToast(error.message || "Erro ao exportar Excel.", "error");
      }
    },
    onExportChatPowerPoint: async () => {
      const chat = getActiveChat();
      if (!chat || chat.messages.length === 0) {
        showToast("A conversa esta vazia.", "info");
        return;
      }
      try {
        await exportChatAsPowerPoint(chat.messages, chat.title);
        showToast("PowerPoint exportado com sucesso.", "success");
      } catch (error) {
        showToast(error.message || "Erro ao exportar PowerPoint.", "error");
      }
    },
    onExportChatWord: async () => {
      const chat = getActiveChat();
      if (!chat || chat.messages.length === 0) {
        showToast("A conversa esta vazia.", "info");
        return;
      }
      try {
        await exportChatAsWord(chat.messages, chat.title);
        showToast("Documento exportado com sucesso.", "success");
      } catch (error) {
        showToast(error.message || "Erro ao exportar documento.", "error");
      }
    },
    onExportMessagePDF: async (messageId) => {
      const chat = getActiveChat();
      if (!chat) { showToast("Nenhuma conversa ativa.", "info"); return; }
      const message = chat.messages.find((m) => m.id === messageId);
      if (!message) { showToast("Mensagem nao encontrada.", "error"); return; }
      try {
        await exportMessageAsPremiumPDF(message, chat.title);
        showToast("PDF exportado.", "success");
      } catch (error) {
        showToast(error.message || "Erro ao exportar PDF.", "error");
      }
    },
    onExportMessageDOCX: async (messageId) => {
      const chat = getActiveChat();
      if (!chat) { showToast("Nenhuma conversa ativa.", "info"); return; }
      const message = chat.messages.find((m) => m.id === messageId);
      if (!message) { showToast("Mensagem nao encontrada.", "error"); return; }
      try {
        await exportMessageAsDOCX(message, chat.title);
        showToast("DOCX exportado.", "success");
      } catch (error) {
        showToast(error.message || "Erro ao exportar DOCX.", "error");
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
    onTogglePinChat: handleTogglePinChat,
    onToggleShowArchived: handleToggleShowArchived,
    onRestoreArchived: handleRestoreArchived,
    onDeleteArchived: handleDeleteArchived,
    onToggleModelGuidance: handleToggleModelGuidance,
    onChangePubMedResultLimit: handleChangePubMedResultLimit,
    onClearAttachments: () => {
      const chat = getActiveChat();
      if (chat) {
        clearChatAttachments(chat.id);
        state.chats = loadChats();
      }
      resetAttachments();
      persistAndRender();
    },
    onApplyRecommendedModel: handleApplyRecommendedModel,
    onSendMessage: handleSendMessage,
    onSaveSettings: handleSaveSettings,
    onSupabaseLogin: handleSupabaseLogin,
    onSupabaseLogout: handleSupabaseLogout,
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
        try { localStorage.setItem(DRAFT_STORAGE_KEY, value); } catch { console.warn("[FEMIC GPT] Erro ao salvar rascunho"); }
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
    onAddMemoryFact: (text) => {
      if (!text || !text.trim()) { showToast("Digite um fato para adicionar.", "info"); return; }
      const added = addMemoryFact(text.trim(), "manual");
      if (added) {
        showToast("Fato adicionado a memoria.", "success");
      } else {
        showToast("Esse fato ja existe na memoria.", "info");
      }
      persistAndRender();
    },
    onExportData: async () => {
      let backup = buildBackupPayload(localStorage);
      const includeKeys = window.confirm("Incluir chaves de API no backup? Elas serão criptografadas com senha.");
      if (includeKeys) {
        const password = window.prompt("Digite uma senha para proteger as chaves do backup:");
        if (!password) {
          showToast("Backup cancelado: senha obrigatória para incluir chaves.", "info");
          return;
        }
        backup = await buildBackupPayloadWithSecrets(localStorage, password);
      }

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

        let restoredSecrets = null;
        if (backup.encryptedSecrets) {
          const password = window.prompt("Este backup possui chaves criptografadas. Digite a senha para restaurá-las ou deixe em branco para ignorar:");
          if (password) {
            try {
              restoredSecrets = await decryptBackupSecrets(backup.encryptedSecrets, password);
            } catch (secretError) {
              showToast(secretError.message || "Não foi possível restaurar as chaves.", "error");
            }
          }
        }

        applyParsedBackup(localStorage, backup, restoredSecrets);

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
        writeStorageJson(localStorage, STORAGE_KEYS.openRouterModels, models);
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

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch((error) => {
      console.warn("[FEMIC GPT] Service worker indisponível:", error?.message || error);
    });
  });
}

function initMobileViewportTuning() {
  const viewport = window.visualViewport;
  if (!viewport) return;

  const update = () => {
    const keyboardOffset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
    document.documentElement.style.setProperty("--keyboard-offset", `${Math.round(keyboardOffset)}px`);
    document.body.classList.toggle("keyboard-open", keyboardOffset > 80);
  };

  viewport.addEventListener("resize", update);
  viewport.addEventListener("scroll", update);
  window.addEventListener("orientationchange", () => setTimeout(update, 250));
  update();
}

initialize();
registerServiceWorker();
initMobileViewportTuning();
