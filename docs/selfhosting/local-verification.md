# 自维护 Windows 构建的本地验收流程

## 当前构建形态

| 项 | 值 |
| --- | --- |
| 后端环境 | `ZCODE_ENV=production` |
| 产品身份 | production（`ZCode`） |
| 安装名 | `ZCode` |
| 应用版本 | `1.0.0+3.15.1` |
| Agent CLI 版本 | `1.0.0+3.15.1` |
| 自动更新 | 启动后自动检查本项目 GitHub Release，只跳转手动下载 |
| 强更闸门 | 已跳过 |
| 遥测 | 已移除上报链路 |

正式身份会替换同机的官方 ZCode，不能与官方版并排安装。业务数据仍在 `~/.zcode`，Electron 用户数据仍在
`%APPDATA%\ZCode`，身份切换不会自动迁移或备份这两个目录。

## 产物

GitHub Actions 的 `Build Windows` 运行会产出：

```text
ZCode-1.0.0+3.15.1-win-x64.exe
*.exe.blockmap
latest.yml
SHA256SUMS.txt
```

产物名里的版本必须等于根 `package.json` 版本。如果出现 `0.x`、`0.0.0`、`3.15.1`（缺少私有版本）或
`3.15.1-self.*`，本次验收直接判失败并记录产物全名。

## 获取产物

1. 打开仓库的 Actions 页面，进入最新的 `Build Windows` 运行。
2. 下载 `zcode-windows-x64` artifact。
3. 解压后核对 `SHA256SUMS.txt`：

```powershell
Get-FileHash .\ZCode*win-x64.exe -Algorithm SHA256
Get-Content .\SHA256SUMS.txt
```

两边的 SHA256 必须一致。

## 测试环境

优先使用 Windows Sandbox 或独立虚拟机。不要在正式数据目录上直接验收。

如果必须在当前系统测试：

1. 先备份 `%APPDATA%\ZCode` 和 `%USERPROFILE%\.zcode`。
2. 卸载官方 ZCode，或使用独立数据目录启动：

```powershell
$env:ZCODE_DATA_BASE_DIR = "D:\zcode-self-test"
$env:ZCODE_DESKTOP_USER_DATA_DIR = "D:\zcode-self-test\userData"
& "$env:LOCALAPPDATA\Programs\ZCode\ZCode.exe"
```

3. 确认官方 ZCode 与自维护版不要同时运行。
4. 如果官方安装版本高于当前上游基线，先确认数据格式可以回退，不要只依赖覆盖安装。

## 冒烟清单

### 启动与版本

- [ ] 安装完成，桌面快捷方式、开始菜单、托盘菜单和 About 都显示 `ZCode`，不出现 `Preview`。
- [ ] 启动后主窗口正常创建，没有被“需要升级 ZCode”阻断。
- [ ] About/设置页显示版本 `1.0.0+3.15.1`，提交号与 CI 运行一致。
- [ ] 帮助菜单或托盘菜单中的“检查更新”可以打开；仓库尚无已发布 release 时给出明确提示。
- [ ] 把 GitHub Release 正式发布后，自动检查和手动检查都能发现新版本并打开下载页。

### 模型与对话

- [ ] 添加一个第三方 OpenAI 兼容 provider（baseUrl + API key）。
- [ ] 能发起对话，流式输出正常。
- [ ] 能触发一次工具调用，并在任务中看到工具结果。
- [ ] 切换模型后新会话使用新模型。

### 工作区与工具

- [ ] 打开一个本地工作区，文件读取/写入正常。
- [ ] 内置终端可以启动并执行命令。
- [ ] MCP server 能连接并列出工具。
- [ ] Skills/插件页面能打开；插件市场按当前配置保持开启，不要求关闭。

### 远控与可选能力

- [ ] 如果测试手机远控，确认扫码配对和消息收发；当前仍走厂商 relay，payload 为明文透传。
- [ ] 如果不测试远控，跳过并在结果里注明。

### 稳定性

- [ ] 连续使用 6-10 分钟无崩溃、无主进程退出。
- [ ] 关闭应用后重新启动，会话历史仍在。
- [ ] 卸载后重新安装，数据目录与登录态符合预期。

## 失败记录

失败时请附上：

- 安装包完整文件名和 SHA256。
- About 页的版本/提交号。
- 失败步骤的截图或录屏。
- `%USERPROFILE%\.zcode\v2\logs` 下对应时间段的日志（如果使用了独立数据目录，则取该目录下的日志）。
- 如果是网络/云控相关失败，附上抓包里的 host 和请求路径，不要附 API key。

## CI 侧已做的断言

CI 在打包前后都会检查：

- 根 `package.json` 版本符合 `X.Y.Z+X.Y.Z`，CLI 包版本与根一致。
- `packages/desktop/scripts/build-metadata.mjs` 解析出的桌面版本等于根版本。
- 最终安装包名为 `ZCode-<version>-win-x64.exe`。
- 解包目录存在 `ZCode.exe`，不存在 `ZCode Preview.exe`。
- `app.asar` 内 `zcodeProductFlavor` 为 `production`，应用版本等于根版本。

因此本地验收只需要确认实际安装包和运行时显示与 CI 一致，不需要再单独追版本号来源。
