import { z } from "zod";
import { modelExecutionSelectionFallbackReasonSchema } from "./model-execution.js";

/**
 * 自维护版已移除 Highspeed（加速卡）功能：Host 不再提供 draw/healthy/加速执行材料，
 * UI 不再产生新的加速轮或分享数据。本文件只为协议兼容保留：
 *
 * - `highspeedMessageMetaSchema`：持久化在消息 metadata.highspeed 里的卡快照与完成态统计。
 *   CLI 的 transcript 投影/冷恢复与 `setHighspeedMetrics` 命令仍按该 schema 读取历史消息；
 *   没有 Host 生产端后这些字段是惰性的，旧消息仍能正常解析。
 * - `HIGHSPEED_PROVIDER_IDS`：已移除的隐藏加速卡 Provider ID 映射（`account:*-highspeed-card`），
 *   CLI 的 session-store / fork / 队列提升测试仍按 Family 引用，保留为兼容导出。
 * - `isHighspeedProviderId`：过滤历史/恢复/队列中指向已移除的隐藏加速 Provider
 *   （`account:*-highspeed-card`）的 Selection，避免把不可解析的 Provider 写进派生会话或
 *   复用队列项。CLI 侧 session-store / fork / 队列提升仍依赖该谓词。
 */

/**
 * 写入 message.data 的协议级卡快照。版本字段保证后续扩展仍能宽容读取旧消息。
 * 字段语义沿用历史 highspeed-card-spec（该文档已随功能删除）；自维护版不再写入新数据。
 */
export const highspeedMessageMetaSchema = z
  .object({
    schemaVersion: z.literal(1),
    cardId: z.string().min(1),
    taskId: z.string().min(1),
    provider: z.string().min(1),
    model: z.string().min(1),
    issuedAt: z.number().int().nonnegative(),
    expiresAt: z.number().int().nonnegative(),
    /** 发送该轮时从 Coding Plan 健康检查采样的普通 Pro/Max decode TPS。 */
    regularTps: z.number().positive().optional(),
    /** 完成态统计；这些字段由同一次 CLI 持久化更新原子写入。 */
    outputTokens: z.number().int().nonnegative().optional(),
    durationMs: z.number().nonnegative().optional(),
    /** 卡到期后从 Highspeed healthy usage 采样的卡级平均 completion TPS。 */
    highspeedTps: z.number().positive().optional(),
    savedDurationMs: z.number().nonnegative().optional(),
    /** CLI 从运行时事件聚合的真实耗时拆分；缺省时客户端回退到 20/80 估算。 */
    modelDurationMs: z.number().nonnegative().optional(),
    toolDurationMs: z.number().nonnegative().optional(),
    otherDurationMs: z.number().nonnegative().optional(),
    /** Turn 内加速请求失败并回落普通模型的时刻；只用于投影降级提示，不改变分享统计。 */
    fallbackAt: z.number().int().nonnegative().optional(),
    /** 回落原因：卡过期或其他加速请求失败；Renderer 据此选择提示文案，缺省按卡过期处理旧数据。 */
    fallbackReason: modelExecutionSelectionFallbackReasonSchema.optional(),
  })
  .strict();

export type HighspeedMessageMeta = z.infer<typeof highspeedMessageMetaSchema>;

/**
 * 已移除的隐藏加速卡 Provider ID。CLI 的 session-store / fork / 队列提升相关测试仍按 Family
 * 引用该映射，因此保留为兼容导出；本仓库不再产生新卡（没有 Host 生产端时这些值是惰性的）。
 */
export const HIGHSPEED_PROVIDER_IDS = {
  zai: "account:zai-highspeed-card",
  bigmodel: "account:bigmodel-highspeed-card",
} as const;

/**
 * 判定一个 Selection 是否指向加速卡 Provider：拆 Family 之后不能再和单个常量比较，
 * 否则 BigModel 账号的卡在队列提升时会被判成「非加速」。
 */
export function isHighspeedProviderId(providerId: string | undefined): boolean {
  if (providerId === undefined) return false;
  return Object.values(HIGHSPEED_PROVIDER_IDS).some((id) => id === providerId);
}
