import { describe, expect, it } from "vitest";
import {
  buildOAuthState,
  buildReturnToCallbackUrl,
  buildWebRemoteOAuthRedirectUri,
  isTrustedDevReturnTo,
  parseOAuthState,
  resolveSafeAppReturnTo,
} from "../src/auth/oauthStateCodec.js";

describe("oauthStateCodec", () => {
  it("round-trips unicode payloads through base64url state", () => {
    const state = buildOAuthState({
      nonce: "nonce-1",
      app_return_to:
        "https://zcode.z.ai/web-remote?app_version=3.13.0&sid=device-1&mid=mid-1&name=Desktop&ignored=1",
      return_to: "http://192.168.1.8:5173/web-remote/callback",
    });

    expect(state).not.toContain("+");
    expect(state).not.toContain("/");
    expect(state).not.toContain("=");
    expect(parseOAuthState(state)).toEqual({
      nonce: "nonce-1",
      app_return_to:
        "https://zcode.z.ai/web-remote?app_version=3.13.0&sid=device-1&mid=mid-1&name=Desktop&ignored=1",
      return_to: "http://192.168.1.8:5173/web-remote/callback",
    });
  });

  it("returns null for malformed state", () => {
    expect(parseOAuthState("not-json")).toBeNull();
    expect(parseOAuthState(buildOAuthState({ nonce: "" }))).toBeNull();
  });

  it("only trusts private development callback urls", () => {
    expect(isTrustedDevReturnTo(new URL("http://192.168.1.8:5173/web-remote/callback"))).toBe(true);
    expect(isTrustedDevReturnTo(new URL("http://172.31.2.3:5173/web-remote/callback"))).toBe(
      true,
    );
    expect(isTrustedDevReturnTo(new URL("http://127.0.0.1:5173/cn/share/callback"))).toBe(true);
    expect(isTrustedDevReturnTo(new URL("http://127.0.0.1:5173/share/callback"))).toBe(true);
    expect(isTrustedDevReturnTo(new URL("http://172.32.2.3:5173/web-remote/callback"))).toBe(
      false,
    );
    expect(isTrustedDevReturnTo(new URL("https://example.com/web-remote/callback"))).toBe(false);
    expect(isTrustedDevReturnTo(new URL("http://127.0.0.1:5173/other"))).toBe(false);
  });

  it("sanitizes app_return_to to same-origin web-remote paths and allowed query keys", () => {
    expect(
      resolveSafeAppReturnTo(
        "https://zcode.z.ai/web-remote?app_version=3.13.0&sid=device-1&mid=mid-1&name=Desktop&ignored=1",
        { currentOrigin: "https://zcode.z.ai" },
      ),
    ).toBe("/web-remote?app_version=3.13.0&sid=device-1&mid=mid-1&name=Desktop");

    expect(
      resolveSafeAppReturnTo("https://evil.example/web-remote?sid=device-1", {
        currentOrigin: "https://zcode.z.ai",
      }),
    ).toBeNull();

    expect(
      resolveSafeAppReturnTo("http://192.168.1.8:5173/web-remote?sid=device-1", {
        currentOrigin: "http://192.168.1.8:5173",
      }),
    ).toBe("/web-remote?sid=device-1");
  });

  it("rejects legacy routes and strips credentials from return targets", () => {
    expect(resolveSafeAppReturnTo("https://zcode.z.ai/remote/v4?sid=device-1")).toBeNull();
    expect(
      resolveSafeAppReturnTo(
        "https://zcode.z.ai/web-remote/?sid=device-1&hash=secret&t=1&token=secret&code=code#secret",
      ),
    ).toBe("/web-remote/?sid=device-1");
  });

  it.each(["/web-remote", "/web-remote/"])(
    "应用入口 %s 保留安全返回参数，但不成为 OAuth callback",
    (path) => {
      const origin = "https://zcode.z.ai";
      const query = "app_version=3.14.0&sid=device-1&mid=mid-1&name=Desk";
      const href = `${origin}${path}?${query}&token=secret&hash=old&t=1&code=old&state=old#fragment`;
      expect(resolveSafeAppReturnTo(href, { currentOrigin: origin })).toBe(`${path}?${query}`);
      expect(buildWebRemoteOAuthRedirectUri(`${origin}/web-remote/callback`, href)).toBe(
        `${origin}/web-remote/callback?${query}`,
      );
      const testCallback = `http://127.0.0.1:5173${path}`;
      expect(isTrustedDevReturnTo(new URL(testCallback))).toBe(false);
      expect(
        buildReturnToCallbackUrl(testCallback, { code: "code-1", state: "state-1" }),
      ).toBeNull();
      expect(buildWebRemoteOAuthRedirectUri(testCallback, href)).toBe(testCallback);
    },
  );

  it.each([
    "https://evil.example/web-remote/unknown?sid=device-1",
    "https://zcode.z.ai/unknown?sid=device-1",
    "https://zcode.z.ai/web-remote/unknown?sid=device-1",
  ])("拒绝不受信任的来源 %s", (href) => {
    const origin = "https://zcode.z.ai";
    expect(resolveSafeAppReturnTo(href, { currentOrigin: origin })).toBeNull();
    expect(buildWebRemoteOAuthRedirectUri(`${origin}/web-remote/callback`, href)).toBe(
      `${origin}/web-remote/callback`,
    );
  });

  it("accepts a same-origin share route as a safe OAuth return target", () => {
    expect(
      resolveSafeAppReturnTo("https://zcode.z.ai/cn/share/share-1", {
        currentOrigin: "https://zcode.z.ai",
      }),
    ).toBe("/cn/share/share-1");
    expect(
      resolveSafeAppReturnTo("https://zcode.z.ai/share/share-1", {
        currentOrigin: "https://zcode.z.ai",
      }),
    ).toBe("/share/share-1");
    expect(
      resolveSafeAppReturnTo("https://evil.example/cn/share/share-1", {
        currentOrigin: "https://zcode.z.ai",
      }),
    ).toBeNull();
  });

  it("builds a sanitized return_to callback URL for dev redirects", () => {
    expect(
      buildReturnToCallbackUrl(
        "http://192.168.1.8:5173/web-remote/callback?app_version=3.14.0&sid=device-1&mid=&name=My+Mac&authCode=old&state=old&token=secret#fragment",
        {
          error: "access_denied",
          state: "new-state",
        },
      ),
    ).toBe(
      "http://192.168.1.8:5173/web-remote/callback?app_version=3.14.0&sid=device-1&mid=&name=My+Mac&error=access_denied&state=new-state",
    );
    expect(
      buildReturnToCallbackUrl("http://192.168.1.8:5173/web-remote/callback?old=1", {
        code: "code-1",
        state: "state-1",
      }),
    ).toBe("http://192.168.1.8:5173/web-remote/callback?code=code-1&state=state-1");

    expect(
      buildReturnToCallbackUrl("http://127.0.0.1:5173/share/callback", {
        code: "code-1",
        state: "state-1",
      }),
    ).toBe("http://127.0.0.1:5173/share/callback?code=code-1&state=state-1");

    expect(
      buildReturnToCallbackUrl("https://example.com/remote/v4", {
        error: "access_denied",
        state: "state-1",
      }),
    ).toBeNull();
  });
});
