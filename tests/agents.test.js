import test from "node:test";
import assert from "node:assert/strict";

import { createAgentId } from "../js/agents.js";

test("createAgentId appends a suffix when the slug already exists", () => {
  const id = createAgentId("Assistente Geral", [
    { id: "agent-assistente-geral" },
    { id: "agent-outro" },
  ]);

  assert.equal(id, "agent-assistente-geral-2");
});

test("createAgentId falls back to a generated token when the name is empty", () => {
  const id = createAgentId("   ", [], () => "uuid-123");

  assert.equal(id, "agent-uuid-123");
});
