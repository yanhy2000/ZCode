import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppUsageSnapshot } from "@zcode/shared";
import type { IZCodeAgentService } from "../src/zcode-agent/zcodeAgent.js";
import { createUsageStatsService } from "../src/usage-stats/usageStatsService.js";

function createAppUsageSnapshot(): AppUsageSnapshot {
  return {
    range: "30d",
    generatedAt: 1_900_000_000_000,
    timeZone: "UTC",
    source: "agent-db",
    summary: {
      totalTokens: 104,
      inputTokens: 14,
      outputTokens: 5,
      reasoningTokens: 0,
      cacheCreationTokens: 5,
      cacheReadTokens: 80,
      cacheHitRate: 0.8,
      totalSessions: 1,
      totalTurns: 1,
      toolCallCount: 2,
      toolErrorRate: 0.5,
      modelErrorRate: 0.5,
      avgTimeToFirstTokenMs: 100,
      avgTurnDurationMs: 2000,
      activeDays: 2,
      currentStreakDays: 2,
      longestSessionMs: 2000,
      longestStreakDays: 2,
      peakDayTokens: 104,
      favoriteModel: { modelId: "model-a", totalTokens: 104, share: 1 },
    },
    heatmap: { startDate: null, endDate: null, maxTokens: 100, weeks: [] },
    dailyModelUsage: [],
    models: [],
    tools: [],
  };
}

function createUsageStatsServiceForTest(params: {
  getAppUsageStats: IZCodeAgentService["getAppUsageStats"];
}) {
  return createUsageStatsService({
    // App Usage 只读取 agent 数据库（model_usage/turn_usage/tool_usage）经协议返回的统计。
    zcodeAgentService: {
      getAppUsageStats: params.getAppUsageStats,
    },
  });
}

describe("createUsageStatsService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("App Usage 经 ZCode Protocol 读取 agent 数据库统计", async () => {
    const getAppUsageStats = vi.fn(async () => createAppUsageSnapshot());
    const service = createUsageStatsServiceForTest({ getAppUsageStats });

    const snapshot = await service.getAppUsageSnapshot({
      range: "30d",
      timeZone: "UTC",
    });

    // App Usage 不走 monitor HTTP，只走 agent 协议。
    expect(getAppUsageStats).toHaveBeenCalledWith({
      range: "30d",
      timeZone: "UTC",
    });
    expect(snapshot.source).toBe("agent-db");
    expect(snapshot.summary.totalSessions).toBe(1);
    expect(snapshot.summary.totalTokens).toBe(104);
  });

  it("App Usage 全量概览用 all range 透传到 agent 数据库统计", async () => {
    const getAppUsageStats = vi.fn(async () => ({
      ...createAppUsageSnapshot(),
      range: "all",
    }));
    const service = createUsageStatsServiceForTest({ getAppUsageStats });

    const snapshot = await service.getAppUsageSnapshot({
      range: "all",
      timeZone: "Asia/Shanghai",
    });

    expect(getAppUsageStats).toHaveBeenCalledWith({
      range: "all",
      timeZone: "Asia/Shanghai",
    });
    expect(snapshot.range).toBe("all");
  });
});
