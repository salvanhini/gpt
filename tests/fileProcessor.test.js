import test from "node:test";
import assert from "node:assert/strict";

import {
  assessPdfTextQuality,
  buildCombinedContext,
  MAX_CONTEXT_CHARS,
} from "../js/fileProcessor.js";

test("buildCombinedContext enforces a global limit across multiple files", () => {
  const longA = "A".repeat(MAX_CONTEXT_CHARS);
  const longB = "B".repeat(MAX_CONTEXT_CHARS);
  const context = buildCombinedContext([
    { contextBlock: `Arquivo: a\n${longA}` },
    { contextBlock: `Arquivo: b\n${longB}` },
  ]);

  assert.ok(context.length <= MAX_CONTEXT_CHARS);
  assert.match(context, /\[contexto combinado truncado/);
});

test("assessPdfTextQuality marks page-number-only PDFs as visual required", () => {
  const assessment = assessPdfTextQuality([
    { pageNumber: 1, text: "1" },
    { pageNumber: 2, text: "2" },
    { pageNumber: 3, text: "3" },
  ]);

  assert.equal(assessment.method, "visual_required");
  assert.equal(assessment.usefulPages, 0);
});

test("assessPdfTextQuality marks sparse PDFs as weak", () => {
  const assessment = assessPdfTextQuality([
    { pageNumber: 1, text: "Introducao curta com objetivos clinicos, resultados principais e conclusoes para analise." },
    { pageNumber: 2, text: "" },
    { pageNumber: 3, text: "" },
  ]);

  assert.equal(assessment.method, "weak");
  assert.equal(assessment.usefulPages, 1);
});

test("assessPdfTextQuality marks useful PDF text as text", () => {
  const assessment = assessPdfTextQuality([
    {
      pageNumber: 1,
      text: "Este artigo discute manejo de dor lombar com achados clinicos, criterios de inclusao, resultados e conclusoes relevantes para analise.",
    },
    {
      pageNumber: 2,
      text: "A metodologia apresenta bases de dados, estrategia de busca, avaliacao de qualidade e sintese dos resultados em detalhes suficientes.",
    },
  ]);

  assert.equal(assessment.method, "text");
  assert.equal(assessment.usefulPages, 2);
});
