import { useMemo } from "react";
import { completeNewModelSelection } from "@zcode/provider";
import { ZCODE_AGENT_PROVIDER } from "@zcode/shared";
import type { ModelSelectFooterAction, ModelSelectGroup } from "@/ModelConfigSelect.js";
import { ModelConfigSelect } from "@/ModelConfigSelect.js";
import { buildRegistryModelSelectGroups } from "@/lib/modelSelectionGroups.js";
import { useModelSelectionServiceView } from "@/hooks/useModelSelectionView.js";
import { useBaseWorkspaceServices } from "@/hooks/useWorkspaceServices.js";
import { useSettings } from "@/hooks/useSettingService.js";
import { useZCodeIntl } from "@/i18n/IntlProvider.js";
import { parseModelPickerValue } from "@/lib/zcodeSessionProjection.js";
import { resolveModelThoughtOption } from "@/lib/modelThoughtOption.js";
import {
  SubagentReasoningField,
  type SubagentReasoningFieldState,
} from "@/settings/SubagentReasoningField.js";

/** 未选择模型时的哨兵值，表示“跟随会话当前模型与思考强度”。 */
const INHERIT_TITLE_MODEL_VALUE = "";
/** 标题模型固定不做连接级锁定；可见性已由候选列表本身决定。 */
const MODEL_ITEM_NEVER_LOCKED = () => false;

/**
 * 标题生成模型设置。
 *
 * 标题 sidecar 默认跟随会话当前的模型与思考强度；这里允许单独指定，用于
 * “主对话用强模型、标题用小模型”这类成本/延迟取舍。选择结果在 createSession 时
 * 作为 runtime 创建期配置下发，只影响 session_title / goal_summary_title 请求。
 */
export function TitleGenerationModelSetting() {
  const { intl } = useZCodeIntl();
  const { settings, update } = useSettings();
  // 设置页管理的始终是本地全局偏好，模型候选同样只能来自 Local Host，
  // 不能跟随远端 workspace 的 View（与 SubagentsSection 一致）。
  const localHostServices = useBaseWorkspaceServices();
  const { state } = useModelSelectionServiceView(localHostServices.modelSelectionService);

  const selection = settings?.titleGenerationModelSelection;
  const modelGroups = useMemo<ModelSelectGroup[]>(
    () =>
      state.status === "ready"
        ? buildRegistryModelSelectGroups(ZCODE_AGENT_PROVIDER, state.view)
        : [],
    [state],
  );
  const footerActions = useMemo<ModelSelectFooterAction[]>(
    () => [
      {
        key: "title-generation-model:inherit",
        label: intl.formatMessage({ id: "settings.titleGenerationModelInherit" }),
        onSelect: () => {
          void update({ titleGenerationModelSelection: undefined });
        },
        selected: !selection,
      },
    ],
    [intl, selection, update],
  );

  if (state.status !== "ready") {
    return (
      <span className="text-ui-sm text-foreground-subtle">
        {intl.formatMessage({
          id:
            state.status === "loading"
              ? "common.loading"
              : "settings.titleGenerationModelUnavailable",
        })}
      </span>
    );
  }

  const normalizedValue = selection
    ? formatTitleModelValue(selection.providerId, selection.modelId, selection.options?.reasoningLevel)
    : INHERIT_TITLE_MODEL_VALUE;
  const triggerLabel =
    selection?.modelId ?? intl.formatMessage({ id: "settings.titleGenerationModelInherit" });

  const handleValueChange = (nextValue: string) => {
    if (nextValue === INHERIT_TITLE_MODEL_VALUE) {
      void update({ titleGenerationModelSelection: undefined });
      return;
    }
    // 档位必须与模型一起落库：标题请求按 Selection 直接创建 Model，
    // 缺 reasoningLevel 时会在执行侧被当成非法请求。
    const next = completeNewModelSelection(state.view, parseModelPickerValue(nextValue));
    if (!next) return;
    void update({ titleGenerationModelSelection: next });
  };

  // 思考强度与模型成对保存：切模型时用新模型的默认档位，单独调档位只改 options。
  const thoughtOption = selection
    ? resolveModelThoughtOption({
        modelSelectionView: state.view,
        providerId: selection.providerId,
        modelId: selection.modelId,
        currentValue: selection.options?.reasoningLevel,
      })
    : null;
  const thoughtState: SubagentReasoningFieldState = thoughtOption
    ? { kind: "supported", option: thoughtOption }
    : { kind: "not-applicable" };
  const handleThoughtLevelCommit = (reasoningLevel: string) => {
    if (!selection || reasoningLevel === selection.options?.reasoningLevel) return;
    void update({
      titleGenerationModelSelection: {
        ...selection,
        options: { ...selection.options, reasoningLevel },
      },
    });
  };

  return (
    // 两个控件并排共享同一行：下拉框按内容宽度自适应（长模型名截断），
    // 思考级别固定不压缩，避免窄列下被挤出可视区。
    <div className="flex min-w-0 max-w-full items-center justify-end gap-2">
      <ModelConfigSelect
        modelGroups={modelGroups}
        normalizedValue={normalizedValue}
        triggerLabel={triggerLabel}
        showManageModelsAction={false}
        lockReasonMessage=""
        isItemLocked={MODEL_ITEM_NEVER_LOCKED}
        onValueChange={handleValueChange}
        footerActions={footerActions}
        manageModelsLabel={intl.formatMessage({ id: "chat.toolbar.model.manageModels" })}
        contentSide="bottom"
        contentAlign="end"
        focusSelectorOnClose={null}
        labelVisibilityClassName="inline-flex min-w-0"
        triggerClassName="h-8 w-auto min-w-0 max-w-52 shrink justify-between rounded-lg border border-input-border bg-input px-3 py-1.5 text-foreground hover:border-input-border-hover hover:bg-input focus-visible:border-input-border-focused focus-visible:bg-input-focused"
        triggerLabelClassName="inline-flex min-w-0 truncate text-left [&_span]:min-w-0 [&_span]:truncate"
      />
      <div className="shrink-0">
        <SubagentReasoningField
          intl={intl}
          state={thoughtState}
          disabled={false}
          labelVisibilityClassName="hidden sm:inline-flex"
          onValueCommit={handleThoughtLevelCommit}
        />
      </div>
    </div>
  );
}

/** 与 UI 其他 ModelSelection 展示值同构：`provider/model$reasoningLevel`。 */
function formatTitleModelValue(
  providerId: string,
  modelId: string,
  reasoningLevel: string | undefined,
): string {
  return reasoningLevel ? `${providerId}/${modelId}$${reasoningLevel}` : `${providerId}/${modelId}`;
}
