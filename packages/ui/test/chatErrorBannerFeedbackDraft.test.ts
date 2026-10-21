import type { IPlatformService } from "@zcode/shared";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChatErrorBanner } from "@/ChatErrorBanner.js";
import { PlatformProvider } from "@/hooks/usePlatform.js";
import { ZCodeIntlProvider } from "@/i18n/IntlProvider.js";
import { ZCODE_PROJECT_ISSUES_URL } from "@/lib/productLinks.js";

const buttonMock = vi.hoisted(() => ({
  props: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/components/ui/button.js", async () => {
  const React = await import("react");
  return {
    Button: (props: Record<string, unknown>) => {
      buttonMock.props.push(props);
      const { children, size, variant, ...domProps } = props;
      void size;
      void variant;
      return React.createElement("button", domProps, children);
    },
  };
});

vi.mock("@/components/ui/toast.js", () => ({
  toast: vi.fn(),
}));

const mockPlatform = {
  captureWindowScreenshot: vi.fn(async () => null),
  openExternal: vi.fn(),
} as unknown as IPlatformService;

/** 反馈入口现在先复制脱敏摘要再打开 issue 页，这里拦截剪贴板以断言摘要内容。 */
const clipboardWriteText = vi.fn(async (_text: string) => {});

function renderErrorBanner() {
  renderToStaticMarkup(
    createElement(
      ZCodeIntlProvider,
      { initialLocale: "zh-CN" },
      createElement(
        PlatformProvider,
        { platform: mockPlatform },
        createElement(ChatErrorBanner, {
          error: {
            code: "PROVIDER_AUTH_FAILED",
            message: "Provider authentication failed.",
            traceId: "trace-auth-failed",
          },
          onDismiss: vi.fn(),
        }),
      ),
    ),
  );
}

async function openFeedbackFromBanner() {
  const feedbackButton = buttonMock.props.find((props) => props["aria-label"] === "反馈问题");
  expect(feedbackButton).toBeDefined();
  if (!feedbackButton) {
    throw new Error("Feedback issue button was not rendered");
  }

  await (feedbackButton.onClick as () => Promise<void>)();
}

describe("ChatErrorBanner feedback draft", () => {
  beforeEach(() => {
    buttonMock.props = [];
    vi.clearAllMocks();
    vi.stubGlobal("navigator", { clipboard: { writeText: clipboardWriteText } });
  });

  it("copies a compact one-line error summary and opens the project issue page", async () => {
    renderErrorBanner();

    await openFeedbackFromBanner();

    expect(mockPlatform.captureWindowScreenshot).not.toHaveBeenCalled();
    // 反馈入口改为复制脱敏摘要 + 打开 issue 页，不再写入本地反馈草稿。
    expect(clipboardWriteText).toHaveBeenCalledTimes(1);
    const description = clipboardWriteText.mock.calls[0]?.[0];
    expect(description).toContain("报错摘要：Provider authentication failed.");
    expect(description).toContain("TraceID: trace-auth-failed");
    expect(description).not.toContain("我在使用过程中遇到了报错，请帮忙排查。");
    expect(description).not.toContain("报错摘要\nProvider authentication failed.");
    expect(mockPlatform.openExternal).toHaveBeenCalledWith(ZCODE_PROJECT_ISSUES_URL);
  });
});
