import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/usePlatform.js", () => ({
  usePlatform: () => ({ executeDesktopCommand: vi.fn().mockResolvedValue(undefined) }),
}));

vi.mock("@/i18n/IntlProvider.js", () => ({
  useZCodeIntl: () => ({
    intl: {
      formatMessage: ({ id }: { id: string }) => id,
    },
  }),
}));

// ThemeHeroVisual 依赖 StoreProvider 解析主题；静态渲染只需要它的布局类。
vi.mock("@/openWorkspacePageThemeHero.js", () => ({
  ThemeHeroVisual: () =>
    createElement("div", {
      className: "absolute inset-0 bg-[linear-gradient(180deg,#000000_0%,#151718_100%)]",
    }),
}));

describe("WelcomeScreen", () => {
  it("使用项目选择页主题大背景和 background 登录面板", async () => {
    const { WelcomeScreen } = await import("@/WelcomeScreen.js");
    const html = renderToStaticMarkup(createElement(WelcomeScreen, { onComplete: vi.fn() }));

    expect(html).toContain("overflow-hidden bg-background");
    expect(html).toContain("absolute inset-0");
    expect(html).toContain("bg-[linear-gradient");
    expect(html).toContain("bg-background");
    expect(html).toContain("border-popover-border");
    expect(html).toContain("shadow-md");
    expect(html).toContain("<h1");
    expect(html).not.toContain("DialogTitle");
  });

  it("只展示“开始使用”，不再收集 API Key 或展示官方账号入口", async () => {
    const { WelcomeScreen } = await import("@/WelcomeScreen.js");
    const html = renderToStaticMarkup(createElement(WelcomeScreen, { onComplete: vi.fn() }));

    expect(html).toContain('data-testid="welcome-start-button"');
    expect(html).toContain("login.title");
    expect(html).toContain("login.description");
    expect(html).toContain("login.start");
    expect(html).not.toContain("login-api-key");
    expect(html).not.toContain("login.oauth.button.zai");
    expect(html).not.toContain("login.oauth.button.bigmodel");
    expect(html).not.toContain("login.useApiKey");
  });
});
