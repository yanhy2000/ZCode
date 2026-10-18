import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { WorkspaceSidebarFooter } from "@/WorkspaceSidebarFooter.js";

// 说明：本文件原先还覆盖「侧边栏底部方案徽标 / Coding Plan 用量来源解析」，那部分被测导出
// （resolveSidebarFooterProfilePlanBadge / resolveSidebarFooterPlanBadgeLabel /
// WorkspaceSidebarFooterPlanBadge / resolveSidebarCurrentCodingPlanUsageSource）已随商业面
// 清理删除，对应用例随之移除；这里只保留仍存在的远控触发、缩放子菜单、帮助与偏好分组行为。

vi.mock("@/ControlHintTooltip.js", () => ({
  ControlHintTooltip: ({ children, title }: { children: unknown; title: string }) =>
    createElement("span", { "data-tooltip-title": title }, children),
}));

vi.mock("@/WorkspaceWebRemoteControlTrigger.js", () => ({
  WorkspaceWebRemoteControlTrigger: () =>
    createElement("button", {
      "data-testid": "web-remote-control-trigger",
    }),
}));

vi.mock("@/hooks/usePlatform.js", () => ({
  usePlatform: () => ({
    executeDesktopCommand: vi.fn(),
    getDesktopZoomLevel: () => Promise.resolve({ zoomLevel: 0 }),
    onDesktopZoomLevelChanged: () => () => {},
    openExternal: vi.fn(),
  }),
}));

vi.mock("@/i18n/IntlProvider.js", () => ({
  useZCodeIntl: () => ({
    locale: "zh-CN",
    intl: {
      formatMessage: ({ id }: { id: string }) => id,
    },
  }),
}));

vi.mock("@/store/StoreProvider.js", () => ({
  useZCodeStore: (
    selector: (state: { interfaceMode: string; setInterfaceMode: () => void }) => unknown,
  ) => selector({ interfaceMode: "coding", setInterfaceMode: vi.fn() }),
}));

// 快捷键 label 走 useSettings 的共享快照（WorkspaceSidebarFooter -> useShortcutCommandLabel），
// 这里给一个无覆盖的静态设置，避免渲染路径落到真实 ServiceProvider 上。
vi.mock("@/hooks/useSettingService.js", () => ({
  useSettings: () => ({ settings: { shortcutBindings: undefined }, update: vi.fn() }),
}));

describe("WorkspaceSidebarFooter web remote control tooltip", () => {
  it("renders a preferences trigger instead of profile identity", () => {
    const html = renderToStaticMarkup(
      createElement(WorkspaceSidebarFooter, {
        theme: "dark",
        localeMenuValue: "zh-CN",
        onLocaleChange: () => {},
        onThemeChange: () => {},
        onSettingsButtonClick: () => {},
      }),
    );

    expect(html).toContain("sidebar.profile.preferences");
    expect(html).toContain('data-testid="login-trigger"');
    expect(html).not.toContain("sidebar.profile.notLoggedIn");
    expect(html).not.toContain("profile-menu-header");
  });

  it("does not wrap the remote control trigger in a second tooltip", () => {
    const html = renderToStaticMarkup(
      createElement(WorkspaceSidebarFooter, {
        theme: "dark",
        localeMenuValue: "zh-CN",
        onLocaleChange: () => {},
        onThemeChange: () => {},
        onSettingsButtonClick: () => {},
        workspacePath: "/tmp/project",
        isDesktop: true,
      }),
    );

    expect(html).toContain('data-testid="web-remote-control-trigger"');
    expect(html).not.toContain('data-tooltip-title="webRemoteControl.trigger"');
  });

  it("shows desktop zoom commands under an interface zoom submenu", () => {
    const source = readFileSync(
      resolve(process.cwd(), "packages/ui/src/WorkspaceSidebarFooter.tsx"),
      "utf8",
    );

    expect(source).toContain("{isDesktop ? (");
    expect(source).toContain('id: "sidebar.settings.interfaceZoom"');
    expect(source).toContain("<DropdownMenuSubContent");
    expect(source).toContain("DesktopCommandIds.ZoomIn");
    expect(source).toContain("DesktopCommandIds.ZoomOut");
    expect(source).toContain("DesktopCommandIds.ResetZoom");
    expect(source).toContain('id: "titleBar.menu.view.zoomIn"');
    expect(source).toContain('id: "titleBar.menu.view.zoomOut"');
    expect(source).toContain('id: "titleBar.menu.view.actualSize"');
  });

  it("keeps the interface zoom submenu gated to desktop mode", () => {
    const source = readFileSync(
      resolve(process.cwd(), "packages/ui/src/WorkspaceSidebarFooter.tsx"),
      "utf8",
    );

    expect(source).toContain("{isDesktop ? (");
    expect(source).toContain(") : null}");
  });

  it("keeps preferences grouped as language theme zoom usage", () => {
    const source = readFileSync(
      resolve(process.cwd(), "packages/ui/src/WorkspaceSidebarFooter.tsx"),
      "utf8",
    );

    const localeIndex = source.indexOf('id: "settings.locale"');
    const themeIndex = source.indexOf('id: "settings.themeMode"');
    const zoomIndex = source.indexOf('id: "sidebar.settings.interfaceZoom"');
    const usageIndex = source.indexOf("<WorkspaceSidebarFooterUsageSummaryContent");

    expect(localeIndex).toBeGreaterThan(-1);
    expect(themeIndex).toBeGreaterThan(localeIndex);
    expect(zoomIndex).toBeGreaterThan(themeIndex);
    expect(usageIndex).toBeGreaterThan(zoomIndex);
    expect(source).not.toContain('id: "app.login"');
    expect(source).not.toContain('id: "app.logout"');
    expect(source).not.toContain('id: "rewards.menuTitle"');
    expect(source).not.toContain("<WorkspaceSidebarFooterPlanBadge");
  });

  it("does not render an upgrade entry inside the footer summary", () => {
    const footerSource = readFileSync(
      resolve(process.cwd(), "packages/ui/src/WorkspaceSidebarFooter.tsx"),
      "utf8",
    );
    const summarySource = readFileSync(
      resolve(process.cwd(), "packages/ui/src/WorkspaceSidebarFooterUsageSummary.tsx"),
      "utf8",
    );

    expect(footerSource).toContain("onUsageClick={usageButtonClick}");
    expect(summarySource).toContain("<DropdownMenuSeparator />");
    // 用量入口文案 id 现为 sidebar.usage.openStats（旧的 sidebar.usage.plan.openStats 已随方案面清理）。
    expect(summarySource).toContain("sidebar.usage.openStats");
    expect(summarySource).toContain("setPendingSettingsUsageIntent();");
    expect(summarySource).toContain("onUsageClick?.();");
    expect(summarySource).not.toContain("onUpgradeClick");
    expect(summarySource).not.toContain("sidebar.usage.plan.upgrade");
    expect(summarySource).not.toContain("sidebar-coding-plan-upgrade-button");
    expect(summarySource).not.toContain("<CodingPlanUsageRemainingPanel");
  });

  it("keeps settings-page usage stats separate from the back button", () => {
    const footerSource = readFileSync(
      resolve(process.cwd(), "packages/ui/src/WorkspaceSidebarFooter.tsx"),
      "utf8",
    );
    const settingsSource = readFileSync(
      resolve(process.cwd(), "packages/ui/src/SettingsPage.tsx"),
      "utf8",
    );

    expect(footerSource).toContain("onUsageClick,");
    expect(footerSource).toContain(
      "const usageButtonClick = onUsageClick ?? onSettingsButtonClick;",
    );
    expect(footerSource).toContain("onUsageClick={usageButtonClick}");
    expect(settingsSource).toContain("const handleOpenUsageSettings = useCallback(() => {");
    expect(settingsSource).toContain('setActiveSettingsSection("usage");');
    expect(settingsSource).toContain("onSettingsButtonClick={onBack}");
    expect(settingsSource).toContain("onUsageClick={handleOpenUsageSettings}");
  });

  it("keeps duplicated help actions out of the profile menu", () => {
    const source = readFileSync(
      resolve(process.cwd(), "packages/ui/src/WorkspaceSidebarFooter.tsx"),
      "utf8",
    );

    expect(source).not.toContain('id: "titleBar.menu.help.feedback"');
    expect(source).not.toContain('id: "sidebar.menu.community"');
    expect(source).not.toContain('id: "titleBar.menu.help.exportLogs"');
    expect(source).not.toContain("<DropdownMenuItem onSelect={onSettingsButtonClick}>");
    expect(source).not.toContain("runExportLogsAction");
  });

  it("keeps usage entry mounted across preferences menu toggles", () => {
    const source = readFileSync(
      resolve(process.cwd(), "packages/ui/src/WorkspaceSidebarFooter.tsx"),
      "utf8",
    );

    // 此用例验证菜单保持挂载，不应绑定会随国际化文案调整的宽度。
    expect(source).toMatch(/<DropdownMenuContent\b[^>]*\bforceMount\s*>/);
    expect(source).toContain("<WorkspaceSidebarFooterUsageSummaryContent");
    expect(source).not.toContain("enabled={preferencesMenuOpen}");
  });

  it("does not mount plan badges or usage summary state in the footer", () => {
    const source = readFileSync(
      resolve(process.cwd(), "packages/ui/src/WorkspaceSidebarFooter.tsx"),
      "utf8",
    );

    expect(source).not.toContain("useWorkspaceSidebarFooterUsageSummaryState");
    expect(source).not.toContain("<WorkspaceSidebarFooterPlanBadge");
    expect(source).not.toContain("state={usageSummaryState}");
  });
});
