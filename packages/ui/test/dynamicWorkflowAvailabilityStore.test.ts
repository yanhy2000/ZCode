// 动态工作流能力快照在 renderer 的唯一副本（docs/specs/selfhost-runtime.md「工作流」）：
// 自维护版固定提供 alwaysOn，快照 = 本地「提供」+ 设置里的用户选择，不再有加载/失败态。
import { afterEach, describe, expect, it } from "vitest";
import {
  resetDynamicWorkflowAvailabilityStoreForTests,
  useDynamicWorkflowAvailabilityStore,
} from "@/store/dynamicWorkflowAvailabilityStore.js";

describe("dynamicWorkflowAvailabilityStore", () => {
  afterEach(() => {
    resetDynamicWorkflowAvailabilityStoreForTests();
  });

  it("初始快照即为 ready + alwaysOn：本地固定提供，入口不会先闪一下再收起", () => {
    const state = useDynamicWorkflowAvailabilityStore.getState();
    expect(state.status).toBe("ready");
    expect(state.enabled).toBe(true);
    expect(state.config).toMatchObject({
      mode: "alwaysOn",
      offeredMode: "alwaysOn",
      source: "default",
    });
  });

  it("applyUserMode 立即把设置里的选择套进快照（修复切页后仍显示「始终开启」）", () => {
    useDynamicWorkflowAvailabilityStore.getState().applyUserMode("disabled");
    expect(useDynamicWorkflowAvailabilityStore.getState()).toMatchObject({
      enabled: false,
      userMode: "disabled",
      config: { mode: "disabled", offeredMode: "alwaysOn", userMode: "disabled" },
    });

    useDynamicWorkflowAvailabilityStore.getState().applyUserMode("onDemand");
    expect(useDynamicWorkflowAvailabilityStore.getState()).toMatchObject({
      enabled: true,
      userMode: "onDemand",
      config: { mode: "onDemand", offeredMode: "alwaysOn" },
    });
  });

  it("load / refresh / reload 重算后保留最近一次的用户选择", async () => {
    const store = useDynamicWorkflowAvailabilityStore.getState();
    store.applyUserMode("onDemand");

    await store.ensureLoaded();
    await store.refresh();
    await store.reload();

    expect(useDynamicWorkflowAvailabilityStore.getState()).toMatchObject({
      enabled: true,
      userMode: "onDemand",
      config: { mode: "onDemand", offeredMode: "alwaysOn" },
    });
  });

  it("选择被删除（跟随默认）后回到 alwaysOn", () => {
    const store = useDynamicWorkflowAvailabilityStore.getState();
    store.applyUserMode("disabled");
    store.applyUserMode(undefined);

    expect(useDynamicWorkflowAvailabilityStore.getState()).toMatchObject({
      enabled: true,
      userMode: undefined,
      config: { mode: "alwaysOn", offeredMode: "alwaysOn" },
    });
  });
});
