import { useCallback } from "react";
import { usePlatform } from "@/hooks/usePlatform.js";
import { ZCODE_PROJECT_ISSUES_URL } from "@/lib/productLinks.js";

/**
 * 全应用统一的“反馈问题”动作。
 *
 * 自建 fork 没有云端反馈后端：内置提交表单最终 POST 到上游 feedback API 并依赖账号 JWT，
 * 未登录上游账号时提交必然失败。任务菜单、帮助菜单、命令面板因此都改成直接打开项目
 * issue 页；用户可以用同菜单的“复制日志路径 / 导出日志”把日志附到 issue 里。
 */
export function useOpenIssueReport(): () => void {
  const platform = usePlatform();
  return useCallback(() => {
    platform.openExternal(ZCODE_PROJECT_ISSUES_URL);
  }, [platform]);
}
