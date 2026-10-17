import { app, BrowserWindow, dialog, Menu, net, shell } from "electron";
import type { MessageBoxOptions } from "electron";
import {
  DEFAULT_LOCALE,
  PlatformChannels,
  ZCODE_VERSION,
  desktopMenuMessageIds,
  getDesktopMenuMessage,
  type Locale,
  type UpdateStatePayload,
} from "@zcode/shared";
import { logger } from "./logger.js";
import {
  SELF_UPDATE_REPOSITORY,
  SelfUpdateError,
  checkLatestSelfUpdate,
  type SelfUpdateCheckResult,
  type SelfUpdateErrorCode,
} from "./selfUpdateRelease.js";

export const CHECK_FOR_UPDATE_MENU_ID = "check-for-update";
const AUTO_UPDATE_CHECK_DELAY_MS = 20_000;
const AUTO_UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

export type ForceAutoUpdateState =
  | { kind: "checking" }
  | { kind: "downloading"; version?: string; progress?: string }
  | { kind: "ready"; version?: string }
  | { kind: "installing" }
  | { kind: "error"; message: string }
  | { kind: "dev-skipped"; message?: string };

let menuLocale: Locale = DEFAULT_LOCALE;
let menuState: UpdateStatePayload = { kind: "idle", enabled: true };
let checkInFlight = false;
let autoCheckTimer: NodeJS.Timeout | null = null;
let autoCheckInterval: NodeJS.Timeout | null = null;
let autoUpdateEnabled = false;
const autoNotifiedVersions = new Set<string>();
const stateListeners = new Set<(state: UpdateStatePayload) => void>();

function getCurrentVersionForUpdateCheck(): string {
  return ZCODE_VERSION.trim() || app.getVersion();
}

function resolveDialogWindow(originWindow?: BrowserWindow | null): BrowserWindow | null {
  if (originWindow && !originWindow.isDestroyed()) {
    return originWindow;
  }
  const focused = BrowserWindow.getFocusedWindow();
  if (focused && !focused.isDestroyed()) {
    return focused;
  }
  return (
    BrowserWindow.getAllWindows().find((win) => !win.isDestroyed() && win.isVisible()) ?? null
  );
}

function buildUpdateDialogCopy(locale: Locale): {
  title: string;
  openRelease: string;
  later: string;
  upToDate: (currentVersion: string) => string;
  availableDetail: (currentVersion: string, releaseName: string | null) => string;
  errors: Record<SelfUpdateErrorCode, string>;
} {
  if (locale === "zh-CN") {
    return {
      title: "检查更新",
      openRelease: "打开下载页",
      later: "稍后",
      upToDate: (currentVersion) => `当前已是最新版本（${currentVersion}）。`,
      availableDetail: (currentVersion, releaseName) =>
        `当前版本：${currentVersion}\n${releaseName ? `${releaseName}\n` : ""}请在 GitHub Release 页面手动下载并安装。`,
      errors: {
        network: "无法连接 GitHub。请检查网络或代理设置后重试。",
        timeout: "连接 GitHub 超时。请检查网络或代理设置后重试。",
        "not-found": "仓库中还没有已发布的 Release。",
        "rate-limited": "GitHub API 请求受限或频率过高，请稍后重试。",
        http: "GitHub Release 请求失败，请稍后重试。",
        "invalid-response": "无法解析 GitHub Release 信息，请稍后重试。",
        "invalid-version": "版本号格式不符合自维护版本规则（私有版本+官方基线）。",
      },
    };
  }

  return {
    title: "Check for updates",
    openRelease: "Open download page",
    later: "Later",
    upToDate: (currentVersion) => `You are on the latest version (${currentVersion}).`,
    availableDetail: (currentVersion, releaseName) =>
      `Current version: ${currentVersion}\n${releaseName ? `${releaseName}\n` : ""}Download and install manually from the GitHub Release page.`,
    errors: {
      network: "Unable to reach GitHub. Check your network or proxy settings and try again.",
      timeout: "Timed out while connecting to GitHub. Check your network or proxy settings.",
      "not-found": "This repository has no published releases yet.",
      "rate-limited": "GitHub API rate limit reached. Try again later.",
      http: "The GitHub Release request failed. Try again later.",
      "invalid-response": "Unable to parse the GitHub Release response. Try again later.",
      "invalid-version": "The release tag does not follow the self-hosted version rule.",
    },
  };
}

async function showMessageBox(
  parentWindow: BrowserWindow | null,
  options: MessageBoxOptions,
): Promise<number> {
  const result = parentWindow
    ? await dialog.showMessageBox(parentWindow, options)
    : await dialog.showMessageBox(options);
  return result.response;
}

async function showUpdateResultDialog(
  result: SelfUpdateCheckResult,
  originWindow?: BrowserWindow | null,
): Promise<void> {
  const copy = buildUpdateDialogCopy(menuLocale);
  const parentWindow = resolveDialogWindow(originWindow);

  if (result.kind === "up-to-date") {
    await showMessageBox(parentWindow, {
      type: "info",
      title: copy.title,
      message: copy.upToDate(result.currentVersion),
      buttons: [copy.later],
      defaultId: 0,
      cancelId: 0,
      noLink: true,
    });
    return;
  }

  const response = await showMessageBox(parentWindow, {
    type: "info",
    title: copy.title,
    message: `发现新版本 ${result.tagName}`,
    detail: copy.availableDetail(result.currentVersion, result.releaseName || null),
    buttons: [copy.openRelease, copy.later],
    defaultId: 0,
    cancelId: 1,
    noLink: true,
  });
  if (response === 0) {
    await shell.openExternal(result.releaseUrl).catch((error) => {
      logger.error("[self-update] open release page failed:", error);
    });
  }
}

async function showUpdateErrorDialog(
  error: unknown,
  originWindow?: BrowserWindow | null,
): Promise<void> {
  const copy = buildUpdateDialogCopy(menuLocale);
  const selfUpdateError =
    error instanceof SelfUpdateError
      ? error
      : new SelfUpdateError("network", error instanceof Error ? error.message : String(error));
  const message =
    selfUpdateError.code === "http" && selfUpdateError.status
      ? `${copy.errors.http} (HTTP ${selfUpdateError.status})`
      : copy.errors[selfUpdateError.code];

  await showMessageBox(resolveDialogWindow(originWindow), {
    type: "error",
    title: copy.title,
    message,
    buttons: [copy.later],
    defaultId: 0,
    cancelId: 0,
    noLink: true,
  });
}

function setMenuState(nextState: UpdateStatePayload): void {
  menuState = nextState;
  syncMenuItemState();
  for (const listener of stateListeners) {
    listener(menuState);
  }
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(PlatformChannels.UpdateStateChanged, menuState);
    }
  }
}

function updateMenuItemLabel(): void {
  const item = Menu.getApplicationMenu()?.getMenuItemById(CHECK_FOR_UPDATE_MENU_ID);
  if (!item) {
    return;
  }
  item.label = getDesktopMenuMessage(
    menuLocale,
    menuState.kind === "checking"
      ? desktopMenuMessageIds.helpCheckingForUpdates
      : desktopMenuMessageIds.helpCheckForUpdates,
  );
  item.enabled = menuState.enabled;
}

function syncMenuItemState(): void {
  updateMenuItemLabel();
}

async function runUpdateCheck(options: {
  interactive: boolean;
  originWindow?: BrowserWindow | null;
}): Promise<void> {
  if (checkInFlight) {
    logger.info("[self-update] skip check: already in flight");
    return;
  }

  checkInFlight = true;
  setMenuState({ kind: "checking", enabled: false });
  try {
    const result = await checkLatestSelfUpdate({
      currentVersion: getCurrentVersionForUpdateCheck(),
      fetchImpl: (input, init) => net.fetch(input, init),
    });
    if (result.kind === "available") {
      logger.info(
        `[self-update] update available current=${result.currentVersion} latest=${result.tagName}`,
      );
      if (options.interactive || !autoNotifiedVersions.has(result.tagName)) {
        autoNotifiedVersions.add(result.tagName);
        await showUpdateResultDialog(result, options.originWindow);
      }
    } else {
      logger.info(`[self-update] already up to date current=${result.currentVersion}`);
      if (options.interactive) {
        await showUpdateResultDialog(result, options.originWindow);
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn(`[self-update] check failed: ${message}`);
    if (options.interactive) {
      await showUpdateErrorDialog(error, options.originWindow);
    }
  } finally {
    checkInFlight = false;
    setMenuState({ kind: "idle", enabled: true });
  }
}

export function checkForUpdateMenuClick(originWindow?: BrowserWindow | null): void {
  logger.info("[self-update] user clicked Check for Updates");
  void runUpdateCheck({ interactive: true, originWindow });
}

export function requestAutoUpdateCheckWithoutWindow(reason = "manual"): void {
  logger.info(`[self-update] ${reason}: check requested without window`);
  void runUpdateCheck({ interactive: true });
}

export function requestForceAutoUpdate(
  onStateChange: (state: ForceAutoUpdateState) => void,
  _reason?: string,
  _minimumVersion?: string,
): () => void {
  // 自维护构建不再执行官方强制更新；保留导出以避免旧调用方在编译期断裂。
  onStateChange({ kind: "error", message: "Force update is disabled in self-hosted builds." });
  return () => {};
}

export function getAutoUpdaterState(): UpdateStatePayload {
  return menuState;
}

export function onAutoUpdaterStateChanged(
  listener: (state: UpdateStatePayload) => void,
): () => void {
  stateListeners.add(listener);
  return () => {
    stateListeners.delete(listener);
  };
}

export function syncAutoUpdaterStateToWindow(win: BrowserWindow): void {
  if (!win.isDestroyed()) {
    win.webContents.send(PlatformChannels.UpdateStateChanged, menuState);
  }
}

export function syncReadyUpdateToWindow(_win: BrowserWindow): void {
  // 自维护构建不提供应用内下载/安装，保留窗口生命周期接口为空实现。
}

export function syncPostUpdateReleaseNotesToWindow(_win: BrowserWindow): void {
  // 更新说明由 GitHub Release 页面展示，不再注入客户端。
}

export async function acknowledgePostUpdateReleaseNotes(
  _version: string,
  _settingService: unknown,
): Promise<void> {}

export async function hydratePendingPostUpdateReleaseNotes(
  _settingService: unknown,
): Promise<void> {}

export function refreshAutoUpdaterReleaseChannel(
  _receivePreviewUpdates: boolean,
  _reason?: string,
): void {
  // 自维护构建没有 stable/preview 双通道。
}

export function resolveUpdateFeedSourceFromStartupConfig(): undefined {
  // 保留导出以兼容旧启动代码；自维护构建只使用 GitHub Release。
  return undefined;
}

export function setAutoUpdaterMenuLocale(locale: Locale): void {
  menuLocale = locale;
  syncMenuItemState();
}

interface InitAutoUpdaterOptions {
  enabled?: boolean;
  locale?: Locale;
}

export async function initAutoUpdater(options: InitAutoUpdaterOptions = {}): Promise<void> {
  autoUpdateEnabled = options.enabled !== false;
  if (options.locale) {
    menuLocale = options.locale;
  }
  syncMenuItemState();

  if (autoCheckTimer) {
    clearTimeout(autoCheckTimer);
    autoCheckTimer = null;
  }
  if (autoCheckInterval) {
    clearInterval(autoCheckInterval);
    autoCheckInterval = null;
  }

  if (!autoUpdateEnabled || !app.isPackaged) {
    logger.info(
      `[self-update] automatic checks disabled (enabled=${autoUpdateEnabled} packaged=${app.isPackaged})`,
    );
    return;
  }

  logger.info(
    `[self-update] automatic checks enabled current=${getCurrentVersionForUpdateCheck()} repository=${SELF_UPDATE_REPOSITORY}`,
  );
  autoCheckTimer = setTimeout(() => {
    void runUpdateCheck({ interactive: false });
  }, AUTO_UPDATE_CHECK_DELAY_MS);
  autoCheckTimer.unref?.();
  autoCheckInterval = setInterval(() => {
    void runUpdateCheck({ interactive: false });
  }, AUTO_UPDATE_CHECK_INTERVAL_MS);
  autoCheckInterval.unref?.();
}
