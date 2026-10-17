import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";

it("偏好设置菜单不再包含奖励、登录或升级入口", async () => {
  const source = await readFile("packages/ui/src/WorkspaceSidebarFooter.tsx", "utf8");

  expect(source).not.toContain('data-testid="rewards-menu-item"');
  expect(source).not.toContain("Gift");
  expect(source).not.toContain('id: "app.login"');
  expect(source).not.toContain('id: "app.logout"');
  expect(source).not.toContain('id: "sidebar.usage.plan.upgrade"');
});

it("内嵌网页导航保留顶部和左右间距，移除底部内边距", async () => {
  const source = await readFile("packages/ui/src/components/EmbeddedWebsiteHeader.tsx", "utf8");
  expect(source).toContain('className="bg-background px-6 py-4 pb-0 max-sm:px-4"');
});
