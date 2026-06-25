import { getPdfJs } from "./pdf.js";

export const MAX_CONTEXT_CHARS = 12000;
const MAX_FILE_CONTEXT_CHARS = 8000;
const MAX_VISUAL_PDF_PAGES = 4;
const MIN_USEFUL_PAGE_CHARS = 40;

function truncate(text, max = MAX_FILE_CONTEXT_CHARS) {
  if (text.length <= max) {
    return text;
  }

  return `${text.slice(0, max)}\n\n[conteúdo truncado para caber no contexto]`;
}

async function readAsArrayBuffer(file) {
  return file.arrayBuffer();
}

async function readAsText(file) {
  return file.text();
}

async function readPdf(file) {
  const pdfjsLib = getPdfJs();
  const bytes = await readAsArrayBuffer(file);
  const loadingTask = pdfjsLib.getDocument({ data: bytes });
  const pdf = await loadingTask.promise;
  const pages = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const text = textContent.items.map((item) => item.str).join(" ").trim();
    pages.push({ pageNumber, text });
  }

  const quality = assessPdfTextQuality(pages);
  const visualPages = shouldRenderPdfVisually(quality)
    ? await renderPdfPagesAsImages(pdf, quality.weakPageNumbers)
    : [];

  return {
    text: pages.map((page) => `Pagina ${page.pageNumber}\n${page.text}`).join("\n\n"),
    pages,
    visualPages,
    quality: {
      ...quality,
      visualPagesRendered: visualPages.length,
      visualPartial: visualPages.length > 0 && visualPages.length < quality.weakPageNumbers.length,
    },
  };
}

function normalizeUsefulText(text = "") {
  return String(text)
    .replace(/\bpagina\s*\d+\b/gi, " ")
    .replace(/\bpage\s*\d+\b/gi, " ")
    .replace(/\d+/g, " ")
    .replace(/[^\p{L}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isUsefulPdfPageText(text = "") {
  const normalized = normalizeUsefulText(text);
  const words = normalized.split(/\s+/).filter((word) => word.length >= 3);
  return normalized.length >= MIN_USEFUL_PAGE_CHARS && words.length >= 5;
}

export function assessPdfTextQuality(pages = []) {
  const totalPages = pages.length;
  const usefulPages = pages.filter((page) => isUsefulPdfPageText(page.text));
  const weakPageNumbers = pages
    .filter((page) => !isUsefulPdfPageText(page.text))
    .map((page) => page.pageNumber);
  const extractedChars = pages.reduce((sum, page) => sum + String(page.text || "").trim().length, 0);
  const usefulRatio = totalPages ? usefulPages.length / totalPages : 0;

  let method = "failed";
  if (totalPages > 0 && usefulPages.length === 0) {
    method = "visual_required";
  } else if (usefulRatio < 0.6) {
    method = "weak";
  } else {
    method = "text";
  }

  return {
    method,
    totalPages,
    usefulPages: usefulPages.length,
    weakPageNumbers,
    extractedChars,
  };
}

function shouldRenderPdfVisually(quality) {
  return ["weak", "visual_required"].includes(quality.method);
}

async function renderPdfPagesAsImages(pdf, pageNumbers = []) {
  if (!globalThis.document?.createElement) return [];
  const selectedPages = pageNumbers.slice(0, MAX_VISUAL_PDF_PAGES);
  const images = [];

  for (const pageNumber of selectedPages) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1.15 });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) continue;
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    await page.render({ canvasContext: context, viewport }).promise;
    images.push({
      pageNumber,
      dataUrl: canvas.toDataURL("image/jpeg", 0.78),
      name: `Pagina ${pageNumber}`,
    });
  }

  return images;
}

async function readSpreadsheet(file) {
  if (!globalThis.XLSX) {
    throw new Error("Biblioteca de planilhas não carregada.");
  }

  const bytes = await readAsArrayBuffer(file);
  const workbook = globalThis.XLSX.read(bytes, { type: "array" });
  const chunks = workbook.SheetNames.map((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const rows = globalThis.XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: "",
    });

    return [
      `Planilha: ${sheetName}`,
      rows
        .map((row) => row.map((cell) => String(cell).trim()).join(" | "))
        .join("\n"),
    ].join("\n");
  });

  return chunks.join("\n\n");
}

async function readXml(file) {
  const text = await readAsText(file);
  const doc = new DOMParser().parseFromString(text, "application/xml");
  const parserError = doc.querySelector("parsererror");
  if (parserError) {
    return text;
  }

  return new XMLSerializer().serializeToString(doc);
}

async function readCsv(file) {
  return readAsText(file);
}

async function readTxt(file) {
  return readAsText(file);
}

async function readDocx(file) {
  if (!globalThis.mammoth) {
    throw new Error("Biblioteca mammoth.js nao carregada.");
  }

  const arrayBuffer = await readAsArrayBuffer(file);
  const result = await globalThis.mammoth.extractRawText({ arrayBuffer });
  return result.value || "";
}

async function readOdf(file, type) {
  if (!globalThis.JSZip) {
    throw new Error("Biblioteca JSZip nao carregada.");
  }

  const arrayBuffer = await readAsArrayBuffer(file);
  const zip = await globalThis.JSZip.loadAsync(arrayBuffer);

  const contentFile = zip.file("content.xml");
  if (!contentFile) {
    throw new Error("Arquivo content.xml nao encontrado no documento.");
  }

  const xmlText = await contentFile.async("text");
  const doc = new DOMParser().parseFromString(xmlText, "application/xml");

  const textNodes = doc.querySelectorAll("text\\:p, p");
  const texts = [];
  textNodes.forEach((node) => {
    const text = node.textContent?.trim();
    if (text) {
      texts.push(text);
    }
  });

  if (texts.length === 0) {
    return xmlText;
  }

  return texts.join("\n\n");
}

async function readPptx(file) {
  if (!globalThis.JSZip) {
    throw new Error("Biblioteca JSZip nao carregada.");
  }

  const arrayBuffer = await readAsArrayBuffer(file);
  const zip = await globalThis.JSZip.loadAsync(arrayBuffer);

  const slides = [];
  const slideFiles = Object.keys(zip.files).filter(
    (name) => name.match(/^ppt\/slides\/slide\d+\.xml$/) && !zip.files[name].dir
  );

  slideFiles.sort();

  for (const slidePath of slideFiles) {
    const slideXml = await zip.file(slidePath).async("text");
    const doc = new DOMParser().parseFromString(slideXml, "application/xml");
    const textNodes = doc.querySelectorAll("a\\:t, t");
    const texts = [];
    textNodes.forEach((node) => {
      const text = node.textContent?.trim();
      if (text) {
        texts.push(text);
      }
    });
    if (texts.length > 0) {
      slides.push(`Slide: ${texts.join(" ")}`);
    }
  }

  if (slides.length === 0) {
    throw new Error("Nenhum slide encontrado no arquivo.");
  }

  return slides.join("\n\n");
}

async function readImage(file) {
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Falha ao ler imagem."));
    reader.readAsDataURL(file);
  });

  const dimensions = await new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.width, height: img.height });
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });

  return {
    dataUrl,
    width: dimensions?.width || 0,
    height: dimensions?.height || 0,
  };
}

function getExtension(name) {
  return name.split(".").pop()?.toLowerCase() || "";
}

const TEXT_EXTENSIONS = ["txt", "json", "html", "htm", "md", "css", "js", "ts", "py", "java", "c", "cpp", "rb", "php", "sql", "sh", "bat", "log", "ini", "cfg", "conf", "yaml", "yml", "toml"];
const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg", "ico", "tiff", "tif"];
const ODF_EXTENSIONS = ["odt", "ods", "odp"];

export function buildCombinedContext(files, max = MAX_CONTEXT_CHARS) {
  const combined = (files || [])
    .map((item) => item?.contextBlock)
    .filter(Boolean)
    .join("\n\n---\n\n");

  if (combined.length <= max) {
    return combined;
  }

  const notice = "\n\n[contexto combinado truncado para caber no contexto]";
  return `${combined.slice(0, Math.max(0, max - notice.length))}${notice}`;
}

export async function processFile(file) {
  try {
    const extension = getExtension(file.name);
    let content = "";
    let documentMeta = null;
    let visualPages = [];

    if (extension === "pdf") {
      const pdfResult = await readPdf(file);
      content = pdfResult.text;
      visualPages = pdfResult.visualPages;
      documentMeta = {
        kind: "pdf",
        pages: pdfResult.quality.totalPages,
        usefulPages: pdfResult.quality.usefulPages,
        weakPages: pdfResult.quality.weakPageNumbers,
        extractedChars: pdfResult.quality.extractedChars,
        extractionMethod: pdfResult.quality.method,
        visualPagesRendered: pdfResult.quality.visualPagesRendered,
        visualPartial: pdfResult.quality.visualPartial,
      };
    } else if (["xlsx", "xls"].includes(extension)) {
      content = await readSpreadsheet(file);
    } else if (extension === "csv") {
      content = await readCsv(file);
    } else if (extension === "xml") {
      content = await readXml(file);
    } else if (extension === "docx") {
      content = await readDocx(file);
    } else if (extension === "doc") {
      content = await readAsText(file);
      content = `[Formato .doc antigo - conteudo bruto]\n\n${content}`;
    } else if (extension === "pptx") {
      content = await readPptx(file);
    } else if (ODF_EXTENSIONS.includes(extension)) {
      const typeLabel = extension === "odt" ? "Texto" : extension === "ods" ? "Planilha" : "Apresentacao";
      content = await readOdf(file, extension);
      content = `[Documento LibreOffice ${typeLabel}]\n\n${content}`;
    } else if (TEXT_EXTENSIONS.includes(extension)) {
      content = await readAsText(file);
    } else if (IMAGE_EXTENSIONS.includes(extension)) {
      const imageInfo = await readImage(file);
      const sizeKb = (file.size / 1024).toFixed(1);
      return {
        name: file.name,
        type: extension,
        size: file.size,
        imageDataUrl: imageInfo.dataUrl,
        extractedText: `[Imagem anexada: ${file.name} (${imageInfo.width}x${imageInfo.height}, ${sizeKb}KB)]`,
        summary: `${file.name} (${imageInfo.width}x${imageInfo.height}, ${sizeKb}KB)`,
        contextBlock: [
          `Arquivo: ${file.name}`,
          `Tipo: ${extension.toUpperCase()}`,
          `Dimensoes: ${imageInfo.width}x${imageInfo.height}`,
          `Tamanho: ${sizeKb}KB`,
        ].join("\n"),
      };
    } else {
      throw new Error(`Formato nao suportado: .${extension}`);
    }

    const normalized = truncate(content.trim());
    const statusLabel =
      documentMeta?.extractionMethod === "visual_required"
        ? "leitura visual"
        : documentMeta?.extractionMethod === "weak"
          ? "parcial"
          : "lido";
    return {
      name: file.name,
      type: extension,
      size: file.size,
      documentMeta,
      visualPages,
      status: statusLabel,
      extractedText: normalized,
      summary: `${file.name} (${extension.toUpperCase()})`,
      contextBlock: [
        `Arquivo: ${file.name}`,
        `Tipo: ${extension.toUpperCase()}`,
        documentMeta ? `Status de leitura: ${statusLabel}` : "",
        documentMeta ? `Paginas: ${documentMeta.pages}; paginas com texto util: ${documentMeta.usefulPages}; caracteres extraidos: ${documentMeta.extractedChars}` : "",
        documentMeta?.visualPagesRendered ? `Leitura visual preparada para paginas: ${visualPages.map((page) => page.pageNumber).join(", ")}` : "",
        "Conteudo extraido:",
        normalized || "[Sem texto confiavel extraido. Use as paginas renderizadas como imagem para leitura visual.]",
      ].filter(Boolean).join("\n"),
    };
  } catch (error) {
    throw new Error(`Falha ao preparar ${file.name}: ${error.message}`);
  }
}

export async function processFiles(fileList) {
  const files = Array.from(fileList || []);
  const processed = [];

  for (const file of files) {
    processed.push(await processFile(file));
  }

  return {
    files: processed,
    combinedContext: buildCombinedContext(processed),
  };
}
