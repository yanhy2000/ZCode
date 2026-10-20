import { describe, expect, it } from "vitest";
import { withTitleGenerationSelection } from "@/v4/composer/useDraftConfigControl.js";

describe("withTitleGenerationSelection", () => {
  it("未配置标题模型时原样返回，payload 不带该键", () => {
    const payload = { config: { modelSelection: { providerId: "a", modelId: "m1" } } };

    // undefined 表示“跟随会话模型”：必须保持 payload 不变，
    // 否则 CLI 会收到一个空 Selection 并在创建期校验失败。
    expect(withTitleGenerationSelection(payload, undefined)).toBe(payload);
    expect(withTitleGenerationSelection(payload, undefined).config).not.toHaveProperty(
      "titleGenerationModelSelection",
    );
  });

  it("配置后把 Selection 并入 config，且保留草稿已有的选择", () => {
    const selection = {
      providerId: "glm",
      modelId: "glm-5.3-flash",
      options: { reasoningLevel: "low" },
    };

    const merged = withTitleGenerationSelection(
      { config: { modelSelection: { providerId: "a", modelId: "m1" } } },
      selection,
    );

    expect(merged.config).toEqual({
      modelSelection: { providerId: "a", modelId: "m1" },
      titleGenerationModelSelection: selection,
    });
  });

  it("payload 原本没有 config 时也能补上", () => {
    const selection = { providerId: "glm", modelId: "glm-5.3-flash" };

    expect(withTitleGenerationSelection({}, selection)).toEqual({
      config: { titleGenerationModelSelection: selection },
    });
  });
});
