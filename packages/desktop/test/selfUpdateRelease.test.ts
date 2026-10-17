import { describe, expect, it, vi } from "vitest";
import {
  SelfUpdateError,
  checkLatestSelfUpdate,
  compareSelfHostVersions,
  isSelfHostVersionNewer,
  parseSelfHostVersion,
  type UpdateFetch,
} from "../src/main/selfUpdateRelease.js";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function createFetch(response: Response | Error): UpdateFetch {
  return vi.fn(async () => {
    if (response instanceof Error) {
      throw response;
    }
    return response;
  }) as unknown as UpdateFetch;
}

describe("self-hosted version rule", () => {
  it("parses private version and upstream base", () => {
    expect(parseSelfHostVersion("1.0.0+3.15.1")).toEqual({
      privateVersion: [1, 0, 0],
      baseVersion: [3, 15, 1],
      text: "1.0.0+3.15.1",
    });
    expect(parseSelfHostVersion("v1.2.3+3.16.0")?.text).toBe("1.2.3+3.16.0");
  });

  it("rejects tags outside the private+official rule", () => {
    expect(parseSelfHostVersion("3.15.1")).toBeNull();
    expect(parseSelfHostVersion("v3.15.1-self.1")).toBeNull();
    expect(parseSelfHostVersion("1.0.0")).toBeNull();
  });

  it("compares the private version before the official base", () => {
    const current = parseSelfHostVersion("1.0.0+3.15.1")!;
    const newerPrivate = parseSelfHostVersion("1.0.1+3.15.0")!;
    const newerBase = parseSelfHostVersion("1.0.0+3.15.2")!;

    expect(compareSelfHostVersions(newerPrivate, current)).toBeGreaterThan(0);
    expect(compareSelfHostVersions(newerBase, current)).toBeGreaterThan(0);
    expect(compareSelfHostVersions(current, current)).toBe(0);
    expect(isSelfHostVersionNewer("1.0.0+3.15.2", "1.0.0+3.15.1")).toBe(true);
    expect(isSelfHostVersionNewer("1.0.0+3.15.1", "1.0.0+3.15.2")).toBe(false);
  });
});

describe("checkLatestSelfUpdate", () => {
  it("returns available when the release tag is newer", async () => {
    const result = await checkLatestSelfUpdate({
      currentVersion: "1.0.0+3.15.1",
      fetchImpl: createFetch(
        jsonResponse({
          tag_name: "v1.0.1+3.15.1",
          name: "ZCode 1.0.1+3.15.1",
          html_url: "https://github.com/yanhy2000/ZCode/releases/tag/v1.0.1%2B3.15.1",
          draft: false,
          prerelease: false,
          published_at: "2026-10-17T00:00:00Z",
        }),
      ),
    });

    expect(result.kind).toBe("available");
    if (result.kind === "available") {
      expect(result.tagName).toBe("v1.0.1+3.15.1");
      expect(result.currentVersion).toBe("1.0.0+3.15.1");
    }
  });

  it("returns up-to-date for the same version", async () => {
    const result = await checkLatestSelfUpdate({
      currentVersion: "1.0.0+3.15.1",
      fetchImpl: createFetch(
        jsonResponse({
          tag_name: "v1.0.0+3.15.1",
          html_url: "https://github.com/yanhy2000/ZCode/releases/tag/v1.0.0",
        }),
      ),
    });
    expect(result).toEqual({ kind: "up-to-date", currentVersion: "1.0.0+3.15.1" });
  });

  it("maps 404 to not-found", async () => {
    await expect(
      checkLatestSelfUpdate({
        currentVersion: "1.0.0+3.15.1",
        fetchImpl: createFetch(jsonResponse({ message: "Not Found" }, 404)),
      }),
    ).rejects.toMatchObject({ code: "not-found" } satisfies Partial<SelfUpdateError>);
  });

  it("maps rate limits to rate-limited", async () => {
    await expect(
      checkLatestSelfUpdate({
        currentVersion: "1.0.0+3.15.1",
        fetchImpl: createFetch(jsonResponse({ message: "rate limit" }, 403)),
      }),
    ).rejects.toMatchObject({ code: "rate-limited" });
  });

  it("maps network failures to network", async () => {
    await expect(
      checkLatestSelfUpdate({
        currentVersion: "1.0.0+3.15.1",
        fetchImpl: createFetch(new Error("Connection was reset")),
      }),
    ).rejects.toMatchObject({ code: "network" });
  });

  it("rejects releases whose tag is not a self-hosted version", async () => {
    await expect(
      checkLatestSelfUpdate({
        currentVersion: "1.0.0+3.15.1",
        fetchImpl: createFetch(
          jsonResponse({
            tag_name: "v3.15.2",
            html_url: "https://github.com/yanhy2000/ZCode/releases/tag/v3.15.2",
          }),
        ),
      }),
    ).rejects.toMatchObject({ code: "invalid-version" });
  });

  it("rejects an invalid current version", async () => {
    await expect(
      checkLatestSelfUpdate({
        currentVersion: "3.15.1",
        fetchImpl: createFetch(new Error("should not fetch")),
      }),
    ).rejects.toMatchObject({ code: "invalid-version" });
  });
});
