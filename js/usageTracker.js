const USAGE_KEY = "femicgpt:usage";

function getTodayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function getMonthKey(date = new Date()) {
  return date.toISOString().slice(0, 7);
}

function readUsage(storage = globalThis.localStorage) {
  try {
    return JSON.parse(storage.getItem(USAGE_KEY) || "{}") || {};
  } catch {
    return {};
  }
}

function writeUsage(usage, storage = globalThis.localStorage) {
  storage.setItem(USAGE_KEY, JSON.stringify(usage));
  return usage;
}

export function getDefaultUsageLimits() {
  return {
    tavilyDailyLimit: 30,
    braveDailyLimit: 25,
    groqTranscriptionDailyLimit: 20,
    e2bDailyLimit: 5,
    maxHistoryMessages: 12,
    tokenWarningLimit: 12000,
  };
}

export function normalizeUsageLimits(raw = {}, defaults = getDefaultUsageLimits()) {
  const limits = { ...defaults, ...(raw && typeof raw === "object" ? raw : {}) };
  return Object.fromEntries(
    Object.entries(defaults).map(([key, value]) => {
      const parsed = Number(limits[key]);
      return [key, Number.isFinite(parsed) && parsed >= 0 ? parsed : value];
    }),
  );
}

export function getUsageSnapshot(storage = globalThis.localStorage, now = new Date()) {
  const usage = readUsage(storage);
  return {
    dayKey: getTodayKey(now),
    monthKey: getMonthKey(now),
    daily: usage.daily?.[getTodayKey(now)] || {},
    monthly: usage.monthly?.[getMonthKey(now)] || {},
  };
}

export function incrementUsageCounter(counter, amount = 1, storage = globalThis.localStorage, now = new Date()) {
  const usage = readUsage(storage);
  const dayKey = getTodayKey(now);
  const monthKey = getMonthKey(now);
  usage.daily = usage.daily || {};
  usage.monthly = usage.monthly || {};
  usage.daily[dayKey] = usage.daily[dayKey] || {};
  usage.monthly[monthKey] = usage.monthly[monthKey] || {};
  usage.daily[dayKey][counter] = (Number(usage.daily[dayKey][counter]) || 0) + amount;
  usage.monthly[monthKey][counter] = (Number(usage.monthly[monthKey][counter]) || 0) + amount;
  writeUsage(usage, storage);
  return getUsageSnapshot(storage, now);
}

export function isLimitReached(counter, limit, storage = globalThis.localStorage, now = new Date()) {
  const parsedLimit = Number(limit);
  if (!Number.isFinite(parsedLimit) || parsedLimit <= 0) {
    return false;
  }

  const snapshot = getUsageSnapshot(storage, now);
  return (Number(snapshot.daily[counter]) || 0) >= parsedLimit;
}

export function getLimitStatus(counter, limit, storage = globalThis.localStorage, now = new Date()) {
  const parsedLimit = Number(limit);
  const used = Number(getUsageSnapshot(storage, now).daily[counter]) || 0;
  const ratio = parsedLimit > 0 ? used / parsedLimit : 0;
  return {
    used,
    limit: parsedLimit,
    ratio,
    warning: parsedLimit > 0 && ratio >= 0.8 && ratio < 1,
    reached: parsedLimit > 0 && ratio >= 1,
  };
}

export function resetUsage(storage = globalThis.localStorage) {
  writeUsage({}, storage);
}
