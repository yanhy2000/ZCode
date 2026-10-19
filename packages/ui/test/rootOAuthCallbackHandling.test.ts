import { beforeEach, describe, expect, it, vi } from "vitest";
import { BIGMODEL_PROVIDER_ID, ZAI_PROVIDER_ID } from "@zcode/shared";

const reportAppTelemetryEventMock = vi.fn(async () => {});
const resolveProviderTelemetryLabelMock = vi.fn((providerId: string) =>
  providerId === ZAI_PROVIDER_ID
    ? "z.ai"
    : providerId === BIGMODEL_PROVIDER_ID
      ? "bigmodel"
      : providerId,
);

vi.mock("@/lib/appTelemetry.js", () => ({
  reportAppTelemetryEvent: reportAppTelemetryEventMock,
  resolveProviderTelemetryLabel: resolveProviderTelemetryLabelMock,
}));

vi.mock("@/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("handleOAuthCallbackSuccess", () => {
  beforeEach(() => {
    reportAppTelemetryEventMock.mockClear();
    resolveProviderTelemetryLabelMock.mockClear();
  });

  it("应用登录回调会更新 user、清理错误并上报登录埋点", async () => {
    const { handleOAuthCallbackSuccess } = await import("@/root/useRootOAuthEffects.js");
    const setUser = vi.fn();
    const setOAuthError = vi.fn();
    const refreshProviderState = vi.fn(async () => {});
    const platform = {
      reportTelemetryEvent: vi.fn(async () => {}),
    };

    await handleOAuthCallbackSuccess({
      result: {
        kind: "session",
        provider: BIGMODEL_PROVIDER_ID,
        userInfo: {
          id: "user-1",
          username: "bigmodel-user",
          displayName: "BigModel User",
        },
      },
      platform,
      refreshProviderState,
      setUser,
      setOAuthError,
    });

    expect(setUser).toHaveBeenCalledWith({
      id: "user-1",
      username: "bigmodel-user",
      displayName: "BigModel User",
    });
    expect(setOAuthError).toHaveBeenCalledWith(null);
    expect(refreshProviderState).toHaveBeenCalledOnce();
    expect(reportAppTelemetryEventMock).toHaveBeenCalledTimes(1);
    expect(reportAppTelemetryEventMock).toHaveBeenCalledWith(
      platform,
      expect.objectContaining({
        elementName: "app_login_success",
        eventExtraDetail: { login_provider: "bigmodel" },
      }),
      "Root",
    );
  });

  it("z.ai 登录沿用 z.ai 埋点标签", async () => {
    const { handleOAuthCallbackSuccess } = await import("@/root/useRootOAuthEffects.js");

    await handleOAuthCallbackSuccess({
      result: {
        kind: "session",
        provider: ZAI_PROVIDER_ID,
        userInfo: { id: "user-2", username: "zai-user", displayName: "Z.ai User" },
      },
      platform: { reportTelemetryEvent: vi.fn(async () => {}) },
      refreshProviderState: vi.fn(async () => {}),
      setUser: vi.fn(),
      setOAuthError: vi.fn(),
    });

    expect(reportAppTelemetryEventMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventExtraDetail: { login_provider: "z.ai" },
      }),
      "Root",
    );
  });
});
