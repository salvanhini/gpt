export const RESPONSE_MODES = [
  { value: "estruturado", label: "Estruturado" },
  { value: "aula", label: "Aula completa" },
  { value: "apostila", label: "Apostila" },
  { value: "executivo", label: "Executivo" },
];

const RESPONSE_MODE_VALUES = new Set(RESPONSE_MODES.map((mode) => mode.value));

export function normalizeResponseMode(value) {
  return RESPONSE_MODE_VALUES.has(value) ? value : "estruturado";
}

export function getResponseDepthInstruction(mode = "estruturado") {
  const normalized = normalizeResponseMode(mode);
  if (normalized === "aula") {
    return [
      "Modo Aula Completa:",
      "Esta resposta DEVE ser substancialmente mais longa e didatica que o modo estruturado.",
      "Produza uma aula completa, com introducao, capitulos/secoes, desenvolvimento progressivo, exemplos praticos, analogias quando ajudarem, tabelas quando forem uteis e conclusao final.",
      "Explique o raciocinio e os conceitos de forma ensinavel, sem virar apenas lista de topicos.",
      "Nao reduza a resposta a um resumo curto, a menos que o usuario peca explicitamente.",
    ].join("\n");
  }
  if (normalized === "apostila") {
    return [
      "Modo Apostila:",
      "Esta resposta DEVE parecer material de estudo, mais extensa que uma aula comum.",
      "Organize em modulos/secoes, com objetivos de aprendizagem, conceitos, desenvolvimento, exemplos, aplicacoes praticas, quadro-resumo, perguntas de revisao e conclusao.",
      "Mantenha linguagem didatica e estrutura consistente para estudo.",
    ].join("\n");
  }
  if (normalized === "executivo") {
    return [
      "Modo Executivo:",
      "Responda de forma curta, objetiva e priorizada. Corte explicacoes longas.",
      "Use no maximo os pontos essenciais, com tabela apenas quando ela economizar espaco ou clarear decisoes.",
    ].join("\n");
  }
  return "";
}

function cleanPreview(text = "", max = 180) {
  return String(text).replace(/\s+/g, " ").trim().slice(0, max);
}

export function buildDocumentBrief(file = {}) {
  const meta = file.documentMeta || {};
  const pageIndex = Array.isArray(meta.pageIndex) ? meta.pageIndex : [];
  const status = meta.extractionMethod || file.status || "lido";
  const pages = Number(meta.pages) || pageIndex.length || 0;
  const usefulPages = Number(meta.usefulPages) || pageIndex.filter((page) => page.useful).length || 0;
  const pageHighlights = pageIndex
    .filter((page) => page.useful || page.preview)
    .slice(0, 8)
    .map((page) => `Pagina ${page.pageNumber}: ${cleanPreview(page.preview || "") || `${page.chars || 0} caracteres extraidos`}`)
    .join("\n");

  return {
    name: file.name || "Documento",
    type: file.type || "",
    status,
    pages,
    usefulPages,
    extractedChars: Number(meta.extractedChars) || 0,
    visualPagesRendered: Number(meta.visualPagesRendered) || 0,
    truncated: Boolean(meta.truncated || file.truncated),
    summary: `${file.name || "Documento"}: ${pages || "n/d"} paginas, ${usefulPages} pagina(s) uteis, leitura ${status}.`,
    pageHighlights,
  };
}

export function buildDocumentSynthesis(filesOrBriefs = []) {
  const briefs = filesOrBriefs.map((item) => item?.summary ? item : buildDocumentBrief(item));
  if (!briefs.length) return "";
  const totalPages = briefs.reduce((sum, brief) => sum + (Number(brief.pages) || 0), 0);
  const visualCount = briefs.filter((brief) => Number(brief.visualPagesRendered) > 0).length;
  const partialCount = briefs.filter((brief) => brief.status === "weak" || brief.truncated).length;

  return [
    `Documentos ativos: ${briefs.length}; paginas totais estimadas: ${totalPages || "n/d"}.`,
    visualCount ? `Leitura visual preparada em ${visualCount} documento(s).` : "",
    partialCount ? `Atencao: ${partialCount} documento(s) podem ter leitura parcial ou truncada.` : "",
    "Indice dos documentos:",
    ...briefs.map((brief, index) => `${index + 1}. ${brief.summary}`),
  ].filter(Boolean).join("\n");
}
