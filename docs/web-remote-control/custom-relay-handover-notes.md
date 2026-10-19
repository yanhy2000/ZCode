# Web 远程控制自定义服务器与独立中继交付进度说明

本文件记录「Web 远程控制自定义中继服务器」功能的开发、代码改动、验证结果以及多任务交接细节。

## 1. 核心功能与设计原则

为解决用户自建/自托管 Web 远控中继、消除对官方云端 relay（`zcode.z.ai/ws`）强依赖的需求，本次变更实现了：
1. **独立开源中继网关**：在 `d:\Project\zcode-remote` 构建并验证了独立的 Relay 服务（支持 Docker、HMAC 零登录鉴权、单终端互斥路由、SPA 静态文件代理与健康检查）。
2. **桌面客户端端点自定义**：在 `WebRemoteControlDialog` 增加了「远程服务器设置」输入卡片，支持用户输入自定义服务端地址（如 `http://192.168.1.100:8765`、`https://my-relay.example.com` 等）或一键恢复官方默认服务器。
3. **即时联动刷新**：
   - 用户保存后，写入单一事实源 `AppSettings.webRemoteControlCustomServerUrl`；
   - 桌面端主进程在 `getEndpointUrls` 中动态读取该配置；
   - 自动调用 `platform.refreshWebRemoteControlPairing`，断开旧中继并向新中继重新注册，下方的状态、二维码及复制链接实时刷新。
4. **移动/Web 端端点自适应**：
   - 移动浏览器访问非 `z.ai` 域名/IP 时，自动根据页面地址派生 `${wsProto}//${window.location.host}/ws`，并支持通过 URL `relay` 参数覆盖。

## 2. 代码改动清单 (D:\Project\ZCode)

| 文件路径 | 改动说明 |
| --- | --- |
| `packages/shared/src/protocol.ts` | `AppSettings` 增加 `webRemoteControlCustomServerUrl?: string;` 字段定义 |
| `packages/shared/src/validationAppSettings.ts` | 在 `appSettingsShape` 与 `appSettingsPatchShape` 中注册 Zod 校验规则与 trim 预处理 |
| `packages/shared/src/zcodeEndpoint.ts` | 新增并导出 `resolveWebRemoteControlCustomEndpointUrls`，支持 IP:Port、http/https/ws/wss 格式解析与缺省补全 |
| `packages/shared/test/zcodeEndpoint.test.ts` | 增加端点解析规则与设置持久化的单元测试（29 项单测全通过） |
| `packages/desktop/src/main/index.ts` | 在 `webRemoteControlManager.getEndpointUrls` 中读取 `webRemoteControlCustomServerUrl` 并优先应用自定义端点 |
| `packages/web/src/main.tsx` | `resolveExternalRelayWsUrl` 增加 URL `relay` 参数解析及非 `z.ai` 主机自动派生 `/ws` 逻辑 |
| `packages/ui/src/i18n/locales/zh-CN.ts` | 增加 `webRemoteControl.serverSetting.*` 中文字符串 |
| `packages/ui/src/i18n/locales/en-US.ts` | 增加 `webRemoteControl.serverSetting.*` 英文字符串 |
| `packages/ui/src/WebRemoteControlDialog.tsx` | 增加远程服务器设置 UI 卡片（Input、保存、恢复默认）与事件处理逻辑，保存后自动刷新二维码与连接 |
| `packages/ui/test/webRemoteControlDialogLayout.test.ts` | 补充服务器配置卡片渲染、保存与重置交互的自动化测试（15 项测试全通过） |
| `docs/web-remote-control/custom-relay-endpoint-setting.md` | 新增产品规则、状态所有者、契约与验收场景规范 |

## 3. 验证证据

1. **类型检查**：`pnpm typecheck` 通过（退出码 0，全仓库 0 错误）。
2. **代码风格**：`pnpm lint` 通过（0 错误，89 条存量 warning）。
3. **架构守卫**：`pnpm architecture:check --changed` 通过（violations: 0, baseline: 0, new: 0）。
4. **提交前门禁**：`pnpm verify:pre-push` 全部通过。
5. **单元与布局测试**：
   - `packages/shared/test/zcodeEndpoint.test.ts` 通过（29/29）。
   - `packages/ui/test/webRemoteControlDialogLayout.test.ts` 通过（15/15）。
   - `packages/desktop/test/webRemoteControlManagerExternalRelay.test.ts` 通过（57/57）。

## 4. 多任务并行注意项

- 状态所有者遵循单一写入原则，由 `ISettingService` 统一管理设置落盘与同步，无冗余 store 或竞态条件。
- 若另一个并行任务有合并到 `dev` 分支，提交前请执行 `git fetch origin dev` 与 `git pull --rebase origin dev`，确保无代码冲突后再行推送。
