import type { IPlatformService } from "@zcode/shared";
import type { IntlInstance } from "@/i18n/IntlProvider.js";
import { runExportLogsAction } from "@/lib/exportLogsAction.js";
import { ZCODE_PRODUCT_DOCS_URL, ZCODE_PROJECT_ISSUES_URL } from "@/lib/productLinks.js";

export interface HelpMenuActionHandlers {
  openIssueReport: () => void;
  openProductDocs: () => void;
  exportLogs: () => void;
}

export function createHelpMenuActionHandlers({
  platform,
  intl,
}: {
  platform: Pick<IPlatformService, "exportLogs" | "openExternal">;
  intl: IntlInstance;
}): HelpMenuActionHandlers {
  return {
    openIssueReport: () => {
      // 这里过去打开内置“提交反馈”表单，最终 POST 到上游 feedback API 并依赖账号 JWT；
      // 自建 fork 不登录上游账号，提交必然失败。问题上报改为直接跳转项目 issue 页，
      // 用户可以在那边附上「导出日志」产出的文件。
      platform.openExternal(ZCODE_PROJECT_ISSUES_URL);
    },
    openProductDocs: () => {
      platform.openExternal(ZCODE_PRODUCT_DOCS_URL);
    },
    exportLogs: () => {
      void runExportLogsAction(platform, intl);
    },
  };
}
