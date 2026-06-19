import test from "node:test";
import assert from "node:assert/strict";

import { buildChatMessages } from "../js/messagePayload.js";

test("buildChatMessages prepends global prompt before agent prompt", () => {
  const payload = buildChatMessages({
    globalSystemPrompt: "Seja conciso e organizado.",
    agentSystemPrompt: "Você é um assistente de planejamento.",
    history: [
      { role: "user", content: "Quero organizar a semana." },
      { role: "assistant", content: "Vamos por blocos." },
    ],
    userMessage: "Comece pela segunda-feira.",
  });

  assert.equal(payload[0].role, "system");
  assert.match(payload[0].content, /Seja conciso e organizado/);
  assert.equal(payload[1].role, "system");
  assert.match(payload[1].content, /assistente de planejamento/i);
  assert.equal(payload.at(-1).content, "Comece pela segunda-feira.");
});

test("buildChatMessages injects attachment and reference context before final user message", () => {
  const payload = buildChatMessages({
    globalSystemPrompt: "",
    agentSystemPrompt: "Ajude.",
    history: [],
    attachmentContext: "Arquivo A: pontos principais",
    referenceContext: "Fonte web: resumo validado",
    userMessage: "Resuma tudo.",
  });

  assert.equal(payload.length, 4);
  assert.match(payload[1].content, /referência complementar/i);
  assert.match(payload[2].content, /fontes consultadas/i);
  assert.equal(payload[3].content, "Resuma tudo.");
});
