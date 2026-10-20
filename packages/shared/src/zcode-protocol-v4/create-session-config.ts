import { z } from "zod";
import { modelSelectionSchema } from "../model-selection.js";

export const createSessionRequestedConfigSchema = z.object({
  modelSelection: modelSelectionSchema.optional(),
  provider: z.string().optional(),
  model: z.string().optional(),
  thought: z.string().optional(),
  /**
   * 标题生成 sidecar 的模型覆盖（含思考强度）。缺省 = 跟随会话当前模型与档位。
   * 只影响 session_title / goal_summary_title 请求，不改变主对话的模型与档位。
   */
  titleGenerationModelSelection: modelSelectionSchema.optional(),
  followupMode: z.enum(["queue", "guide"]).optional(),
  // Bugfix：createSession.config 表达“请求覆盖字段”，不能复用 snapshot 的
  // sessionConfigStateSchema.partial()；snapshot 为兼容旧快照给 mode 设了 default("build")，
  // 会把“没传 mode”误变成“请求切回 build”，覆盖 workspace 默认 yolo。
  mode: z.string().optional(),
  planEnabled: z.boolean().optional(),
});
