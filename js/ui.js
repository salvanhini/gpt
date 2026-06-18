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

const CHAT_CATEGORIES = [
  { id: "", label: "Sem categoria", color: "#94A3B8" },
  { id: "trabalho", label: "Trabalho", color: "#3B82F6" },
  { id: "pessoal", label: "Pessoal", color: "#10B981" },
  { id: "estudo", label: "Estudo", color: "#8B5CF6" },
  { id: "criativo", label: "Criativo", color: "#F59E0B" },
  { id: "tecnico", label: "Técnico", color: "#64748B" },
];

function getCategoryById(id) {
  return CHAT_CATEGORIES.find((cat) => cat.id === id) || CHAT_CATEGORIES[0];
}

function getVisibleChats(state) {
  const chats = state.chats
    .filter((chat) => chat.agentId === state.activeAgentId)
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  if (state.activeCategory) {
    return chats.filter((chat) => chat.category === state.activeCategory);
  }
  return chats;
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

function getInstagramFormatById(state, formatId) {
  return (state.instagramFormats || []).find((item) => item.id === formatId) || state.instagramFormats?.[0] || null;
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
    <div class="agent-card ${isActive ? "active" : ""} agent-card-compact rounded-xl border border-white/10 p-2 text-white">
      <div class="flex items-center gap-2">
        <div class="flex h-8.5 w-8.5 shrink-0 items-center justify-center rounded-[0.95rem] bg-white/10 text-[15px] shadow-inner shadow-white/10">
          ${escapeHtml(agent.emoji)}
        </div>
        <div class="min-w-0 flex-1">
          <div class="flex items-center justify-between gap-1.5">
            <button
              type="button"
              class="min-w-0 flex-1 text-left"
              data-action="select-agent"
              data-agent-id="${agent.id}"
            >
              <div class="truncate text-[12.5px] font-semibold leading-4">${escapeHtml(agent.name)}</div>
              <p class="mt-0.5 truncate text-[9.5px] leading-4 text-white/70">${escapeHtml(agent.description)}</p>
            </button>
            ${
              canDelete
                ? `<div class="flex gap-0.5"><button type="button" class="danger-mini inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] text-white hover:bg-white/15" data-action="edit-agent" data-agent-id="${agent.id}" title="Editar agente">✎</button><button type="button" class="danger-mini inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] text-white hover:bg-white/10" data-action="delete-agent" data-agent-id="${agent.id}" title="Excluir agente">✕</button></div>`
                : `<span class="mt-0.5 h-2 w-2 rounded-full bg-emerald-400"></span>`
            }
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderCategoryFilter(state) {
  if (state.sidebarCollapsed) return "";
  const active = state.activeCategory;
  return `
    <div class="category-filter flex flex-wrap gap-1 px-1 py-1.5">
      ${CHAT_CATEGORIES.map((cat) => {
        const isActive = (cat.id === "" && !active) || active === cat.id;
        return `
          <button
            type="button"
            class="category-filter-chip inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] transition-all duration-150 ${isActive ? "ring-2 ring-white/40" : "opacity-60 hover:opacity-90"}"
            style="background:${cat.color}22; color:${cat.color}; border:1px solid ${cat.color}44; ${isActive ? `background:${cat.color}; color:white;` : ""}"
            data-action="filter-by-category"
            data-category="${cat.id}"
            title="Filtrar: ${cat.label}"
          >
            <span class="inline-block h-1.5 w-1.5 rounded-full" style="background:${cat.color}"></span>
            ${cat.id ? cat.label : "Todas"}
          </button>
        `;
      }).join("")}
    </div>
  `;
}

function renderCategoryPicker(chat, state) {
  if (state.pendingChatCategoryPicker !== chat.id) return "";
  return `
    <div class="category-picker mt-1.5 flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-white p-1.5 shadow-soft">
      ${CHAT_CATEGORIES.map((cat) => {
        const isActive = chat.category === cat.id;
        return `
          <button
            type="button"
            class="category-option rounded-full px-2 py-0.5 text-[10px] font-semibold ${isActive ? "text-white" : "text-slate-600 hover:bg-slate-100"}"
            style="${isActive ? `background:${cat.color};` : ""}"
            data-action="set-chat-category"
            data-chat-id="${chat.id}"
            data-category="${cat.id}"
          >
            <span class="inline-block h-1.5 w-1.5 rounded-full align-middle" style="background:${cat.color}; ${isActive ? "filter:brightness(2);" : ""}"></span>
            <span class="align-middle">${cat.label}</span>
          </button>
        `;
      }).join("")}
    </div>
  `;
}

function renderChatCard(chat, state) {
  const isActive = chat.id === state.activeChatId;
  const cat = getCategoryById(chat.category);
  if (state.sidebarCollapsed) {
    return `
      <div class="relative">
        <button
          type="button"
          class="chat-icon-card ${isActive ? "active" : ""}"
          data-action="select-chat"
          data-chat-id="${chat.id}"
          title="${escapeHtml(chat.title)}"
        >
          💬
        </button>
        ${chat.category ? `<span class="absolute -right-0.5 -top-0.5 block h-2 w-2 rounded-full ring-1 ring-white" style="background:${cat.color}"></span>` : ""}
      </div>
    `;
  }

  return `
    <div class="chat-card ${isActive ? "active" : ""} chat-card-compact relative overflow-hidden rounded-xl border border-slate-200/80 bg-white/90 px-1.5 py-1.25 shadow-sm">
      <div class="flex items-start gap-1.5">
        <div class="mt-0.5 shrink-0">
          ${chat.category
            ? `<span class="category-selector inline-flex h-3 w-3 cursor-pointer items-center justify-center rounded-full" style="background:${cat.color}" data-action="toggle-category-picker" data-chat-id="${chat.id}" title="Categoria: ${escapeHtml(cat.label)} (clique para alterar)"></span>`
            : `<span class="category-selector inline-flex h-3 w-3 cursor-pointer items-center justify-center rounded-full border border-dashed border-slate-300 text-[7px] text-slate-400 hover:border-femic-cyan hover:text-femic-cyan" data-action="toggle-category-picker" data-chat-id="${chat.id}" title="Definir categoria">+</span>`
          }
        </div>
        <div class="min-w-0 flex-1">
          <div class="flex items-start justify-between gap-1.5">
            <button
              type="button"
              class="min-w-0 flex-1 text-left"
              data-action="select-chat"
              data-chat-id="${chat.id}"
            >
              <div class="truncate text-[10.5px] font-semibold leading-4 text-slate-800">${escapeHtml(chat.title)}</div>
              <div class="mt-0.5 flex items-center gap-1 text-[9px] leading-4 text-slate-500">
                <span>${formatRelativeDay(chat.updatedAt)}</span>
              </div>
            </button>
            <div class="chat-card-tools flex shrink-0 flex-col items-end gap-0.5 pl-0.5">
              <div class="chat-time-compact text-[8.5px] text-slate-400">${formatTime(chat.updatedAt)}</div>
              <div class="flex items-center gap-0.5">
              <button
                type="button"
                class="chat-rename-btn inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-md text-[7.5px] text-slate-400 opacity-0 hover:bg-slate-100 hover:text-femic-cyan"
                data-action="rename-chat"
                data-chat-id="${chat.id}"
                title="Renomear conversa"
              >✎</button>
              <button
                type="button"
                class="danger-mini inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-md text-[8px] text-slate-500 hover:bg-rose-50 hover:text-rose-600"
                data-action="delete-chat"
                data-chat-id="${chat.id}"
                title="Excluir conversa"
              >
                ✕
              </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      ${renderCategoryPicker(chat, state)}
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

function renderInstagramCreativePanel(state) {
  const brands = state.brands || [];
  const currentFormat = getInstagramFormatById(state, state.instagramFormat);
  const activeBrand = brands.find((brand) => brand.id === state.selectedBrandId) || null;
  const draft = state.creativeFormDraft || {};
  const templates = activeBrand?.templates || [];

  return `
    <section class="instagram-creative-panel mb-3 rounded-[1.35rem] border border-sky-100 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(232,244,255,0.95))] p-4 shadow-sm">
      <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div class="inline-flex items-center gap-2 rounded-full border border-sky-100 bg-white/85 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-femic-navy">
            <span class="h-2 w-2 rounded-full bg-femic-cyan"></span>
            Produtor Instagram
          </div>
          <h3 class="mt-3 text-lg font-semibold text-slate-900">Monte sua arte com briefing guiado</h3>
          <p class="mt-1 max-w-2xl text-sm leading-6 text-slate-500">Escolha a marca, defina o formato e preencha o texto-chave. O sistema transforma isso em um prompt visual premium pronto para story ou post quadrado.</p>
        </div>
        <button
          type="button"
          class="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm hover:bg-slate-50"
          data-action="open-brand-modal"
        >
          Gerenciar marcas
        </button>
      </div>

      <div class="mt-4 grid gap-3 lg:grid-cols-2">
        <label class="block">
          <span class="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Marca</span>
          <select
            class="modal-input"
            data-action="select-instagram-brand"
            name="selectedBrandId"
          >
            ${brands.length
              ? brands.map((brand) => `
                <option value="${escapeHtml(brand.id)}" ${brand.id === state.selectedBrandId ? "selected" : ""}>${escapeHtml(brand.name)}</option>
              `).join("")
              : `<option value="">Cadastre uma marca primeiro</option>`
            }
          </select>
        </label>

        <label class="block">
          <span class="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Formato</span>
          <select
            class="modal-input"
            data-action="select-instagram-format"
            name="instagramFormat"
          >
            ${(state.instagramFormats || []).map((format) => `
              <option value="${escapeHtml(format.id)}" ${format.id === state.instagramFormat ? "selected" : ""}>${escapeHtml(format.label)}</option>
            `).join("")}
          </select>
        </label>
      </div>

      <div class="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr),180px,auto,auto]">
        <label class="block">
          <span class="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Template da marca</span>
          <select
            class="modal-input"
            data-action="select-brand-template"
            name="selectedTemplateId"
          >
            <option value="">Sem template aplicado</option>
            ${templates.map((template) => `
              <option value="${escapeHtml(template.id)}" ${template.id === state.selectedTemplateId ? "selected" : ""}>${escapeHtml(template.name)}</option>
            `).join("")}
          </select>
        </label>
        <label class="block">
          <span class="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Variações</span>
          <select class="modal-input" data-action="creative-field" data-field="variationCount" name="creative-variation-count">
            ${["1", "2", "3", "4"].map((value) => `<option value="${value}" ${String(draft.variationCount || "3") === value ? "selected" : ""}>${value}</option>`).join("")}
          </select>
        </label>
        <button
          type="button"
          class="mt-[1.75rem] inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm hover:bg-slate-50"
          data-action="save-current-template"
        >
          Salvar template
        </button>
        <button
          type="button"
          class="mt-[1.75rem] inline-flex items-center justify-center rounded-full border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-600 shadow-sm hover:bg-rose-50 ${state.selectedTemplateId ? "" : "opacity-50 pointer-events-none"}"
          data-action="delete-brand-template"
          data-template-id="${escapeHtml(state.selectedTemplateId || "")}"
        >
          Excluir template
        </button>
      </div>

      <div class="mt-3 grid gap-3 lg:grid-cols-2">
        <label class="block lg:col-span-2">
          <span class="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Objetivo da arte</span>
          <input class="modal-input" type="text" name="creative-objective" data-action="creative-field" data-field="objective" value="${escapeHtml(draft.objective || "")}" placeholder="Ex.: Divulgar promoção, anunciar lançamento, captar leads" />
        </label>
        <label class="block lg:col-span-2">
          <span class="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Publico</span>
          <input class="modal-input" type="text" name="creative-audience" data-action="creative-field" data-field="audience" value="${escapeHtml(draft.audience || "")}" placeholder="Ex.: Mulheres 25+, pais de primeira viagem, clientes premium" />
        </label>
        <label class="block lg:col-span-2">
          <span class="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Texto principal</span>
          <textarea class="modal-textarea min-h-[92px]" name="creative-headline" data-action="creative-field" data-field="headline" placeholder="Mensagem principal que deve aparecer em destaque na arte.">${escapeHtml(draft.headline || "")}</textarea>
        </label>
        <label class="block">
          <span class="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Texto complementar</span>
          <textarea class="modal-textarea min-h-[86px]" name="creative-supporting-text" data-action="creative-field" data-field="supportingText" placeholder="Subtitulo, benefício, reforço ou contexto adicional.">${escapeHtml(draft.supportingText || "")}</textarea>
        </label>
        <label class="block">
          <span class="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">CTA</span>
          <input class="modal-input" type="text" name="creative-cta" data-action="creative-field" data-field="cta" value="${escapeHtml(draft.cta || "")}" placeholder="Ex.: Chame no direct, clique no link, fale conosco" />
        </label>
      </div>

      <div class="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr),280px]">
        <div class="rounded-2xl border border-white/80 bg-white/85 p-3 shadow-sm">
          <div class="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Resumo criativo</div>
          <div class="mt-2 space-y-2 text-sm text-slate-600">
            <div><strong class="text-slate-900">Formato:</strong> ${escapeHtml(currentFormat?.label || "Story 9:16")}</div>
            <div><strong class="text-slate-900">Marca:</strong> ${escapeHtml(activeBrand?.name || "Nenhuma marca selecionada")}</div>
            <div><strong class="text-slate-900">Paleta:</strong> ${escapeHtml(activeBrand?.primaryColor || "-")} · ${escapeHtml(activeBrand?.secondaryColor || "-")}</div>
            <div><strong class="text-slate-900">Template:</strong> ${escapeHtml(templates.find((template) => template.id === state.selectedTemplateId)?.name || "Livre")}</div>
            <div><strong class="text-slate-900">Variações:</strong> ${escapeHtml(String(draft.variationCount || "3"))}</div>
          </div>
        </div>
        <div class="rounded-2xl border border-sky-100 bg-sky-50/70 p-3 shadow-sm">
          <div class="text-[11px] font-bold uppercase tracking-[0.16em] text-sky-700">Saida esperada</div>
          <p class="mt-2 text-sm leading-6 text-slate-600">O envio gera legenda com hashtags e depois cria ${escapeHtml(String(draft.variationCount || "3"))} versão(ões) visuais da mesma ideia. O tamanho da imagem sera ajustado automaticamente pelo formato escolhido.</p>
        </div>
      </div>
    </section>
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

function renderMessageCategoryPicker(message, state) {
  if (state.pendingMessageCategoryPicker !== message.id) {
    return "";
  }

  return `
    <div class="category-picker mt-2 flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-white p-1.5 shadow-soft">
      ${CHAT_CATEGORIES.map((cat) => {
        const isActive = (message.meta?.category || "") === cat.id;
        return `
          <button
            type="button"
            class="category-option rounded-full px-2 py-0.5 text-[10px] font-semibold ${isActive ? "text-white" : "text-slate-600 hover:bg-slate-100"}"
            style="${isActive ? `background:${cat.color};` : ""}"
            data-action="set-message-category"
            data-message-id="${message.id}"
            data-category="${cat.id}"
          >
            <span class="inline-block h-1.5 w-1.5 rounded-full align-middle" style="background:${cat.color}; ${isActive ? "filter:brightness(2);" : ""}"></span>
            <span class="align-middle">${cat.label}</span>
          </button>
        `;
      }).join("")}
    </div>
  `;
}

function renderMessageCategoryBadge(message) {
  const category = getCategoryById(message.meta?.category || "");
  const hasCategory = Boolean(message.meta?.category);

  return `
    <button
      type="button"
      class="message-category-chip inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-semibold transition-all duration-150 ${hasCategory ? "" : "opacity-75 hover:opacity-100"}"
      style="${hasCategory ? `background:${category.color}18; color:${category.color}; border-color:${category.color}33;` : "background:rgba(148,163,184,0.08); color:#64748b; border-color:rgba(148,163,184,0.24);"}"
      data-action="toggle-message-category-picker"
      data-message-id="${message.id}"
      title="${hasCategory ? `Categoria: ${category.label}` : "Categorizar mensagem"}"
    >
      <span class="inline-block h-1.5 w-1.5 rounded-full" style="background:${category.color}"></span>
      <span>${hasCategory ? category.label : "Categoria"}</span>
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
      ${
        message.meta?.brandId || message.meta?.instagramFormat
          ? `<div class="mt-3 flex flex-wrap gap-2">
              ${message.meta?.instagramFormat ? `<span class="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[10px] font-semibold text-sky-700">${escapeHtml(getInstagramFormatById(state, message.meta.instagramFormat)?.label || message.meta.instagramFormat)}</span>` : ""}
              ${message.meta?.brandId ? `<span class="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold text-slate-600">${escapeHtml((state.brands || []).find((brand) => brand.id === message.meta.brandId)?.name || "Marca")}</span>` : ""}
              ${message.meta?.variationIndex ? `<span class="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-700">Variação ${escapeHtml(String(message.meta.variationIndex))}/${escapeHtml(String(message.meta.variationCount || ""))}</span>` : ""}
              ${message.meta?.copyKind === "instagram-caption" ? `<span class="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">Legenda + hashtags</span>` : ""}
            </div>`
          : ""
      }
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
          <div class="flex flex-wrap items-center justify-end gap-1.5">
            ${renderMessageCategoryBadge(message)}
            ${renderAssistantActions(message, state)}
          </div>
        </div>
        ${content}
        ${renderMessageCategoryPicker(message, state)}
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

export function shouldAutoScroll({
  scrollTop = 0,
  clientHeight = 0,
  scrollHeight = 0,
  threshold = 48,
} = {}) {
  return scrollTop + clientHeight >= scrollHeight - threshold;
}

function renderMessages(state) {
  const chat = state.chats.find((item) => item.id === state.activeChatId);
  const messages = chat?.messages || [];
  const activeAgentName = state.activeAgent?.name || "agente ativo";
  const activeAgentDescription = state.activeAgent?.description || "IA flexível para organizar ideias, documentos e respostas em um só workspace.";

  if (messages.length === 0) {
    return `
      <div class="welcome-panel glass-panel flex min-h-[320px] flex-col justify-between rounded-[1.75rem] border border-white/80 px-5 py-5 shadow-panel sm:px-7 sm:py-6">
        <div class="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div class="max-w-2xl">
            <div class="mb-4 inline-flex items-center gap-2 rounded-full border border-sky-100 bg-white/80 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-femic-navy shadow-sm">
              <span class="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_0_4px_rgba(52,211,153,0.14)]"></span>
              Workspace pronto
            </div>
            <h2 class="text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
              Comece com o ${escapeHtml(activeAgentName)}
            </h2>
            <p class="mt-3 max-w-xl text-sm leading-6 text-slate-600 sm:text-[15px]">
              ${escapeHtml(activeAgentDescription)}
            </p>
          </div>
          <div class="rounded-2xl border border-slate-200/80 bg-white/75 p-4 text-left shadow-soft lg:w-[280px]">
            <div class="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Sessão atual</div>
            <div class="mt-3 space-y-2 text-sm text-slate-600">
              <div class="flex items-center justify-between gap-3">
                <span>Modelo</span>
                <strong class="truncate text-femic-navy">${escapeHtml(getProviderLabel(state))}</strong>
              </div>
              <div class="flex items-center justify-between gap-3">
                <span>Modo</span>
                <strong class="text-femic-navy">${state.imageMode ? "Imagem" : "Texto"}</strong>
              </div>
              <div class="flex items-center justify-between gap-3">
                <span>Anexos</span>
                <strong class="text-femic-navy">${state.pendingAttachmentContext?.files?.length || 0}</strong>
              </div>
            </div>
          </div>
        </div>
        <div class="mt-6 grid gap-3 sm:grid-cols-3">
          <div class="rounded-2xl border border-white/80 bg-white/70 p-4 shadow-sm">
            <div class="text-lg">✍️</div>
            <div class="mt-2 text-sm font-semibold text-slate-900">Escreva ou dite</div>
            <p class="mt-1 text-xs leading-5 text-slate-500">Use o composer abaixo para enviar texto, voz ou prompts de imagem.</p>
          </div>
          <div class="rounded-2xl border border-white/80 bg-white/70 p-4 shadow-sm">
            <div class="text-lg">📎</div>
            <div class="mt-2 text-sm font-semibold text-slate-900">Traga contexto</div>
            <p class="mt-1 text-xs leading-5 text-slate-500">Anexe PDF, planilhas, CSV, XML ou imagens para apoiar a resposta.</p>
          </div>
          <div class="rounded-2xl border border-white/80 bg-white/70 p-4 shadow-sm">
            <div class="text-lg">📋</div>
            <div class="mt-2 text-sm font-semibold text-slate-900">Organize no board</div>
            <p class="mt-1 text-xs leading-5 text-slate-500">Use categorias e busca para manter conversas importantes à mão.</p>
          </div>
        </div>
      </div>
    `;
  }

  return messages.map((message) => renderMessage(message, state)).join("");
}

const ASPECT_RATIO_PREVIEWS = {
  landscape_4_3: { svg: '<svg viewBox="0 0 16 12" class="aspect-svg"><rect x="0.5" y="0.5" width="15" height="11" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>', tip: "Paisagem 4:3 · Padrão fotográfico" },
  landscape_16_9: { svg: '<svg viewBox="0 0 16 9" class="aspect-svg"><rect x="0.5" y="0.5" width="15" height="8" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>', tip: "Paisagem 16:9 · Telas e banners" },
  landscape_3_2: { svg: '<svg viewBox="0 0 15 10" class="aspect-svg"><rect x="0.5" y="0.5" width="14" height="9" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>', tip: "Paisagem 3:2 · Fotos clássicas" },
  square_hd: { svg: '<svg viewBox="0 0 12 12" class="aspect-svg"><rect x="0.5" y="0.5" width="11" height="11" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>', tip: "Quadrado HD · Redes sociais" },
  square: { svg: '<svg viewBox="0 0 12 12" class="aspect-svg"><rect x="0.5" y="0.5" width="11" height="11" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>', tip: "Quadrado · Ícones e avatares" },
  portrait_4_3: { svg: '<svg viewBox="0 0 12 16" class="aspect-svg"><rect x="0.5" y="0.5" width="11" height="15" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>', tip: "Retrato 4:3 · Stories e posts verticais" },
  portrait_16_9: { svg: '<svg viewBox="0 0 9 16" class="aspect-svg"><rect x="0.5" y="0.5" width="8" height="15" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>', tip: "Retrato 16:9 · Reels e TikTok" },
};

function renderImageSizeSelector(state) {
  const options = state.imageSizeOptions || [];
  if (options.length === 0) {
    return "";
  }

  const current = state.settings.imageSize || "landscape_4_3";
  return `
    <div class="inline-flex items-center gap-1 rounded-full border border-slate-200/70 bg-white/60 px-1.5 py-0.5">
      <span class="text-[9px] text-slate-400 mr-0.5">Tam:</span>
      <div class="flex gap-0.5">
        ${options.map((opt) => {
          const preview = ASPECT_RATIO_PREVIEWS[opt.value];
          const isActive = current === opt.value;
          return `
            <button
              type="button"
              class="aspect-btn rounded-md px-1 py-0.5 transition-all duration-150 ${isActive ? "bg-femic-cyan/15 text-femic-navy" : "text-slate-400 hover:text-slate-600"}"
              data-action="change-image-size"
              data-image-size="${escapeHtml(opt.value)}"
              title="${preview?.tip || escapeHtml(opt.label)}"
            >
              <div class="aspect-svg-wrap inline-flex items-center justify-center" style="width:18px;height:14px;">
                ${preview?.svg || ""}
              </div>
              <div class="text-[7px] font-semibold leading-none mt-0.5">${opt.label.split(" ").pop() || ""}</div>
            </button>
          `;
        }).join("")}
      </div>
    </div>
  `;
}

function getChatPreview(chat) {
  const msgs = chat.messages || [];
  if (!msgs.length) return "";
  const last = msgs[msgs.length - 1];
  return last.content.replace(/\s+/g, " ").trim().slice(0, 120) || "";
}

function getBoardCards(state) {
  let chats = [...state.chats].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  if (state.activeCategory) {
    chats = chats.filter((c) => c.category === state.activeCategory);
  }
  if (state.boardSearchQuery) {
    const q = state.boardSearchQuery.toLowerCase();
    chats = chats.filter((c) => c.title.toLowerCase().includes(q) || getChatPreview(c).toLowerCase().includes(q));
  }
  return chats;
}

function renderBoardCard(chat, state) {
  const cat = getCategoryById(chat.category);
  const agent = state.agents.find((a) => a.id === chat.agentId);
  const preview = getChatPreview(chat);
  return `
    <div
      class="board-card cursor-pointer rounded-2xl border border-slate-200/85 transition-all duration-150 hover:-translate-y-0.5"
      style="border-top:4px solid ${cat.color}"
      data-action="select-chat"
      data-chat-id="${chat.id}"
      title="${escapeHtml(chat.title)}"
    >
      <div class="p-4">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0 flex-1">
            <div class="truncate text-sm font-semibold text-slate-900">${escapeHtml(chat.title)}</div>
            <div class="mt-1 text-xs font-medium text-slate-400">${formatRelativeDay(chat.updatedAt)} · ${formatTime(chat.updatedAt)}</div>
          </div>
          ${chat.category ? `<span class="shrink-0 rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.08em]" style="background:${cat.color}22; color:${cat.color};">${escapeHtml(cat.label)}</span>` : ""}
        </div>
        ${preview ? `<div class="mt-3 line-clamp-2 text-xs leading-relaxed text-slate-500">${escapeHtml(preview)}</div>` : `<div class="mt-3 text-xs leading-relaxed text-slate-400">Conversa vazia pronta para receber novas ideias.</div>`}
        <div class="mt-4 flex items-center gap-2 border-t border-slate-100 pt-3 text-[11px] text-slate-400">
          <span class="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-slate-100">${escapeHtml(agent?.emoji || "🤖")}</span>
          <span class="truncate font-medium">${escapeHtml(agent?.name || "FEMIC GPT")}</span>
        </div>
      </div>
    </div>
  `;
}

function renderBoardView(state) {
  const cards = getBoardCards(state);
  return `
    <div class="board-view flex flex-col">
      <div class="board-header shrink-0 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
        <div class="mx-auto flex max-w-[1440px] flex-col gap-4 px-4 py-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
          <div class="flex items-center gap-3">
            <button
              type="button"
              class="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-sm text-slate-600 shadow-sm hover:bg-slate-50"
              data-action="toggle-board-view"
              title="Voltar ao chat"
            >←</button>
            <div>
              <h2 class="text-xl font-semibold tracking-tight text-slate-950">📋 Board de Conversas</h2>
              <p class="text-xs font-medium text-slate-500">${cards.length} de ${state.chats.length} conversas visíveis</p>
            </div>
          </div>
          <div class="relative w-full lg:max-w-sm">
            <input
              type="search"
              class="board-search-input w-full rounded-full border border-slate-200 bg-slate-50/80 px-4 py-2 pl-9 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-sky-300 focus:bg-white focus:ring-2 focus:ring-sky-100"
              placeholder="Buscar conversas..."
              data-action="search-chats"
              value="${escapeHtml(state.boardSearchQuery || "")}"
            />
            <span class="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
          </div>
        </div>
        <div class="mx-auto max-w-[1440px] px-4 pb-4 sm:px-5">
          <div class="flex flex-wrap gap-1.5">
            ${CHAT_CATEGORIES.map((cat) => {
              const isActive = (cat.id === "" && !state.activeCategory) || state.activeCategory === cat.id;
              return `
                <button
                  type="button"
                  class="rounded-full px-3 py-1.5 text-[11px] font-bold transition-all duration-150 ${isActive ? "text-white shadow-sm" : "text-slate-500 hover:text-slate-700"}"
                  style="${isActive ? `background:${cat.color};` : `background:${cat.color}17; color:${cat.color}; border:1px solid ${cat.color}22;`}"
                  data-action="filter-by-category"
                  data-category="${cat.id}"
                >
                  ${cat.id ? cat.label : "Todas"}
                </button>
              `;
            }).join("")}
          </div>
        </div>
      </div>
      <div class="board-content flex-1 scroll-soft">
        <div class="mx-auto max-w-[1440px] px-4 py-5 sm:px-5">
          ${cards.length
            ? `<div class="board-grid grid gap-4" style="grid-template-columns:repeat(auto-fill,minmax(280px,1fr))">${cards.map((chat) => renderBoardCard(chat, state)).join("")}</div>`
            : `<div class="mx-auto flex max-w-md flex-col items-center justify-center rounded-[1.5rem] border border-white/80 bg-white/80 px-6 py-14 text-center shadow-soft"><div class="mb-3 text-4xl">📭</div><p class="text-lg font-semibold text-slate-700">Nenhuma conversa encontrada</p><p class="mt-1 text-sm leading-6 text-slate-400">${state.boardSearchQuery ? "Tente outro termo de busca." : "Nenhuma conversa nesta categoria."}</p></div>`
          }
        </div>
      </div>
    </div>
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
                <div class="flex flex-wrap gap-1.5">
                  ${state.imageSizeOptions.map((opt) => {
                    const preview = ASPECT_RATIO_PREVIEWS[opt.value];
                    const isActive = settings.imageSize === opt.value;
                    return `
                      <label class="aspect-option cursor-pointer rounded-lg border p-2 text-center transition-all duration-150 ${isActive ? "border-femic-cyan bg-cyan-50 shadow-sm" : "border-slate-200 bg-white hover:border-slate-300"}">
                        <input type="radio" name="imageSize" value="${escapeHtml(opt.value)}" ${isActive ? "checked" : ""} class="hidden" />
                        <div class="aspect-svg-wrap mx-auto mb-1 inline-flex items-center justify-center text-slate-600" style="width:28px;height:22px;">
                          ${preview?.svg || ""}
                        </div>
                        <div class="text-[10px] font-medium leading-tight text-slate-700">${escapeHtml(opt.label)}</div>
                      </label>
                    `;
                  }).join("")}
                </div>
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
              <div class="text-xs text-slate-500">Exportar ou importar conversas, agentes, marcas e configurações.</div>
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

function renderBrandModal(state) {
  if (!state.modals.brandForm) {
    return "";
  }

  const editing = state.modalPayload.brand || {};
  const brands = state.brands || [];

  return `
    <div class="modal-backdrop flex items-center justify-center p-4" data-action="close-modal" data-modal="brandForm">
      <div class="modal-panel glass-panel rounded-[2rem] p-6 shadow-panel" data-modal-surface="brandForm">
        <div class="mb-6 flex items-start justify-between gap-4">
          <div>
            <h3 class="text-2xl font-semibold text-slate-900">Marcas do Instagram</h3>
            <p class="mt-2 text-sm text-slate-500">Cadastre a identidade visual basica de cada marca para gerar artes mais consistentes.</p>
          </div>
          <button type="button" class="rounded-full p-2 text-slate-500 hover:bg-white/80" data-action="close-modal" data-modal="brandForm">✕</button>
        </div>

        <div class="grid gap-4 lg:grid-cols-[260px,minmax(0,1fr)]">
          <section class="rounded-2xl border border-slate-200 bg-white/80 p-3">
            <div class="mb-3 flex items-center justify-between">
              <div class="text-sm font-semibold text-slate-900">Marcas cadastradas</div>
              <button type="button" class="rounded-full border border-slate-200 px-3 py-1 text-[11px] font-semibold text-slate-600" data-action="open-brand-modal">Nova</button>
            </div>
            <div class="max-h-[360px] space-y-2 overflow-auto pr-1">
              ${brands.length
                ? brands.map((brand) => `
                  <div class="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                    <div class="flex items-start justify-between gap-2">
                      <div class="min-w-0 flex-1">
                        <div class="truncate text-sm font-semibold text-slate-900">${escapeHtml(brand.name)}</div>
                        <div class="mt-2 flex items-center gap-2">
                          <span class="h-4 w-4 rounded-full border border-white shadow-sm" style="background:${escapeHtml(brand.primaryColor)}"></span>
                          <span class="h-4 w-4 rounded-full border border-white shadow-sm" style="background:${escapeHtml(brand.secondaryColor)}"></span>
                        </div>
                      </div>
                      <div class="flex items-center gap-1">
                        <button type="button" class="rounded-full border border-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-600" data-action="open-brand-modal" data-brand-id="${escapeHtml(brand.id)}">Editar</button>
                        <button type="button" class="rounded-full border border-rose-200 px-2 py-1 text-[10px] font-semibold text-rose-600" data-action="delete-brand" data-brand-id="${escapeHtml(brand.id)}">Excluir</button>
                      </div>
                    </div>
                  </div>
                `).join("")
                : `<div class="rounded-2xl border border-dashed border-slate-200 bg-white/60 px-4 py-8 text-center text-sm text-slate-400">Nenhuma marca cadastrada ainda.</div>`
              }
            </div>
          </section>

          <section class="rounded-2xl border border-slate-200 bg-white/80 p-4">
            <div class="mb-4">
              <div class="text-lg font-semibold text-slate-900">${editing.id ? "Editar marca" : "Nova marca"}</div>
              <div class="mt-1 text-sm text-slate-500">Defina nome, paleta e logo para orientar as artes do agente.</div>
            </div>
            <form data-form="brand" class="space-y-4">
              ${editing.id ? `<input type="hidden" name="id" value="${escapeHtml(editing.id)}" />` : ""}
              <label class="block">
                <span class="mb-2 block text-sm font-medium text-slate-700">Nome</span>
                <input class="modal-input" name="name" type="text" maxlength="80" required value="${escapeHtml(editing.name || "")}" placeholder="Ex.: Clinica Bem Viver" />
              </label>
              <div class="grid gap-4 sm:grid-cols-2">
                <label class="block">
                  <span class="mb-2 block text-sm font-medium text-slate-700">Cor principal</span>
                  <input class="modal-input h-11" name="primaryColor" type="color" value="${escapeHtml(editing.primaryColor || "#1D4ED8")}" />
                </label>
                <label class="block">
                  <span class="mb-2 block text-sm font-medium text-slate-700">Cor secundaria</span>
                  <input class="modal-input h-11" name="secondaryColor" type="color" value="${escapeHtml(editing.secondaryColor || "#0F172A")}" />
                </label>
              </div>
              <label class="block">
                <span class="mb-2 block text-sm font-medium text-slate-700">Logo</span>
                <input class="modal-input" name="logoUrl" type="text" value="${escapeHtml(editing.logoUrl || "")}" placeholder="Cole a URL do logo ou envie uma imagem abaixo" />
              </label>
              <label class="block">
                <span class="mb-2 block text-sm font-medium text-slate-700">Estilo do template</span>
                <textarea class="modal-textarea min-h-[90px]" name="templateStyle" placeholder="Ex.: visual clean, sofisticado, com bastante respiro, tipografia forte e fundo claro.">${escapeHtml(editing.templateStyle || "")}</textarea>
              </label>
              <label class="block">
                <span class="mb-2 block text-sm font-medium text-slate-700">Notas extras da marca</span>
                <textarea class="modal-textarea min-h-[90px]" name="templateNotes" placeholder="Orientações recorrentes para manter consistência entre as artes.">${escapeHtml(editing.templateNotes || "")}</textarea>
              </label>
              <label class="inline-flex cursor-pointer items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 shadow-sm">
                <input id="brand-logo-input" type="file" accept=".png,.jpg,.jpeg,.svg,.webp" class="hidden" data-action="upload-brand-logo" />
                <span>📎</span>
                <span>Enviar logo</span>
              </label>
              <div class="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-4">
                <div class="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Preview do logo</div>
                <img
                  id="brand-logo-preview"
                  src="${escapeHtml(editing.logoUrl || "")}"
                  alt="Logo da marca"
                  class="max-h-24 rounded-xl border border-slate-200 bg-white p-2 ${editing.logoUrl ? "" : "hidden"}"
                />
                ${editing.logoUrl ? "" : `<p class="text-sm text-slate-400">Nenhum logo selecionado ainda.</p>`}
              </div>
              <div class="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-600">
                <strong class="text-slate-900">Templates salvos nesta marca:</strong> ${escapeHtml(String(editing.templates?.length || 0))}
              </div>
              <div class="flex justify-end gap-3 pt-3">
                <button type="button" class="rounded-full border border-slate-200 px-5 py-2.5 font-medium text-slate-600" data-action="close-modal" data-modal="brandForm">Cancelar</button>
                <button type="submit" class="rounded-full bg-femic-navy px-5 py-2.5 font-semibold text-white shadow-soft">${editing.id ? "Salvar marca" : "Criar marca"}</button>
              </div>
            </form>
          </section>
        </div>
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
  const previousMessagesPanel = document.getElementById("messages-panel");
  const keepAtBottom = previousMessagesPanel
    ? shouldAutoScroll({
        scrollTop: previousMessagesPanel.scrollTop,
        clientHeight: previousMessagesPanel.clientHeight,
        scrollHeight: previousMessagesPanel.scrollHeight,
      })
    : true;
  const sidebarOpenClass = state.mobileSidebarOpen ? "open" : "";
  const collapsedClass = state.sidebarCollapsed ? "sidebar-collapsed" : "";
  const activeAgent = state.activeAgent;
  const instagramMode = activeAgent?.id === "agent-instagram-producer";
  const chats = getVisibleChats(state);
  const canRecordFallback = state.mediaRecorderSupported !== false && Boolean(state.settings.openAIKey);
  const voiceTitle = state.isVoiceProcessing
    ? "Transcrevendo audio"
    : state.speechRecognitionSupported === false && !canRecordFallback
      ? "Use Chrome/Edge no computador ou configure Audio (OpenAI) para usar o microfone"
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

        <div class="sidebar-top-actions sidebar-expanded-only mb-3">
          <button type="button" class="sidebar-icon-action" data-action="create-chat" title="Nova conversa">
            <span>＋</span>
          </button>
          <button type="button" class="sidebar-icon-action" data-action="toggle-board-view" title="Board de conversas">
            <span>📋</span>
          </button>
          <button type="button" class="sidebar-icon-action" data-action="open-settings" title="Configurações">
            <span>⚙</span>
          </button>
        </div>

        <div class="sidebar-main">
        <section class="sidebar-section sidebar-section-agents rounded-xl border border-white/10 bg-white/5 p-2.5">
          <div class="sidebar-expanded-only mb-3 flex items-center justify-between">
            <div class="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/55">Agentes</div>
          <button type="button" class="rounded-full border border-white/15 px-2.5 py-1 text-xs font-semibold text-white shadow-sm" style="background:rgba(255,255,255,0.12); opacity:0.96;" data-action="open-agent-modal">Novo</button>
          </div>
          <div class="sidebar-scroll sidebar-agents-scroll scroll-soft flex flex-col gap-2 pr-1">
            ${state.agents.map((agent) => renderAgentCard(agent, state)).join("")}
          </div>
        </section>

        <section class="sidebar-section sidebar-section-chats rounded-xl border border-white/10 bg-white/5 p-2.5">
          <div class="sidebar-expanded-only mb-2 flex items-center justify-between">
            <div class="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/55">Conversas</div>
            <button type="button" class="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/15 text-white shadow-sm" style="background:rgba(255,255,255,0.12); opacity:0.96;" data-action="create-chat" title="Nova conversa">＋</button>
          </div>
          ${renderCategoryFilter(state)}
          <div class="sidebar-scroll sidebar-chats-scroll scroll-soft flex flex-col gap-2 pr-1">
            ${chats.length ? chats.map((chat) => renderChatCard(chat, state)).join("") : `<div class="rounded-xl border border-white/10 p-3 text-xs text-white" style="background:rgba(255,255,255,0.06); opacity:0.82;">Ainda não há conversas para este agente.</div>`}
          </div>
        </section>
        </div>

      </aside>

      <main class="app-main relative min-w-0">
        ${state.viewMode === "board"
          ? renderBoardView(state)
          : `<button type="button" class="fixed left-3 top-3 z-30 inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white/80 text-base text-slate-600 shadow-sm backdrop-blur-sm lg:hidden" data-action="toggle-sidebar">☰</button>
        <div class="chat-workspace ${instagramMode ? "instagram-workspace" : ""} mx-auto flex max-w-[1440px] flex-col px-4 py-3 sm:px-5 lg:px-6">

          <section id="messages-panel" class="chat-timeline scroll-soft min-h-0 flex-1 space-y-3 overflow-auto pr-1 pb-1">
            ${renderMessages(state)}
            ${state.isLoading ? renderTyping() : ""}
            <div class="timeline-end-spacer" aria-hidden="true"></div>
          </section>

          <footer class="composer-dock shrink-0 pt-2">
            <div class="composer-panel glass-panel rounded-2xl border border-white/70 px-3 py-2.5 shadow-sm">
              ${instagramMode ? renderInstagramCreativePanel(state) : renderAttachmentChips(state)}
              <form data-form="composer">
                <div class="flex flex-col gap-1.5">
                  ${instagramMode
                    ? `<div class="rounded-2xl border border-sky-100 bg-sky-50/50 px-4 py-3 text-sm leading-6 text-slate-600">O briefing acima sera transformado automaticamente em prompt visual premium para gerar a arte da marca selecionada.</div>`
                    : `<textarea
                        id="composer-input"
                        name="message"
                        class="min-h-[48px] max-h-[120px] w-full resize-y rounded-xl border border-slate-200/90 bg-white/95 px-3.5 py-2.5 text-sm text-slate-800 shadow-inner outline-none ring-0 placeholder:text-slate-400 focus:border-sky-300 focus:ring-3 focus:ring-sky-100"
                        placeholder="Digite sua mensagem para ${escapeHtml(activeAgent?.name || "o FEMIC GPT")}..."
                      >${escapeHtml(state.draftMessage || "")}</textarea>`
                  }
                  <div class="flex flex-wrap items-center justify-between gap-1">
                    <div class="flex flex-wrap items-center gap-1">
                      ${instagramMode ? "" : `<label class="quick-model-wrap inline-flex items-center rounded-full border border-slate-200/70 bg-white/70 px-1.5 py-0.5">
                        <span class="text-[9px] text-slate-400 mr-0.5">Modelo:</span>
                        <select class="quick-model-select-inline" data-action="quick-model-change">
                          ${renderQuickModelOptions(state)}
                        </select>
                      </label>`}
                      ${state.imageMode && !instagramMode ? renderImageSizeSelector(state) : ""}
                      ${instagramMode ? "" : `<label class="control-btn inline-flex cursor-pointer items-center gap-1 rounded-full border border-slate-200 bg-white/70 px-2 py-1 text-[10px] font-medium text-slate-600 shadow-sm">
                        <input id="file-input" type="file" class="hidden" multiple accept=".pdf,.xlsx,.xls,.csv,.xml,.jpg,.jpeg,.png" data-action="attach-files" />
                        <span>📎</span>
                        <span>Anexar</span>
                      </label>`}
                      ${instagramMode ? "" : `<button type="button" class="control-btn inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-medium shadow-sm ${state.imageMode ? "border-cyan-300 bg-cyan-50 text-cyan-900" : "border-slate-200 bg-white/70 text-slate-600"}" data-action="toggle-image-mode">
                        <span>${state.imageMode ? "🖼️" : "✍️"}</span>
                        <span>${state.imageMode ? "Imagem" : "Texto"}</span>
                      </button>`}
                    </div>
                    <div class="flex items-center gap-1">
                      ${instagramMode ? "" : `<button type="button" class="control-btn inline-flex h-8 w-8 items-center justify-center rounded-full border ${state.isListening ? "border-rose-300 bg-rose-50 text-rose-600" : "border-slate-200 bg-white/70 text-slate-500"} ${state.speechRecognitionSupported === false && !canRecordFallback ? "opacity-60" : ""} shadow-sm" data-action="toggle-voice" title="${voiceTitle}">
                        ${state.isVoiceProcessing ? "…" : state.isListening ? "■" : "🎙️"}
                      </button>`}
                      <button type="submit" class="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-femic-navy to-sky-700 px-3 py-1.5 text-[10px] font-semibold text-white shadow-soft">
                        <span>${instagramMode || state.imageMode ? "Gerar arte" : "Enviar"}</span>
                        <span>➜</span>
                      </button>
                    </div>
                  </div>
                </div>
              </form>
            </div>
          </footer>
        </div>`}
      </main>
    </div>
    ${renderSettingsModal(state)}
    ${renderBrandModal(state)}
    ${renderAgentModal(state)}
  `;

  document.body.classList.toggle("modal-open", state.modals.settings || state.modals.agentForm || state.modals.brandForm);
  const messagesPanel = document.getElementById("messages-panel");
  if (messagesPanel && keepAtBottom) {
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
    if (action === "open-brand-modal") handlers.onOpenBrandModal(target.dataset.brandId);
    if (action === "close-modal") handlers.onCloseModal(target.dataset.modal);
    if (action === "toggle-image-mode") handlers.onToggleImageMode();
    if (action === "toggle-voice") handlers.onToggleVoice();
    if (action === "speak-message") handlers.onSpeakMessage(target.dataset.messageId);
    if (action === "copy-message") handlers.onCopyMessage(target.dataset.messageId);
    if (action === "clear-attachments") handlers.onClearAttachments();
    if (action === "toggle-sidebar") handlers.onToggleSidebar();
    if (action === "toggle-sidebar-collapse") handlers.onToggleSidebarCollapse();
    if (action === "set-chat-category") handlers.onSetChatCategory(target.dataset.chatId, target.dataset.category);
    if (action === "set-message-category") handlers.onSetMessageCategory(target.dataset.messageId, target.dataset.category);
    if (action === "rename-chat") handlers.onRenameChat(target.dataset.chatId);
    if (action === "toggle-category-picker") handlers.onToggleCategoryPicker(target.dataset.chatId);
    if (action === "toggle-message-category-picker") handlers.onToggleMessageCategoryPicker(target.dataset.messageId);
    if (action === "filter-by-category") handlers.onFilterByCategory(target.dataset.category);
    if (action === "change-image-size") handlers.onChangeImageSize(target.dataset.imageSize);
    if (action === "toggle-board-view") handlers.onToggleBoardView();
    if (action === "search-chats") handlers.onSearchChats(target.value);
    if (action === "export-data") handlers.onExportData();
    if (action === "delete-brand") handlers.onDeleteBrand(target.dataset.brandId);
    if (action === "save-current-template") handlers.onSaveCurrentAsTemplate();
    if (action === "delete-brand-template") handlers.onDeleteBrandTemplate(target.dataset.templateId);
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
    if (formType === "brand") {
      handlers.onSaveBrand(Object.fromEntries(data.entries()));
    }
  });

  app.addEventListener("change", (event) => {
    const input = event.target;
    if (input instanceof HTMLSelectElement && input.dataset.action === "quick-model-change") {
      handlers.onQuickModelChange(input.value);
      return;
    }

    if (input instanceof HTMLInputElement && input.id === "file-input" && input.files?.length) {
      handlers.onAttachFiles(input.files);
      input.value = "";
    }

    if (input.dataset.action === "search-chats") {
      handlers.onSearchChats(input.value);
      return;
    }

    if (input instanceof HTMLInputElement && input.id === "import-input" && input.files?.length) {
      handlers.onImportData(input.files[0]);
      input.value = "";
    }

    if (input instanceof HTMLInputElement && input.id === "brand-logo-input" && input.files?.[0]) {
      handlers.onBrandLogoUpload(input.files[0]);
      input.value = "";
      return;
    }

    if (input.dataset.action === "select-instagram-brand") {
      handlers.onSelectBrand(input.value);
      return;
    }

    if (input.dataset.action === "select-instagram-format") {
      handlers.onSelectInstagramFormat(input.value);
      return;
    }

    if (input.dataset.action === "select-brand-template") {
      handlers.onSelectBrandTemplate(input.value);
      return;
    }

    if (input.dataset.action === "creative-field") {
      handlers.onCreativeFieldChange(input.dataset.field, input.value);
      return;
    }
  });

  app.addEventListener("input", (event) => {
    const target = event.target;
    if (target instanceof HTMLTextAreaElement && target.id === "composer-input") {
      handlers.onDraftChange(target.value);
    }
    if (target.dataset.action === "creative-field") {
      handlers.onCreativeFieldChange(target.dataset.field, target.value);
    }
    if (target.dataset.action === "search-chats") {
      handlers.onSearchChats(target.value);
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
