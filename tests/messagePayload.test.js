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

test("buildChatMessages appends response style to the agent prompt", () => {
  const payload = buildChatMessages({
    globalSystemPrompt: "",
    agentSystemPrompt: "Você é um analista.",
    responseStyle: "Responda com subtítulos curtos e bullets.",
    history: [],
    userMessage: "Analise este caso.",
  });

  assert.equal(payload[0].role, "system");
  assert.match(payload[0].content, /Você é um analista/);
  assert.match(payload[0].content, /Estilo de resposta/);
  assert.match(payload[0].content, /subtítulos curtos/);
});

test("buildChatMessages no longer accepts responseDepthInstruction", () => {
  const payload = buildChatMessages({
    globalSystemPrompt: "",
    agentSystemPrompt: "Você é um professor clínico.",
    responseStyle: "Use tabelas quando fizer sentido.",
    history: [],
    userMessage: "Explique o artigo.",
  });

  assert.equal(payload[0].role, "system");
  assert.match(payload[0].content, /professor clínico/i);
  assert.match(payload[0].content, /Estilo de resposta/);
  assert.doesNotMatch(payload[0].content, /Profundidade da resposta|Modo Aula|capítulos/);
});

test("buildChatMessages sends visual PDF pages with the final user message", () => {
  const payload = buildChatMessages({
    history: [],
    userMessage: "Resuma o PDF anexado.",
    imageDataUrls: [
      { dataUrl: "data:image/jpeg;base64,abc123", name: "Pagina 1" },
    ],
  });

  assert.equal(payload.length, 1);
  assert.equal(payload[0].role, "user");
  assert.equal(payload[0].content[0].text, "Resuma o PDF anexado.");
  assert.equal(payload[0].content[1].image_url.url, "data:image/jpeg;base64,abc123");
});
