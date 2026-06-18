function escapeHtml(value = "") {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatTime(value) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatRelativeDay(value) {
  const date = new Date(value);
  const now = new Date();
  const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return "Hoje";
  if (diffDays === 1) return "Ontem";
  return `${diffDays} dias`;
}

function renderMarkdown(content) {
  const rawHtml = globalThis.marked.parse(content || "", {
    breaks: true,
    gfm: true,
  });
  return globalThis.DOMPurify.sanitize(rawHtml);
}

function getVisibleChats(state) {
  return state.chats
    .filter((chat) => chat.agentId === state.activeAgentId)
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

function getProviderLabel(state) {
  if (state.settings.textProvider === "deepseek") {
    return state.settings.deepSeekModel || "DeepSeek";
  }

  return (state.settings.textModel || "").split("/").pop() || "OpenRouter";
}

function getQuickModelValue(state) {
  if (state.settings.textProvider === "deepseek") {
    return `deepseek::${state.settings.deepSeekModel}`;
  }

  return `openrouter::${state.settings.textModel}`;
}

function renderQuickModelOptions(state) {
  const current = getQuickModelValue(state);
  const openRouter = (state.modelOptions || []).map(
    (model) => `
      <option value="openrouter::${escapeHtml(model.value)}" ${current === `openrouter::${model.value}` ? "selected" : ""}>
        OpenRouter · ${escapeHtml(model.label)}
      </option>
    `,
  );
  const deepSeek = (state.deepSeekModelOptions || []).map(
    (model) => `
      <option value="deepseek::${escapeHtml(model.value)}" ${current === `deepseek::${model.value}` ? "selected" : ""}>
        DeepSeek · ${escapeHtml(model.label)}
      </option>
    `,
  );

  return [...openRouter, ...deepSeek].join("");
}

function renderAgentCard(agent, state) {
  const isActive = state.activeAgentId === agent.id;
  const canDelete = state.agents.length > 1;
  if (state.sidebarCollapsed) {
    return `
      <button
        type="button"
        class="agent-icon-card ${isActive ? "active" : ""}"
        data-action="select-agent"
        data-agent-id="${agent.id}"
        title="${escapeHtml(agent.name)}"
      >
        ${escapeHtml(agent.emoji)}
      </button>
    `;
  }

  return `
    <div class="agent-card ${isActive ? "active" : ""} rounded-xl border border-white/10 p-2 text-white">
      <div class="flex items-center gap-2.5">
        <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-base shadow-inner shadow-white/10">
          ${escapeHtml(agent.emoji)}
        </div>
        <div class="min-w-0 flex-1">
          <div class="flex items-center justify-between gap-2">
            <button
              type="button"
              class="min-w-0 flex-1 text-left"
              data-action="select-agent"
              data-agent-id="${agent.id}"
            >
              <div class="truncate text-sm font-semibold">${escapeHtml(agent.name)}</div>
              <p class="mt-0.5 truncate text-[11px] text-white/70">${escapeHtml(agent.description)}</p>
            </button>
            ${
              canDelete
                ? `<div class="flex gap-1"><button type="button" class="danger-mini rounded-full p-1 text-white hover:bg-white/15" data-action="edit-agent" data-agent-id="${agent.id}" title="Editar agente">✎</button><button type="button" class="danger-mini rounded-full p-1 text-white hover:bg-white/10" data-action="delete-agent" data-agent-id="${agent.id}" title="Excluir agente">✕</button></div>`
                : `<span class="mt-1 h-2.5 w-2.5 rounded-full bg-emerald-400"></span>`
            }
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderChatCard(chat, state) {
  const isActive = chat.id === state.activeChatId;
  if (state.sidebarCollapsed) {
    return `
      <button
        type="button"
        class="chat-icon-card ${isActive ? "active" : ""}"
        data-action="select-chat"
        data-chat-id="${chat.id}"
        title="${escapeHtml(chat.title)}"
      >
        💬
      </button>
    `;
  }

  return `
    <div class="chat-card ${isActive ? "active" : ""} flex w-full items-center gap-2 rounded-xl border border-slate-200/80 bg-white/88 px-2.5 py-2 shadow-sm">
      <button
        type="button"
        class="min-w-0 flex-1 text-left"
        data-action="select-chat"
        data-chat-id="${chat.id}"
      >
      <div class="flex items-center justify-between gap-3">
        <div class="min-w-0">
          <div class="truncate text-xs font-semibold text-slate-800">${escapeHtml(chat.title)}</div>
          <div class="mt-0.5 flex items-center gap-2 text-[11px] text-slate-500">
            <span>${formatRelativeDay(chat.updatedAt)}</span>
          </div>
        </div>
        <div class="text-xs text-slate-400">${formatTime(chat.updatedAt)}</div>
      </div>
      </button>
      <button
        type="button"
        class="danger-mini shrink-0 rounded-full px-2 py-1 text-xs text-slate-500 hover:bg-rose-50 hover:text-rose-600"
        data-action="delete-chat"
        data-chat-id="${chat.id}"
        title="Excluir conversa"
      >
        ✕
      </button>
    </div>
  `;
}

function renderAttachmentChips(state) {
  const files = state.pendingAttachmentContext?.files || [];
  if (files.length === 0) {
    return "";
  }

  return `
    <div class="mb-3 flex flex-wrap gap-2">
      ${files
        .map(
          (file) => `
            <div class="composer-chip inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-900">
              <span>📎</span>
              <span>${escapeHtml(file.summary)}</span>
              <span class="text-[10px] font-semibold uppercase tracking-[0.08em] text-sky-700/70">pronto para envio</span>
            </div>
          `,
        )
        .join("")}
      <button
        type="button"
        data-action="clear-attachments"
        class="composer-chip inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600"
      >
        Limpar anexos
      </button>
    </div>
  `;
}

function renderAssistantActions(message, state) {
  if (message.role !== "assistant") {
    return "";
  }

  const isSpeaking = state.speakingMessageId === message.id;
  const canSpeak = state.speechSynthesisSupported !== false || Boolean(state.settings.openAIKey);
  return `
    <button
      type="button"
      class="control-btn inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-[10px] text-slate-500 shadow-sm"
      data-action="copy-message"
      data-message-id="${message.id}"
      title="Copiar texto"
    >
      📋
    </button>
    <button
      type="button"
      class="control-btn inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-[10px] text-slate-500 shadow-sm ${canSpeak ? "" : "opacity-60"}"
      data-action="speak-message"
      data-message-id="${message.id}"
      title="${canSpeak ? (isSpeaking ? "Parar leitura" : "Ouvir resposta") : "Leitura em voz alta indisponivel neste navegador"}"
    >
      ${isSpeaking ? "■" : "🔊"}
    </button>
  `;
}

function renderMessage(message, state) {
  const isUser = message.role === "user";
  const bubbleBase = isUser
    ? "bg-gradient-to-br from-sky-100 to-cyan-50 border-sky-200 ml-auto"
    : "border-white shadow-panel";

  const alignment = isUser ? "items-end" : "items-start";
  const label = isUser ? "Você" : "FEMIC GPT";
  const content = message.meta?.kind === "image"
    ? `
      <div class="image-preview p-3">
        <img src="${escapeHtml(message.meta.imageUrl)}" alt="${escapeHtml(message.content)}" class="h-auto w-full rounded-xl object-cover" />
      </div>
      <p class="mt-3 text-sm text-slate-700">${escapeHtml(message.content)}</p>
      <div class="mt-4">
        <a
          class="inline-flex items-center gap-2 rounded-full bg-femic-navy px-4 py-2 text-sm font-semibold text-white shadow-soft"
          href="${escapeHtml(message.meta.imageUrl)}"
          download="femic-gpt-image.png"
          target="_blank"
          rel="noreferrer"
        >
          Baixar imagem
        </a>
      </div>
    `
    : `<div class="markdown-body">${renderMarkdown(message.content)}</div>`;

  return `
    <article class="message-enter flex ${alignment} gap-2">
      ${isUser ? "" : `<div class="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-femic-mist text-xs font-bold shadow-soft">AI</div>`}
      <div class="message-bubble rounded-2xl border ${bubbleBase} px-2.5 py-1.5" style="${isUser ? "" : "background:rgba(255,255,255,0.92);"}">
        <div class="mb-1 flex items-center justify-between gap-3">
          <div>
            <div class="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600">${label}</div>
            <div class="text-xs text-slate-400">${formatTime(message.createdAt)}</div>
          </div>
          ${renderAssistantActions(message, state)}
        </div>
        ${content}
      </div>
    </article>
  `;
}

function renderTyping() {
  return `
    <article class="flex items-start gap-2">
      <div class="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-femic-mist text-sm shadow-soft">AI</div>
      <div class="rounded-2xl border border-white px-4 py-3 shadow-panel" style="max-width:min(100%,360px); background:rgba(255,255,255,0.92);">
        <div class="typing-dots text-slate-500">
          <span>●</span> <span>●</span> <span>●</span>
        </div>
      </div>
    </article>
  `;
}

function renderMessages(state) {
  const chat = state.chats.find((item) => item.id === state.activeChatId);
  const messages = chat?.messages || [];

  if (messages.length === 0) {
    return `
      <div class="glass-panel flex min-h-[150px] flex-col items-center justify-center rounded-[1.5rem] border border-white/70 px-5 py-6 text-center shadow-panel">
        <div class="mb-3 flex h-12 w-12 items-center justify-center rounded-[1.1rem] bg-gradient-to-br from-femic-navy to-sky-600 text-xl text-white shadow-soft">✦</div>
        <h2 class="text-lg font-semibold text-slate-900 sm:text-xl">Comece uma conversa com o ${escapeHtml(state.activeAgent?.name || "agente ativo")}</h2>
        <p class="mt-2 max-w-xl text-sm leading-6 text-slate-500">
          Use texto, voz, anexos locais ou o modo imagem para transformar o FEMIC GPT em um workspace de IA mais flexível e organizado.
        </p>
      </div>
    `;
  }

  return messages.map((message) => renderMessage(message, state)).join("");
}

function renderImageSizeSelector(state) {
  const options = state.imageSizeOptions || [];
  if (options.length === 0) {
    return "";
  }

  const current = state.settings.imageSize || "landscape_4_3";
  return `
    <label class="inline-flex items-center rounded-full border border-slate-200/70 bg-white/60 px-1.5 py-0.5">
      <span class="text-[9px] text-slate-400 mr-0.5">Tam:</span>
      <select class="image-size-select" data-action="change-image-size">
        ${options.map(
          (opt) => `<option value="${escapeHtml(opt.value)}" ${current === opt.value ? "selected" : ""}>${escapeHtml(opt.label)}</option>`,
        ).join("")}
      </select>
    </label>
  `;
}

function renderSettingsModal(state) {
  if (!state.modals.settings) {
    return "";
  }

  const settings = state.settings;
  return `
    <div class="modal-backdrop flex items-center justify-center p-4" data-action="close-modal" data-modal="settings">
      <div class="modal-panel glass-panel rounded-2xl p-5 shadow-panel" data-modal-surface="settings">
        <div class="mb-4 flex items-start justify-between gap-4">
          <div>
            <h3 class="text-xl font-semibold text-slate-900">Configurações</h3>
            <p class="mt-1 text-sm text-slate-500">Chaves de API e preferências do FEMIC GPT.</p>
          </div>
          <button type="button" class="rounded-full p-2 text-slate-500 hover:bg-white/80" data-action="close-modal" data-modal="settings">✕</button>
        </div>
        <form data-form="settings" class="space-y-3">
          <div class="grid gap-3 lg:grid-cols-2">
            <section class="rounded-xl border border-slate-200 bg-white/75 p-3">
              <div class="mb-2">
                <div class="text-sm font-semibold text-slate-900">OpenRouter</div>
                <div class="text-xs text-slate-500">Chave para modelos OpenRouter.</div>
              </div>
              <label class="block">
                <span class="mb-2 block text-sm font-medium text-slate-700">Chave da API</span>
                <input class="modal-input" name="openRouterKey" type="password" value="${escapeHtml(settings.openRouterKey || "")}" placeholder="sk-or-v1-..." />
              </label>
            </section>

            <section class="rounded-xl border border-slate-200 bg-white/75 p-3">
              <div class="mb-2">
                <div class="text-sm font-semibold text-slate-900">DeepSeek direta</div>
                <div class="text-xs text-slate-500">Chave para modelos DeepSeek direto.</div>
              </div>
              <label class="block">
                <span class="mb-2 block text-sm font-medium text-slate-700">Chave da API</span>
                <input class="modal-input" name="deepSeekKey" type="password" value="${escapeHtml(settings.deepSeekKey || "")}" placeholder="sk-..." />
              </label>
            </section>
          </div>

          <section class="rounded-xl border border-slate-200 bg-white/75 p-3">
            <div class="mb-2">
              <div class="text-sm font-semibold text-slate-900">Imagem (fal.ai)</div>
              <div class="text-xs text-slate-500">Usado no modo imagem.</div>
            </div>
            <div class="grid gap-3 lg:grid-cols-3">
              <label class="block">
                <span class="mb-2 block text-sm font-medium text-slate-700">Chave da API</span>
                <input class="modal-input" name="falKey" type="password" value="${escapeHtml(settings.falKey || "")}" placeholder="sua-chave-da-fal" />
              </label>
              <label class="block">
                <span class="mb-2 block text-sm font-medium text-slate-700">Modelo</span>
                <input class="modal-input" name="imageModel" type="text" value="${escapeHtml(settings.imageModel || "")}" />
              </label>
              <label class="block">
                <span class="mb-2 block text-sm font-medium text-slate-700">Tamanho padrão</span>
                <select class="modal-input appearance-none" name="imageSize">
                  ${state.imageSizeOptions.map((opt) => `
                    <option value="${escapeHtml(opt.value)}" ${settings.imageSize === opt.value ? "selected" : ""}>${escapeHtml(opt.label)}</option>
                  `).join("")}
                </select>
              </label>
            </div>
          </section>

          <section class="rounded-xl border border-slate-200 bg-white/75 p-3">
            <div class="mb-2">
              <div class="text-sm font-semibold text-slate-900">Audio (OpenAI)</div>
              <div class="text-xs text-slate-500">Fallback para microfone e leitura quando o navegador nao tem voz nativa.</div>
            </div>
            <div class="grid gap-3 lg:grid-cols-4">
              <label class="block lg:col-span-2">
                <span class="mb-2 block text-sm font-medium text-slate-700">Chave da API</span>
                <input class="modal-input" name="openAIKey" type="password" value="${escapeHtml(settings.openAIKey || "")}" placeholder="sk-..." />
              </label>
              <label class="block">
                <span class="mb-2 block text-sm font-medium text-slate-700">Transcricao</span>
                <input class="modal-input" name="openAITranscribeModel" type="text" value="${escapeHtml(settings.openAITranscribeModel || "gpt-4o-mini-transcribe")}" />
              </label>
              <label class="block">
                <span class="mb-2 block text-sm font-medium text-slate-700">Voz</span>
                <select class="modal-input appearance-none" name="openAITtsVoice">
                  ${["coral", "marin", "cedar", "alloy", "nova", "shimmer", "verse"].map((voice) => `
                    <option value="${voice}" ${(settings.openAITtsVoice || "coral") === voice ? "selected" : ""}>${voice}</option>
                  `).join("")}
                </select>
              </label>
              <label class="block lg:col-span-2">
                <span class="mb-2 block text-sm font-medium text-slate-700">Modelo de fala</span>
                <input class="modal-input" name="openAITtsModel" type="text" value="${escapeHtml(settings.openAITtsModel || "gpt-4o-mini-tts")}" />
              </label>
            </div>
          </section>

          <section class="rounded-xl border border-slate-200 bg-white/75 p-3">
            <div class="mb-2">
              <div class="text-sm font-semibold text-slate-900">Backup</div>
              <div class="text-xs text-slate-500">Exportar ou importar todas as conversas, agentes e configurações.</div>
            </div>
            <div class="flex flex-wrap gap-3">
              <button type="button" class="rounded-full bg-femic-navy px-4 py-2 text-xs font-semibold text-white shadow-soft" data-action="export-data">⬇ Exportar backup</button>
              <label class="rounded-full border border-slate-200 px-4 py-2 text-xs font-medium text-slate-600 hover:bg-white/80 cursor-pointer">
                <input id="import-input" type="file" accept=".json" class="hidden" data-action="import-data" />
                ⬆ Importar backup
              </label>
            </div>
          </section>

          <div class="flex justify-end gap-3 pt-3">
            <button type="button" class="rounded-full border border-slate-200 px-5 py-2.5 font-medium text-slate-600" data-action="close-modal" data-modal="settings">Cancelar</button>
            <button type="submit" class="rounded-full bg-femic-navy px-5 py-2.5 font-semibold text-white shadow-soft">Salvar</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

function renderAgentModal(state) {
  if (!state.modals.agentForm) {
    return "";
  }

  const editing = state.modalPayload.agent || {};
  return `
    <div class="modal-backdrop flex items-center justify-center p-4" data-action="close-modal" data-modal="agentForm">
      <div class="modal-panel glass-panel rounded-[2rem] p-6 shadow-panel" data-modal-surface="agentForm">
        <div class="mb-6 flex items-start justify-between gap-4">
          <div>
            <h3 class="text-2xl font-semibold text-slate-900">${editing.id ? "Editar agente" : "Criar novo agente"}</h3>
            <p class="mt-2 text-sm text-slate-500">Defina o papel, a personalidade e a instrução principal deste agente customizado.</p>
          </div>
          <button type="button" class="rounded-full p-2 text-slate-500 hover:bg-white/80" data-action="close-modal" data-modal="agentForm">✕</button>
        </div>
        <form data-form="agent" class="space-y-4">
          ${editing.id ? `<input type="hidden" name="id" value="${escapeHtml(editing.id)}" />` : ""}
          <div class="grid gap-4 sm:grid-cols-[1fr,120px]">
            <label class="block">
              <span class="mb-2 block text-sm font-medium text-slate-700">Nome</span>
              <input class="modal-input" name="name" type="text" maxlength="60" required value="${escapeHtml(editing.name || "")}" placeholder="Ex.: Mentor em Conteúdo" />
            </label>
            <label class="block">
              <span class="mb-2 block text-sm font-medium text-slate-700">Emoji</span>
              <input class="modal-input text-center text-2xl" name="emoji" type="text" maxlength="4" value="${escapeHtml(editing.emoji || "✨")}" />
            </label>
          </div>
          <label class="block">
            <span class="mb-2 block text-sm font-medium text-slate-700">Descrição curta</span>
            <input class="modal-input" name="description" type="text" maxlength="180" required value="${escapeHtml(editing.description || "")}" placeholder="Resumo rápido do foco desse agente" />
          </label>
          <label class="block">
            <span class="mb-2 block text-sm font-medium text-slate-700">System Prompt</span>
            <textarea class="modal-textarea min-h-[180px]" name="systemPrompt" required placeholder="Diga como o agente deve pensar, responder e se comportar.">${escapeHtml(editing.systemPrompt || "")}</textarea>
          </label>
          <div class="flex justify-end gap-3 pt-3">
            <button type="button" class="rounded-full border border-slate-200 px-5 py-2.5 font-medium text-slate-600" data-action="close-modal" data-modal="agentForm">Cancelar</button>
            <button type="submit" class="rounded-full bg-femic-navy px-5 py-2.5 font-semibold text-white shadow-soft">${editing.id ? "Salvar agente" : "Criar agente"}</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

export function renderApp(state) {
  const app = document.getElementById("app");
  const sidebarOpenClass = state.mobileSidebarOpen ? "open" : "";
  const collapsedClass = state.sidebarCollapsed ? "sidebar-collapsed" : "";
  const activeAgent = state.activeAgent;
  const chats = getVisibleChats(state);
  const canRecordFallback = state.mediaRecorderSupported !== false && Boolean(state.settings.openAIKey);
  const voiceTitle = state.isVoiceProcessing
    ? "Transcrevendo audio"
    : state.speechRecognitionSupported === false && !canRecordFallback
      ? "Configure a chave OpenAI para usar o microfone neste navegador"
      : state.isListening
      ? "Parar ditado"
      : "Ditado por voz";

  app.innerHTML = `
    ${state.mobileSidebarOpen ? '<div class="sidebar-overlay" data-action="toggle-sidebar"></div>' : ""}
    <div class="femic-shell ${collapsedClass}">
      <aside class="sidebar-gradient sidebar-mobile ${sidebarOpenClass} relative flex h-screen flex-col overflow-hidden border-r border-white/10 p-3 text-white shadow-panel">
        <button
          type="button"
          class="sidebar-edge-collapse"
          data-action="toggle-sidebar-collapse"
          title="${state.sidebarCollapsed ? "Expandir barra lateral" : "Minimizar barra lateral"}"
        >
          ${state.sidebarCollapsed ? "›" : "‹"}
        </button>
        <div class="sidebar-brand-panel mb-3 flex shrink-0 items-center justify-between gap-3 rounded-xl border border-white/10 px-3 py-2.5" style="background:rgba(255,255,255,0.08);">
          <div class="flex items-center gap-3">
            <div class="sidebar-brand-mark flex h-9 w-9 items-center justify-center rounded-xl text-lg shadow-inner shadow-white/10" style="background:rgba(255,255,255,0.12);">✦</div>
            <div class="sidebar-expanded-only">
              <div class="text-lg font-semibold tracking-tight">FEMIC GPT</div>
              <div class="text-[11px] uppercase tracking-[0.18em] text-white/55">Workspace de IA</div>
            </div>
          </div>
          <button type="button" class="sidebar-expanded-only rounded-full border border-white/15 p-2 text-white lg:hidden" style="background:rgba(255,255,255,0.08); opacity:0.85;" data-action="toggle-sidebar">✕</button>
          <button
            type="button"
            class="sidebar-collapse-btn sidebar-expanded-only rounded-full border border-white/15 p-2 text-white"
            style="background:rgba(255,255,255,0.08); opacity:0.9;"
            data-action="toggle-sidebar-collapse"
            title="${state.sidebarCollapsed ? "Expandir barra lateral" : "Minimizar barra lateral"}"
          >
            ${state.sidebarCollapsed ? "›" : "‹"}
          </button>
        </div>

        <div class="sidebar-main">
        <section class="sidebar-section sidebar-section-agents rounded-xl border border-white/10 bg-white/5 p-2.5">
          <div class="sidebar-expanded-only mb-3 flex items-center justify-between">
            <div class="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/55">Agentes</div>
            <button type="button" class="rounded-full border border-white/15 px-2.5 py-1 text-xs font-medium text-white" style="background:rgba(255,255,255,0.08); opacity:0.92;" data-action="open-agent-modal">Novo</button>
          </div>
          <div class="sidebar-scroll sidebar-agents-scroll scroll-soft flex flex-col gap-2 pr-1">
            ${state.agents.map((agent) => renderAgentCard(agent, state)).join("")}
          </div>
        </section>

        <section class="sidebar-section sidebar-section-chats rounded-xl border border-white/10 bg-white/5 p-2.5">
          <div class="sidebar-expanded-only mb-3 flex items-center justify-between">
            <div class="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/55">Conversas</div>
            <button type="button" class="rounded-full border border-white/15 px-2 py-1 text-white" style="background:rgba(255,255,255,0.08); opacity:0.92;" data-action="create-chat" title="Nova conversa">＋</button>
          </div>
          <div class="sidebar-scroll sidebar-chats-scroll scroll-soft flex flex-col gap-2 pr-1">
            ${chats.length ? chats.map((chat) => renderChatCard(chat, state)).join("") : `<div class="rounded-xl border border-white/10 p-3 text-xs text-white" style="background:rgba(255,255,255,0.06); opacity:0.82;">Ainda não há conversas para este agente.</div>`}
          </div>
        </section>
        </div>

        <div class="mt-3 shrink-0 space-y-2">
          <button type="button" class="sidebar-action-btn w-full rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-soft" style="background:rgba(255,255,255,0.12);" data-action="create-chat" title="Nova conversa"><span>＋</span><span class="sidebar-expanded-only">Nova conversa</span></button>
          <button type="button" class="sidebar-action-btn w-full rounded-xl border border-white/15 px-4 py-2 text-sm font-medium text-white" style="background:rgba(255,255,255,0.08); opacity:0.95;" data-action="open-settings" title="Configurações"><span>⚙</span><span class="sidebar-expanded-only">Configurações</span></button>
        </div>
      </aside>

      <main class="relative min-w-0">
        <button type="button" class="fixed left-3 top-3 z-30 inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white/80 text-base text-slate-600 shadow-sm backdrop-blur-sm lg:hidden" data-action="toggle-sidebar">☰</button>
        <div class="mx-auto flex h-screen max-w-[1440px] flex-col px-4 py-2.5 sm:px-5 lg:px-5">

          <section id="messages-panel" class="chat-timeline scroll-soft min-h-0 flex-1 space-y-2.5 overflow-auto pr-1 pb-1">
            ${renderMessages(state)}
            ${state.isLoading ? renderTyping() : ""}
            <div class="timeline-end-spacer" aria-hidden="true"></div>
          </section>

          <footer class="composer-dock shrink-0 pt-1.5">
            <div class="composer-panel glass-panel rounded-xl border border-white/50 px-2.5 py-2 shadow-sm">
              ${renderAttachmentChips(state)}
              <form data-form="composer">
                <div class="flex flex-col gap-1.5">
                  <textarea
                    id="composer-input"
                    name="message"
                    class="min-h-[44px] max-h-[120px] w-full resize-y rounded-xl border border-slate-200/90 bg-white/92 px-3 py-2 text-sm text-slate-800 shadow-inner outline-none ring-0 placeholder:text-slate-400 focus:border-sky-300 focus:ring-3 focus:ring-sky-100"
                    placeholder="Digite sua mensagem para ${escapeHtml(activeAgent?.name || "o FEMIC GPT")}..."
                  >${escapeHtml(state.draftMessage || "")}</textarea>
                  <div class="flex flex-wrap items-center justify-between gap-1">
                    <div class="flex flex-wrap items-center gap-1">
                      <label class="quick-model-wrap inline-flex items-center rounded-full border border-slate-200/70 bg-white/70 px-1.5 py-0.5">
                        <span class="text-[9px] text-slate-400 mr-0.5">Modelo:</span>
                        <select class="quick-model-select-inline" data-action="quick-model-change">
                          ${renderQuickModelOptions(state)}
                        </select>
                      </label>
                      ${state.imageMode ? renderImageSizeSelector(state) : ""}
                      <label class="control-btn inline-flex cursor-pointer items-center gap-1 rounded-full border border-slate-200 bg-white/70 px-2 py-1 text-[10px] font-medium text-slate-600 shadow-sm">
                        <input id="file-input" type="file" class="hidden" multiple accept=".pdf,.xlsx,.xls,.csv,.xml,.jpg,.jpeg,.png" data-action="attach-files" />
                        <span>📎</span>
                        <span>Anexar</span>
                      </label>
                      <button type="button" class="control-btn inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-medium shadow-sm ${state.imageMode ? "border-cyan-300 bg-cyan-50 text-cyan-900" : "border-slate-200 bg-white/70 text-slate-600"}" data-action="toggle-image-mode">
                        <span>${state.imageMode ? "🖼️" : "✍️"}</span>
                        <span>${state.imageMode ? "Imagem" : "Texto"}</span>
                      </button>
                    </div>
                    <div class="flex items-center gap-1">
                      <button type="button" class="control-btn inline-flex h-8 w-8 items-center justify-center rounded-full border ${state.isListening ? "border-rose-300 bg-rose-50 text-rose-600" : "border-slate-200 bg-white/70 text-slate-500"} ${state.speechRecognitionSupported === false && !canRecordFallback ? "opacity-60" : ""} shadow-sm" data-action="toggle-voice" title="${voiceTitle}">
                        ${state.isVoiceProcessing ? "…" : state.isListening ? "■" : "🎙️"}
                      </button>
                      <button type="submit" class="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-femic-navy to-sky-700 px-3 py-1.5 text-[10px] font-semibold text-white shadow-soft">
                        <span>${state.imageMode ? "Gerar imagem" : "Enviar"}</span>
                        <span>➜</span>
                      </button>
                    </div>
                  </div>
                </div>
              </form>
            </div>
          </footer>
        </div>
      </main>
    </div>
    ${renderSettingsModal(state)}
    ${renderAgentModal(state)}
  `;

  document.body.classList.toggle("modal-open", state.modals.settings || state.modals.agentForm);
  const messagesPanel = document.getElementById("messages-panel");
  if (messagesPanel) {
    messagesPanel.scrollTop = messagesPanel.scrollHeight;
  }
}

export function bindUIHandlers(handlers) {
  const app = document.getElementById("app");

  app.addEventListener("click", (event) => {
    const modalSurface = event.target.closest("[data-modal-surface]");
    let target = event.target.closest("[data-action]");

    if (modalSurface) {
      if (!target || !modalSurface.contains(target)) {
        return;
      }
    }

    if (!target) {
      return;
    }

    const action = target.dataset.action;
    if (action === "select-agent") handlers.onSelectAgent(target.dataset.agentId);
    if (action === "delete-agent") handlers.onDeleteAgent(target.dataset.agentId);
    if (action === "edit-agent") handlers.onEditAgent(target.dataset.agentId);
    if (action === "select-chat") handlers.onSelectChat(target.dataset.chatId);
    if (action === "delete-chat") handlers.onDeleteChat(target.dataset.chatId);
    if (action === "create-chat") handlers.onCreateChat();
    if (action === "open-settings") handlers.onOpenSettings();
    if (action === "open-agent-modal") handlers.onOpenAgentModal();
    if (action === "close-modal") handlers.onCloseModal(target.dataset.modal);
    if (action === "toggle-image-mode") handlers.onToggleImageMode();
    if (action === "toggle-voice") handlers.onToggleVoice();
    if (action === "speak-message") handlers.onSpeakMessage(target.dataset.messageId);
    if (action === "copy-message") handlers.onCopyMessage(target.dataset.messageId);
    if (action === "clear-attachments") handlers.onClearAttachments();
    if (action === "toggle-sidebar") handlers.onToggleSidebar();
    if (action === "toggle-sidebar-collapse") handlers.onToggleSidebarCollapse();
    if (action === "export-data") handlers.onExportData();
    if (action === "pick-model") {
      const input = app.querySelector('input[name="textModel"]');
      if (input) {
        input.value = target.dataset.modelValue || "";
      }
    }
  });

  app.addEventListener("submit", (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) {
      return;
    }

    event.preventDefault();
    const formType = form.dataset.form;
    const data = new FormData(form);

    if (formType === "composer") {
      handlers.onSendMessage(data.get("message")?.toString() || "");
    }
    if (formType === "settings") {
      handlers.onSaveSettings(Object.fromEntries(data.entries()));
    }
    if (formType === "agent") {
      handlers.onSaveAgent(Object.fromEntries(data.entries()));
    }
  });

  app.addEventListener("change", (event) => {
    const input = event.target;
    if (input instanceof HTMLSelectElement && input.dataset.action === "quick-model-change") {
      handlers.onQuickModelChange(input.value);
      return;
    }

    if (input instanceof HTMLSelectElement && input.dataset.action === "change-image-size") {
      handlers.onChangeImageSize(input.value);
      return;
    }

    if (input instanceof HTMLInputElement && input.id === "file-input" && input.files?.length) {
      handlers.onAttachFiles(input.files);
      input.value = "";
    }

    if (input instanceof HTMLInputElement && input.id === "import-input" && input.files?.length) {
      handlers.onImportData(input.files[0]);
      input.value = "";
    }
  });

  app.addEventListener("input", (event) => {
    const target = event.target;
    if (target instanceof HTMLTextAreaElement && target.id === "composer-input") {
      handlers.onDraftChange(target.value);
    }
  });

  app.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey && event.target.id === "composer-input") {
      event.preventDefault();
      handlers.onSendMessage(event.target.value);
    }
  });
}

export function showToast(message, type = "info") {
  let stack = document.getElementById("toast-stack");
  if (!stack) {
    stack = document.createElement("div");
    stack.id = "toast-stack";
    stack.className = "toast-stack";
    document.body.appendChild(stack);
  }

  const element = document.createElement("div");
  element.className = `toast-item ${type}`;
  element.textContent = message;
  stack.appendChild(element);

  window.setTimeout(() => {
    element.remove();
  }, 3800);
}

export function openModal(name) {
  return name;
}

export function closeModal(name) {
  return name;
}
