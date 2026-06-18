import test from "node:test";
import assert from "node:assert/strict";

import {
  createBrand,
  createBrandId,
  deleteBrand,
  loadBrands,
  saveBrands,
  updateBrand,
} from "../js/brands.js";

function createMemoryStorage() {
  const store = new Map();
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
}

test("createBrandId appends a suffix when the slug already exists", () => {
  const id = createBrandId("Clinica Bem Viver", [
    { id: "brand-clinica-bem-viver" },
  ]);

  assert.equal(id, "brand-clinica-bem-viver-2");
});

test("create, update and delete brand persist correctly", () => {
  const previousStorage = globalThis.localStorage;
  globalThis.localStorage = createMemoryStorage();

  try {
    saveBrands([]);

    const created = createBrand({
      name: "Clinica Bem Viver",
      primaryColor: "#1D4ED8",
      secondaryColor: "#0F172A",
      logoUrl: "https://example.com/logo.png",
    });

    assert.equal(loadBrands().length, 1);
    assert.equal(created.name, "Clinica Bem Viver");

    updateBrand(created.id, {
      name: "Clinica Bem Viver Premium",
      primaryColor: "#14B8A6",
    });

    const [updated] = loadBrands();
    assert.equal(updated.name, "Clinica Bem Viver Premium");
    assert.equal(updated.primaryColor, "#14B8A6");
    assert.equal(updated.secondaryColor, "#0F172A");

    deleteBrand(created.id);
    assert.deepEqual(loadBrands(), []);
  } finally {
    globalThis.localStorage = previousStorage;
  }
});
