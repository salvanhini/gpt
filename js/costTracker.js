// Cost tracking per model (USD per 1M tokens)
const MODEL_PRICES = {
  // OpenRouter models
  "qwen/qwen3.7-plus": { input: 0.4, output: 1.2 },
  "deepseek/deepseek-v4-pro": { input: 0.27, output: 1.1 },

  // DeepSeek models
  "deepseek-v4-flash": { input: 0.14, output: 0.28 },
  "deepseek-v4-pro": { input: 0.27, output: 1.1 },
  "deepseek-chat": { input: 0.14, output: 0.28 },
  "deepseek-reasoner": { input: 0.55, output: 2.19 },

  // Groq models (free tier - $0)
  "openai/gpt-oss-20b": { input: 0, output: 0 },
  "openai/gpt-oss-120b": { input: 0, output: 0 },

  // Qwen DashScope models
  "qwen-plus": { input: 0.08, output: 0.24 },
  "qwen-max": { input: 0.4, output: 1.2 },
  "qwen-flash": { input: 0.02, output: 0.06 },
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
  const prices = MODEL_PRICES[model] || { input: 0, output: 0 };
  const inputCost = (promptTokens / 1_000_000) * prices.input;
  const outputCost = (completionTokens / 1_000_000) * prices.output;
  return inputCost + outputCost;
}

export function trackCost(model, promptTokens, completionTokens) {
  const cost = calculateCost(model, promptTokens, completionTokens);
  if (cost === 0) return 0;

  const costs = readCosts();
  const today = getTodayKey();
  const month = getMonthKey();

  if (!costs[today]) {
    costs[today] = { total: 0, byModel: {} };
  }
  costs[today].total += cost;
  costs[today].byModel[model] = (costs[today].byModel[model] || 0) + cost;

  if (!costs[month]) {
    costs[month] = { total: 0, byModel: {} };
  }
  costs[month].total += cost;
  costs[month].byModel[model] = (costs[month].byModel[model] || 0) + cost;

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
