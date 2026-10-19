import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// 合入上游版本时容易整段带走 fork 侧文案（本次 3.16.1 就丢了 V1 手机远控首页与自建中继节点
// 的 key，界面直接显示 key 本身）。这里把「源码里 intl 引用的 id」与「locale 里定义的 key」
// 做一次全量比对，任何一侧缺失都在单测里暴露，不依赖人工肉眼看界面。
const repoRoot = join(import.meta.dirname, "..", "..", "..");
const localeDir = join(repoRoot, "packages/ui/src/i18n/locales");
const sourceRoots = [
  join(repoRoot, "packages/ui/src"),
  join(repoRoot, "packages/desktop/src/renderer"),
  join(repoRoot, "packages/web/src"),
];

const SKIP_DIR_NAMES = new Set(["node_modules", "dist", "out"]);

function collectSourceFiles(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIR_NAMES.has(entry.name)) continue;
      collectSourceFiles(join(dir, entry.name), out);
      continue;
    }
    if (!/\.(ts|tsx)$/.test(entry.name) || entry.name.includes(".test.")) continue;
    out.push(join(dir, entry.name));
  }
}

// 只收集字面量 id：`formatMessage({ id: "x" })` 与含 defaultMessage 的 describe 块。
// 拼接出来的动态 id 无法静态判定，跳过它们是刻意的（避免把模板串当成 key）。
const LITERAL_ID_PATTERN =
  /(?:formatMessage\(\s*\{\s*id:\s*|defaultMessage[\s\S]{0,40}?id:\s*)["']([a-zA-Z][\w.-]+)["']/g;

function collectReferencedIds(): Set<string> {
  const files: string[] = [];
  for (const root of sourceRoots) collectSourceFiles(root, files);
  const ids = new Set<string>();
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    for (const match of text.matchAll(LITERAL_ID_PATTERN)) ids.add(match[1]!);
  }
  return ids;
}

function collectDefinedKeys(localeFile: string): Set<string> {
  const text = readFileSync(join(localeDir, localeFile), "utf8");
  const keys = new Set<string>();
  for (const match of text.matchAll(/^\s*"([^"]+)":/gm)) keys.add(match[1]!);
  return keys;
}

describe("i18n 覆盖", () => {
  const referenced = collectReferencedIds();

  for (const localeFile of ["zh-CN.ts", "en-US.ts"]) {
    it(`${localeFile} 覆盖全部被引用的 key`, () => {
      const defined = collectDefinedKeys(localeFile);
      const missing = [...referenced].filter((id) => !defined.has(id)).sort();
      expect(missing).toEqual([]);
    });
  }

  it("中英文 key 集合一致", () => {
    const zh = collectDefinedKeys("zh-CN.ts");
    const en = collectDefinedKeys("en-US.ts");
    // 只比较英文是否有中文缺失的 key：en-US 允许存在少量仅英文的兼容文案，
    // 但中文缺 key 意味着中文界面会显示 key 本身，这是必须拦住的。
    const missingInZh = [...en].filter((key) => !zh.has(key)).sort();
    expect(missingInZh).toEqual([]);
  });
});
