const { PDFDocument, StandardFonts, rgb } = globalThis.PDFLib || {};

export async function generatePDFFromText(text, options = {}) {
  if (!PDFDocument) {
    throw new Error("Biblioteca pdf-lib nao carregada.");
  }

  const {
    title = "Documento",
    fontSize = 11,
    marginTop = 50,
    marginBottom = 50,
    marginLeft = 50,
    marginRight = 50,
    fileName = "documento.pdf",
  } = options;

  const pdfDoc = await PDFDocument.create();
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const usableWidth = pageWidth - marginLeft - marginRight;
  const usableHeight = pageHeight - marginTop - marginBottom;

  const lines = text.split("\n");
  const lineHeight = fontSize * 1.4;
  const linesPerPage = Math.floor(usableHeight / lineHeight);

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - marginTop;
  let lineCount = 0;

  for (const line of lines) {
    if (lineCount >= linesPerPage) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - marginTop;
      lineCount = 0;
    }

    const wrappedLines = wrapText(line, helvetica, fontSize, usableWidth);
    for (const wrappedLine of wrappedLines) {
      if (lineCount >= linesPerPage) {
        page = pdfDoc.addPage([pageWidth, pageHeight]);
        y = pageHeight - marginTop;
        lineCount = 0;
      }

      const isHeader = line.startsWith("# ") || line.startsWith("## ") || line.startsWith("### ");
      const font = isHeader ? helveticaBold : helvetica;
      const size = line.startsWith("# ") ? fontSize + 4 : line.startsWith("## ") ? fontSize + 2 : line.startsWith("### ") ? fontSize + 1 : fontSize;
      const cleanLine = wrappedLine.replace(/^#{1,3}\s*/, "");

      page.drawText(cleanLine, {
        x: marginLeft,
        y,
        size,
        font,
        color: rgb(0.1, 0.1, 0.1),
        maxWidth: usableWidth,
      });

      y -= lineHeight;
      lineCount += 1;
    }
  }

  const pdfBytes = await pdfDoc.save();
  return { pdfBytes, fileName };
}

function wrapText(text, font, fontSize, maxWidth) {
  if (!text) return [""];

  const words = text.split(" ");
  const lines = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const width = font.widthOfTextAtSize(testLine, fontSize);

    if (width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.length > 0 ? lines : [""];
}

export function downloadPDF(pdfBytes, fileName) {
  const blob = new Blob([pdfBytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function exportChatAsPDF(messages, chatTitle = "Conversa") {
  const lines = [];
  lines.push(chatTitle);
  lines.push("=".repeat(chatTitle.length));
  lines.push("");

  for (const msg of messages) {
    if (msg.role === "user") {
      lines.push(`[Voce] (${new Date(msg.createdAt).toLocaleString("pt-BR")}):`);
    } else {
      lines.push(`[Assistente] (${new Date(msg.createdAt).toLocaleString("pt-BR")}):`);
    }
    lines.push(msg.content || "");
    lines.push("");
    lines.push("---");
    lines.push("");
  }

  const text = lines.join("\n");
  const { pdfBytes, fileName } = await generatePDFFromText(text, {
    title: chatTitle,
    fileName: `${chatTitle.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`,
  });

  downloadPDF(pdfBytes, fileName);
}

export async function exportMessageAsPDF(message, chatTitle = "Resposta") {
  const lines = [];
  lines.push(`${chatTitle}`);
  lines.push("=".repeat(chatTitle.length));
  lines.push("");
  lines.push(message.content || "");

  const text = lines.join("\n");
  const { pdfBytes, fileName } = await generatePDFFromText(text, {
    title: chatTitle,
    fileName: `${chatTitle.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`,
  });

  downloadPDF(pdfBytes, fileName);
}
