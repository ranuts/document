# GitHub Pages 跳转页不再每次推送都重新发布

`pages-build-site.yml` 只负责把 `redirect/`（`index.html` + `404.html`）发布到 GitHub Pages，
让旧的 `ranuts.github.io/document/*` 链接带着路径和参数跳到 edit.chaxus.com。

它原来对 main 的每一次推送都跑一遍，于是仓库的 Deployments 页面堆了上百条 `github-pages` 记录：
2026-08 到 2026-11 共 100 次，而 `redirect/` 自 2026-07-05 上线后只改过一次。
GitHub Pages 会一直托管最后一次发布的产物，重复发布同样两个文件没有任何作用。

改动：`push` 触发加 `paths`，只有 `redirect/**` 或这个 workflow 文件本身变化时才发布，保留 `workflow_dispatch` 手动发布。
**不能关掉 GitHub Pages**：关掉之后旧链接就没有跳转页了。

验证：2026-11-02 `curl https://ranuts.github.io/document/` 返回的就是当前 `redirect/index.html`，
说明最后一次发布的产物仍在托管。`workflow-contract.test.ts` 68 条通过。
