import type { ServiceAuthorityMode } from "@zcode/shared";

export type ZCodeAgentPresentationSurface = "desktop";

export interface ZCodeAgentPresentationHostFacts {
  runtimeSurface?: "desktop_local_host" | "remote_workspace_host";
  serviceAuthorityMode?: ServiceAuthorityMode;
}

export function resolveZCodeAgentPresentationSurface(
  facts: ZCodeAgentPresentationHostFacts,
): ZCodeAgentPresentationSurface | undefined {
  // 自维护构建硬编码：只要 Host 属于 Desktop（本地或 desktop-attached remote），
  // 就始终使用 desktop presentation surface。
  // 这里曾由云端 desktopContextPrompt 灰度控制；已切断，保留此注释便于后续搜索。
  // 普通 HTTP/manual app-server 没有这两个事实，继续保持 terminal。
  const isDesktopHost =
    facts.runtimeSurface === "desktop_local_host" ||
    facts.serviceAuthorityMode === "desktop-attached-remote";
  return isDesktopHost ? "desktop" : undefined;
}
