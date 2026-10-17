import type { OAuthProviderId } from "@zcode/shared";

/**
 * 自维护版不再派生官方 Coding Plan provider key；OAuth 登出本身由 OAuth service 完成。
 * 保留 handler 装配点，避免调用方感知账号派生缓存的生命周期变化。
 */
export function createOAuthProviderLogoutHandler(): (
  provider: OAuthProviderId,
  accountIdentity?: string | null,
) => Promise<void> {
  return async () => {};
}
