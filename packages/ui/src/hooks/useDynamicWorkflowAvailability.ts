import { useEffect, useMemo, useRef } from "react";
import type { IZCodeAgentService } from "@zcode/services";
import type { DynamicWorkflowMode } from "@zcode/shared";
import { logger } from "@/logger.js";
import {
  useDynamicWorkflowAvailabilityStore,
  type DynamicWorkflowAvailabilitySnapshot,
} from "@/store/dynamicWorkflowAvailabilityStore.js";

/**
 * 读动态工作流能力快照。自维护版固定提供 alwaysOn，快照由本地「提供」+ 设置里的用户选择合成，
 * 只读本地 store。
 */
export function useDynamicWorkflowAvailability(): DynamicWorkflowAvailabilitySnapshot {
  const status = useDynamicWorkflowAvailabilityStore((state) => state.status);
  const enabled = useDynamicWorkflowAvailabilityStore((state) => state.enabled);
  const config = useDynamicWorkflowAvailabilityStore((state) => state.config);
  return useMemo(() => ({ status, enabled, config }), [config, enabled, status]);
}

/**
 * app 会话级初始化，挂在 Root 里一次。保留该 hook 以维持既有调用边界，
 * 当前实现只按本地固定「提供」还原快照。
 */
export function useDynamicWorkflowAvailabilityLoader(): void {
  const ensureLoaded = useDynamicWorkflowAvailabilityStore((state) => state.ensureLoaded);
  useEffect(() => {
    void ensureLoaded();
  }, [ensureLoaded]);
}

/**
 * 用户选择变化后的同步（docs/dynamic-workflow/launch.md「The user's choice」），挂在 Root 里一次。
 * 设置文件是选择的唯一来源；任何窗口写入后，共享设置广播让每个窗口的 Root 都读到新值：
 *   - 先按最新选择重算本地快照，设置行与工作流入口立即反映用户选择（Host 是另一个进程，要等重发策略）；
 *   - 首次读到的值只是基线：Host 启动时自己会读设置文件，不需要信号；
 *   - 多次变化串行：上一轮「信号 → 重读」完成后才开始下一轮，慢的重读不会盖掉新结果；
 *   - Host 同步失败仍重读：快照以本地选择为准。
 */
export function useDynamicWorkflowUserModeSync(params: {
  settingsLoaded: boolean;
  userMode: DynamicWorkflowMode | undefined;
  zcodeAgentService: Pick<IZCodeAgentService, "syncDynamicWorkflowUserMode">;
}): void {
  const { settingsLoaded, userMode, zcodeAgentService } = params;
  const applyUserMode = useDynamicWorkflowAvailabilityStore((state) => state.applyUserMode);
  const reload = useDynamicWorkflowAvailabilityStore((state) => state.reload);
  const observedRef = useRef<{ userMode: DynamicWorkflowMode | undefined } | null>(null);
  const chainRef = useRef<Promise<void>>(Promise.resolve());
  useEffect(() => {
    if (!settingsLoaded) return;
    const observed = observedRef.current;
    observedRef.current = { userMode };
    if (observed === null) {
      applyUserMode(userMode);
      return;
    }
    if (observed.userMode === userMode) return;
    applyUserMode(userMode);
    chainRef.current = chainRef.current.then(async () => {
      try {
        await zcodeAgentService.syncDynamicWorkflowUserMode(userMode ? { mode: userMode } : {});
      } catch (error) {
        logger.warn("[dynamic-workflow] 用户选择同步到 Host 失败", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
      await reload();
    });
  }, [applyUserMode, reload, settingsLoaded, userMode, zcodeAgentService]);
}
