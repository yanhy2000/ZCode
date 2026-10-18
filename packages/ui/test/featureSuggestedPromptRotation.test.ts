import { afterEach, describe, expect, it } from "vitest";
import {
  advanceRecommendedPromptPane,
  getRecommendedPromptsForPane,
  registerRecommendedPromptPane,
  unregisterRecommendedPromptPane,
} from "@/v4/featureSuggestedPromptRotation.js";

const paneIds = ["rotation-first", "rotation-second"];

afterEach(() => {
  for (const id of paneIds) unregisterRecommendedPromptPane(id);
});

describe("active task recommendations", () => {
  it("replaces all three visible office recommendations when refreshing", () => {
    registerRecommendedPromptPane(paneIds[0]!, "office");

    for (let refresh = 0; refresh < 6; refresh += 1) {
      const previous = getRecommendedPromptsForPane(paneIds[0]!, "office");
      advanceRecommendedPromptPane(paneIds[0]!);
      const next = getRecommendedPromptsForPane(paneIds[0]!, "office");

      expect(next).toHaveLength(3);
      expect(
        next.every((item) => !previous.some((shown) => shown.id === item.id)),
      ).toBe(true);
      expect(new Set(next.map((item) => item.iconUrl)).size).toBe(3);
    }
  });

  // 修复原因：闲时（idle-time）编码推荐已随商业面移除，coding 池只剩 terminal / gitlab /
  // browser-use 三类图标。两个 pane 各要 3 个「同屏图标不重复」的槽位（共 6 个）已超出池内
  // 3 类图标的供给，跨 pane 完全避重不再可满足。断言改为对齐当前算法真正保证的口径：
  // 同屏无重复任务、首个 pane 图标多样、跨 pane 至多兜底复用 1 个任务、换批全部换新。
  it("keeps each coding pane unique while preferring unseen tasks across panes", () => {
    registerRecommendedPromptPane(paneIds[0]!, "coding");
    registerRecommendedPromptPane(paneIds[1]!, "coding");

    const first = getRecommendedPromptsForPane(paneIds[0]!, "coding");
    const second = getRecommendedPromptsForPane(paneIds[1]!, "coding");
    expect(first).toHaveLength(3);
    expect(second).toHaveLength(3);
    // 同屏内不出现重复任务。
    expect(new Set(first.map((item) => item.id)).size).toBe(3);
    expect(new Set(second.map((item) => item.id)).size).toBe(3);
    // 首个 pane 仍能拿到三种不同图标，保证同屏视觉多样。
    expect(new Set(first.map((item) => item.iconUrl)).size).toBe(3);
    // 跨 pane 优先展示未出现过的任务；仅当编码池图标/插件耗尽时才兜底复用，至多 1 个。
    const overlappingWithFirst = (items: typeof first) =>
      items.filter((item) => first.some((shown) => shown.id === item.id));
    expect(overlappingWithFirst(second).length).toBeLessThanOrEqual(1);

    advanceRecommendedPromptPane(paneIds[0]!);
    const refreshed = getRecommendedPromptsForPane(paneIds[0]!, "coding");
    expect(refreshed).toHaveLength(3);
    expect(new Set(refreshed.map((item) => item.id)).size).toBe(3);
    // 换一批同样优先全部换新，兜底复用不超过 1 个，且不会原样重复上一批。
    expect(overlappingWithFirst(refreshed).length).toBeLessThanOrEqual(1);
    expect(refreshed.map((item) => item.id)).not.toEqual(
      first.map((item) => item.id),
    );
  });
});
