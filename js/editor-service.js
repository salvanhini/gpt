const MINIPAINT_URL = "https://viliusle.github.io/miniPaint/";

export class EditorService {
  constructor() {
    this.iframe = null;
    this.container = null;
    this.originalImageUrl = null;
    this.isReady = false;
  }

  inicializar(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) throw new Error(`Container #${containerId} not found`);
    this.isReady = true;
  }

  async carregarImagem(imageUrl) {
    if (!this.isReady || !this.container) return;
    this.originalImageUrl = imageUrl;

    const iframeId = "minipaint-iframe";
    this.iframe = document.createElement("iframe");
    this.iframe.id = iframeId;
    this.iframe.className = "minipaint-iframe";
    this.iframe.src = MINIPAINT_URL;
    this.iframe.allowFullscreen = true;
    this.iframe.sandbox = "allow-scripts allow-same-origin allow-popups allow-modals";
    this.container.appendChild(this.iframe);

    return new Promise((resolve) => {
      this.iframe.onload = () => resolve(this.iframe);
    });
  }

  async adicionarTexto(texto, opcoes = {}) {
  }

  async adicionarForma(tipo, opcoes = {}) {
  }

  async adicionarSticker(stickerId, opcoes = {}) {
  }

  async aplicarFiltro(tipoFiltro, parametros = {}) {
  }

  async aplicarAjuste(tipoAjuste, valor) {
  }

  async transformar(rotacao, espelhamento, perspectiva) {
  }

  async aplicarCrop(opcoes) {
  }

  async aplicarResize(largura, altura) {
  }

  async aplicarWatermark(textoOuImagem, opcoes) {
  }

  async removerFiltros() {
  }

  async excluirElemento() {
  }

  async duplicarElemento() {
  }

  async undo() {
  }

  async redo() {
  }

  async salvarEstado() {
  }

  async resetar() {
  }

  async exportarImagem(formato = "png", qualidade = 1) {
    return this.originalImageUrl;
  }

  async salvarProjeto(nome) {
    return {
      nome: nome || "Projeto sem nome",
      imagemOriginalUrl: this.originalImageUrl,
      largura: 1080,
      altura: 1080,
      formato: "quadrado",
    };
  }

  async carregarProjeto(storeData) {
    const data = typeof storeData === "string" ? JSON.parse(storeData) : storeData;
    if (data.imagemOriginalUrl) {
      this.originalImageUrl = data.imagemOriginalUrl;
    }
  }

  async listarProjetos() {
    return import("./editorStorage.js").then((m) => m.listarProjetosEditor());
  }

  async deletarProjeto(projetoId) {
    return import("./editorStorage.js").then((m) => m.deletarProjetoEditor(projetoId));
  }

  async aplicarPreset(nome) {
  }

  async criarPreset(nome, configuracoes) {
  }

  async listarPresets() {
    return [];
  }

  async deletarPreset(presetId) {
  }

  async exportarMultiplosFormatos(formatos) {
    const result = {};
    for (const f of formatos) {
      result[f] = this.originalImageUrl;
    }
    return result;
  }

  destruir() {
    if (this.iframe) {
      this.iframe.remove();
      this.iframe = null;
    }
    this.container = null;
    this.originalImageUrl = null;
    this.isReady = false;
  }
}
