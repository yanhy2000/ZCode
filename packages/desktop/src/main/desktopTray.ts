import { app, Menu, Tray } from "electron";
import { join } from "node:path";
import {
  DesktopCommandIds,
  desktopMenuMessageIds,
  getDesktopMenuMessage,
  type DesktopCommandId,
  type Locale,
} from "@zcode/shared";
import { runtimeApplicationName } from "./desktopRuntimeEnv.js";

let desktopTray: Tray | null = null;
let rebuildDesktopTrayContextMenu: (() => void) | null = null;

export function resolveDesktopTrayIconPath(platform: NodeJS.Platform = process.platform) {
  // Linux 托盘只接受 PNG（.ico 不会渲染）；打包态 icon.png 已由 extraResources 无条件放入
  // resources 目录（electron-builder.config.js），Windows 继续用独立托盘 .ico 避免高 DPI 模糊。
  if (platform === "linux") {
    return app.isPackaged
      ? join(process.resourcesPath, "icon.png")
      : join(import.meta.dirname, "../../build/icon.png");
  }
  return app.isPackaged
    ? join(process.resourcesPath, "tray_icon.ico")
    : join(import.meta.dirname, "../../build/icon.ico");
}

export function createDesktopTray(options: {
  platform?: NodeJS.Platform;
  getLocale: () => Locale;
  showCurrentWindow: () => Promise<void> | void;
  executeDesktopCommand: (command: DesktopCommandId) => Promise<unknown>;
  quitApp: () => void;
  logger: { warn: (...args: unknown[]) => void };
}) {
  const platform = options.platform ?? process.platform;
  // Linux 驻留能力由 createCloseToTrayCapabilityMonitor 探测决定（spec：
  // docs/desktop/linux-close-to-tray.md）；这里只挡平台，能力不过关时调用方不应传入 linux。
  if (platform !== "win32" && platform !== "linux") {
    return null;
  }

  if (desktopTray) {
    return desktopTray;
  }

  try {
    desktopTray = new Tray(resolveDesktopTrayIconPath(platform));
  } catch (error) {
    options.logger.warn("[desktop-tray] failed to create tray icon", error);
    return null;
  }

  const getLabel = (id: (typeof desktopMenuMessageIds)[keyof typeof desktopMenuMessageIds]) =>
    getDesktopMenuMessage(options.getLocale(), id);
  const showTrayWindow = () => {
    void Promise.resolve(options.showCurrentWindow()).catch((error) => {
      options.logger.warn("[desktop-tray] failed to show current window", error);
    });
  };
  const executeTrayCommand = (command: DesktopCommandId) => {
    void Promise.resolve(options.showCurrentWindow())
      .then(() => options.executeDesktopCommand(command))
      .catch((error) => {
        options.logger.warn(`[desktop-tray] failed to execute tray command ${command}`, error);
      });
  };
  const rebuildContextMenu = () => {
    // 托盘悬停提示显示安装身份（`ZCode Dev`），而不是 i18n 里的产品名 `ZCode`：
    // 正式身份与官方 ZCode 并存时，托盘图标必须能分辨是哪个版本。
    // 用运行时身份常量而不是 app.getName()，避免依赖 Electron 实例状态（也便于单测）。
    // 菜单项文案保持产品口径（「打开 ZCode」等），避免应用内文案与品牌不一致。
    desktopTray?.setToolTip(runtimeApplicationName);
    desktopTray?.setContextMenu(
      Menu.buildFromTemplate([
        {
          label: getLabel(desktopMenuMessageIds.trayOpenZCode),
          click: showTrayWindow,
        },
        { type: "separator" },
        {
          label: getLabel(desktopMenuMessageIds.fileNewTask),
          click: () => executeTrayCommand(DesktopCommandIds.NewTask),
        },
        {
          label: getLabel(desktopMenuMessageIds.fileOpenWorkspace),
          click: () => executeTrayCommand(DesktopCommandIds.OpenWorkspace),
        },
        { type: "separator" },
        {
          label: getLabel(desktopMenuMessageIds.helpCheckForUpdates),
          click: () => executeTrayCommand(DesktopCommandIds.CheckForUpdates),
        },
        {
          label: getLabel(desktopMenuMessageIds.helpAbout),
          click: () => executeTrayCommand(DesktopCommandIds.ShowAbout),
        },
        {
          // 托盘只提供日志诊断入口，避免右键菜单暴露清除全部数据操作；复用应用菜单导出命令。
          label: getLabel(desktopMenuMessageIds.helpExportLogs),
          click: () => executeTrayCommand(DesktopCommandIds.ExportLogs),
        },
        { type: "separator" },
        {
          label: getLabel(desktopMenuMessageIds.trayQuit),
          click: () => options.quitApp(),
        },
      ]),
    );
  };

  rebuildDesktopTrayContextMenu = rebuildContextMenu;
  desktopTray.on("click", showTrayWindow);
  desktopTray.on("double-click", showTrayWindow);
  rebuildContextMenu();

  return desktopTray;
}

export function updateWindowsDesktopTrayMenu() {
  rebuildDesktopTrayContextMenu?.();
}
