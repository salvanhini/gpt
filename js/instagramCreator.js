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
  {
    id: "carousel_cover_4_5",
    label: "Carrossel 4:5",
    imageSize: "portrait_4_3",
    canvasGuidance: "composição vertical para capa de carrossel, priorizando leitura em feed e sensação editorial",
  },
  {
    id: "reel_cover_9_16",
    label: "Capa de Reel 9:16",
    imageSize: "portrait_16_9",
    canvasGuidance: "composição vertical para capa de reel, com forte contraste e leitura imediata",
  },
  {
    id: "highlight_cover_square",
    label: "Capa de destaque",
    imageSize: "square_hd",
    canvasGuidance: "composição centralizada e simbólica para capa de destaque do Instagram",
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
  const audience = String(draft.audience || "").trim();

  return [
    objective ? `Objetivo: ${objective}` : "",
    audience ? `Publico: ${audience}` : "",
    headline ? `Texto principal: ${headline}` : "",
    supportingText ? `Texto complementar: ${supportingText}` : "",
    cta ? `CTA: ${cta}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildInstagramImagePrompt({ brand, formatId, draft, customPrompt = "" }) {
  const format = getInstagramFormatById(formatId);
  const brandName = brand?.name?.trim() || "Brand";
  const primaryColor = brand?.primaryColor?.trim() || "#1D4ED8";
  const secondaryColor = brand?.secondaryColor?.trim() || "#0F172A";
  const templateGuidance = brand?.templateStyle?.trim() || brand?.templateNotes?.trim() || "";
  const logoGuidance = brand?.logoUrl
    ? "Incorporate brand logo with elegant, premium placement."
    : "Reserve a clean area for brand identity, even without explicit logo.";
  const headline = String(draft.headline || "").trim();
  const supportingText = String(draft.supportingText || "").trim();
  const cta = String(draft.cta || "").trim();
  const audience = String(draft.audience || "").trim();

  return [
    "Professional Instagram brand asset. Ultra-premium, photorealistic, high-end commercial quality.",
    `Format: ${format.label} — ${format.canvasGuidance}.`,
    `Brand: ${brandName}.`,
    `Color palette: ${primaryColor} (dominant), ${secondaryColor} (secondary).`,
    logoGuidance,
    templateGuidance ? `Style guidance: ${templateGuidance}.` : "",
    headline ? `Main message: "${headline}".` : "",
    supportingText ? `Supporting text: "${supportingText}".` : "",
    cta ? `Call to action: "${cta}".` : "",
    audience ? `Target audience: ${audience}.` : "",
    customPrompt ? `User request: ${customPrompt}.` : "",
    "Style: clean, sophisticated, high contrast, bold typography, strong visual hierarchy.",
    "Quality: volumetric lighting, soft shadows, subtle gradients, premium finish, 8K detail.",
    "CRITICAL: All visible text in the image MUST be in BRAZILIAN PORTUGUESE.",
    "No watermarks, no device mockups, no UI elements. Pure professional brand asset.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildInstagramVariationPrompt({ basePrompt, variationIndex, totalVariations }) {
  return [
    basePrompt,
    `Variation ${variationIndex} of ${totalVariations}.`,
    "Keep the same brand, offer, and goal.",
    "Change composition, framing, typography layout, graphic support, and visual rhythm so each version feels unique and professional.",
  ].join("\n");
}

export function buildInstagramCopyPrompt({ brand, formatId, draft, variationCount = 1 }) {
  const format = getInstagramFormatById(formatId);
  const brief = buildCreativeBrief(draft);
  return [
    "Voce e um copywriter senior para Instagram.",
    "Escreva em portugues do Brasil.",
    "Entregue uma legenda pronta para publicar, com CTA claro, tom premium e hashtags relevantes.",
    "Nao use markdown de titulo. Use este formato exato:",
    "LEGENDA:",
    "<texto>",
    "",
    "HASHTAGS:",
    "<hashtags separadas por espaco>",
    "",
    `Marca: ${brand?.name || "Marca nao definida"}.`,
    `Formato: ${format.label}.`,
    `Quantidade de variacoes visuais: ${variationCount}.`,
    brief,
  ].join("\n");
}

export function buildInstagramCopyFallback({ brand, draft }) {
  const headline = String(draft.headline || "").trim();
  const supportingText = String(draft.supportingText || "").trim();
  const cta = String(draft.cta || "").trim();
  const objective = String(draft.objective || "").trim();
  const brandName = brand?.name?.trim() || "sua marca";

  const body = [
    headline,
    supportingText,
    objective ? `Pensado para ${objective.toLowerCase()}.` : "",
    cta || "Fale com a nossa equipe para saber mais.",
  ]
    .filter(Boolean)
    .join("\n\n");

  return `LEGENDA:\n${body}\n\nHASHTAGS:\n#${brandName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "") || "marca"} #instagrammarketing #conteudodigital #socialmedia`;
}
