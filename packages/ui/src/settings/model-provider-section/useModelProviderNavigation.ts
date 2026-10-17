import { useEffect, useMemo } from "react";
import type { ProviderSettingsFormProvider } from "@/lib/providerSettingsFormTypes.js";
import { getProviderFormLabel } from "@/lib/providerSettingsFormTypes.js";
import { useZCodeIntl } from "@/i18n/IntlProvider.js";
import type { ModelProviderNavGroup, ModelProviderNavItem } from "./constants.js";
import { createCustomProviderNodeKey } from "./utils.js";
import {
  sortModelProvidersForDisplay,
  type ProviderOrderView,
} from "@/lib/modelProviderOrdering.js";

interface UseModelProviderNavigationOptions {
  modelProviders: ProviderSettingsFormProvider[];
  modelProvidersLoading?: boolean;
  displayOrder?: ProviderOrderView;
  selectedNodeKey: string | null;
  setSelectedNodeKey: (key: string | null) => void;
  intl: ReturnType<typeof useZCodeIntl>["intl"];
}

export function useModelProviderNavigation({
  modelProviders,
  modelProvidersLoading = false,
  displayOrder,
  selectedNodeKey,
  setSelectedNodeKey,
  intl,
}: UseModelProviderNavigationOptions) {
  const customProviders = useMemo(() => {
    const allCustomProviders = modelProviders.filter(
      (provider) => provider.config.group === "standard-personal",
    );
    // 这里复用模型菜单的展示排序，确保设置页和聊天框供应商顺序一致。
    return sortModelProvidersForDisplay(allCustomProviders, displayOrder);
  }, [displayOrder, modelProviders]);

  const navigationGroups = useMemo<ModelProviderNavGroup[]>(
    () => [
      {
        id: "custom",
        title: intl.formatMessage({ id: "settings.modelProvider.customTitle" }),
        items: customProviders.map((provider) => ({
          key: createCustomProviderNodeKey(provider.providerId),
          label: getProviderFormLabel(provider),
          provider,
          statusActive: provider.executable === true,
        })),
      },
    ],
    // 语言切换时 provider 引用可能不变，必须依赖 intl 才能刷新旧 locale 的文案。
    [customProviders, intl],
  );

  const navigationItems = useMemo(
    () => navigationGroups.flatMap((group) => group.items),
    [navigationGroups],
  );

  const selectedNavItem = useMemo(
    () => navigationItems.find((item) => item.key === selectedNodeKey) ?? null,
    [navigationItems, selectedNodeKey],
  );

  const fallbackNodeKey = resolveFallbackModelProviderNodeKey({
    selectableNavigationItems: navigationItems,
  });

  useEffect(() => {
    if (modelProvidersLoading) {
      return;
    }
    const hasSelectedNode = selectedNodeKey
      ? navigationItems.some((item) => item.key === selectedNodeKey)
      : false;
    if (hasSelectedNode) {
      return;
    }
    if (selectedNodeKey !== fallbackNodeKey) {
      setSelectedNodeKey(fallbackNodeKey);
    }
  }, [
    fallbackNodeKey,
    modelProvidersLoading,
    navigationItems,
    selectedNodeKey,
    setSelectedNodeKey,
  ]);

  return {
    navigationGroups,
    navigationItems,
    selectedNavItem,
  };
}

export function resolveFallbackModelProviderNodeKey({
  selectableNavigationItems,
}: {
  selectableNavigationItems: ModelProviderNavItem[];
}): string | null {
  return selectableNavigationItems[0]?.key ?? null;
}

export function resolveModelProviderSideSelectionKey(item: ModelProviderNavItem): string {
  return item.key;
}
