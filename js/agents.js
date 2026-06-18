const AGENTS_KEY = "femicgpt:agents";

export function getDefaultAgents() {
  return [
    {
      id: "agent-general",
      name: "Assistente Geral",
      emoji: "🧠",
      description: "IA versátil para tarefas gerais, estratégia, escrita e apoio no dia a dia.",
      systemPrompt:
        "Você é o Assistente Geral do FEMIC GPT. Seja útil, claro, direto, confiável e adaptável. Responda em português do Brasil por padrão, a menos que o usuário peça outro idioma.",
      isDefault: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: "agent-marketing",
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
      id: "agent-science",
      name: "Cientista & Pesquisador",
      emoji: "🔬",
      description:
        "Focado em análise rigorosa de dados, leitura crítica de artigos e linguagem técnica em saúde.",
      systemPrompt:
        "Você é um cientista e pesquisador rigoroso. Priorize precisão, método, evidência, limitações, linguagem técnica quando necessário e distinção entre fatos, hipóteses e inferências.",
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
    return stored;
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
  const agent = {
    id: createAgentId(data.name, agents),
    name: data.name.trim(),
    emoji: data.emoji?.trim() || "✨",
    description: data.description.trim(),
    systemPrompt: data.systemPrompt.trim(),
    isDefault: false,
    createdAt: new Date().toISOString(),
  };

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

  agents[index] = {
    ...agents[index],
    ...data,
    name: data.name?.trim() ?? agents[index].name,
    emoji: data.emoji?.trim() ?? agents[index].emoji,
    description: data.description?.trim() ?? agents[index].description,
    systemPrompt: data.systemPrompt?.trim() ?? agents[index].systemPrompt,
    updatedAt: new Date().toISOString(),
  };

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
