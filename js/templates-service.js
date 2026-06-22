import { salvarTemplate, listarTemplates, carregarTemplate, deletarTemplate } from "./editorStorage.js";

export const CATEGORIAS_TEMPLATE = [
  { id: "quadrado", label: "Post Quadrado" },
  { id: "retrato", label: "Post Retrato" },
  { id: "story", label: "Story" },
  { id: "reel-cover", label: "Reel Cover" },
  { id: "carrossel", label: "Carrossel" },
  { id: "destaque", label: "Destaque" },
  { id: "promocao", label: "Promoção" },
  { id: "anuncio", label: "Anúncio" },
];

export async function criarTemplate(nome, canvasData, categoria) {
  return salvarTemplate({ nome, canvasData, categoria });
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
