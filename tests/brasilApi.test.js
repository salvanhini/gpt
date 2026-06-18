import test from "node:test";
import assert from "node:assert/strict";

import {
  buildBrasilCepUrl,
  buildBrasilCnpjUrl,
  formatCepSummary,
  formatCnpjSummary,
  inferBrasilLookupType,
  normalizeCepResult,
  normalizeCnpjResult,
} from "../js/brasilApi.js";

test("inferBrasilLookupType detects CEP and CNPJ from text", () => {
  assert.deepEqual(inferBrasilLookupType("01310-100"), { type: "cep", value: "01310100" });
  assert.deepEqual(inferBrasilLookupType("12.345.678/0001-90"), { type: "cnpj", value: "12345678000190" });
  assert.deepEqual(inferBrasilLookupType("abc"), { type: null, value: "" });
});

test("buildBrasil URLs normalize digits", () => {
  assert.equal(buildBrasilCepUrl("01310-100"), "https://brasilapi.com.br/api/cep/v1/01310100");
  assert.equal(buildBrasilCnpjUrl("12.345.678/0001-90"), "https://brasilapi.com.br/api/cnpj/v1/12345678000190");
});

test("normalizeCepResult maps the expected fields", () => {
  const result = normalizeCepResult({
    cep: "01310-100",
    street: "Avenida Paulista",
    neighborhood: "Bela Vista",
    city: "Sao Paulo",
    state: "SP",
  });

  assert.equal(result.street, "Avenida Paulista");
  assert.equal(result.city, "Sao Paulo");
});

test("normalizeCnpjResult composes summary fields", () => {
  const result = normalizeCnpjResult({
    cnpj: "12345678000190",
    razao_social: "Empresa X",
    nome_fantasia: "Marca X",
    descricao_situacao_cadastral: "ATIVA",
    logradouro: "Rua A",
    numero: "10",
    bairro: "Centro",
    municipio: "Curitiba",
    uf: "PR",
    cnae_fiscal_descricao: "Consultoria",
  });

  assert.equal(result.legalName, "Empresa X");
  assert.match(result.address, /Curitiba/);
  assert.equal(result.mainActivity, "Consultoria");
});

test("format summaries return organized text", () => {
  assert.match(formatCepSummary({ cep: "01310-100", street: "Rua", neighborhood: "Centro", city: "SP", state: "SP" }), /Consulta de CEP/);
  assert.match(formatCnpjSummary({ cnpj: "1", legalName: "Empresa", tradeName: "Marca", status: "ATIVA", address: "Rua", mainActivity: "Consultoria" }), /Consulta de CNPJ/);
});
