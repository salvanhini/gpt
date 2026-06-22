import { getPdfJs } from "./pdf.js";

export const MAX_CONTEXT_CHARS = 12000;
const MAX_FILE_CONTEXT_CHARS = 8000;

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
    pages.push(`Pagina ${pageNumber}\n${text}`);
  }

  return pages.join("\n\n");
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

    if (extension === "pdf") {
      content = await readPdf(file);
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
    return {
      name: file.name,
      type: extension,
      size: file.size,
      extractedText: normalized,
      summary: `${file.name} (${extension.toUpperCase()})`,
      contextBlock: [
        `Arquivo: ${file.name}`,
        `Tipo: ${extension.toUpperCase()}`,
        "Conteudo extraido:",
        normalized,
      ].join("\n"),
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
