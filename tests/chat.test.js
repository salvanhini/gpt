import test from "node:test";
import assert from "node:assert/strict";

import {
  addMessage,
  addChatAttachments,
  clearChatAttachments,
  createChat,
  loadChats,
  removeChatAttachment,
  saveChats,
  updateChatTitle,
  updateMessageCategory,
} from "../js/chat.js";
import { SECURE_AGENT_ID } from "../js/agents.js";

function createMemoryStorage() {
  const store = new Map();
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
    dump() {
      return Object.fromEntries(store.entries());
    },
  };
}

test("updateMessageCategory persists the selected category inside message meta", () => {
  const previousStorage = globalThis.localStorage;
  const memoryStorage = createMemoryStorage();
  globalThis.localStorage = memoryStorage;

  try {
    const chat = createChat("agent-general");
    saveChats([chat]);

    addMessage(chat.id, {
      role: "user",
      content: "Organize esta ideia",
      meta: { kind: "text" },
    });

    const [createdChat] = loadChats();
    const [createdMessage] = createdChat.messages;

    updateMessageCategory(createdChat.id, createdMessage.id, "trabalho");

    const [updatedChat] = loadChats();
    assert.equal(updatedChat.messages[0].meta.category, "trabalho");
  } finally {
    globalThis.localStorage = previousStorage;
  }
});

test("createChat starts in automatic title mode", () => {
  const chat = createChat("agent-general");

  assert.equal(chat.title, "Nova conversa");
  assert.equal(chat.titleMode, "auto");
  assert.deepEqual(chat.attachments, []);
});

test("addMessage generates automatic title only while chat remains in auto mode", () => {
  const previousStorage = globalThis.localStorage;
  const memoryStorage = createMemoryStorage();
  globalThis.localStorage = memoryStorage;

  try {
    const chat = createChat("agent-general");
    saveChats([chat]);

    addMessage(chat.id, {
      role: "user",
      content: "Preciso organizar minhas tarefas da semana",
    });

    let [storedChat] = loadChats();
    assert.equal(storedChat.title, "Preciso organizar minhas tarefas da semana");
    assert.equal(storedChat.titleMode, "auto");

    updateChatTitle(chat.id, "Planejamento semanal");
    storedChat = loadChats()[0];
    assert.equal(storedChat.title, "Planejamento semanal");
    assert.equal(storedChat.titleMode, "manual");

    addMessage(chat.id, {
      role: "user",
      content: "Agora quero incluir metas pessoais também",
    });

    [storedChat] = loadChats();
    assert.equal(storedChat.title, "Planejamento semanal");
    assert.equal(storedChat.titleMode, "manual");
  } finally {
    globalThis.localStorage = previousStorage;
  }
});

test("saveChats separates secure local conversations from normal conversations", () => {
  const previousStorage = globalThis.localStorage;
  const memoryStorage = createMemoryStorage();
  globalThis.localStorage = memoryStorage;

  try {
    const normalChat = createChat("agent-general");
    const secureChat = createChat(SECURE_AGENT_ID);

    saveChats([normalChat, secureChat]);

    const dump = memoryStorage.dump();
    assert.equal(JSON.parse(dump["femicgpt:chats"]).length, 1);
    assert.equal(JSON.parse(dump["femicgpt:secure_chats"]).length, 1);
    assert.deepEqual(loadChats().map((chat) => chat.id).sort(), [normalChat.id, secureChat.id].sort());
  } finally {
    globalThis.localStorage = previousStorage;
  }
});

test("chat attachments persist until explicitly removed or cleared", () => {
  const previousStorage = globalThis.localStorage;
  const memoryStorage = createMemoryStorage();
  globalThis.localStorage = memoryStorage;

  try {
    const chat = createChat("agent-general");
    saveChats([chat]);

    const [firstAttachment] = addChatAttachments(chat.id, [
      {
        name: "artigo-a.pdf",
        type: "pdf",
        size: 1024,
        summary: "artigo-a.pdf (PDF)",
        contextBlock: "Arquivo: artigo-a.pdf\nConteudo A",
      },
    ]);

    let [storedChat] = loadChats();
    assert.equal(storedChat.attachments.length, 1);
    assert.equal(storedChat.attachments[0].id, firstAttachment.id);
    assert.ok(storedChat.documentContextUpdatedAt);
    const firstContextVersion = storedChat.documentContextVersion;

    addMessage(chat.id, {
      role: "user",
      content: "Resuma o artigo",
      meta: { attachments: storedChat.attachments },
    });

    [storedChat] = loadChats();
    assert.equal(storedChat.attachments.length, 1);

    removeChatAttachment(chat.id, firstAttachment.id);
    [storedChat] = loadChats();
    assert.equal(storedChat.attachments.length, 0);
    assert.ok(storedChat.documentContextVersion > firstContextVersion);

    addChatAttachments(chat.id, [
      {
        name: "artigo-b.pdf",
        type: "pdf",
        size: 2048,
        summary: "artigo-b.pdf (PDF)",
        contextBlock: "Arquivo: artigo-b.pdf\nConteudo B",
      },
    ]);
    const afterSecondAddVersion = loadChats()[0].documentContextVersion;
    clearChatAttachments(chat.id);

    [storedChat] = loadChats();
    assert.deepEqual(storedChat.attachments, []);
    assert.ok(storedChat.documentContextVersion > afterSecondAddVersion);
  } finally {
    globalThis.localStorage = previousStorage;
  }
});
