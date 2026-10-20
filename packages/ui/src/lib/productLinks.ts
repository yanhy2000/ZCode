// 产品与项目入口统一收口，避免不同菜单跳到不一致的地址。
export const ZCODE_PRODUCT_DOCS_URL = "https://zcode.z.ai/docs";

/**
 * 问题反馈统一指向本仓库的 GitHub issue 页。
 *
 * 自建 fork 没有云端反馈后端：旧的内置提交表单最终会 POST 到上游 feedback API 并依赖
 * 账号 JWT，本仓库不登录上游账号时必然提交失败。帮助菜单、任务菜单和命令面板因此都不再
 * 打开那个表单，直接跳转 issue 页（仓库 owner 后续开放 issue）。
 */
export const ZCODE_PROJECT_ISSUES_URL = "https://github.com/yanhy2000/ZCode/issues";
