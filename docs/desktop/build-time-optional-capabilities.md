# 桌面构建期能力

自维护构建不再提供官方的 ARMS RUM、产品事件上报和自动下载更新三项构建开关。

| 能力 | 当前行为 |
| --- | --- |
| ARMS RUM | 不初始化，不注入渲染进程桥 |
| 产品事件上报 | 不创建上报链路，遥测 IPC 返回空结果 |
| 自动更新 | 仅检查本项目 GitHub Release，跳转手动下载 |
| 内置 Provider 云刷新 | 固定关闭，保留代码供后续第三方接入参考 |

发布与手动 Windows 构建使用 `ZCODE_ENV=production` 并显式关闭 `ZCODE_PREVIEW_IDENTITY`，产出正式 `ZCode` 身份。
`ZCODE_ENV=test` 的本地/e2e 构建仍会落到 Preview 身份，用于隔离安装和数据。更新检查的仓库和版本规则见
[`docs/specs/selfhost-runtime.md`](../specs/selfhost-runtime.md)。

Agent 的 OTLP 遥测沿用既有机制，由打包环境的 `ZCODE_PACKAGED_AGENT_OTEL_*` 注入，不在本文件范围内。
