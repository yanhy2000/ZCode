import { useCallback } from "react";
import { TID_V4_RETRY_SUBSCRIBE } from "@zcode/shared";
import { Button } from "@/components/ui/button.js";
import { useReportErrorToIssue } from "@/hooks/useReportErrorToIssue.js";
import { useZCodeIntl } from "@/i18n/IntlProvider.js";
import { buildErrorFeedbackDescription } from "@/lib/errorFeedbackDraft.js";

export interface SessionSubscriptionErrorPanelProps {
  error: string;
  sessionId: string;
  workspacePath: string;
  onReconnect: () => void;
}

export function SessionSubscriptionErrorPanel({
  error,
  sessionId,
  workspacePath,
  onReconnect,
}: SessionSubscriptionErrorPanelProps) {
  const { intl } = useZCodeIntl();
  const reportErrorToIssue = useReportErrorToIssue();
  const handleOpenFeedback = useCallback(async () => {
    // 反馈入口不再打开内置表单（它 POST 到上游 feedback API，未登录上游账号必然失败），
    // 改为把脱敏后的错误与任务上下文复制到剪贴板并打开项目 issue 页。
    await reportErrorToIssue(
      buildErrorFeedbackDescription({
        message: error,
        contextLines: [
          intl.formatMessage({ id: "feedback.submit.template.section.taskInfo" }),
          intl.formatMessage({ id: "feedback.submit.template.section.taskId" }, { id: sessionId }),
          intl.formatMessage(
            { id: "feedback.submit.template.section.taskWorkspace" },
            { path: workspacePath },
          ),
        ],
        formatMessage: (id: string, values?: Record<string, string>) =>
          intl.formatMessage({ id }, values),
      }),
    );
  }, [error, intl, reportErrorToIssue, sessionId, workspacePath]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-4 text-ui-base">
      <p className="max-w-full break-words text-center font-mono text-destructive">{error}</p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button type="button" variant="outline" onClick={handleOpenFeedback}>
          {intl.formatMessage({ id: "chat.error.feedback" })}
        </Button>
        <Button type="button" data-testid={TID_V4_RETRY_SUBSCRIBE} onClick={onReconnect}>
          {intl.formatMessage({ id: "workspaceSidebar.reconnect" })}
        </Button>
      </div>
    </div>
  );
}
