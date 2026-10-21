import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  WEB_PRODUCT_DISPLAY_NAME,
  WEB_REMOTE_CONTROL_DOCUMENT_TITLE,
  WEB_REMOTE_CONTROL_SIGN_IN_DOCUMENT_TITLE,
  WEB_SERVER_DOCUMENT_TITLE,
  resolveConversationShareDocumentTitle,
} from "../src/documentTitle.js";

const WEB_ROOT = join(import.meta.dirname, "..");

describe("web 浏览器标题身份", () => {
  it("对外标题使用安装身份 ZCode Dev，与桌面任务栏 / 关于页保持一致", () => {
    // 这条把「为什么改标题」固化下来：正式身份是 ZCode Dev，
    // 若标题退回 `ZCode`，同机的官方版与本 fork 在浏览器标签上无法分辨。
    expect(WEB_PRODUCT_DISPLAY_NAME).toBe("ZCode Dev");
    expect(WEB_REMOTE_CONTROL_DOCUMENT_TITLE).toBe("ZCode Dev - Web Remote Control");
    expect(WEB_REMOTE_CONTROL_SIGN_IN_DOCUMENT_TITLE).toBe(
      "ZCode Dev - Web Remote Control Sign In",
    );
    expect(WEB_SERVER_DOCUMENT_TITLE).toBe("ZCode Dev - Web + Server");
  });

  it("会话分享页标题跟随语言，仍带安装身份", () => {
    expect(resolveConversationShareDocumentTitle("zh-CN")).toBe("ZCode Dev 会话分享");
    expect(resolveConversationShareDocumentTitle("en-US")).toBe("ZCode Dev Conversation Share");
    // 非中文一律走英文，避免出现第三种语言的标题。
    expect(resolveConversationShareDocumentTitle("ja-JP")).toBe("ZCode Dev Conversation Share");
  });

  it("index.html 的静态兜底标题与常量一致", () => {
    // JS 执行前浏览器显示的是 index.html 的 <title>，两者不一致会让首屏闪一下旧名字。
    const html = readFileSync(join(WEB_ROOT, "index.html"), "utf-8");
    expect(html).toContain(`<title>${WEB_PRODUCT_DISPLAY_NAME}</title>`);
  });

  it("main.tsx 不残留硬编码的 ZCode 标题字面量", () => {
    // 防止以后新增页面时又写死 `ZCode - ...`，绕过统一出口。
    const source = readFileSync(join(WEB_ROOT, "src", "main.tsx"), "utf-8");
    expect(source).not.toMatch(/document\.title\s*=\s*"ZCode/);
  });
});
