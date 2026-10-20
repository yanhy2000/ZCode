import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const captured = vi.hoisted(() => ({
  updates: [] as unknown[],
  settings: {
    titleGenerationModelSelection: {
      providerId: "glm",
      modelId: "glm-5.3-flash",
      options: { reasoningLevel: "low" },
    },
  } as Record<string, unknown>,
  state: { status: "ready" } as Record<string, unknown>,
}));

vi.mock("@/i18n/IntlProvider.js", () => ({
  useZCodeIntl: () => ({
    intl: { formatMessage: ({ id }: { id: string }) => id },
  }),
}));

vi.mock("@/hooks/useSettingService.js", () => ({
  useSettings: () => ({
    settings: captured.settings,
    update: (patch: unknown) => {
      captured.updates.push(patch);
      return Promise.resolve();
    },
  }),
}));

vi.mock("@/hooks/useWorkspaceServices.js", () => ({
  useBaseWorkspaceServices: () => ({ modelSelectionService: {} }),
}));

vi.mock("@/hooks/useModelSelectionView.js", () => ({
  useModelSelectionServiceView: () => ({ state: captured.state, reload: () => {} }),
}));

vi.mock("@/lib/modelSelectionGroups.js", () => ({
  buildRegistryModelSelectGroups: () => [
    { key: "g", label: "GLM", items: [{ key: "i", value: "glm/glm-5.3-flash", name: "GLM-5.3" }] },
  ],
}));

vi.mock("@/ModelConfigSelect.js", () => ({
  ModelConfigSelect: ({ triggerLabel }: { triggerLabel: string }) =>
    createElement("span", { "data-testid": "model-trigger" }, triggerLabel),
}));

vi.mock("@/settings/SubagentReasoningField.js", () => ({
  SubagentReasoningField: ({ state }: { state: { kind: string } }) =>
    createElement("i", { "data-testid": "reasoning", "data-kind": state.kind }),
}));

vi.mock("@/lib/modelThoughtOption.js", () => ({
  resolveModelThoughtOption: () => ({ id: "reasoningLevel", currentValue: "low", values: [] }),
}));

vi.mock("@/lib/zcodeSessionProjection.js", () => ({
  parseModelPickerValue: (value: string) => ({ providerId: "glm", modelId: value }),
}));

vi.mock("@zcode/provider", () => ({
  completeNewModelSelection: () => ({ providerId: "glm", modelId: "glm-5.3-flash" }),
}));

describe("TitleGenerationModelSetting", () => {
  it("展示已配置的标题模型，并渲染思考强度控件", async () => {
    const { TitleGenerationModelSetting } = await import(
      "@/settings/TitleGenerationModelSetting.js"
    );

    const html = renderToStaticMarkup(createElement(TitleGenerationModelSetting));

    expect(html).toContain("glm-5.3-flash");
    expect(html).toContain('data-testid="reasoning"');
    expect(html).toContain('data-kind="supported"');
  });

  it("未配置时展示“跟随会话模型”文案", async () => {
    captured.settings = {};
    try {
      const { TitleGenerationModelSetting } = await import(
        "@/settings/TitleGenerationModelSetting.js"
      );

      const html = renderToStaticMarkup(createElement(TitleGenerationModelSetting));

      expect(html).toContain("settings.titleGenerationModelInherit");
    } finally {
      captured.settings = {
        titleGenerationModelSelection: {
          providerId: "glm",
          modelId: "glm-5.3-flash",
          options: { reasoningLevel: "low" },
        },
      };
    }
  });

  it("模型列表不可用时显示占位而不是崩掉", async () => {
    captured.state = { status: "loading" };
    try {
      const { TitleGenerationModelSetting } = await import(
        "@/settings/TitleGenerationModelSetting.js"
      );

      const html = renderToStaticMarkup(createElement(TitleGenerationModelSetting));

      expect(html).toContain("common.loading");
    } finally {
      captured.state = { status: "ready" };
    }
  });
});
