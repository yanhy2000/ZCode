import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("workspace main view drag region", () => {
  it("keeps a desktop-only drag strip when automations or plugins hide WorkspaceHeader", () => {
    const layoutSource = readSource(
      "packages/ui/src/app-shell/WorkspaceShellLayout.tsx",
    );
    const frameSource = readSource(
      "packages/ui/src/settings/AutomationsMainBreadcrumbFrame.tsx",
    );

    // 断言语义不绑定排版：条件可被格式化换行。
    expect(layoutSource).toMatch(
      /workspaceMainView !== "automations"\s*&&\s*workspaceMainView !== "plugin-store"/,
    );
    expect(frameSource).toContain('data-testid="automations-main-drag-region"');
    expect(frameSource).toContain("h-12 shrink-0 [app-region:drag]");
    expect(frameSource).toContain("isDesktop ? (");
    expect(layoutSource).toContain(
      "min-h-0 flex-1 overflow-y-auto [scrollbar-gutter:stable]",
    );

    // 3 = 手机远控路径的 Automations + 桌面路径的 Automations / 插件市场。
    // 手机远控路径原本还有一份插件市场的 breadcrumb frame，但它的门禁是 !isWebRemoteControlShell，
    // 在该分支里恒为 false（死代码）；插件市场改由 WebRemoteControlMobileShell 自己的页面
    // 承载顶栏与滚动容器后，这份重复的壳被移除。
    expect(
      layoutSource.match(/<AutomationsMainBreadcrumbFrame/gu)?.length,
    ).toBe(3);
    expect(
      frameSource.match(/data-testid="automations-main-drag-region"/gu)?.length,
    ).toBe(1);
  });

  it("reserves scrollbar space in automations and plugins shell layouts", () => {
    const layoutSource = readSource(
      "packages/ui/src/app-shell/WorkspaceShellLayout.tsx",
    );
    const mobileShellSource = readSource(
      "packages/ui/src/WebRemoteControlMobileShell.tsx",
    );

    const stableScrollerCount =
      layoutSource.match(
        /min-h-0 flex-1 overflow-y-auto \[scrollbar-gutter:stable\]/gu,
      )?.length ?? 0;

    // 口径同上：手机远控的插件市场滚动容器搬到了 WebRemoteControlMobileShell，
    // 因此这里少一份，改在下面单独校验，避免覆盖丢失。
    expect(stableScrollerCount).toBe(3);
    expect(mobileShellSource).toContain(
      "min-h-0 min-w-0 flex-1 overflow-y-auto [scrollbar-gutter:stable]",
    );
  });
});
