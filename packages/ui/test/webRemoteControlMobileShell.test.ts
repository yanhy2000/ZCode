import { createElement, type ReactNode } from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  WebRemoteControlMobileShell,
  isWebRemoteControlMobileChatHistoryState,
  isWebRemoteControlMobilePluginStoreHistoryState,
} from "@/WebRemoteControlMobileShell.js";
import { persistWebRemoteControlMobileTaskHomePreferences } from "@/WebRemoteControlMobileTaskHome.js";
import type {
  WebRemoteControlTaskTarget,
  WebRemoteControlWorkspaceListResult,
} from "@zcode/shared";

vi.mock("@/i18n/IntlProvider.js", () => ({
  useZCodeIntl: () => ({
    intl: {
      formatMessage: ({ id }: { id: string }) => id,
    },
  }),
}));

vi.mock("@/logger.js", () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock("@/store/StoreProvider.js", () => ({
  useZCodeStore: (selector: (state: { theme: string; setTheme: (theme: string) => void }) => unknown) =>
    selector({ theme: "dark", setTheme: vi.fn() }),
}));

vi.mock("@/components/ui/resizable.js", () => ({
  ResizablePanelGroup: ({
    children,
    className,
    layoutId,
  }: {
    children: ReactNode;
    className?: string;
    layoutId: string;
  }) =>
    createElement(
      "div",
      {
        className,
        "data-layout-id": layoutId,
      },
      children,
    ),
}));

function createStorageMock(initial: Record<string, string> = {}) {
  const state = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => state.get(key) ?? null,
    setItem: (key: string, value: string) => {
      state.set(key, value);
    },
    removeItem: (key: string) => {
      state.delete(key);
    },
  };
}

function renderMobileShell(initialNavigationIntent?: "chat") {
  return renderToStaticMarkup(
    createElement(WebRemoteControlMobileShell, {
      activeTaskId: "task-1",
      activeWorkspacePath: "/workspace/app",
      chatContent: createElement("main", { "data-testid": "chat-content" }),
      initialNavigationIntent,
      onSelectTask: vi.fn(),
      renderChatHeader: () => createElement("header", { "data-testid": "chat-header" }),
      switcher: {
        listWorkspaces: vi.fn(async () => ({ workspaces: [] })),
        switchWorkspace: vi.fn(async () => {}),
      },
    }),
  );
}

function renderMobileShellWithSidePane(
  isSidePaneOpen: boolean,
  chatOverlay?: ReactNode,
) {
  return renderToStaticMarkup(
    createElement(WebRemoteControlMobileShell, {
      activeTaskId: "task-1",
      activeWorkspacePath: "/workspace/app",
      chatContent: createElement("main", { "data-testid": "chat-content" }),
      chatOverlay,
      initialNavigationIntent: "chat",
      isSidePaneOpen,
      onCloseSidePane: vi.fn(),
      onSelectTask: vi.fn(),
      renderChatHeader: () => createElement("header", { "data-testid": "chat-header" }),
      sidePaneContent: createElement("section", { "data-testid": "side-pane-content" }),
      switcher: {
        listWorkspaces: vi.fn(async () => ({ workspaces: [] })),
        switchWorkspace: vi.fn(async () => {}),
      },
    }),
  );
}

function renderMobileShellWithTransportState(terminalTransportState: "paired" | "reconnecting") {
  return renderToStaticMarkup(
    createElement(WebRemoteControlMobileShell, {
      activeTaskId: "task-1",
      activeWorkspacePath: "/workspace/app",
      chatContent: createElement("main", { "data-testid": "chat-content" }),
      initialNavigationIntent: "chat",
      onSelectTask: vi.fn(),
      renderChatHeader: () => createElement("header", { "data-testid": "chat-header" }),
      switcher: {
        listWorkspaces: vi.fn(async () => ({ workspaces: [] })),
        switchWorkspace: vi.fn(async () => {}),
      },
      webRemoteControlTerminalTransportState: terminalTransportState,
    }),
  );
}

const workspaceList: WebRemoteControlWorkspaceListResult = {
  workspaces: [
    {
      workspacePath: "/workspace/app",
      label: "App",
      kind: "local",
    },
  ],
  tasks: [
    {
      taskId: "older-created",
      title: "Older created",
      workspacePath: "/workspace/app",
      workspaceLabel: "App",
      workspaceKind: "local",
      createdAt: 10,
      updatedAt: 100,
      provider: "codex",
    },
    {
      taskId: "newer-created",
      title: "Newer created",
      workspacePath: "/workspace/app",
      workspaceLabel: "App",
      workspaceKind: "local",
      createdAt: 20,
      updatedAt: 1,
      provider: "codex",
    },
  ] satisfies WebRemoteControlTaskTarget[],
};

function renderMobileShellWithInitialWorkspaceList(
  extraProps: Record<string, unknown> = {},
) {
  return renderToStaticMarkup(
    createElement(WebRemoteControlMobileShell, {
      activeTaskId: null,
      activeWorkspacePath: "/workspace/app",
      chatContent: createElement("main", { "data-testid": "chat-content" }),
      initialWorkspaceList: workspaceList,
      onSelectTask: vi.fn(),
      renderChatHeader: () => createElement("header", { "data-testid": "chat-header" }),
      switcher: {
        listWorkspaces: vi.fn(async () => workspaceList),
        switchWorkspace: vi.fn(async () => {}),
      },
      ...extraProps,
    }),
  );
}

describe("WebRemoteControlMobileShell", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps scan bootstrap on the mobile home page without a chat intent", () => {
    const html = renderMobileShell();

    expect(html).toContain("webRemoteControl.mobileHome.title");
    expect(html).not.toContain('data-mobile-page="chat"');
    expect(html).not.toContain('data-testid="chat-content"');
  });

  it("requests a workspace list refresh when returning from chat to the task list", () => {
    const source = readFileSync(
      resolve(process.cwd(), "packages/ui/src/WebRemoteControlMobileShell.tsx"),
      "utf8",
    );

    expect(source).toContain("homeRefreshKey");
    expect(source).toContain("refreshKey={homeRefreshKey}");
  });

  it("starts on chat when a cross-workspace click provides a chat intent", () => {
    const html = renderMobileShell("chat");

    expect(html).toContain('data-mobile-page="chat"');
    expect(html).toContain('data-testid="chat-content"');
  });

  it("renders a theme menu trigger in the mobile chat header", () => {
    const html = renderMobileShell("chat");

    expect(html).toContain("webRemoteControl.themeMenu.trigger");
  });

  it("restores chat from browser history state after refreshing on the chat page", () => {
    vi.stubGlobal("window", {
      history: {
        state: { zcodeMobilePage: "chat" },
        back: vi.fn(),
        pushState: vi.fn(),
      },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });

    const html = renderMobileShell();

    expect(html).toContain('data-mobile-page="chat"');
    expect(html).toContain('data-testid="chat-content"');
  });

  it("restores mobile task home preferences from localStorage after refreshing the page", () => {
    const storage = createStorageMock();
    vi.stubGlobal("window", {
      localStorage: storage,
      history: {
        state: null,
      },
    });

    persistWebRemoteControlMobileTaskHomePreferences(
      { organizeBy: "timeline", sortBy: "created" },
      storage,
    );
    const html = renderMobileShellWithInitialWorkspaceList();

    expect(html.indexOf("Newer created")).toBeLessThan(html.indexOf("Older created"));
    expect(html).not.toContain("webRemoteControl.mobileHome.workspaceKind.local");
  });

  it("constrains chat content in a flex column so the conversation area can scroll", () => {
    const html = renderMobileShell("chat");

    expect(html).toContain(
      '<main class="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">',
    );
  });

  it("keeps the mobile chat and side-pane content shrinkable at narrow widths", () => {
    const html = renderMobileShell("chat");
    const shellSource = readFileSync(
      resolve(process.cwd(), "packages/ui/src/WebRemoteControlMobileShell.tsx"),
      "utf8",
    );
    const sidePaneSource = readFileSync(
      resolve(process.cwd(), "packages/ui/src/app-shell/AnimatedSidePanePanel.tsx"),
      "utf8",
    );
    const workspaceShellSource = readFileSync(
      resolve(process.cwd(), "packages/ui/src/app-shell/WorkspaceShellLayout.tsx"),
      "utf8",
    );
    const sessionPaneSource = readFileSync(
      resolve(process.cwd(), "packages/ui/src/v4/SessionPane.tsx"),
      "utf8",
    );
    const timelineSource = readFileSync(
      resolve(process.cwd(), "packages/ui/src/v4/ConversationTimeline.tsx"),
      "utf8",
    );

    // 回归原因：长 subagent 输出或进程条目让 flex 子项按 min-content 宽度撑开，
    // 窄屏远控抽屉随后会裁掉每一行的开头。
    expect(html).toContain(
      '<main class="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">',
    );
    expect(shellSource).toContain(
      'className="relative flex h-full min-h-0 min-w-0 flex-col bg-background"',
    );
    expect(sidePaneSource).toContain('mobileOverlay && "min-w-0"');
    expect(sidePaneSource).not.toContain('className={cn("h-full min-w-0"');
    expect(workspaceShellSource).toContain(
      'className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col"',
    );
    expect(sessionPaneSource).toContain('compactForRemoteControl && "min-w-0"');
    expect(timelineSource).toContain('compactForRemoteControl && "min-w-0"');
  });

  it("renders side pane content as a right-side overlay over the mobile chat page", () => {
    const html = renderMobileShellWithSidePane(true);

    expect(html).toContain('data-mobile-side-pane-overlay="true"');
    expect(html).toContain("absolute top-0 right-0 h-full w-[min(88vw,28rem)]");
    expect(html).toContain("translate-x-0");
    expect(html).toContain('data-testid="side-pane-content"');
    expect(html).not.toContain("web-remote-control-mobile-side-pane-layout");
  });

  it("removes the covered chat surface from interaction while the mobile side pane is open", () => {
    const openHtml = renderMobileShellWithSidePane(true);
    const closedHtml = renderMobileShellWithSidePane(false);

    expect(openHtml).toContain('data-mobile-chat-surface="inert"');
    expect(openHtml).toContain('aria-hidden="true"');
    expect(openHtml).toContain('inert=""');
    expect(closedHtml).not.toContain('data-mobile-chat-surface="inert"');
  });

  it("keeps the chat overlay outside the inert surface while the side pane is open", () => {
    const html = renderMobileShellWithSidePane(
      true,
      createElement(
        "div",
        { "data-testid": "task-find-overlay" },
        createElement("input", { placeholder: "Search file changes..." }),
      ),
    );
    const inertSurfaceContent = html.match(
      /<main[^>]*inert=""[^>]*>([\s\S]*?)<\/main>/,
    )?.[1];

    expect(html).toContain('data-mobile-chat-overlay="true"');
    expect(html).toContain("pointer-events-none absolute inset-0 z-40");
    expect(html).toContain('data-testid="task-find-overlay"');
    expect(inertSurfaceContent).toBeDefined();
    expect(inertSurfaceContent).not.toContain('data-testid="task-find-overlay"');
    expect(html.indexOf('data-mobile-chat-overlay="true"')).toBeGreaterThan(
      html.indexOf('inert=""'),
    );
  });

  it("shows a compact reconnecting notice over the existing mobile UI", () => {
    const html = renderMobileShellWithTransportState("reconnecting");

    expect(html).toContain('data-web-remote-control-reconnect-notice="true"');
    expect(html).toContain("webRemoteControl.mobileShell.reconnecting");
    expect(html).toContain('data-testid="chat-content"');
  });

  it("does not show the reconnecting notice while the transport is paired", () => {
    const html = renderMobileShellWithTransportState("paired");

    expect(html).not.toContain('data-web-remote-control-reconnect-notice="true"');
  });

  it("recognizes only the mobile chat browser history state", () => {
    expect(isWebRemoteControlMobileChatHistoryState({ zcodeMobilePage: "chat" })).toBe(true);
    expect(isWebRemoteControlMobileChatHistoryState({ zcodeMobilePage: "home" })).toBe(false);
    expect(isWebRemoteControlMobileChatHistoryState(null)).toBe(false);
  });

  it("recognizes the mobile plugin store browser history state", () => {
    expect(isWebRemoteControlMobilePluginStoreHistoryState({ zcodeMobilePage: "plugin-store" })).toBe(
      true,
    );
    expect(isWebRemoteControlMobilePluginStoreHistoryState({ zcodeMobilePage: "chat" })).toBe(false);
    expect(isWebRemoteControlMobilePluginStoreHistoryState(null)).toBe(false);
  });

  it("offers a plugin store entry on the mobile home page when store content is provided", () => {
    // 回归原因：桌面侧栏的插件市场入口在手机壳下不渲染，首页又没有入口，
    // 手机上完全打不开插件市场（用户反馈「远控 web 端插件市场打不开」）。
    const html = renderMobileShellWithInitialWorkspaceList({
      pluginStoreContent: createElement("div", { "data-testid": "plugin-store-content" }),
    });

    expect(html).toContain('data-testid="web-remote-mobile-plugin-store-open"');
    expect(html).toContain("workspace.openPluginsSettings");
  });

  it("hides the plugin store entry when no store content is provided", () => {
    const html = renderMobileShellWithInitialWorkspaceList();

    expect(html).not.toContain('data-testid="web-remote-mobile-plugin-store-open"');
  });

  it("renders the plugin store page inside the mobile shell and restores it from history", () => {
    vi.stubGlobal("window", {
      history: {
        state: { zcodeMobilePage: "plugin-store" },
        back: vi.fn(),
        pushState: vi.fn(),
      },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });

    const html = renderToStaticMarkup(
      createElement(WebRemoteControlMobileShell, {
        activeTaskId: null,
        activeWorkspacePath: "/workspace/app",
        chatContent: createElement("main", { "data-testid": "chat-content" }),
        onSelectTask: vi.fn(),
        pluginStoreContent: createElement("div", { "data-testid": "plugin-store-content" }),
        renderChatHeader: () => createElement("header", { "data-testid": "chat-header" }),
        switcher: {
          listWorkspaces: vi.fn(async () => ({ workspaces: [] })),
          switchWorkspace: vi.fn(async () => {}),
        },
      }),
    );

    expect(html).toContain('data-mobile-page="plugin-store"');
    expect(html).toContain('data-testid="plugin-store-content"');
    expect(html).toContain("webRemoteControl.mobileShell.backHome");
  });

  it("keeps plugin-store a supported remote main view while automations stay out of scope", () => {
    // 回归原因：WorkspaceShellLayout 曾把 plugin-store 与 automations 一起打回 chat，
    // 点击「插件市场」后视图立刻回到聊天页，表现为按钮无响应。
    // 同时锁住 D37：手机 /remote 仍不承载 Automations，撤销时不能顺手把它放开。
    const source = readFileSync(
      resolve(process.cwd(), "packages/ui/src/app-shell/WorkspaceShellLayout.tsx"),
      "utf8",
    );

    expect(source).toContain("pluginStoreContent={");
    expect(source).not.toContain('workspaceMainView === "plugin-store" &&\n                !isWebRemoteControlShell');
    expect(source).not.toContain(
      '(workspaceMainView === "automations" ||\n          workspaceMainView === "plugin-store")',
    );
    expect(source).toContain('isWebRemoteControlShell && workspaceMainView === "automations"');
  });
});
