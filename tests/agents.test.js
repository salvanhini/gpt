import test from "node:test";
import assert from "node:assert/strict";

import {
  BRASIL_AGENT_ID,
  createAgent,
  createAgentId,
  duplicateAgent,
  getDefaultAgents,
  getEffectiveAgentSettings,
  loadAgents,
  restoreDefaultAgents,
  saveAgents,
} from "../js/agents.js";
import { INSTAGRAM_AGENT_ID } from "../js/instagramCreator.js";

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

test("createAgentId appends a suffix when the slug already exists", () => {
  const id = createAgentId("Assistente Geral", [
    { id: "agent-assistente-geral" },
    { id: "agent-outro" },
  ]);

  assert.equal(id, "agent-assistente-geral-2");
});

test("createAgentId falls back to a generated token when the name is empty", () => {
  const id = createAgentId("   ", [], () => "uuid-123");

  assert.equal(id, "agent-uuid-123");
});

test("getDefaultAgents includes the dedicated Instagram producer", () => {
  const agents = getDefaultAgents();

  assert.equal(agents.some((agent) => agent.id === INSTAGRAM_AGENT_ID), true);
});

test("getDefaultAgents includes the dedicated Brasil consultant", () => {
  const agents = getDefaultAgents();

  assert.equal(agents.some((agent) => agent.id === BRASIL_AGENT_ID), true);
});

test("loadAgents normalizes legacy agents with safe parameter defaults", () => {
  const previousStorage = globalThis.localStorage;
  globalThis.localStorage = createMemoryStorage();

  try {
    globalThis.localStorage.setItem("femicgpt:agents", JSON.stringify([
      {
        id: "agent-legacy",
        name: "Legado",
        emoji: "L",
        description: "Agente antigo",
        systemPrompt: "Ajude.",
      },
    ]));

    const [agent] = loadAgents();

    assert.equal(agent.modelOverrideEnabled, false);
    assert.equal(agent.textProvider, "");
    assert.equal(agent.defaultImageMode, "inherit");
    assert.equal(agent.defaultWebSearchMode, "inherit");
    assert.equal(agent.defaultPubmedMode, "inherit");
    assert.equal(agent.responseStyle, "");
  } finally {
    globalThis.localStorage = previousStorage;
  }
});

test("createAgent persists model and mode parameters", () => {
  const previousStorage = globalThis.localStorage;
  globalThis.localStorage = createMemoryStorage();

  try {
    saveAgents(getDefaultAgents());

    const agent = createAgent({
      name: "Analista Premium",
      emoji: "A",
      description: "Analisa com profundidade",
      systemPrompt: "Seja analitico.",
      modelOverrideEnabled: true,
      textProvider: "groq",
      groqModel: "openai/gpt-oss-120b",
      defaultWebSearchMode: "on",
      responseStyle: "Responda com subtitulos curtos.",
    });

    assert.equal(agent.modelOverrideEnabled, true);
    assert.equal(agent.textProvider, "groq");
    assert.equal(agent.groqModel, "openai/gpt-oss-120b");
    assert.equal(agent.defaultWebSearchMode, "on");
    assert.equal(agent.responseStyle, "Responda com subtitulos curtos.");
  } finally {
    globalThis.localStorage = previousStorage;
  }
});

test("duplicateAgent copies behavior parameters into a new agent", () => {
  const previousStorage = globalThis.localStorage;
  globalThis.localStorage = createMemoryStorage();

  try {
    saveAgents([
      {
        id: "agent-source",
        name: "Fonte",
        emoji: "F",
        description: "Original",
        systemPrompt: "Ajude.",
        modelOverrideEnabled: true,
        textProvider: "openrouter",
        textModel: "deepseek/deepseek-v4-pro",
        defaultImageMode: "off",
        responseStyle: "Use bullets.",
      },
    ]);

    const copy = duplicateAgent("agent-source", () => "copy-id");

    assert.equal(copy.id, "agent-fonte-copia");
    assert.equal(copy.name, "Fonte copia");
    assert.equal(copy.modelOverrideEnabled, true);
    assert.equal(copy.textModel, "deepseek/deepseek-v4-pro");
    assert.equal(copy.defaultImageMode, "off");
    assert.equal(copy.responseStyle, "Use bullets.");
  } finally {
    globalThis.localStorage = previousStorage;
  }
});

test("restoreDefaultAgents refreshes defaults without removing custom agents", () => {
  const previousStorage = globalThis.localStorage;
  globalThis.localStorage = createMemoryStorage();

  try {
    saveAgents([
      {
        id: "agent-general",
        name: "Geral alterado",
        emoji: "X",
        description: "Alterado",
        systemPrompt: "Alterado",
        isDefault: true,
      },
      {
        id: "agent-custom",
        name: "Custom",
        emoji: "C",
        description: "Meu agente",
        systemPrompt: "Ajude.",
        isDefault: false,
      },
    ]);

    const agents = restoreDefaultAgents();

    assert.equal(agents.some((agent) => agent.id === "agent-custom"), true);
    assert.equal(agents.find((agent) => agent.id === "agent-general").name, "Assistente Geral");
  } finally {
    globalThis.localStorage = previousStorage;
  }
});

test("getEffectiveAgentSettings uses agent model only when override is enabled", () => {
  const baseSettings = {
    textProvider: "openrouter",
    textModel: "qwen/qwen3.7-plus",
    deepSeekModel: "deepseek-v4-flash",
    groqModel: "openai/gpt-oss-20b",
    openRouterKey: "or-key",
    groqKey: "groq-key",
  };

  assert.equal(
    getEffectiveAgentSettings(baseSettings, {
      modelOverrideEnabled: false,
      textProvider: "groq",
      groqModel: "openai/gpt-oss-120b",
    }).textProvider,
    "openrouter",
  );

  const effective = getEffectiveAgentSettings(baseSettings, {
    modelOverrideEnabled: true,
    textProvider: "groq",
    groqModel: "openai/gpt-oss-120b",
  });

  assert.equal(effective.textProvider, "groq");
  assert.equal(effective.groqModel, "openai/gpt-oss-120b");
  assert.equal(effective.openRouterKey, "or-key");
});
