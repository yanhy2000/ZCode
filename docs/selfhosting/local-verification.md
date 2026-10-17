# 自维护 Windows 构建的本地验收流程

## 当前构建形态

在完成强更闸门补丁之前，CI 产出的测试包固定使用：

| 项 | 值 |
| --- | --- |
| 后端环境 | `ZCODE_ENV=production` |
| 产品身份 | Preview（`ZCODE_PREVIEW_IDENTITY=1`） |
| 安装名 | `ZCode Preview` |
| 应用版本 | `3.15.1` |
| Agent CLI 版本 | `3.15.1` |
| 自动更新 | 关闭（Preview 身份本身不初始化更新器） |
| 强更闸门 | 跳过（Preview 身份不进入 production 分支） |
| 遥测 | 默认关闭（构建期地址为空） |

使用 Preview 身份只是测试阶段的临时措施：它允许与官方 ZCode 并排安装，并绕过官方服务器对 3.15.1 的强更判断。等强更补丁合并后，再把构建切换为正式 `ZCode` 身份。

## 产物

GitHub Actions 的 `Build Windows` 运行会产出：

```text
ZCode Preview-3.15.1-win-x64.exe
*.exe.blockmap
latest.yml
SHA256SUMS.txt
```

产物名里的版本必须是 `3.15.1`。如果出现 `0.x`、`0.0.0` 或 `0.0.0-dev`，本次验收直接判失败并记录产物全名。

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

优先使用 Windows Sandbox 或独立虚拟机。不要在正式版 ZCode 的数据目录上直接验收。

如果必须在当前系统测试：

1. 先备份 `%USERPROFILE%\.zcode`。
2. 用独立数据目录启动，例如创建 `D:\zcode-self-test`，然后从命令行启动：

```powershell
$env:ZCODE_DATA_BASE_DIR = "D:\zcode-self-test"
& "$env:LOCALAPPDATA\Programs\ZCode Preview\ZCode Preview.exe"
```

3. 确认正式版 ZCode 与测试包不要同时运行。

## 冒烟清单

### 启动与版本

- [ ] 安装完成，应用名显示为 `ZCode Preview`。
- [ ] 启动后主窗口正常创建，没有被“需要升级 ZCode”阻断。
- [ ] About/设置页显示版本 `3.15.1`，提交号与 CI 运行一致。
- [ ] 应用没有自动检查或下载更新。

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

- [ ] 连续使用 10 分钟无崩溃、无主进程退出。
- [ ] 关闭应用后重新启动，会话历史仍在。
- [ ] 卸载测试包后，正式版 ZCode 的数据和启动不受影响。

## 失败记录

失败时请附上：

- 安装包完整文件名和 SHA256。
- About 页的版本/提交号。
- 失败步骤的截图或录屏。
- `%USERPROFILE%\.zcode\v2\logs` 下对应时间段的日志（如果使用了独立数据目录，则取该目录下的日志）。
- 如果是网络/云控相关失败，附上抓包里的 host 和请求路径，不要附 API key。

## CI 侧已做的版本断言

CI 在打包前后都会检查：

- 根 `package.json` 版本是 `3.15.1`。
- `apps/zcode-cli/package.json` 版本与根版本一致。
- `packages/desktop/scripts/build-metadata.mjs` 解析出的桌面版本是 `3.15.1`。
- `apps/zcode-cli/packages/cli/scripts/build.mjs` 注入的 `__CLI_VERSION__` 是 `3.15.1`。
- 最终 `.exe` 文件名包含 `3.15.1`。

因此本地验收只需要确认实际安装包和运行时显示与 CI 一致，不需要再单独追版本号来源。
