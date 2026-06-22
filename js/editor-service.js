export class EditorService {
  constructor() {
    this.canvas = null;
    this.container = null;
    this.undoStack = [];
    this.redoStack = [];
    this.maxHistory = 50;
    this.isRestoring = false;
    this.imageFundo = null;
    this.onSelectionChange = null;
    this.onObjectModified = null;
  }

  inicializar(canvasEl, containerEl) {
    this.container = containerEl;
    this.canvas = new fabric.Canvas(canvasEl, {
      preserveObjectStacking: true,
      backgroundColor: "#ffffff",
      selection: true,
      defaultCursor: "default",
      width: 1080,
      height: 1080,
    });

    this.canvas.on("selection:created", () => this._handleSelectionChange());
    this.canvas.on("selection:updated", () => this._handleSelectionChange());
    this.canvas.on("selection:cleared", () => this._handleSelectionChange());
    this.canvas.on("object:modified", () => this._handleObjectModified());

    this.canvas.on("mouse:down", (opt) => {
      if (opt.e.target === null) {
        this.canvas.discardActiveObject();
        this.canvas.renderAll();
        this._handleSelectionChange();
      }
    });

    this.salvarEstado();
    return this;
  }

  _handleSelectionChange() {
    if (this.onSelectionChange) this.onSelectionChange(this.getObjetoSelecionado());
  }

  _handleObjectModified() {
    this.salvarEstado();
    if (this.onObjectModified) this.onObjectModified(this.getObjetoSelecionado());
  }

  carregarImagemFundo(imageUrl) {
    return new Promise((resolve, reject) => {
      fabric.Image.fromURL(imageUrl, (img) => {
        if (!img) {
          reject(new Error("Falha ao carregar imagem."));
          return;
        }
        this.imageFundo = img;
        const cw = this.canvas.getWidth();
        const ch = this.canvas.getHeight();
        const scale = Math.min(cw / img.width, ch / img.height, 1);
        img.set({
          left: cw / 2,
          top: ch / 2,
          originX: "center",
          originY: "center",
          scaleX: scale,
          scaleY: scale,
          selectable: false,
          evented: false,
          excludeFromExport: false,
          name: "__fundo__",
        });
        this.canvas.add(img);
        this.canvas.sendToBack(img);
        this.canvas.renderAll();
        this.salvarEstado();
        resolve(img);
      }, { crossOrigin: "anonymous" });
    });
  }

  adicionarTexto(texto, opcoes = {}) {
    const opts = {
      left: opcoes.left || 100,
      top: opcoes.top || 100,
      fontSize: opcoes.fontSize || 36,
      fontFamily: opcoes.fontFamily || "Arial",
      fill: opcoes.fill || "#000000",
      stroke: opcoes.stroke || "",
      strokeWidth: opcoes.strokeWidth || 0,
      opacity: opcoes.opacity ?? 1,
      angle: opcoes.angle || 0,
      shadow: opcoes.shadow ? new fabric.Shadow(opcoes.shadow) : null,
      fontWeight: opcoes.fontWeight || "normal",
      fontStyle: opcoes.fontStyle || "normal",
      textAlign: opcoes.textAlign || "left",
      underline: opcoes.underline || false,
      name: "texto",
      ...opcoes.extra || {},
    };
    const text = new fabric.IText(texto, opts);
    this.canvas.add(text);
    this.canvas.setActiveObject(text);
    this.canvas.renderAll();
    this.salvarEstado();
    return text;
  }

  adicionarForma(tipo, opcoes = {}) {
    const opts = {
      left: opcoes.left || 200,
      top: opcoes.top || 200,
      fill: opcoes.fill || "#0ea5e9",
      stroke: opcoes.stroke || "",
      strokeWidth: opcoes.strokeWidth || 0,
      opacity: opcoes.opacity ?? 1,
      angle: opcoes.angle || 0,
      shadow: opcoes.shadow ? new fabric.Shadow(opcoes.shadow) : null,
      name: "forma",
    };
    let shape;
    switch (tipo) {
      case "retangulo":
        shape = new fabric.Rect({ ...opts, width: opcoes.width || 150, height: opcoes.height || 100, rx: opcoes.rx || 0, ry: opcoes.ry || 0 });
        break;
      case "circulo":
        shape = new fabric.Circle({ ...opts, radius: opcoes.radius || 60 });
        break;
      case "triangulo":
        shape = new fabric.Triangle({ ...opts, width: opcoes.width || 120, height: opcoes.height || 120 });
        break;
      case "linha":
        shape = new fabric.Line([opcoes.x1 || 0, opcoes.y1 || 0, opcoes.x2 || 200, opcoes.y2 || 200], {
          ...opts, fill: undefined, stroke: opcoes.fill || "#0ea5e9", strokeWidth: opcoes.strokeWidth || 3,
        });
        break;
      default:
        throw new Error("Tipo de forma invalido: " + tipo);
    }
    this.canvas.add(shape);
    this.canvas.setActiveObject(shape);
    this.canvas.renderAll();
    this.salvarEstado();
    return shape;
  }

  adicionarImagem(imageUrl, opcoes = {}) {
    return new Promise((resolve, reject) => {
      fabric.Image.fromURL(imageUrl, (img) => {
        if (!img) {
          reject(new Error("Falha ao carregar imagem."));
          return;
        }
        const maxDim = 400;
        const scale = Math.min(maxDim / img.width, maxDim / img.height, 1);
        img.set({
          left: opcoes.left || 100,
          top: opcoes.top || 100,
          scaleX: (opcoes.scaleX || 1) * scale,
          scaleY: (opcoes.scaleY || 1) * scale,
          opacity: opcoes.opacity ?? 1,
          angle: opcoes.angle || 0,
          name: "imagem",
          crossOrigin: "anonymous",
        });
        this.canvas.add(img);
        this.canvas.setActiveObject(img);
        this.canvas.renderAll();
        this.salvarEstado();
        resolve(img);
      }, { crossOrigin: "anonymous" });
    });
  }

  aplicarFiltro(tipoFiltro, parametros = {}) {
    const obj = this.canvas.getActiveObject();
    if (!obj || !obj.filters) return;
    const filterMap = {
      brightness: new fabric.Image.filters.Brightness({ brightness: parametros.value ?? 0.2 }),
      contrast: new fabric.Image.filters.Contrast({ contrast: parametros.value ?? 0.3 }),
      saturate: new fabric.Image.filters.Saturation({ saturation: parametros.value ?? 0.5 }),
      grayscale: new fabric.Image.filters.Grayscale(),
      sepia: new fabric.Image.filters.Sepia(),
      blur: new fabric.Image.filters.Blur({ blur: parametros.value ?? 0.5 }),
      sharpen: new fabric.Image.filters.Convolute({
        matrix: [0, -1, 0, -1, 5, -1, 0, -1, 0],
      }),
      invert: new fabric.Image.filters.Invert(),
    };
    const filter = filterMap[tipoFiltro];
    if (!filter) return;
    obj.filters.push(filter);
    obj.applyFilters();
    this.canvas.renderAll();
    this.salvarEstado();
  }

  removerFiltro() {
    const obj = this.canvas.getActiveObject();
    if (!obj || !obj.filters) return;
    obj.filters = [];
    obj.applyFilters();
    this.canvas.renderAll();
    this.salvarEstado();
  }

  excluirObjeto() {
    const obj = this.canvas.getActiveObject();
    if (!obj) return;
    if (obj.name === "__fundo__") return;
    this.canvas.remove(obj);
    this.canvas.discardActiveObject();
    this.canvas.renderAll();
    this._handleSelectionChange();
    this.salvarEstado();
  }

  duplicarObjeto() {
    const obj = this.canvas.getActiveObject();
    if (!obj || obj.name === "__fundo__") return;
    obj.clone((cloned) => {
      cloned.set({ left: (cloned.left || 0) + 20, top: (cloned.top || 0) + 20 });
      this.canvas.add(cloned);
      this.canvas.setActiveObject(cloned);
      this.canvas.renderAll();
      this.salvarEstado();
    });
  }

  trazerParaFrente() {
    const obj = this.canvas.getActiveObject();
    if (!obj) return;
    this.canvas.bringForward(obj);
    this.canvas.renderAll();
    this.salvarEstado();
  }

  enviarParaTras() {
    const obj = this.canvas.getActiveObject();
    if (!obj) return;
    this.canvas.sendBackwards(obj);
    this.canvas.renderAll();
    this.salvarEstado();
  }

  salvarEstado() {
    if (this.isRestoring) return;
    const json = this.canvas.toJSON(["name", "crossOrigin"]);
    if (this.undoStack.length >= this.maxHistory) {
      this.undoStack.shift();
    }
    this.undoStack.push(JSON.stringify(json));
    this.redoStack = [];
  }

  undo() {
    if (this.undoStack.length <= 1) return;
    const current = this.undoStack.pop();
    this.redoStack.push(current);
    this._restoreFromJSON(this.undoStack[this.undoStack.length - 1]);
  }

  redo() {
    if (this.redoStack.length === 0) return;
    const state = this.redoStack.pop();
    this.undoStack.push(state);
    this._restoreFromJSON(state);
  }

  _restoreFromJSON(jsonStr) {
    this.isRestoring = true;
    this.canvas.loadFromJSON(JSON.parse(jsonStr), () => {
      this.canvas.renderAll();
      this.isRestoring = false;
      this._handleSelectionChange();
    });
  }

  exportarImagem(formato = "png", qualidade = 1, escala = 1) {
    const format = formato === "jpeg" ? "jpeg" : "png";
    const dataUrl = this.canvas.toDataURL({
      format: format,
      quality: qualidade,
      multiplier: escala,
    });
    return dataUrl;
  }

  salvarProjeto(nome) {
    const canvasData = this.canvas.toJSON(["name", "crossOrigin"]);
    return {
      nome: nome || "Projeto sem nome",
      canvasData: JSON.stringify(canvasData),
      largura: this.canvas.getWidth(),
      altura: this.canvas.getHeight(),
      thumbnail: this.canvas.toDataURL({ format: "png", multiplier: 0.2 }),
    };
  }

  carregarProjeto(projetoData) {
    return new Promise((resolve, reject) => {
      this.isRestoring = true;
      const json = typeof projetoData === "string" ? JSON.parse(projetoData) : projetoData;
      this.canvas.loadFromJSON(json, () => {
        this.canvas.renderAll();
        this.isRestoring = false;
        this.undoStack = [];
        this.redoStack = [];
        this.salvarEstado();
        this._handleSelectionChange();
        resolve();
      });
    });
  }

  limparCanvas(mantemFundo = true) {
    if (mantemFundo && this.imageFundo) {
      const objetos = this.canvas.getObjects().filter((o) => o !== this.imageFundo);
      objetos.forEach((o) => this.canvas.remove(o));
    } else {
      this.canvas.clear();
      this.canvas.backgroundColor = "#ffffff";
      this.imageFundo = null;
    }
    this.canvas.discardActiveObject();
    this.canvas.renderAll();
    this.undoStack = [];
    this.redoStack = [];
    this.salvarEstado();
    this._handleSelectionChange();
  }

  redimensionarCanvas(largura, altura) {
    const objetos = this.canvas.getObjects();
    const scaleX = largura / this.canvas.getWidth();
    const scaleY = altura / this.canvas.getHeight();
    objetos.forEach((obj) => {
      obj.set({
        left: (obj.left || 0) * scaleX,
        top: (obj.top || 0) * scaleY,
        scaleX: (obj.scaleX || 1) * scaleX,
        scaleY: (obj.scaleY || 1) * scaleY,
      });
    });
    this.canvas.setWidth(largura);
    this.canvas.setHeight(altura);
    this.canvas.renderAll();
    this.salvarEstado();
  }

  getObjetoSelecionado() {
    return this.canvas.getActiveObject() || null;
  }

  atualizarPropriedades(propriedades) {
    const obj = this.canvas.getActiveObject();
    if (!obj) return;
    const safe = {};
    const allowed = ["left", "top", "width", "height", "radius", "scaleX", "scaleY", "angle",
      "opacity", "fill", "stroke", "strokeWidth", "fontSize", "fontFamily", "fontWeight",
      "fontStyle", "textAlign", "underline", "shadow", "rx", "ry", "originX", "originY"];
    for (const key of allowed) {
      if (propriedades[key] !== undefined) safe[key] = propriedades[key];
    }
    if (safe.shadow) {
      safe.shadow = new fabric.Shadow(safe.shadow);
    }
    obj.set(safe);
    obj.setCoords();
    this.canvas.renderAll();
    this.salvarEstado();
  }

  destruir() {
    if (this.canvas) {
      this.canvas.dispose();
      this.canvas = null;
    }
    this.container = null;
    this.undoStack = [];
    this.redoStack = [];
    this.imageFundo = null;
    this.onSelectionChange = null;
    this.onObjectModified = null;
  }
}
