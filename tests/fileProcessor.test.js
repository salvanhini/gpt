import test from "node:test";
import assert from "node:assert/strict";

import { buildCombinedContext, MAX_CONTEXT_CHARS } from "../js/fileProcessor.js";

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
