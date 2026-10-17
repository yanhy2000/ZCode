/* Host 派发时按当前票据构造逐请求鉴权材料。自维护版移除官方 Coding Plan 后，
   闲时任务保留代码面但不再具备可用凭证；入口由 grayConfig 关闭。 */
import {
  buildRuntimeZCodeApiUrl,
  type OffPeakCodingPlanKind,
  type OffPeakCodingPlanSupport,
  type OffPeakCodingPlanUnsupportedReason,
} from "@zcode/shared";
import { isOffPeakMockEnabled, startOffPeakMockGateway } from "./offPeakMockGateway.js";
import type { ServiceLogger } from "../logger/serviceLogger.js";

/** 仅用于确定性配置错误；host 据类型输出 permanent，禁止依赖错误文本分流。 */
export class OffPeakPermanentDispatchError extends Error {
  readonly failureKind = "permanent" as const;

  constructor(message: string) {
    super(message);
    this.name = "OffPeakPermanentDispatchError";
  }
}

/** 双凭证解析失败的类型化错误（UI 可据此提示登录/配置 coding plan）。 */
export class OffPeakCredentialsUnavailableError extends OffPeakPermanentDispatchError {
  constructor(readonly missing: "jwt" | "codingPlanApiKey") {
    super(
      missing === "jwt"
        ? "off-peak requires zcode login (jwt missing)"
        : "off-peak requires a coding plan provider api key",
    );
    this.name = "OffPeakCredentialsUnavailableError";
  }
}

/** 当前 provider family / selected connection 不属于 Off-Peak 支持矩阵。 */
export class OffPeakCodingPlanUnavailableError extends OffPeakPermanentDispatchError {
  constructor(readonly reason: OffPeakCodingPlanUnsupportedReason) {
    super(`off-peak selected coding plan unavailable: ${reason}`);
    this.name = "OffPeakCodingPlanUnavailableError";
  }
}

/** 用户常驻模型或 idle plan 模型缺失时停止空耗 ticket 的类型化错误。 */
export class OffPeakModelUnavailableError extends OffPeakPermanentDispatchError {
  constructor(readonly scope: "idlePlan" | "workspaceUser") {
    super(
      scope === "idlePlan"
        ? "off-peak dispatch has no usable model (Built-in Provider models empty)"
        : "off-peak dispatch has no usable user workspace model",
    );
    this.name = "OffPeakModelUnavailableError";
  }
}

export interface OffPeakCredentialSnapshot {
  jwt: string;
  codingPlanApiKey: string;
  accountScope?: string;
  kind: OffPeakCodingPlanKind;
  providerFamily: "zai" | "bigmodel";
  providerId: string;
  organizationId?: string;
  projectId?: string;
  providerBaseURL?: string;
}

/**
 * 自维护版不再解析官方 Coding Plan 凭证。保留 mock 分支供本地网关测试，
 * 其他情况一律 fail-closed。
 */
export async function resolveOffPeakCredentials(
  _deps: unknown,
  options: { allowMockCredentials?: boolean } = {},
): Promise<OffPeakCredentialSnapshot> {
  const env = process.env;
  if (options.allowMockCredentials !== false && env["ZCODE_OFFPEAK_MOCK"] === "1") {
    return {
      jwt: "offpeak-mock-jwt",
      codingPlanApiKey: "offpeak-mock-key",
      kind: "bigmodel-personal",
      providerFamily: "bigmodel",
      providerId: "account:bigmodel-individual-coding-plan",
    };
  }
  throw new OffPeakCredentialsUnavailableError("jwt");
}

export function buildOffPeakPlanIdentityHeaders(
  credentials: OffPeakCredentialSnapshot,
): Record<string, string> {
  if (credentials.kind !== "bigmodel-team") {
    return {};
  }
  const organizationId = credentials.organizationId?.trim() ?? "";
  const projectId = credentials.projectId?.trim() ?? "";
  if (!organizationId || !projectId) {
    return {};
  }
  return {
    "bigmodel-organization": organizationId,
    "bigmodel-project": projectId,
  };
}

export function buildOffPeakRequestAuth(params: {
  credentials: OffPeakCredentialSnapshot;
  ticketId: string;
}): { apiKey: string; headers: Record<string, string>; accountScope?: string } {
  return {
    apiKey: params.credentials.jwt,
    ...(params.credentials.accountScope ? { accountScope: params.credentials.accountScope } : {}),
    headers: {
      Authorization: `Bearer ${params.credentials.jwt}`,
      "X-Coding-Plan-Api-Key": params.credentials.codingPlanApiKey,
      "X-Off-Peak-Ticket-ID": params.ticketId,
      ...buildOffPeakPlanIdentityHeaders(params.credentials),
    },
  };
}

/** renderer 可见的脱敏支持快照；自维护版固定不支持。 */
export async function resolveOffPeakCodingPlanSupport(
  _deps?: unknown,
): Promise<OffPeakCodingPlanSupport> {
  return { supported: false, reason: "connection_unavailable" };
}

export async function resolveOffPeakMockUpstream(_deps?: unknown): Promise<{
  url: string;
  headers: Record<string, string>;
}> {
  throw new Error("off-peak mock upstream is unavailable without a coding plan provider");
}

/**
 * origin 解析器（memoized）：mock 模式懒启动进程内网关（固定端口，多实例经 EADDRINUSE
 * 复用同一份票据状态），真实模式指向 zcode API origin。
 */
export function createOffPeakOriginResolver(deps: {
  logger: ServiceLogger;
  resolveUpstream: () => Promise<{ url: string; headers: Record<string, string> }>;
  env?: NodeJS.ProcessEnv;
}): { resolveOrigin: () => Promise<string>; close: () => Promise<void> } {
  const env = deps.env ?? process.env;
  let originPromise: Promise<string> | null = null;
  let closeGateway: (() => Promise<void>) | null = null;
  return {
    resolveOrigin: () => {
      if (!originPromise) {
        originPromise = (async () => {
          if (!isOffPeakMockEnabled(env)) {
            return new URL(buildRuntimeZCodeApiUrl(env, "/")).origin;
          }
          const gateway = await startOffPeakMockGateway({
            logger: deps.logger,
            resolveUpstream: deps.resolveUpstream,
          });
          if (!gateway.external) closeGateway = gateway.close;
          return gateway.origin;
        })().catch((error) => {
          originPromise = null;
          throw error;
        });
      }
      return originPromise;
    },
    close: async () => {
      const close = closeGateway;
      closeGateway = null;
      if (close) await close();
    },
  };
}
