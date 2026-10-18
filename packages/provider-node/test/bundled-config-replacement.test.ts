import { mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { materializeZCodeBuiltinProviderConfig } from "../src/index.js";
import * as persistence from "@zcode/shared/node";

const roots: string[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});
async function environmentRoot() {
  const root = await mkdtemp(join(tmpdir(), "todo104-bundled-"));
  roots.push(root);
  return root;
}
function release(revision: number) {
  return JSON.stringify({
    schemaVersion: 1,
    revision,
    config: {
      providerConfigRules: { providerRules: [], templateRules: [] },
      modelConfigRules: {
        modelRules: [],
        modelApiRules: [],
        providerSiteRules: [],
        templateModelRules: [],
        builtinProviderModelRules: [],
      },
    },
  });
}

it("同内容并发启动复用固定资源且不改写文件", async () => {
  const environmentConfigRoot = await environmentRoot();
  const options = { environmentConfigRoot, content: release(1) };
  const file = await materializeZCodeBuiltinProviderConfig(options);
  const before = await stat(file, { bigint: true });
  expect(
    await Promise.all(
      Array.from({ length: 8 }, () => materializeZCodeBuiltinProviderConfig(options)),
    ),
  ).toEqual(Array(8).fill(file));
  expect((await stat(file, { bigint: true })).mtimeNs).toBe(before.mtimeNs);
  expect(await readdir(dirname(file))).toEqual(["zcode-builtin.json"]);
});

it.skipIf(process.platform === "win32")(
  // Windows 覆盖式 rename 在并发读者持续重开目标文件时会长时间返回 EPERM，
  // 超出 atomicWritePrivateFile 的重试窗口（50+100+200+400+800ms）；这是平台
  // 文件替换语义差异，不是实现回归。同内容复用与失败保留两个用例在 Windows 仍执行。
  "替换期间并发读取只见完整旧版或新版，不产生 hash 历史文件",
  async () => {
    const environmentConfigRoot = await environmentRoot();
    const file = await materializeZCodeBuiltinProviderConfig({
      environmentConfigRoot,
      content: release(1),
    });
    let finished = false;
    const writer = (async () => {
      try {
        for (let index = 0; index < 30; index++) {
          await materializeZCodeBuiltinProviderConfig({
            environmentConfigRoot,
            content: release((index % 2) + 1),
          });
        }
      } finally {
        finished = true;
      }
    })();
    const reader = (async () => {
      do {
        const fileContent = JSON.parse(await readFile(file, "utf8"));
        expect([1, 2]).toContain(fileContent.revision);
        expect(fileContent).toEqual(JSON.parse(release(fileContent.revision)));
      } while (!finished);
    })();
    await Promise.all([writer, reader]);
    expect(await readdir(dirname(file))).toEqual(["zcode-builtin.json"]);
  },
);

it("资源校验或原子写入失败时保留旧内容，错误向调用方报告", async () => {
  const environmentConfigRoot = await environmentRoot();
  const file = await materializeZCodeBuiltinProviderConfig({
    environmentConfigRoot,
    content: release(1),
  });
  const before = await readFile(file, "utf8");
  await expect(
    materializeZCodeBuiltinProviderConfig({ environmentConfigRoot, content: "{}" }),
  ).rejects.toThrow();
  vi.spyOn(persistence, "atomicWritePrivateTextFile").mockRejectedValueOnce(
    new Error("fixture write failure"),
  );
  await expect(
    materializeZCodeBuiltinProviderConfig({ environmentConfigRoot, content: release(2) }),
  ).rejects.toThrow("fixture write failure");
  expect(await readFile(file, "utf8")).toBe(before);
  expect(await readdir(dirname(file))).toEqual(["zcode-builtin.json"]);
});
