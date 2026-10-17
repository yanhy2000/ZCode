import type { ClientSceneConfig, ClientSceneItem } from "@zcode/services";

export interface DraftSuggestedPromptLocalizedText {
  cn?: string;
  en?: string;
}

export const DRAFT_SUGGESTED_PROMPT_NAVIGATE_AUTOMATIONS = "NAVIGATE:AUTOMATIONS" as const;

// 自维护构建已移除闲时任务，但云端 draft-suggestion 仍可能下发旧动作。
// 这类推荐项必须在映射前丢弃：如果只移除 action 解析，点击后会退化成把“创建闲时任务”预填进输入框。
const LEGACY_OFFPEAK_NAVIGATION_ACTION = "NAVIGATE:AUTOMATIONS:OFFPEAK";

export type DraftSuggestedPromptAction = typeof DRAFT_SUGGESTED_PROMPT_NAVIGATE_AUTOMATIONS;

export interface DraftSuggestedPromptItem {
  id: string;
  /** Lucide canonical 名称，只来自 ClientSceneItem.img；不使用 imgs。 */
  iconName?: string;
  /** 官方推荐项的市场图标。 */
  iconUrl?: string;
  /** 复用插件市场图标的展示样式，不代表绑定插件。 */
  iconStyle?: "plugin";
  label: DraftSuggestedPromptLocalizedText;
  prompt: DraftSuggestedPromptLocalizedText;
  actions?: DraftSuggestedPromptAction[];
  plugin?: {
    stableId: string;
    label: DraftSuggestedPromptLocalizedText;
  };
}

export function parseDraftSuggestedPromptActions(
  onFinish: string | null | undefined,
): DraftSuggestedPromptAction[] {
  if (!onFinish) return [];

  const actions: DraftSuggestedPromptAction[] = [];
  for (const token of onFinish.split(",")) {
    if (token.trim() === DRAFT_SUGGESTED_PROMPT_NAVIGATE_AUTOMATIONS) {
      if (!actions.includes(DRAFT_SUGGESTED_PROMPT_NAVIGATE_AUTOMATIONS)) {
        actions.push(DRAFT_SUGGESTED_PROMPT_NAVIGATE_AUTOMATIONS);
      }
    }
  }
  return actions;
}

function hasLegacyOffPeakNavigation(promptItem: ClientSceneItem): boolean {
  return (promptItem.on_finish ?? "")
    .split(",")
    .some((token) => token.trim() === LEGACY_OFFPEAK_NAVIGATION_ACTION);
}

function findDefaultItem(
  scene: ClientSceneConfig,
  promptItem: ClientSceneItem,
): ClientSceneItem | undefined {
  for (const [optionKey, itemIds] of Object.entries(promptItem.defaults ?? {})) {
    const optionItems = scene.options[optionKey]?.items;
    if (!optionItems) continue;
    for (const itemId of itemIds) {
      const item = optionItems.find((candidate) => candidate.id === itemId);
      if (item) return item;
    }
  }
  return undefined;
}

export function mapClientScenesToDraftSuggestedPromptItems(
  scenes: readonly ClientSceneConfig[],
): DraftSuggestedPromptItem[] {
  const scene = scenes.find((candidate) => candidate.scene === "draft-suggestion");
  const promptItems = scene?.options.prompts?.items;
  if (!scene || !promptItems) return [];

  return promptItems
    .filter((item) => !hasLegacyOffPeakNavigation(item))
    .map((item) => {
      const defaultItem = findDefaultItem(scene, item);
      const actions = parseDraftSuggestedPromptActions(item.on_finish);
      const stableId = defaultItem?.contents.en?.trim() || defaultItem?.contents.cn?.trim();
      return {
        id: item.id,
        ...(item.img?.trim() ? { iconName: item.img.trim() } : {}),
        label: item.labels,
        prompt: item.contents,
        ...(actions.length > 0 ? { actions } : {}),
        ...(defaultItem && stableId
          ? {
              plugin: {
                stableId,
                label: defaultItem.labels,
              },
            }
          : {}),
      };
    });
}

export function resolveDraftSuggestedPromptText(
  text: DraftSuggestedPromptLocalizedText,
  locale: string,
): string {
  const primary = locale.startsWith("zh") ? text.cn : text.en;
  const fallback = locale.startsWith("zh") ? text.en : text.cn;
  return primary?.trim() || fallback?.trim() || "";
}
