import { describe, expect, it } from "vitest";
import {
  createRootTraceContext,
  createSessionId,
  type ModelOptions,
} from "@zcode/contracts";
import { generateTitleCandidate } from "../src/runtime/methods/title-generation-sidecar.js";
import { createTestAgentRuntime } from "./test-agent-runtime.js";
import { createTestSessionEventStore } from "./test-event-store.js";
import { createTestModelFactory } from "./test-runtime-model.js";

/**
 * 回归：标题 sidecar 不能把推理档位压到模型配置的最低档。
 * 最低档在 MiniMax M3.1 这类必须开启思考的模型上被映射成 thinking.type=disabled，
 * 上游返回 400（2013 requires adaptive thinking），标题请求每次都失败。
 */
describe("title generation request options", () => {
  it("inherits the session reasoning level instead of forcing the lowest gear", async () => {
    const seen: ModelOptions[] = [];
    const runtime = createTestAgentRuntime(
      createSessionId("title-request-options"),
      { modelSelection: { providerId: "test", modelId: "model", options: { reasoningLevel: "high" } } },
      {
        eventStore: createTestSessionEventStore(),
        modelFactory: createTestModelFactory({
          async generateText(_request, observation) {
            seen.push(observation.model.options);
            return { text: '{"title":"Session title"}', finishReason: "stop" };
          },
          reasoningLevels: ["disabled", "high"],
        }),
      },
    );

    const candidate = await generateTitleCandidate.call(runtime as never, "Improve headers", {
      querySource: "session_title",
      traceContext: createRootTraceContext({ sessionId: runtime.getSessionId() }),
    });

    expect(candidate?.title).toBe("Session title");
    expect(seen).toHaveLength(1);
    // 输出预算与主请求同一策略（模型上限），档位保持会话已选的 high。
    expect(seen[0]).toEqual({ maxOutputTokens: 32_000, reasoningLevel: "high" });
  });
});
