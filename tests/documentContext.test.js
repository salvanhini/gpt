import test from "node:test";
import assert from "node:assert/strict";

import {
  buildDocumentBrief,
  buildDocumentSynthesis,
  normalizeResponseMode,
} from "../js/documentContext.js";

test("normalizeResponseMode preserves known modes and defaults to structured", () => {
  assert.equal(normalizeResponseMode("aula"), "aula");
  assert.equal(normalizeResponseMode("apostila"), "apostila");
  assert.equal(normalizeResponseMode("executivo"), "executivo");
  assert.equal(normalizeResponseMode("desconhecido"), "estruturado");
});

test("buildDocumentBrief keeps document metadata and page index compact", () => {
  const brief = buildDocumentBrief({
    name: "artigo.pdf",
    type: "pdf",
    documentMeta: {
      pages: 2,
      usefulPages: 1,
      extractionMethod: "weak",
      truncated: true,
      pageIndex: [
        { pageNumber: 1, chars: 120, useful: true, preview: "Introducao e objetivos do estudo." },
        { pageNumber: 2, chars: 4, useful: false, preview: "" },
      ],
    },
  });

  assert.equal(brief.name, "artigo.pdf");
  assert.equal(brief.status, "weak");
  assert.equal(brief.truncated, true);
  assert.match(brief.summary, /2 paginas/);
  assert.match(brief.pageHighlights, /Pagina 1/);
});

test("buildDocumentSynthesis summarizes multiple active documents", () => {
  const synthesis = buildDocumentSynthesis([
    buildDocumentBrief({ name: "a.pdf", type: "pdf", documentMeta: { pages: 5, usefulPages: 5, extractionMethod: "text" } }),
    buildDocumentBrief({ name: "b.pdf", type: "pdf", documentMeta: { pages: 10, usefulPages: 4, extractionMethod: "weak" } }),
  ]);

  assert.match(synthesis, /Documentos ativos: 2/);
  assert.match(synthesis, /a\.pdf/);
  assert.match(synthesis, /b\.pdf/);
});
