import { GENERAL_AGENT_ID, NO_AGENT_ID } from "./agents.js";
import { normalizeResponseMode } from "./documentContext.js";

export const STORAGE_KEYS = {
  chats: "femicgpt:chats",
  agents: "femicgpt:agents",
  brands: "femicgpt:brands",
  settings: "femicgpt:settings",
  secureChats: "femicgpt:secure_chats",
  view: "femicgpt:view",
  openRouterModels: "femicgpt:openrouter_models",
  supabaseConfig: "femicgpt:supabase_config",
  longTermSummary: "femicgpt:long_term_summary",
  sessionId: "femicgpt:session_id",
};

export const BACKUP_SCHEMA_VERSION = 2;
const BACKUP_SECRET_VERSION = 1;
const BACKUP_SECRET_ALGORITHM = "AES-GCM";
const BACKUP_SECRET_KDF = "PBKDF2";
const BACKUP_SECRET_ITERATIONS = 210000;
const BACKUP_SECRET_KEY_LENGTH = 256;
const BACKUP_SECRET_SALT_BYTES = 16;
const BACKUP_SECRET_IV_BYTES = 12;

const SECRET_SETTING_KEYS = [
  "openRouterKey",
  "groqKey",
  "internalGroqKey",
  "geminiKey",
  "falKey",
  "pixazoKey",
  "openAIKey",
  "tavilyKey",
  "serperKey",
  "exaKey",
  "e2bKey",
  "wavespeedKey",
  "emailJSMarcoServiceId",
  "emailJSMarcoTemplateId",
  "emailJSMarcoPublicKey",
  "emailJSAlessandraServiceId",
  "emailJSAlessandraTemplateId",
  "emailJSAlessandraPublicKey",
  "evolutionInstanceUrl",
  "evolutionApiKey",
  "evolutionInstanceName",
];

function getCrypto() {
  const cryptoImpl = globalThis.crypto;
  if (!cryptoImpl?.subtle) {
    throw new Error("Criptografia indisponível neste navegador.");
  }
  return cryptoImpl;
}

function bytesToBase64(bytes) {
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
  if (typeof btoa === "function") {
    return btoa(binary);
  }
  return Buffer.from(binary, "binary").toString("base64");
}

function base64ToBytes(value) {
  const binary = typeof atob === "function"
    ? atob(value)
    : Buffer.from(value, "base64").toString("binary");
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function deriveBackupKey(password, salt) {
  const cryptoImpl = getCrypto();
  const material = await cryptoImpl.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    BACKUP_SECRET_KDF,
    false,
    ["deriveKey"],
  );

  return cryptoImpl.subtle.deriveKey(
    {
      name: BACKUP_SECRET_KDF,
      salt,
      iterations: BACKUP_SECRET_ITERATIONS,
      hash: "SHA-256",
    },
    material,
    { name: BACKUP_SECRET_ALGORITHM, length: BACKUP_SECRET_KEY_LENGTH },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptBackupSecrets(secrets, password) {
  if (!password) {
    throw new Error("Informe uma senha para proteger as chaves do backup.");
  }

  const cryptoImpl = getCrypto();
  const salt = cryptoImpl.getRandomValues(new Uint8Array(BACKUP_SECRET_SALT_BYTES));
  const iv = cryptoImpl.getRandomValues(new Uint8Array(BACKUP_SECRET_IV_BYTES));
  const key = await deriveBackupKey(password, salt);
  const payload = new TextEncoder().encode(JSON.stringify(secrets || {}));
  const cipher = await cryptoImpl.subtle.encrypt({ name: BACKUP_SECRET_ALGORITHM, iv }, key, payload);

  return {
    version: BACKUP_SECRET_VERSION,
    algorithm: BACKUP_SECRET_ALGORITHM,
    kdf: BACKUP_SECRET_KDF,
    iterations: BACKUP_SECRET_ITERATIONS,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    data: bytesToBase64(new Uint8Array(cipher)),
  };
}

export async function decryptBackupSecrets(encrypted, password) {
  if (!encrypted?.data || !encrypted?.salt || !encrypted?.iv) {
    return {};
  }
  if (!password) {
    throw new Error("Senha necessária para restaurar as chaves do backup.");
  }

  try {
    const key = await deriveBackupKey(password, base64ToBytes(encrypted.salt));
    const plain = await getCrypto().subtle.decrypt(
      { name: BACKUP_SECRET_ALGORITHM, iv: base64ToBytes(encrypted.iv) },
      key,
      base64ToBytes(encrypted.data),
    );
    return JSON.parse(new TextDecoder().decode(plain));
  } catch {
    throw new Error("Senha incorreta ou chaves do backup corrompidas.");
  }
}

function safeParseJson(value, fallback = null) {
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
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage quota excedida ou modo privado — ignorar silenciosamente
  }
  return value;
}

export function normalizeSettings(raw, defaults, openRouterModels, groqModels = []) {
  return normalizeSettingsWithFallback(
    raw,
    defaults,
    openRouterModels,
    groqModels,
  ).settings;
}

export function normalizeSettingsWithFallback(raw, defaults, openRouterModels, groqModels = []) {
  const settings = {
    ...defaults,
    ...(raw && typeof raw === "object" ? raw : {}),
  };
  const fallbacks = [];

  if (!openRouterModels.some((model) => model.value === settings.textModel)) {
    fallbacks.push({
      provider: "openrouter",
      settingKey: "textModel",
      previousValue: settings.textModel,
      nextValue: defaults.textModel,
    });
    settings.textModel = defaults.textModel;
  }

  if (!groqModels.some((model) => model.value === settings.groqModel)) {
    fallbacks.push({
      provider: "groq",
      settingKey: "groqModel",
      previousValue: settings.groqModel,
      nextValue: defaults.groqModel,
    });
    settings.groqModel = defaults.groqModel;
  }

  if (!["openrouter", "groq", "gemini"].includes(settings.textProvider)) {
    settings.textProvider = defaults.textProvider;
  }

  return {
    settings,
    fallbacks,
  };
}

function normalizeAgents(rawAgents) {
  if (!Array.isArray(rawAgents)) {
    return [];
  }

  return rawAgents.filter((agent) => agent && typeof agent.id === "string");
}

function normalizeChats(rawChats, validAgentIds) {
  if (!Array.isArray(rawChats)) {
    return [];
  }

  return rawChats
    .filter((chat) => {
      if (!chat || typeof chat.id !== "string" || typeof chat.agentId !== "string") {
        return false;
      }

      const normalizedAgentId = chat.agentId === NO_AGENT_ID ? GENERAL_AGENT_ID : chat.agentId;
      if (!validAgentIds.has(normalizedAgentId)) {
        return false;
      }

      return Array.isArray(chat.messages);
    })
    .map((chat) => ({
      ...chat,
      agentId: chat.agentId === NO_AGENT_ID ? GENERAL_AGENT_ID : chat.agentId,
      titleMode: chat.titleMode === "manual" ? "manual" : "auto",
      responseMode: normalizeResponseMode(chat.responseMode),
      documentBriefs: Array.isArray(chat.documentBriefs) ? chat.documentBriefs : [],
      documentSynthesis: typeof chat.documentSynthesis === "string" ? chat.documentSynthesis : "",
    }));
}

function splitSettingsSecrets(settings = {}) {
  const publicSettings = { ...(settings || {}) };
  const secrets = {};

  SECRET_SETTING_KEYS.forEach((key) => {
    if (publicSettings[key]) {
      secrets[key] = publicSettings[key];
      publicSettings[key] = "";
    }
  });

  if (publicSettings.supabaseConfig?.key) {
    secrets.supabaseConfig = { ...publicSettings.supabaseConfig };
    publicSettings.supabaseConfig = {
      ...publicSettings.supabaseConfig,
      key: "",
    };
  }

  return { publicSettings, secrets };
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

  const requestedAgentId = nextView.activeAgentId === NO_AGENT_ID ? GENERAL_AGENT_ID : nextView.activeAgentId;
  let activeAgentId = validAgentIds.has(requestedAgentId)
    ? requestedAgentId
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
      pubmedMode: Boolean(nextView.pubmedMode),
      pubmedResultLimit: Number(nextView.pubmedResultLimit) > 0 ? Number(nextView.pubmedResultLimit) : 5,
      smartMode: Boolean(nextView.smartMode),
      webSearchMode: Boolean(nextView.webSearchMode),
      modelGuidanceCollapsed:
        typeof nextView.modelGuidanceCollapsed === "boolean"
          ? nextView.modelGuidanceCollapsed
          : false,
      agentSummaryCollapsed:
        typeof nextView.agentSummaryCollapsed === "boolean"
          ? nextView.agentSummaryCollapsed
          : true,
      instagramFormat: typeof nextView.instagramFormat === "string" ? nextView.instagramFormat : "story_9_16",
      creativeFormDraft:
        nextView.creativeFormDraft && typeof nextView.creativeFormDraft === "object"
          ? nextView.creativeFormDraft
          : {},
    },
  };
}

export function buildBackupPayload(storage) {
  const settings = readStorageJson(storage, STORAGE_KEYS.settings, null);
  const sanitizedSettings = settings ? splitSettingsSecrets(settings).publicSettings : null;

  return {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    femicgpt_chats: storage.getItem(STORAGE_KEYS.chats),
    femicgpt_secure_chats: storage.getItem(STORAGE_KEYS.secureChats),
    femicgpt_agents: storage.getItem(STORAGE_KEYS.agents),
    femicgpt_brands: storage.getItem(STORAGE_KEYS.brands),
    femicgpt_settings: sanitizedSettings ? JSON.stringify(sanitizedSettings) : storage.getItem(STORAGE_KEYS.settings),
    femicgpt_view: storage.getItem(STORAGE_KEYS.view),
    exportedAt: new Date().toISOString(),
  };
}

export async function buildBackupPayloadWithSecrets(storage, password) {
  const payload = buildBackupPayload(storage);
  const settings = readStorageJson(storage, STORAGE_KEYS.settings, {});
  const { secrets } = splitSettingsSecrets(settings);
  payload.encryptedSecrets = await encryptBackupSecrets(secrets, password);
  return payload;
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
    secureChats: parseJsonField(backup.femicgpt_secure_chats),
    settings: parseJsonField(backup.femicgpt_settings),
    view: parseJsonField(backup.femicgpt_view),
    encryptedSecrets: backup.encryptedSecrets || null,
  };
}

export function applyParsedBackup(storage, parsedBackup, restoredSecrets = null) {
  if (parsedBackup?.agents) {
    writeStorageJson(storage, STORAGE_KEYS.agents, parsedBackup.agents);
  }
  if (parsedBackup?.chats) {
    writeStorageJson(storage, STORAGE_KEYS.chats, parsedBackup.chats);
  }
  if (parsedBackup?.secureChats) {
    writeStorageJson(storage, STORAGE_KEYS.secureChats, parsedBackup.secureChats);
  }
  if (parsedBackup?.brands) {
    writeStorageJson(storage, STORAGE_KEYS.brands, parsedBackup.brands);
  }
  if (parsedBackup?.settings) {
    writeStorageJson(storage, STORAGE_KEYS.settings, {
      ...parsedBackup.settings,
      ...(restoredSecrets || {}),
    });
  }
  if (parsedBackup?.view) {
    writeStorageJson(storage, STORAGE_KEYS.view, parsedBackup.view);
  }
}
