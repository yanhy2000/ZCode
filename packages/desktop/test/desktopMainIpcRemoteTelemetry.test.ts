import { beforeEach, describe, expect, it, vi } from "vitest";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { InternalChannels, PlatformChannels } from "@zcode/shared";
import { isAllowedExternalOpenUrl } from "../src/main/desktopMainIpcRemote.js";

type IpcHandler = (...args: unknown[]) => unknown;
type RemoteIpcOptions = Parameters<
  typeof import("../src/main/desktopMainIpcRemote.js").registerRemoteIpcHandlers
>[0];

const h = vi.hoisted(() => ({
  handlers: new Map<string, IpcHandler>(),
  listeners: new Map<string, IpcHandler>(),
  fromWebContents: vi.fn(),
  registerWebRemoteControlIpcHandlers: vi.fn(),
  shellOpenExternal: vi.fn(),
  shellOpenPath: vi.fn(),
}));

vi.mock("electron", () => ({
  app: {
    on: vi.fn(),
  },
  BrowserWindow: {
    fromWebContents: h.fromWebContents,
  },
  ipcMain: {
    handle: vi.fn((channel: string, handler: IpcHandler) => h.handlers.set(channel, handler)),
    on: vi.fn((channel: string, handler: IpcHandler) => h.listeners.set(channel, handler)),
  },
  shell: {
    openExternal: h.shellOpenExternal,
    openPath: h.shellOpenPath,
  },
}));

vi.mock("../src/main/desktopNotifications.js", () => ({
  dispatchTaskNotification: vi.fn(),
}));

vi.mock("../src/main/desktopOAuthDeepLink.js", () => ({
  clearOAuthRoutesForWindow: vi.fn(),
  deliverPendingDeepLink: vi.fn(() => false),
  parseOAuthStateRegistration: vi.fn(),
  registerOAuthState: vi.fn(),
}));

vi.mock("../src/main/desktopWebRemoteControlIpc.js", () => ({
  registerWebRemoteControlIpcHandlers: h.registerWebRemoteControlIpcHandlers,
}));

// 说明：本文件原为「remote workspace connect 遥测」集成测试。自维护批次删除了
// rendererActionTrace/ARMS/remote-usage 遥测链路（registerRemoteIpcHandlers 已不再接收
// reportRemoteUsageEvent / armsCustomContext / getRemoteConnectionStats），对应用例已移除；
// 保留的用例覆盖仍存在的 OpenExternal 分流与 attachment-ready 转发行为。

function createOptions(overrides?: Partial<RemoteIpcOptions>): RemoteIpcOptions {
  return {
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
    webRemoteControlManager: {
      authorizeStart: vi.fn(),
      startAuthorized: vi.fn(),
      resetPairingAuthorized: vi.fn(),
      stop: vi.fn(),
      getStatus: vi.fn(),
    },
    createRemoteWorkspaceSession: vi.fn(async () => "remote-session-1"),
    disposeRemoteWorkspaceSession: vi.fn(),
    cancelPendingRemoteWorkspaceSessionsForWindow: vi.fn(),
    bindRemoteWorkspaceSessionContext: vi.fn(),
    confirmRendererAttachmentReady: vi.fn(),
    isDockerDaemonAvailable: vi.fn(async () => true),
    listAvailableWSLDistros: vi.fn(async () => []),
    listAvailableDockerContainers: vi.fn(async () => []),
    listSSHConfigAliases: vi.fn(async () => []),
    ...overrides,
  };
}

async function registerHarness(overrides?: Partial<RemoteIpcOptions>) {
  const { registerRemoteIpcHandlers } = await import("../src/main/desktopMainIpcRemote.js");
  const options = createOptions(overrides);
  registerRemoteIpcHandlers(options);
  const handler = h.handlers.get(PlatformChannels.ConnectRemote);
  expect(handler).toBeDefined();
  return { handler: handler!, options };
}

describe("desktop remote IPC handlers", () => {
  it("只允许 Web URL 和 file URL 交给系统浏览器", () => {
    expect(isAllowedExternalOpenUrl("https://example.com")).toBe(true);
    expect(isAllowedExternalOpenUrl("file:///tmp/report.html")).toBe(true);
    expect(isAllowedExternalOpenUrl("file:///tmp/report.txt")).toBe(true);
    expect(isAllowedExternalOpenUrl("file:///etc/passwd")).toBe(true);
    expect(isAllowedExternalOpenUrl("data:text/html,hello")).toBe(false);
  });

  beforeEach(() => {
    h.handlers.clear();
    h.listeners.clear();
    h.fromWebContents.mockReset();
    h.fromWebContents.mockReturnValue({ id: 17 });
    h.registerWebRemoteControlIpcHandlers.mockReset();
    h.shellOpenExternal.mockReset().mockResolvedValue(undefined);
    h.shellOpenPath.mockReset().mockResolvedValue("");
  });

  it("注册 IPC 时装配 web remote control handlers", async () => {
    const { options } = await registerHarness();

    expect(h.registerWebRemoteControlIpcHandlers).toHaveBeenCalledWith({
      reportRemoteUsageEvent: expect.any(Function),
      webRemoteControlManager: options.webRemoteControlManager,
    });
  });

  it("只允许 main 进程打开 http/https/file URL", async () => {
    const { registerRemoteIpcHandlers } = await import("../src/main/desktopMainIpcRemote.js");
    const options = createOptions();
    registerRemoteIpcHandlers(options);
    const listener = h.listeners.get(PlatformChannels.OpenExternal);
    expect(listener).toBeDefined();

    // Windows 下 file:///tmp/... 不是绝对路径，会走 warn 分支；这里用平台绝对路径构造
    // file URL，保持「file 走 openPath、javascript/非法输入被拦截」的断言跨平台成立。
    const localFile = join(tmpdir(), "zcode-open-external-secret.txt");
    listener?.({}, "https://example.com/docs");
    listener?.({}, "http://localhost:3000/index.html");
    listener?.({}, pathToFileURL(localFile).toString());
    listener?.({}, "javascript:alert(1)");
    listener?.({}, "not a url");

    expect(h.shellOpenExternal).toHaveBeenCalledTimes(2);
    expect(h.shellOpenExternal).toHaveBeenCalledWith("https://example.com/docs");
    expect(h.shellOpenExternal).toHaveBeenCalledWith("http://localhost:3000/index.html");
    await vi.waitFor(() =>
      expect(h.shellOpenPath).toHaveBeenCalledWith(
        expect.stringContaining("zcode-open-external-secret.txt"),
      ),
    );
    expect(options.logger.warn).toHaveBeenCalledTimes(2);
  });

  it("keeps Coding Plan PayPal callback openExternal requests in the sender webview", async () => {
    const { registerRemoteIpcHandlers } = await import("../src/main/desktopMainIpcRemote.js");
    const options = createOptions();
    registerRemoteIpcHandlers(options);
    const listener = h.listeners.get(PlatformChannels.OpenExternal);
    expect(listener).toBeDefined();

    const sender = {
      getURL: vi.fn(() => "https://www.sandbox.paypal.com/agreements/approve"),
      loadURL: vi.fn(() => Promise.resolve()),
    };
    const returnTo = encodeURIComponent(
      "/coding-plan?provider=zai&embedded=app&lang=cn&theme=zai-dark",
    );
    const callbackUrl = `http://localhost:3000/coding-plan/payment/callback?channel=paypal&status=return&returnTo=${returnTo}&approval_token_id=setup-1`;
    listener?.({ sender }, callbackUrl);

    expect(sender.loadURL).toHaveBeenCalledWith(callbackUrl);
    expect(h.shellOpenExternal).not.toHaveBeenCalled();
  });

  it("uses Coding Plan bridge sourceUrl when routing openExternal callbacks", async () => {
    const { registerRemoteIpcHandlers } = await import("../src/main/desktopMainIpcRemote.js");
    const options = createOptions();
    registerRemoteIpcHandlers(options);
    const listener = h.listeners.get(PlatformChannels.OpenExternal);
    expect(listener).toBeDefined();

    const sender = {
      getURL: vi.fn(() => "file:///Applications/ZCode/index.html"),
      loadURL: vi.fn(() => Promise.resolve()),
    };
    const returnTo = encodeURIComponent(
      "/coding-plan?provider=zai&embedded=app&lang=cn&theme=zai-dark",
    );
    const callbackUrl = `http://localhost:3000/coding-plan/payment/callback?channel=paypal&status=return&returnTo=${returnTo}&approval_token_id=setup-1`;
    listener?.(
      {
        sender,
        senderFrame: { url: "https://www.sandbox.paypal.com/agreements/approve" },
      },
      {
        sourceUrl: "file:///stale-host-url.html",
        url: callbackUrl,
      },
    );

    expect(sender.loadURL).toHaveBeenCalledWith(callbackUrl);
    expect(h.shellOpenExternal).not.toHaveBeenCalled();
  });

  it("opens cross-origin Coding Plan callback openExternal requests externally", async () => {
    const { registerRemoteIpcHandlers } = await import("../src/main/desktopMainIpcRemote.js");
    const options = createOptions();
    registerRemoteIpcHandlers(options);
    const listener = h.listeners.get(PlatformChannels.OpenExternal);
    expect(listener).toBeDefined();

    const sender = {
      getURL: vi.fn(() => "https://www.sandbox.paypal.com/agreements/approve"),
      loadURL: vi.fn(() => Promise.resolve()),
    };
    // returnTo 与回调页不同源即应外部打开；用中性域名表达“不同源”，不依赖测试环境域名
    //（开源导出会把测试域名改写成正式域名，回调与 returnTo 就变成同源）。
    const returnTo = encodeURIComponent(
      "https://other-origin.example/coding-plan?provider=zai&embedded=app",
    );
    const callbackUrl = `https://zcode.z.ai/coding-plan/payment/callback?channel=paypal&status=return&returnTo=${returnTo}`;
    listener?.({ sender }, callbackUrl);

    expect(sender.loadURL).not.toHaveBeenCalled();
    expect(h.shellOpenExternal).toHaveBeenCalledWith(callbackUrl);
  });

  it("把 renderer attachment-ready ACK 转发给对应窗口 session manager", async () => {
    const confirmRendererAttachmentReady = vi.fn();
    await registerHarness({ confirmRendererAttachmentReady });
    const listener = h.listeners.get(InternalChannels.ScopedServicePortReady);

    listener?.(
      { sender: { id: 73 } },
      { sessionId: "remote-session-1", attachmentId: "attachment-b" },
    );

    expect(confirmRendererAttachmentReady).toHaveBeenCalledWith(73, {
      sessionId: "remote-session-1",
      attachmentId: "attachment-b",
    });
  });
});
