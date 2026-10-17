# 自维护仓库的权限与开关

> 核对时间：2026-10-17
> 目标：仓库公开可读、CI 可用，但不接受外部贡献，只由仓库所有者维护。

## 当前状态

| 项 | 值 | 说明 |
| --- | --- | --- |
| 可见性 | Public | 公开 fork，父仓库 `zai-org/ZCode` |
| Pull Requests | 关闭 | `hasPullRequestsEnabled=false` |
| Issues | 关闭 | `hasIssuesEnabled=false` |
| Projects | 关闭 | `hasProjectsEnabled=false` |
| Discussions | 关闭 | `hasDiscussionsEnabled=false` |
| Wiki | 关闭 | `hasWikiEnabled=false` |
| 协作者 | 仅 `yanhy2000`（admin） | 其他人没有 push/merge 权限 |
| 分支保护 | 未设置 | `main` 目前没有 ruleset / protection |
| 允许 fork | 是 | `allow_forking=true` |
| Actions | 开启 | 默认 workflow 权限 `read` |
| Secret scanning | 开启 | push protection 也开启 |
| 发布 | 目前只有 draft release 流程 | 公开仓库的已发布 release 对所有人可见 |

## 结论

- 外部用户不能给你提 Issue，也不能给你提 PR；没有其他协作者，因此也不能直接 push 或 merge。
- 公开仓库仍然允许任何人读取代码、fork 仓库（当前 `allow_forking=true`），以及在 Actions 页面下载构建 artifact。由于 PR 已关闭，fork 不能变成对你仓库的 PR。
- 目前唯一明显的缺口是 `main` 没有分支保护：虽然只有你能写，但仍建议禁止强制推送和删除分支，避免误操作。

## 建议设置

### 1. 保护 `main`

只禁止删除和 non-fast-forward，不要求 PR（因为你已经关闭 PR）：

```bash
gh api repos/yanhy2000/ZCode/rulesets \
  -X POST \
  -H "Accept: application/vnd.github+json" \
  --input - <<'JSON'
{
  "name": "protect-main",
  "target": "branch",
  "enforcement": "active",
  "conditions": {
    "ref_name": {
      "include": ["refs/heads/main"],
      "exclude": []
    }
  },
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" }
  ]
}
JSON
```

这条规则允许你继续直接 push，但会阻止 `git push --force` 和删除 `main`。

### 2. 可选：关闭 fork

如果不想让别人继续创建 fork：

```bash
gh api repos/yanhy2000/ZCode -X PATCH -F allow_forking=false
```

注意：

- 已经存在的 fork 不会被删除。
- 关闭 fork 不会影响你从 `upstream` merge 新 tag。
- 公开仓库的代码本身仍可被查看和复制，Apache-2.0 也允许这样做。

### 3. 如果 artifact 也不能公开

公开仓库的 Actions artifact 对有读权限的人可见。若测试包也不想公开，有两个选择：

1. 把仓库改成私有。公开 fork 通常不能直接改成私有；需要新建一个独立的私有仓库，把当前提交推过去，并继续添加 `upstream` remote。
2. 私有仓库 + 自托管 runner：在本地 Windows 机器上注册 self-hosted runner，把 workflow 的 `runs-on` 改成该 runner 的 label。这样不消耗 GitHub 托管 Windows 分钟，构建产物也只在你控制的环境里。

在改为私有之前，当前公开仓库的 draft release 只有维护者可见；一旦发布 release，资产就会公开。

## 工作流与关闭的开关对齐

- `ci.yml`：不对 PR 触发，只响应 `push` 和手动触发。
- `build-windows.yml`：不对 PR 触发，只响应 `push` 到 `main` 和手动触发；workflow/文档变更不触发重新打包。
- `sync-upstream.yml`：不创建 Issue；发现上游新 tag 时让 workflow 失败并在 summary 中给出同步命令，同时可选发送飞书 webhook。
- `release.yml`：只创建 draft release，不自动发布。
