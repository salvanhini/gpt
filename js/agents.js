import { INSTAGRAM_AGENT_ID } from "./instagramCreator.js";

const AGENTS_KEY = "femicgpt:agents";
export const GENERAL_AGENT_ID = "agent-general";
export const MARKETING_AGENT_ID = "agent-marketing";
export const SCIENCE_AGENT_ID = "agent-science";
export const BRASIL_AGENT_ID = "agent-brasil-consultor";

const AGENT_PARAMETER_DEFAULTS = {
  modelOverrideEnabled: false,
  textProvider: "",
  textModel: "",
  deepSeekModel: "",
  groqModel: "",
  defaultImageMode: "inherit",
  defaultWebSearchMode: "inherit",
  defaultPubmedMode: "inherit",
  responseStyle: "",
};

const MODE_DEFAULTS = new Set(["inherit", "on", "off"]);
const TEXT_PROVIDERS = new Set(["", "openrouter", "deepseek", "groq"]);

export function normalizeAgent(agent = {}) {
  const normalized = {
    ...AGENT_PARAMETER_DEFAULTS,
    ...agent,
    id: typeof agent.id === "string" ? agent.id : "",
    name: typeof agent.name === "string" ? agent.name : "",
    emoji: typeof agent.emoji === "string" && agent.emoji.trim() ? agent.emoji : "✨",
    description: typeof agent.description === "string" ? agent.description : "",
    systemPrompt: typeof agent.systemPrompt === "string" ? agent.systemPrompt : "",
    modelOverrideEnabled: Boolean(agent.modelOverrideEnabled),
    textProvider: TEXT_PROVIDERS.has(agent.textProvider) ? agent.textProvider : "",
    defaultImageMode: MODE_DEFAULTS.has(agent.defaultImageMode) ? agent.defaultImageMode : "inherit",
    defaultWebSearchMode: MODE_DEFAULTS.has(agent.defaultWebSearchMode) ? agent.defaultWebSearchMode : "inherit",
    defaultPubmedMode: MODE_DEFAULTS.has(agent.defaultPubmedMode) ? agent.defaultPubmedMode : "inherit",
    responseStyle: typeof agent.responseStyle === "string" ? agent.responseStyle : "",
  };

  return normalized;
}

function normalizeAgents(agents = []) {
  return agents
    .filter((agent) => agent && typeof agent.id === "string")
    .map(normalizeAgent);
}

export function getDefaultAgents() {
  return [
    {
      id: GENERAL_AGENT_ID,
      name: "Assistente Geral",
      emoji: "🧠",
      description: "IA versátil para tarefas gerais, estratégia, escrita e apoio no dia a dia.",
      systemPrompt:
        "Você é o Assistente Geral do FEMIC GPT. Seja útil, claro, direto, confiável e adaptável. Responda em português do Brasil por padrão, a menos que o usuário peça outro idioma.",
      isDefault: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: MARKETING_AGENT_ID,
      name: "Mestre em Marketing & Reels",
      emoji: "🎯",
      description:
        "Especialista em ganchos magnéticos, copywriting, reels e estratégias de tráfego local.",
      systemPrompt:
        "Você é um estrategista sênior de marketing digital, reels, copywriting e tráfego local. Entregue ideias com ganchos fortes, CTA claro, estrutura prática, exemplos reais e foco em conversão.",
      isDefault: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: SCIENCE_AGENT_ID,
      name: "Cientista & Pesquisador",
      emoji: "🔬",
      description:
        "Focado em análise rigorosa de dados, leitura crítica de artigos e linguagem técnica em saúde.",
      systemPrompt:
        "Você é um cientista e pesquisador rigoroso. Priorize precisão, método, evidência, limitações, linguagem técnica quando necessário e distinção entre fatos, hipóteses e inferências.",
      isDefault: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: BRASIL_AGENT_ID,
      name: "Consultor Brasil",
      emoji: "🇧🇷",
      description:
        "Consulta CEP e CNPJ com dados nacionais organizados em linguagem clara e objetiva.",
      systemPrompt:
        "Você é o Consultor Brasil do FEMIC GPT. Sua função é interpretar dados brasileiros consultados em APIs públicas e responder em português do Brasil com organização, clareza e objetividade. Ao apresentar resultados, destaque os campos principais e avise quando algo estiver ausente ou incerto.",
      isDefault: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: INSTAGRAM_AGENT_ID,
      name: "Produtor Instagram",
      emoji: "📸",
      description:
        "Cria artes premium para story e post quadrado com briefing guiado e identidade visual por marca.",
      systemPrompt:
        "Você é o Produtor Instagram do FEMIC GPT. Seu papel é transformar briefings em direções visuais premium para Instagram, respeitando identidade de marca, clareza comercial, hierarquia tipográfica e acabamento profissional. Priorize layouts limpos, elegantes, legíveis e prontos para publicação.",
      isDefault: true,
      createdAt: new Date().toISOString(),
    },
  ];
}

function safeParse(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

export function loadAgents() {
  const stored = safeParse(localStorage.getItem(AGENTS_KEY), null);
  if (Array.isArray(stored) && stored.length > 0) {
    return normalizeAgents(stored);
  }

  const defaults = getDefaultAgents();
  saveAgents(defaults);
  return defaults;
}

export function saveAgents(agents) {
  localStorage.setItem(AGENTS_KEY, JSON.stringify(agents));
  return agents;
}

function slugifyName(name) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
}

export function createAgentId(name, agents = [], randomId = () => crypto.randomUUID()) {
  const slug = slugifyName(name);
  const baseId = `agent-${slug || randomId()}`;
  const existingIds = new Set((agents || []).map((agent) => agent?.id).filter(Boolean));
  if (!existingIds.has(baseId)) {
    return baseId;
  }

  let suffix = 2;
  while (existingIds.has(`${baseId}-${suffix}`)) {
    suffix += 1;
  }

  return `${baseId}-${suffix}`;
}

export function createAgent(data) {
  const agents = loadAgents();
  const agent = normalizeAgent({
    id: createAgentId(data.name, agents),
    name: data.name.trim(),
    emoji: data.emoji?.trim() || "✨",
    description: data.description.trim(),
    systemPrompt: data.systemPrompt.trim(),
    modelOverrideEnabled: Boolean(data.modelOverrideEnabled),
    textProvider: data.textProvider || "",
    textModel: data.textModel || "",
    deepSeekModel: data.deepSeekModel || "",
    groqModel: data.groqModel || "",
    defaultImageMode: data.defaultImageMode || "inherit",
    defaultWebSearchMode: data.defaultWebSearchMode || "inherit",
    defaultPubmedMode: data.defaultPubmedMode || "inherit",
    responseStyle: data.responseStyle || "",
    isDefault: false,
    createdAt: new Date().toISOString(),
  });

  agents.unshift(agent);
  saveAgents(agents);
  return agent;
}

export function updateAgent(id, data) {
  const agents = loadAgents();
  const index = agents.findIndex((agent) => agent.id === id);
  if (index === -1) {
    throw new Error("Agente não encontrado.");
  }

  agents[index] = normalizeAgent({
    ...agents[index],
    ...data,
    name: data.name?.trim() ?? agents[index].name,
    emoji: data.emoji?.trim() ?? agents[index].emoji,
    description: data.description?.trim() ?? agents[index].description,
    systemPrompt: data.systemPrompt?.trim() ?? agents[index].systemPrompt,
    updatedAt: new Date().toISOString(),
  });

  saveAgents(agents);
  return agents[index];
}

export function deleteAgent(id) {
  const agents = loadAgents();
  if (agents.length <= 1) {
    throw new Error("É preciso manter pelo menos um agente.");
  }

  const target = agents.find((agent) => agent.id === id);
  if (!target) {
    throw new Error("Agente não encontrado.");
  }

  const nextAgents = agents.filter((agent) => agent.id !== id);
  saveAgents(nextAgents);
  return nextAgents;
}

export function duplicateAgent(id, randomId) {
  const agents = loadAgents();
  const source = agents.find((agent) => agent.id === id);
  if (!source) {
    throw new Error("Agente não encontrado.");
  }

  const name = `${source.name} copia`;
  const agent = normalizeAgent({
    ...source,
    id: createAgentId(name, agents, randomId),
    name,
    isDefault: false,
    createdAt: new Date().toISOString(),
    updatedAt: undefined,
  });

  agents.unshift(agent);
  saveAgents(agents);
  return agent;
}

export function restoreDefaultAgents() {
  const defaults = getDefaultAgents().map(normalizeAgent);
  const customAgents = loadAgents().filter((agent) => !defaults.some((item) => item.id === agent.id));
  const agents = [...defaults, ...customAgents];
  saveAgents(agents);
  return agents;
}

export function getEffectiveAgentSettings(settings = {}, agent = {}) {
  const normalized = normalizeAgent(agent);
  if (!normalized.modelOverrideEnabled) {
    return { ...settings };
  }

  return {
    ...settings,
    textProvider: normalized.textProvider || settings.textProvider,
    textModel: normalized.textModel || settings.textModel,
    deepSeekModel: normalized.deepSeekModel || settings.deepSeekModel,
    groqModel: normalized.groqModel || settings.groqModel,
  };
}
