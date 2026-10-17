import { afterEach, describe, expect, it, vi } from "vitest";
import { ZCODE_DYNAMIC_WORKFLOW_MODE_ENV, type ApiClient } from "@zcode/shared";
import { BigModelCodingPlanSubscriptionProvider } from "../src/coding-plan-subscription/bigmodelCodingPlanSubscriptionProvider.js";
import { createCodingPlanSubscriptionService } from "../src/coding-plan-subscription/codingPlanSubscriptionService.js";

// 自维护构建：动态工作流固定提供 alwaysOn，不再读取 /client/configs 云端灰度。
// 合法本地覆盖只服务开发调试；用户设置由 service 层套在「提供」之上。

function createProvider(apiClient: ApiClient) {
  return new BigModelCodingPlanSubscriptionProvider({
    apiClient,
    credentialService: { load: vi.fn() },
  });
}

function createForbiddenApiClient(): ApiClient {
  return {
    request: vi.fn(async () => {
      throw new Error("dynamic workflow must not request remote client config");
    }),
  };
}

describe("getDynamicWorkflowClientConfig", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("不读取云端，固定提供 alwaysOn", async () => {
    const apiClient = createForbiddenApiClient();
    const provider = createProvider(apiClient);

    await expect(provider.getDynamicWorkflowClientConfig()).resolves.toEqual({
      mode: "alwaysOn",
      enabled: true,
      source: "default",
      offeredMode: "alwaysOn",
    });
    await expect(
      provider.getDynamicWorkflowClientConfig({ forceRefresh: true }),
    ).resolves.toEqual({
      mode: "alwaysOn",
      enabled: true,
      source: "default",
      offeredMode: "alwaysOn",
    });
    expect(apiClient.request).not.toHaveBeenCalled();
  });

  it("未打包 dev 的合法本地覆盖仍然优先", async () => {
    const apiClient = createForbiddenApiClient();
    const provider = createProvider(apiClient);

    vi.stubEnv(ZCODE_DYNAMIC_WORKFLOW_MODE_ENV, "disabled");
    await expect(provider.getDynamicWorkflowClientConfig()).resolves.toEqual({
      mode: "disabled",
      enabled: false,
      source: "override",
      offeredMode: "disabled",
    });

    vi.stubEnv(ZCODE_DYNAMIC_WORKFLOW_MODE_ENV, "onDemand");
    await expect(provider.getDynamicWorkflowClientConfig()).resolves.toMatchObject({
      mode: "onDemand",
      enabled: true,
      source: "override",
    });
    expect(apiClient.request).not.toHaveBeenCalled();
  });

  it("非法本地覆盖被忽略，回退 alwaysOn", async () => {
    vi.stubEnv(ZCODE_DYNAMIC_WORKFLOW_MODE_ENV, "on");
    const apiClient = createForbiddenApiClient();

    await expect(createProvider(apiClient).getDynamicWorkflowClientConfig()).resolves.toEqual({
      mode: "alwaysOn",
      enabled: true,
      source: "default",
      offeredMode: "alwaysOn",
    });
    expect(apiClient.request).not.toHaveBeenCalled();
  });

  it("service 应用用户设置，但仍不请求云端", async () => {
    const apiClient = createForbiddenApiClient();
    const service = createCodingPlanSubscriptionService({
      apiClient,
      credentialService: { load: vi.fn() },
      resolveDynamicWorkflowUserMode: async () => "disabled",
    });

    await expect(service.getDynamicWorkflowClientConfig()).resolves.toEqual({
      mode: "disabled",
      enabled: false,
      source: "default",
      offeredMode: "alwaysOn",
      userMode: "disabled",
    });
    expect(apiClient.request).not.toHaveBeenCalled();
  });
});
