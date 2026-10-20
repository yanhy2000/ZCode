// @vitest-environment jsdom
import { createElement } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ProjectSidebarNavigation } from "@/project-sidebar/ProjectSidebarNavigation.js";

vi.mock("@/NewTaskButtonGroup.js", () => ({ NewTaskButtonGroup: () => null }));
vi.mock("@/i18n/IntlProvider.js", () => ({
  useZCodeIntl: () => ({ intl: { formatMessage: ({ id }: { id: string }) => id } }),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it("SBV03: 桌面壳渲染自动化与插件市场入口", () => {
  render(
    createElement(ProjectSidebarNavigation, {
      props: { onOpenAutomations: vi.fn(), onOpenPluginStore: vi.fn() },
      onCreate: vi.fn(),
    }),
  );
  expect(screen.queryByTestId("automations-open")).not.toBeNull();
  expect(screen.queryByTestId("plugin-store-sidebar-open")).not.toBeNull();
});

it("SBV04: 手机远控壳隐藏自动化与插件市场入口", () => {
  // 修复依据：WorkspaceShellLayout 的 automations / plugin-store 主视图分支都带
  // !isWebRemoteControlShell，手机壳点这些入口只会切到空视图（用户反馈“打不开”）。
  render(
    createElement(ProjectSidebarNavigation, {
      props: {
        isWebRemoteControl: true,
        onOpenAutomations: vi.fn(),
        onOpenPluginStore: vi.fn(),
      },
      onCreate: vi.fn(),
    }),
  );
  expect(screen.queryByTestId("automations-open")).toBeNull();
  expect(screen.queryByTestId("plugin-store-sidebar-open")).toBeNull();
});
