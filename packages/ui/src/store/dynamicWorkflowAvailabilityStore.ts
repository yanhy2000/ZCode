import { create } from "zustand";
import {
  createDynamicWorkflowClientConfig,
  type DynamicWorkflowClientConfig,
} from "@zcode/shared";

// ============================================================
// 动态工作流能力快照在 renderer 的唯一副本
// ============================================================
//
// 自维护版不再读取云端灰度：动态工作流固定为 alwaysOn，Host 与 renderer 使用同一份
// 本地配置。这里保留 store 是为了消费方仍能按 ready/enabled 的既有契约读取。

export type DynamicWorkflowAvailabilityStatus = "loading" | "ready";

export interface DynamicWorkflowAvailabilitySnapshot {
  readonly status: DynamicWorkflowAvailabilityStatus;
  readonly enabled: boolean;
  readonly config: DynamicWorkflowClientConfig | null;
}

const ALWAYS_ON_CONFIG = createDynamicWorkflowClientConfig("alwaysOn", "default");

interface DynamicWorkflowAvailabilityState extends DynamicWorkflowAvailabilitySnapshot {
  ensureLoaded(): Promise<void>;
  refresh(): Promise<void>;
  reload(): Promise<void>;
}

const INITIAL_SNAPSHOT: DynamicWorkflowAvailabilitySnapshot = {
  status: "ready",
  enabled: true,
  config: ALWAYS_ON_CONFIG,
};

export const useDynamicWorkflowAvailabilityStore = create<DynamicWorkflowAvailabilityState>(
  (set) => ({
    ...INITIAL_SNAPSHOT,

    ensureLoaded(): Promise<void> {
      set(INITIAL_SNAPSHOT);
      return Promise.resolve();
    },

    refresh(): Promise<void> {
      set(INITIAL_SNAPSHOT);
      return Promise.resolve();
    },

    reload(): Promise<void> {
      set(INITIAL_SNAPSHOT);
      return Promise.resolve();
    },
  }),
);

/** 测试用：重置快照。 */
export function resetDynamicWorkflowAvailabilityStoreForTests(): void {
  useDynamicWorkflowAvailabilityStore.setState({ ...INITIAL_SNAPSHOT });
}
