# 清理 Dependabot 安全告警(vite / undici)

> 2026-07-05

## 背景

push `fix/sw-freshness` 时 GitHub 报了 8 个 Dependabot 告警(3 high / 3 moderate / 2 low)。
逐条拉下来看,其实只涉及 **2 个包**,且都在 **devDependency(构建/测试链)**,不进浏览器产物:

| 包 | 受影响范围 | 补丁版本 | 引入方式 |
|---|---|---|---|
| `vite` | `>=8.0.0 <=8.0.15` (high + medium) | `8.0.16` | 直接 devDependency `^8.0.14` |
| `undici` | `>=7.0.0 <7.28.0` (high/medium/low ×多条) | `7.28.0` | 传递依赖,`jsdom@29` → `undici` |

告警 GHSA:undici 是 `GHSA-hm92-r4w5-c3mj`。

## 改动

### vite → `^8.0.16`(实际解析 8.1.3)
`package.json` 里把 `vite` 的 range 从 `^8.0.14` 提到 `^8.0.16`,显式声明已修复。
caret 允许解析到 8.1.3(8.x 内的小版本),> 8.0.16,覆盖漏洞范围。

### undici → override 到 `^7.28.0`
`undici` 是 `jsdom` 拉进来的传递依赖,不能直接改 range,用 pnpm overrides 强制。

**踩坑:override 的位置。**
- pnpm 10+ 起,`overrides` 从 `package.json` 的 `"pnpm.overrides"` **迁到了 `pnpm-workspace.yaml`**。
- 一开始写在 `package.json` 的 `pnpm.overrides` 里,`pnpm install` 显示 ok 但 **override 根本没进 lockfile**,undici 仍是 7.26.0。
- 挪到 `pnpm-workspace.yaml` 顶层 `overrides:` 后立即生效。

```yaml
# pnpm-workspace.yaml
overrides:
  undici: ^7.28.0
```

固定在 **7.x**(不放开到最新的 8.7.0)是为了留在 jsdom 支持的 major 范围内,避免为清一个 dev 依赖的告警而引入 jsdom 兼容风险。undici 7.28.0 发布于 2026-06-15,已过仓库的 `minimumReleaseAge` 冷却期。

## 验证

- `pnpm why undici` → `undici@7.28.0`;`pnpm ls vite` → `8.1.3`
- `pnpm audit` → **No known vulnerabilities found**(从 7 条降到 0)
- `pnpm run lint:ts` → 通过
- `pnpm run test` → 19 files / 240 tests 全过(vite 从 8.0.14 到 8.1.3 的小版本跳跃未影响构建与测试)

## 影响面

- 纯 devDependency,**不影响浏览器产物、不影响线上行为**
- fork / 未改动者拉最新后 `pnpm install` 自动获得修复版本
