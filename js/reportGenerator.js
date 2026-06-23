/* global Chart, html2pdf */

const PALETAS = {
  blue:   { primary: "#0F2B5B", accent: "#2563EB", light: "#EFF6FF", bg: "#FAFBFC", muted: "#64748B" },
  green:  { primary: "#065F46", accent: "#059669", light: "#ECFDF5", bg: "#FAFBFC", muted: "#64748B" },
  purple: { primary: "#5B21B6", accent: "#7C3AED", light: "#F5F3FF", bg: "#FAFBFC", muted: "#64748B" },
  amber:  { primary: "#92400E", accent: "#D97706", light: "#FFFBEB", bg: "#FAFBFC", muted: "#64748B" },
  teal:   { primary: "#0F766E", accent: "#0D9488", light: "#F0FDFA", bg: "#FAFBFC", muted: "#64748B" },
};

const PALETA_LISTA = Object.keys(PALETAS);

function escolherPaleta(tema, corTema) {
  if (corTema && PALETAS[corTema]) return PALETAS[corTema];
  const t = (tema || "").toLowerCase();
  if (/finanç|economi|mercado|corporativ|negócio/i.test(t)) return PALETAS.blue;
  if (/saúd|medicin|fisioterapi|bem-estar/i.test(t)) return PALETAS.green;
  if (/tecnologi|software|digital|ia|startup/i.test(t)) return PALETAS.purple;
  if (/aliment|chocolate|culinári|gastronomi|comida/i.test(t)) return PALETAS.amber;
  if (/sustentabilidad|naturez|meio\s*ambiente/i.test(t)) return PALETAS.teal;
  return PALETAS[PALETA_LISTA[Math.floor(Math.random() * PALETA_LISTA.length)]];
}

function esc(str) {
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}

function mdToHtml(text) {
  if (!text) return "";
  const lines = text.split("\n");
  const out = [];
  let inList = false;
  const closeList = () => { if (inList) { out.push("</ul>"); inList = false; } };
  for (const raw of lines) {
    const line = raw.trim();
    if (/^#{1,3}\s/.test(line)) {
      closeList();
      const level = line.match(/^#+/)[0].length;
      const content = line.replace(/^#+\s*/, "");
      const sizes = { 1: "22px", 2: "17px", 3: "14px" };
      out.push(`<h${level > 3 ? 3 : level} style="font-weight:700;color:#1E293B;margin:28px 0 10px;font-size:${sizes[level] || "14px"};">${esc(content)}</h${level > 3 ? 3 : level}>`);
    } else if (/^[-*]\s/.test(line)) {
      if (!inList) { out.push('<ul style="padding-left:22px;margin:6px 0 10px;list-style:none;">'); inList = true; }
      out.push(`<li style="margin:4px 0;color:#334155;font-size:13px;line-height:1.6;">${esc(line.replace(/^[-*]\s*/, ""))}</li>`);
    } else if (/^\d+[.)]\s/.test(line)) {
      if (!inList) { out.push('<ol style="padding-left:22px;margin:6px 0 10px;">'); inList = true; }
      out.push(`<li style="margin:4px 0;color:#334155;font-size:13px;line-height:1.6;">${esc(line.replace(/^\d+[.)]\s*/, ""))}</li>`);
    } else if (!line) {
      closeList();
    } else {
      closeList();
      const formatted = line.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/__(.+?)__/g, "<strong>$1</strong>");
      out.push(`<p style="margin:12px 0;color:#334155;font-size:13px;line-height:1.9;">${esc(formatted)}</p>`);
    }
  }
  closeList();
  return out.join("\n");
}

async function fetchImagem(tema) {
  const q = (tema || "nature").toLowerCase().replace(/\s+/g, ",");
  try {
    const resp = await fetch(`https://source.unsplash.com/900x480/?${q}`, { signal: AbortSignal.timeout(6000) });
    const blob = await resp.blob();
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

const PDF_SETTINGS = {
  margin: 15,
  image: { type: "jpeg", quality: 0.95 },
  html2canvas: { scale: 2, useCORS: true, allowTaint: true, backgroundColor: "#fff", logging: false },
  jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
  pagebreak: { mode: ["avoid-all", "css", "legacy"] },
};

function renderCapa(titulo, subtitulo, data, paleta) {
  return `<div style="page-break-after:always;padding:140px 64px 60px;text-align:center;background:linear-gradient(180deg,${paleta.light} 0%,${paleta.bg} 100%);">
    <div style="max-width:520px;margin:0 auto;">
      <h1 style="font-size:36px;font-weight:800;color:${paleta.primary};margin:0 0 6px;letter-spacing:-1px;">${esc(titulo || "Relatorio")}</h1>
      ${subtitulo ? `<p style="font-size:18px;color:${paleta.muted};margin:0 0 28px;line-height:1.5;font-weight:400;">${esc(subtitulo)}</p>` : ""}
      <div style="width:80px;height:4px;background:${paleta.accent};margin:0 auto 28px;border-radius:2px;"></div>
      <p style="font-size:12px;color:#94A3B8;margin:0;letter-spacing:0.3px;">Relatorio gerado em ${data}</p>
    </div>
  </div>`;
}

function renderTemplate(meta, contentHtml, paleta, imagemUrl) {
  const data = new Date().toLocaleDateString("pt-BR");
  const chartHtml = meta.grafico
    ? `<div class="chart-section" style="page-break-inside:avoid;margin:40px 0;background:#fff;border-radius:12px;border:1px solid #E2E8F0;padding:28px;box-shadow:0 1px 4px rgba(0,0,0,0.05);">
        <canvas id="report-chart-canvas" style="width:100%;height:300px;"></canvas>
       </div>`
    : "";
  const tabelaHtml = meta.tabela
    ? `<div style="page-break-inside:avoid;margin:40px 0;background:#fff;border-radius:12px;border:1px solid #E2E8F0;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.05);">
        ${meta.tabela.titulo ? `<div style="padding:20px 24px 0;font-weight:700;font-size:15px;color:${paleta.primary};">${esc(meta.tabela.titulo)}</div>` : ""}
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead><tr style="background:${paleta.light};">
            ${(meta.tabela.cabecalho || []).map((h, i) =>
              `<th style="text-align:${i === 0 ? "left" : "right"};padding:14px 20px;font-weight:600;color:${paleta.primary};border-bottom:2px solid ${paleta.accent};font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">${esc(h)}</th>`
            ).join("")}
          </tr></thead>
          <tbody>${(meta.tabela.linhas || []).map((linha, ri) =>
            `<tr style="border-bottom:1px solid #F1F5F9;background:${ri % 2 === 0 ? "#fff" : "#F8FAFC"};">
              ${linha.map((c, i) =>
                `<td style="text-align:${i === 0 ? "left" : "right"};padding:12px 20px;color:#334155;">${esc(c)}</td>`
              ).join("")}
            </tr>`
          ).join("")}</tbody>
        </table>
       </div>`
    : "";
  const imgHtml = imagemUrl
    ? `<div style="margin:0 0 36px;border-radius:12px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,0.08);">
        <img src="${imagemUrl}" style="width:100%;height:auto;display:block;" />
       </div>`
    : "";

  return `<div id="report-root" style="font-family:'Inter',system-ui,sans-serif;max-width:800px;margin:0 auto;background:#fff;color:#1E293B;">
    ${renderCapa(meta.titulo, meta.subtitulo, data, paleta)}
    <div style="padding:56px 64px 64px;">
      ${imgHtml}
      <div class="report-content">${contentHtml}</div>
      ${chartHtml}
      ${tabelaHtml}
    </div>
  </div>`;
}

function renderChatHTML(messages, title) {
  const paleta = escolherPaleta(title, null);
  const data = new Date().toLocaleDateString("pt-BR");
  const msgHtml = messages.map((msg, i) => {
    const role = msg.role === "user" ? "VOCE" : "ASSISTENTE";
    const badgeColor = msg.role === "user" ? paleta.accent : "#10B981";
    const badgeBg = msg.role === "user" ? paleta.light : "#ECFDF5";
    const content = esc(msg.content || "").replace(/\n/g, "<br>");
    let d = "";
    try { d = new Date(msg.createdAt).toLocaleString("pt-BR"); } catch { d = ""; }
    return `<div style="margin:0 0 24px;${i === messages.length - 1 ? "" : "border-bottom:1px solid #F1F5F9;padding-bottom:24px;"}>
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
        <span style="display:inline-block;padding:4px 12px;border-radius:20px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;background:${badgeBg};color:${badgeColor};">${role}</span>
        <span style="font-size:11px;color:#94A3B8;">${d}</span>
      </div>
      <div style="font-size:13px;line-height:1.8;color:#334155;padding-left:4px;">${content}</div>
    </div>`;
  }).join("\n");

  return `<div id="report-root" style="font-family:'Inter',system-ui,sans-serif;max-width:800px;margin:0 auto;background:#fff;color:#1E293B;">
    ${renderCapa(title, `${messages.length} mensagem(ns)`, data, paleta)}
    <div style="padding:48px 56px 56px;">
      ${msgHtml}
    </div>
  </div>`;
}

async function generatePDF(element, filename) {
  const blob = await html2pdf()
    .set({ ...PDF_SETTINGS, filename })
    .from(element)
    .output("blob");
  return blob;
}

async function savePDF(element, filename) {
  await html2pdf()
    .set({ ...PDF_SETTINGS, filename })
    .from(element)
    .save();
}

export async function gerarRelatorioPremium(metadata, markdownContent) {
  if (!window.html2pdf) throw new Error("html2pdf nao carregada.");
  if (!window.Chart) throw new Error("Chart.js nao carregada.");

  const paleta = escolherPaleta(metadata.titulo || "", metadata.corTema);
  const imagemUrl = await fetchImagem(metadata.imagem || "");
  const contentHtml = mdToHtml(markdownContent);
  const html = renderTemplate(metadata, contentHtml, paleta, imagemUrl);

  const wrapper = document.createElement("div");
  wrapper.innerHTML = html;
  document.body.appendChild(wrapper);
  const root = document.getElementById("report-root");

  if (metadata.grafico) {
    const canvas = document.getElementById("report-chart-canvas");
    if (canvas) {
      const g = metadata.grafico;
      new Chart(canvas, {
        type: g.tipo || "bar",
        data: {
          labels: g.labels || [],
          datasets: (g.datasets || []).map((ds) => ({
            label: ds.label || "",
            data: ds.data || [],
            backgroundColor: ds.cor || paleta.accent,
            borderColor: ds.cor || paleta.accent,
            borderWidth: 2,
            borderRadius: 4,
          })),
        },
        options: {
          animation: false,
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            legend: { display: true, position: "bottom", labels: { font: { family: "Inter", size: 11 } } },
            title: g.titulo ? { display: true, text: g.titulo, font: { family: "Inter", size: 15, weight: "600" }, padding: { bottom: 20 } } : undefined,
          },
          scales: g.tipo !== "doughnut" && g.tipo !== "pie" ? {
            y: { beginAtZero: false, grid: { color: "#E2E8F0", drawBorder: false }, ticks: { font: { size: 10 } } },
            x: { grid: { display: false }, ticks: { font: { family: "Inter", size: 10 } } },
          } : undefined,
        },
      });
    }
  }

  await new Promise((r) => setTimeout(r, 500));

  try {
    await savePDF(root, `${(metadata.titulo || "relatorio").replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`);
  } finally {
    wrapper.remove();
  }
}

export async function gerarPDFFromContent(content, title) {
  if (!window.html2pdf) throw new Error("html2pdf nao carregada.");

  const paleta = escolherPaleta(title, null);
  const contentHtml = mdToHtml(content || "");
  const data = new Date().toLocaleDateString("pt-BR");

  const html = `<div id="report-root" style="font-family:'Inter',system-ui,sans-serif;max-width:800px;margin:0 auto;background:#fff;color:#1E293B;">
    ${renderCapa(title, null, data, paleta)}
    <div style="padding:56px 64px 64px;">
      <div class="report-content">${contentHtml}</div>
    </div>
  </div>`;

  const wrapper = document.createElement("div");
  wrapper.innerHTML = html;
  document.body.appendChild(wrapper);
  const root = document.getElementById("report-root");

  try {
    const safeName = title.replace(/[^a-zA-Z0-9_-]/g, "_").substring(0, 100);
    const blob = await generatePDF(root, `${safeName}.pdf`);
    const blobUrl = URL.createObjectURL(blob);
    return { fileName: `${safeName}.pdf`, blobUrl };
  } finally {
    wrapper.remove();
  }
}

export async function exportChatAsPremiumPDF(messages, title) {
  if (!window.html2pdf) throw new Error("html2pdf nao carregada.");

  const html = renderChatHTML(messages, title || "Conversa");

  const wrapper = document.createElement("div");
  wrapper.innerHTML = html;
  document.body.appendChild(wrapper);
  const root = document.getElementById("report-root");

  try {
    const safeName = (title || "conversa").replace(/[^a-zA-Z0-9_-]/g, "_");
    await savePDF(root, `${safeName}.pdf`);
  } finally {
    wrapper.remove();
  }
}

export async function exportMessageAsPremiumPDF(message, title) {
  if (!window.html2pdf) throw new Error("html2pdf nao carregada.");

  const data = new Date().toLocaleDateString("pt-BR");
  const paleta = escolherPaleta(title, null);
  const role = message.role === "user" ? "VOCE" : "ASSISTENTE";
  const badgeColor = message.role === "user" ? paleta.accent : "#10B981";
  const badgeBg = message.role === "user" ? paleta.light : "#ECFDF5";
  let d = "";
  try { d = new Date(message.createdAt).toLocaleString("pt-BR"); } catch { d = ""; }

  const html = `<div id="report-root" style="font-family:'Inter',system-ui,sans-serif;max-width:800px;margin:0 auto;background:#fff;color:#1E293B;">
    ${renderCapa(title || "Mensagem", null, data, paleta)}
    <div style="padding:56px 64px 64px;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
        <span style="display:inline-block;padding:4px 14px;border-radius:20px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;background:${badgeBg};color:${badgeColor};">${role}</span>
        <span style="font-size:11px;color:#94A3B8;">${d}</span>
      </div>
      <div style="font-size:13px;line-height:1.9;color:#334155;">${esc(message.content || "").replace(/\n/g, "<br>")}</div>
    </div>
  </div>`;

  const wrapper = document.createElement("div");
  wrapper.innerHTML = html;
  document.body.appendChild(wrapper);
  const root = document.getElementById("report-root");

  try {
    const safeName = (title || "mensagem").replace(/[^a-zA-Z0-9_-]/g, "_");
    await savePDF(root, `${safeName}.pdf`);
  } finally {
    wrapper.remove();
  }
}
