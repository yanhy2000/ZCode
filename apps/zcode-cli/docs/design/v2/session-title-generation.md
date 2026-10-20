# Session Title Generation

## 背景

ZCode 目前在首次持久化 session 时直接从用户输入截断得到 `session.title`。这个标题稳定、便宜，但对长 prompt、带上下文的需求、中文/英文混合输入和文件附件场景不够可读。

核心约束：

- 用户标题和 AI 标题分开，用户手动标题永远优先，AI 标题只作为可重生成的增强元数据。
- 在 root session 的首条真实用户消息后异步生成标题，并写回 session metadata。
- 标题生成是低风险 sidecar 能力，不能影响主 agent loop，不能覆盖用户明确命名，必须进入数据库和 session event，方便本地 TUI 的 session list、resume 和 debug 复用。

## 目标

1. 仅本地 TUI root interactive session 的首条真实用户消息完成后，自动生成更可读的标题。
2. 标题生成使用 `ModelRole.Lite`。如果未配置 `model.lite`，必须使用当前默认/main 模型，不能报错或强制用户配置第二模型。
3. 标题生成沿用会话当前的推理档位，只按主请求同一策略限制输出预算；不假设模型档位列表的最低项等于“安全的关闭思考”。
4. AI 生成标题只能覆盖默认/首输入/旧 AI 标题，不能覆盖用户自定义标题。
5. 标题结果写入 `SessionStorePort`，并由 SQLite adapter 持久化。
6. 标题更新发出可观测的 session event，包含 traceId/sessionId/turnId/modelRef/source。
7. 生成失败、超时、不可解析或模型尝试返回无效内容时保留当前标题，不影响主 turn。

## 非目标

- 不新增环境变量。是否启用、超时、模型选择走 runtime config/session config。
- 不给 child session、subagent session、workflow child、fork session 自动改名。
- 不把标题生成做成 tool，也不允许调用工具。
- 不在 TUI 层直接访问模型或数据库；TUI 只负责启用 runtime config，并消费 session projection/list/event。
- 不给 ZCode app-server、headless `--prompt`、SDK/测试宿主默认开启标题生成。它们只有在显式传入 `runtimeConfig.titleGeneration` 时才会触发。
- 不在第一版实现手动 `/rename` 命令，但数据库和 port 必须为 `custom` 标题保留不可覆盖语义。

## 数据契约

`SessionInfo` 增加可选标题元数据：

```ts
type SessionTitleSource = "default" | "first_input" | "generated" | "custom";

interface SessionInfo {
  title: string;
  titleSource?: SessionTitleSource;
  titleMessageID?: MessageId;
  time: {
    titleUpdated?: number;
  };
}
```

SQLite `session` 表增加：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `title_source` | text not null default `first_input` | 标题来源。 |
| `title_message_id` | text null | 生成/设置标题所依据的 user message。 |
| `time_title_updated` | integer null | 标题最近更新时间。 |

`SessionStorePort.updateSession` 支持标题 CAS：

```ts
interface UpdateSessionInput {
  title?: string;
  titleSource?: SessionTitleSource;
  titleMessageID?: MessageId | null;
  expectedTitleSources?: SessionTitleSource[];
}
```

当 `expectedTitleSources` 不为空且当前 `title_source` 不在列表中时，adapter 必须 no-op 并返回当前 session。AI 标题写入使用 `["default", "first_input", "generated"]`，因此用户自定义 `custom` 不会被迟到的 AI 结果覆盖。

## 触发规则

标题生成由 core runtime 发起，但必须由外层宿主显式启用。第一版只有 CLI TUI 入口传入 `runtimeConfig.titleGeneration`；headless `--prompt`、ZCode app-server session、workflow child 和外部 SDK 宿主默认不传这个配置。

启用后仍需满足：

1. `sessionStore` 和 `modelAdapter` 都存在。
2. `titleGeneration.enabled !== false`。
3. 当前 session 为 root interactive session：无 `parentSessionId`，`taskType` 缺省或为 `interactive`。
4. 当前 turn 是恢复后计数意义上的首个真实用户 turn。
5. user prompt 不是 summary、compact、rewind、hook synthetic、slash command 展开或纯空白。
6. 当前 session title source 不是 `custom`。

第一版在主 turn 完成后启动异步 sidecar 请求；它不进入主 `TurnResult.usage`，但会发自己的 model request/model complete/session title event。

## Bootstrap 与入口边界

bootstrap 不做全局自动启用。它只在已经存在 `runtimeConfig.titleGeneration` 时补齐标题模型引用和 provider options。

CLI TUI 入口创建 app 时传入：

```ts
runtimeConfig: {
  titleGeneration: {},
}
```

headless `--prompt` 和 `--target` 不传 `titleGeneration`，因此不会多发一个后台模型请求，也不会影响脚本输出和退出时机。app-server 会话同样不传 `titleGeneration`，避免协议客户端在一次 prompt 之外收到额外成本、事件和模型调用；未来若 ZCode protocol client 明确需要标题，可先设计协议能力和展示语义，再显式打开。

测试或外部宿主注入自定义 `modelAdapter` 时，除非显式传入 `runtimeConfig.titleGeneration`，否则不自动发起标题请求，避免破坏宿主自定义模型调用编排。

## 模型选择

当入口显式启用标题生成时，bootstrap 生成 `titleGeneration.modelRef`。

模型选择顺序：

1. 如果配置了 `model.lite`，使用 `model.lite` 的 provider/model。
2. 如果没有 `model.lite`，使用当前默认/main provider/model。
3. 两种情况下 event 中的 `modelRef.role` 都是 `lite`，表示请求用途是轻量 sidecar。

provider options 与最终 provider/model 对齐；`model.lite` 没有配置时复用默认/main provider options。标题请求不再改写推理档位：

- 推理档位沿用会话当前 Selection（或在 `titleGeneration.modelSelection` 里显式指定的档位），不强制取模型档位列表的最低项 `reasoningLevel.values[0]`。
- 输出预算复用主请求的 `resolveNormalRequestMaxOutputTokens` 策略（模型声明的 `maxOutputTokens.max`，缺失时 32,000）。
- 原因（2026-10 修复）：最低档在部分 provider 上被映射成 `thinking.type = "disabled"`。MiniMax M3.1 这类模型强制 adaptive thinking，收到 disabled 直接返回 400（`invalid params ... requires adaptive thinking (2013)`），标题 sidecar 每次静默失败，侧边栏标题永久停在首条 query；固定的 5,000 输出预算还会在思考预算更大的模型上触发同类 400。`max_tokens` 只是上限，标题输出仍受清洗与长度限制约束，不会因此变长。

主对话和标题 sidecar 使用同一套档位与预算，provider 侧请求形态一致，避免“主请求成功、标题请求 400”的分裂。

## Prompt 与输出清洗

系统 prompt 要求：

- 生成 3-7 个词的可识别标题。
- 跟随用户主要语言。
- 句子式大小写；保留专有名词、文件名和技术名。
- 不输出解释、markdown、编号、引号或多行文本。

清洗逻辑：

1. 去除 `<think>...</think>`。这是兼容模型未遵守禁用字段的输出清洗，不代表请求侧允许继承 thinking。
2. 优先解析 JSON `{ "title": "..." }`；兼容模型把 JSON 包在完整 Markdown fenced code block（语言标记为 `json`）中的返回；失败则取首个非空文本行。
3. 去除外围引号和 markdown 标记。
4. 折叠空白，限制最大长度。
5. 空结果、过短噪声或只包含标点时视为失败。

## 事件

新增 `session_title_updated`：

```ts
interface SessionTitleUpdatedPayload {
  messageID?: MessageId;
  modelRef?: ModelRef;
  previousTitle: string;
  source: SessionTitleSource;
  title: string;
}
```

标题生成还应发普通 `model_request` / `model_complete`，`querySource: "session_title"`，以便 debug 和成本分析能看到这次 sidecar 请求。

## 错误处理

- 模型请求失败、超时、取消、返回空内容或 CAS 失败都不影响主 turn。
- runtime 只写结构化 warn/debug 日志，不向用户刷一条可见 assistant 消息。
- CAS 失败不是错误，记录为 `session_title_generation.skipped`，原因是 `title_source_changed`。

## 测试

最低覆盖：

- SQLite migration 给旧 session 默认 `first_input`。
- `createSession` 写入 `title_source`，`updateSession` 可以更新 generated 标题。
- generated 标题 CAS 不能覆盖 custom 标题。
- 未配置 `model.lite` 时，标题请求使用 main provider/model 且 role 为 `lite`。
- 配置 `model.lite` 时，标题请求使用 lite provider/model。
- 标题请求沿用会话推理档位，输出预算与主请求策略一致（不压到最低档、不再固定 5,000）。
- 标题模型失败时主 turn 仍成功，session title 保留首输入 fallback。
- TUI 显式启用后 root interactive 首 turn 触发，child/fork/workflow/subagent 不触发。
- headless prompt 和 ZCode app-server 默认不传 `titleGeneration`，不会触发标题模型请求。
