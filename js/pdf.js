const PDF_WORKER_SRC =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

export function getPdfJs() {
  const pdfjs = globalThis.pdfjsLib;
  if (!pdfjs) {
    throw new Error(
      "Leitor de PDF indisponivel no momento. Recarregue a pagina e tente novamente.",
    );
  }

  if (pdfjs.GlobalWorkerOptions?.workerSrc !== PDF_WORKER_SRC) {
    pdfjs.GlobalWorkerOptions.workerSrc = PDF_WORKER_SRC;
  }

  return pdfjs;
}
