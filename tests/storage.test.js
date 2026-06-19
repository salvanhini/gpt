import test from "node:test";
import assert from "node:assert/strict";

import {
  applyParsedBackup,
  BACKUP_SCHEMA_VERSION,
  buildBackupPayload,
  normalizeSettings,
  normalizeSettingsWithFallback,
  parseBackupPayload,
  reconcileAppData,
} from "../js/storage.js";

function createMemoryStorage(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    dump() {
      return Object.fromEntries(store.entries());
    },
  };
}

function createDefaultAgents() {
  return [
    {
      id: "agent-general",
      name: "Assistente Geral",
      description: "Padrao",
      systemPrompt: "Ajude",
      createdAt: "2026-01-01T00:00:00.000Z",
    },
  ];
}

function createChat(agentId, suffix = "1") {
  return {
    id: `chat-${suffix}`,
    agentId,
    title: "Nova conversa",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    messages: [],
  };
}

test("buildBackupPayload adds schema version while preserving current keys", () => {
  const storage = createMemoryStorage({
    "femicgpt:chats": JSON.stringify([{ id: "chat-1" }]),
    "femicgpt:agents": JSON.stringify([{ id: "agent-general" }]),
    "femicgpt:brands": JSON.stringify([{ id: "brand-a" }]),
    "femicgpt:settings": JSON.stringify({ textProvider: "openrouter" }),
    "femicgpt:view": JSON.stringify({ activeAgentId: "agent-general" }),
  });

  const payload = buildBackupPayload(storage);

  assert.equal(payload.schemaVersion, BACKUP_SCHEMA_VERSION);
  assert.equal(payload.femicgpt_chats, storage.getItem("femicgpt:chats"));
  assert.equal(payload.femicgpt_agents, storage.getItem("femicgpt:agents"));
  assert.equal(payload.femicgpt_brands, storage.getItem("femicgpt:brands"));
  assert.equal(payload.femicgpt_settings, storage.getItem("femicgpt:settings"));
  assert.equal(payload.femicgpt_view, storage.getItem("femicgpt:view"));
});

test("parseBackupPayload accepts legacy backups and drops invalid sections", () => {
  const backup = JSON.stringify({
    femicgpt_agents: JSON.stringify([{ id: "agent-general", name: "Ok" }]),
    femicgpt_brands: JSON.stringify([{ id: "brand-a", name: "Marca A" }]),
    femicgpt_chats: "{invalid-json",
    femicgpt_settings: JSON.stringify({ textProvider: "openrouter" }),
    femicgpt_view: JSON.stringify({ activeAgentId: "agent-general" }),
  });

  const parsed = parseBackupPayload(backup);

  assert.deepEqual(parsed.agents, [{ id: "agent-general", name: "Ok" }]);
  assert.deepEqual(parsed.brands, [{ id: "brand-a", name: "Marca A" }]);
  assert.equal(parsed.chats, null);
  assert.deepEqual(parsed.settings, { textProvider: "openrouter" });
  assert.deepEqual(parsed.view, { activeAgentId: "agent-general" });
});

test("parseBackupPayload throws for invalid backup files", () => {
  assert.throws(
    () => parseBackupPayload("not-json"),
    /arquivo inválido/i,
  );
});

test("reconcileAppData seeds default agent and chat when storage is empty", () => {
  const reconciled = reconcileAppData({
    agents: [],
    chats: [],
    view: {},
    defaultAgents: createDefaultAgents,
    createChat: (agentId) => createChat(agentId),
  });

  assert.equal(reconciled.agents.length, 1);
  assert.equal(reconciled.chats.length, 1);
  assert.equal(reconciled.activeAgentId, "agent-general");
  assert.equal(reconciled.activeChatId, "chat-1");
});

test("reconcileAppData repairs dangling active pointers and orphan chats", () => {
  const reconciled = reconcileAppData({
    agents: [
      { id: "agent-a", name: "A" },
      { id: "agent-b", name: "B" },
    ],
    chats: [
      createChat("agent-a", "a1"),
      createChat("ghost-agent", "ghost"),
    ],
    view: {
      activeAgentId: "ghost-agent",
      activeChatId: "ghost",
      imageMode: true,
      sidebarCollapsed: true,
      pubmedMode: true,
      pubmedResultLimit: 8,
    },
    defaultAgents: createDefaultAgents,
    createChat: (agentId) => createChat(agentId, "fallback"),
  });

  assert.deepEqual(
    reconciled.chats.map((chat) => chat.id),
    ["chat-a1"],
  );
  assert.equal(reconciled.activeAgentId, "agent-a");
  assert.equal(reconciled.activeChatId, "chat-a1");
  assert.equal(reconciled.view.imageMode, true);
  assert.equal(reconciled.view.sidebarCollapsed, true);
  assert.equal(reconciled.view.pubmedMode, true);
  assert.equal(reconciled.view.pubmedResultLimit, 8);
  assert.equal(reconciled.view.webSearchMode, false);
});

test("applyParsedBackup only replaces valid sections and preserves healthy ones", () => {
  const storage = createMemoryStorage({
    "femicgpt:agents": JSON.stringify([{ id: "agent-existing" }]),
    "femicgpt:brands": JSON.stringify([{ id: "brand-existing" }]),
    "femicgpt:chats": JSON.stringify([{ id: "chat-existing" }]),
    "femicgpt:settings": JSON.stringify({ textProvider: "openrouter" }),
    "femicgpt:view": JSON.stringify({ activeAgentId: "agent-existing" }),
  });

  applyParsedBackup(storage, {
    agents: [{ id: "agent-imported" }],
    brands: [{ id: "brand-imported" }],
    chats: null,
    settings: { textProvider: "deepseek" },
    view: null,
  });

  const dump = storage.dump();
  assert.equal(dump["femicgpt:agents"], JSON.stringify([{ id: "agent-imported" }]));
  assert.equal(dump["femicgpt:brands"], JSON.stringify([{ id: "brand-imported" }]));
  assert.equal(dump["femicgpt:chats"], JSON.stringify([{ id: "chat-existing" }]));
  assert.equal(dump["femicgpt:settings"], JSON.stringify({ textProvider: "deepseek" }));
  assert.equal(dump["femicgpt:view"], JSON.stringify({ activeAgentId: "agent-existing" }));
});

test("normalizeSettings accepts groq provider and repairs invalid groq model", () => {
  const defaults = {
    textProvider: "openrouter",
    textModel: "qwen/qwen3.7-plus",
    deepSeekModel: "deepseek-v4-flash",
    groqModel: "openai/gpt-oss-20b",
  };

  const normalized = normalizeSettings(
    {
      textProvider: "groq",
      groqModel: "invalid-model",
    },
    defaults,
    [{ value: "qwen/qwen3.7-plus" }],
    [{ value: "deepseek-v4-flash" }],
    [{ value: "openai/gpt-oss-20b" }],
  );

  assert.equal(normalized.textProvider, "groq");
  assert.equal(normalized.groqModel, "openai/gpt-oss-20b");
});

test("normalizeSettingsWithFallback reports repairs for invalid saved models", () => {
  const defaults = {
    textProvider: "openrouter",
    textModel: "qwen/qwen3.7-plus",
    deepSeekModel: "deepseek-v4-flash",
    groqModel: "openai/gpt-oss-20b",
  };

  const normalized = normalizeSettingsWithFallback(
    {
      textProvider: "deepseek",
      textModel: "expired-openrouter-model",
      deepSeekModel: "expired-deepseek-model",
      groqModel: "expired-groq-model",
    },
    defaults,
    [{ value: "qwen/qwen3.7-plus" }],
    [{ value: "deepseek-v4-flash" }],
    [{ value: "openai/gpt-oss-20b" }],
  );

  assert.equal(normalized.settings.textProvider, "deepseek");
  assert.equal(normalized.settings.textModel, "qwen/qwen3.7-plus");
  assert.equal(normalized.settings.deepSeekModel, "deepseek-v4-flash");
  assert.equal(normalized.settings.groqModel, "openai/gpt-oss-20b");
  assert.equal(normalized.fallbacks.length, 3);
  assert.deepEqual(
    normalized.fallbacks.map((item) => item.provider),
    ["openrouter", "deepseek", "groq"],
  );
});

test("reconcileAppData preserves web search mode in view state", () => {
  const reconciled = reconcileAppData({
    agents: [{ id: "agent-a", name: "A" }],
    chats: [createChat("agent-a", "a1")],
    view: {
      activeAgentId: "agent-a",
      activeChatId: "chat-a1",
      webSearchMode: true,
    },
    defaultAgents: createDefaultAgents,
    createChat: (agentId) => createChat(agentId, "fallback"),
  });

  assert.equal(reconciled.view.webSearchMode, true);
});

test("reconcileAppData preserves model guidance collapsed state in view", () => {
  const reconciled = reconcileAppData({
    agents: [{ id: "agent-a", name: "A" }],
    chats: [createChat("agent-a", "a1")],
    view: {
      activeAgentId: "agent-a",
      activeChatId: "chat-a1",
      modelGuidanceCollapsed: true,
    },
    defaultAgents: createDefaultAgents,
    createChat: (agentId) => createChat(agentId, "fallback"),
  });

  assert.equal(reconciled.view.modelGuidanceCollapsed, true);
});
