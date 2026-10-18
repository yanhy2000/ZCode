import { marketingTouchDecodeAssets } from "./marketing-touch-decode-assets.js";
import {
  createMarketingTouchFaultBundle,
  createMarketingTouchZip,
} from "./marketing-touch-fault-bundle.js";

export async function createMarketingTouchAssets() {
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=",
    "base64",
  );
  // 修复原因：Weekend Plan 商业 hero 资源已随商业面清理删除，原先直接读取
  // packages/ui/src/assets/cloud-content/weekend-plan-hero.html，导致依赖本 fixture
  // 的单测与 E2E 全部 ENOENT。这里改为自带中性 HTML，仅保留 cloud-content 沙箱与
  // zcode-cloud-hero-v1 桥接协议所需的形状，不含任何套餐文案，也不恢复被删的商业化资源。
  const html = Buffer.from(
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Marketing touch demo</title>
    <style>html,body{margin:0;height:100%}body{display:flex;align-items:center;justify-content:center;font-family:sans-serif}</style>
  </head>
  <body>
    <div data-channel="zcode-cloud-hero-v1" id="marketing-demo">zcode-cloud-hero-v1</div>
  </body>
</html>
`,
    "utf8",
  );
  const zip = await createMarketingTouchZip(html);
  const faultZip = await createMarketingTouchFaultBundle();
  const invalidMedia = Buffer.from("E2E intentionally invalid resource bytes");
  return {
    png,
    zip,
    assets: {
      ...marketingTouchDecodeAssets,
      image: { path: "/marketing-assets/banner.png", bytes: png, type: "image/png" },
      // 不同 hash 验证主题资源选择，尾部标记不影响解码。
      darkImage: {
        path: "/marketing-assets/banner-dark.png",
        bytes: Buffer.concat([png, Buffer.from("E2E dark resource")]),
        type: "image/png",
      },
      invalidImage: {
        path: "/marketing-assets/invalid.png",
        bytes: invalidMedia,
        type: "image/png",
      },
      invalidZip: {
        path: "/marketing-assets/invalid.zip",
        bytes: invalidMedia,
        type: "application/zip",
      },
      bundle: { path: "/marketing-assets/hero.zip", bytes: zip, type: "application/zip" },
      faultBundle: {
        path: "/marketing-assets/fault-hero.zip",
        bytes: faultZip,
        type: "application/zip",
      },
    },
  };
}
