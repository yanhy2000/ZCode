import type { ModelSelectionView } from "@zcode/provider";

/** 两个 Provider 域同时存在，用于锁定工具只能选择当前账号域，不能按 Provider 顺序猜。 */
export function testSelectionView(
  values: readonly string[] = ["disabled", "high", "max"],
): ModelSelectionView {
  return {
    revision: 1,
    providers: (["bigmodel", "zai"] as const).map((family) => ({
      providerId: family === "zai" ? "zai-standard-api" : "bigmodel-standard-api",
      config: { visibility: "hidden" },
      models: [family === "zai" ? "ZAI-only" : "BigModel-only", "GLM-5.2"].map((modelId) => ({
        modelId,
        config: {
          enabled: true,

          properties: {
            requiresMfjsToolSchema: false,
            contextWindow: 200000,
            inputFormat: {
              supportsText: true,
              supportsImage: false,
              supportsVideo: false,
              supportsAudio: false,
              supportsPdf: false,
            },
            outputFormat: { supportsText: true },
            supportsToolCall: true,
            supportsJsonSchemaOutput: false,
            supportsNativeWebSearch: false,
            supportsMidConversationSystem: false,
          },
          optionSpecs: {
            reasoningLevel: { values, map: "{}" },
            maxOutputTokens: { max: 32000, map: "{}" },
          },
        },
      })),
    })),
  };
}
