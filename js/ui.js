let scrollListenerBound = false;
const chatScrollPositions = {};

function formatCostValue(cost) {
  if (cost === 0) return "$0.00";
  if (cost < 0.01) return "<$0.01";
  return `$${cost.toFixed(2)}`;
}

function escapeHtml(value = "") {
  return (value ?? "")
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

const AGENT_GUIDES = {
  "agent-general": {
    badge: "Workspace geral",
    title: "Coordena tarefas, textos e decisoes do dia a dia",
    highlights: ["Escrita e revisao", "Planejamento e estrategia", "Analise com contexto dos anexos"],
    examples: ["Resuma este PDF em 5 pontos", "Monte um plano de acao para esta semana", "Revise esta mensagem para cliente"],
  },
  "agent-marketing": {
    badge: "Marketing e Reels",
    title: "Gera ideias, copy e estrutura para conteudo com foco em conversao",
    highlights: ["Ganchos e CTA", "Roteiros curtos para reels", "Campanhas e ofertas locais"],
    examples: ["Crie 5 ganchos para um reel", "Escreva uma oferta para Instagram", "Monte um funil simples para este servico"],
  },
  "agent-science": {
    badge: "Pesquisa tecnica",
    title: "Ajuda com leitura critica, evidencia e analise de artigos",
    highlights: ["Resumo tecnico", "Modo PubMed", "Limites e nivel de evidencia"],
    examples: ["Compare estes dois estudos", "Busque artigos sobre este tema", "Explique os achados em linguagem simples"],
  },
  "agent-brasil-consultor": {
    badge: "Dados nacionais",
    title: "Consulta CEP, CNPJ e agora tambem pode buscar contexto atual na web",
    highlights: ["Resumo de CEP", "Resumo de CNPJ", "Busca web quando precisar de contexto atual"],
    examples: ["Consulte este CEP", "Verifique este CNPJ", "Busque noticias recentes sobre este setor"],
  },
  "agent-instagram-producer": {
    badge: "Estudio criativo",
    title: "Cria artes, legenda e variacoes visuais com identidade por marca",
    highlights: ["Stories e posts", "Templates por marca", "Legenda e hashtags"],
    examples: ["Monte um story de promocao", "Crie um post quadrado premium", "Gere 3 variacoes da mesma campanha"],
  },
};

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
  const settings = state.effectiveSettings || state.settings || {};
  if (settings.textProvider === "deepseek") {
    return settings.deepSeekModel || "DeepSeek";
  }

  if (settings.textProvider === "groq") {
    return (settings.groqModel || "").split("/").pop() || "Groq";
  }

  return (settings.textModel || "").split("/").pop() || "OpenRouter";
}

function getQuickModelValue(state) {
  if (state.settings.textProvider === "deepseek") {
    return `deepseek::${state.settings.deepSeekModel}`;
  }

  if (state.settings.textProvider === "groq") {
    return `groq::${state.settings.groqModel}`;
  }

  if (state.settings.textProvider === "gemini") {
    return `gemini::${state.settings.geminiModel}`;
  }

  return `openrouter::${state.settings.textModel}`;
}

function getActiveModelDetails(state) {
  const settings = state.effectiveSettings || state.settings || {};
  const provider = settings.textProvider || "openrouter";
  const collection =
    provider === "deepseek"
      ? state.deepSeekModelOptions || []
      : provider === "groq"
        ? state.groqModelOptions || []
        : provider === "gemini"
          ? state.geminiModelOptions || []
          : state.modelOptions || [];
  const selectedValue =
    provider === "deepseek"
      ? settings.deepSeekModel
      : provider === "groq"
        ? settings.groqModel
        : provider === "gemini"
          ? settings.geminiModel
          : settings.textModel;
  const model = collection.find((item) => item.value === selectedValue) || collection[0] || null;

  return {
    providerLabel:
      provider === "deepseek" ? "DeepSeek" : provider === "groq" ? "Groq" : provider === "gemini" ? "Gemini" : "OpenRouter",
    label: model?.label || "Modelo padrão",
    helperText: model?.helperText || model?.description || "Modelo pronto para uso geral.",
    badges: Array.isArray(model?.badges) ? model.badges : [],
  };
}

function isScienceAgent(state) {
  return state.activeAgent?.id === "agent-science";
}

function isBrasilAgent(state) {
  return state.activeAgent?.id === "agent-brasil-consultor";
}

function getInstagramFormatById(state, formatId) {
  return (state.instagramFormats || []).find((item) => item.id === formatId) || state.instagramFormats?.[0] || null;
}

function renderQuickModelOptions(state) {
  const current = getQuickModelValue(state);
  const settings = state.settings || {};
  const selectedModels = settings.openRouterSelectedModels || [];
  const hasDynamicModels = state.openRouterAvailableModels?.length > 0;

  const openRouter = settings.openRouterEnabled !== false ? (() => {
    if (hasDynamicModels) {
      const modelsToShow = selectedModels.length > 0
        ? state.openRouterAvailableModels.filter((m) => selectedModels.includes(m.id))
        : state.openRouterAvailableModels.slice(0, 20);
      return modelsToShow.map(
        (model) => `
          <option value="openrouter::${escapeHtml(model.id)}" ${current === `openrouter::${model.id}` ? "selected" : ""}>
            OpenRouter · ${escapeHtml(model.name)}
          </option>
        `,
      );
    }
    return (state.modelOptions || []).map(
      (model) => `
        <option value="openrouter::${escapeHtml(model.value)}" ${current === `openrouter::${model.value}` ? "selected" : ""}>
          OpenRouter · ${escapeHtml(model.label)}
        </option>
      `,
    );
  })() : [];
  const deepSeek = settings.deepSeekEnabled !== false ? (state.deepSeekModelOptions || []).map(
    (model) => `
      <option value="deepseek::${escapeHtml(model.value)}" ${current === `deepseek::${model.value}` ? "selected" : ""}>
        DeepSeek · ${escapeHtml(model.label)}
      </option>
    `,
  ) : [];
  const groq = settings.groqEnabled !== false ? (state.groqModelOptions || []).map(
    (model) => `
      <option value="groq::${escapeHtml(model.value)}" ${current === `groq::${model.value}` ? "selected" : ""}>
        Groq · ${escapeHtml(model.label)}
      </option>
    `,
  ) : [];
  const gemini = settings.geminiEnabled !== false ? (state.geminiModelOptions || []).map(
    (model) => `
      <option value="gemini::${escapeHtml(model.value)}" ${current === `gemini::${model.value}` ? "selected" : ""}>
        Gemini · ${escapeHtml(model.label)}
      </option>
    `,
  ) : [];

  return [...openRouter, ...deepSeek, ...groq, ...gemini].join("");
}

function renderModelGuidance(state) {
  const details = getActiveModelDetails(state);
  const isCollapsed = Boolean(state.modelGuidanceCollapsed);

  return `
    <div class="model-guidance ${isCollapsed ? "is-collapsed" : ""} mt-2 rounded-xl border border-slate-200/80 bg-slate-50/70 px-2.5 py-2">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="min-w-0 text-[10px] font-semibold text-slate-700">${escapeHtml(details.providerLabel)} · ${escapeHtml(details.label)}</div>
        <button
          type="button"
          class="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] font-medium text-slate-500 shadow-sm"
          data-action="toggle-model-guidance"
          title="${isCollapsed ? "Mostrar detalhes do modelo" : "Ocultar detalhes do modelo"}"
        >
          <span>${isCollapsed ? "▾" : "▴"}</span>
          <span>${isCollapsed ? "Mostrar detalhes" : "Ocultar detalhes"}</span>
        </button>
      </div>
      ${isCollapsed
        ? ""
        : `<div class="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500">
            ${details.badges.map((badge) => `<span class="model-guidance-badge">${escapeHtml(badge)}</span>`).join("")}
            <span class="model-guidance-text">${escapeHtml(details.helperText)}</span>
          </div>`}
    </div>
  `;
}

function renderAgentCard(agent, state) {
  const isActive = state.activeAgentId === agent.id;
  return `
    <button
      type="button"
      class="agent-icon-card ${isActive ? "active" : ""}"
      data-action="select-agent"
      data-agent-id="${agent.id}"
      title="${escapeHtml(agent.name)}"
      aria-label="${escapeHtml(agent.name)}"
    >
      <span class="agent-icon-glyph">${escapeHtml(agent.emoji)}</span>
    </button>
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
            ? `<span class="category-selector inline-flex h-4 w-4 cursor-pointer items-center justify-center rounded-full border border-white/90 shadow-sm" style="background:${cat.color}" data-action="toggle-category-picker" data-chat-id="${chat.id}" title="Categoria: ${escapeHtml(cat.label)} (clique para alterar)"></span>`
            : `<span class="category-selector inline-flex h-4 w-4 cursor-pointer items-center justify-center rounded-full border border-dashed border-slate-300 bg-white text-[8px] text-slate-400 shadow-sm hover:border-femic-cyan hover:text-femic-cyan" data-action="toggle-category-picker" data-chat-id="${chat.id}" title="Definir categoria">+</span>`
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
              <div class="truncate text-[10px] font-semibold leading-[0.9rem] text-slate-800">${escapeHtml(chat.title)}</div>
              <div class="mt-0.5 flex items-center gap-1 text-[8.5px] leading-3 text-slate-500">
                <span>${formatRelativeDay(chat.updatedAt)}</span>
              </div>
            </button>
            <div class="chat-card-tools flex shrink-0 flex-col items-end gap-0.5 pl-0.5">
              <div class="chat-time-compact text-[8.5px] text-slate-400">${formatTime(chat.updatedAt)}</div>
              <div class="flex items-center gap-0.5">
              <button
                type="button"
                class="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-md border ${chat.pinned ? "border-amber-300 bg-amber-50 text-amber-600" : "border-slate-200/80 bg-white text-slate-500"} shadow-sm hover:border-amber-200 hover:text-amber-500"
                data-action="toggle-pin-chat"
                data-chat-id="${chat.id}"
                title="${chat.pinned ? "Desafixar conversa" : "Fixar conversa"}"
              >📌</button>
              <button
                type="button"
                class="chat-rename-btn inline-flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-md border border-slate-200/80 bg-white text-[8px] text-slate-500 opacity-100 shadow-sm hover:border-sky-200 hover:text-femic-cyan"
                data-action="rename-chat"
                data-chat-id="${chat.id}"
                title="Renomear conversa"
              >✎</button>
              <button
                type="button"
                class="danger-mini inline-flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-md border border-slate-200/80 bg-white text-[7.5px] text-slate-500 shadow-sm hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
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

function renderPubMedControls(state) {
  if (!isScienceAgent(state)) {
    return "";
  }

  return `
    <div class="pubmed-controls mb-3 flex flex-wrap items-center gap-2 rounded-2xl border border-sky-100 bg-sky-50/70 px-3 py-2.5">
      <button
        type="button"
        class="control-btn inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-semibold shadow-sm ${state.pubmedMode ? "border-cyan-300 bg-white text-femic-navy" : "border-slate-200 bg-white/75 text-slate-600"}"
        data-action="toggle-pubmed-mode"
      >
        <span>🧬</span>
        <span>${state.pubmedMode ? "PubMed ativa" : "Ativar PubMed"}</span>
      </button>
      <label class="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/75 px-3 py-1 text-[11px] font-medium text-slate-600">
        <span>Artigos</span>
        <select class="bg-transparent outline-none" data-action="change-pubmed-result-limit">
          ${[3, 5, 8].map((value) => `<option value="${value}" ${Number(state.pubmedResultLimit) === value ? "selected" : ""}>${value}</option>`).join("")}
        </select>
      </label>
      <div class="text-[11px] text-slate-500">Busca metadados e abstracts da PubMed antes de resumir.</div>
    </div>
  `;
}

function renderWebSearchControls(state) {
  if (state.imageMode || state.activeAgent?.id === "agent-instagram-producer") {
    return "";
  }

  return `
    <div class="inline-flex items-center gap-1.5">
      <button
        type="button"
        class="control-btn inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-semibold shadow-sm ${state.webSearchMode ? "border-amber-300 bg-amber-50 text-amber-900" : "border-slate-200 bg-white/75 text-slate-600"}"
        data-action="toggle-web-search-mode"
        title="${state.webSearchMode ? "Busca web premium ativa quando disponível" : "Ativar busca web quando precisar de informação atual"}"
      >
        <span>🌐</span>
        <span>${state.webSearchMode ? "Web ativa" : "Busca web"}</span>
      </button>
    </div>
  `;
}

function renderActiveAgentSummary(state) {
  const agent = state.activeAgent;
  if (!agent) {
    return "";
  }

  const isCollapsed = Boolean(state.agentSummaryCollapsed);

  const guide = AGENT_GUIDES[agent.id] || {
    badge: "Agente ativo",
    title: agent.description || "Pronto para ajudar.",
    highlights: ["Conversa organizada", "Respostas com contexto", "Fluxo guiado pelo chat"],
    examples: ["Comece com uma pergunta clara", "Anexe um arquivo se precisar de contexto", "Use o board para organizar conversas"],
  };

  return `
    <section class="agent-summary-panel ${isCollapsed ? "is-collapsed" : ""} mb-3 rounded-[1.45rem] border border-white/75 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(240,248,255,0.92))] px-4 py-3 shadow-soft">
      <div class="agent-summary-header flex ${isCollapsed ? "items-center justify-between gap-3" : "flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"}">
        <div class="min-w-0 flex-1">
          ${isCollapsed
            ? `<div class="flex min-w-0 items-center gap-2.5">
                <span class="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-sky-100 bg-white text-[0.95rem] shadow-sm">${escapeHtml(agent.emoji || "🤖")}</span>
                <div class="min-w-0 flex items-center gap-1.5">
                  <h2 class="truncate text-sm font-semibold tracking-tight text-slate-900">${escapeHtml(agent.name)}</h2>
                  ${state.webSearchMode ? `<span class="inline-flex h-2 w-2 shrink-0 rounded-full bg-amber-400" title="Busca Web ativa"></span>` : ""}
                  ${isScienceAgent(state) && state.pubmedMode ? `<span class="inline-flex h-2 w-2 shrink-0 rounded-full bg-sky-400" title="PubMed ativa"></span>` : ""}
                </div>
              </div>`
            : `<div class="inline-flex items-center gap-2 rounded-full border border-sky-100 bg-white/90 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-femic-navy">
                <span class="inline-flex h-6 w-6 items-center justify-center rounded-full bg-sky-50 text-sm">${escapeHtml(agent.emoji || "🤖")}</span>
                <span>${escapeHtml(guide.badge)}</span>
              </div>
              <div class="mt-3 flex flex-wrap items-center gap-2">
                <h2 class="text-lg font-semibold tracking-tight text-slate-950">${escapeHtml(agent.name)}</h2>
                <span class="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-500">${escapeHtml(getProviderLabel(state))}</span>
                ${state.webSearchMode ? `<span class="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-700">Busca Web hibrida</span>` : ""}
                ${isScienceAgent(state) && state.pubmedMode ? `<span class="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[10px] font-semibold text-sky-700">PubMed</span>` : ""}
              </div>`
          }
          ${isCollapsed ? "" : `<p class="mt-2 max-w-3xl text-sm leading-6 text-slate-600">${escapeHtml(guide.title)}</p>`}
        </div>
        <div class="agent-summary-actions flex shrink-0 ${isCollapsed ? "items-center" : "items-start"} gap-2 lg:justify-end">
          ${isCollapsed ? "" : `<div class="flex flex-wrap gap-2 lg:max-w-[320px] lg:justify-end">
            ${guide.highlights.map((item) => `<span class="inline-flex items-center rounded-full border border-white/80 bg-white/85 px-2.5 py-1 text-[10px] font-semibold text-slate-600 shadow-sm">${escapeHtml(item)}</span>`).join("")}
          </div>`}
          <button
            type="button"
            class="agent-summary-toggle inline-flex ${isCollapsed ? "h-7 w-7 text-[11px]" : "h-9 w-9 text-sm"} items-center justify-center rounded-full border border-slate-200/90 bg-white/90 text-slate-500 shadow-sm"
            data-action="toggle-agent-summary"
            title="${isCollapsed ? "Expandir cabecalho do agente" : "Recolher cabecalho do agente"}"
            aria-label="${isCollapsed ? "Expandir cabecalho do agente" : "Recolher cabecalho do agente"}"
            aria-expanded="${isCollapsed ? "false" : "true"}"
          >
            ${isCollapsed ? "▾" : "▴"}
          </button>
          <button
            type="button"
            class="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-xs text-slate-400 shadow-sm hover:border-sky-200 hover:text-sky-500"
            data-action="export-chat-pdf"
            title="Exportar conversa como PDF"
          >📄</button>
        </div>
      </div>
      ${isCollapsed ? "" : `<div class="mt-3 flex flex-wrap gap-2">
        ${guide.examples.map((example) => `<span class="inline-flex items-center rounded-full border border-slate-200 bg-slate-50/85 px-3 py-1.5 text-[11px] text-slate-500">${escapeHtml(example)}</span>`).join("")}
      </div>`}
    </section>
  `;
}

function renderInstagramCreativePanel(state) {
  const brands = state.brands || [];
  const currentFormat = getInstagramFormatById(state, state.instagramFormat);
  const activeBrand = brands.find((brand) => brand.id === state.selectedBrandId) || null;
  const draft = state.creativeFormDraft || {};
  const templates = activeBrand?.templates || [];
  const isCollapsed = state.creativeBriefCollapsed !== false;

  return `
    <section class="instagram-creative-panel mb-2 rounded-[1.2rem] border border-sky-100 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(232,244,255,0.94))] shadow-sm">
      <div class="flex flex-wrap items-center gap-2 px-3 py-2">
        <span class="inline-flex items-center gap-1.5 rounded-full border border-sky-100 bg-white/80 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-femic-navy">
          <span class="h-1.5 w-1.5 rounded-full bg-femic-cyan"></span>
          Instagram
        </span>
        <select style="width:auto;min-width:100px;padding:3px 6px;font-size:11px;border-radius:6px;border:1px solid rgba(0,0,0,0.08);background:rgba(255,255,255,0.7);color:#475569" data-action="select-instagram-brand" name="selectedBrandId">
          ${brands.length
            ? brands.map((brand) => `
              <option value="${escapeHtml(brand.id)}" ${brand.id === state.selectedBrandId ? "selected" : ""}>${escapeHtml(brand.name)}</option>
            `).join("")
            : `<option value="">Sem marca</option>`
          }
        </select>
        <select style="width:auto;min-width:90px;padding:3px 6px;font-size:11px;border-radius:6px;border:1px solid rgba(0,0,0,0.08);background:rgba(255,255,255,0.7);color:#475569" data-action="select-instagram-format" name="instagramFormat">
          ${(state.instagramFormats || []).map((format) => `
            <option value="${escapeHtml(format.id)}" ${format.id === state.instagramFormat ? "selected" : ""}>${escapeHtml(format.label)}</option>
          `).join("")}
        </select>
        <select style="width:auto;min-width:50px;padding:3px 6px;font-size:11px;border-radius:6px;border:1px solid rgba(0,0,0,0.08);background:rgba(255,255,255,0.7);color:#475569" data-action="creative-field" data-field="variationCount">
          ${["1", "2", "3", "4"].map((value) => `<option value="${value}" ${String(draft.variationCount || "3") === value ? "selected" : ""}>${value}x</option>`).join("")}
        </select>
        <button type="button" style="padding:3px 8px;font-size:10px;border-radius:6px;border:1px solid rgba(0,0,0,0.08);background:rgba(255,255,255,0.7);color:#475569;cursor:pointer;white-space:nowrap;display:inline-flex;align-items:center;gap:4px" data-action="toggle-creative-brief">
          ${isCollapsed ? "📝 Briefing" : "📝 ▲ Briefing"}
        </button>
        <button type="button" style="padding:3px 8px;font-size:10px;border-radius:6px;border:1px solid rgba(0,0,0,0.08);background:rgba(255,255,255,0.7);color:#475569;cursor:pointer;white-space:nowrap;display:inline-flex;align-items:center;gap:4px" data-action="open-brand-modal">
          ✦ Marca
        </button>
      </div>

      <div id="creative-brief-details" class="${isCollapsed ? "hidden" : ""}" style="border-top:1px solid rgba(0,0,0,0.04)">
        <div class="grid gap-2 p-3 sm:grid-cols-2">
          <label class="block sm:col-span-2">
            <span class="block text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">Objetivo</span>
            <input class="modal-input" style="padding:5px 8px;font-size:12px" type="text" data-action="creative-field" data-field="objective" value="${escapeHtml(draft.objective || "")}" placeholder="Divulgar promocao, lancamento, captar leads..." />
          </label>
          <label class="block">
            <span class="block text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">Texto principal</span>
            <textarea class="modal-textarea" style="min-height:50px;padding:5px 8px;font-size:12px" data-action="creative-field" data-field="headline" placeholder="Mensagem em destaque na arte">${escapeHtml(draft.headline || "")}</textarea>
          </label>
          <label class="block">
            <span class="block text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">Complemento / CTA</span>
            <textarea class="modal-textarea" style="min-height:50px;padding:5px 8px;font-size:12px" data-action="creative-field" data-field="supportingText" placeholder="Subtitulo, CTA, info adicional">${escapeHtml(draft.supportingText || "")}</textarea>
          </label>
          <label class="block">
            <span class="block text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">Publico</span>
            <input class="modal-input" style="padding:5px 8px;font-size:12px" type="text" data-action="creative-field" data-field="audience" value="${escapeHtml(draft.audience || "")}" placeholder="Quem e o publico?" />
          </label>
          <label class="block flex flex-row items-end gap-2">
            <div class="flex-1">
              <span class="block text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">Template</span>
              <select class="modal-input" style="padding:5px 8px;font-size:12px" data-action="select-brand-template" name="selectedTemplateId">
                <option value="">Livre</option>
                ${templates.map((template) => `
                  <option value="${escapeHtml(template.id)}" ${template.id === state.selectedTemplateId ? "selected" : ""}>${escapeHtml(template.name)}</option>
                `).join("")}
              </select>
            </div>
            <button type="button" style="padding:5px 8px;font-size:10px;white-space:nowrap;border-radius:6px;border:1px solid rgba(0,0,0,0.08);background:rgba(255,255,255,0.7);color:#475569;cursor:pointer;display:inline-flex;align-items:center;gap:4px" data-action="save-current-template">💾</button>
          </label>
        </div>
        ${activeBrand ? `
        <div class="flex flex-wrap items-center gap-3 border-t border-slate-100 px-3 py-1.5 text-[10px] text-slate-400">
          <span>🎨 ${escapeHtml(activeBrand.primaryColor)} / ${escapeHtml(activeBrand.secondaryColor)}</span>
          <span>📐 ${escapeHtml(currentFormat?.label || "Story 9:16")}</span>
          <span>🔄 ${escapeHtml(draft.variationCount || "3")} variacoes</span>
        </div>` : ""}
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

function renderMessage(message, state, index = 0) {
  const isUser = message.role === "user";
  const bubbleBase = isUser
    ? "bg-gradient-to-br from-sky-100 to-cyan-50 border-sky-200 ml-auto"
    : "border-white shadow-panel";

  const alignment = isUser ? "items-end" : "items-start";
  const label = isUser ? "Você" : "FEMIC GPT";
  const showTypingDots = message.role === "assistant" && !message.content && state.isLoading;
  const searchImages = Array.isArray(message.meta?.searchImages) && message.meta.searchImages.length > 0
    ? `<div class="mt-3 flex flex-wrap gap-2">${message.meta.searchImages.slice(0, 5).map((img) =>
        typeof img === "string"
          ? `<img src="${escapeHtml(img)}" alt="Imagem da busca" class="search-img-thumb h-20 w-20 rounded-lg object-cover border border-slate-200" loading="lazy" data-lightbox-src="${escapeHtml(img)}" />`
          : ""
      ).join("")}</div>`
    : "";
  const content = message.meta?.kind === "image" && message.meta?.generating
    ? `
      <div class="image-generating">
        <div class="text-sm text-slate-500">Gerando imagem...</div>
        <div class="image-progress-track">
          <div class="image-progress-bar"></div>
        </div>
      </div>
    `
    : message.meta?.kind === "image"
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
      <div class="mt-4 flex flex-wrap gap-2">
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
    : showTypingDots
      ? `<div class="typing-dots text-slate-500"><span>●</span> <span>●</span> <span>●</span></div>`
      : `<div class="markdown-body">${renderMarkdown(message.content)}</div>${searchImages}`;
  const providerBadge = message.meta?.provider
    ? `<span class="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-500">${escapeHtml(message.meta.provider)}</span>`
    : "";
  const sourceBadge = message.meta?.sourceType && message.meta?.kind !== "image"
    ? `<span class="inline-flex items-center rounded-full border border-sky-100 bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-700">${escapeHtml(message.meta.sourceType === "web-search" ? "Busca Web" : message.meta.sourceType)}</span>`
    : "";
  const fallbackBadge = message.meta?.webSearch
    ? `<span class="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${message.meta.isFallback ? "border-amber-200 bg-amber-50 text-amber-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}">${message.meta.isFallback ? "Busca leve" : "Busca premium"}</span>`
    : "";

  return `
    <article class="message-enter flex ${alignment} gap-2" data-msg-id="${escapeHtml(message.id || "")}" style="animation-delay: ${Math.min(index * 60, 600)}ms">
      ${isUser ? "" : `<div class="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-femic-mist text-xs font-bold shadow-soft">AI</div>`}
      <div class="message-bubble rounded-2xl border ${bubbleBase} px-2.5 py-1.5" style="${isUser ? "" : "background:rgba(255,255,255,0.92);"}">
        <div class="mb-1 flex items-center justify-between gap-3">
          <div>
            <div class="flex flex-wrap items-center gap-1.5">
              <div class="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600">${label}</div>
              ${providerBadge}
              ${sourceBadge}
              ${fallbackBadge}
            </div>
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

let lightboxBound = false;
export function initLightbox() {
  if (lightboxBound) return;
  lightboxBound = true;
  document.addEventListener("click", (e) => {
    const img = e.target.closest("[data-lightbox-src]");
    if (!img) return;
    e.preventDefault();
    const src = img.dataset.lightboxSrc || img.src;
    openLightbox(src);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeLightbox();
  });
}

function openLightbox(src) {
  if (document.querySelector(".lightbox-overlay")) return;
  const overlay = document.createElement("div");
  overlay.className = "lightbox-overlay";
  overlay.innerHTML = `<button class="lightbox-close" title="Fechar">&times;</button><img src="${src}" alt="Imagem ampliada" />`;
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay || e.target.classList.contains("lightbox-close")) {
      closeLightbox();
    }
  });
  document.body.appendChild(overlay);
}

function closeLightbox() {
  const el = document.querySelector(".lightbox-overlay");
  if (el) el.remove();
}

function showShortcutsOverlay() {
  const overlay = document.createElement("div");
  overlay.className = "shortcuts-overlay";
  overlay.innerHTML = `
    <div class="shortcuts-panel">
      <h3 class="shortcuts-title">Atalhos do Teclado</h3>
      <div class="shortcuts-grid">
        <span class="shortcut-key">Ctrl+K</span><span>Buscar conversas</span>
        <span class="shortcut-key">Ctrl+N</span><span>Nova conversa</span>
        <span class="shortcut-key">?</span><span>Mostrar atalhos</span>
        <span class="shortcut-key">Esc</span><span>Fechar modais</span>
        <span class="shortcut-key">/</span><span>Focar no chat</span>
      </div>
      <button class="shortcuts-close" data-action="close-shortcuts">Fechar</button>
    </div>
  `;
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay || e.target.closest("[data-action='close-shortcuts']")) overlay.remove();
  });
  document.body.appendChild(overlay);
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

function renderSkeletonMessages(count = 3) {
  return Array.from({ length: count }, () => `
    <article class="flex items-start gap-2 message-enter">
      <div class="skeleton skeleton-avatar"></div>
      <div class="flex-1 space-y-2">
        <div class="skeleton skeleton-line" style="width:40%"></div>
        <div class="skeleton skeleton-line" style="width:90%"></div>
        <div class="skeleton skeleton-line" style="width:70%"></div>
      </div>
    </article>
  `).join("");
}

function formatFullDate(value) {
  const d = new Date(value);
  return d.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });
}

function getDayLabel(value) {
  const date = new Date(value);
  const now = new Date();
  const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return "Hoje";
  if (diffDays === 1) return "Ontem";
  if (diffDays < 7) return `${diffDays} dias atrás`;
  return formatFullDate(value);
}

function renderMessages(state) {
  const chat = state.chats.find((item) => item.id === state.activeChatId);
  const messages = chat?.messages || [];
  const activeAgentName = state.activeAgent?.name || "agente ativo";
  const guide = AGENT_GUIDES[state.activeAgent?.id] || null;
  const activeAgentDescription = guide?.title || state.activeAgent?.description || "IA flexível para organizar ideias, documentos e respostas em um só workspace.";

  if (messages.length === 0) {
    if (state.isLoading) {
      return renderSkeletonMessages(3);
    }
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
      </div>
    `;
  }

  let lastDayKey = "";
  const rendered = [];
  messages.forEach((message, index) => {
    const dayKey = message.createdAt
      ? new Date(message.createdAt).toISOString().slice(0, 10)
      : "";
    if (dayKey && dayKey !== lastDayKey) {
      if (lastDayKey) {
        rendered.push(`<div class="day-divider"><span>${escapeHtml(getDayLabel(message.createdAt))}</span></div>`);
      }
      lastDayKey = dayKey;
    }
    rendered.push(renderMessage(message, state, index));
  });
  return rendered.join("");
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
  let chats = [...state.chats].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return new Date(b.updatedAt) - new Date(a.updatedAt);
  });
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
            <div class="flex items-center gap-1.5">
              ${chat.pinned ? `<span class="text-amber-500" title="Fixada">📌</span>` : ""}
              <div class="truncate text-sm font-semibold text-slate-900">${escapeHtml(chat.title)}</div>
            </div>
            <div class="mt-1 text-xs font-medium text-slate-400">${formatRelativeDay(chat.updatedAt)} · ${formatTime(chat.updatedAt)}</div>
          </div>
          <div class="flex items-center gap-1">
            <button
              type="button"
              class="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${chat.pinned ? "text-amber-500" : "text-slate-400"} hover:bg-amber-50 hover:text-amber-500"
              data-action="toggle-pin-chat"
              data-chat-id="${chat.id}"
              title="${chat.pinned ? "Desafixar" : "Fixar"}"
            >📌</button>
            <button
              type="button"
              class="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-sky-50 hover:text-sky-500"
              data-action="archive-chat"
              data-chat-id="${chat.id}"
              title="Arquivar conversa"
            >🗄️</button>
            <button
              type="button"
              class="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-500"
              data-action="delete-chat"
              data-chat-id="${chat.id}"
              title="Excluir conversa"
            >✕</button>
            ${chat.category ? `<span class="shrink-0 rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.08em]" style="background:${cat.color}22; color:${cat.color};">${escapeHtml(cat.label)}</span>` : ""}
          </div>
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
          <div class="mt-6 border-t border-slate-200 pt-4">
            <button
              type="button"
              class="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-xs font-semibold text-slate-600 shadow-sm hover:bg-slate-50"
              data-action="toggle-show-archived"
            >
              <span>🗄️</span>
              <span>${state.showArchived ? "Ocultar arquivadas" : "Conversas arquivadas"}</span>
              ${state.archivedChats.length > 0 ? `<span class="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">${state.archivedChats.length}</span>` : ""}
            </button>
            ${state.showArchived ? `
              <div class="mt-3 grid gap-3" style="grid-template-columns:repeat(auto-fill,minmax(280px,1fr))">
                ${state.archivedChats.length === 0 ? `<p class="text-xs text-slate-400">Nenhuma conversa arquivada.</p>` : ""}
                ${state.archivedChats.map((chat) => `
                  <div class="rounded-xl border border-slate-200/80 bg-white/70 p-3 shadow-sm">
                    <div class="flex items-start justify-between gap-2">
                      <div class="min-w-0 flex-1">
                        <div class="truncate text-xs font-semibold text-slate-700">${escapeHtml(chat.title)}</div>
                        <div class="mt-0.5 text-[10px] text-slate-400">Arquivada em ${formatRelativeDay(chat.archivedAt)}</div>
                        ${chat.summary ? `<div class="mt-1 line-clamp-2 text-[10px] leading-relaxed text-slate-400">${escapeHtml(chat.summary).slice(0, 120)}...</div>` : ""}
                      </div>
                    </div>
                    <div class="mt-2 flex items-center gap-1.5 border-t border-slate-100 pt-2">
                      <button
                        type="button"
                        class="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700 hover:bg-emerald-100"
                        data-action="restore-archived"
                        data-chat-id="${chat.id}"
                      >↩ Restaurar</button>
                      <button
                        type="button"
                        class="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[10px] font-semibold text-rose-700 hover:bg-rose-100"
                        data-action="delete-archived"
                        data-chat-id="${chat.id}"
                      >🗑 Excluir</button>
                    </div>
                  </div>
                `).join("")}
              </div>
            ` : ""}
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderEmailComposeModal(state) {
  if (!state.modals.emailCompose) return "";
  const contact = state.modalPayload?.contact || null;
  const contacts = state.contacts || [];
  return `
    <div class="modal-backdrop flex items-center justify-center p-4" data-action="close-modal" data-modal="emailCompose">
      <div class="modal-panel glass-panel rounded-2xl p-5 shadow-panel w-full max-w-2xl" data-modal-surface="emailCompose">
        <div class="mb-4 flex items-start justify-between gap-4">
          <div>
            <h3 class="text-xl font-semibold text-slate-900">Compor Email</h3>
            <p class="mt-1 text-sm text-slate-500">Enviar email via EmailJS.</p>
          </div>
          <button type="button" class="rounded-full p-2 text-slate-500 hover:bg-white/80" data-action="close-modal" data-modal="emailCompose">✕</button>
        </div>
        <form data-form="email-compose" class="space-y-3">
          <label class="block">
            <span class="mb-1 block text-xs font-medium text-slate-700">Remetente</span>
            <select class="modal-input" name="sender">
              <option value="marco">Marco</option>
              <option value="alessandra">Alessandra</option>
            </select>
          </label>
          <label class="block">
            <span class="mb-1 block text-xs font-medium text-slate-700">Destinatario</span>
            <div class="flex gap-2">
              <input class="modal-input flex-1" name="toEmail" type="email" value="${escapeHtml(contact?.email || "")}" placeholder="email@exemplo.com" list="email-contacts" />
              <datalist id="email-contacts">
                ${contacts.filter((c) => c.email).map((c) => `<option value="${escapeHtml(c.email)}">${escapeHtml(c.name)}</option>`).join("")}
              </datalist>
            </div>
          </label>
          <label class="block">
            <span class="mb-1 block text-xs font-medium text-slate-700">Nome do destinatario</span>
            <input class="modal-input" name="toName" type="text" value="${escapeHtml(contact?.name || "")}" placeholder="Nome" />
          </label>
          <label class="block">
            <span class="mb-1 block text-xs font-medium text-slate-700">Assunto</span>
            <input class="modal-input" name="subject" type="text" placeholder="Assunto do email" />
          </label>
          <label class="block">
            <span class="mb-1 block text-xs font-medium text-slate-700">Mensagem</span>
            <textarea class="modal-textarea min-h-[120px]" name="message" placeholder="Escreva sua mensagem aqui..."></textarea>
          </label>
          <div class="flex gap-2">
            <button type="submit" class="rounded-full bg-femic-navy px-5 py-2 text-xs font-semibold text-white hover:opacity-90">Enviar</button>
            <button type="button" class="rounded-full border border-slate-200 px-4 py-2 text-xs font-medium text-slate-600" data-action="close-modal" data-modal="emailCompose">Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

function renderWhatsAppComposeModal(state) {
  if (!state.modals.whatsappCompose) return "";
  const contact = state.modalPayload?.contact || null;
  const contacts = state.contacts || [];
  return `
    <div class="modal-backdrop flex items-center justify-center p-4" data-action="close-modal" data-modal="whatsappCompose">
      <div class="modal-panel glass-panel rounded-2xl p-5 shadow-panel w-full max-w-2xl" data-modal-surface="whatsappCompose">
        <div class="mb-4 flex items-start justify-between gap-4">
          <div>
            <h3 class="text-xl font-semibold text-slate-900">Enviar WhatsApp</h3>
            <p class="mt-1 text-sm text-slate-500">Enviar mensagem via Evolution API.</p>
          </div>
          <button type="button" class="rounded-full p-2 text-slate-500 hover:bg-white/80" data-action="close-modal" data-modal="whatsappCompose">✕</button>
        </div>
        <form data-form="whatsapp-compose" class="space-y-3">
          <label class="block">
            <span class="mb-1 block text-xs font-medium text-slate-700">Numero (com codigo do pais)</span>
            <div class="flex gap-2">
              <input class="modal-input flex-1" name="number" type="text" value="${escapeHtml(contact?.phone || "")}" placeholder="5511999999999" list="whatsapp-contacts" />
              <datalist id="whatsapp-contacts">
                ${contacts.filter((c) => c.phone).map((c) => `<option value="${escapeHtml(c.phone)}">${escapeHtml(c.name)}</option>`).join("")}
              </datalist>
            </div>
          </label>
          <label class="block">
            <span class="mb-1 block text-xs font-medium text-slate-700">Mensagem</span>
            <textarea class="modal-textarea min-h-[120px]" name="text" placeholder="Digite sua mensagem..."></textarea>
          </label>
          <div class="flex gap-2">
            <button type="submit" class="rounded-full bg-femic-navy px-5 py-2 text-xs font-semibold text-white hover:opacity-90">Enviar</button>
            <button type="button" class="rounded-full border border-slate-200 px-4 py-2 text-xs font-medium text-slate-600" data-action="close-modal" data-modal="whatsappCompose">Cancelar</button>
          </div>
        </form>
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
          <div class="space-y-2">
            <h4 class="text-[11px] font-bold uppercase tracking-wider text-slate-400">Provedores de Modelo</h4>
            <div class="grid gap-3 lg:grid-cols-2">
              <section class="rounded-xl border border-slate-200 bg-white/75 p-3">
                <div class="mb-2 flex items-center justify-between">
                  <div>
                    <div class="text-sm font-semibold text-slate-900">OpenRouter</div>
                    <div class="text-xs text-slate-500">Chave para modelos OpenRouter.</div>
                  </div>
                  <label class="relative inline-flex cursor-pointer items-center gap-1">
                    <input type="checkbox" name="openRouterEnabled" class="peer sr-only" ${settings.openRouterEnabled !== false ? "checked" : ""} />
                    <div class="peer h-5 w-9 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-slate-300 after:bg-white after:transition-all peer-checked:bg-femic-cyan peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
                  </label>
                </div>
                <label class="block">
                  <span class="mb-2 block text-sm font-medium text-slate-700">Chave da API</span>
                  <input class="modal-input" name="openRouterKey" type="password" value="${escapeHtml(settings.openRouterKey || "")}" placeholder="sk-or-v1-..." ${settings.openRouterEnabled === false ? "disabled" : ""} />
                </label>
                ${settings.openRouterEnabled !== false ? `
                  <div class="mt-3 border-t border-slate-200 pt-3">
                    <div class="mb-2 flex items-center justify-between">
                      <span class="text-xs font-semibold text-slate-700">Modelos Disponíveis</span>
                      <button type="button" class="rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-medium text-slate-600 shadow-sm hover:bg-slate-50" data-action="fetch-openrouter-models">Buscar Modelos</button>
                    </div>
                    ${state.openRouterAvailableModels?.length > 0 ? `
                      <div class="max-h-[200px] space-y-1 overflow-auto">
                        ${state.openRouterAvailableModels.map((model) => {
                          const isSelected = (settings.openRouterSelectedModels || []).includes(model.id);
                          return `
                            <label class="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-xs hover:bg-slate-50">
                              <input type="checkbox" ${isSelected ? "checked" : ""} data-action="toggle-openrouter-model" data-model-id="${escapeHtml(model.id)}" class="rounded border-slate-300 text-femic-cyan focus:ring-femic-cyan" />
                              <span class="min-w-0 flex-1 truncate text-slate-700">${escapeHtml(model.name)}</span>
                              ${model.contextLength ? `<span class="shrink-0 text-[10px] text-slate-400">${Math.round(model.contextLength / 1000)}K</span>` : ""}
                            </label>
                          `;
                        }).join("")}
                      </div>
                    ` : `<p class="text-[10px] text-slate-400">Clique em "Buscar Modelos" para carregar a lista.</p>`}
                  </div>
                ` : ""}
              </section>

              <section class="rounded-xl border border-slate-200 bg-white/75 p-3">
                <div class="mb-2 flex items-center justify-between">
                  <div>
                    <div class="text-sm font-semibold text-slate-900">DeepSeek direta</div>
                    <div class="text-xs text-slate-500">Chave para modelos DeepSeek direto.</div>
                  </div>
                  <label class="relative inline-flex cursor-pointer items-center gap-1">
                    <input type="checkbox" name="deepSeekEnabled" class="peer sr-only" ${settings.deepSeekEnabled !== false ? "checked" : ""} />
                    <div class="peer h-5 w-9 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-slate-300 after:bg-white after:transition-all peer-checked:bg-femic-cyan peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
                  </label>
                </div>
                <label class="block">
                  <span class="mb-2 block text-sm font-medium text-slate-700">Chave da API</span>
                  <input class="modal-input" name="deepSeekKey" type="password" value="${escapeHtml(settings.deepSeekKey || "")}" placeholder="sk-..." ${settings.deepSeekEnabled === false ? "disabled" : ""} />
                </label>
              </section>

              <section class="rounded-xl border border-slate-200 bg-white/75 p-3">
                <div class="mb-2 flex items-center justify-between">
                  <div>
                    <div class="text-sm font-semibold text-slate-900">Groq</div>
                    <div class="text-xs text-slate-500">Chave para modelos gratuitos/rapidos e Busca Web.</div>
                  </div>
                  <label class="relative inline-flex cursor-pointer items-center gap-1">
                    <input type="checkbox" name="groqEnabled" class="peer sr-only" ${settings.groqEnabled !== false ? "checked" : ""} />
                    <div class="peer h-5 w-9 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-slate-300 after:bg-white after:transition-all peer-checked:bg-femic-cyan peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
                  </label>
                </div>
                <label class="block">
                  <span class="mb-2 block text-sm font-medium text-slate-700">Chave da API</span>
                  <input class="modal-input" name="groqKey" type="password" value="${escapeHtml(settings.groqKey || "")}" placeholder="gsk_..." ${settings.groqEnabled === false ? "disabled" : ""} />
                </label>
              </section>

              <section class="rounded-xl border border-slate-200 bg-white/75 p-3">
                <div class="mb-2 flex items-center justify-between">
                  <div>
                    <div class="text-sm font-semibold text-slate-900">Google Gemini</div>
                    <div class="text-xs text-slate-500">Modelos multimodais do Google.</div>
                  </div>
                  <label class="relative inline-flex cursor-pointer items-center gap-1">
                    <input type="checkbox" name="geminiEnabled" class="peer sr-only" ${settings.geminiEnabled !== false ? "checked" : ""} />
                    <div class="peer h-5 w-9 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-slate-300 after:bg-white after:transition-all peer-checked:bg-femic-cyan peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
                  </label>
                </div>
                <div class="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                  <p class="text-[11px] font-medium text-amber-800">⚠️ A Google pode usar seus dados para melhoria dos modelos. Evite enviar dados sensiveis.</p>
                </div>
                <label class="block">
                  <span class="mb-2 block text-sm font-medium text-slate-700">Chave da API</span>
                  <input class="modal-input" name="geminiKey" type="password" value="${escapeHtml(settings.geminiKey || "")}" placeholder="AIza..." ${settings.geminiEnabled === false ? "disabled" : ""} />
                </label>
              </section>
            </div>
          </div>

          <div class="space-y-2">
            <h4 class="text-[11px] font-bold uppercase tracking-wider text-slate-400">Servicos Externos</h4>
            <div class="grid gap-3 lg:grid-cols-2">
              <section class="rounded-xl border border-slate-200 bg-white/75 p-3">
                <div class="mb-2">
                  <div class="text-sm font-semibold text-slate-900">Imagem</div>
                  <div class="text-xs text-slate-500">Provedor para geracao de imagens.</div>
                </div>
                <div class="grid gap-2 lg:grid-cols-2">
                  <label class="block">
                    <span class="mb-2 block text-sm font-medium text-slate-700">Provedor</span>
                    <select class="modal-input" name="imageProvider">
                      ${(state.imageProviderOptions || []).map((opt) => `
                        <option value="${escapeHtml(opt.value)}" ${settings.imageProvider === opt.value ? "selected" : ""}>${escapeHtml(opt.label)}</option>
                      `).join("")}
                    </select>
                  </label>
                  <label class="block">
                    <span class="mb-2 block text-sm font-medium text-slate-700">Modelo</span>
                    <input class="modal-input" name="imageModel" type="text" value="${escapeHtml(settings.imageModel || "")}" placeholder="flux" />
                  </label>
                </div>
                <label class="block mt-2">
                  <span class="mb-2 block text-sm font-medium text-slate-700">Chave da API (fal.ai)</span>
                  <input class="modal-input" name="falKey" type="password" value="${escapeHtml(settings.falKey || "")}" placeholder="sua-chave-da-fal (so para fal.ai)" />
                </label>
                <label class="block mt-2">
                  <span class="mb-2 block text-sm font-medium text-slate-700">Chave da API (Pixazo.ai)</span>
                  <input class="modal-input" name="pixazoKey" type="password" value="${escapeHtml(settings.pixazoKey || "")}" placeholder="sua-chave-pixazo (so para Pixazo.ai)" />
                </label>
                <div class="mt-1 text-[11px] text-slate-400">Pollinations.ai e gratuito e nao precisa de chave. fal.ai e Pixazo.ai requerem chave de API.</div>
                <label class="block mt-2">
                  <span class="mb-2 block text-sm font-medium text-slate-700">Tamanho padrao</span>
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
              </section>
            </div>
          </div>

          <section class="rounded-xl border border-amber-200/70 bg-amber-50/40 p-3">
            <div class="mb-2">
              <div class="text-sm font-semibold text-slate-900">Busca Web (fallback)</div>
              <div class="text-xs text-slate-600">Usado quando a busca premium falha. Tavily primeiro, depois Brave, e DuckDuckGo como ultimo recurso.</div>
            </div>
            <div class="grid gap-2 lg:grid-cols-2">
              <label class="block">
                <span class="mb-2 block text-sm font-medium text-slate-700">Tavily (API Key)</span>
                <input class="modal-input" name="tavilyKey" type="password" value="${escapeHtml(settings.tavilyKey || "")}" placeholder="tvly-..." />
              </label>
              <label class="block">
                <span class="mb-2 block text-sm font-medium text-slate-700">Brave Search (Subscription-Token)</span>
                <input class="modal-input" name="braveSearchKey" type="password" value="${escapeHtml(settings.braveSearchKey || "")}" placeholder="BSA..." />
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
              <div class="text-sm font-semibold text-slate-900">Comunicacao</div>
              <div class="text-xs text-slate-500">EmailJS e Evolution WhatsApp.</div>
            </div>
            <div class="grid gap-3 lg:grid-cols-2">
              <div class="rounded-lg border border-sky-200/60 bg-sky-50/50 p-2.5">
                <div class="mb-2 text-xs font-bold uppercase tracking-[0.08em] text-sky-700">EmailJS - Marco</div>
                <div class="space-y-2">
                  <label class="block">
                    <span class="mb-1 block text-xs font-medium text-slate-700">Service ID</span>
                    <input class="modal-input" name="emailJSMarcoServiceId" type="text" value="${escapeHtml(settings.emailJSMarcoServiceId || "")}" placeholder="service_xxx" />
                  </label>
                  <label class="block">
                    <span class="mb-1 block text-xs font-medium text-slate-700">Template ID</span>
                    <input class="modal-input" name="emailJSMarcoTemplateId" type="text" value="${escapeHtml(settings.emailJSMarcoTemplateId || "")}" placeholder="template_xxx" />
                  </label>
                  <label class="block">
                    <span class="mb-1 block text-xs font-medium text-slate-700">Public Key</span>
                    <input class="modal-input" name="emailJSMarcoPublicKey" type="password" value="${escapeHtml(settings.emailJSMarcoPublicKey || "")}" placeholder="user_xxx" />
                  </label>
                </div>
              </div>
              <div class="rounded-lg border border-purple-200/60 bg-purple-50/50 p-2.5">
                <div class="mb-2 text-xs font-bold uppercase tracking-[0.08em] text-purple-700">EmailJS - Alessandra</div>
                <div class="space-y-2">
                  <label class="block">
                    <span class="mb-1 block text-xs font-medium text-slate-700">Service ID</span>
                    <input class="modal-input" name="emailJSAlessandraServiceId" type="text" value="${escapeHtml(settings.emailJSAlessandraServiceId || "")}" placeholder="service_xxx" />
                  </label>
                  <label class="block">
                    <span class="mb-1 block text-xs font-medium text-slate-700">Template ID</span>
                    <input class="modal-input" name="emailJSAlessandraTemplateId" type="text" value="${escapeHtml(settings.emailJSAlessandraTemplateId || "")}" placeholder="template_xxx" />
                  </label>
                  <label class="block">
                    <span class="mb-1 block text-xs font-medium text-slate-700">Public Key</span>
                    <input class="modal-input" name="emailJSAlessandraPublicKey" type="password" value="${escapeHtml(settings.emailJSAlessandraPublicKey || "")}" placeholder="user_xxx" />
                  </label>
                </div>
              </div>
              <div class="rounded-lg border border-emerald-200/60 bg-emerald-50/50 p-2.5">
                <div class="mb-2 text-xs font-bold uppercase tracking-[0.08em] text-emerald-700">Evolution WhatsApp</div>
                <div class="space-y-2">
                  <label class="block">
                    <span class="mb-1 block text-xs font-medium text-slate-700">URL da Instancia</span>
                    <input class="modal-input" name="evolutionInstanceUrl" type="text" value="${escapeHtml(settings.evolutionInstanceUrl || "")}" placeholder="http://ip:8080" />
                  </label>
                  <label class="block">
                    <span class="mb-1 block text-xs font-medium text-slate-700">API Key</span>
                    <input class="modal-input" name="evolutionApiKey" type="password" value="${escapeHtml(settings.evolutionApiKey || "")}" placeholder="chave da evolution" />
                  </label>
                  <label class="block">
                    <span class="mb-1 block text-xs font-medium text-slate-700">Nome da Instancia</span>
                    <input class="modal-input" name="evolutionInstanceName" type="text" value="${escapeHtml(settings.evolutionInstanceName || "")}" placeholder="femicgpt" />
                  </label>
                </div>
              </div>
            </div>
          </section>

          <section class="rounded-xl border border-slate-200 bg-white/75 p-3">
            <div class="mb-2">
              <div class="text-sm font-semibold text-slate-900">Prompt global do sistema</div>
              <div class="text-xs text-slate-500">Aplica regras gerais para todos os agentes sem apagar o estilo proprio de cada um.</div>
            </div>
            <label class="block">
              <span class="mb-2 block text-sm font-medium text-slate-700">Instrucao global</span>
              <textarea class="modal-textarea min-h-[160px]" name="globalSystemPrompt" placeholder="Cole aqui o prompt global...">${escapeHtml(settings.globalSystemPrompt || "")}</textarea>
            </label>
            <button type="button" class="mt-2 rounded-full border border-sky-200 px-3 py-1.5 text-[11px] font-semibold text-sky-600 hover:bg-sky-50" data-action="apply-global-prompt-template">Usar prompt de exemplo (Email + WhatsApp)</button>
          </section>

          <section class="rounded-xl border border-emerald-200/70 bg-emerald-50/40 p-3">
            <div class="mb-2">
              <div class="text-sm font-semibold text-slate-900">Uso e Limites</div>
              <div class="text-xs text-slate-600">Limites diarios para economizar uso das APIs. Quando atingir 80% aparece um aviso; em 100% o serviço e bloqueado ate o proximo dia.</div>
            </div>
            <div class="mb-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div class="rounded-lg border border-emerald-200/60 bg-emerald-50/60 p-2.5">
                <div class="text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-600">Custo Hoje</div>
                <div class="mt-1 text-lg font-semibold text-slate-900">${escapeHtml(formatCostValue(state.dailyCost || 0))}</div>
              </div>
              <div class="rounded-lg border border-emerald-200/60 bg-emerald-50/60 p-2.5">
                <div class="text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-600">Custo Mensal</div>
                <div class="mt-1 text-lg font-semibold text-slate-900">${escapeHtml(formatCostValue(state.monthlyCost || 0))}</div>
              </div>
            </div>
            <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <label class="block">
                <span class="mb-1 block text-xs font-medium text-slate-700">Tavily (busca/dia)</span>
                <input class="modal-input" name="tavilyDailyLimit" type="number" min="0" value="${escapeHtml(String(settings.usageLimits?.tavilyDailyLimit ?? 30))}" />
              </label>
              <label class="block">
                <span class="mb-1 block text-xs font-medium text-slate-700">Brave (busca/dia)</span>
                <input class="modal-input" name="braveDailyLimit" type="number" min="0" value="${escapeHtml(String(settings.usageLimits?.braveDailyLimit ?? 65))}" />
              </label>
              <label class="block">
                <span class="mb-1 block text-xs font-medium text-slate-700">Transcricao Groq (transc/dia)</span>
                <input class="modal-input" name="groqTranscriptionDailyLimit" type="number" min="0" value="${escapeHtml(String(settings.usageLimits?.groqTranscriptionDailyLimit ?? 20))}" />
              </label>
              <label class="block">
                <span class="mb-1 block text-xs font-medium text-slate-700">E2B (execucoes/dia)</span>
                <input class="modal-input" name="e2bDailyLimit" type="number" min="0" value="${escapeHtml(String(settings.usageLimits?.e2bDailyLimit ?? 5))}" />
              </label>
              <label class="block">
                <span class="mb-1 block text-xs font-medium text-slate-700">Historico maximo (mensagens)</span>
                <input class="modal-input" name="maxHistoryMessages" type="number" min="4" max="100" value="${escapeHtml(String(settings.usageLimits?.maxHistoryMessages ?? 12))}" />
              </label>
              <label class="block">
                <span class="mb-1 block text-xs font-medium text-slate-700">Alerta de tokens</span>
                <input class="modal-input" name="tokenWarningLimit" type="number" min="0" value="${escapeHtml(String(settings.usageLimits?.tokenWarningLimit ?? 12000))}" />
              </label>
            </div>
            <div class="mt-3 rounded-lg border border-emerald-200/60 bg-emerald-50/60 p-2.5">
              <div class="flex items-center gap-2 text-xs font-semibold text-emerald-800">
                <span>⚡</span>
                <span>Prompt Caching ativo</span>
              </div>
              <div class="mt-1 text-[11px] leading-relaxed text-emerald-700">
                O sistema usa cache de prompt para economizar tokens. DeepSeek e Groq fazem cache automatico de prefixos identicos (50-90% de desconto). OpenRouter usa response cache para requests identicas (zero custo).
              </div>
            </div>
          </section>

          <section class="rounded-xl border border-slate-200 bg-white/75 p-3">
            <div class="mb-2">
              <div class="text-sm font-semibold text-slate-900">Backup</div>
              <div class="text-xs text-slate-500">Exporta ou importa conversas, agentes, marcas, preferências e também as chaves de API para não precisar redigitar tudo.</div>
            </div>
            <div class="flex flex-wrap gap-3">
              <button type="button" class="rounded-full bg-femic-navy px-4 py-2 text-xs font-semibold text-white shadow-soft" data-action="export-data">⬇ Exportar configurações + backup</button>
              <label class="rounded-full border border-slate-200 px-4 py-2 text-xs font-medium text-slate-600 hover:bg-white/80 cursor-pointer">
                <input id="import-input" type="file" accept=".json" class="hidden" data-action="import-data" />
                ⬆ Importar configurações + backup
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

function renderRenameChatModal(state) {
  if (!state.modals.renameChat) {
    return "";
  }

  const chatId = state.modalPayload.chatId || "";
  const title = state.modalPayload.title || "";

  return `
    <div class="modal-backdrop flex items-center justify-center p-4" data-action="close-modal" data-modal="renameChat">
      <div class="modal-panel glass-panel rounded-2xl p-5 shadow-panel" data-modal-surface="renameChat">
        <div class="mb-4 flex items-start justify-between gap-4">
          <div>
            <h3 class="text-xl font-semibold text-slate-900">Renomear conversa</h3>
            <p class="mt-1 text-sm text-slate-500">Esse nome passa a valer no lugar do título automático.</p>
          </div>
          <button type="button" class="rounded-full p-2 text-slate-500 hover:bg-white/80" data-action="close-modal" data-modal="renameChat">✕</button>
        </div>
        <form data-form="rename-chat" class="space-y-4">
          <input type="hidden" name="chatId" value="${escapeHtml(chatId)}" />
          <label class="block">
            <span class="mb-2 block text-sm font-medium text-slate-700">Nome da conversa</span>
            <input class="modal-input" name="title" type="text" maxlength="80" value="${escapeHtml(title)}" placeholder="Ex.: Planejamento semanal" autofocus />
          </label>
          <div class="flex justify-end gap-3 pt-2">
            <button type="button" class="rounded-full border border-slate-200 px-5 py-2.5 font-medium text-slate-600" data-action="close-modal" data-modal="renameChat">Cancelar</button>
            <button type="submit" class="rounded-full bg-femic-navy px-5 py-2.5 font-semibold text-white shadow-soft">Salvar nome</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

function renderHelpModal(state) {
  if (!state.modals.help) {
    return "";
  }

  return `
    <div class="modal-backdrop flex items-center justify-center p-4" data-action="close-modal" data-modal="help">
      <div class="modal-panel glass-panel rounded-2xl p-5 shadow-panel w-full max-w-3xl max-h-[85vh] overflow-y-auto" data-modal-surface="help">
        <div class="mb-4 flex items-start justify-between gap-4">
          <div>
            <h3 class="text-xl font-semibold text-slate-900">Centro de Ajuda FEMIC GPT</h3>
            <p class="mt-1 text-sm text-slate-500">Guia completo de todas as funcoes do sistema.</p>
          </div>
          <button type="button" class="rounded-full p-2 text-slate-500 hover:bg-white/80" data-action="close-modal" data-modal="help">✕</button>
        </div>

        <div class="space-y-4">
          <section class="rounded-xl border border-slate-200 bg-white/80 p-4">
            <h4 class="text-sm font-bold text-slate-900">Agentes</h4>
            <p class="mt-1 text-xs leading-5 text-slate-600">Cada agente tem uma especialidade e prompt proprio. O prompt global adiciona regras gerais a todos.</p>
            <ul class="mt-2 space-y-1 text-xs text-slate-500">
              <li><strong>General:</strong> Conversa geral, qualquer assunto.</li>
              <li><strong>Marketing:</strong> Estrategias, copy, campanhas.</li>
              <li><strong>Cientista:</strong> Artigos PubMed, saude, evidencias.</li>
              <li><strong>Brasil:</strong> CNPJ, CEP, dados nacionais.</li>
              <li><strong>Instagram:</strong> Gera artes e legendas para posts.</li>
              <li><strong>ANVISA:</strong> Regulatorio, rotulos, cadastros.</li>
              <li><strong>Designer:</strong> Logos, banners, materiais visuais.</li>
              <li><strong>Decorador:</strong> Decoracao de ambientes, sugestoes de design.</li>
            </ul>
          </section>

          <section class="rounded-xl border border-slate-200 bg-white/80 p-4">
            <h4 class="text-sm font-bold text-slate-900">Modelos de IA</h4>
            <p class="mt-1 text-xs leading-5 text-slate-600">Escolha o modelo certo para cada tarefa.</p>
            <ul class="mt-2 space-y-1 text-xs text-slate-500">
              <li><strong>⚡ Rapidos (Groq):</strong> Respostas instantaneas. Ideais para perguntas simples, traducoes, resumos.</li>
              <li><strong>🧠 Qualidade (OpenRouter/DeepSeek):</strong> Textos longos, analises profundas, codigo.</li>
              <li><strong>🔬 Raciocinio:</strong> Problemas complexos que precisam de etapas logicas.</li>
              <li><strong>🌐 Gemini:</strong> Multimodal (imagens), bom custo-beneficio.</li>
            </ul>
          </section>

          <section class="rounded-xl border border-slate-200 bg-white/80 p-4">
            <h4 class="text-sm font-bold text-slate-900">Modo Automatico (⚡ Auto)</h4>
            <p class="mt-1 text-xs leading-5 text-slate-600">Quando ativo, o sistema classifica sua pergunta e escolhe automaticamente:</p>
            <ul class="mt-2 space-y-1 text-xs text-slate-500">
              <li>O modelo mais adequado (rapido ou qualidade)</li>
              <li>Se precisa de busca web</li>
              <li>Economiza tokens e dinheiro</li>
            </ul>
          </section>

          <section class="rounded-xl border border-slate-200 bg-white/80 p-4">
            <h4 class="text-sm font-bold text-slate-900">Busca Web</h4>
            <p class="mt-1 text-xs leading-5 text-slate-600">Acesso a internet em tempo real. Ordem: Tavily → Brave → DuckDuckGo → Groq/OpenRouter (fallback).</p>
          </section>

          <section class="rounded-xl border border-sky-200 bg-sky-50/80 p-4">
            <h4 class="text-sm font-bold text-sky-900">Envio de Email</h4>
            <p class="mt-1 text-xs leading-5 text-sky-700">Pelo chat, digite "envie um email para..." que o sistema envia via EmailJS. Configure as chaves em Configuracoes → Comunicacao. Remetente: Marco ou Alessandra.</p>
          </section>

          <section class="rounded-xl border border-emerald-200 bg-emerald-50/80 p-4">
            <h4 class="text-sm font-bold text-emerald-900">Envio de WhatsApp</h4>
            <p class="mt-1 text-xs leading-5 text-emerald-700">Pelo chat, digite "envie um WhatsApp para..." que o sistema envia via Evolution API. Configure em Configuracoes → Comunicacao.</p>
          </section>

          <section class="rounded-xl border border-violet-200 bg-violet-50/80 p-4">
            <h4 class="text-sm font-bold text-violet-900">Memoria Persistente</h4>
            <p class="mt-1 text-xs leading-5 text-violet-700">O sistema lembra fatos sobre voce (nome, profissao, preferencias). Extraido automaticamente das conversas. Acesse pelo botao 🧠 na barra lateral.</p>
          </section>

          <section class="rounded-xl border border-amber-200 bg-amber-50/80 p-4">
            <h4 class="text-sm font-bold text-amber-900">Prompt Caching</h4>
            <p class="mt-1 text-xs leading-5 text-amber-700">Respostas identicas usam cache local (24h). Providers como DeepSeek e Groq fazem cache automatico de prefixos (50-90% de desconto).</p>
          </section>

          <section class="rounded-xl border border-slate-200 bg-white/80 p-4">
            <h4 class="text-sm font-bold text-slate-900">Board de Conversas</h4>
            <p class="mt-1 text-xs leading-5 text-slate-600">Visao em cards para organizar conversas. Use categorias, fixe conversas importantes, arquivue ou exclua.</p>
          </section>

          <section class="rounded-xl border border-slate-200 bg-white/80 p-4">
            <h4 class="text-sm font-bold text-slate-900">Geracao de Imagens</h4>
            <p class="mt-1 text-xs leading-5 text-slate-600">Ative o modo imagem e peça para gerar. Provedores: Pollinations.ai (gratis) ou fal.ai (pago). Use agentes Designer ou Decorador para melhores resultados.</p>
          </section>

          <section class="rounded-xl border border-slate-200 bg-white/80 p-4">
            <h4 class="text-sm font-bold text-slate-900">Backup</h4>
            <p class="mt-1 text-xs leading-5 text-slate-600">Exporte e importe todas as conversas, configuracoes e chaves de API pelo menu Configuracoes.</p>
          </section>
        </div>
      </div>
    </div>
  `;
}

function renderMemoryModal(state) {
  if (!state.modals.memory) {
    return "";
  }

  const facts = state.memoryFacts || [];

  return `
    <div class="modal-backdrop flex items-center justify-center p-4" data-action="close-modal" data-modal="memory">
      <div class="modal-panel glass-panel rounded-2xl p-5 shadow-panel" data-modal-surface="memory">
        <div class="mb-4 flex items-start justify-between gap-4">
          <div>
            <h3 class="text-xl font-semibold text-slate-900">🧠 Memoria Persistente</h3>
            <p class="mt-1 text-sm text-slate-500">Fatos que o sistema lembra sobre voce entre conversas.</p>
          </div>
          <button type="button" class="rounded-full p-2 text-slate-500 hover:bg-white/80" data-action="close-modal" data-modal="memory">✕</button>
        </div>
        <div class="space-y-3">
          ${facts.length === 0
            ? `<div class="rounded-xl border border-dashed border-slate-200 bg-white/60 px-4 py-8 text-center text-sm text-slate-400">Nenhum fato registrado ainda. O sistema extrai automaticamente informacoes como nome, profissao e localizacao das suas conversas.</div>`
            : facts.map((fact) => `
              <div class="flex items-start justify-between gap-2 rounded-xl border border-slate-200 bg-white/80 p-3">
                <div class="min-w-0 flex-1">
                  <div class="text-sm text-slate-700">${escapeHtml(fact.text)}</div>
                  <div class="mt-1 text-[10px] text-slate-400">${escapeHtml(fact.source)} · ${escapeHtml(new Date(fact.createdAt).toLocaleDateString("pt-BR"))}</div>
                </div>
                <button type="button" class="rounded-lg border border-rose-200 px-2 py-1 text-[10px] font-semibold text-rose-600 hover:bg-rose-50" data-action="remove-memory-fact" data-fact-id="${escapeHtml(fact.id)}">Remover</button>
              </div>
            `).join("")
          }
        </div>
        <div class="mt-4 flex justify-end gap-3">
          <button type="button" class="rounded-full border border-slate-200 px-4 py-2 text-xs font-medium text-slate-600" data-action="close-modal" data-modal="memory">Fechar</button>
        </div>
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
  const isEditing = Boolean(editing.id);
  const modeOptions = [
    ["inherit", "Usar padrão atual"],
    ["on", "Ativar ao escolher"],
    ["off", "Desativar ao escolher"],
  ];
  const renderModeOptions = (current) => modeOptions
    .map(([value, label]) => `<option value="${value}" ${current === value ? "selected" : ""}>${label}</option>`)
    .join("");
  const renderModelOptions = (models = [], current = "") => models
    .map((model) => `<option value="${escapeHtml(model.value)}" ${current === model.value ? "selected" : ""}>${escapeHtml(model.label)}</option>`)
    .join("");

  return `
    <div class="modal-backdrop flex items-center justify-center p-4" data-action="close-modal" data-modal="agentForm">
      <div class="modal-panel agent-manager-panel glass-panel rounded-[2rem] p-5 shadow-panel" data-modal-surface="agentForm">
        <div class="mb-4 flex items-start justify-between gap-4">
          <div>
            <h3 class="text-2xl font-semibold text-slate-900">Gerenciador de agentes</h3>
            <p class="mt-2 text-sm text-slate-500">Ajuste prompts, modelos e modos padrão sem alterar suas chaves globais.</p>
          </div>
          <button type="button" class="rounded-full p-2 text-slate-500 hover:bg-white/80" data-action="close-modal" data-modal="agentForm">✕</button>
        </div>

        <div class="agent-manager-grid grid min-h-0 gap-4 lg:grid-cols-[280px,minmax(0,1fr)]">
          <aside class="agent-manager-list rounded-2xl border border-slate-200/80 bg-white/70 p-3">
            <div class="mb-3 flex items-center justify-between gap-2">
              <div class="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Agentes</div>
              <button type="button" class="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-femic-navy shadow-sm" data-action="open-agent-modal">Novo</button>
            </div>
            <div class="agent-manager-list-scroll scroll-soft flex max-h-[54vh] flex-col gap-2 overflow-auto pr-1">
              ${(state.agents || []).map((agent) => `
                <div class="rounded-xl border ${editing.id === agent.id ? "border-sky-200 bg-sky-50/80" : "border-slate-200 bg-white/85"} p-2 shadow-sm">
                  <div class="flex items-start gap-2">
                    <button type="button" class="min-w-0 flex-1 text-left" data-action="edit-agent" data-agent-id="${escapeHtml(agent.id)}">
                      <div class="flex items-center gap-2">
                        <span class="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-sm">${escapeHtml(agent.emoji || "✨")}</span>
                        <div class="min-w-0">
                          <div class="truncate text-sm font-semibold text-slate-900">${escapeHtml(agent.name)}</div>
                          <div class="truncate text-[11px] text-slate-500">${agent.modelOverrideEnabled ? `Modelo proprio · ${escapeHtml(agent.textProvider || "global")}` : "Modelo global"}</div>
                        </div>
                      </div>
                    </button>
                    <div class="flex shrink-0 gap-1">
                      <button type="button" class="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-500" data-action="duplicate-agent" data-agent-id="${escapeHtml(agent.id)}" title="Duplicar agente">Duplicar</button>
                      <button type="button" class="rounded-lg border border-rose-100 bg-white px-2 py-1 text-[10px] font-semibold text-rose-500" data-action="delete-agent" data-agent-id="${escapeHtml(agent.id)}" title="Excluir agente">Excluir</button>
                    </div>
                  </div>
                </div>
              `).join("")}
            </div>
            <button type="button" class="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm" data-action="restore-default-agents">Restaurar padrões</button>
          </aside>

          <form data-form="agent" class="agent-manager-form scroll-soft max-h-[68vh] space-y-4 overflow-auto rounded-2xl border border-white/80 bg-white/75 p-4">
            ${isEditing ? `<input type="hidden" name="id" value="${escapeHtml(editing.id)}" />` : ""}
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
            <label class="block">
              <span class="mb-2 block text-sm font-medium text-slate-700">Estilo de resposta</span>
              <textarea class="modal-textarea min-h-[88px]" name="responseStyle" placeholder="Ex.: responda com subtítulos curtos, bullets e uma conclusão objetiva.">${escapeHtml(editing.responseStyle || "")}</textarea>
            </label>

            <section class="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <label class="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
                <input type="checkbox" name="modelOverrideEnabled" ${editing.modelOverrideEnabled ? "checked" : ""} />
                Usar modelo próprio para este agente
              </label>
              <div class="grid gap-3 md:grid-cols-2">
                <label class="block">
                  <span class="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Provedor</span>
                  <select class="modal-input" name="textProvider">
                    <option value="" ${!editing.textProvider ? "selected" : ""}>Usar provedor global</option>
                    <option value="openrouter" ${editing.textProvider === "openrouter" ? "selected" : ""}>OpenRouter</option>
                    <option value="deepseek" ${editing.textProvider === "deepseek" ? "selected" : ""}>DeepSeek</option>
                    <option value="groq" ${editing.textProvider === "groq" ? "selected" : ""}>Groq</option>
                    <option value="gemini" ${editing.textProvider === "gemini" ? "selected" : ""}>Google Gemini</option>
                  </select>
                </label>
                <label class="block">
                  <span class="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">OpenRouter</span>
                  <select class="modal-input" name="textModel">
                    <option value="">Modelo global</option>
                    ${renderModelOptions(state.modelOptions, editing.textModel)}
                  </select>
                </label>
                <label class="block">
                  <span class="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">DeepSeek</span>
                  <select class="modal-input" name="deepSeekModel">
                    <option value="">Modelo global</option>
                    ${renderModelOptions(state.deepSeekModelOptions, editing.deepSeekModel)}
                  </select>
                </label>
                <label class="block">
                  <span class="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Groq</span>
                  <select class="modal-input" name="groqModel">
                    <option value="">Modelo global</option>
                    ${renderModelOptions(state.groqModelOptions, editing.groqModel)}
                  </select>
                </label>
                <label class="block">
                  <span class="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Gemini</span>
                  <select class="modal-input" name="geminiModel">
                    <option value="">Modelo global</option>
                    ${renderModelOptions(state.geminiModelOptions, editing.geminiModel)}
                  </select>
                </label>
              </div>
            </section>

            <section class="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 md:grid-cols-3">
              <label class="block">
                <span class="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Imagem</span>
                <select class="modal-input" name="defaultImageMode">${renderModeOptions(editing.defaultImageMode || "inherit")}</select>
              </label>
              <label class="block">
                <span class="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Busca web</span>
                <select class="modal-input" name="defaultWebSearchMode">${renderModeOptions(editing.defaultWebSearchMode || "inherit")}</select>
              </label>
              <label class="block">
                <span class="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">PubMed</span>
                <select class="modal-input" name="defaultPubmedMode">${renderModeOptions(editing.defaultPubmedMode || "inherit")}</select>
              </label>
            </section>

            <div class="rounded-2xl border border-sky-100 bg-sky-50/70 p-4 text-sm text-slate-600">
              <div class="text-xs font-bold uppercase tracking-[0.16em] text-femic-navy">Preview</div>
              <p class="mt-2"><strong class="text-slate-900">${escapeHtml(editing.name || "Novo agente")}</strong> ${escapeHtml(editing.description || "ainda sem descrição.")}</p>
              <p class="mt-1">Modelo: ${editing.modelOverrideEnabled ? `próprio (${escapeHtml(editing.textProvider || "global")})` : "global do sistema"}.</p>
            </div>

            <div class="flex flex-wrap justify-end gap-3 pt-2">
              <button type="button" class="rounded-full border border-slate-200 px-5 py-2.5 font-medium text-slate-600" data-action="close-modal" data-modal="agentForm">Cancelar</button>
              <button type="submit" class="rounded-full bg-femic-navy px-5 py-2.5 font-semibold text-white shadow-soft">${isEditing ? "Salvar agente" : "Criar agente"}</button>
            </div>
          </form>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function renderApp(state) {
  const app = document.getElementById("app");
  const previousMessagesPanel = document.getElementById("messages-panel");
  const oldChatId = previousMessagesPanel?.dataset?.chatId || null;
  const newChatId = state.activeChatId || null;
  if (previousMessagesPanel && oldChatId) {
    chatScrollPositions[oldChatId] = previousMessagesPanel.scrollTop;
  }
  const keepAtBottom = previousMessagesPanel
    ? shouldAutoScroll({
        scrollTop: previousMessagesPanel.scrollTop,
        clientHeight: previousMessagesPanel.clientHeight,
        scrollHeight: previousMessagesPanel.scrollHeight,
      })
    : true;
  scrollListenerBound = false;
  const sidebarOpenClass = state.mobileSidebarOpen ? "open" : "";
  const collapsedClass = state.sidebarCollapsed ? "sidebar-collapsed" : "";
  const activeAgent = state.activeAgent;
  const instagramMode = activeAgent?.id === "agent-instagram-producer";
  const scienceMode = isScienceAgent(state);
  const brasilMode = isBrasilAgent(state);
  const activeChat = state.chats.find((item) => item.id === state.activeChatId);
  const hasMessages = Boolean(activeChat?.messages?.length);
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

        <div class="sidebar-top-actions sidebar-expanded-only mb-3 flex items-center justify-between">
          <button type="button" class="sidebar-icon-action" data-action="create-chat" title="Nova conversa">
            <span>＋</span>
          </button>
          <button type="button" class="sidebar-icon-action" data-action="toggle-board-view" title="Board de conversas">
            <span>📋</span>
          </button>
          <button type="button" class="sidebar-icon-action" data-action="open-memory" title="Memoria persistente">
            <span>🧠</span>
          </button>
          <button type="button" class="sidebar-icon-action" data-action="open-help" title="Ajuda e tutorial">
            <span>?</span>
          </button>
          <button type="button" class="sidebar-icon-action" data-action="open-settings" title="Configurações">
            <span>⚙</span>
          </button>
        </div>

        <div class="sidebar-main">
        <section class="sidebar-section sidebar-section-agents rounded-xl border border-white/10 bg-white/5 p-2.5">
          <div class="sidebar-expanded-only mb-3 flex items-center justify-between">
            <div class="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/55">Agentes</div>
          <button type="button" class="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/15 text-sm font-semibold text-white shadow-sm" style="background:rgba(255,255,255,0.12); opacity:0.96;" data-action="open-agent-modal" title="Novo agente">＋</button>
          </div>
          <div class="sidebar-scroll sidebar-agents-scroll agent-icon-grid scroll-soft pr-1">
            <button
              type="button"
              class="agent-icon-card ${state.activeAgentId === "no-agent" ? "active" : ""}"
              data-action="select-agent"
              data-agent-id="no-agent"
              title="Conversa sem agente (chat normal)"
              aria-label="Nenhum agente"
            >
              <span class="agent-icon-glyph" style="font-size:18px;">💬</span>
            </button>
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
      ${state.mobileSidebarOpen ? '<div class="sidebar-overlay" data-action="toggle-sidebar"></div>' : ""}

      <main class="app-main relative min-w-0">
        ${state.viewMode === "board"
          ? renderBoardView(state)
          : `<button type="button" class="fixed left-3 top-3 z-30 inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white/80 text-base text-slate-600 shadow-sm backdrop-blur-sm lg:hidden" data-action="toggle-sidebar">☰</button>
        <div class="chat-workspace ${instagramMode ? "instagram-workspace" : ""} ${hasMessages ? "has-messages reading-mode" : ""} mx-auto flex max-w-[1440px] flex-col px-4 py-3 sm:px-5 lg:px-6">
          ${renderActiveAgentSummary(state)}

          <section id="messages-panel" data-chat-id="${escapeHtml(state.activeChatId || "")}" class="chat-timeline scroll-soft min-h-0 flex-1 space-y-3 overflow-auto pr-1 pb-1">
            ${renderMessages(state)}
            <div class="timeline-end-spacer" aria-hidden="true"></div>
            <button
              type="button"
              class="scroll-to-bottom-btn fixed bottom-24 right-6 z-20 hidden h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-lg text-slate-500 shadow-lg transition-all hover:bg-slate-50 hover:text-slate-700"
              data-action="scroll-to-bottom"
              title="Rolar para o final"
            >↓</button>
          </section>

          <footer class="composer-dock shrink-0 pt-2">
            <div class="composer-panel glass-panel rounded-2xl border border-white/70 px-3 py-2.5 shadow-sm">
              ${instagramMode ? renderInstagramCreativePanel(state) : `${scienceMode ? renderPubMedControls(state) : ""}${renderAttachmentChips(state)}`}
              <form data-form="composer">
                <div class="flex flex-col gap-1.5">
                  ${instagramMode
                    ? `<textarea
                        id="composer-input"
                        name="message"
                        class="min-h-[38px] max-h-[100px] w-full resize-y rounded-xl border border-sky-200/90 bg-white/90 px-3 py-2 text-sm text-slate-800 shadow-inner outline-none ring-0 placeholder:text-slate-400 focus:border-sky-300 focus:ring-3 focus:ring-sky-100"
                        placeholder='Descreva o que quer na arte (ex: "fundo azul com texto branco e logo no canto") ou deixe em branco para usar o briefing'
                      >${escapeHtml(state.draftMessage || "")}</textarea>`
                    : `<textarea
                        id="composer-input"
                        name="message"
                        class="min-h-[48px] max-h-[120px] w-full resize-y rounded-xl border border-slate-200/90 bg-white/95 px-3.5 py-2.5 text-sm text-slate-800 shadow-inner outline-none ring-0 placeholder:text-slate-400 focus:border-sky-300 focus:ring-3 focus:ring-sky-100"
                        placeholder="${escapeHtml(brasilMode ? state.webSearchMode ? "Digite um CEP, CNPJ ou uma pergunta para buscar na internet..." : "Digite um CEP ou CNPJ para consultar..." : scienceMode && state.pubmedMode ? "Digite sua pergunta científica para buscar na PubMed..." : state.webSearchMode ? `Digite sua pergunta para buscar na internet com ${getProviderLabel(state)}...` : `Digite sua mensagem para ${activeAgent?.name || "o FEMIC GPT"}...`)}"
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
                        <input id="file-input" type="file" class="hidden" multiple accept=".pdf,.xlsx,.xls,.csv,.xml,.txt,.docx,.jpg,.jpeg,.png" data-action="attach-files" />
                        <span>📎</span>
                        <span>Anexar</span>
                      </label>`}
                      ${instagramMode ? "" : `<button type="button" class="control-btn inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-medium shadow-sm ${state.imageMode ? "border-cyan-300 bg-cyan-50 text-cyan-900" : "border-slate-200 bg-white/70 text-slate-600"}" data-action="toggle-image-mode">
                        <span>${state.imageMode ? "🖼️" : "✍️"}</span>
                        <span>${state.imageMode ? "Imagem" : "Texto"}</span>
                      </button>`}
                      ${instagramMode ? "" : renderWebSearchControls(state)}
                      ${instagramMode ? "" : `<button type="button" class="control-btn inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold shadow-sm transition-all ${state.smartMode ? "border-emerald-500 bg-emerald-500 text-white shadow-emerald-200" : "border-slate-200 bg-slate-100 text-slate-500"}" data-action="toggle-smart-mode" title="Modo automatico: escolhe modelo e web search conforme a pergunta">
                        <span>${state.smartMode ? "⚡" : "🤖"}</span>
                        <span>${state.smartMode ? "AUTO" : "MANUAL"}</span>
                      </button>`}
                      ${instagramMode ? "" : `<button type="button" class="control-btn inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-medium shadow-sm ${state.thinkingEnabled ? "border-violet-400 bg-violet-50 text-violet-800 ring-2 ring-violet-200" : "border-slate-200 bg-white/70 text-slate-600"}" data-action="toggle-thinking-mode" title="Thinking: raciocinio encadeado para modelos compatíveis">
                        <span>🧠</span>
                        <span>Think</span>
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
                  ${instagramMode ? "" : renderModelGuidance(state)}
                </div>
              </form>
            </div>
          </footer>
        </div>`}
      </main>
    </div>
    ${renderSettingsModal(state)}
    ${renderRenameChatModal(state)}
    ${renderHelpModal(state)}
    ${renderMemoryModal(state)}
    ${renderBrandModal(state)}
    ${renderAgentModal(state)}
    ${renderEmailComposeModal(state)}
    ${renderWhatsAppComposeModal(state)}
  `;

  document.body.classList.toggle("modal-open", state.modals.settings || state.modals.agentForm || state.modals.brandForm || state.modals.renameChat || state.modals.help || state.modals.emailCompose || state.modals.whatsappCompose);
  const messagesPanel = document.getElementById("messages-panel");
  if (messagesPanel) {
    const chatChanged = oldChatId && oldChatId !== newChatId;
    if (chatChanged && chatScrollPositions[newChatId] != null) {
      messagesPanel.scrollTop = chatScrollPositions[newChatId];
    } else if (keepAtBottom) {
      messagesPanel.scrollTop = messagesPanel.scrollHeight;
    }
  }
  if (messagesPanel && !state.viewMode?.startsWith("board")) {
    if (!scrollListenerBound) {
      scrollListenerBound = true;
      messagesPanel.addEventListener("scroll", () => {
        const b = document.querySelector(".scroll-to-bottom-btn");
        if (!b) return;
        const nearBottom = messagesPanel.scrollTop + messagesPanel.clientHeight >= messagesPanel.scrollHeight - 50;
        b.classList.toggle("hidden", nearBottom);
        b.classList.toggle("flex", !nearBottom);
      }, { passive: true });
    }
  }

  if (globalThis.hljs) {
    requestAnimationFrame(() => {
      document.querySelectorAll('.markdown-body pre code:not(.hljs)').forEach(el => {
        try { globalThis.hljs.highlightElement(el); } catch { console.warn("[FEMIC GPT] Erro no highlight.js (render)"); }
      });
    });
  }

  try {
    const chatWorkspace = app?.querySelector(".chat-workspace");
    if (chatWorkspace && !chatWorkspace._dropBound) {
      chatWorkspace._dropBound = true;
      let dragCounter = 0;
      const dropOverlay = document.createElement("div");
      dropOverlay.className = "drop-overlay hidden";
      dropOverlay.innerHTML = '<div class="drop-overlay-content"><span style="font-size:2rem">📁</span><span>Solte os arquivos aqui</span></div>';
      chatWorkspace.appendChild(dropOverlay);
      chatWorkspace.style.position = "relative";

      chatWorkspace.addEventListener("dragenter", (e) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter++;
        dropOverlay.classList.remove("hidden");
      });
      chatWorkspace.addEventListener("dragleave", (e) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter--;
        if (dragCounter <= 0) { dragCounter = 0; dropOverlay.classList.add("hidden"); }
      });
      chatWorkspace.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
      chatWorkspace.addEventListener("drop", (e) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter = 0;
        dropOverlay.classList.add("hidden");
        const files = e.dataTransfer?.files;
        if (files?.length) handlers.onAttachFiles(files);
      });
    }
  } catch {
    // Drag & drop nao disponivel neste ambiente
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
    if (action === "duplicate-agent") handlers.onDuplicateAgent(target.dataset.agentId);
    if (action === "restore-default-agents") handlers.onRestoreDefaultAgents();
    if (action === "select-chat") handlers.onSelectChat(target.dataset.chatId);
    if (action === "delete-chat") { event.stopPropagation(); handlers.onDeleteChat(target.dataset.chatId); }
    if (action === "archive-chat") { event.stopPropagation(); handlers.onArchiveChat(target.dataset.chatId); }
    if (action === "create-chat") handlers.onCreateChat();
    if (action === "open-help") handlers.onOpenHelp();
    if (action === "open-settings") handlers.onOpenSettings();
    if (action === "open-memory") handlers.onOpenMemory();
    if (action === "apply-global-prompt-template") handlers.onApplyGlobalPromptTemplate();
    if (action === "fetch-openrouter-models") handlers.onFetchOpenRouterModels();
    if (action === "toggle-openrouter-model") handlers.onToggleOpenRouterModel(target.dataset.modelId);
    if (action === "open-agent-modal") handlers.onOpenAgentModal();
    if (action === "open-brand-modal") handlers.onOpenBrandModal(target.dataset.brandId);
    if (action === "close-modal") handlers.onCloseModal(target.dataset.modal);
    if (action === "toggle-image-mode") handlers.onToggleImageMode();
    if (action === "toggle-pin-chat") { event.stopPropagation(); handlers.onTogglePinChat(target.dataset.chatId); }
    if (action === "toggle-show-archived") handlers.onToggleShowArchived();
    if (action === "restore-archived") handlers.onRestoreArchived(target.dataset.chatId);
    if (action === "delete-archived") handlers.onDeleteArchived(target.dataset.chatId);
    if (action === "toggle-smart-mode") handlers.onToggleSmartMode();
    if (action === "toggle-thinking-mode") handlers.onToggleThinkingMode();
    if (action === "toggle-voice") handlers.onToggleVoice();
    if (action === "speak-message") handlers.onSpeakMessage(target.dataset.messageId);
    if (action === "copy-message") handlers.onCopyMessage(target.dataset.messageId);
    if (action === "clear-attachments") handlers.onClearAttachments();
    if (action === "toggle-sidebar") handlers.onToggleSidebar();
    if (action === "toggle-sidebar-collapse") handlers.onToggleSidebarCollapse();
    if (action === "toggle-agent-summary") handlers.onToggleAgentSummary();
    if (action === "set-chat-category") handlers.onSetChatCategory(target.dataset.chatId, target.dataset.category);
    if (action === "set-message-category") handlers.onSetMessageCategory(target.dataset.messageId, target.dataset.category);
    if (action === "rename-chat") handlers.onRenameChat(target.dataset.chatId);
    if (action === "export-chat-pdf") handlers.onExportChatPDF?.();
    if (action === "clear-chat") handlers.onClearChat();
    if (action === "toggle-category-picker") handlers.onToggleCategoryPicker(target.dataset.chatId);
    if (action === "toggle-message-category-picker") handlers.onToggleMessageCategoryPicker(target.dataset.messageId);
    if (action === "filter-by-category") handlers.onFilterByCategory(target.dataset.category);
    if (action === "change-image-size") handlers.onChangeImageSize(target.dataset.imageSize);
    if (action === "toggle-board-view") handlers.onToggleBoardView();
    if (action === "toggle-pubmed-mode") handlers.onTogglePubMedMode();
    if (action === "toggle-creative-brief") handlers.onToggleCreativeBrief?.();
    if (action === "toggle-web-search-mode") handlers.onToggleWebSearchMode();
    if (action === "toggle-model-guidance") handlers.onToggleModelGuidance();
    if (action === "search-chats") handlers.onSearchChats(target.value);
    if (action === "export-data") handlers.onExportData();
    if (action === "delete-brand") handlers.onDeleteBrand(target.dataset.brandId);
    if (action === "save-current-template") handlers.onSaveCurrentAsTemplate();
    if (action === "delete-brand-template") handlers.onDeleteBrandTemplate(target.dataset.templateId);
    if (action === "remove-memory-fact") handlers.onRemoveMemoryFact(target.dataset.factId);
    if (action === "open-email-compose") handlers.onOpenEmailCompose?.(target.dataset.contactId ? { id: Number(target.dataset.contactId) } : null);
    if (action === "open-whatsapp-compose") handlers.onOpenWhatsAppCompose?.(target.dataset.contactId ? { id: Number(target.dataset.contactId) } : null);
    if (action === "pick-model") {
      const input = app.querySelector('input[name="textModel"]');
      if (input) {
        input.value = target.dataset.modelValue || "";
      }
    }
    if (action === "scroll-to-bottom") {
      const panel = document.getElementById("messages-panel");
      if (panel) {
        panel.scrollTop = panel.scrollHeight;
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
    if (formType === "rename-chat") {
      handlers.onSaveChatRename(Object.fromEntries(data.entries()));
    }
    if (formType === "agent") {
      handlers.onSaveAgent(Object.fromEntries(data.entries()));
    }
    if (formType === "brand") {
      handlers.onSaveBrand(Object.fromEntries(data.entries()));
    }
    if (formType === "email-compose") {
      const entries = Object.fromEntries(data.entries());
      handlers.onSendEmailNow(entries);
    }
    if (formType === "whatsapp-compose") {
      const entries = Object.fromEntries(data.entries());
      handlers.onSendWhatsAppNow(entries);
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

    if (input.dataset.action === "change-pubmed-result-limit") {
      handlers.onChangePubMedResultLimit(input.value);
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
    const target = event.target;
    const isMod = event.ctrlKey || event.metaKey;

    if (event.key === "Enter" && !event.shiftKey && target.id === "composer-input") {
      event.preventDefault();
      handlers.onSendMessage(target.value);
      return;
    }

    if (event.key === "Escape" && !target.closest("[contenteditable]")) {
      const openModal = document.querySelector(".modal-overlay:not(.hidden), [data-modal-surface]:not(.hidden)");
      const shortcuts = document.querySelector(".shortcuts-overlay");
      if (shortcuts) { shortcuts.remove(); return; }
      if (openModal) {
        const closeBtn = openModal.querySelector('[data-action="close-modal"]');
        if (closeBtn) closeBtn.click();
      }
      return;
    }

    if (event.key === "?" && !target.closest("input, textarea, [contenteditable]")) {
      event.preventDefault();
      if (!document.querySelector(".shortcuts-overlay")) showShortcutsOverlay(handlers);
      return;
    }

    if (isMod && event.key === "k") {
      event.preventDefault();
      const searchInput = document.querySelector('[data-action="search-chats"]');
      if (searchInput) searchInput.focus();
      return;
    }

    if (isMod && (event.key === "n" || event.key === "N")) {
      event.preventDefault();
      const createBtn = document.querySelector('[data-action="create-chat"]');
      if (createBtn) createBtn.click();
      return;
    }

    if (event.key === "/" && !target.closest("input, textarea, [contenteditable]")) {
      event.preventDefault();
      const composer = document.getElementById("composer-input");
      if (composer) composer.focus();
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

  const dismiss = () => {
    clearTimeout(element._toastTimer);
    if (!element.isConnected) return;
    element.classList.add("toast-out");
    setTimeout(() => element.remove(), 300);
  };

  element.addEventListener("click", dismiss);
  element._toastTimer = setTimeout(dismiss, 3800);
}
