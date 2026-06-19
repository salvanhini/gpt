import test from "node:test";
import assert from "node:assert/strict";

import {
  buildDuckDuckGoSearchUrl,
  buildBraveSearchUrl,
  buildTavilySearchBody,
  normalizeDuckDuckGoResults,
  normalizeBraveResults,
  normalizeTavilyResults,
  buildOpenRouterRequestBody,
  buildGroqRequestBody,
  getDefaultSettings,
  getModelSelectionDetails,
  runWebSearchQuery,
  searchDuckDuckGoFallback,
  sendTextMessage,
  transcribeAudio,
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

test("getModelSelectionDetails returns guidance badges for the active provider/model", () => {
  const details = getModelSelectionDetails({
    textProvider: "openrouter",
    textModel: "qwen/qwen3.7-plus",
  });

  assert.equal(details.providerLabel, "OpenRouter");
  assert.equal(details.label, "Qwen 3.7 Plus");
  assert.match(details.helperText, /produtividade/i);
  assert.ok(details.badges.includes("Rapido"));
  assert.ok(details.badges.includes("Equilibrado"));
});

test("getDefaultSettings includes a global system prompt field", () => {
  const settings = getDefaultSettings();

  assert.equal(settings.globalSystemPrompt, "");
});

test("buildDuckDuckGoSearchUrl encodes the query and default params", () => {
  const url = buildDuckDuckGoSearchUrl("noticias de ia");
  assert.match(url, /q=noticias\+de\+ia/);
  assert.match(url, /format=json/);
  assert.match(url, /no_redirect=1/);
});

test("normalizeDuckDuckGoResults maps abstract and related topics", () => {
  const results = normalizeDuckDuckGoResults({
    Heading: "OpenAI",
    AbstractText: "Resumo principal",
    AbstractURL: "https://duckduckgo.com/OpenAI",
    RelatedTopics: [
      { Text: "OpenAI - Empresa de IA", FirstURL: "https://duckduckgo.com/OpenAI_2" },
      { Name: "Grupo", Topics: [{ Text: "GPT - Modelo de linguagem", FirstURL: "https://duckduckgo.com/GPT" }] },
    ],
  });

  assert.equal(results.length, 3);
  assert.equal(results[0].title, "OpenAI");
  assert.equal(results[2].title, "GPT");
});

test("normalizes Tavily and Brave search results to the shared citation shape", () => {
  assert.deepEqual(buildTavilySearchBody("ia hoje").max_results, 5);
  assert.match(buildBraveSearchUrl("ia hoje"), /q=ia\+hoje/);

  const tavily = normalizeTavilyResults({
    results: [{ title: "Tavily result", url: "https://example.com/a", content: "Trecho A" }],
  });
  const brave = normalizeBraveResults({
    web: { results: [{ title: "Brave result", url: "https://example.com/b", description: "Trecho B" }] },
  });

  assert.deepEqual(tavily[0], {
    title: "Tavily result",
    url: "https://example.com/a",
    snippet: "Trecho A",
    provider: "Tavily",
  });
  assert.equal(brave[0].provider, "Brave");
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

test("searchDuckDuckGoFallback returns normalized fallback payload", async () => {
  const originalFetch = global.fetch;

  global.fetch = async () => ({
    ok: true,
    async json() {
      return {
        Heading: "OpenAI",
        AbstractText: "Resumo principal",
        AbstractURL: "https://duckduckgo.com/OpenAI",
        RelatedTopics: [],
      };
    },
  });

  try {
    const result = await searchDuckDuckGoFallback("openai");
    assert.equal(result.provider, "DuckDuckGo");
    assert.equal(result.isFallback, true);
    assert.equal(result.webSearch, true);
    assert.match(result.content, /Busca leve DuckDuckGo/i);
    assert.equal(result.citations.length, 1);
  } finally {
    global.fetch = originalFetch;
  }
});

test("runWebSearchQuery uses DuckDuckGo sources when paid providers are unavailable", async () => {
  const originalFetch = global.fetch;
  const originalWindow = global.window;
  let calls = 0;
  global.window = { location: { href: "http://localhost:4173" } };

  global.fetch = async (url) => {
    calls += 1;
    if (calls === 1) {
      return {
        ok: true,
        async json() {
          return {
            Heading: "OpenAI",
            AbstractText: "Resumo principal",
            AbstractURL: "https://duckduckgo.com/OpenAI",
            RelatedTopics: [],
          };
        },
      };
    }

    assert.equal(url, "https://api.groq.com/openai/v1/chat/completions");
    return {
      ok: true,
      async json() {
        return {
          choices: [{ message: { content: "Resposta baseada nas fontes." } }],
        };
      },
    };
  };

  try {
    const result = await runWebSearchQuery({
      messages: [{ role: "user", content: "novidades openai" }],
      settings: {
        ...getDefaultSettings(),
        textProvider: "groq",
        groqKey: "gsk-test",
      },
    });

    assert.equal(result.provider, "DuckDuckGo");
    assert.equal(result.isFallback, true);
    assert.match(result.content, /Resposta baseada nas fontes/);
    assert.match(result.content, /Fontes consultadas/);
  } finally {
    global.fetch = originalFetch;
    global.window = originalWindow;
  }
});

test("transcribeAudio tries Groq before optional OpenAI fallback", async () => {
  const originalFetch = global.fetch;
  const calls = [];

  global.fetch = async (url) => {
    calls.push(url);
    return {
      ok: true,
      async json() {
        return { text: "texto transcrito" };
      },
    };
  };

  try {
    const text = await transcribeAudio({
      audioBlob: new Blob(["audio"], { type: "audio/webm" }),
      settings: {
        ...getDefaultSettings(),
        groqKey: "gsk-test",
        openAIKey: "",
      },
    });

    assert.equal(text, "texto transcrito");
    assert.deepEqual(calls, ["https://api.groq.com/openai/v1/audio/transcriptions"]);
  } finally {
    global.fetch = originalFetch;
  }
});
