# 反馈入口（已下线）

> **2026-10 自建 fork：** 云端反馈链路已在 UI 层物理删除，此文档仅保留决策记录。

## 现状

自建 fork 没有云端反馈后端。上游的反馈提交流程依赖 `/feedback/ticket` API 与账号 JWT，
本仓库不登录上游账号，提交必然失败。因此：

- **已删除**：`packages/ui/src/feedback/` 整个目录（`FeedbackCenter`、`FeatureRequestDialog`、
  提交表单、截图选择、工单列表、后台 job 状态机等 28 个文件）及其单测、E2E 用例与 fixture。
- **保留**：`IFeedbackService` 的类型与 services 实现仍在 `packages/services` 与 `packages/client`，
  只是目前没有 UI 调用方。重新启用前必须先把 `config/default.json` 的 `feedback_url` 指向可用的自建后端。

## 现有入口

所有“问题上报 / 反馈问题”入口统一指向 `ZCODE_PROJECT_ISSUES_URL`：

| 入口 | 行为 |
| --- | --- |
| 帮助菜单 | 打开项目 issue 页 |
| 命令面板 | 打开项目 issue 页 |
| 任务右键菜单 | 打开项目 issue 页 |
| 聊天错误横幅 | 复制脱敏报错摘要到剪贴板，再打开 issue 页 |
| session 订阅错误页 | 复制脱敏错误与任务上下文，再打开 issue 页 |
| 远程连接失败页 | 复制脱敏错误与连接日志，再打开 issue 页 |

需要复制是因为错误详情、TraceID 和连接日志对定位问题很关键，而 issue 页无法自动预填。
复制失败时不阻断跳转。

## 已删除的历史设计

原提交流程的表单布局、字段映射、日志上传白名单、脱敏策略和“我的反馈”列表等设计细节
已随代码一并删除，不再维护。若将来接入自建后端，需重新设计并补充验收场景。
