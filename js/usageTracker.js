const STORAGE_KEY = "femicgpt:usage";

const LIMITES_PADRAO = {
  tavily: { diario: 30, mensal: 900 },
  brave: { diario: 65, mensal: 1900 },
  groqTranscription: { diario: 20, mensal: 600 },
  e2b: { diario: 5, mensal: 100 },
  falai: { diario: 50, mensal: 1500 },
  textMessages: { diario: 200, mensal: 6000 },
};

function ler() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") || {};
  } catch {
    return {};
  }
}

function escrever(dados) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dados));
  } catch {
    // Falha de armazenamento nao deve quebrar o chat
  }
}

function hoje() {
  return new Date().toISOString().slice(0, 10);
}

function esteMes() {
  return new Date().toISOString().slice(0, 7);
}

export function incrementUsage(servico) {
  const dados = ler();
  const dia = hoje();
  const mes = esteMes();

  if (!dados.daily) dados.daily = {};
  if (!dados.monthly) dados.monthly = {};

  dados.daily[dia] = dados.daily[dia] || {};
  dados.daily[dia][servico] = (dados.daily[dia][servico] || 0) + 1;

  dados.monthly[mes] = dados.monthly[mes] || {};
  dados.monthly[mes][servico] = (dados.monthly[mes][servico] || 0) + 1;

  escrever(dados);
}

export function getDailyUsage(servico) {
  const dados = ler();
  return dados.daily?.[hoje()]?.[servico] || 0;
}

export function getMonthlyUsage(servico) {
  const dados = ler();
  return dados.monthly?.[esteMes()]?.[servico] || 0;
}

export function getAllUsage() {
  const dados = ler();
  return {
    daily: dados.daily?.[hoje()] || {},
    monthly: dados.monthly?.[esteMes()] || {},
  };
}

function getLimits() {
  return { ...LIMITES_PADRAO };
}

export function checkLimit(servico) {
  const limites = getLimits();
  const limite = limites[servico];
  if (!limite) return { ok: true, usado: 0, maximo: 0, percentual: 0 };

  const diario = getDailyUsage(servico);
  const mensal = getMonthlyUsage(servico);
  const pctDiario = limite.diario > 0 ? Math.round((diario / limite.diario) * 100) : 0;
  const pctMensal = limite.mensal > 0 ? Math.round((mensal / limite.mensal) * 100) : 0;
  const pct = Math.max(pctDiario, pctMensal);

  return {
    ok: diario < limite.diario && mensal < limite.mensal,
    bloqueado: diario >= limite.diario || mensal >= limite.mensal,
    aviso: pct >= 80 && pct < 100,
    usado: diario,
    maximo: limite.diario,
    mensalUsado: mensal,
    mensalMaximo: limite.mensal,
    percentual: pct,
  };
}
