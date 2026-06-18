export const STORAGE_KEYS = {
  chats: "femicgpt:chats",
  agents: "femicgpt:agents",
  brands: "femicgpt:brands",
  settings: "femicgpt:settings",
  view: "femicgpt:view",
};

export const BACKUP_SCHEMA_VERSION = 2;

export function safeParseJson(value, fallback = null) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

export function readStorageJson(storage, key, fallback = null) {
  return safeParseJson(storage.getItem(key), fallback);
}

export function writeStorageJson(storage, key, value) {
  storage.setItem(key, JSON.stringify(value));
  return value;
}

export function normalizeSettings(raw, defaults, openRouterModels, deepSeekModels) {
  const settings = {
    ...defaults,
    ...(raw && typeof raw === "object" ? raw : {}),
  };

  if (!openRouterModels.some((model) => model.value === settings.textModel)) {
    settings.textModel = defaults.textModel;
  }

  if (!deepSeekModels.some((model) => model.value === settings.deepSeekModel)) {
    settings.deepSeekModel = defaults.deepSeekModel;
  }

  if (!["openrouter", "deepseek"].includes(settings.textProvider)) {
    settings.textProvider = defaults.textProvider;
  }

  return settings;
}

export function normalizeAgents(rawAgents) {
  if (!Array.isArray(rawAgents)) {
    return [];
  }

  return rawAgents.filter((agent) => agent && typeof agent.id === "string");
}

export function normalizeChats(rawChats, validAgentIds) {
  if (!Array.isArray(rawChats)) {
    return [];
  }

  return rawChats.filter((chat) => {
    if (!chat || typeof chat.id !== "string" || typeof chat.agentId !== "string") {
      return false;
    }

    if (!validAgentIds.has(chat.agentId)) {
      return false;
    }

    return Array.isArray(chat.messages);
  });
}

export function reconcileAppData({
  agents,
  chats,
  view,
  defaultAgents,
  createChat,
}) {
  const normalizedAgents = normalizeAgents(agents);
  const nextAgents = normalizedAgents.length ? normalizedAgents : defaultAgents();

  const validAgentIds = new Set(nextAgents.map((agent) => agent.id));
  const nextChats = normalizeChats(chats, validAgentIds);
  const nextView = view && typeof view === "object" ? view : {};

  let activeAgentId = validAgentIds.has(nextView.activeAgentId)
    ? nextView.activeAgentId
    : nextAgents[0]?.id || null;

  let chatsForAgent = nextChats.filter((chat) => chat.agentId === activeAgentId);
  if (!chatsForAgent.length && activeAgentId) {
    const fallbackChat = createChat(activeAgentId);
    nextChats.push(fallbackChat);
    chatsForAgent = [fallbackChat];
  }

  const activeChatId = chatsForAgent.some((chat) => chat.id === nextView.activeChatId)
    ? nextView.activeChatId
    : chatsForAgent[0]?.id || null;

  if (!activeAgentId && nextAgents[0]) {
    activeAgentId = nextAgents[0].id;
  }

  return {
    agents: nextAgents,
    chats: nextChats,
    activeAgentId,
    activeChatId,
    view: {
      activeAgentId,
      activeChatId,
      imageMode: Boolean(nextView.imageMode),
      sidebarCollapsed: Boolean(nextView.sidebarCollapsed),
      activeCategory: typeof nextView.activeCategory === "string" ? nextView.activeCategory : "",
      viewMode: nextView.viewMode === "board" ? "board" : "chat",
      selectedBrandId: typeof nextView.selectedBrandId === "string" ? nextView.selectedBrandId : "",
      selectedTemplateId: typeof nextView.selectedTemplateId === "string" ? nextView.selectedTemplateId : "",
      instagramFormat: typeof nextView.instagramFormat === "string" ? nextView.instagramFormat : "story_9_16",
      creativeFormDraft:
        nextView.creativeFormDraft && typeof nextView.creativeFormDraft === "object"
          ? nextView.creativeFormDraft
          : {},
    },
  };
}

export function buildBackupPayload(storage) {
  return {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    femicgpt_chats: storage.getItem(STORAGE_KEYS.chats),
    femicgpt_agents: storage.getItem(STORAGE_KEYS.agents),
    femicgpt_brands: storage.getItem(STORAGE_KEYS.brands),
    femicgpt_settings: storage.getItem(STORAGE_KEYS.settings),
    femicgpt_view: storage.getItem(STORAGE_KEYS.view),
    exportedAt: new Date().toISOString(),
  };
}

function parseJsonField(rawValue) {
  if (typeof rawValue !== "string") {
    return null;
  }

  return safeParseJson(rawValue, null);
}

export function parseBackupPayload(text) {
  const backup = safeParseJson(text, null);
  if (!backup || typeof backup !== "object") {
    throw new Error("Falha ao importar: arquivo inválido.");
  }

  return {
    schemaVersion:
      typeof backup.schemaVersion === "number" ? backup.schemaVersion : null,
    agents: parseJsonField(backup.femicgpt_agents),
    brands: parseJsonField(backup.femicgpt_brands),
    chats: parseJsonField(backup.femicgpt_chats),
    settings: parseJsonField(backup.femicgpt_settings),
    view: parseJsonField(backup.femicgpt_view),
  };
}

export function applyParsedBackup(storage, parsedBackup) {
  if (parsedBackup?.agents) {
    writeStorageJson(storage, STORAGE_KEYS.agents, parsedBackup.agents);
  }
  if (parsedBackup?.chats) {
    writeStorageJson(storage, STORAGE_KEYS.chats, parsedBackup.chats);
  }
  if (parsedBackup?.brands) {
    writeStorageJson(storage, STORAGE_KEYS.brands, parsedBackup.brands);
  }
  if (parsedBackup?.settings) {
    writeStorageJson(storage, STORAGE_KEYS.settings, parsedBackup.settings);
  }
  if (parsedBackup?.view) {
    writeStorageJson(storage, STORAGE_KEYS.view, parsedBackup.view);
  }
}
