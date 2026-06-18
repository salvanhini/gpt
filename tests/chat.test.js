import test from "node:test";
import assert from "node:assert/strict";

import {
  addMessage,
  createChat,
  loadChats,
  saveChats,
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
