import test from "node:test";
import assert from "node:assert/strict";

import {
  buildOpenRouterRequestBody,
  buildGroqRequestBody,
  getDefaultSettings,
  sendTextMessage,
} from "../js/api.js";

test("buildGroqRequestBody enables browser search when web search mode is active", () => {
  const settings = {
    ...getDefaultSettings(),
    textProvider: "groq",
    groqModel: "openai/gpt-oss-20b",
  };

  const body = buildGroqRequestBody({
    messages: [{ role: "user", content: "O que aconteceu hoje em IA?" }],
    settings,
    webSearchMode: true,
  });

  assert.equal(body.model, "openai/gpt-oss-20b");
  assert.equal(body.tool_choice, "required");
  assert.deepEqual(body.tools, [{ type: "browser_search" }]);
  assert.equal(body.messages[0].role, "system");
  assert.match(body.messages[0].content, /internet/i);
});

test("buildGroqRequestBody falls back to a browser-search-compatible model", () => {
  const settings = {
    ...getDefaultSettings(),
    textProvider: "groq",
    groqModel: "llama-3.1-8b-instant",
  };

  const body = buildGroqRequestBody({
    messages: [{ role: "user", content: "Resumo de noticias" }],
    settings,
    webSearchMode: true,
  });

  assert.equal(body.model, "openai/gpt-oss-20b");
});

test("buildOpenRouterRequestBody enables web search server tool", () => {
  const settings = {
    ...getDefaultSettings(),
    textProvider: "openrouter",
    textModel: "qwen/qwen3.7-plus",
  };

  const body = buildOpenRouterRequestBody({
    messages: [{ role: "user", content: "Pesquise noticias de IA" }],
    settings,
    webSearchMode: true,
  });

  assert.equal(body.model, "qwen/qwen3.7-plus");
  assert.equal(body.tools[0].type, "openrouter:web_search");
  assert.equal(body.tools[0].parameters.max_results, 5);
  assert.equal(body.messages[0].role, "system");
});

test("sendTextMessage rejects web search on direct deepseek", async () => {
  await assert.rejects(
    () =>
      sendTextMessage({
        messages: [{ role: "user", content: "Busque isso na web" }],
        settings: {
          ...getDefaultSettings(),
          textProvider: "deepseek",
        },
        webSearchMode: true,
      }),
    /Groq ou OpenRouter/i,
  );
});

test("sendTextMessage sends Groq browser search payload and returns content", async () => {
  const originalFetch = global.fetch;
  let requestUrl = "";
  let requestBody = null;

  global.fetch = async (url, options) => {
    requestUrl = url;
    requestBody = JSON.parse(options.body);
    return {
      ok: true,
      async json() {
        return {
          choices: [
            {
              message: {
                content: "Resumo com fontes.",
              },
            },
          ],
        };
      },
    };
  };

  try {
    const reply = await sendTextMessage({
      messages: [{ role: "user", content: "Novidades de IA esta semana" }],
      settings: {
        ...getDefaultSettings(),
        textProvider: "groq",
        groqKey: "gsk_test",
        groqModel: "openai/gpt-oss-20b",
      },
      webSearchMode: true,
    });

    assert.equal(requestUrl, "https://api.groq.com/openai/v1/chat/completions");
    assert.equal(requestBody.tool_choice, "required");
    assert.deepEqual(requestBody.tools, [{ type: "browser_search" }]);
    assert.equal(reply.content, "Resumo com fontes.");
  } finally {
    global.fetch = originalFetch;
  }
});

test("sendTextMessage sends OpenRouter web search payload and returns content", async () => {
  const originalFetch = global.fetch;
  let requestUrl = "";
  let requestBody = null;
  global.window = { location: { href: "http://localhost:4173" } };

  global.fetch = async (url, options) => {
    requestUrl = url;
    requestBody = JSON.parse(options.body);
    return {
      ok: true,
      async json() {
        return {
          choices: [
            {
              message: {
                content: "Resposta com busca web da OpenRouter.",
              },
            },
          ],
        };
      },
    };
  };

  try {
    const reply = await sendTextMessage({
      messages: [{ role: "user", content: "O que saiu hoje?" }],
      settings: {
        ...getDefaultSettings(),
        textProvider: "openrouter",
        openRouterKey: "sk-or-test",
        textModel: "qwen/qwen3.7-plus",
      },
      webSearchMode: true,
    });

    assert.equal(requestUrl, "https://openrouter.ai/api/v1/chat/completions");
    assert.equal(requestBody.tools[0].type, "openrouter:web_search");
    assert.equal(reply.content, "Resposta com busca web da OpenRouter.");
  } finally {
    global.fetch = originalFetch;
    delete global.window;
  }
});
