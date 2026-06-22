# Lint / Format 基础设施清理

**日期**：2026-06-22

---

## 问题：`format:check` OOM 崩溃

### 根因

`apps/web/package.json` 的 `format:check` 脚本执行 `prettier --check .`，从 `apps/web/` 目录递归扫描所有文件。

Prettier 3.x 从**命令执行目录**向上查找 `.prettierignore`，根目录的 `.prettierignore`（含 `public/`）不覆盖子包执行时的路径。`apps/web/` 没有本地 `.prettierignore`，导致 Prettier 尝试解析：

- `public-v7/sdkjs/` + `public-v7/web-apps/` — 712 个 minified JS 文件
- `public-v9/sdkjs/` + `public-v9/web-apps/` — 同级别体量

Node.js 尝试将所有文件读入内存进行 AST 解析，触发 `FATAL ERROR: Allocation failed - JavaScript heap out of memory`。

### 修复：新建 `apps/web/.prettierignore`

```
# OnlyOffice vendor files — minified, not our code
public-v7/
public-v9/

# Build output and generated reports
dist/
coverage/
playwright-report/
test-results/
```

---

## 问题：oxlint 扫描 vendor JS

### 根因

`.oxlintrc.json` 的 `ignorePatterns` 包含 `"**/public/**"`，但这只匹配名称**恰好**为 `public` 的目录。`public-v7/` 和 `public-v9/` 不匹配，oxlint 因此扫描了数百个 OnlyOffice minified JS 文件，产生大量无意义 warning。

### 修复

```json
"**/public/**",
"**/public-v7/**",   // ← 新增
"**/public-v9/**",   // ← 新增
```

---

## 问题：`src/lib/ui.ts` 未使用 import

FAB 移除后，`ui.ts` 中 `localStorageGetItem`、`localStorageSetItem` 两个 import 已无实际调用：

```typescript
// 删除前
import { localStorageGetItem, localStorageSetItem } from 'ranuts/utils';
```

oxlint `no-unused-vars` 规则报 warning，直接删除该行。

---

## 删除 `apps/web/public-v9/web-apps.docker/`

该目录是 OnlyOffice Docker 镜像中包含的另一份 web-apps 副本（`web-apps/` 已有），体积 188MB，vite 配置和任何代码均无引用。直接删除，节省仓库体积。
