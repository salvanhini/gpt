const POLOTNO_API_KEY = "nFA5H9elEytDyPyvKL7T";
const FORMAT_MAP = {
  quadrado: { w: 1080, h: 1080 },
  retrato: { w: 1080, h: 1350 },
  story: { w: 1080, h: 1920 },
  reel: { w: 1080, h: 1920 },
  banner: { w: 1200, h: 628 },
  carrossel: { w: 1080, h: 1080 },
  post_quadrado: { w: 1080, h: 1080 },
  post_retrato: { w: 1080, h: 1350 },
};

export class EditorService {
  constructor() {
    this.store = null;
    this.container = null;
    this.currentFormato = "quadrado";
    this.isReady = false;
  }

  async inicializar(containerId, formato = "quadrado") {
    const el = document.getElementById(containerId);
    if (!el) throw new Error(`Container #${containerId} not found`);

    this.container = el;
    this.currentFormato = formato;
    const size = FORMAT_MAP[formato] || FORMAT_MAP.quadrado;

    const { store } = createPolotnoApp({
      key: POLOTNO_API_KEY,
      showCredit: true,
      container: el,
      sections: ["photos", "text", "elements", "upload", "background", "layers", "templates"],
    });

    this.store = store;
    store.setSize(size.w, size.h);
    this.isReady = true;

    return store;
  }

  async carregarImagemFundo(imageUrl) {
    if (!this.isReady || !this.store?.activePage) return;
    const page = this.store.activePage;
    const pageWidth = this.store.width;
    const pageHeight = this.store.height;
    const el = page.addElement({
      type: "image",
      src: imageUrl,
      x: 0,
      y: 0,
      width: pageWidth,
      height: pageHeight,
      name: "__background__",
      selectable: false,
      locked: true,
      opacity: 1,
    });
    await this.store.waitLoading();
    return el;
  }

  adicionarTexto(texto, opcoes = {}) {
    if (!this.isReady || !this.store?.activePage) return;
    return this.store.activePage.addElement({
      type: "text",
      text: texto,
      x: opcoes.x ?? 100,
      y: opcoes.y ?? 100,
      fontSize: opcoes.fontSize ?? 36,
      fontFamily: opcoes.fontFamily || "Inter",
      fill: opcoes.fill ?? "#000000",
      opacity: opcoes.opacity ?? 1,
      rotation: opcoes.rotation ?? 0,
      textAlign: opcoes.textAlign || "left",
      fontWeight: opcoes.fontWeight || "normal",
      fontStyle: opcoes.fontStyle || "normal",
      width: opcoes.width || 400,
    });
  }

  adicionarForma(tipo, opcoes = {}) {
    if (!this.isReady || !this.store?.activePage) return;
    const x = opcoes.x ?? 200;
    const y = opcoes.y ?? 200;
    const w = opcoes.width || 150;
    const h = opcoes.height || 100;
    const fill = opcoes.fill ?? "#0ea5e9";
    let svgContent = "";

    switch (tipo) {
      case "retangulo":
        svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
          <rect width="${w}" height="${h}" fill="${fill}" rx="${opcoes.rx || 0}" ry="${opcoes.ry || 0}"/>
        </svg>`;
        break;
      case "circulo":
        svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
          <circle cx="${w / 2}" cy="${h / 2}" r="${Math.min(w, h) / 2}" fill="${fill}"/>
        </svg>`;
        break;
      case "triangulo":
        svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
          <polygon points="${w / 2},0 ${w},${h} 0,${h}" fill="${fill}"/>
        </svg>`;
        break;
      case "linha":
        svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
          <line x1="0" y1="${h}" x2="${w}" y2="0" stroke="${fill}" stroke-width="${opcoes.strokeWidth || 3}"/>
        </svg>`;
        break;
      default:
        throw new Error("Tipo de forma invalido: " + tipo);
    }
    return this.store.activePage.addElement({
      type: "svg",
      svgContent,
      x,
      y,
      width: w,
      height: h,
      rotation: opcoes.rotation ?? 0,
      opacity: opcoes.opacity ?? 1,
      name: "forma",
    });
  }

  async adicionarImagem(imageUrl, opcoes = {}) {
    if (!this.isReady || !this.store?.activePage) return;
    const el = this.store.activePage.addElement({
      type: "image",
      src: imageUrl,
      x: opcoes.x ?? 100,
      y: opcoes.y ?? 100,
      width: opcoes.width || 300,
      height: opcoes.height || 300,
      opacity: opcoes.opacity ?? 1,
      rotation: opcoes.rotation ?? 0,
      name: "imagem",
    });
    await this.store.waitLoading();
    return el;
  }

  async adicionarElementoUnsplash(termoBusca) {
    if (!this.isReady) return;
    this.store.openSidePanel("photos");
  }

  aplicarFiltro(tipoFiltro, parametros = {}) {
    if (!this.isReady) return;
  }

  removerFiltro() {
    if (!this.isReady) return;
  }

  excluirElemento() {
    if (!this.isReady) return;
    const ids = this.store.selectedElements.map((el) => el.id);
    if (ids.length) this.store.deleteElements(ids);
  }

  duplicarElemento() {
    if (!this.isReady || !this.store.selectedElements.length) return;
    const el = this.store.selectedElements[0];
    const json = el.toJSON();
    json.x = (json.x || 0) + 20;
    json.y = (json.y || 0) + 20;
    this.store.activePage.addElement(json);
  }

  trazerParaFrente() {
    if (!this.isReady || !this.store.selectedElements.length) return;
    const el = this.store.selectedElements[0];
    el.set({ ...el.toJSON() });
  }

  enviarParaTras() {
    if (!this.isReady || !this.store.selectedElements.length) return;
    const el = this.store.selectedElements[0];
    el.set({ ...el.toJSON() });
  }

  undo() {
    if (this.isReady && this.store.history.canUndo) this.store.history.undo();
  }

  redo() {
    if (this.isReady) this.store.history.redo();
  }

  salvarEstado() {
  }

  adicionarPagina() {
    if (!this.isReady) return;
    this.store.addPage();
  }

  removerPagina() {
    if (!this.isReady || this.store.pages.length <= 1) return;
    this.store.deletePages([this.store.activePage.id]);
  }

  navegarPagina(indice) {
    if (!this.isReady || !this.store.pages[indice]) return;
    this.store.selectPage(this.store.pages[indice].id);
  }

  redimensionarMagicamente(formatos) {
    if (!this.isReady) return;
    const f = FORMAT_MAP[formatos] || FORMAT_MAP.quadrado;
    this.store.setSize(f.w, f.h, true);
    this.currentFormato = formatos;
  }

  async exportarImagem(formato = "png", qualidade = 1, escala = 1) {
    if (!this.isReady) return "";
    await this.store.waitLoading();
    return this.store.toDataURL({
      pageId: this.store.activePage?.id,
      mimeType: formato === "jpeg" ? "image/jpeg" : "image/png",
      quality: qualidade,
      pixelRatio: escala,
    });
  }

  async exportarTodasPaginas(formato = "png") {
    if (!this.isReady) return [];
    await this.store.waitLoading();
    const results = [];
    for (const page of this.store.pages) {
      const url = await this.store.toDataURL({
        pageId: page.id,
        mimeType: formato === "jpeg" ? "image/jpeg" : "image/png",
        pixelRatio: 1,
      });
      results.push(url);
    }
    return results;
  }

  salvarProjeto(nome) {
    if (!this.isReady) return null;
    const json = this.store.toJSON();
    const thumbUrl = this.store.toDataURL({ pixelRatio: 0.15, quickMode: true });
    return {
      nome: nome || "Projeto sem nome",
      storeData: JSON.stringify(json),
      largura: this.store.width,
      altura: this.store.height,
      thumbnail: thumbUrl,
      numeroPaginas: this.store.pages.length,
      formato: this.currentFormato,
    };
  }

  async carregarProjeto(storeData) {
    if (!this.isReady) return;
    const json = typeof storeData === "string" ? JSON.parse(storeData) : storeData;
    this.store.loadJSON(json);
    await this.store.waitLoading();
  }

  listarProjetos() {
    return import("./editorStorage.js").then((m) => m.listarProjetosEditor());
  }

  deletarProjeto(projetoId) {
    return import("./editorStorage.js").then((m) => m.deletarProjetoEditor(projetoId));
  }

  limparPagina() {
    if (!this.isReady || !this.store?.activePage) return;
    const ids = this.store.activePage.children.map((c) => c.id);
    if (ids.length) this.store.deleteElements(ids);
  }

  redimensionarPagina(largura, altura) {
    if (!this.isReady) return;
    this.store.setSize(largura, altura, true);
  }

  getElementoSelecionado() {
    if (!this.isReady) return null;
    return this.store.selectedElements[0] || null;
  }

  atualizarPropriedades(propriedades) {
    if (!this.isReady || !this.store.selectedElements.length) return;
    const el = this.store.selectedElements[0];
    el.set(propriedades);
  }

  async adicionarTemplate(templateData) {
    if (!this.isReady) return;
    const json = typeof templateData === "string" ? JSON.parse(templateData) : templateData;
    this.store.loadJSON(json);
    await this.store.waitLoading();
  }

  buscarTemplates(categoria) {
    return import("./editorStorage.js").then((m) => m.listarTemplates(categoria));
  }

  async aplicarIdentidadeVisual(identidade) {
    if (!this.isReady || !identidade) return;
    const page = this.store.activePage;
    if (!page) return;
    if (identidade.corPrimaria) {
    }
    if (identidade.logoUrl) {
      await this.adicionarImagem(identidade.logoUrl, { x: 20, y: 20, width: 120, height: 120 });
    }
  }

  destruir() {
    if (this.store) {
      this.store.clear();
      this.store = null;
    }
    this.container = null;
    this.isReady = false;
  }
}
