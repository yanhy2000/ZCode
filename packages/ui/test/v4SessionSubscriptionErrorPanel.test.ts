// @vitest-environment jsdom

import type { IPlatformService } from "@zcode/shared";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PlatformProvider } from "@/hooks/usePlatform.js";
import { ZCodeIntlProvider } from "@/i18n/IntlProvider.js";
import { ZCODE_PROJECT_ISSUES_URL } from "@/lib/productLinks.js";
import { SessionSubscriptionErrorPanel } from "@/v4/SessionSubscriptionErrorPanel.js";

const openExternal = vi.fn();
const platform = {
  openExternal,
} as unknown as IPlatformService;

/** 反馈入口现在先复制脱敏摘要再打开 issue 页，这里拦截剪贴板以断言摘要内容。 */
const clipboardWriteText = vi.fn(async (_text: string) => {});

function renderPanel() {
  return render(
    createElement(
      ZCodeIntlProvider,
      { initialLocale: "zh-CN" },
      createElement(
        PlatformProvider,
        { platform },
        createElement(SessionSubscriptionErrorPanel, {
          error: "EPERM: operation not permitted",
          sessionId: "session-1",
          workspacePath: "F:\\ZCode_data",
          onReconnect: vi.fn(),
        }),
      ),
    ),
  );
}

beforeEach(() => {
  vi.stubGlobal("navigator", { clipboard: { writeText: clipboardWriteText } });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("SessionSubscriptionErrorPanel", () => {
  it("shows the subscription error with report and reconnect actions", () => {
    renderPanel();

    expect(screen.getByText("EPERM: operation not permitted")).toBeTruthy();
    expect(screen.getByRole("button", { name: "反馈问题" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "重新连接" })).toBeTruthy();
  });

  it("copies the subscription error context and opens the project issue page", async () => {
    renderPanel();

    fireEvent.click(screen.getByRole("button", { name: "反馈问题" }));

    await waitFor(() => expect(openExternal).toHaveBeenCalledWith(ZCODE_PROJECT_ISSUES_URL));
    expect(clipboardWriteText).toHaveBeenCalledTimes(1);
    const description = clipboardWriteText.mock.calls[0]?.[0] ?? "";
    expect(description).toContain("报错摘要：EPERM: operation not permitted");
    expect(description).toContain("任务 ID: session-1");
    expect(description).toContain("工作区: F:\\ZCode_data");
  });
});
