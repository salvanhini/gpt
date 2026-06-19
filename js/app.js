import {
  BRASIL_AGENT_ID,
  createAgent,
  deleteAgent,
  getDefaultAgents,
  loadAgents,
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
  addMessage,
  createChat,
  getChatsByAgent,
  loadChats,
  saveChats,
  updateChatCategory,
  updateMessageCategory,
  updateChatTitle,
} from "./chat.js";
import {
  DEEPSEEK_MODELS,
  generateSpeechAudio,
  generateImage,
  getDefaultSettings,
  getTextProviderDisplayName,
  GROQ_MODELS,
  hasTextProviderKey,
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
import { bindUIHandlers, renderApp, showToast } from "./ui.js";
import { createVoiceController } from "./voiceController.js";

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
  pubmedResultLimit: 5,
  webSearchMode: false,
  modelGuidanceCollapsed: false,
  agentSummaryCollapsed: true,
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
  },
  modalPayload: {},
  draftMessage: "",
  mobileSidebarOpen: false,
  sidebarCollapsed: false,
  recognition: null,
  mediaRecorder: null,
  mediaStream: null,
  recordedAudioChunks: [],
  currentAudio: null,
  currentAudioUrl: null,
  availableVoice: null,
  modelOptions: OPENROUTER_MODELS,
  deepSeekModelOptions: DEEPSEEK_MODELS,
  groqModelOptions: GROQ_MODELS,
  imageSizeOptions: IMAGE_SIZE_OPTIONS,
  instagramFormats: INSTAGRAM_FORMATS,
};

function loadSettings() {
  const normalized = normalizeSettingsWithFallback(
    readStorageJson(localStorage, STORAGE_KEYS.settings, {}),
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

function refreshFromStorage() {
  state.agents = loadAgents();
  state.brands = loadBrands();
  state.chats = loadChats();
  hydratePersistentState();
}

function setModal(name, open, payload = {}) {
  state.modals[name] = open;
  state.modalPayload = open ? payload : {};
  render();
}

function render() {
  try {
    refreshFromStorage();
    state.activeAgent = getActiveAgent();
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

function buildTextPayload(userMessage) {
  const activeAgent = getActiveAgent();
  const activeChat = getActiveChat();
  const history = (activeChat?.messages || []).map((message) => ({
    role: message.role,
    content:
      message.meta?.kind === "image"
        ? `[imagem gerada anteriormente]\nPrompt: ${message.content}\nURL: ${message.meta.imageUrl}`
        : message.content,
  }));

  return buildChatMessages({
    globalSystemPrompt: state.settings.globalSystemPrompt || "",
    agentSystemPrompt: activeAgent?.systemPrompt || "",
    history,
    attachmentContext: state.pendingAttachmentContext?.combinedContext || "",
    userMessage,
  });
}

function buildTextPayloadWithReference(userMessage, referenceContext) {
  const activeAgent = getActiveAgent();
  const activeChat = getActiveChat();
  const history = (activeChat?.messages || []).map((message) => ({
    role: message.role,
    content:
      message.meta?.kind === "image"
        ? `[imagem gerada anteriormente]\nPrompt: ${message.content}\nURL: ${message.meta.imageUrl}`
        : message.content,
  });

  return buildChatMessages({
    globalSystemPrompt: state.settings.globalSystemPrompt || "",
    agentSystemPrompt: activeAgent?.systemPrompt || "",
    history,
    attachmentContext: state.pendingAttachmentContext?.combinedContext || "",
    referenceContext,
    userMessage,
  });
}

function buildInstagramPayload() {
  const brand = getSelectedBrand();
  if (!brand) {
    throw new Error("Cadastre e selecione uma marca antes de gerar a arte.");
  }

  const creativeBrief = buildCreativeBrief(state.creativeFormDraft);
  if (!creativeBrief.trim()) {
    throw new Error("Preencha pelo menos o objetivo ou o texto principal da arte.");
  }

  return {
    brand,
    format: getInstagramFormatById(state.instagramFormat),
    creativeBrief,
    variationCount: Math.min(Math.max(Number(state.creativeFormDraft.variationCount) || 1, 1), 4),
    prompt: buildInstagramImagePrompt({
      brand,
      formatId: state.instagramFormat,
      draft: state.creativeFormDraft,
    }),
  };
}

function canGenerateInstagramCopy() {
  return hasTextProviderKey(state.settings);
}

function getActiveTextProviderLabel() {
  return getTextProviderDisplayName(state.settings.textProvider);
}

function canUseWebSearch() {
  return state.settings.textProvider !== "deepseek";
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
      ...(searchResult.failed ? { failed: true } : {}),
    },
  });
}

async function resolveWebSearchForMessage(message) {
  return runWebSearchQuery({
    messages: buildTextPayload(message),
    settings: state.settings,
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
    message = instagramPayload.creativeBrief;
  }

  const textPayload = state.imageMode || isInstagramMode || isPubMedMode
    ? null
    : buildTextPayload(message);
  state.isLoading = true;
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
  persistAndRender();

  try {
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
          settings: state.settings,
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
              settings: state.settings,
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
              ...state.settings,
              imageSize: instagramPayload.format.imageSize || state.settings.imageSize,
            },
          });

          addMessage(activeChat.id, {
            role: "assistant",
            content: `${instagramPayload.creativeBrief}\n\nVariação ${index} de ${instagramPayload.variationCount}`,
            meta: {
              kind: "image",
              imageUrl: image.url,
              provider: "fal.ai",
              brandId: instagramPayload.brand.id,
              instagramFormat: instagramPayload.format.id,
              creativeBrief: instagramPayload.creativeBrief,
              variationIndex: index,
              variationCount: instagramPayload.variationCount,
            },
          });
        }
      } else {
        const image = await generateImage({
          prompt: instagramPayload?.prompt || message,
          settings: {
            ...state.settings,
            imageSize: instagramPayload?.format.imageSize || state.settings.imageSize,
          },
        });

        addMessage(activeChat.id, {
          role: "assistant",
          content: instagramPayload?.creativeBrief || message,
          meta: {
            kind: "image",
            imageUrl: image.url,
            provider: "fal.ai",
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

      if (state.webSearchMode) {
        addWebSearchMessage(activeChat.id, await resolveWebSearchForMessage(message));
      } else {
        const reply = await sendTextMessage({
          messages: textPayload,
          settings: state.settings,
          webSearchMode: false,
        });

        addMessage(activeChat.id, {
          role: "assistant",
          content: reply.content,
          meta: {
            kind: "text",
            provider: getActiveTextProviderLabel(),
          },
        });
      }
    }

    resetAttachments();
  } catch (error) {
    addAssistantErrorMessage(activeChat.id, error);
    showToast(buildUserErrorMessage(error, "Erro ao enviar mensagem."), "error");
  } finally {
    state.isLoading = false;
    refreshFromStorage();
    persistAndRender();
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

function handleQuickModelChange(value) {
  const [provider, model] = value.split("::");
  if (!provider || !model) {
    return;
  }

  state.settings = {
    ...state.settings,
    textProvider: provider,
    ...(provider === "deepseek"
      ? { deepSeekModel: model }
      : provider === "groq"
        ? { groqModel: model }
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
}

function handleSaveSettings(formValues) {
  state.settings = {
    ...state.settings,
    openRouterKey: formValues.openRouterKey?.trim() || "",
    deepSeekKey: formValues.deepSeekKey?.trim() || "",
    groqKey: formValues.groqKey?.trim() || "",
    falKey: formValues.falKey?.trim() || "",
    openAIKey: formValues.openAIKey?.trim() || "",
    imageModel: formValues.imageModel?.trim() || getDefaultSettings().imageModel,
    imageSize: formValues.imageSize || state.settings.imageSize || "landscape_4_3",
    globalSystemPrompt: formValues.globalSystemPrompt?.toString().trim() || "",
    openAITranscribeModel: formValues.openAITranscribeModel?.trim() || getDefaultSettings().openAITranscribeModel,
    openAITtsModel: formValues.openAITtsModel?.trim() || getDefaultSettings().openAITtsModel,
    openAITtsVoice: formValues.openAITtsVoice?.trim() || getDefaultSettings().openAITtsVoice,
  };

  saveSettings(state.settings);
  state.settingsFallbacks = [];
  state.modals.settings = false;
  showToast("Configurações salvas no navegador.", "success");
  persistAndRender();
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
  const message = chat?.messages.find((item) => item.id === messageId);
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

function initialize() {
  try {
    ensureSeedData();
    syncActivePointers();
    voiceController.syncSpeechVoice();
  } catch (error) {
    console.error("[FEMIC GPT] Erro na inicializacao:", error);
  }
  bindUIHandlers({
    onSelectAgent: handleSelectAgent,
    onDeleteAgent: handleDeleteAgent,
    onEditAgent: handleEditAgent,
    onSelectChat: handleSelectChat,
    onDeleteChat: handleDeleteChat,
    onCreateChat: handleCreateChat,
    onOpenSettings: () => {
      setModal("settings", true);
    },
    onOpenHelp: () => setModal("help", true),
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
    onToggleCategoryPicker: handleToggleCategoryPicker,
    onToggleMessageCategoryPicker: handleToggleMessageCategoryPicker,
    onFilterByCategory: handleFilterByCategory,
    onToggleBoardView: handleToggleBoardView,
    onSearchChats: handleSearchChats,
    onTogglePubMedMode: handleTogglePubMedMode,
    onToggleWebSearchMode: handleToggleWebSearchMode,
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
    },
    onToggleSidebar: () => {
      state.mobileSidebarOpen = !state.mobileSidebarOpen;
      render();
    },
    onToggleSidebarCollapse: () => {
      state.sidebarCollapsed = !state.sidebarCollapsed;
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
