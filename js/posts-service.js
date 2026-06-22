import { salvarPost, listarPosts, buscarPost, deletarPost } from "./editorStorage.js";

export async function criarPost(data) {
  return salvarPost(data);
}

export async function listarPostsSalvos(filtros) {
  return listarPosts(filtros);
}

export async function obterPost(id) {
  return buscarPost(id);
}

export async function removerPost(id) {
  return deletarPost(id);
}
