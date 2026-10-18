# 自维护构建：版本、更新与外部能力边界

## 目标

本仓库以 `zai-org/ZCode` 的稳定 tag 为上游基线，产出仅供自己使用的 Windows 安装包。构建不再连接官方更新、强更、遥测和内置 Provider 云刷新链路；插件市场与手机远控保持原样。

## 版本规则

- 版本号格式为 `<私有版本>+<官方基线版本>`，两者都是 `major.minor.patch`，例如 `1.0.0+3.15.1`。
- 根 `package.json` 与 `apps/zcode-cli/package.json` 使用同一个版本号；桌面构建元数据、CLI `__CLI_VERSION__` 与安装包文件名都从它派生。
- Windows 安装包命名为 `ZCode-<version>-win-<arch>.exe`，例如 `ZCode-1.0.0+3.15.1-win-x64.exe`。
- Release tag 为 `v<version>`，例如 `v1.0.0+3.15.1`；tag 必须与 `package.json` 完全一致。
- 版本比较按“私有版本优先，官方基线次之”的二元组进行。SemVer 会忽略 `+` 之后的 build metadata，因此更新检查不得直接使用 `semver.gt`。

版本号的两种用途：

- 「显示与更新」使用完整的 `<私有版本>+<官方基线>`：About / 版本信息、安装包名、Release tag、自动更新比较，以及需要区分自维护包身份的本地场景。
- 「与云端/官方服务交互」使用官方基线版本（`1.0.0+3.15.1` → `3.15.1`，实现为 shared `ZCODE_UPSTREAM_VERSION`）：请求头（`X-ZCode-App-Version`、`User-Agent`）、`app_version` 查询参数、客户端灰度与帮助配置、OAuth 中转、项目访问令牌、遥测与反馈、注入远端进程的应用版本，以及依赖版本比较的功能门槛（如手机远控前端 v4 判定）。官方服务不认识私有版本号，`1.0.0` 会被当成远低于基线的旧客户端。
- 例外：自维护远端资源（server bundle / remote assets 的 CDN 路径、manifest、握手校验）继续以私有版本为键，保证构建与部署两侧自洽；这些链路不访问官方资产。
- 版本号缺少 `+` 基线时（非自维护构建、测试桩）按原样使用，不做转换。

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
- 设置行的取值 = 本地固定的「提供 `alwaysOn`」套上设置里的用户选择：修改后切换设置页面、重新打开设置或重启应用都保持该选择；选择回“始终开启（默认）”时删除设置里的 `dynamicWorkflowMode` 字段，继续跟随默认。
- Host 用同一规则计算生效模式（闩住的提供 + 每次现读的用户选择），并在 workspace 客户端就绪时把结论下发给 CLI：`onDemand` / `alwaysOn` 下发 `enabled:true` 与对应 mode，`disabled` 下发 `enabled:false`。
- 未打包 dev 的合法 `ZCODE_DYNAMIC_WORKFLOW_MODE` 覆盖保留，仅供本地调试，且只改写 Host 的运行时候选；设置行仍按本地默认显示（调试用差异，打包态不存在）。打包态不接受外部环境改写。
- 本地 Host 与 SSH/WSL/Docker 远程 Host 使用同一结论，不再依赖云端配置。
- 用户可见名称统一为“工作流 / Workflows”；内部协议字段和代码标识仍使用 `dynamicWorkflow`。

## 桌面呈现面

- 自维护构建不读取官方 `desktopContextPrompt` 云端灰度，也不再传递 `ZCODE_DESKTOP_CONTEXT_PROMPT_ENABLED`。
- 本地 Desktop Host 与 desktop-attached remote Host 固定使用 desktop presentation surface；普通 HTTP/manual app-server 没有 Desktop 宿主事实，仍为 terminal。
- 因此 Desktop 的 system prompt、Gen UI 输出目录与内联评论能力不再受离线或未登录影响。

## 手机远控

- 远控二维码链接固定使用官方基线版本：`https://zcode.z.ai/remote/v4?...&app_version=<官方基线>`（例如 `app_version=3.15.1`）。
- 远程前端版本按官方基线判定（门槛常量 `WEB_REMOTE_CONTROL_V4_MIN_APP_VERSION`）；私有版本 `1.0.0` 不得参与该判定，否则链接会退回云端已下线的 `/remote/v3` 并返回 404。
- relay、attachment、会话复用与本地配对凭据链路保持不变；云端页面模板不属于自维护范围。

## 强制更新

- 启动流程不请求官方 `minimalVersion`，不展示官方强更弹窗。
- 删除 `forceUpdateGuard` 的启动调用；本地未打包 dev 与打包自维护包行为一致。

## 不变项

- 插件市场继续启用。
- 手机远控继续使用现有 relay 与 attachment 链路。
- 第三方模型、工具、MCP、Skill 行为不变。

## 首次启动与偏好设置菜单

- 首次启动不收集 API Key，也不创建 Provider：欢迎页只展示品牌、说明和“开始使用”按钮。
- 点击“开始使用”后关闭欢迎页并进入既有职业/界面引导；模型与 Provider 在设置页配置。
- 欢迎页不展示 API Key 输入框、Provider 选择器、登录或套餐入口，也不写入官方账号状态。
- 左下角常驻入口显示“偏好设置”，不再显示头像、登录状态或“连接使用”。
- 偏好设置菜单保留语言、主题、界面模式、桌面缩放和“使用统计”。
- 偏好设置菜单不展示“升级/续费”、登录/连接账号、退出登录、Rewards 或 Coding Plan 套餐徽标。

## 官方云控与商业功能移除

自维护构建只保留第三方 Provider 所需的本地配置、模型选择与执行链路。以下官方云控或商业功能不再提供：

- 渲染器动作追踪：物理删除 UI `userActionTelemetry` 辅助函数、shared `rendererActionTrace` schema、platform/channels 类型与全部调用点；点击操作直接执行，不产生 renderer action span 或本地 TTFT 上报。
- 闲时任务（Off-Peak task）：物理删除 UI 入口、任务列表/创建/编辑视图、通知与遥测、store、services 取号与调度、Host 协议、模型选择分支和 CLI 工具；保留定时任务（cron automation）的创建、调度、运行历史与 `automations` / `automation_runs` 数据链路。
- 请求验证（Request Verification）：物理删除 shared `verification-policy`、UI claim/error/parity/messages、CLI recovery 空壳、Coding Plan claim 头与 3007 错误映射；Provider runtime headers 的账号鉴权刷新链路保留，但不再携带 verification reason/proof。
- 强制更新（forceUpdate / minimalVersion）：移除残留类型、Provider 方法、Main 标志与文案。
- Coding Plan 商业面：物理删除商品目录、团队静态商品、体验套餐、账单折扣、购买/升级弹窗、额度重置、套餐卡、套餐徽标、营销触达与 Rewards 组件；模型设置只展示自定义 Provider。
- 官方账号派生层：删除 `account:*` 内置 Provider、账号项目 Key/Team Key 解析、账号 Provider 热同步、usage entitlement/额度查询与官方 MCP 额度。
- CLI 与 Host 的 Coding Plan 登录、账号鉴权、Start Plan 繁忙重试、官方购买 webview/preload 与分区清理不再作为可用路径保留；CLI 侧未被 Desktop 调用的协议定义不要求逐项删除。
- 内置 Provider 配置删除全部 `account:*` 规则与 Coding Plan 模板，revision 提升以覆盖旧 active/LKG 缓存；`zai-standard-api` / `bigmodel-standard-api` 等第三方模板保留。
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

## 模型设置：空状态与供应商模板

- 模型设置左列表没有任何供应商时，右栏固定显示“添加供应商”模板页（内容与点击“添加供应商”一致），不再显示无归属的“加载中”占位。
- 只要左列表为空，模板页保持显示且隐藏返回按钮；创建出第一个供应商后恢复正常详情流程（自动选中新供应商）。
- 手动刷新不属于空列表判定；刷新期间保持当前右栏内容稳定。
- 模板页为不含分组标题的单一列表：首位是“创建自定义供应商”，其后是其余供应商模板，Z.ai / BigModel 模板位于列表末尾。
- 页面不显示“智谱”“其他”等分组标题，也不渲染分组容器；除 Z.ai / BigModel 外，模板顺序与 `config/provider/zcode-builtin.json` 的声明顺序一致。

## 验收

1. `package.json`、CLI 包、桌面构建元数据都是 `1.0.0+3.15.1`。
2. Windows 构建产物名为 `ZCode-1.0.0+3.15.1-win-x64.exe`，CI 校验该名称。
3. 打包应用启动后不访问官方更新/强更接口。
4. 帮助菜单和托盘菜单都能触发 GitHub Release 检查，并覆盖上述成功与失败分支。
5. 设置页不再出现预览版更新、自动下载安装两个开关。
6. 打包应用不初始化 ARMS，不发送产品事件。
7. 内置 Provider 云刷新关闭，第三方 Provider 配置仍可正常加载。
8. 工作流入口默认可见；读取该能力时不请求 `/api/v1/client/configs`，设置中的模式切换仍然生效：切换设置页面或重启后设置行仍显示用户的选择，Host 用同一结论下发 CLI 策略（关闭时 `enabled:false`）。
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
19. 首次启动欢迎页只展示“开始使用”，仓库中不存在 `LoginApiKeyForm`、API Key 输入框或 Provider 选择器；点击后进入既有引导。
20. 左下角入口文案为“偏好设置”；菜单包含语言、主题、界面模式、缩放和“使用统计”，不包含升级、登录、退出登录或套餐徽标。
21. 设置 → 模型设置不显示 Z.ai / BigModel 固定套餐项、Start Plan 入口或“编程套餐 / 未连接 / 连接 Z.ai”卡片；只显示自定义 Provider 列表和“添加供应商”。
22. 内置 Provider 配置中不存在 `account:*` 规则，`config/provider/*.json` 的 revision 高于 31；第三方 Provider 模板与模型规则保持可加载。
23. 仓库中不存在 Coding Plan 购买/升级弹窗、额度重置、套餐卡、营销触达、Rewards 或官方账号 Provider 热同步的可用入口。
24. 闲时任务已物理删除：UI 不出现“闲时任务”tab、创建按钮、任务卡、聊天轮尾创建卡或通知；`packages/ui/src` 不存在 `offPeakTaskStore`、`OffPeakTaskList`、`OffPeakEditView`、`OffPeakNewTaskEntry` 等闲时模块。
25. services 与 desktop 不再装配闲时取号、同步、mock gateway、Host 派发或调度结算；`offPeakTaskService` 不再出现在 ServiceCollection。
26. 定时任务不受影响：自动化页仍可创建、编辑、启停、立即运行、查看运行历史；`off_peak_tasks` 表与既有迁移 checksum 保持原样，仅为历史数据兼容保留。
27. 设置 → 模型设置没有任何供应商时，右栏直接显示“添加供应商”模板页而非“加载中”；该页保持显示直到创建出第一个供应商，此时不显示返回按钮。
28. “添加供应商”模板页不渲染“智谱 / 其他”分组标题：首位为“创建自定义供应商”，Z.ai 与 BigModel 模板显示在列表末尾，其余模板顺序与内置 Provider 配置一致。
29. 手机远控链接为 `https://zcode.z.ai/remote/v4?...&app_version=3.15.1`：路径与 `app_version` 都使用官方基线版本，私有版本号不出现在链接中；手机浏览器打开后能进入远控页并连接成功（无需手工改 URL）。
30. 版本号用途分离可验证：About、安装包名、Release tag 与自动更新比较使用 `1.0.0+3.15.1`；请求头 `X-ZCode-App-Version`、`app_version` 参数、帮助配置、OAuth 中转、项目访问令牌、遥测/反馈与远端进程应用版本使用 `3.15.1`。自维护远端资源 CDN/manifest 仍以 `1.0.0+3.15.1` 为键。
