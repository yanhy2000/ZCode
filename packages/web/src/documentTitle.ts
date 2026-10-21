/**
 * 浏览器标签页标题统一收口。
 *
 * 标题属于「对外身份」，与桌面端的任务栏 / 快捷方式 / 关于页保持一致，
 * 使用安装身份 `ZCode Dev`；页面内正文、菜单和按钮文案仍是产品名 `ZCode`。
 * 这样同一台机器上官方 ZCode 与本 fork 同时打开时，浏览器标签和任务栏都能分辨。
 *
 * 注意：`index.html` 里的静态 `<title>` 是 JS 执行前的兜底值，改名时必须同步修改，
 * 否则首屏会短暂显示旧标题（见 packages/web/index.html）。
 */
export const WEB_PRODUCT_DISPLAY_NAME = "ZCode Dev";

/** Web 远控主界面 / 等待页 / 加载页。 */
export const WEB_REMOTE_CONTROL_DOCUMENT_TITLE = `${WEB_PRODUCT_DISPLAY_NAME} - Web Remote Control`;

/** 远控登录页与 OAuth 回调页。 */
export const WEB_REMOTE_CONTROL_SIGN_IN_DOCUMENT_TITLE = `${WEB_PRODUCT_DISPLAY_NAME} - Web Remote Control Sign In`;

/** 直连 Web + Server 模式。 */
export const WEB_SERVER_DOCUMENT_TITLE = `${WEB_PRODUCT_DISPLAY_NAME} - Web + Server`;

/**
 * 会话分享页需要跟随路由语言切换标题。
 * 分享页原来在中文下用「ZCode 会话分享」，这里保持同一套措辞，只替换对外身份。
 */
export function resolveConversationShareDocumentTitle(locale: string): string {
  return locale === "zh-CN"
    ? `${WEB_PRODUCT_DISPLAY_NAME} 会话分享`
    : `${WEB_PRODUCT_DISPLAY_NAME} Conversation Share`;
}
