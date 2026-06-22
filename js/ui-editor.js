import { EditorService } from "./editor-service.js";
import { salvarProjetoEditor, listarProjetosEditor, buscarProjetoEditor, deletarProjetoEditor } from "./editorStorage.js";
import { salvarPost } from "./editorStorage.js";

export class EditorUI {
  constructor() {
    this.editor = new EditorService();
    this.onClose = null;
    this.onSendToChat = null;
    this.currentOptions = null;
    this.containerId = "minipaint-container";
  }

  async abrirEditor(imageUrl, opcoes = {}) {
    this.currentOptions = opcoes;
    this._removerModal();

    const modal = document.createElement("div");
    modal.className = "editor-modal";
    modal.innerHTML = this._renderHTML(opcoes);
    document.body.appendChild(modal);

    const containerEl = document.getElementById(this.containerId);
    if (!containerEl) {
      this._removerModal();
      return;
    }

    this.editor.inicializar(this.containerId);
    await this.editor.carregarImagem(imageUrl);

    this._bindEvents();
  }

  _removerModal() {
    const existing = document.querySelector(".editor-modal");
    if (existing) existing.remove();
  }

  fecharEditor() {
    this.editor.destruir();
    this._removerModal();
    const exportModal = document.querySelector(".editor-export-modal");
    if (exportModal) exportModal.remove();
    if (this.onClose) this.onClose();
  }

  _renderHTML(opcoes) {
    return `
      <div class="editor-topbar">
        <div class="editor-topbar-left">
          <span class="editor-topbar-title">Editor de Imagens</span>
          <span class="editor-topbar-subtitle">miniPaint — Editor profissional</span>
        </div>
        <div class="editor-topbar-right">
          <button class="editor-btn editor-btn-sm editor-btn-primary" data-action="editor-export" title="Exportar imagem">📥 Exportar</button>
          <button class="editor-btn editor-btn-sm editor-btn-danger" data-action="editor-close" title="Fechar (Esc)">✕</button>
        </div>
      </div>
      <div class="editor-workarea">
        <div id="${this.containerId}" class="minipaint-container"></div>
      </div>
    `;
  }

  _renderExportModal(dataUrl) {
    return `
      <div class="editor-export-modal">
        <div class="editor-export-panel">
          <h3 class="editor-export-title">Exportar Imagem</h3>
          <img class="editor-export-preview" id="export-preview" src="${dataUrl}" alt="Preview">
          <div class="editor-export-actions">
            <button class="editor-btn editor-btn-primary editor-btn-full" data-action="export-download">Baixar</button>
            <button class="editor-btn editor-btn-full" data-action="export-send-chat">Enviar para o Chat</button>
            <button class="editor-btn editor-btn-sm" data-action="export-close">Cancelar</button>
          </div>
        </div>
      </div>
    `;
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
    });
  }

  _handleAction(action) {
    switch (action) {
      case "editor-close": this.fecharEditor(); break;
      case "editor-export": this._abrirExportacao(); break;
    }
  }

  async _abrirExportacao() {
    const existing = document.querySelector(".editor-export-modal");
    if (existing) existing.remove();

    const dataUrl = this.editor.originalImageUrl || "";

    const div = document.createElement("div");
    div.innerHTML = this._renderExportModal(dataUrl);
    const modal = div.firstElementChild;
    document.body.appendChild(modal);

    modal.addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-action]");
      if (!btn) {
        if (e.target === modal) modal.remove();
        return;
      }
      switch (btn.dataset.action) {
        case "export-download": this._baixarImagem(); break;
        case "export-send-chat": await this._enviarParaChat(modal); break;
        case "export-close": modal.remove(); break;
      }
    });
  }

  _baixarImagem() {
    if (this.editor.originalImageUrl) {
      const link = document.createElement("a");
      link.download = `imagem-${Date.now()}.png`;
      link.href = this.editor.originalImageUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }

  async _enviarParaChat(modal) {
    const dataUrl = this.editor.originalImageUrl;
    if (dataUrl && this.onSendToChat) {
      this.onSendToChat(dataUrl, "png");

      const thumbUrl = dataUrl;
      await salvarPost({
        nome: "Post do Editor",
        tipo: this.currentOptions?.formato || "quadrado",
        dataURL: dataUrl,
        thumbnail: thumbUrl,
        largura: 1080,
        altura: 1080,
        formato: "png",
      }).catch(() => {});
    }
    if (modal) modal.remove();
  }
}
