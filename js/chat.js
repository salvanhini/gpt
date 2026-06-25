import { SECURE_AGENT_ID } from "./agents.js";
import { syncMessageToSupabase, isSupabaseConfigured, getSessionId } from "./supabaseSync.js";

const CHATS_KEY = "femicgpt:chats";
const SECURE_CHATS_KEY = "femicgpt:secure_chats";

export const CHAT_CATEGORIES = [
  { id: "", label: "Sem categoria", color: "#94A3B8" },
  { id: "trabalho", label: "Trabalho", color: "#3B82F6" },
  { id: "pessoal", label: "Pessoal", color: "#10B981" },
  { id: "estudo", label: "Estudo", color: "#8B5CF6" },
  { id: "criativo", label: "Criativo", color: "#F59E0B" },
  { id: "tecnico", label: "Técnico", color: "#64748B" },
];

export function getCategoryById(id) {
  return CHAT_CATEGORIES.find((cat) => cat.id === id) || CHAT_CATEGORIES[0];
}

function safeParse(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

export function loadChats() {
  return [
    ...safeParse(localStorage.getItem(CHATS_KEY), []),
    ...safeParse(localStorage.getItem(SECURE_CHATS_KEY), []),
  ];
}

export function saveChats(chats) {
  try {
    const normalizedChats = Array.isArray(chats) ? chats : [];
    const normalChats = normalizedChats.filter((chat) => chat?.agentId !== SECURE_AGENT_ID);
    const secureChats = normalizedChats.filter((chat) => chat?.agentId === SECURE_AGENT_ID);
    localStorage.setItem(CHATS_KEY, JSON.stringify(normalChats));
    localStorage.setItem(SECURE_CHATS_KEY, JSON.stringify(secureChats));
  } catch {
    // Storage quota excedida ou modo privado
  }
  return chats;
}

export function isSecureChat(chat) {
  return chat?.agentId === SECURE_AGENT_ID;
}

export function createChat(agentId) {
  return {
    id: crypto.randomUUID(),
    agentId,
    title: "Nova conversa",
    titleMode: "auto",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    category: "",
    summary: "",
    pinned: false,
    messages: [],
  };
}

export function addMessage(chatId, message) {
  const chats = loadChats();
  const chat = chats.find((item) => item.id === chatId);
  if (!chat) {
    throw new Error("Conversa não encontrada.");
  }

  const newMsg = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    meta: {},
    ...message,
  };
  chat.messages.push(newMsg);
  chat.updatedAt = new Date().toISOString();

  if (chat.titleMode !== "manual" && chat.title === "Nova conversa" && message.role === "user") {
    chat.title = createChatTitle(message.content);
    chat.titleMode = "auto";
  }

  saveChats(chats);

  if (!isSecureChat(chat) && isSupabaseConfigured()) {
    newMsg.meta.cloudStatus = "pending";
    syncMessageToSupabase(newMsg, getSessionId()).then((ok) => {
      newMsg.meta.cloudStatus = ok ? "synced" : "error";
      try {
        const fresh = loadChats();
        const freshChat = fresh.find((c) => c.id === chatId);
        const freshMsg = freshChat?.messages.find((m) => m.id === newMsg.id);
        if (freshMsg) {
          freshMsg.meta.cloudStatus = newMsg.meta.cloudStatus;
          saveChats(fresh);
        }
      } catch {
        // best effort
      }
    }).catch(() => {
      newMsg.meta.cloudStatus = "error";
    });
  }

  return chat;
}

export function updateMessageContent(chatId, messageId, content, extra = {}) {
  const chats = loadChats();
  const chat = chats.find((item) => item.id === chatId);
  if (!chat) return;

  const message = chat.messages.find((item) => item.id === messageId);
  if (!message) return;

  message.content = content;
  if (extra.meta) Object.assign(message.meta, extra.meta);
  chat.updatedAt = new Date().toISOString();
  saveChats(chats);
}

export function updateChat(chatId, partial) {
  const chats = loadChats();
  const chat = chats.find((item) => item.id === chatId);
  if (!chat) {
    throw new Error("Conversa não encontrada.");
  }

  Object.assign(chat, partial, { updatedAt: new Date().toISOString() });
  saveChats(chats);
  return chat;
}

export function updateChatTitle(chatId, title) {
  return updateChat(chatId, { title, titleMode: "manual" });
}

export function updateChatCategory(chatId, category) {
  return updateChat(chatId, { category });
}

export function updateMessageCategory(chatId, messageId, category) {
  const chats = loadChats();
  const chat = chats.find((item) => item.id === chatId);
  if (!chat) {
    throw new Error("Conversa não encontrada.");
  }

  const message = chat.messages.find((item) => item.id === messageId);
  if (!message) {
    throw new Error("Mensagem não encontrada.");
  }

  message.meta = {
    ...(message.meta || {}),
    category,
  };
  chat.updatedAt = new Date().toISOString();

  saveChats(chats);
  return message;
}

export function getChatsByAgent(agentId, category = "") {
  const chats = loadChats()
    .filter((chat) => chat.agentId === agentId)
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  if (category) {
    return chats.filter((chat) => chat.category === category);
  }
  return chats;
}

export function createChatTitle(content) {
  return content.replace(/\s+/g, " ").trim().slice(0, 48) || "Nova conversa";
}
