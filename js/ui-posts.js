import { listarPostsSalvos, removerPost } from "./posts-service.js";
import { listarProjetosEditor, deletarProjetoEditor } from "./editorStorage.js";

export function renderPostsTab(state) {
  return `
    <div class="posts-view" style="padding:20px;max-width:1200px;margin:0 auto">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:12px">
        <h2 style="font-size:20px;font-weight:700;color:#0f172a">Posts</h2>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="editor-btn" data-action="new-post-ai" style="border-color:#0ea5e9;color:#0ea5e9">✨ Gerar com IA</button>
          <button class="editor-btn editor-btn-primary" data-action="new-post-upload" style="background:#0ea5e9;color:#fff;border-color:#0ea5e9">📁 Upload</button>
          <button class="editor-btn" data-action="new-post-project" style="border-color:#8b5cf6;color:#8b5cf6">📂 Carregar Projeto</button>
        </div>
      </div>

      <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">
        <button class="editor-btn editor-btn-sm ${!state.postsFilter ? "active" : ""}" data-action="posts-filter" data-filter="">Todos</button>
        ${["Post","Story","Reel","Carrossel"].map((t) =>
          `<button class="editor-btn editor-btn-sm ${state.postsFilter === t ? "active" : ""}" data-action="posts-filter" data-filter="${t}">${t}</button>`
        ).join("")}
      </div>

      <div id="posts-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:16px">
        ${state.posts && state.posts.length ? state.posts.map((p) => `
          <div style="border-radius:12px;border:1px solid #e2e8f0;background:#fff;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06)">
            <div style="aspect-ratio:${p.largura && p.altura ? p.largura / p.altura : 1};background:#f8fafc;display:flex;align-items:center;justify-content:center;overflow:hidden">
              <img src="${p.thumbnail || p.dataURL}" alt="${escapeHtml(p.nome)}" style="width:100%;height:100%;object-fit:cover" loading="lazy">
            </div>
            <div style="padding:10px 12px">
              <div style="font-size:13px;font-weight:600;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(p.nome || "Sem nome")}</div>
              <div style="font-size:11px;color:#64748b;margin-top:2px">${p.tipo || "Post"} · ${new Date(p.criadoEm).toLocaleDateString("pt-BR")}</div>
              <div style="display:flex;gap:4px;margin-top:8px">
                <button class="editor-btn editor-btn-sm" style="flex:1" data-action="edit-post" data-post-id="${p.id}">✎ Editar</button>
                <button class="editor-btn editor-btn-sm" data-action="download-post" data-post-id="${p.id}">⬇</button>
                <button class="editor-btn editor-btn-sm editor-btn-danger" data-action="delete-post" data-post-id="${p.id}">🗑</button>
              </div>
            </div>
          </div>
        `).join("") : `
          <div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:#94a3b8">
            <div style="font-size:48px;margin-bottom:12px">📷</div>
            <div style="font-size:16px;font-weight:600;margin-bottom:4px">Nenhum post ainda</div>
            <div style="font-size:13px">Crie seu primeiro post no editor de imagens</div>
          </div>
        `}
      </div>
    </div>
  `;
}

function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
