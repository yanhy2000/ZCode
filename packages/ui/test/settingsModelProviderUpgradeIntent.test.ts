import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

// 说明：Coding Plan 升级 / 购买面板入口（codingPlanPurchaseAuth、CODING_PLAN_PROVIDER_SPECS、
// useCodingPlanUpgradeDialog、plan 卡片与 upgrade intent 等）已随套餐商业面移除；
// 仅保留 no-model 入口直达「模型供应商」设置的行为。
describe("settings model provider entry intent", () => {
  it("opens no-model Set action directly to model provider settings", () => {
    const composerToolbarSource = readSource("packages/ui/src/v4/composer/V4ComposerToolbar.tsx");

    expect(composerToolbarSource).toContain('setPendingSettingsSectionIntent("modelProvider")');
    expect(composerToolbarSource).toContain("handleOpenModelProviderSettings");
    expect(composerToolbarSource).toContain("onManageModels={handleOpenModelProviderSettings}");
    expect(composerToolbarSource).not.toContain("onManageModels={openSettingsTab}");
  });
});
