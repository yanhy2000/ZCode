import { describe, expect, it } from "vitest";
import { resolveZCodeAgentPresentationSurface } from "../src/zcode-agent/zcodeAgentPresentationSurface.js";

describe("resolveZCodeAgentPresentationSurface", () => {
  it("从本地 Desktop Host 的 telemetry runtime surface 推导 Desktop 呈现面", () => {
    expect(
      resolveZCodeAgentPresentationSurface({
        runtimeSurface: "desktop_local_host",
      }),
    ).toBe("desktop");
  });

  it("不把普通 remote runtime 或无宿主事实的 Server 推导成 Desktop", () => {
    expect(
      resolveZCodeAgentPresentationSurface({
        runtimeSurface: "remote_workspace_host",
      }),
    ).toBeUndefined();
    expect(resolveZCodeAgentPresentationSurface({})).toBeUndefined();
  });
});
