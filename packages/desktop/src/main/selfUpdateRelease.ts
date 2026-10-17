export const SELF_UPDATE_REPOSITORY = "yanhy2000/ZCode";
const SELF_UPDATE_LATEST_RELEASE_URL = `https://api.github.com/repos/${SELF_UPDATE_REPOSITORY}/releases/latest`;
const UPDATE_REQUEST_TIMEOUT_MS = 15_000;

export type SelfHostVersion = {
  privateVersion: [number, number, number];
  baseVersion: [number, number, number];
  text: string;
};

export type SelfUpdateErrorCode =
  | "network"
  | "timeout"
  | "not-found"
  | "rate-limited"
  | "http"
  | "invalid-response"
  | "invalid-version";

export class SelfUpdateError extends Error {
  readonly code: SelfUpdateErrorCode;
  readonly status?: number;

  constructor(code: SelfUpdateErrorCode, message: string, status?: number) {
    super(message);
    this.name = "SelfUpdateError";
    this.code = code;
    this.status = status;
  }
}

type LatestReleaseResponse = {
  tag_name?: unknown;
  name?: unknown;
  html_url?: unknown;
  draft?: unknown;
  prerelease?: unknown;
  published_at?: unknown;
};

export type SelfUpdateCheckResult =
  | {
      kind: "available";
      currentVersion: string;
      version: SelfHostVersion;
      tagName: string;
      releaseName: string;
      releaseUrl: string;
      publishedAt: string | null;
    }
  | {
      kind: "up-to-date";
      currentVersion: string;
    };

export type UpdateFetch = (input: string, init?: RequestInit) => Promise<Response>;

function parseVersionPart(value: string | undefined): number {
  return Number.parseInt(value ?? "", 10);
}

export function parseSelfHostVersion(value: string): SelfHostVersion | null {
  const normalized = value.trim().replace(/^v/i, "");
  const match = /^(\d+)\.(\d+)\.(\d+)\+(\d+)\.(\d+)\.(\d+)$/.exec(normalized);
  if (!match) {
    return null;
  }

  const privateVersion: [number, number, number] = [
    parseVersionPart(match[1]),
    parseVersionPart(match[2]),
    parseVersionPart(match[3]),
  ];
  const baseVersion: [number, number, number] = [
    parseVersionPart(match[4]),
    parseVersionPart(match[5]),
    parseVersionPart(match[6]),
  ];
  if ([...privateVersion, ...baseVersion].some((part) => !Number.isFinite(part))) {
    return null;
  }

  return {
    privateVersion,
    baseVersion,
    text: `${privateVersion.join(".")}+${baseVersion.join(".")}`,
  };
}

function compareVersionPart(
  left: [number, number, number],
  right: [number, number, number],
): number {
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return left[index] > right[index] ? 1 : -1;
    }
  }
  return 0;
}

export function compareSelfHostVersions(left: SelfHostVersion, right: SelfHostVersion): number {
  const privateComparison = compareVersionPart(left.privateVersion, right.privateVersion);
  if (privateComparison !== 0) {
    return privateComparison;
  }
  return compareVersionPart(left.baseVersion, right.baseVersion);
}

export function isSelfHostVersionNewer(candidate: string, current: string): boolean {
  const candidateVersion = parseSelfHostVersion(candidate);
  const currentVersion = parseSelfHostVersion(current);
  if (!candidateVersion || !currentVersion) {
    return false;
  }
  return compareSelfHostVersions(candidateVersion, currentVersion) > 0;
}

async function requestLatestRelease(fetchImpl: UpdateFetch): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPDATE_REQUEST_TIMEOUT_MS);
  try {
    return await fetchImpl(SELF_UPDATE_LATEST_RELEASE_URL, {
      method: "GET",
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "ZCode-Self-Update",
      },
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new SelfUpdateError("timeout", "GitHub request timed out");
    }
    throw new SelfUpdateError(
      "network",
      error instanceof Error ? error.message : "Unable to reach GitHub",
    );
  } finally {
    clearTimeout(timeout);
  }
}

export async function checkLatestSelfUpdate(options: {
  currentVersion: string;
  fetchImpl: UpdateFetch;
}): Promise<SelfUpdateCheckResult> {
  const currentParsedVersion = parseSelfHostVersion(options.currentVersion);
  if (!currentParsedVersion) {
    throw new SelfUpdateError(
      "invalid-version",
      `Invalid current self-hosted version: ${options.currentVersion}`,
    );
  }

  const response = await requestLatestRelease(options.fetchImpl);
  if (response.status === 404) {
    throw new SelfUpdateError("not-found", "No published release found", 404);
  }
  if (response.status === 403 || response.status === 429) {
    throw new SelfUpdateError("rate-limited", "GitHub API rate limited", response.status);
  }
  if (!response.ok) {
    throw new SelfUpdateError(
      "http",
      `GitHub API request failed: ${response.status}`,
      response.status,
    );
  }

  let payload: LatestReleaseResponse;
  try {
    payload = (await response.json()) as LatestReleaseResponse;
  } catch (error) {
    throw new SelfUpdateError(
      "invalid-response",
      error instanceof Error ? error.message : "Invalid GitHub release response",
    );
  }

  if (payload.draft === true || payload.prerelease === true) {
    throw new SelfUpdateError("not-found", "No published stable release found");
  }

  const tagName = typeof payload.tag_name === "string" ? payload.tag_name.trim() : "";
  const releaseUrl = typeof payload.html_url === "string" ? payload.html_url.trim() : "";
  if (!tagName || !releaseUrl) {
    throw new SelfUpdateError("invalid-response", "GitHub release is missing tag_name or html_url");
  }

  const releaseVersion = parseSelfHostVersion(tagName);
  if (!releaseVersion) {
    throw new SelfUpdateError("invalid-version", `Invalid release tag: ${tagName}`);
  }

  if (compareSelfHostVersions(releaseVersion, currentParsedVersion) <= 0) {
    return { kind: "up-to-date", currentVersion: currentParsedVersion.text };
  }

  return {
    kind: "available",
    currentVersion: currentParsedVersion.text,
    version: releaseVersion,
    tagName,
    releaseName: typeof payload.name === "string" ? payload.name : "",
    releaseUrl,
    publishedAt: typeof payload.published_at === "string" ? payload.published_at : null,
  };
}
