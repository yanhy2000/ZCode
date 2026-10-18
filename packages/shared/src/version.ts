// 由各 bundler 通过 define 注入，避免运行时 JSON import 的跨 bundler 兼容问题。
// 非构建环境（如 e2e 测试的 mocha）下 define 不存在，
// 用 typeof 检查 + fallback 避免 ReferenceError。
declare const __ZCODE_VERSION__: string;
declare const __ZCODE_COMMIT__: string;
declare const __ZCODE_BUILD_TIME__: string;

export const ZCODE_VERSION: string =
  typeof __ZCODE_VERSION__ !== "undefined" ? __ZCODE_VERSION__ : "0.0.0-dev";

/**
 * 把版本号归一成官方基线版本（docs/specs/selfhost-runtime.md「版本规则」）。
 *
 * 自维护版本号形如 `<私有版本>+<官方基线>`（`1.0.0+3.15.1`）：显示与自动更新用完整版本，
 * 与云端/官方服务交互一律上报基线。官方不认识私有版本，`1.0.0` 会被当成远低于基线的旧客户端
 * （例如手机远控会退回云端已下线的 `remote/v3`，请求头/`app_version` 也会落进旧档位）。
 * 缺少 `+` 基线或值为空时按原样返回（非自维护构建、测试桩）。
 */
export function resolveUpstreamVersion(version: string | null | undefined): string | undefined {
  const normalized = version?.trim();
  if (!normalized) {
    return undefined;
  }

  const plusIndex = normalized.indexOf("+");
  if (plusIndex < 0) {
    return normalized;
  }

  const upstream = normalized.slice(plusIndex + 1).trim();
  return upstream || normalized;
}

/** 本构建的上游基线版本；云端交互与版本门槛判断使用它，不用 `ZCODE_VERSION`。 */
export const ZCODE_UPSTREAM_VERSION: string = resolveUpstreamVersion(ZCODE_VERSION) ?? ZCODE_VERSION;
export const ZCODE_COMMIT: string =
  typeof __ZCODE_COMMIT__ !== "undefined" ? __ZCODE_COMMIT__ : "unknown";
export const ZCODE_BUILD_TIME: string =
  typeof __ZCODE_BUILD_TIME__ !== "undefined" ? __ZCODE_BUILD_TIME__ : "unknown";
