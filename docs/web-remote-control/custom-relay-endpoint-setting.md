# 移动端远程控制自定义服务器节点设置规范

本文档定义桌面端「移动端远程控制」弹窗中自定义服务器节点（Self-hosted Relay / Custom Endpoint）的产品规则、状态流转、接口与验收场景。

## 1. 产品规则

1. **入口位置**：
   - 位于桌面端「移动端远程控制」弹窗（`WebRemoteControlDialog`）的「手机扫码连接」卡片内，在二维码展示区上方提供「远程服务器」配置区。
2. **输入与保存**：
   - 用户可输入自托管中继或自定义网关地址（如 `http://192.168.1.100:8765`、`https://relay.example.com` 或带路径的 `http://192.168.1.100:8765/remote/v4`）。
   - 用户输入无协议头的地址（如 `192.168.1.100:8765`）时，自动补全 `http://`。
   - 用户点击「保存」或按 Enter：
     - 校验输入有效性；
     - 持久化到 `AppSettings.webRemoteControlCustomServerUrl`；
     - 触发桌面端配对重置（`resetPairing`），断开旧中继并向新中继重新注册；
     - 下方的二维码和复制链接自动更新为基于新服务器生成的 URL。
3. **恢复默认**：
   - 提供「重置」按钮，清空自定义配置，自动重新连接回官方默认中继（或环境变量指定的默认值）。
4. **Web/手机端自动协同**：
   - 移动端 Web 页面（`packages/web`）访问非 `z.ai` 域名或自定义主机时，自动推导本地 `/ws` WebSocket 路径；
   - 二维码携带完整 URL，确保扫码即连。

## 2. 状态所有者与事件顺序

```text
User Input → useSettings().update({ webRemoteControlCustomServerUrl })
           → platform.syncAppSettings(patch)
           → Main process update mainSettingService
           → UI call platform.refreshWebRemoteControlPairing()
           → Main stop old runtime & resetExternalRelayDeviceAuth
           → Main start() reads getEndpointUrls() with new customServerUrl
           → Connect to new relay & register device
           → Return new status with new qrUrl / connectUrl
           → UI renders new QR code
```

- **单一持久化所有者**：`ISettingService`（`setting.json`），字段 `webRemoteControlCustomServerUrl`。
- **端点解析唯一规则**：`@zcode/shared` 导出的 `resolveWebRemoteControlCustomEndpointUrls`。
- **运行时生命周期所有者**：`WebRemoteControlManager`，每次 `start` / `resetPairing` 动态读取 `getEndpointUrls`，不保留第二份端点状态缓存。

## 3. 接口与契约

### 3.1 AppSettings (`packages/shared/src/protocol.ts`)

```ts
export interface AppSettings {
  ...
  /**
   * 用户自定义的 Web 远控服务器节点（例如 http://192.168.1.100:8765）。
   * 为空时使用官方默认中继（或环境变量覆盖）。
   */
  webRemoteControlCustomServerUrl?: string;
}
```

### 3.2 端点解析 (`packages/shared/src/zcodeEndpoint.ts`)

```ts
export function resolveWebRemoteControlCustomEndpointUrls(
  customServerUrl: string | null | undefined,
  options?: { appVersion?: string },
): { remoteUrl: string; relayWsUrl: string; origin: string } | undefined;
```

## 4. 验收场景

1. **默认状态**：未设置时，输入框显示 placeholder（默认官方服务器），连接和二维码指向官方默认端点。
2. **保存自定义端点**：输入有效 IP:Port 或域名后保存，设置持久化，二维码与链接刷新为自定义端点 URL。
3. **容错解析**：输入未带 `http://` 或末尾带 `/` 或带 `/remote/v4` 的地址，均能规范化解析。
4. **重置默认**：点击重置按钮，配置清空，重新连接回官方服务器，二维码恢复。
5. **持久化保持**：关闭弹窗或重启应用后，再次打开弹窗依然回显已配置的自定义地址。
