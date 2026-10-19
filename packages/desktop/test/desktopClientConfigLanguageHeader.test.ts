import { describe, expect, it, vi } from "vitest";

const electron = vi.hoisted(() => ({
  fetchHeaders: [] as Headers[],
}));

vi.mock("electron", () => ({
  net: {
    fetch: async (_input: string, init?: RequestInit) => {
      electron.fetchHeaders.push(new Headers(init?.headers));
      return new Response(JSON.stringify({ code: 0, data: { configs: {} } }));
    },
  },
}));

import { createDesktopHelpConfigReader } from "../src/main/desktopHelpConfig.js";

describe("Desktop main client/configs 的 X-Client-Language", () => {
  it("帮助配置请求按当前界面语言发送", async () => {
    const read = createDesktopHelpConfigReader({
      appVersion: "3.0.0",
      deviceMid: "device-mid-1",
      resolveEndpointOrigin: async () => "https://zcode.example.com",
      getClientLanguage: () => "zh-CN",
    });

    await read().catch(() => undefined);

    expect(electron.fetchHeaders[0]?.get("X-Client-Language")).toBe("zh-CN");
  });
});
