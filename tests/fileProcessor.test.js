import test from "node:test";
import assert from "node:assert/strict";

import { buildCombinedContext, MAX_CONTEXT_CHARS, processFiles } from "../js/fileProcessor.js";

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

test("processFiles preserves runtime file bytes for transient tools like E2B", async () => {
  const file = new File(["coluna,valor\nA,1"], "dados.csv", { type: "text/csv" });
  const processed = await processFiles([file]);

  assert.equal(processed.files.length, 1);
  assert.equal(processed.runtimeFiles.length, 1);
  assert.equal(processed.runtimeFiles[0].name, "dados.csv");
  assert.equal(processed.runtimeFiles[0].extension, "csv");
  assert.ok(processed.runtimeFiles[0].bytes instanceof ArrayBuffer);
});
