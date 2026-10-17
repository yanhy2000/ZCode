# 自维护构建：版本、更新与外部能力边界

## 目标

本仓库以 `zai-org/ZCode` 的稳定 tag 为上游基线，产出仅供自己使用的 Windows 安装包。构建不再连接官方更新、强更、遥测和内置 Provider 云刷新链路；插件市场与手机远控保持原样。

## 版本规则

- 版本号格式为 `<私有版本>+<官方基线版本>`，两者都是 `major.minor.patch`，例如 `1.0.0+3.15.1`。
- 根 `package.json` 与 `apps/zcode-cli/package.json` 使用同一个版本号；桌面构建元数据、CLI `__CLI_VERSION__` 与安装包文件名都从它派生。
- Windows 安装包命名为 `ZCode-<version>-win-<arch>.exe`，例如 `ZCode-1.0.0+3.15.1-win-x64.exe`。
- Release tag 为 `v<version>`，例如 `v1.0.0+3.15.1`；tag 必须与 `package.json` 完全一致。
- 版本比较按“私有版本优先，官方基线次之”的二元组进行。SemVer 会忽略 `+` 之后的 build metadata，因此更新检查不得直接使用 `semver.gt`。

## 产品身份与数据目录

- 发布与手动 Windows 构建固定使用 production 身份：
  - `productName`：`ZCode`
  - `appId` / Windows AUMID：`dev.zcode.app`
  - Linux executable / package：`zcode`
- 快捷方式、开始菜单、托盘、About、卸载项只显示 `ZCode`，不出现 `Preview`。
- 正式身份会替换同机已安装的官方 ZCode，不能再与官方版并排安装。
- Electron 用户数据使用 `%APPDATA%\ZCode`，业务数据继续使用 `~/.zcode`；两者都不因身份切换而迁移。
- 首次从官方版或 Preview 版切换过来前，先备份 `%APPDATA%\ZCode` 和 `%USERPROFILE%\.zcode`。如果官方安装版本高于当前上游基线，必须先确认数据格式可回退，不能只依赖安装包覆盖。
- `ZCODE_PREVIEW_IDENTITY` 只保留给 `ZCODE_ENV=test` 的本地/e2e 构建；发布与手动 Windows 构建必须显式产出 production 身份。
- `Build Windows` 不提供 `product_identity` 输入；`release.yml` 直接复用正式身份构建。

## 更新检查

### 来源

- 只读取 `https://api.github.com/repos/yanhy2000/ZCode/releases/latest`。
- 只接受已发布、非 draft、非 prerelease 的 release；tag 必须能被解析为 `v<私有版本>+<官方基线>`。
- 发现新版本时只打开 release 页面，不在客户端下载、安装或重启。
- 不读取官方 `/api/v1/client/configs`、`minimalVersion`、stable/preview channel，也不初始化 `electron-updater`。

### 自动检查

- 仅打包态启用；启动后延迟 20 秒检查一次，此后每 6 小时检查一次。
- 发现新版本时每个应用会话最多提示一次；用户关闭提示后本次会话不再弹出。
- 自动检查失败只写日志，不打扰用户。

### 手动检查

入口：

- 右上角帮助菜单（macOS 应用菜单、Windows 标题栏帮助菜单、Web 桌面帮助菜单）。
- Windows/Linux 托盘右键菜单。

入口对所有产品身份可见。点击后：

| 结果              | 行为                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------ |
| 发现新版本        | 原生对话框显示当前版本和目标版本，按钮为“打开下载页 / 稍后”；打开 `release.html_url` |
| 已是最新          | 原生对话框提示当前已是最新版本                                                       |
| 网络不可达 / 超时 | 提示无法连接 GitHub，并建议检查网络或代理                                            |
| HTTP 404          | 提示仓库尚无已发布 release                                                           |
| HTTP 403 / 429    | 提示 GitHub API 请求受限或频率过高                                                   |
| 响应格式异常      | 提示无法解析 release 信息                                                            |
| 其他 HTTP 错误    | 提示状态码，保留重试入口                                                             |

手动检查进行中时菜单项禁用，避免并发请求。

## 设置项

删除以下设置及其 UI、IPC、platform 方法和持久化字段：

- `receivePreviewUpdates`（接受预览版更新）
- `autoDownloadAndInstallUpdates`（自动下载并安装更新）

旧的 setting.json 中出现这些键时按未知字段忽略，不参与任何行为。

## 遥测

- 不初始化 ARMS RUM，不创建产品事件上报链路，不注册资源、网络、稳定性或数据体积上报定时器。
- 不向官方端点发送 app launch、DAU、远程使用、MCP、更新等事件。
- 保留本地日志和本地崩溃转储，用于本机排查；日志不得包含凭据或用户数据。
- 移除 `ZCODE_ARMS_RUM_ENDPOINT`、`ZCODE_TELEMETRY_REPORT_ENDPOINT` 的构建注入与使用。

## 内置 Provider 云刷新

- 保留 `zcodeBuiltinRemote` 的构造代码，供后续第三方接入参考。
- 自维护构建固定关闭：不创建 `zcodeBuiltinRemote`，不访问官方 release 拉取内置 Provider 配置。
- 通过显式开关控制，后续替换为自有第三方 Provider 逻辑时再删除。

## 工作流

- 自维护构建固定提供 `alwaysOn`，不再请求官方 `/api/v1/client/configs` 的 `dynamicWorkflow` 灰度。
- 服务端无法远程关闭或降级该功能；设置里的“关闭 / 通过命令启用 / 始终开启”选择仍然生效，默认跟随 `alwaysOn`。
- 未打包 dev 的合法 `ZCODE_DYNAMIC_WORKFLOW_MODE` 覆盖保留，仅供本地调试；打包态不接受外部环境改写。
- 本地 Host 与 SSH/WSL/Docker 远程 Host 使用同一结论，不再依赖云端配置。
- 用户可见名称统一为“工作流 / Workflows”；内部协议字段和代码标识仍使用 `dynamicWorkflow`。

## 桌面呈现面

- 自维护构建不读取官方 `desktopContextPrompt` 云端灰度，也不再传递 `ZCODE_DESKTOP_CONTEXT_PROMPT_ENABLED`。
- 本地 Desktop Host 与 desktop-attached remote Host 固定使用 desktop presentation surface；普通 HTTP/manual app-server 没有 Desktop 宿主事实，仍为 terminal。
- 因此 Desktop 的 system prompt、Gen UI 输出目录与内联评论能力不再受离线或未登录影响。

## 强制更新

- 启动流程不请求官方 `minimalVersion`，不展示官方强更弹窗。
- 删除 `forceUpdateGuard` 的启动调用；本地未打包 dev 与打包自维护包行为一致。

## 不变项

- 插件市场继续启用。
- 手机远控继续使用现有 relay 与 attachment 链路。
- 第三方模型、工具、MCP、Skill 行为不变。

## 官方云控与商业功能移除

自维护构建只保留第三方 Provider 所需的本地配置、模型选择与执行链路。以下官方云控或商业功能不再提供：

- 渲染器动作追踪：物理删除 UI `userActionTelemetry` 辅助函数、shared `rendererActionTrace` schema、platform/channels 类型与全部调用点；点击操作直接执行，不产生 renderer action span 或本地 TTFT 上报。
- 闲时任务（Off-Peak task）：移除 UI 入口、任务调度、Host 协议、服务端取号与模型选择分支。
- 请求验证（Request Verification）：物理删除 shared `verification-policy`、UI claim/error/parity/messages、CLI recovery 空壳、Coding Plan claim 头与 3007 错误映射；Provider runtime headers 的账号鉴权刷新链路保留，但不再携带 verification reason/proof。
- 强制更新（forceUpdate / minimalVersion）：移除残留类型、Provider 方法、Main 标志与文案。
- Coding Plan 商品目录、团队静态商品、体验套餐预览与账单折扣：移除解析、服务方法与展示组件；不读取对应 client/configs 字段。
- 漏洞上报（zsrc）：移除公开配置字段、帮助菜单入口与文案。
- 官方账号、登录、套餐、余额、权益、Rewards、营销触达与官方模型准入：移除客户端入口与服务调用。

保留：

- 第三方 Provider 的 registry、API key / baseURL、模型配置、模型选择、对话与工具链路。
- 插件市场排序 `pluginStoreOrder`。
- 手机远控 relay 与本地配对凭据。
- 模型上下文预算的本地默认值。

数据兼容：

- 既有 SQLite 历史迁移保持原样，不修改已记录的迁移 checksum。
- 旧数据中的闲时任务、官方账号 provider 等字段按未知/空数据忽略；不因删除功能阻断启动。

## 验收

1. `package.json`、CLI 包、桌面构建元数据都是 `1.0.0+3.15.1`。
2. Windows 构建产物名为 `ZCode-1.0.0+3.15.1-win-x64.exe`，CI 校验该名称。
3. 打包应用启动后不访问官方更新/强更接口。
4. 帮助菜单和托盘菜单都能触发 GitHub Release 检查，并覆盖上述成功与失败分支。
5. 设置页不再出现预览版更新、自动下载安装两个开关。
6. 打包应用不初始化 ARMS，不发送产品事件。
7. 内置 Provider 云刷新关闭，第三方 Provider 配置仍可正常加载。
8. 工作流入口默认可见；读取该能力时不请求 `/api/v1/client/configs`，设置中的模式切换仍然生效。
9. Desktop Host 固定使用 desktop presentation surface，不请求 `desktopContextPrompt` 灰度，也不读取 `ZCODE_DESKTOP_CONTEXT_PROMPT_ENABLED`。
10. Windows 产物只包含正式身份：安装包名 `ZCode-<version>-win-x64.exe`，解包目录存在 `ZCode.exe`，不存在 `ZCode Preview.exe`，`app.asar` 内 `zcodeProductFlavor` 为 `production`。
11. `pnpm typecheck`、`pnpm lint`、相关单测通过。
12. desktop preload 纳入 `pnpm typecheck`；preload 不得引用未导入的符号，已移除能力（如 ARMS 补丁）残留调用不得阻断启动状态 IPC 注册。
13. 无可用模型横幅只保留“配置”入口，不展示 Coding Plan“升级”按钮；提示文案不再要求开通编程套餐。
14. 草稿页推荐项包含 `NAVIGATE:AUTOMATIONS:OFFPEAK` 时直接丢弃，不展示“闲时任务”快捷建议；本地主动推荐池不包含闲时任务推荐语。
15. 自动化页空态描述只说明定时任务，不再提“排队在闲时算力空闲时后台执行”。
16. 渲染器动作追踪已物理删除：仓库中不存在 `userActionTelemetry`、`userActionTraceCatalog`、`rendererActionTrace`，UI 点击不再包一层 action span；点击行为与移除前一致。
17. 请求验证已物理删除：仓库中不存在 verification-policy、claim、parity、3007 映射或 `getRequestVerificationConfig`；Provider runtime headers 只用于账号鉴权刷新，缺少账号鉴权时直接返回不可用，不再等待 Renderer 交互。
18. 无可用模型横幅和错误归因不再引用请求验证业务码；`zcode.error.modelSuspiciousEmpty` 在 zh-CN / en-US 都有本地文案。
