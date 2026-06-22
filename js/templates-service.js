import { salvarTemplate, listarTemplates, carregarTemplate, deletarTemplate } from "./editorStorage.js";

export const CATEGORIAS_TEMPLATE = [
  { id: "quadrado", label: "Post Quadrado", w: 1080, h: 1080 },
  { id: "retrato", label: "Post Retrato", w: 1080, h: 1350 },
  { id: "story", label: "Story", w: 1080, h: 1920 },
  { id: "reel-cover", label: "Reel Cover", w: 1080, h: 1920 },
  { id: "carrossel", label: "Carrossel", w: 1080, h: 1350 },
  { id: "destaque", label: "Destaque", w: 1080, h: 1080 },
  { id: "promocao", label: "Promoção", w: 1080, h: 1080 },
  { id: "anuncio", label: "Anúncio", w: 1200, h: 628 },
];

export async function criarTemplate(nome, storeData, categoria) {
  return salvarTemplate({ nome, storeData, categoria });
}

export async function listarTemplatesPorCategoria(categoria) {
  return listarTemplates(categoria);
}

export async function obterTemplate(id) {
  return carregarTemplate(id);
}

export async function removerTemplate(id) {
  return deletarTemplate(id);
}

export function criarTemplateInicial(tipo) {
  const cat = CATEGORIAS_TEMPLATE.find((c) => c.id === tipo);
  if (!cat) return null;
  return {
    nome: `${cat.label} - Template Padrão`,
    categoria: tipo,
    storeData: JSON.stringify({
      width: cat.w,
      height: cat.h,
      pages: [
        {
          children: [],
          background: "#ffffff",
        },
      ],
    }),
  };
}

