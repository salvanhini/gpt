const BRASIL_API_BASE = "https://brasilapi.com.br/api";

function digitsOnly(value) {
  return String(value || "").replace(/\D+/g, "");
}

export function inferBrasilLookupType(input) {
  const digits = digitsOnly(input);
  if (digits.length === 8) {
    return { type: "cep", value: digits };
  }
  if (digits.length === 14) {
    return { type: "cnpj", value: digits };
  }
  return { type: null, value: digits };
}

export function buildBrasilCepUrl(cep) {
  return `${BRASIL_API_BASE}/cep/v1/${digitsOnly(cep)}`;
}

export function buildBrasilCnpjUrl(cnpj) {
  return `${BRASIL_API_BASE}/cnpj/v1/${digitsOnly(cnpj)}`;
}

export function normalizeCepResult(data = {}) {
  return {
    cep: String(data.cep || "").trim(),
    street: String(data.street || "").trim(),
    neighborhood: String(data.neighborhood || "").trim(),
    city: String(data.city || "").trim(),
    state: String(data.state || "").trim(),
  };
}

export function normalizeCnpjResult(data = {}) {
  const activity = Array.isArray(data.cnae_fiscal_descricao)
    ? data.cnae_fiscal_descricao[0]
    : data.cnae_fiscal_descricao || data.descricao_situacao_cadastral || "";

  const address = [
    data.logradouro,
    data.numero,
    data.complemento,
    data.bairro,
    data.municipio,
    data.uf,
  ]
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .join(", ");

  return {
    cnpj: String(data.cnpj || "").trim(),
    legalName: String(data.razao_social || "").trim(),
    tradeName: String(data.nome_fantasia || "").trim(),
    status: String(data.descricao_situacao_cadastral || "").trim(),
    address,
    mainActivity: String(activity || "").trim(),
  };
}

export function formatCepSummary(result) {
  return [
    "Consulta de CEP",
    "",
    `CEP: ${result.cep || "Nao informado"}`,
    `Logradouro: ${result.street || "Nao informado"}`,
    `Bairro: ${result.neighborhood || "Nao informado"}`,
    `Cidade: ${result.city || "Nao informada"}`,
    `UF: ${result.state || "Nao informada"}`,
  ].join("\n");
}

export function formatCnpjSummary(result) {
  return [
    "Consulta de CNPJ",
    "",
    `CNPJ: ${result.cnpj || "Nao informado"}`,
    `Razao social: ${result.legalName || "Nao informada"}`,
    `Nome fantasia: ${result.tradeName || "Nao informado"}`,
    `Situacao: ${result.status || "Nao informada"}`,
    `Endereco: ${result.address || "Nao informado"}`,
    `Atividade principal: ${result.mainActivity || "Nao informada"}`,
  ].join("\n");
}

async function requestJson(url, fallbackMessage) {
  let response;
  try {
    response = await fetch(url);
  } catch {
    throw new Error("Nao foi possivel conectar ao servidor. Verifique sua conexao com a internet.");
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.message || fallbackMessage);
  }
  return data;
}

export async function lookupCep(cep) {
  const data = await requestJson(buildBrasilCepUrl(cep), "CEP nao encontrado.");
  return normalizeCepResult(data);
}

export async function lookupCnpj(cnpj) {
  const data = await requestJson(buildBrasilCnpjUrl(cnpj), "CNPJ nao encontrado.");
  return normalizeCnpjResult(data);
}
