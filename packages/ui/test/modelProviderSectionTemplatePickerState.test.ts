import { describe, expect, it } from "vitest";
import { resolveModelProviderTemplatePickerState } from "@/settings/ModelProviderSection.js";

describe("resolveModelProviderTemplatePickerState", () => {
  it("左列表为空且加载完成时强制显示模板页，并隐藏无意义的返回按钮", () => {
    expect(
      resolveModelProviderTemplatePickerState({
        templatePickerOpen: false,
        loading: false,
        navigationItemCount: 0,
      }),
    ).toEqual({ visible: true, showBackButton: false });
  });

  it("首屏加载未完成时保持原有加载态，不抢占为模板页", () => {
    expect(
      resolveModelProviderTemplatePickerState({
        templatePickerOpen: false,
        loading: true,
        navigationItemCount: 0,
      }),
    ).toEqual({ visible: false, showBackButton: true });
  });

  it("有供应商时由“添加供应商”入口控制，返回按钮保留", () => {
    expect(
      resolveModelProviderTemplatePickerState({
        templatePickerOpen: true,
        loading: false,
        navigationItemCount: 2,
      }),
    ).toEqual({ visible: true, showBackButton: true });
    expect(
      resolveModelProviderTemplatePickerState({
        templatePickerOpen: false,
        loading: false,
        navigationItemCount: 2,
      }),
    ).toEqual({ visible: false, showBackButton: true });
  });
});
