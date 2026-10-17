import { AppUsagePanel } from "@/settings/usage-stats/AppUsagePanel.js";

export type UsageStatsSectionTab = "app";

export function UsageStatsSection({ activeTab: _activeTab }: { activeTab: UsageStatsSectionTab }) {
  return <AppUsagePanel />;
}
