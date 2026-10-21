# ZCode Self-hosted

本项目是 ZCode 官方开源版（Apache-2.0）的个人自维护分支，目标是在保留桌面 AI 编程工作台核心能力的同时，让更新、遥测和云端控制保持可解释、可关闭。

本项目不是官方项目，与 Z.ai / ZCode 官方没有隶属关系。官方说明和上游文档见 [README_OFFICIAL.md](./README_OFFICIAL.md)（英文版：[README_OFFICIAL.en.md](./README_OFFICIAL.en.md)）。

> **配套自建远控中继**：[yanhy2000/zcode-WebRemote](https://github.com/yanhy2000/zcode-WebRemote) —— 自托管的 V1 中继（`/ws`）与手机端页面（`/remote/v4`）服务，可完全脱离官方 relay 与账号体系。

## 当前状态

- 上游基线：`v3.15.1`（**已冻结**，不自动跟随上游更新）
- 平台：Windows x64
- 构建：GitHub Actions 手动触发
- 当前身份：`ZCode` 正式版（替换同机官方安装，不再使用 `ZCode Preview`）
- 当前版本：`1.0.0+3.15.1`（私有版本 `1.0.0` + 官方基线 `3.15.1`）
- 最新发布：[`v1.0.0+3.15.1`](https://github.com/yanhy2000/ZCode/releases/tag/v1.0.0%2B3.15.1)（2026-10-21）
- Windows 产物：`ZCode-1.0.0+3.15.1-win-x64.exe`（153,280,198 字节；同页附 `SHA256SUMS.txt`）

### 查看上游是否有新版本

`Sync upstream` workflow 已彻底禁用，需要时在本地查询：

```bash
git ls-remote --tags --refs https://github.com/zai-org/ZCode.git 'v*' \
  | sed 's#.*refs/tags/##' | grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$' | sort -V | tail -n1
```

确认要合并某个版本后，先取回 tag 并评估差异，再手动合并：

```bash
git fetch upstream --tags
git log --oneline v3.15.1..<新tag>
git diff --stat v3.15.1..<新tag>
```

不要使用 GitHub 的 Sync fork，它会覆盖自建提交。

## 与官方版本的差异

每一行是一项能力，左列标注能力名。符号说明：`✅` 已支持 / 保留，`🚧` 计划中，`❌` 不支持 / 关闭，`—` 不适用。

| 官方版本 | 官方开源版 | 本项目 |
| --- | --- | --- |
| **自动检测更新**：✅ stable/preview 双通道 | ❌ 默认关闭 | ✅ 检查本项目 GitHub Release |
| **自动下载 / 安装更新**：✅ | ❌ | ❌ 跳转手动下载 |
| **启动强更**：✅ 服务端 minimalVersion 闸门 | ❌ | ✅ 已跳过官方强更 |
| **遥测**：✅ ARMS RUM + 事件上报 | ❌ 默认关闭 | ✅ 已移除上报链路 |
| **内置 Provider 云刷新**：✅ | ✅ 默认开启 | ✅ 已关闭（保留代码） |
| **第三方模型**：✅ | ✅ | ✅ 保留 |
| **会话标题生成**：✅ 跟随当前模型 | ✅ | ✅ 跟随当前模型；可单独指定标题模型与思考强度 |
| **工作流**：✅ 云端灰度 | ✅ 云端灰度 | ✅ 始终提供，默认始终开启（已切断云端开关，可切换模式） |
| **插件市场**：✅ 官方 CDN + GitHub | ✅ 默认开启 | ✅ 保留开启 |
| **手机远控**：✅ 厂商 relay | 🚧 客户端支持，relay 依赖厂商 | ✅ 保留厂商 relay；可切换到自建中继（[zcode-WebRemote](https://github.com/yanhy2000/zcode-WebRemote)） |
| **电脑控制 / CUA**：✅ | 🚧 占位实现 | 🚧 计划后续寻找方案 |
| **账号 / 套餐 / 支付 / 分享 / 设置同步**：✅ | ❌ 服务端不完整 | ❌ 云端入口与相关 UI 已物理删除 |
| **问题反馈**：✅ 云端工单系统 | ❌ | ✅ 跳转本项目 GitHub issue，错误现场复制到剪贴板 |
| **余额 / 用量**：✅ 官方套餐展示 | ❌ | 🚧 计划第三方余额 + 本地统计 |
| **数据目录**：官方默认 | 可配置 | ✅ 官方默认（`~/.zcode`、`%APPDATA%\ZCode`）；切换前备份 |
| **上游同步**：— | — | ❌ 已冻结在 `v3.15.1`，仅在自己需要时手动合并 |
| **Windows 安装包**：✅ 官方发布 | ❌ 无预编译包 | ✅ GitHub Actions 手动构建 + Release 发布 |

> 本项目已完成阶段 A（构建/CI/仓库流程）、阶段 B（GitHub Release 更新检查、移除遥测、关闭 Provider 云刷新、跳过官方强更）、阶段 C（切换为正式 `ZCode` 身份、工作流改为始终提供）和阶段 D（移除云端账号面、自建远控与问题上报通路）。表中标 `🚧` 或写“计划”的能力是后续计划，不是已实现。

## 安装与数据

- 安装包使用正式 `ZCode` 身份，会替换同机的官方 ZCode，不能与官方版并排安装。
- 业务数据位于 `~/.zcode`，Electron 用户数据位于 `%APPDATA%\ZCode`。
- 首次从官方版或旧的 `ZCode Preview` 切换过来前，先备份上述两个目录。如果官方安装版本高于当前上游基线，先确认数据格式可以回退。
- 旧的 `ZCode Preview` 不需要保留；切换后不要与正式版同时运行。

## 分支与发布

- `dev`：默认分支，日常开发（上游已冻结，不再自动合并）
- `main`：稳定 / 可发布
- Windows 构建：Actions → `Build Windows` → Run workflow（手动，固定 production 身份）
- 发布：`v<私有版本>+<官方基线>` tag（例如 `v1.0.0+3.15.1`）或手动触发，默认创建 draft release
- 更新检查：帮助菜单或托盘菜单 → 检查更新；发现新版本后打开 GitHub Release 页面手动下载
- **手机远控的 Web 端是独立产物**：桌面安装包自带 UI，Web 端用 `zcode-WebRemote` 仓库里
  `public/` 的静态构建。改完 `packages/ui` 后只打包桌面版不会更新 Web 端，
  需在 `packages/web` 重新构建并部署（命令见该仓库 `docs/WEB_FRONTEND.md`）。

## 文档

- [`docs/specs/selfhost-runtime.md`](./docs/specs/selfhost-runtime.md)：产品规则与验收清单
- [`docs/selfhosting/local-verification.md`](./docs/selfhosting/local-verification.md)：Windows 构建与沙箱验收
- [`docs/selfhosting/repository-settings.md`](./docs/selfhosting/repository-settings.md)：仓库权限与开关
- [`docs/selfhosting/rebranding.md`](./docs/selfhosting/rebranding.md)：改包名（品牌重命名）的成本评估与方案
- [`docs/windows-test-compatibility.md`](./docs/windows-test-compatibility.md)：Windows 测试兼容与已知失败模式

## 为什么自维护

- 不接受官方客户端的遥测、强制更新和云端控制。
- 保留官方开源版的完整桌面、Agent 和工具能力，继续使用第三方模型。
- 更新节奏和功能改动由自己控制；上游基线冻结在 `v3.15.1`，只在需要时手动合并某个 tag。

## 相关项目

- 自建远控中继（配套）：[yanhy2000/zcode-WebRemote](https://github.com/yanhy2000/zcode-WebRemote)
- 上游原项目：[zai-org/ZCode](https://github.com/zai-org/ZCode)

## 许可与声明

- 本项目基于 ZCode 官方开源版，遵循 Apache-2.0；保留 `LICENSE`、`NOTICE.md` 和上游版权声明。
- 本项目不是官方项目，不提供官方支持，也不代表 Z.ai / ZCode 官方立场。
- 官方 README 已备份为 [README_OFFICIAL.md](./README_OFFICIAL.md) 和 [README_OFFICIAL.en.md](./README_OFFICIAL.en.md)。
