import { readFile } from "node:fs/promises";
import { BUILTIN_PROVIDER_TEMPLATE_IDS } from "@zcode/shared";
import { describe, expect, it } from "vitest";
import { parseZCodeBuiltinModelConfigRules } from "@zcode/provider";

describe("Zhipu 普通计费 API 模板", () => {
  it.each(["zcode-builtin.json", "zcode-builtin.test.json"])(
    "%s 声明 Z.ai / BigModel 普通计费端点、签名准入、获取入口和媒体能力",
    async (filename) => {
      const release = JSON.parse(
        await readFile(new URL(`../../../config/provider/${filename}`, import.meta.url), "utf8"),
      );
      const templates = release.config.providerConfigRules.templateRules;
      for (const template of templates) {
        expect(
          new URL(template.config.access.apiKeyManagementUrl).protocol,
          template.templateId,
        ).toBe("https:");
        expect(template.config.access).not.toHaveProperty("teamApiKeyManagementUrl");
      }
      const rules = parseZCodeBuiltinModelConfigRules(release.config.modelConfigRules);
      // 账号商业面删除后只剩普通计费模板；模板 ID 统一取自共享常量，改名不必再手抄。
      for (const family of ["zai", "bigmodel"] as const) {
        const templateId = BUILTIN_PROVIDER_TEMPLATE_IDS[family];
        const template = templates.find(
          (item: { templateId: string }) => item.templateId === templateId,
        );
        expect(template, templateId).toBeDefined();
        const label = family === "zai" ? "Z.ai API" : "BigModel API";
        expect(template.templateNameMap).toEqual({ "zh-CN": label, "en-US": label });
        const config = template.config;
        const host = family === "zai" ? "api.z.ai" : "open.bigmodel.cn";
        expect(config.api).toEqual({
          type: "openai-chat-completions",
          baseUrl: `https://${host}/api/paas/v4`,
        });
        expect(config.access.type).toBe("api-key");
        expect(config.access.apiKeyManagementUrl).toBe(
          family === "zai"
            ? "https://z.ai/manage-apikey/apikey-list"
            : "https://bigmodel.cn/usercenter/proj-mgmt/apikeys",
        );
        for (const modelId of ["GLM-5.3", "GLM-5.3-Flash"]) {
          const resolved = rules.resolve({
            templateId,
            providerId: "personal-fixture",
            modelId,
            apiType: config.api.type,
            baseUrl: config.api.baseUrl,
          });
          expect(config.builtinModelIds).toContain(modelId);
          expect(resolved.enabled).toBe(true);
          // 普通计费站点只有 Flash 提供视觉输入，且不暴露原生搜索与 MCS。
          expect(resolved.properties?.inputFormat?.supportsImage).toBe(modelId.endsWith("Flash"));
          expect(resolved.properties?.supportsNativeWebSearch).toBe(false);
          expect(resolved.properties?.supportsMidConversationSystem).toBe(false);
        }
      }
    },
  );
});
