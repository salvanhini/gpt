// Cost tracking per model (USD per 1M tokens)
const MODEL_PRICES = {
  "qwen/qwen3.7-plus": { input: 0.4, output: 1.2 },
  "deepseek/deepseek-v4-pro": { input: 0.27, output: 1.1 },
};

const COST_STORAGE_KEY = "femicgpt:costs";

function readCosts() {
  try {
    return JSON.parse(localStorage.getItem(COST_STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeCosts(costs) {
  try {
    localStorage.setItem(COST_STORAGE_KEY, JSON.stringify(costs));
  } catch {
    // Storage failure should not break the app
  }
}

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function getMonthKey() {
  return new Date().toISOString().slice(0, 7);
}

function calculateCost(model, promptTokens, completionTokens) {
  const prices = MODEL_PRICES[model];
  if (!prices) return 0;
  const inputCost = (promptTokens / 1_000_000) * prices.input;
  const outputCost = (completionTokens / 1_000_000) * prices.output;
  return inputCost + outputCost;
}

export function trackCost(model, promptTokens, completionTokens) {
  const cost = calculateCost(model, promptTokens, completionTokens);
  const costs = readCosts();
  const today = getTodayKey();
  const month = getMonthKey();

  if (!costs[today]) {
    costs[today] = { total: 0, byModel: {}, noPriceModels: {} };
  }
  if (!costs[today].noPriceModels) costs[today].noPriceModels = {};
  costs[today].total += cost;
  costs[today].byModel[model] = (costs[today].byModel[model] || 0) + cost;
  if (!MODEL_PRICES[model]) costs[today].noPriceModels[model] = true;

  if (!costs[month]) {
    costs[month] = { total: 0, byModel: {}, noPriceModels: {} };
  }
  if (!costs[month].noPriceModels) costs[month].noPriceModels = {};
  costs[month].total += cost;
  costs[month].byModel[model] = (costs[month].byModel[model] || 0) + cost;
  if (!MODEL_PRICES[model]) costs[month].noPriceModels[model] = true;

  writeCosts(costs);
  return cost;
}

export function getDailyCost() {
  const costs = readCosts();
  const today = getTodayKey();
  return costs[today]?.total || 0;
}

export function getMonthlyCost() {
  const costs = readCosts();
  const month = getMonthKey();
  return costs[month]?.total || 0;
}

export function getDailyCostDetails() {
  const costs = readCosts();
  return costs[getTodayKey()] || { total: 0, byModel: {}, noPriceModels: {} };
}

export function getMonthlyCostDetails() {
  const costs = readCosts();
  return costs[getMonthKey()] || { total: 0, byModel: {}, noPriceModels: {} };
}

export function hasModelPrice(model) {
  return Boolean(MODEL_PRICES[model]);
}

export function getConversationCost(messages) {
  let total = 0;
  for (const msg of messages || []) {
    if (msg.meta?.promptTokens && msg.meta?.completionTokens) {
      const model = msg.meta?.model || "";
      total += calculateCost(model, msg.meta.promptTokens, msg.meta.completionTokens);
    }
  }
  return total;
}
