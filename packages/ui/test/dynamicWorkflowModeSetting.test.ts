// @vitest-environment jsdom
// DWG-22（docs/dynamic-workflow/launch.md「The user's choice」、docs/specs/selfhost-runtime.md「工作流」）：
// 常规设置里的动态工作流行。自维护版固定提供 alwaysOn，值与「默认」标签来自本地快照（提供 + 用户选择）；
// 选回默认值写空串删除选择。
import { createElement, type ReactNode } from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyDynamicWorkflowUserMode,
  createDynamicWorkflowClientConfig,
  TID_SETTINGS_DYNAMIC_WORKFLOW_MODE_TRIGGER,
  type DynamicWorkflowMode,
} from "@zcode/shared";
import {
  buildDynamicWorkflowModePatch,
  DynamicWorkflowModeSetting,
  resolveDynamicWorkflowModeSettingView,
} from "@/settings/DynamicWorkflowModeSetting.js";
import {
  resetDynamicWorkflowAvailabilityStoreForTests,
  useDynamicWorkflowAvailabilityStore,
} from "@/store/dynamicWorkflowAvailabilityStore.js";

const mocks = vi.hoisted(() => ({
  update: vi.fn(async (_patch: unknown) => undefined),
  toast: vi.fn(),
  onValueChange: undefined as ((value: string) => void) | undefined,
}));

vi.mock("@/hooks/useSettingService.js", () => ({
  useSettings: () => ({ settings: {}, update: mocks.update }),
}));
vi.mock("@/components/ui/toast.js", () => ({ toast: mocks.toast }));
vi.mock("@/logger.js", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("@/i18n/IntlProvider.js", () => ({
  useZCodeIntl: () => ({ intl: { formatMessage: ({ id }: { id: string }) => id } }),
}));
vi.mock("@/components/ui/select.js", () => ({
  Select: ({
    children,
    value,
    onValueChange,
  }: {
    children: ReactNode;
    value: string;
    onValueChange: (value: string) => void;
  }) => {
    mocks.onValueChange = onValueChange;
    return createElement("div", { "data-value": value, "data-testid": "select" }, children);
  },
  SelectTrigger: ({ children, ...props }: { children: ReactNode }) =>
    createElement("button", props, children),
  SelectValue: () => createElement("span"),
  SelectContent: ({
    children,
    position,
    className,
  }: {
    children: ReactNode;
    position?: string;
    className?: string;
  }) => createElement("div", { "data-position": position, className }, children),
  SelectRichItem: ({
    value,
    title,
    titleAdornment,
    description,
  }: {
    value: string;
    title: ReactNode;
    titleAdornment?: ReactNode;
    description?: ReactNode;
  }) =>
    createElement(
      "div",
      { "data-testid": `option-${value}` },
      createElement("span", { "data-part": "title" }, title),
      titleAdornment ? createElement("span", { "data-part": "tag" }, titleAdornment) : null,
      createElement("span", { "data-part": "description" }, description),
    ),
}));

function publish(offered: DynamicWorkflowMode, userMode?: DynamicWorkflowMode) {
  const config = applyDynamicWorkflowUserMode(
    createDynamicWorkflowClientConfig(offered, "remote"),
    userMode,
  );
  useDynamicWorkflowAvailabilityStore.setState({
    status: "ready",
    enabled: config.enabled,
    config,
  });
}

function taggedOptions(): string[] {
  return (["disabled", "onDemand", "alwaysOn"] as const).filter(
    (mode) => screen.getByTestId(`option-${mode}`).querySelector('[data-part="tag"]') !== null,
  );
}

describe("DynamicWorkflowModeSetting（DWG-22）", () => {
  beforeEach(() => {
    mocks.update.mockReset();
    mocks.update.mockResolvedValue(undefined);
    mocks.toast.mockReset();
    mocks.onValueChange = undefined;
  });
  afterEach(() => {
    cleanup();
    resetDynamicWorkflowAvailabilityStoreForTests();
  });

  it("初始快照即提供 alwaysOn（不经过加载态），快照变成未提供时整行收起", () => {
    const { container, rerender } = render(createElement(DynamicWorkflowModeSetting));
    expect(screen.getByTestId("select").getAttribute("data-value")).toBe("alwaysOn");
    expect(taggedOptions()).toEqual(["alwaysOn"]);

    act(() =>
      useDynamicWorkflowAvailabilityStore.setState({
        status: "ready",
        enabled: false,
        config: null,
      }),
    );
    rerender(createElement(DynamicWorkflowModeSetting));
    expect(container.innerHTML).toBe("");
  });

  it("未选择时显示服务端提供的模式且默认标签只在它上面", () => {
    act(() => publish("alwaysOn"));
    render(createElement(DynamicWorkflowModeSetting));
    expect(screen.getByTestId("select").getAttribute("data-value")).toBe("alwaysOn");
    expect(taggedOptions()).toEqual(["alwaysOn"]);
    expect(screen.getByTestId(TID_SETTINGS_DYNAMIC_WORKFLOW_MODE_TRIGGER)).toBeTruthy();
    expect(
      screen.getByTestId("option-onDemand").querySelector('[data-part="description"]')?.textContent,
    ).toBe("settings.dynamicWorkflow.option.onDemand.description");
  });

  it("用户选择生效时显示生效值，标签仍在服务端提供的模式上", () => {
    act(() => publish("alwaysOn", "disabled"));
    render(createElement(DynamicWorkflowModeSetting));
    expect(screen.getByTestId("select").getAttribute("data-value")).toBe("disabled");
    expect(taggedOptions()).toEqual(["alwaysOn"]);
  });

  it("选其它模式写入该模式，选回默认写空串删除选择；Host 结果回来前先显示所选值", async () => {
    act(() => publish("alwaysOn"));
    render(createElement(DynamicWorkflowModeSetting));

    await act(async () => mocks.onValueChange?.("onDemand"));
    expect(mocks.update).toHaveBeenLastCalledWith({ dynamicWorkflowMode: "onDemand" });
    expect(screen.getByTestId("select").getAttribute("data-value")).toBe("onDemand");

    act(() => publish("alwaysOn", "onDemand"));
    await act(async () => mocks.onValueChange?.("alwaysOn"));
    expect(mocks.update).toHaveBeenLastCalledWith({ dynamicWorkflowMode: "" });
  });

  it("写入失败：回到 Host 快照里的值并提示", async () => {
    mocks.update.mockRejectedValueOnce(new Error("disk full"));
    act(() => publish("onDemand"));
    render(createElement(DynamicWorkflowModeSetting));

    await act(async () => mocks.onValueChange?.("disabled"));
    await waitFor(() =>
      expect(screen.getByTestId("select").getAttribute("data-value")).toBe("onDemand"),
    );
    expect(mocks.toast).toHaveBeenCalledWith("settings.dynamicWorkflow.saveError");
  });

  it("纯函数：视图与补丁", () => {
    expect(
      resolveDynamicWorkflowModeSettingView({ status: "loading", enabled: false, config: null }),
    ).toBeNull();
    const config = applyDynamicWorkflowUserMode(
      createDynamicWorkflowClientConfig("onDemand", "override"),
      "alwaysOn",
    );
    expect(
      resolveDynamicWorkflowModeSettingView({ status: "ready", enabled: true, config }),
    ).toEqual({ value: "alwaysOn", offeredMode: "onDemand" });
    // 旧 Host 的快照没有 offeredMode：它不认用户选择，行不出现。
    const legacy = {
      mode: "alwaysOn",
      enabled: true,
      source: "remote",
    } as unknown as typeof config;
    expect(
      resolveDynamicWorkflowModeSettingView({ status: "ready", enabled: true, config: legacy }),
    ).toBeNull();
    expect(buildDynamicWorkflowModePatch("onDemand", "onDemand")).toEqual({
      dynamicWorkflowMode: "",
    });
    expect(buildDynamicWorkflowModePatch("disabled", "onDemand")).toEqual({
      dynamicWorkflowMode: "disabled",
    });
  });
});
