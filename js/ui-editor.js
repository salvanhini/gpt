import { EditorService } from "./editor-service.js";
import { salvarProjetoEditor, listarProjetosEditor, buscarProjetoEditor, deletarProjetoEditor } from "./editorStorage.js";
import { salvarPost } from "./editorStorage.js";

export class EditorUI {
  constructor() {
    this.editor = new EditorService();
    this.onClose = null;
    this.onSendToChat = null;
    this.currentOptions = null;
    this.exportModalOpen = false;
    this.templatesList = [];
  }

  abrirEditor(imageUrl, opcoes = {}) {
    this.currentOptions = opcoes;
    const existing = document.querySelector(".editor-modal");
    if (existing) existing.remove();

    const largura = opcoes.largura || this._getSizeForFormato(opcoes.formato).width;
    const altura = opcoes.altura || this._getSizeForFormato(opcoes.formato).height;

    const modal = document.createElement("div");
    modal.className = "editor-modal";
    modal.innerHTML = this._renderHTML(largura, altura);
    document.body.appendChild(modal);

    const canvasEl = modal.querySelector("#editor-canvas");
    const containerEl = modal.querySelector(".editor-canvas-wrap");

    this.editor.inicializar(canvasEl, containerEl);
    this.editor.canvas.setWidth(largura);
    this.editor.canvas.setHeight(altura);

    if (imageUrl) {
      this.editor.carregarImagemFundo(imageUrl).catch(() => {});
    }

    if (opcoes.textosPadrao) {
      opcoes.textosPadrao.forEach((t) => {
        this.editor.adicionarTexto(t.texto, t.opcoes || {});
      });
    }

    if (opcoes.logoUrl) {
      this.editor.adicionarImagem(opcoes.logoUrl, { left: 20, top: 20 });
    }

    this.editor.onSelectionChange = () => this._atualizarInterface();
    this.editor.onObjectModified = () => this._atualizarInterface();

    this._bindEvents(modal);
    this._atualizarInterface();
  }

  _getSizeForFormato(formato) {
    const map = {
      quadrado: { width: 1080, height: 1080 },
      retrato: { width: 1080, height: 1350 },
      story: { width: 1080, height: 1920 },
      reel: { width: 1080, height: 1920 },
      banner: { width: 1200, height: 628 },
      carrossel: { width: 1080, height: 1080 },
    };
    return map[formato] || { width: 1080, height: 1080 };
  }

  _renderHTML(largura, altura) {
    return `
      <div class="editor-topbar">
        <div class="editor-topbar-title">Editor de Imagens</div>
        <div class="editor-topbar-actions">
          <button class="editor-btn editor-btn-sm" data-action="editor-undo" title="Desfazer (Ctrl+Z)">↩ Desfazer</button>
          <button class="editor-btn editor-btn-sm" data-action="editor-redo" title="Refazer (Ctrl+Shift+Z)">↪ Refazer</button>
          <button class="editor-btn editor-btn-sm" data-action="editor-save-project" title="Salvar projeto">💾 Salvar</button>
          <button class="editor-btn editor-btn-sm" data-action="editor-load-project" title="Carregar projeto">📂 Abrir</button>
          <button class="editor-btn editor-btn-sm editor-btn-primary" data-action="editor-export" title="Exportar imagem">📥 Exportar</button>
          <button class="editor-btn editor-btn-sm editor-btn-danger" data-action="editor-close" title="Fechar (Esc)">✕</button>
        </div>
      </div>
      <div class="editor-workarea">
        <div class="editor-canvas-wrap">
          <canvas id="editor-canvas"></canvas>
        </div>
        <div class="editor-panel" id="editor-panel">
          <div class="editor-panel-header">Propriedades</div>
          <div id="editor-properties">${this._renderNoSelection()}</div>
        </div>
      </div>
      <div class="editor-toolbar" id="editor-toolbar">
        <div class="editor-toolbar-group">
          <button class="editor-btn editor-btn-icon-sm" data-action="editor-add-text" title="Adicionar texto">T</button>
        </div>
        <div class="editor-toolbar-group">
          <button class="editor-btn editor-btn-icon-sm" data-action="editor-add-rect" title="Retângulo">▬</button>
          <button class="editor-btn editor-btn-icon-sm" data-action="editor-add-circle" title="Círculo">●</button>
          <button class="editor-btn editor-btn-icon-sm" data-action="editor-add-triangle" title="Triângulo">▲</button>
          <button class="editor-btn editor-btn-icon-sm" data-action="editor-add-line" title="Linha">╱</button>
        </div>
        <div class="editor-toolbar-group">
          <button class="editor-btn editor-btn-icon-sm" data-action="editor-add-image" title="Adicionar imagem">🖼</button>
          <input type="file" accept="image/*" id="editor-image-upload" style="display:none">
        </div>
        <div class="editor-toolbar-group">
          <button class="editor-btn editor-btn-icon-sm" data-action="editor-filter-grayscale" title="Escala de cinza">◐</button>
          <button class="editor-btn editor-btn-icon-sm" data-action="editor-filter-sepia" title="Sépia">☕</button>
          <button class="editor-btn editor-btn-icon-sm" data-action="editor-filter-blur" title="Desfoque">🌫</button>
          <button class="editor-btn editor-btn-icon-sm" data-action="editor-remove-filters" title="Remover filtros">✖</button>
        </div>
        <div class="editor-toolbar-group">
          <button class="editor-btn editor-btn-icon-sm" data-action="editor-duplicate" title="Duplicar (Ctrl+D)">⧉</button>
          <button class="editor-btn editor-btn-icon-sm" data-action="editor-delete" title="Excluir (Delete)">🗑</button>
        </div>
        <div class="editor-toolbar-group">
          <button class="editor-btn editor-btn-icon-sm" data-action="editor-bring-forward" title="Trazer para frente">⬆</button>
          <button class="editor-btn editor-btn-icon-sm" data-action="editor-send-backward" title="Enviar para trás">⬇</button>
        </div>
        <div class="editor-toolbar-group">
          <button class="editor-btn editor-btn-icon-sm" data-action="editor-clear" title="Limpar canvas">🗘</button>
        </div>
      </div>
    `;
  }

  _renderNoSelection() {
    return `<div class="editor-no-selection"><span>🖌</span>Selecione um objeto para editar suas propriedades</div>`;
  }

  _renderProperties(obj) {
    if (!obj) return this._renderNoSelection();
    const isText = obj.type === "i-text" || obj.type === "textbox";
    const isImage = obj.type === "image";
    const isShape = obj.type === "rect" || obj.type === "circle" || obj.type === "triangle" || obj.type === "line";

    return `
      <div class="editor-panel-section">
        <span class="editor-panel-label">Tipo</span>
        <div style="font-size:12px;color:#94a3b8">${this._tipoLabel(obj.type)}</div>
      </div>
      <div class="editor-panel-section">
        <span class="editor-panel-label">Posição</span>
        <div class="editor-inline-group">
          <span style="font-size:10px;color:#64748b">X</span>
          <input class="editor-input editor-input-sm" id="prop-left" value="${Math.round(obj.left || 0)}" data-prop="left">
          <span style="font-size:10px;color:#64748b">Y</span>
          <input class="editor-input editor-input-sm" id="prop-top" value="${Math.round(obj.top || 0)}" data-prop="top">
        </div>
      </div>
      <div class="editor-panel-section">
        <span class="editor-panel-label">Tamanho</span>
        <div class="editor-inline-group">
          <span style="font-size:10px;color:#64748b">L</span>
          <input class="editor-input editor-input-sm" id="prop-width" value="${Math.round(obj.width * (obj.scaleX || 1))}" data-prop="width">
          <span style="font-size:10px;color:#64748b">A</span>
          <input class="editor-input editor-input-sm" id="prop-height" value="${Math.round(obj.height * (obj.scaleY || 1))}" data-prop="height">
        </div>
      </div>
      <div class="editor-panel-section">
        <span class="editor-panel-label">Rotação: ${Math.round(obj.angle || 0)}°</span>
        <input class="editor-slider" id="prop-angle" type="range" min="0" max="360" value="${Math.round(obj.angle || 0)}">
      </div>
      <div class="editor-panel-section">
        <span class="editor-panel-label">Opacidade: ${Math.round((obj.opacity ?? 1) * 100)}%</span>
        <input class="editor-slider" id="prop-opacity" type="range" min="0" max="1" step="0.05" value="${obj.opacity ?? 1}">
      </div>
      ${!isImage ? `
      <div class="editor-panel-section">
        <span class="editor-panel-label">Preenchimento</span>
        <input class="editor-color-picker" id="prop-fill" type="color" value="${obj.fill || "#000000"}">
      </div>
      ` : ""}
      ${isText ? `
      <div class="editor-panel-section">
        <span class="editor-panel-label">Fonte</span>
        <select class="editor-select" id="prop-font-family">
          ${["Arial","Helvetica","Times New Roman","Georgia","Courier New","Verdana","Trebuchet MS","Impact","Comic Sans MS"].map((f) =>
            `<option value="${f}" ${obj.fontFamily === f ? "selected" : ""}>${f}</option>`
          ).join("")}
        </select>
      </div>
      <div class="editor-panel-section">
        <span class="editor-panel-label">Tamanho da fonte</span>
        <input class="editor-input" id="prop-font-size" type="number" value="${obj.fontSize || 36}" min="8" max="500" style="width:80px">
      </div>
      <div class="editor-panel-section">
        <span class="editor-panel-label">Alinhamento</span>
        <select class="editor-select" id="prop-text-align">
          ${["left","center","right"].map((a) => `<option value="${a}" ${obj.textAlign === a ? "selected" : ""}>${a}</option>`).join("")}
        </select>
      </div>
      <div class="editor-panel-section">
        <label style="display:flex;align-items:center;gap:8px;font-size:12px;color:#94a3b8">
          <input type="checkbox" id="prop-bold" ${obj.fontWeight === "bold" ? "checked" : ""}> Negrito
        </label>
        <label style="display:flex;align-items:center;gap:8px;font-size:12px;color:#94a3b8;margin-top:4px">
          <input type="checkbox" id="prop-italic" ${obj.fontStyle === "italic" ? "checked" : ""}> Itálico
        </label>
        <label style="display:flex;align-items:center;gap:8px;font-size:12px;color:#94a3b8;margin-top:4px">
          <input type="checkbox" id="prop-underline" ${obj.underline ? "checked" : ""}> Sublinhado
        </label>
      </div>
      ` : ""}
      ${isShape && obj.type === "rect" ? `
      <div class="editor-panel-section">
        <span class="editor-panel-label">Bordas arredondadas</span>
        <div class="editor-inline-group">
          <span style="font-size:10px;color:#64748b">RX</span>
          <input class="editor-input editor-input-sm" id="prop-rx" value="${obj.rx || 0}">
          <span style="font-size:10px;color:#64748b">RY</span>
          <input class="editor-input editor-input-sm" id="prop-ry" value="${obj.ry || 0}">
        </div>
      </div>
      ` : ""}
    `;
  }

  _tipoLabel(type) {
    const labels = { "i-text": "Texto", "textbox": "Texto", "rect": "Retângulo", "circle": "Círculo", "triangle": "Triângulo", "line": "Linha", "image": "Imagem" };
    return labels[type] || type;
  }

  _atualizarInterface() {
    const obj = this.editor.getObjetoSelecionado();
    const propsEl = document.getElementById("editor-properties");
    if (propsEl) propsEl.innerHTML = obj ? this._renderProperties(obj) : this._renderNoSelection();
    this._bindPropertyEvents();
  }

  _bindPropertyEvents() {
    const props = ["left", "top", "width", "height", "font-size", "rx", "ry"];
    props.forEach((p) => {
      const el = document.getElementById(`prop-${p}`);
      if (el) el.addEventListener("change", () => this._applyPropFromInput(p));
    });
    ["angle", "opacity"].forEach((p) => {
      const el = document.getElementById(`prop-${p}`);
      if (el) el.addEventListener("input", () => this._applyPropFromInput(p));
    });
    ["fill", "font-family", "text-align"].forEach((p) => {
      const el = document.getElementById(`prop-${p.replace("-", "-")}`);
      if (el) el.addEventListener("change", () => this._applyPropFromInput(p));
    });
    ["bold", "italic", "underline"].forEach((p) => {
      const el = document.getElementById(`prop-${p}`);
      if (el) el.addEventListener("change", () => this._applyPropFromInput(p));
    });
  }

  _applyPropFromInput(name) {
    const el = document.getElementById(`prop-${name}`);
    if (!el) return;
    const obj = this.editor.getObjetoSelecionado();
    if (!obj) return;
    const props = {};
    switch (name) {
      case "left": case "top": props[name] = Number(el.value) || 0; break;
      case "width":
        props.scaleX = (Number(el.value) || obj.width) / obj.width;
        if (obj.name === "__fundo__") return;
        break;
      case "height":
        props.scaleY = (Number(el.value) || obj.height) / obj.height;
        if (obj.name === "__fundo__") return;
        break;
      case "rx": case "ry": props[name] = Number(el.value) || 0; break;
      case "angle": props.angle = Number(el.value) || 0; break;
      case "opacity": props.opacity = Number(el.value) || 0; break;
      case "fill": props.fill = el.value; break;
      case "font-family": props.fontFamily = el.value; break;
      case "text-align": props.textAlign = el.value; break;
      case "bold": props.fontWeight = el.checked ? "bold" : "normal"; break;
      case "italic": props.fontStyle = el.checked ? "italic" : "normal"; break;
      case "underline": props.underline = el.checked; break;
      case "font-size": props.fontSize = Number(el.value) || 16; break;
    }
    this.editor.atualizarPropriedades(props);
  }

  _bindEvents(modal) {
    modal.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-action]");
      if (!btn) return;
      this._handleAction(btn.dataset.action);
    });

    const imageUpload = modal.querySelector("#editor-image-upload");
    const addImageBtn = modal.querySelector('[data-action="editor-add-image"]');
    if (addImageBtn) {
      addImageBtn.addEventListener("click", () => imageUpload.click());
    }
    if (imageUpload) {
      imageUpload.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const url = URL.createObjectURL(file);
        this.editor.adicionarImagem(url);
        imageUpload.value = "";
      });
    }
  }

  _handleAction(action) {
    switch (action) {
      case "editor-close": this.fecharEditor(); break;
      case "editor-undo": this.editor.undo(); this._atualizarInterface(); break;
      case "editor-redo": this.editor.redo(); this._atualizarInterface(); break;
      case "editor-add-text":
        this.editor.adicionarTexto("Texto", { fontSize: 48, fill: "#000000", left: 200, top: 200 });
        break;
      case "editor-add-rect":
        this.editor.adicionarForma("retangulo", { fill: "#0ea5e9", width: 150, height: 100 });
        break;
      case "editor-add-circle":
        this.editor.adicionarForma("circulo", { fill: "#0ea5e9", radius: 60 });
        break;
      case "editor-add-triangle":
        this.editor.adicionarForma("triangulo", { fill: "#0ea5e9", width: 120, height: 120 });
        break;
      case "editor-add-line":
        this.editor.adicionarForma("linha", { fill: "#0ea5e9", strokeWidth: 4 });
        break;
      case "editor-filter-grayscale": this.editor.aplicarFiltro("grayscale"); break;
      case "editor-filter-sepia": this.editor.aplicarFiltro("sepia"); break;
      case "editor-filter-blur": this.editor.aplicarFiltro("blur", { value: 0.5 }); break;
      case "editor-remove-filters": this.editor.removerFiltro(); break;
      case "editor-duplicate": this.editor.duplicarObjeto(); break;
      case "editor-delete": this.editor.excluirObjeto(); this._atualizarInterface(); break;
      case "editor-bring-forward": this.editor.trazerParaFrente(); break;
      case "editor-send-backward": this.editor.enviarParaTras(); break;
      case "editor-clear":
        if (confirm("Limpar canvas?")) { this.editor.limparCanvas(true); this._atualizarInterface(); }
        break;
      case "editor-export": this._abrirExportacao(); break;
      case "editor-save-project": this._salvarProjeto(); break;
      case "editor-load-project": this._carregarProjeto(); break;
    }
  }

  _abrirExportacao() {
    if (this.exportModalOpen) return;
    this.exportModalOpen = true;

    const modal = document.createElement("div");
    modal.className = "editor-export-modal";
    modal.innerHTML = `
      <div class="editor-export-panel">
        <h3 style="font-size:16px;font-weight:600;margin-bottom:16px">Exportar Imagem</h3>
        <img class="editor-export-preview" id="export-preview" src="${this.editor.exportarImagem("png", 1, 1)}" alt="Preview">
        <div class="editor-panel-section" style="padding:0;border:none">
          <span class="editor-panel-label">Formato</span>
          <select class="editor-select" id="export-format">
            <option value="png">PNG</option>
            <option value="jpeg">JPEG</option>
          </select>
        </div>
        <div class="editor-panel-section" style="padding:8px 0;border:none">
          <span class="editor-panel-label">Qualidade: <span id="export-quality-label">100%</span></span>
          <input class="editor-slider" id="export-quality" type="range" min="0.1" max="1" step="0.1" value="1">
        </div>
        <div class="editor-panel-section" style="padding:8px 0;border:none">
          <span class="editor-panel-label">Escala</span>
          <select class="editor-select" id="export-scale">
            <option value="1">1x (${this.editor.canvas.getWidth()}×${this.editor.canvas.getHeight()})</option>
            <option value="2">2x (${this.editor.canvas.getWidth() * 2}×${this.editor.canvas.getHeight() * 2})</option>
            <option value="3">3x (${this.editor.canvas.getWidth() * 3}×${this.editor.canvas.getHeight() * 3})</option>
            <option value="4">4x (${this.editor.canvas.getWidth() * 4}×${this.editor.canvas.getHeight() * 4})</option>
          </select>
        </div>
        <div class="editor-export-actions">
          <button class="editor-btn editor-btn-primary editor-btn-full" data-action="export-download">Baixar</button>
          <button class="editor-btn editor-btn-full" data-action="export-send-chat">Enviar para o Chat</button>
          <button class="editor-btn editor-btn-full" data-action="export-close">Cancelar</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const updatePreview = () => {
      const format = document.getElementById("export-format").value;
      const quality = Number(document.getElementById("export-quality").value);
      const scale = Number(document.getElementById("export-scale").value);
      document.getElementById("export-quality-label").textContent = Math.round(quality * 100) + "%";
      const preview = document.getElementById("export-preview");
      preview.src = this.editor.exportarImagem(format, quality, scale);
    };

    modal.querySelector("#export-format").addEventListener("change", updatePreview);
    modal.querySelector("#export-quality").addEventListener("input", updatePreview);
    modal.querySelector("#export-scale").addEventListener("change", updatePreview);

    modal.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-action]");
      if (!btn) { if (e.target === modal) this._fecharExportacao(modal); return; }
      switch (btn.dataset.action) {
        case "export-download": this._baixarImagem(); break;
        case "export-send-chat": this._enviarParaChat(modal); break;
        case "export-close": this._fecharExportacao(modal); break;
      }
    });
  }

  _fecharExportacao(modal) {
    this.exportModalOpen = false;
    if (modal && modal.parentNode) modal.remove();
  }

  _baixarImagem() {
    const format = document.getElementById("export-format").value;
    const quality = Number(document.getElementById("export-quality").value);
    const scale = Number(document.getElementById("export-scale").value);
    const dataUrl = this.editor.exportarImagem(format, quality, scale);
    const link = document.createElement("a");
    link.download = `imagem-${Date.now()}.${format}`;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  _enviarParaChat(modal) {
    const format = document.getElementById("export-format").value;
    const quality = Number(document.getElementById("export-quality").value);
    const scale = Number(document.getElementById("export-scale").value);
    const dataUrl = this.editor.exportarImagem(format, quality, scale);
    if (this.onSendToChat) this.onSendToChat(dataUrl, format);

    const canvasData = this.editor.salvarProjeto("Post do Editor");
    salvarPost({
      nome: "Post do Editor",
      tipo: this.currentOptions?.formato || "quadrado",
      dataURL: dataUrl,
      thumbnail: canvasData.thumbnail,
      largura: this.editor.canvas.getWidth(),
      altura: this.editor.canvas.getHeight(),
      formato: format,
    }).catch(() => {});

    this._fecharExportacao(modal);
  }

  _salvarProjeto() {
    const nome = prompt("Nome do projeto:", "Meu Design");
    if (!nome) return;
    const projetoData = this.editor.salvarProjeto(nome);
    salvarProjetoEditor(projetoData)
      .then(() => alert("Projeto salvo com sucesso!"))
      .catch(() => alert("Erro ao salvar projeto."));
  }

  _carregarProjeto() {
    listarProjetosEditor().then((projetos) => {
      if (!projetos.length) { alert("Nenhum projeto salvo."); return; }
      const nomes = projetos.map((p, i) => `${i + 1}. ${p.nome} (${new Date(p.atualizadoEm).toLocaleString("pt-BR")})`).join("\n");
      const idx = prompt(`Projetos salvos:\n${nomes}\n\nDigite o numero do projeto para carregar:`);
      if (!idx) return;
      const index = parseInt(idx, 10) - 1;
      if (isNaN(index) || index < 0 || index >= projetos.length) { alert("Numero invalido."); return; }
      const projeto = projetos[index];
      buscarProjetoEditor(projeto.id).then((p) => {
        if (!p) { alert("Projeto nao encontrado."); return; }
        this.editor.carregarProjeto(p.canvasData);
        this._atualizarInterface();
      });
    });
  }

  fecharEditor() {
    this.editor.destruir();
    const modal = document.querySelector(".editor-modal");
    if (modal) modal.remove();
    const exportModal = document.querySelector(".editor-export-modal");
    if (exportModal) exportModal.remove();
    this.exportModalOpen = false;
    if (this.onClose) this.onClose();
  }
}
