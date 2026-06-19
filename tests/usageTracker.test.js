import test from "node:test";
import assert from "node:assert/strict";

import {
  getLimitStatus,
  getUsageSnapshot,
  incrementUsageCounter,
  isLimitReached,
  normalizeUsageLimits,
  resetUsage,
} from "../js/usageTracker.js";

function createStorage() {
  const data = new Map();
  return {
    getItem: (key) => data.get(key) || null,
    setItem: (key, value) => data.set(key, value),
  };
}

test("usage tracker increments daily and monthly counters", () => {
  const storage = createStorage();
  const now = new Date("2026-06-19T12:00:00.000Z");

  incrementUsageCounter("webSearch.tavily", 1, storage, now);
  incrementUsageCounter("webSearch.tavily", 2, storage, now);

  const snapshot = getUsageSnapshot(storage, now);
  assert.equal(snapshot.daily["webSearch.tavily"], 3);
  assert.equal(snapshot.monthly["webSearch.tavily"], 3);
  assert.equal(isLimitReached("webSearch.tavily", 3, storage, now), true);
  assert.deepEqual(getLimitStatus("webSearch.tavily", 5, storage, now), {
    used: 3,
    limit: 5,
    ratio: 0.6,
    warning: false,
    reached: false,
  });

  resetUsage(storage);
  assert.equal(getUsageSnapshot(storage, now).daily["webSearch.tavily"], undefined);
});

test("normalizeUsageLimits repairs invalid values", () => {
  const limits = normalizeUsageLimits({
    tavilyDailyLimit: "12",
    braveDailyLimit: -1,
    maxHistoryMessages: "abc",
  });

  assert.equal(limits.tavilyDailyLimit, 12);
  assert.equal(limits.braveDailyLimit, 25);
  assert.equal(limits.maxHistoryMessages, 12);
});
