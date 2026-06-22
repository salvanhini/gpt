import { EditorService } from "./editor-service.js";
import { salvarProjetoEditor, listarProjetosEditor, buscarProjetoEditor, deletarProjetoEditor, salvarTemplate, listarTemplates, carregarTemplate } from "./editorStorage.js";
import { salvarPost } from "./editorStorage.js";

const FORMAT_MAP = {
  quadrado: { w: 1080, h: 1080, label: "Post Quadrado" },
  retrato: { w: 1080, h: 1350, label: "Post Retrato" },
  story: { w: 1080, h: 1920, label: "Story" },
  reel: { w: 1080, h: 1920, label: "Reel Cover" },
  carrossel: { w: 1080, h: 1350, label: "Carrossel" },
  banner: { w: 1200, h: 628, label: "Banner" },
};

export class EditorUI {
  constructor() {
    this.editor = new EditorService();
    this.onClose = null;
    this.onSendToChat = null;
    this.currentOptions = null;
    this.editorReady = false;
    this.containerId = "polotno-container";
  }

  async abrirEditor(imageUrl, opcoes = {}) {
    this.currentOptions = opcoes;
    this._removerModal();
    const formato = opcoes.formato || "quadrado";

    const modal = document.createElement("div");
    modal.className = "editor-modal";
    modal.innerHTML = this._renderHTML(formato);
    document.body.appendChild(modal);

    const containerEl = document.getElementById(this.containerId);
    if (!containerEl) {
      this._removerModal();
      return;
    }

    this.editorReady = true;

    await this.editor.inicializar(this.containerId, formato);

    if (opcoes.templateId) {
      try {
        const template = await carregarTemplate(opcoes.templateId);
        if (template?.storeData) {
          await this.editor.adicionarTemplate(template.storeData);
        }
      } catch (e) {
        console.warn("Erro ao carregar template:", e);
      }
    }

    if (imageUrl && !opcoes.templateId) {
      await this.editor.carregarImagemFundo(imageUrl);
    }

    if (opcoes.textosPadrao) {
      for (const t of opcoes.textosPadrao) {
        this.editor.adicionarTexto(t.texto, t.opcoes || {});
      }
    }

    if (opcoes.logoUrl) {
      await this.editor.adicionarImagem(opcoes.logoUrl, { x: 20, y: 20, width: 120, height: 120 });
    }

    if (opcoes.identidadeVisual) {
      await this.editor.aplicarIdentidadeVisual(opcoes.identidadeVisual);
    }

    this._bindEvents();
  }

  _removerModal() {
    const existing = document.querySelector(".editor-modal");
    if (existing) existing.remove();
    this.editorReady = false;
  }

  fecharEditor() {
    this.editor.destruir();
    const exportModal = document.querySelector(".editor-export-modal");
    if (exportModal) exportModal.remove();
    this._removerModal();
    if (this.onClose) this.onClose();
  }

  _renderHTML(formato) {
    const f = FORMAT_MAP[formato] || FORMAT_MAP.quadrado;
    return `
      <div class="editor-topbar">
        <div class="editor-topbar-left">
          <span class="editor-topbar-title">Editor de Imagens</span>
          <span class="editor-topbar-subtitle">${f.label} — ${f.w}×${f.h}</span>
        </div>
        <div class="editor-topbar-right">
          <button class="editor-btn editor-btn-sm" data-action="editor-save-project" title="Salvar projeto">💾 Salvar</button>
          <button class="editor-btn editor-btn-sm" data-action="editor-load-project" title="Carregar projeto">📂 Abrir</button>
          <button class="editor-btn editor-btn-sm" data-action="editor-show-templates" title="Templates">📋 Templates</button>
          <button class="editor-btn editor-btn-sm editor-btn-format" data-action="editor-magic-resize" title="Redimensionar">🔄 Redimensionar</button>
          <button class="editor-btn editor-btn-sm editor-btn-primary" data-action="editor-export" title="Exportar">📥 Exportar</button>
          <button class="editor-btn editor-btn-sm editor-btn-danger" data-action="editor-close" title="Fechar (Esc)">✕</button>
        </div>
      </div>
      <div class="editor-workarea">
        <div id="${this.containerId}" class="polotno-wrap"></div>
      </div>
    `;
  }

  _renderExportModal() {
    return `
      <div class="editor-export-modal">
        <div class="editor-export-panel">
          <h3 class="editor-export-title">Exportar Imagem</h3>
          <img class="editor-export-preview" id="export-preview" src="" alt="Preview">
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
              <option value="1">1x (${this._getExportSize(1)})</option>
              <option value="2">2x (${this._getExportSize(2)})</option>
              <option value="3">3x (${this._getExportSize(3)})</option>
              <option value="4">4x (${this._getExportSize(4)})</option>
            </select>
          </div>
          ${this._hasMultiPages() ? `
          <div class="editor-panel-section" style="padding:8px 0;border:none">
            <label style="display:flex;align-items:center;gap:8px;font-size:12px;color:#94a3b8">
              <input type="checkbox" id="export-all-pages"> Exportar todas as páginas (${this.editor.store.pages.length})
            </label>
          </div>
          ` : ""}
          <div class="editor-export-actions">
            <button class="editor-btn editor-btn-primary editor-btn-full" data-action="export-download">Baixar</button>
            <button class="editor-btn editor-btn-full" data-action="export-send-chat">Enviar para o Chat</button>
            <button class="editor-btn editor-btn-sm" data-action="export-close">Cancelar</button>
          </div>
        </div>
      </div>
    `;
  }

  _getExportSize(scale) {
    if (!this.editor.store) return `${1080 * scale}×${1080 * scale}`;
    return `${this.editor.store.width * scale}×${this.editor.store.height * scale}`;
  }

  _hasMultiPages() {
    return this.editor.store && this.editor.store.pages.length > 1;
  }

  _bindEvents() {
    const modal = document.querySelector(".editor-modal");
    if (!modal) return;

    modal.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-action]");
      if (!btn) return;
      this._handleAction(btn.dataset.action);
    });

    document.addEventListener("keydown", this._keyHandler = (e) => {
      if (!document.querySelector(".editor-modal")) return;
      if (e.key === "Escape" && !document.querySelector(".editor-export-modal")) {
        this.fecharEditor();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        if (e.shiftKey) this.editor.redo();
        else this.editor.undo();
      }
    });
  }

  _handleAction(action) {
    switch (action) {
      case "editor-close": this.fecharEditor(); break;
      case "editor-export": this._abrirExportacao(); break;
      case "editor-save-project": this._salvarProjeto(); break;
      case "editor-load-project": this._carregarProjeto(); break;
      case "editor-show-templates": this._mostrarPainelTemplates(); break;
      case "editor-magic-resize": this._mostrarRedimensionamentoMagico(); break;
    }
  }

  async _abrirExportacao() {
    const existing = document.querySelector(".editor-export-modal");
    if (existing) existing.remove();

    const div = document.createElement("div");
    div.innerHTML = this._renderExportModal();
    const modal = div.firstElementChild;
    document.body.appendChild(modal);

    const updatePreview = async () => {
      const format = document.getElementById("export-format").value;
      const quality = Number(document.getElementById("export-quality").value);
      const scale = Number(document.getElementById("export-scale").value);
      document.getElementById("export-quality-label").textContent = Math.round(quality * 100) + "%";
      const allPages = document.getElementById("export-all-pages")?.checked;
      try {
        if (allPages && this._hasMultiPages()) {
          const results = await this.editor.exportarTodasPaginas(format);
          const preview = document.getElementById("export-preview");
          preview.src = results[0] || "";
          preview.title = `Página 1 de ${results.length}`;
        } else {
          const dataUrl = await this.editor.exportarImagem(format, quality, scale);
          document.getElementById("export-preview").src = dataUrl;
        }
      } catch (e) {
        console.warn("Export preview error:", e);
      }
    };

    await updatePreview();

    modal.querySelector("#export-format")?.addEventListener("change", updatePreview);
    modal.querySelector("#export-quality")?.addEventListener("input", updatePreview);
    modal.querySelector("#export-scale")?.addEventListener("change", updatePreview);
    modal.querySelector("#export-all-pages")?.addEventListener("change", updatePreview);

    modal.addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-action]");
      if (!btn) {
        if (e.target === modal) modal.remove();
        return;
      }
      switch (btn.dataset.action) {
        case "export-download": await this._baixarImagem(); break;
        case "export-send-chat": await this._enviarParaChat(modal); break;
        case "export-close": modal.remove(); break;
      }
    });
  }

  async _baixarImagem() {
    const format = document.getElementById("export-format")?.value || "png";
    const quality = Number(document.getElementById("export-quality")?.value || 1);
    const scale = Number(document.getElementById("export-scale")?.value || 1);
    const allPages = document.getElementById("export-all-pages")?.checked;

    try {
      if (allPages && this._hasMultiPages()) {
        const results = await this.editor.exportarTodasPaginas(format);
        for (let i = 0; i < results.length; i++) {
          const link = document.createElement("a");
          link.download = `pagina-${i + 1}-${Date.now()}.${format}`;
          link.href = results[i];
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
      } else {
        const dataUrl = await this.editor.exportarImagem(format, quality, scale);
        const link = document.createElement("a");
        link.download = `imagem-${Date.now()}.${format}`;
        link.href = dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (e) {
      console.warn("Download error:", e);
    }
  }

  async _enviarParaChat(modal) {
    const format = document.getElementById("export-format")?.value || "png";
    const quality = Number(document.getElementById("export-quality")?.value || 1);
    const scale = Number(document.getElementById("export-scale")?.value || 1);

    try {
      const dataUrl = await this.editor.exportarImagem(format, quality, scale);
      if (this.onSendToChat) this.onSendToChat(dataUrl, format);

      const projeto = this.editor.salvarProjeto("Post do Editor");
      const thumbUrl = await this.editor.exportarImagem("png", 0.3, 0.2);
      await salvarPost({
        nome: "Post do Editor",
        tipo: this.currentOptions?.formato || "quadrado",
        dataURL: dataUrl,
        thumbnail: thumbUrl,
        largura: this.editor.store?.width || 1080,
        altura: this.editor.store?.height || 1080,
        formato: format,
      }).catch(() => {});
    } catch (e) {
      console.warn("Send to chat error:", e);
    }

    if (modal) modal.remove();
  }

  _salvarProjeto() {
    const nome = prompt("Nome do projeto:", "Meu Design");
    if (!nome) return;
    const projetoData = this.editor.salvarProjeto(nome);
    if (!projetoData) return;
    salvarProjetoEditor(projetoData)
      .then(() => alert("Projeto salvo com sucesso!"))
      .catch(() => alert("Erro ao salvar projeto."));
  }

  async _carregarProjeto() {
    try {
      const projetos = await listarProjetosEditor();
      if (!projetos.length) { alert("Nenhum projeto salvo."); return; }
      const nomes = projetos.map((p, i) =>
        `${i + 1}. ${p.nome} (${new Date(p.atualizadoEm).toLocaleString("pt-BR")})`
      ).join("\n");
      const idx = prompt(`Projetos salvos:\n${nomes}\n\nDigite o numero do projeto para carregar:`);
      if (!idx) return;
      const index = parseInt(idx, 10) - 1;
      if (isNaN(index) || index < 0 || index >= projetos.length) { alert("Numero invalido."); return; }
      const projeto = projetos[index];
      const p = await buscarProjetoEditor(projeto.id);
      if (!p?.storeData) { alert("Projeto nao encontrado ou formato incompativel."); return; }
      await this.editor.carregarProjeto(p.storeData);
    } catch (e) {
      alert("Erro ao carregar projeto.");
      console.warn(e);
    }
  }

  _mostrarPainelTemplates() {
    if (this.editor.store) {
      this.editor.store.openSidePanel("templates");
    }
  }

  _mostrarRedimensionamentoMagico() {
    const modal = document.createElement("div");
    modal.className = "editor-export-modal";
    modal.style.zIndex = "100001";
    const options = Object.entries(FORMAT_MAP).map(([key, val]) =>
      `<option value="${key}">${val.label} (${val.w}×${val.h})</option>`
    ).join("");
    modal.innerHTML = `
      <div class="editor-export-panel" style="width:360px">
        <h3 class="editor-export-title">Redimensionamento Mágico</h3>
        <p style="font-size:12px;color:#94a3b8;margin-bottom:12px">
          Adapta o design atual para um novo formato automaticamente.
        </p>
        <div class="editor-panel-section" style="padding:0;border:none">
          <span class="editor-panel-label">Novo formato</span>
          <select class="editor-select" id="magic-format">${options}</select>
        </div>
        <div class="editor-export-actions" style="margin-top:16px">
          <button class="editor-btn editor-btn-primary editor-btn-full" data-action="magic-apply">Aplicar</button>
          <button class="editor-btn editor-btn-sm" data-action="magic-close">Cancelar</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    modal.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-action]");
      if (!btn) { if (e.target === modal) modal.remove(); return; }
      if (btn.dataset.action === "magic-apply") {
        const formato = document.getElementById("magic-format").value;
        this.editor.redimensionarMagicamente(formato);
        this._atualizarTopbarFormato(formato);
        modal.remove();
      } else if (btn.dataset.action === "magic-close") {
        modal.remove();
      }
    });
  }

  _atualizarTopbarFormato(formato) {
    const f = FORMAT_MAP[formato] || FORMAT_MAP.quadrado;
    const subtitle = document.querySelector(".editor-topbar-subtitle");
    if (subtitle) subtitle.textContent = `${f.label} — ${f.w}×${f.h}`;
  }
}
