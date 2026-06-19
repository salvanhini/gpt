import test from "node:test";
import assert from "node:assert/strict";

import { renderApp, shouldAutoScroll } from "../js/ui.js";

test("shouldAutoScroll returns true when the user is near the bottom", () => {
  assert.equal(
    shouldAutoScroll({
      scrollTop: 820,
      clientHeight: 180,
      scrollHeight: 1030,
    }),
    true,
  );
});

test("shouldAutoScroll returns false when the user is reading older messages", () => {
  assert.equal(
    shouldAutoScroll({
      scrollTop: 320,
      clientHeight: 180,
      scrollHeight: 1030,
    }),
    false,
  );
});

test("renderApp includes help entry, compact web toggle and collapsible model guidance", () => {
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  const previousMarked = globalThis.marked;
  const previousPurify = globalThis.DOMPurify;

  const app = { innerHTML: "" };
  globalThis.document = {
    body: {
      classList: {
        toggle() {},
      },
    },
    getElementById(id) {
      if (id === "app") return app;
      return null;
    },
  };
  globalThis.window = {
    scrollTo() {},
  };
  globalThis.marked = {
    parse(value) {
      return value;
    },
  };
  globalThis.DOMPurify = {
    sanitize(value) {
      return value;
    },
  };

  try {
    renderApp({
      mobileSidebarOpen: false,
      sidebarCollapsed: false,
      activeAgent: {
        id: "agent-general",
        name: "Assistente Geral",
        emoji: "✨",
        description: "Ajuda no dia a dia",
      },
      activeAgentId: "agent-general",
      activeChatId: "chat-1",
      activeCategory: "",
      chats: [
        {
          id: "chat-1",
          agentId: "agent-general",
          title: "Planejamento semanal",
          titleMode: "manual",
          updatedAt: "2026-06-19T10:00:00.000Z",
          createdAt: "2026-06-19T10:00:00.000Z",
          category: "trabalho",
          messages: [],
        },
      ],
      agents: [{ id: "agent-general", name: "Assistente Geral", emoji: "✨" }],
      settings: {
        textProvider: "openrouter",
        textModel: "qwen/qwen3.7-plus",
        deepSeekModel: "deepseek-v4-flash",
        groqModel: "openai/gpt-oss-20b",
        openAIKey: "",
        globalSystemPrompt: "",
      },
      modelOptions: [
        {
          value: "qwen/qwen3.7-plus",
          label: "Qwen 3.7 Plus",
          helperText: "Boa escolha para produtividade.",
          badges: ["Rapido", "Equilibrado"],
        },
      ],
      deepSeekModelOptions: [],
      groqModelOptions: [],
      imageSizeOptions: [],
      instagramFormats: [],
      brands: [],
      selectedBrandId: "",
      selectedTemplateId: "",
      pendingAttachmentContext: null,
      pendingChatCategoryPicker: null,
      pendingMessageCategoryPicker: null,
      boardSearchQuery: "",
      imageMode: false,
      pubmedMode: false,
      pubmedResultLimit: 5,
      webSearchMode: false,
      modelGuidanceCollapsed: false,
      agentSummaryCollapsed: true,
      draftMessage: "",
      isVoiceProcessing: false,
      speechRecognitionSupported: true,
      mediaRecorderSupported: false,
      isListening: false,
      isLoading: false,
      modals: {
        settings: false,
        brandForm: false,
        agentForm: false,
        renameChat: false,
        help: false,
      },
      modalPayload: {},
      speakingMessageId: null,
      currentAudio: null,
      currentAudioUrl: null,
      availableVoice: null,
      selectedTemplate: null,
      recognition: null,
      mediaStream: null,
      recordedAudioChunks: [],
      viewMode: "chat",
    });

    assert.match(app.innerHTML, /sidebar-brand-panel-compact/);
    assert.match(app.innerHTML, /agent-summary-panel/);
    assert.doesNotMatch(app.innerHTML, /active-chat-header/);
    assert.match(app.innerHTML, /Ajuda/);
    assert.match(app.innerHTML, /Busca web/);
    assert.match(app.innerHTML, /ocultar detalhes/i);
    assert.match(app.innerHTML, /model-guidance/);
    assert.match(app.innerHTML, /Qwen 3\.7 Plus/);
  } finally {
    globalThis.document = previousDocument;
    globalThis.window = previousWindow;
    globalThis.marked = previousMarked;
    globalThis.DOMPurify = previousPurify;
  }
});
