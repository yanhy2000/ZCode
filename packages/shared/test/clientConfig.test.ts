import { expect, it } from "vitest";
import { parseClientConfigSnapshot } from "../src/clientConfig.js";

it("有效的空响应撤销公开配置，未知字段不会透传", () => {
  expect(parseClientConfigSnapshot({ code: 0, data: null })).toEqual({
    pluginStoreOrder: null,
  });
  expect(
    parseClientConfigSnapshot({ code: 0, data: { configs: { privateField: "not public" } } }),
  ).toEqual({ pluginStoreOrder: null });
});

it("严格校验 envelope 并隔离坏的模式字段", () => {
  expect(() => parseClientConfigSnapshot({ code: 1001 })).toThrow(
    "Invalid public client config response",
  );
  expect(() => parseClientConfigSnapshot({ data: { configs: {} } })).toThrow();
  expect(
    parseClientConfigSnapshot({
      code: 0,
      data: {
        configs: {
          pluginStoreOrder: {
            code: { categoryOrder: 3 },
            work: { categoryOrder: ["finance"] },
          },
        },
      },
    }),
  ).toEqual({ pluginStoreOrder: { work: { categoryOrder: ["finance"] } } });
});

it("未知的 zsrc 字段被忽略，不影响公开配置解析", () => {
  expect(
    parseClientConfigSnapshot({
      code: 0,
      data: {
        configs: {
          zsrc: { url: "https://security.example.test/report" },
          pluginStoreOrder: { work: { categoryOrder: ["finance"] } },
        },
      },
    }),
  ).toEqual({ pluginStoreOrder: { work: { categoryOrder: ["finance"] } } });
});
