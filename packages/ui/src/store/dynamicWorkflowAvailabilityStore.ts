import { create } from "zustand";
import {
  applyDynamicWorkflowUserMode,
  resolveSelfHostDynamicWorkflowOffer,
  type DynamicWorkflowClientConfig,
  type DynamicWorkflowMode,
} from "@zcode/shared";

// ============================================================
// 动态工作流能力快照在 renderer 的唯一副本
// ============================================================
//
// 自维护版不再读取云端灰度（docs/specs/selfhost-runtime.md「工作流」）：快照 = 本地固定的
// 「提供 alwaysOn」套上设置里的用户选择。用户选择由 Root 读到设置后经 applyUserMode 送进来，
// 所以切换页面、重开设置或重启后都显示最后一次保存的选择；Host 用同一规则算生效模式并下发 CLI。
//
// 修复原因：此前 store 把整份快照硬编码成 alwaysOn（连 mode 一起），用户改设置后切页回来
// 仍然是「始终开启」——设置行读到的是写死的 mode，与设置文件无关。

const LOCAL_OFFER = resolveSelfHostDynamicWorkflowOffer();

export type DynamicWorkflowAvailabilityStatus = "loading" | "ready";

export interface DynamicWorkflowAvailabilitySnapshot {
  readonly status: DynamicWorkflowAvailabilityStatus;
  readonly enabled: boolean;
  readonly config: DynamicWorkflowClientConfig | null;
}

interface DynamicWorkflowAvailabilityState extends DynamicWorkflowAvailabilitySnapshot {
  /** 最近一次从设置读到的用户选择；重算快照时保留，避免重读把显示打回默认。 */
  userMode: DynamicWorkflowMode | undefined;
  ensureLoaded(): Promise<void>;
  refresh(): Promise<void>;
  reload(): Promise<void>;
  applyUserMode(userMode: DynamicWorkflowMode | undefined): void;
}

function resolveSnapshot(userMode: DynamicWorkflowMode | undefined): DynamicWorkflowAvailabilitySnapshot {
  const config = applyDynamicWorkflowUserMode(LOCAL_OFFER, userMode);
  return { status: "ready", enabled: config.enabled, config };
}

const INITIAL_SNAPSHOT: DynamicWorkflowAvailabilitySnapshot = resolveSnapshot(undefined);

export const useDynamicWorkflowAvailabilityStore = create<DynamicWorkflowAvailabilityState>(
  (set, get) => {
    const recompute = () => {
      const { userMode } = get();
      set({ ...resolveSnapshot(userMode), userMode });
    };

    return {
      ...INITIAL_SNAPSHOT,
      userMode: undefined,

      applyUserMode(userMode: DynamicWorkflowMode | undefined): void {
        set({ ...resolveSnapshot(userMode), userMode });
      },

      ensureLoaded(): Promise<void> {
        recompute();
        return Promise.resolve();
      },

      refresh(): Promise<void> {
        recompute();
        return Promise.resolve();
      },

      reload(): Promise<void> {
        recompute();
        return Promise.resolve();
      },
    };
  },
);

/** 测试用：重置快照。 */
export function resetDynamicWorkflowAvailabilityStoreForTests(): void {
  useDynamicWorkflowAvailabilityStore.setState({ ...INITIAL_SNAPSHOT, userMode: undefined });
}
