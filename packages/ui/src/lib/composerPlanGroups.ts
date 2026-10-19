import type { ProviderFamilyDomain, ProviderFamilyConnectionSelection } from "@zcode/shared";
import type { ModelSelectGroup, ModelSelectGroupItem } from "@/ModelConfigSelect.js";

// fork 裁剪：账号套餐 / 团队套餐 / start plan 的投影逻辑随云端能力一起物理删除，
// Composer 只保留普通模型分组所需的类型形状。
export interface ComposerConnection {
  key: string;
  label: string;
  providerId: string;
  family: ProviderFamilyDomain;
  selection?: ProviderFamilyConnectionSelection;
  items: ModelSelectGroupItem[];
  disabled?: boolean;
}

export interface ComposerPlanGroup extends ModelSelectGroup {
  connection?: ComposerConnection;
}
