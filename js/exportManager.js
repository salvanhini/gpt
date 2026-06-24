function sanitizeFilename(name) {
  return (name || "export").replace(/[^a-zA-Z0-9_-]/g, "_").substring(0, 100);
}

function formatDate(dateStr) {
  try {
    return new Date(dateStr).toLocaleString("pt-BR");
  } catch {
    return dateStr || "";
  }
}

function buildPlainText(messages, title) {
  const lines = [title, "=".repeat(title.length), ""];
  for (const msg of messages) {
    const role = msg.role === "user" ? "Voce" : "Assistente";
    lines.push(`[${role}] (${formatDate(msg.createdAt)}):`);
    const content = msg.role === "assistant" ? sanitizeText(msg.content) : (msg.content || "");
    lines.push(isStructuredData(content) ? msg.content : content);
    lines.push("", "---", "");
  }
  return lines.join("\n");
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadText(text, filename, mimeType) {
  const blob = new Blob([text], { type: mimeType });
  downloadBlob(blob, filename);
}

export async function exportChatAsDOCX(messages, title = "Conversa") {
  if (!window.docx) {
    throw new Error("Biblioteca docx nao carregada.");
  }
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = window.docx;

  const children = [
    new Paragraph({
      children: [new TextRun({ text: title, bold: true, size: 32, font: "Arial" })],
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 200 },
    }),
  ];

  for (const msg of messages) {
    const role = msg.role === "user" ? "Voce" : "Assistente";
    const color = msg.role === "user" ? "3b82f6" : "10b981";
    const dateStr = formatDate(msg.createdAt);

    children.push(
      new Paragraph({
        children: [new TextRun({ text: `${role} — ${dateStr}`, bold: true, size: 18, color, font: "Arial" })],
        spacing: { before: 200, after: 60 },
      })
    );
    const msgContent = msg.content || "";
    const cleanContent = msg.role === "assistant" ? (isStructuredData(msgContent) ? msgContent : sanitizeText(msgContent)) : msgContent;
    children.push(
      new Paragraph({
        children: [new TextRun({ text: cleanContent, size: 22, font: "Arial" })],
        alignment: AlignmentType.JUSTIFIED,
        spacing: { after: 120 },
      })
    );
  }

  const doc = new Document({ sections: [{ children }] });
  const blob = await Packer.toBlob(doc);
  downloadBlob(blob, `${sanitizeFilename(title)}.docx`);
}

export function exportChatAsCSV(messages, title = "Conversa") {
  const header = "Remetente,Data,Hora,Conteudo\n";
  const rows = messages.map((msg) => {
    const role = msg.role === "user" ? "Voce" : "Assistente";
    const d = new Date(msg.createdAt);
    const date = d.toLocaleDateString("pt-BR");
    const time = d.toLocaleTimeString("pt-BR");
    const rawContent = msg.content || "";
    const content = (msg.role === "assistant" && isStructuredData(rawContent) ? rawContent : sanitizeText(rawContent)).replace(/"/g, '""').replace(/\n/g, " ");
    return `"${role}","${date}","${time}","${content}"`;
  }).join("\n");
  downloadText(header + rows, `${sanitizeFilename(title)}.csv`, "text/csv;charset=utf-8");
}

export function exportChatAsJSON(messages, title = "Conversa") {
  const data = {
    title,
    exportedAt: new Date().toISOString(),
    messages: messages.map((m) => {
      const rawContent = m.content || "";
      const cleanContent = m.role === "assistant" && isStructuredData(rawContent) ? rawContent : sanitizeText(rawContent);
      return { role: m.role, content: cleanContent, createdAt: m.createdAt };
    }),
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  downloadBlob(blob, `${sanitizeFilename(title)}.json`);
}

export async function exportChatAsExcel(messages, title = "Conversa") {
  if (!window.ExcelJS) {
    throw new Error("Biblioteca ExcelJS nao carregada.");
  }
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Conversa");

  ws.columns = [
    { header: "Remetente", key: "role", width: 15 },
    { header: "Data", key: "date", width: 15 },
    { header: "Hora", key: "time", width: 12 },
    { header: "Conteudo", key: "content", width: 70 },
  ];

  ws.getRow(1).font = { bold: true };

  for (const msg of messages) {
    const d = new Date(msg.createdAt);
    const rawContent = msg.content || "";
    ws.addRow({
      role: msg.role === "user" ? "Voce" : "Assistente",
      date: d.toLocaleDateString("pt-BR"),
      time: d.toLocaleTimeString("pt-BR"),
      content: msg.role === "assistant" && isStructuredData(rawContent) ? rawContent : sanitizeText(rawContent),
    });
  }

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  downloadBlob(blob, `${sanitizeFilename(title)}.xlsx`);
}

export async function exportChatAsPowerPoint(messages, title = "Conversa") {
  if (!window.PptxGenJS) {
    throw new Error("Biblioteca PptxGenJS nao carregada.");
  }
  const pptx = new PptxGenJS();
  pptx.title = title;
  pptx.author = "FEMIC GPT";

  const PAGE_SIZE = 20;
  const chunks = [];
  for (let i = 0; i < messages.length; i += PAGE_SIZE) {
    chunks.push(messages.slice(i, i + PAGE_SIZE));
  }

  for (let ci = 0; ci < chunks.length; ci++) {
    const slide = pptx.addSlide();
    slide.background = { color: "FFFFFF" };

    slide.addText(
      `${title}${chunks.length > 1 ? ` (${ci + 1}/${chunks.length})` : ""}`,
      { x: 0.5, y: 0.2, w: 9, h: 0.5, fontSize: 18, bold: true, color: "1E293B" }
    );

    let y = 0.9;
    for (const msg of chunks[ci]) {
      const role = msg.role === "user" ? "Voce" : "Assistente";
      const roleColor = msg.role === "user" ? "3B82F6" : "10B981";
      const dateStr = formatDate(msg.createdAt);
      const rawContent = msg.content || "";
      const content = msg.role === "assistant" && isStructuredData(rawContent) ? rawContent : sanitizeText(rawContent);

      slide.addText(`${role} — ${dateStr}`, {
        x: 0.5, y, w: 9, h: 0.3, fontSize: 9, bold: true, color: roleColor,
      });
      y += 0.28;

      const lines = content.split("\n");
      const displayLines = lines.slice(0, 12);
      const textContent = displayLines.map((l) => ({ text: l + "\n", options: { fontSize: 10, color: "334155" } }));

      if (textContent.length > 0) {
        slide.addText(textContent, {
          x: 0.5, y, w: 9, h: Math.min(1.8, displayLines.length * 0.22), valign: "top",
        });
        y += Math.min(1.8, displayLines.length * 0.22) + 0.15;
      }

      if (y > 7) {
        break;
      }
    }
  }

  const buffer = await pptx.write({ outputType: "arraybuffer" });
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.presentationml.presentation" });
  downloadBlob(blob, `${sanitizeFilename(title)}.pptx`);
}

export async function exportChatAsWord(messages, title = "Conversa") {
  if (!window.html2pdf) {
    throw new Error("Biblioteca html2pdf nao carregada.");
  }

  const container = document.createElement("div");
  container.style.cssText = "font-family: Arial, sans-serif; padding: 40px; color: #1e293b; max-width: 800px; margin: 0 auto;";
  container.innerHTML = `<h1 style="font-size:22px;border-bottom:2px solid #3b82f6;padding-bottom:8px;margin-bottom:24px;">${escapeHtmlForExport(title)}</h1>`;

  for (const msg of messages) {
    const role = msg.role === "user" ? "Voce" : "Assistente";
    const color = msg.role === "user" ? "#3b82f6" : "#10b981";
    const dateStr = formatDate(msg.createdAt);
    const div = document.createElement("div");
    div.style.cssText = "margin-bottom:16px;";
    const rawContent = msg.content || "";
    const cleanContent = msg.role === "assistant" && isStructuredData(rawContent) ? rawContent : sanitizeText(rawContent);
    div.innerHTML = `
      <div style="font-size:11px;font-weight:bold;color:${color};margin-bottom:4px;">${role} — ${dateStr}</div>
      <div style="font-size:13px;line-height:1.6;white-space:pre-wrap;">${escapeHtmlForExport(cleanContent)}</div>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin-top:12px;">
    `;
    container.appendChild(div);
  }

  document.body.appendChild(container);

  const opt = {
    margin: 10,
    filename: `${sanitizeFilename(title)}.pdf`,
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: { scale: 2 },
    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
  };

  try {
    await window.html2pdf().set(opt).from(container).save();
  } finally {
    document.body.removeChild(container);
  }
}

function escapeHtmlForExport(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function sanitizeText(str) {
  if (!str) return "";
  const noisePatterns = [
    // Saudacoes e intro
    /(?:Claro!|Com certeza!|Entendido!|Certo!|Vou te ajudar com isso\.?\s*)/gi,
    /(?:Aqui está|Segue|Confira|Encontra-se abaixo|De acordo com.*solicitação)[^.]*\.\s*/gi,
    // Cortesias de fechamento
    /(?:Espero ter ajudado|Se precisar de mais alguma coisa|Estou à disposição)[^.]*\.?\s*/gi,
    // Transicoes
    /(?:Segue o relatório|Relatório solicitado|Segue abaixo|Segue em anexo)[^.]*\.\s*/gi,
    /(?:Baseado nos dados|Com base nas informações|Analisando os dados)[^.]*\.\s*/gi,
    // Frases genericas
    /(?:Aqui está a análise|Segue a análise|Conforme solicitado|Conforme pedido)[^.]*\.\s*/gi,
    /(?:Analisei os dados|Fiz a análise|Verifiquei as informações)[^.]*\.\s*/gi,
  ];
  let clean = str;
  for (const p of noisePatterns) clean = clean.replace(p, "");
  return clean.replace(/\n{3,}/g, "\n\n").trim();
}

function isStructuredData(content) {
  if (!content) return false;
  const trimmed = content.trim();
  if (trimmed.startsWith("```json")) return true;
  if (/^\|(.+)\|$/m.test(trimmed)) return true;
  if (trimmed.startsWith("{") && (trimmed.includes('"grafico"') || trimmed.includes('"tabela"'))) return true;
  return false;
}

export async function exportTasksAsDOCX(tasks) {
  if (!window.docx) {
    throw new Error("Biblioteca docx nao carregada.");
  }
  if (!tasks || tasks.length === 0) {
    throw new Error("Nenhuma tarefa para exportar.");
  }
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = window.docx;

  const children = [
    new Paragraph({
      children: [new TextRun({ text: "Minhas Tarefas", bold: true, size: 32, font: "Arial" })],
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 200 },
    }),
  ];

  for (const t of tasks) {
    const status = t.status === "concluida" ? "[x]" : "[ ]";
    const date = new Date(t.dataExecucao).toLocaleDateString("pt-BR");
    const overdue = new Date(t.dataExecucao) <= new Date() && t.status !== "concluida" ? " (ATRASADA)" : "";
    const color = t.status === "concluida" ? "10b981" : overdue ? "ef4444" : "1e293b";
    children.push(
      new Paragraph({
        children: [new TextRun({ text: `${status} ${sanitizeText(t.texto || "")} — ${date} (${t.recorrencia})${overdue}`, size: 22, font: "Arial", color })],
        alignment: AlignmentType.JUSTIFIED,
        spacing: { after: 80 },
      })
    );
  }

  const doc = new Document({ sections: [{ children }] });
  const blob = await Packer.toBlob(doc);
  downloadBlob(blob, "tarefas.docx");
}

export function exportTasksAsCSV(tasks) {
  if (!tasks || tasks.length === 0) {
    throw new Error("Nenhuma tarefa para exportar.");
  }
  const header = "Status,Texto,Data Criacao,Data Execucao,Recorrencia,Atrasada\n";
  const rows = tasks.map((t) => {
    const status = t.status === "concluida" ? "Concluida" : "Pendente";
    const text = sanitizeText(t.texto || "").replace(/"/g, '""');
    const created = new Date(t.dataCriacao).toLocaleDateString("pt-BR");
    const exec = new Date(t.dataExecucao).toLocaleDateString("pt-BR");
    const overdue = new Date(t.dataExecucao) <= new Date() && t.status !== "concluida" ? "Sim" : "Nao";
    return `"${status}","${text}","${created}","${exec}","${t.recorrencia}","${overdue}"`;
  }).join("\n");
  downloadText(header + rows, "tarefas.csv", "text/csv;charset=utf-8");
}

export async function exportTasksAsExcel(tasks) {
  if (!window.ExcelJS) {
    throw new Error("Biblioteca ExcelJS nao carregada.");
  }
  if (!tasks || tasks.length === 0) {
    throw new Error("Nenhuma tarefa para exportar.");
  }
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Tarefas");
  ws.columns = [
    { header: "Status", key: "status", width: 12 },
    { header: "Texto", key: "texto", width: 50 },
    { header: "Data Criacao", key: "created", width: 15 },
    { header: "Data Execucao", key: "exec", width: 15 },
    { header: "Recorrencia", key: "rec", width: 15 },
    { header: "Atrasada", key: "overdue", width: 12 },
  ];
  ws.getRow(1).font = { bold: true };

  for (const t of tasks) {
    ws.addRow({
      status: t.status === "concluida" ? "Concluida" : "Pendente",
      texto: sanitizeText(t.texto || ""),
      created: new Date(t.dataCriacao).toLocaleDateString("pt-BR"),
      exec: new Date(t.dataExecucao).toLocaleDateString("pt-BR"),
      rec: t.recorrencia,
      overdue: new Date(t.dataExecucao) <= new Date() && t.status !== "concluida" ? "Sim" : "Nao",
    });
  }

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  downloadBlob(blob, "tarefas.xlsx");
}

export async function exportMessageAsDOCX(message, title = "Resposta") {
  if (!window.docx) {
    throw new Error("Biblioteca docx nao carregada.");
  }
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = window.docx;

  const role = message.role === "user" ? "Voce" : "Assistente";
  const color = message.role === "user" ? "3b82f6" : "10b981";
  const dateStr = formatDate(message.createdAt);

  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({
          children: [new TextRun({ text: title, bold: true, size: 32, font: "Arial" })],
          heading: HeadingLevel.HEADING_1,
          spacing: { after: 200 },
        }),
        new Paragraph({
          children: [new TextRun({ text: `${role} — ${dateStr}`, bold: true, size: 18, color, font: "Arial" })],
          spacing: { after: 100 },
        }),
        new Paragraph({
          children: [new TextRun({ text: sanitizeText(message.content || ""), size: 22, font: "Arial" })],
          alignment: AlignmentType.JUSTIFIED,
        }),
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  downloadBlob(blob, `${sanitizeFilename(title)}.docx`);
}
