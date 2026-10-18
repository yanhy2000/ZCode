// @vitest-environment jsdom
// docs/specs/selfhost-runtime.md「工作流」：设置里的选择变化后，Root 先按最新选择重算本地快照，
// 再让 Host 重发策略并重读快照；首次读到的值只是基线，不发信号。多次变化按顺序串行。
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DynamicWorkflowMode } from "@zcode/shared";
import { useDynamicWorkflowUserModeSync } from "@/hooks/useDynamicWorkflowAvailability.js";
import {
  resetDynamicWorkflowAvailabilityStoreForTests,
  useDynamicWorkflowAvailabilityStore,
} from "@/store/dynamicWorkflowAvailabilityStore.js";

vi.mock("@/logger.js", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

function setup() {
  const syncMock = vi.fn(async (_params: { mode?: DynamicWorkflowMode }) => undefined);
  const hook = renderHook(
    (props: { settingsLoaded: boolean; userMode: DynamicWorkflowMode | undefined }) =>
      useDynamicWorkflowUserModeSync({
        ...props,
        zcodeAgentService: { syncDynamicWorkflowUserMode: syncMock },
      }),
    { initialProps: { settingsLoaded: false, userMode: undefined } },
  );
  return { hook, syncMock };
}

describe("useDynamicWorkflowUserModeSync", () => {
  afterEach(() => {
    cleanup();
    resetDynamicWorkflowAvailabilityStoreForTests();
  });

  it("设置未加载时不改快照、不发信号", () => {
    const { hook, syncMock } = setup();
    hook.rerender({ settingsLoaded: false, userMode: "disabled" });

    expect(syncMock).not.toHaveBeenCalled();
    expect(useDynamicWorkflowAvailabilityStore.getState().config?.mode).toBe("alwaysOn");
  });

  it("首次读到的值只是基线：写进快照但不发信号", () => {
    const { hook, syncMock } = setup();
    hook.rerender({ settingsLoaded: true, userMode: "onDemand" });

    expect(syncMock).not.toHaveBeenCalled();
    expect(useDynamicWorkflowAvailabilityStore.getState()).toMatchObject({
      enabled: true,
      config: { mode: "onDemand", offeredMode: "alwaysOn" },
    });
  });

  it("选择变化：先重算快照，再让 Host 重发策略并重读；回到跟随时发不带 mode 的信号", async () => {
    const { hook, syncMock } = setup();
    hook.rerender({ settingsLoaded: true, userMode: undefined });
    hook.rerender({ settingsLoaded: true, userMode: "disabled" });

    expect(useDynamicWorkflowAvailabilityStore.getState().enabled).toBe(false);
    await waitFor(() => expect(syncMock).toHaveBeenCalledWith({ mode: "disabled" }));

    hook.rerender({ settingsLoaded: true, userMode: undefined });
    await waitFor(() => expect(syncMock).toHaveBeenLastCalledWith({}));
    expect(useDynamicWorkflowAvailabilityStore.getState()).toMatchObject({
      enabled: true,
      config: { mode: "alwaysOn", offeredMode: "alwaysOn" },
    });
  });

  it("连续两次变化串行：第二次信号在第一次完成后才发", async () => {
    const { hook, syncMock } = setup();
    let releaseFirst: (() => void) | undefined;
    syncMock.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          releaseFirst = resolve;
        }),
    );

    hook.rerender({ settingsLoaded: true, userMode: undefined });
    hook.rerender({ settingsLoaded: true, userMode: "disabled" });
    await waitFor(() => expect(syncMock).toHaveBeenCalledTimes(1));

    hook.rerender({ settingsLoaded: true, userMode: "onDemand" });
    await Promise.resolve();
    expect(syncMock).toHaveBeenCalledTimes(1);

    releaseFirst?.();
    await waitFor(() => expect(syncMock).toHaveBeenCalledTimes(2));
    expect(syncMock).toHaveBeenLastCalledWith({ mode: "onDemand" });
    expect(useDynamicWorkflowAvailabilityStore.getState().config?.mode).toBe("onDemand");
  });

  it("Host 同步失败也不回滚显示：快照仍按本地选择", async () => {
    const { hook, syncMock } = setup();
    syncMock.mockRejectedValueOnce(new Error("host gone"));

    hook.rerender({ settingsLoaded: true, userMode: undefined });
    hook.rerender({ settingsLoaded: true, userMode: "disabled" });

    await waitFor(() => expect(syncMock).toHaveBeenCalledTimes(1));
    expect(useDynamicWorkflowAvailabilityStore.getState()).toMatchObject({
      enabled: false,
      config: { mode: "disabled" },
    });
  });
});
