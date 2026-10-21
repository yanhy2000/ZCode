import { useCallback } from "react";
import { toast } from "@/components/ui/toast.js";
import { usePlatform } from "@/hooks/usePlatform.js";
import { useZCodeIntl } from "@/i18n/IntlProvider.js";
import { ZCODE_PROJECT_ISSUES_URL } from "@/lib/productLinks.js";

/**
 * 把一段已脱敏的错误摘要复制到剪贴板，再打开项目 issue 页。
 *
 * 自建 fork 没有云端反馈后端：内置表单最终 POST 到上游 feedback API 并依赖账号 JWT，
 * 未登录上游账号时必然失败。但错误详情、traceId 和连接日志对定位问题很关键，
 * 直接跳转 issue 会让用户无从填写，所以先复制再由用户粘贴。
 *
 * 复制失败不阻断跳转：issue 页仍然是比“提交必然失败的表单”更好的去处。
 */
export function useReportErrorToIssue(): (description: string) => Promise<void> {
  const platform = usePlatform();
  const { intl } = useZCodeIntl();
  return useCallback(
    async (description: string) => {
      let copied = false;
      try {
        if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(description);
          copied = true;
        }
      } catch {
        copied = false;
      }
      platform.openExternal(ZCODE_PROJECT_ISSUES_URL);
      toast(
        intl.formatMessage({
          id: copied ? "chat.error.issueReportCopied" : "chat.error.feedbackOpened",
        }),
      );
    },
    [intl, platform],
  );
}
