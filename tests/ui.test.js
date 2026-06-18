import test from "node:test";
import assert from "node:assert/strict";

import { shouldAutoScroll } from "../js/ui.js";

test("shouldAutoScroll returns true when the user is near the bottom", () => {
  assert.equal(
    shouldAutoScroll({
      scrollTop: 820,
      clientHeight: 180,
      scrollHeight: 1030,
    }),
    true,
  );
});

test("shouldAutoScroll returns false when the user is reading older messages", () => {
  assert.equal(
    shouldAutoScroll({
      scrollTop: 320,
      clientHeight: 180,
      scrollHeight: 1030,
    }),
    false,
  );
});
