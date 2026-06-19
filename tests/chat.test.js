import test from "node:test";
import assert from "node:assert/strict";

import {
  addMessage,
  createChat,
  loadChats,
  saveChats,
  updateChatTitle,
  updateMessageCategory,
} from "../js/chat.js";

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
