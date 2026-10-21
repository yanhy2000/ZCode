# 改包名（品牌重命名）成本评估

评估日期：2026-10-21。基线：`dev @ 0fc8ea2d`，版本 `1.0.0+3.15.1`。

**结论：技术上完全可行，但不建议做「全仓库统一改名」。推荐「对外身份改名、内部标识不动」的最小面方案，成本约 1~2 个工作日。**

---

## 1. 触点盘点

统计口径：`git grep`，不含 `node_modules` / `dist` / `release` / `coverage`。

| 类别 | 出现次数 | 涉及文件 | 是否必须改 |
| --- | --- | --- | --- |
| `ZCode` 显示名（文案 / i18n / 菜单） | 18897 | 2368 | **是**（对外可见） |
| 小写 `zcode` 字面量（路径 / 标识 / 变量） | 27354 | 5141 | 分情况 |
| `@zcode/` npm 包作用域 | 6712 | 3995 | **否** |
| `ZCODE_*` 环境变量（534 个不同名字） | 4558 | 762 | **否** |
| `~/.zcode` 数据目录字面量 | 3511 | 885 | **否**（改了丢用户数据） |
| 文件路径含 `zcode` | 5468（其中 5020 在 `apps/zcode-cli/`） | — | 否 |

### 关键结构性事实

1. **55 个 workspace 包，54 个 `private: true`，0 个有 `publishConfig`。**
   `@zcode/*` 作用域纯内部，不发布到 npm。改名只换来几千行 diff 和一次全量重装，零用户收益。

2. **`apps/zcode-cli/` 是硬约束不动区**（`AGENTS.md` + 交接文档 §2）。
   5468 个含 `zcode` 的路径里 5020 个在它下面；它同时被 CLI 独立发布链（`build:sea`、`release:cli`）使用。

3. **没有集中的品牌常量。** 不存在 `PRODUCT_NAME` / `BRAND` 之类单一出口，`ZCode` 硬编码在
   2368 个文件里（`i18n/locales/{zh-CN,en-US}.ts` 各约 100 处，`shared/src/desktopMenu.ts` 17 处）。

---

## 2. 真正决定「对外身份」的 6 个文件

最小面改名 = 只改这里，用户看到的就是新名字。

| 文件 | 字段 | 现值 |
| --- | --- | --- |
| `packages/desktop/scripts/desktop-product-identity.mjs` | `appId` / `productName` / `linuxExecutableName` / `linuxPackageName` | `dev.zcode.app` / `ZCode` / `zcode` / `zcode` |
| `packages/desktop/package.json` | `productName` | `ZCode` |
| `packages/desktop/electron-builder.config.js` | `win.artifactName`（857）、`protocols[0].schemes`（814）、`linux.maintainer`（880） | `ZCode-${version}-win-${arch}` / `["zcode"]` / `ZCode <dev@zcode.z.ai>` |
| `packages/desktop/src/main/desktopRuntimeEnv.ts` | `runtimeApplicationName` 三级默认值（65-67） | `ZCode` / `ZCode Dev` / `ZCode Preview` |
| `packages/ui/src/lib/productLinks.ts` | 文档与 issue 地址 | `zcode.z.ai/docs`、GitHub |
| `packages/ui/src/i18n/locales/{zh-CN,en-US}.ts` | 约 200 处品牌串 | `ZCode` |

改完这 6 处，会变的是：安装包名、窗口标题、开始菜单 / 托盘 / About、`%APPDATA%\<新名>`、
Linux 可执行名与包名、OAuth 协议展示名。

---

## 3. 必须同时决策的三件事

### 3.1 deep link scheme 要不要改

`zcode://oauth/callback` 出现在：

- `packages/desktop/src/main/desktopDeepLinkUrl.ts:1`（`DEEP_LINK_SCHEME = "zcode"`）
- `packages/services/src/oauth/providers/zaiProviderConfig.ts:22`
- `packages/services/src/oauth/providers/bigmodelProviderConfig.ts:22`
- `packages/desktop/electron-builder.config.js:814`（`schemes: ["zcode"]`）

scheme 是**服务端回调地址**的一部分。OAuth 服务端注册的是 `zcode://oauth/callback`，
本地单方面改 scheme 会让登录直接失败。自建版账号面已删除（批次 D），但第三方 Provider 的
OAuth 仍走这里。

**建议：保留 `zcode` scheme 不动。** 协议展示名（`protocols[0].name`）会跟随 `productName` 自动变。

### 3.2 数据目录要不要跟着改

- 业务数据：`~/.zcode`（`packages/services/src/storage/adapters/rootsResolver.ts:9` 的 `ZCODE_DATA_DIR_NAME`）
- Electron 用户数据：`%APPDATA%\ZCode`（由 `runtimeApplicationName` 推导，`desktopRuntimeEnv.ts:79`）

改 `productName` 会让 `%APPDATA%` 自动变成新目录 → **用户的设置、会话、插件全丢**
（不是崩溃，是静默空白）。必须配一次性的目录迁移代码，或明确接受「换名 = 全新开始」。

**建议：保留 `~/.zcode`；`%APPDATA%` 要么写迁移，要么接受全新开始并在 README 说明。**

### 3.3 `appId` 改不改

Windows 的 AUMID 与 NSIS 安装标识都取自它（`resolveWindowsAppUserModelIdForFlavor`，
`desktop-product-identity.mjs:89-94`）。改了等于换应用：旧版本不会被识别为可升级，
任务栏固定项失效；不改则两个不同名字的应用共用 AUMID。

**建议：改，并明确告知用户「需先卸载旧版」。**

---

## 4. 风险清单

| 风险 | 说明 |
| --- | --- |
| 上游合并冲突 | 全量改名会把 2000+ 文件标记为已修改，之后每次手动合并上游 tag 都要逐个解冲突。上游已冻结在 `v3.15.1`，风险可控但仍存在。 |
| 测试基线 | 2176 个测试文件含 `zcode`（多为路径断言与 fixture）。只改显示名时大部分不受影响；改数据目录 / 路径则大面积失败。 |
| 签名与公证 | 未做代码签名，改名不影响；将来接 `signtool` 时证书主体名与产品名不一致属正常，但安装包升级链会断一次。 |
| Web 端产物 | `zcode-WebRemote/public` 是独立构建，改名后需重新构建部署（命令见该仓库 `docs/WEB_FRONTEND.md`）。 |
| 文档 | 869 个 markdown 含 `ZCode`。`LICENSE` / `NOTICE.md` 的上游版权声明**不能改**。 |
| 法务 | Apache-2.0 允许改名再分发，但必须保留 `LICENSE`、`NOTICE.md` 与上游版权声明，且不得暗示官方背书（README 已有声明）。 |

---

## 5. 三种方案

### 方案 A（推荐）：对外身份改名，内部标识保留

- **改**：`productName`、`appId`、`linuxExecutableName` / `linuxPackageName`、`artifactName`、
  `runtimeApplicationName`、i18n 品牌串、README / 文档标题、图标资源（`packages/desktop/build/`）。
- **不改**：`@zcode/*` 作用域、`ZCODE_*` 环境变量、`~/.zcode`、`zcode://` scheme、
  `apps/zcode-cli/`、内部变量名与类型名。
- **成本**：1~2 个工作日（含一次 Windows 构建 + 沙箱回归）。diff 约 250 文件。
- **额外工作**：写一次 `%APPDATA%` 迁移，或明确放弃旧数据。

### 方案 B：全量改名

包括作用域、环境变量、数据目录、scheme、文件 / 目录名。

- **成本**：1~2 周。
- **代价**：必须改 `apps/zcode-cli`（违反现有硬约束），上游合并基本失效。
- **除有强法务 / 商标要求，不建议。**

### 方案 C：只改显示文案

仅 i18n + README，产物名与目录不变。

- **成本**：半天。
- **局限**：安装包名、开始菜单、`%APPDATA%` 仍是 `ZCode`，对外辨识度提升有限。

---

## 6. 实施检查清单（按方案 A）

1. 确认 `appId` 新值（建议反向域名，如 `dev.<brand>.app`），写进 `desktop-product-identity.mjs` 的
   `PRODUCTION_IDENTITY` 与 `PREVIEW_IDENTITY`（Preview 用 `.preview` 后缀）。
2. 改 `packages/desktop/package.json` 的 `productName`。
3. 改 `electron-builder.config.js` 的 `win.artifactName`（保持 `ZCode-` 前缀替换为新品牌名）、
   `linux.maintainer`；`protocols[0].schemes` **保持 `zcode`**。
4. 改 `desktopRuntimeEnv.ts` 的三个默认名（注意 `ZCODE_DESKTOP_APPLICATION_NAME` 覆盖仍生效，
   e2e 依赖它做身份隔离）。
5. 改 `productLinks.ts` 的文档与 issue 地址。
6. 改 `i18n/locales/{zh-CN,en-US}.ts` 的品牌串（两语言必须同步，否则切语言会露旧名）。
7. 换 `packages/desktop/build/` 的图标（`icon.ico` / `icon.icns` / `icon.png` / `icon_installer.*` /
   `icon_windows.png` / `icons/*` / `dmg_background*.png`）。
8. 决定 `%APPDATA%` 策略：写迁移（读旧目录 → 写新目录 → 保留旧目录不删）或接受全新开始。
9. 跑 `pnpm typecheck` + `pnpm lint`，重点看 `desktopProductIdentity.test.ts`（断言了
   `dev.zcode.app` / `ZCode` / `ZCode Preview` 字面量，需同步更新）与
   `macosReleaseAppDoctor.test.ts`（默认 `productName = "ZCode"` 参数）。
10. 手动 Windows 构建 → 解包沙箱回归（确认开始菜单、`%APPDATA%`、卸载项、AUMID 都变了）。
11. 重建 Web 端产物并部署到 `zcode-WebRemote/public`。
12. 更新 README「当前身份」与「安装与数据」两节，说明与旧版的关系（需先卸载旧版 / 数据是否迁移）。

### 需要同步改的测试（按字面量断言）

- `packages/desktop/test/desktopProductIdentity.test.ts`：`appId`、`productName`、产物名断言。
- `packages/desktop/test/desktopLinuxDeepLinkRegistration.test.ts`：`productName: "ZCode Preview"`。
- `packages/desktop/test/macosReleaseAppDoctor.test.ts`：`createReleaseApp(rootDir, productName = "ZCode")`。
- `packages/desktop/test/appARMSBootstrap.test.ts`：`executableName: "zcode-preview"`。
- `packages/desktop/test/desktopRuntimeEnv.test.ts`：`runtimeApplicationName` 默认值。
- 所有断言 `ZCode-<version>-win-x64.exe` 产物名的用例（`electron-builder` 相关测试）。

---

## 7. 一句话建议

**只改「用户看得见的名字」，别动「机器认得的标识」。** 前者 250 个文件、1~2 天、风险可控；
后者 5000+ 文件、1~2 周、会和上游彻底分叉，换不来任何实际收益。
