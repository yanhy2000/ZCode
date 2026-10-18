import { describe, expect, it } from "vitest";
import {
  HIGHSPEED_PROVIDER_IDS,
  highspeedMessageMetaSchema,
  isHighspeedProviderId,
} from "../src/highspeed.js";

// 自维护版已移除 Highspeed（加速卡）功能；schema 只为历史消息与 CLI 协议兼容保留。
describe("Highspeed message metadata contract", () => {
  it("keeps persisted message metadata strict and versioned", () => {
    const metadata = {
      schemaVersion: 1,
      cardId: "hsc-1",
      taskId: "task-1",
      provider: "zai",
      model: "glm-5",
      issuedAt: 1_000,
      expiresAt: 10_000,
      regularTps: 73.5,
      outputTokens: 120_000,
      durationMs: 881_000,
      highspeedTps: 90,
      savedDurationMs: 751_653,
      modelDurationMs: 700_000,
      toolDurationMs: 120_000,
      otherDurationMs: 61_000,
    };

    expect(highspeedMessageMetaSchema.parse(metadata)).toEqual(metadata);
    expect(() => highspeedMessageMetaSchema.parse({ ...metadata, cardId: "" })).toThrow();
    expect(() => highspeedMessageMetaSchema.parse({ ...metadata, regularTps: 0 })).toThrow();
    expect(() => highspeedMessageMetaSchema.parse({ ...metadata, savedDurationMs: -1 })).toThrow();
    expect(() => highspeedMessageMetaSchema.parse({ ...metadata, extra: true })).toThrow();
  });
});

// 加速卡功能面已移除；这两个导出是 CLI（独立 workspace，经 junction 直接引用根 shared）
// 的兼容契约，值不得变化，否则 CLI 的 session-store / fork / 队列提升测试会失败。
describe("Highspeed provider compatibility guard", () => {
  it("keeps the family map and predicate for CLI compatibility", () => {
    expect(HIGHSPEED_PROVIDER_IDS).toEqual({
      zai: "account:zai-highspeed-card",
      bigmodel: "account:bigmodel-highspeed-card",
    });
    expect(isHighspeedProviderId(HIGHSPEED_PROVIDER_IDS.zai)).toBe(true);
    expect(isHighspeedProviderId(HIGHSPEED_PROVIDER_IDS.bigmodel)).toBe(true);
    expect(isHighspeedProviderId("builtin:zai-coding-plan")).toBe(false);
    expect(isHighspeedProviderId(undefined)).toBe(false);
  });
});
