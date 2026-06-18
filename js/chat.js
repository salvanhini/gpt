const CHATS_KEY = "femicgpt:chats";

function safeParse(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

export function loadChats() {
  return safeParse(localStorage.getItem(CHATS_KEY), []);
}

export function saveChats(chats) {
  localStorage.setItem(CHATS_KEY, JSON.stringify(chats));
  return chats;
}

export function createChat(agentId) {
  return {
    id: crypto.randomUUID(),
    agentId,
    title: "Nova conversa",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: [],
  };
}

export function addMessage(chatId, message) {
  const chats = loadChats();
  const chat = chats.find((item) => item.id === chatId);
  if (!chat) {
    throw new Error("Conversa não encontrada.");
  }

  chat.messages.push({
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    meta: {},
    ...message,
  });
  chat.updatedAt = new Date().toISOString();

  if (chat.title === "Nova conversa" && message.role === "user") {
    chat.title = createChatTitle(message.content);
  }

  saveChats(chats);
  return chat;
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
  return updateChat(chatId, { title });
}

export function getChatsByAgent(agentId) {
  return loadChats()
    .filter((chat) => chat.agentId === agentId)
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

export function createChatTitle(content) {
  return content.replace(/\s+/g, " ").trim().slice(0, 48) || "Nova conversa";
}
