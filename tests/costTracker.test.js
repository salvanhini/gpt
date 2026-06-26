import test from "node:test";
import assert from "node:assert/strict";

import {
  getDailyCostDetails,
  trackCost,
} from "../js/costTracker.js";

function createMemoryStorage() {
  const store = new Map();
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    clear() {
      store.clear();
    },
  };
}

test("trackCost marks unknown model as unpriced instead of inventing cost", () => {
  const previousStorage = globalThis.localStorage;
  globalThis.localStorage = createMemoryStorage();

  try {
    const cost = trackCost("modelo/novo", 1000, 500);
    const details = getDailyCostDetails();

    assert.equal(cost, 0);
    assert.equal(details.byModel["modelo/novo"], 0);
    assert.equal(details.noPriceModels["modelo/novo"], true);
  } finally {
    globalThis.localStorage = previousStorage;
  }
});
