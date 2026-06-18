import {
  createAgent,
  deleteAgent,
  getDefaultAgents,
  loadAgents,
  saveAgents,
  updateAgent,
} from "./agents.js";
import {
  addMessage,
  createChat,
  getChatsByAgent,
  loadChats,
  saveChats,
} from "./chat.js";
import {
  DEEPSEEK_MODELS,
  generateSpeechAudio,
  generateImage,
  getDefaultSettings,
  IMAGE_SIZE_OPTIONS,
  OPENROUTER_MODELS,
  sendTextMessage,
  transcribeAudio,
} from "./api.js";
import {
  createSpeechRecognition,
  getMicrophoneStream,
  getSpeechSynthesis,
  isMediaRecorderSupported,
  isSpeechRecognitionSupported,
  pickPortugueseVoice,
} from "./audio.js";
import { processFiles } from "./fileProcessor.js";
import { bindUIHandlers, renderApp, showToast } from "./ui.js";

const SETTINGS_KEY = "femicgpt:settings";
const STATE_KEY = "femicgpt:view";

const state = {
  settings: loadSettings(),
  agents: loadAgents(),
  chats: loadChats(),
  activeAgentId: null,
  activeChatId: null,
  pendingAttachmentContext: null,
  imageMode: false,
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
  imageSizeOptions: IMAGE_SIZE_OPTIONS,
};

function safeParse(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function loadSettings() {
  const settings = {
    ...getDefaultSettings(),
    ...safeParse(localStorage.getItem(SETTINGS_KEY), {}),
  };

  if (!OPENROUTER_MODELS.some((model) => model.value === settings.textModel)) {
    settings.textModel = getDefaultSettings().textModel;
  }

  if (!DEEPSEEK_MODELS.some((model) => model.value === settings.deepSeekModel)) {
    settings.deepSeekModel = getDefaultSettings().deepSeekModel;
  }

  if (!["openrouter", "deepseek"].includes(settings.textProvider)) {
    settings.textProvider = getDefaultSettings().textProvider;
  }

  return settings;
}

function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function loadViewState() {
  return safeParse(localStorage.getItem(STATE_KEY), {});
}

function saveViewState() {
  localStorage.setItem(
    STATE_KEY,
    JSON.stringify({
      activeAgentId: state.activeAgentId,
      activeChatId: state.activeChatId,
      imageMode: state.imageMode,
      sidebarCollapsed: state.sidebarCollapsed,
    }),
  );
}

function ensureSeedData() {
  if (!state.agents.length) {
    state.agents = getDefaultAgents();
    saveAgents(state.agents);
  }

  if (!state.chats.length) {
    const initialAgent = state.agents[0];
    const chat = createChat(initialAgent.id);
    state.chats = [chat];
    saveChats(state.chats);
  }
}

function syncActivePointers() {
  const view = loadViewState();
  const fallbackAgentId = state.agents[0]?.id || null;
  state.activeAgentId = state.agents.some((agent) => agent.id === view.activeAgentId)
    ? view.activeAgentId
    : fallbackAgentId;

  const chatsForAgent = getChatsByAgent(state.activeAgentId);
  let activeChat = chatsForAgent.find((chat) => chat.id === view.activeChatId);
  if (!activeChat) {
    activeChat = chatsForAgent[0];
  }

  if (!activeChat) {
    const chat = createChat(state.activeAgentId);
    state.chats.push(chat);
    saveChats(state.chats);
    activeChat = chat;
  }

  state.activeChatId = activeChat.id;
  state.imageMode = Boolean(view.imageMode);
  state.sidebarCollapsed = Boolean(view.sidebarCollapsed);
  saveViewState();
}

function getActiveAgent() {
  return state.agents.find((agent) => agent.id === state.activeAgentId) || null;
}

function getActiveChat() {
  return state.chats.find((chat) => chat.id === state.activeChatId) || null;
}

function refreshFromStorage() {
  state.agents = loadAgents();
  state.chats = loadChats();
}

function setModal(name, open, payload = {}) {
  state.modals[name] = open;
  state.modalPayload = open ? payload : {};
  render();
}

function render() {
  refreshFromStorage();
  state.activeAgent = getActiveAgent();
  renderApp(state);
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

  const payload = [
    {
      role: "system",
      content: activeAgent.systemPrompt,
    },
    ...history,
  ];

  if (state.pendingAttachmentContext?.combinedContext) {
    payload.push({
      role: "user",
      content: `Use o contexto abaixo apenas como referência complementar para responder melhor:\n\n${state.pendingAttachmentContext.combinedContext}`,
    });
  }

  payload.push({
    role: "user",
    content: userMessage,
  });

  return payload;
}

function resetAttachments() {
  state.pendingAttachmentContext = null;
}

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

async function handleSendMessage(rawMessage) {
  const message = rawMessage.trim();
  if (!message || state.isLoading) {
    return;
  }

  const activeChat = getActiveChat();
  if (!activeChat) {
    showToast("Nenhuma conversa ativa disponível.", "error");
    return;
  }

  const textPayload = state.imageMode ? null : buildTextPayload(message);
  state.isLoading = true;
  addMessage(activeChat.id, {
    role: "user",
    content: message,
    meta: {
      kind: "text",
      attachments: state.pendingAttachmentContext?.files || [],
    },
  });

  state.draftMessage = "";
  persistAndRender();

  try {
    if (state.imageMode) {
      const image = await generateImage({
        prompt: message,
        settings: state.settings,
      });

      addMessage(activeChat.id, {
        role: "assistant",
        content: message,
        meta: {
          kind: "image",
          imageUrl: image.url,
          provider: "fal.ai",
        },
      });
    } else {
      const reply = await sendTextMessage({
        messages: textPayload,
        settings: state.settings,
      });

      addMessage(activeChat.id, {
        role: "assistant",
        content: reply.content,
        meta: {
          kind: "text",
          provider: state.settings.textProvider === "deepseek" ? "DeepSeek" : "OpenRouter",
        },
      });
    }

    resetAttachments();
  } catch (error) {
    showToast(error.message || "Erro ao enviar mensagem.", "error");
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
  persistAndRender();
}

function handleSelectChat(chatId) {
  const chat = state.chats.find((item) => item.id === chatId);
  if (!chat) {
    return;
  }

  state.activeAgentId = chat.agentId;
  state.activeChatId = chatId;
  state.mobileSidebarOpen = false;
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
      : { textModel: model }),
  };

  saveSettings(state.settings);
  showToast(`Modelo ativo: ${provider === "deepseek" ? "DeepSeek" : "OpenRouter"}`, "success");
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

function handleSaveSettings(formValues) {
  state.settings = {
    ...state.settings,
    openRouterKey: formValues.openRouterKey?.trim() || "",
    deepSeekKey: formValues.deepSeekKey?.trim() || "",
    falKey: formValues.falKey?.trim() || "",
    openAIKey: formValues.openAIKey?.trim() || "",
    imageModel: formValues.imageModel?.trim() || getDefaultSettings().imageModel,
    imageSize: formValues.imageSize || state.settings.imageSize || "landscape_4_3",
    openAITranscribeModel: formValues.openAITranscribeModel?.trim() || getDefaultSettings().openAITranscribeModel,
    openAITtsModel: formValues.openAITtsModel?.trim() || getDefaultSettings().openAITtsModel,
    openAITtsVoice: formValues.openAITtsVoice?.trim() || getDefaultSettings().openAITtsVoice,
  };

  saveSettings(state.settings);
  state.modals.settings = false;
  showToast("Configurações salvas no navegador.", "success");
  persistAndRender();
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

async function handleSpeakMessage(messageId) {
  syncSpeechVoice();
  const synth = getSpeechSynthesis();
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

  if (synth) {
    stopSpeaking();
    const utterance = new SpeechSynthesisUtterance(message.content);
    utterance.lang = state.availableVoice?.lang || "pt-BR";
    utterance.rate = 1;
    if (state.availableVoice) {
      utterance.voice = state.availableVoice;
    }

    utterance.onend = () => {
      state.speakingMessageId = null;
      render();
    };
    utterance.onerror = () => {
      state.speakingMessageId = null;
      showToast("Nao foi possivel reproduzir a resposta em voz alta.", "error");
      render();
    };
    state.speakingMessageId = messageId;
    synth.speak(utterance);
    render();
    return;
  }

  try {
    stopSpeaking();
    state.speakingMessageId = messageId;
    render();
    const audioBlob = await generateSpeechAudio({
      text: message.content,
      settings: state.settings,
    });
    const url = URL.createObjectURL(audioBlob);
    const audio = new Audio(url);
    state.currentAudioUrl = url;
    state.currentAudio = audio;
    audio.onended = () => {
      stopSpeaking();
      render();
    };
    audio.onerror = () => {
      stopSpeaking();
      showToast("Nao foi possivel tocar o audio gerado.", "error");
      render();
    };
    await audio.play();
    render();
  } catch (error) {
    stopSpeaking();
    showToast(error.message || "Nao foi possivel gerar a fala da resposta.", "error");
    render();
  }
}

function stopListening() {
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
  return Boolean(state.settings.openAIKey && state.mediaRecorderSupported);
}

async function handleToggleVoice() {
  state.speechRecognitionSupported = isSpeechRecognitionSupported();
  state.mediaRecorderSupported = isMediaRecorderSupported();

  if (state.isListening) {
    if (state.mediaRecorder && state.mediaRecorder.state !== "inactive") {
      state.mediaRecorder.stop();
    } else {
      stopListening();
    }
    render();
    return;
  }

  if (!window.isSecureContext) {
    showToast("O ditado por voz exige HTTPS ou localhost.", "error");
    return;
  }

  if (canUseRecordedVoiceFallback()) {
    await handleRecordedVoiceInput();
    return;
  }

  if (!isSpeechRecognitionSupported()) {
    await handleRecordedVoiceInput();
    return;
  }

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

    if (canUseRecordedVoiceFallback() && !["not-allowed", "audio-capture"].includes(event.error)) {
      showToast("Voz nativa falhou. Vou usar a transcricao por OpenAI.", "info");
      await handleRecordedVoiceInput();
      return;
    }

    showToast(
      errors[event.error] ||
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
  recognition.start();
  render();
}

async function handleRecordedVoiceInput() {
  if (!isMediaRecorderSupported()) {
    showToast("Microfone indisponivel neste navegador.", "error");
    return;
  }

  if (!state.settings.openAIKey) {
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
        const text = await transcribeAudio({ audioBlob, settings: state.settings });
        state.draftMessage = state.draftMessage
          ? `${state.draftMessage.trim()} ${text}`.trim()
          : text;
        showToast("Audio transcrito.", "success");
      } catch (error) {
        showToast(error.message || "Falha ao transcrever audio.", "error");
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
    showToast(error.message || "Nao foi possivel acessar o microfone.", "error");
    render();
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

function initialize() {
  ensureSeedData();
  syncActivePointers();
  syncSpeechVoice();
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
    onOpenAgentModal: () => setModal("agentForm", true),
    onCloseModal: (name) => setModal(name, false),
    onToggleImageMode: () => {
      state.imageMode = !state.imageMode;
      persistAndRender();
    },
    onToggleVoice: handleToggleVoice,
    onSpeakMessage: handleSpeakMessage,
    onCopyMessage: handleCopyMessage,
    onAttachFiles: handleAttachFiles,
    onClearAttachments: () => {
      resetAttachments();
      persistAndRender();
    },
    onSendMessage: handleSendMessage,
    onSaveSettings: handleSaveSettings,
    onSaveAgent: handleSaveAgent,
    onQuickModelChange: handleQuickModelChange,
    onChangeImageSize: handleChangeImageSize,
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
      const backup = {
        femicgpt_chats: localStorage.getItem("femicgpt:chats"),
        femicgpt_agents: localStorage.getItem("femicgpt:agents"),
        femicgpt_settings: localStorage.getItem("femicgpt:settings"),
        femicgpt_view: localStorage.getItem("femicgpt:view"),
        exportedAt: new Date().toISOString(),
      };

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
        const backup = JSON.parse(text);

        if (backup.femicgpt_chats) {
          localStorage.setItem("femicgpt:chats", backup.femicgpt_chats);
        }
        if (backup.femicgpt_agents) {
          localStorage.setItem("femicgpt:agents", backup.femicgpt_agents);
        }
        if (backup.femicgpt_settings) {
          localStorage.setItem("femicgpt:settings", backup.femicgpt_settings);
        }
        if (backup.femicgpt_view) {
          localStorage.setItem("femicgpt:view", backup.femicgpt_view);
        }

        state.settings = loadSettings();
        state.agents = loadAgents();
        state.chats = loadChats();
        ensureSeedData();
        syncActivePointers();
        showToast("Dados importados com sucesso.", "success");
        persistAndRender();
      } catch {
        showToast("Falha ao importar: arquivo inválido.", "error");
      }
    },
  });

  window.addEventListener("beforeunload", () => {
    stopSpeaking();
    stopListening();
  });

  render();
}

initialize();
