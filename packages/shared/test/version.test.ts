import { describe, expect, it } from "vitest";
import { resolveUpstreamVersion } from "../src/version.js";

// docs/specs/selfhost-runtime.md「版本规则」：显示与自动更新用完整 `<私有版本>+<官方基线>`，
// 与云端/官方服务交互用官方基线版本。
describe("resolveUpstreamVersion", () => {
  it("取出 `+` 之后的官方基线版本", () => {
    expect(resolveUpstreamVersion("1.0.0+3.15.1")).toBe("3.15.1");
    expect(resolveUpstreamVersion("  1.0.1+3.15.1 ")).toBe("3.15.1");
  });

  it("没有 `+` 基线时按原样返回（非自维护构建、测试桩）", () => {
    expect(resolveUpstreamVersion("3.15.1")).toBe("3.15.1");
    expect(resolveUpstreamVersion("0.0.0-dev")).toBe("0.0.0-dev");
  });

  it("只有 `+` 时回退到完整版本，不产生空串", () => {
    expect(resolveUpstreamVersion("1.0.0+")).toBe("1.0.0+");
  });

  it("空值返回 undefined", () => {
    expect(resolveUpstreamVersion("")).toBeUndefined();
    expect(resolveUpstreamVersion("   ")).toBeUndefined();
    expect(resolveUpstreamVersion(undefined)).toBeUndefined();
    expect(resolveUpstreamVersion(null)).toBeUndefined();
  });
});
