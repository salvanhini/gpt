export const INSTAGRAM_AGENT_ID = "agent-instagram-producer";

export const INSTAGRAM_FORMATS = [
  {
    id: "story_9_16",
    label: "Story 9:16",
    imageSize: "portrait_16_9",
    canvasGuidance: "composição vertical 9:16, pensada para ocupar a tela inteira de um story",
  },
  {
    id: "post_square",
    label: "Post quadrado 1:1",
    imageSize: "square_hd",
    canvasGuidance: "composição quadrada 1:1, otimizada para feed do Instagram",
  },
];

export function getInstagramFormatById(id) {
  return INSTAGRAM_FORMATS.find((format) => format.id === id) || INSTAGRAM_FORMATS[0];
}

export function isInstagramAgent(agentId) {
  return agentId === INSTAGRAM_AGENT_ID;
}

export function buildCreativeBrief(draft = {}) {
  const objective = String(draft.objective || "").trim();
  const headline = String(draft.headline || "").trim();
  const supportingText = String(draft.supportingText || "").trim();
  const cta = String(draft.cta || "").trim();

  return [
    objective ? `Objetivo: ${objective}` : "",
    headline ? `Texto principal: ${headline}` : "",
    supportingText ? `Texto complementar: ${supportingText}` : "",
    cta ? `CTA: ${cta}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildInstagramImagePrompt({ brand, formatId, draft }) {
  const format = getInstagramFormatById(formatId);
  const brandName = brand?.name?.trim() || "Marca não definida";
  const primaryColor = brand?.primaryColor?.trim() || "#1D4ED8";
  const secondaryColor = brand?.secondaryColor?.trim() || "#0F172A";
  const logoGuidance = brand?.logoUrl
    ? "Incluir a identidade visual da marca com tratamento elegante para o logo enviado pelo usuário."
    : "Reservar uma área nobre para identidade da marca, mesmo sem logo explícito.";
  const brief = buildCreativeBrief(draft);

  return [
    "Crie uma arte premium para Instagram, pronta para publicação.",
    `Formato: ${format.label}.`,
    `Canvas: ${format.canvasGuidance}.`,
    `Marca: ${brandName}.`,
    `Paleta principal: ${primaryColor} como cor dominante e ${secondaryColor} como apoio.`,
    logoGuidance,
    "Estilo: executivo claro, sofisticado, alto contraste, tipografia forte, visual limpo e comercial.",
    "Priorize legibilidade do texto, hierarquia clara, composição equilibrada e acabamento profissional.",
    "Nao usar marcas d'agua, mockups de dispositivo ou elementos fora do contexto do Instagram.",
    brief,
  ]
    .filter(Boolean)
    .join("\n");
}
