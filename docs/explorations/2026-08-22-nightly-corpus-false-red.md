# 夜间套件天天红：16 个假失败来自一行 device，15 个来自 fuzz 语料

2026-08-22

## 起因

用户拿着 run `32519705139`（Nightly corpus，2026-08-21 03:17 那趟）问"这个 action 是为什么"。
翻了一下 `gh run list`：这个 workflow **从 8-15 上线起每一趟都是 failure**。红成常态，
就没人看了——而它本来是 v9 回归战役的信号源。

三个 job 挂了两个：

| job                            | 结果                   |
| ------------------------------ | ---------------------- |
| Cross-browser (WebKit+Firefox) | 20 failed / 174 passed |
| Real-document matrix (POI)     | 20 failed / 280 passed |
| Slow-network budgets           | ✅                     |

40 个红里，**31 个不是缺陷**。

## 一、16 个假失败：`devices['Pixel 5']` 把 browserName 变成了 chromium

`test/e2e/mobile-slide.spec.ts`（#145 手机版式那套）文件顶上写：

```ts
test.use({ ...devices['Pixel 5'] });
```

Playwright 的 device 描述符里带 `defaultBrowserType: 'chromium'`，它**压过 project 的浏览器**。
于是在夜间的 webkit / firefox 两个 project 下：

1. 实际要启的是 Chromium，而这个 job 只装了 webkit + firefox
   → `browserType.launch: Executable doesn't exist at …/chromium_headless_shell-1234/…`；
2. 本来该拦住它的三道守卫

   ```ts
   test.skip(({ browserName }) => browserName !== 'chromium', 'device emulation needs chromium');
   ```

   **永远不触发**——`browserName` 也被 device 改成了 `'chromium'`。

8 条用例 × 2 个引擎 = 16 个红，全是"浏览器没装"，与被测代码无关。

### 修法：按 project 名判，不按 browserName 判

`browserName` 是"实际启的是谁"，而这里要问的是"我在哪个 project 下跑"。Playwright 没有
内置的 project 名 fixture，`test.skip` 的条件回调只拿得到 fixtures（`ConditionBody<TestArgs> = (args) => boolean`，
没有 testInfo），所以在 `test/e2e/lib/l0.ts` 里加一个 worker 级 fixture：

```ts
projectName: [
  async ({}, use, workerInfo) => {
    await use(workerInfo.project.name);
  },
  { scope: 'worker' },
],
```

三处守卫改成 `test.skip(({ projectName }) => projectName !== 'chromium', …)`。它不依赖任何
其它 fixture，所以求值时不会去创建 `page`，浏览器压根不会启。

两个细节，都是试出来的：

- 第一个参数**必须**是解构模式。写成 `async (_unused, use, workerInfo)` 直接被 Playwright
  拒绝：`First argument must use the object destructuring pattern: _unused`。空解构 `{}` 会被
  oxlint 的 `no-empty-pattern` 警告，本仓此前零 disable 注释，这里只能破例加一条
  `// eslint-disable-next-line no-empty-pattern`（**注释必须紧贴上一行、不能带 `-- 理由` 尾巴**，
  否则 oxlint 不认，实测警告照旧）。
- 加在 l0 而不是 spec 里：三个 config（browsers / pages / docker）都从 l0 导入 `test`，
  以后再有 spec 踩同样的坑，守卫是现成的。

### 反向验证

`E2E_BASE_URL=http://127.0.0.1:9`（配置里 `REMOTE` 非空就不起 webServer，跳过的用例根本不需要服务器）：

| 状态                     | 结果                                 |
| ------------------------ | ------------------------------------ |
| 改成 `projectName` 后    | **16 skipped**                       |
| 退回 `browserName`       | **16 failed**                        |
| chromium project（改后） | **1 passed**（真跑，真 build，6.9s） |

## 二、15 个假失败：POI 的 fuzz 语料

语料 job 的 20 个红：11 个 `-82`（打开转换失败）、9 个 `Target crashed`（渲染进程直接崩）。
按文件名拆开看，其中 15 个是 POI 自己的模糊测试产物：

- `clusterfuzz-testcase-minimized-POIXWPFFuzzer-*.docx`（12 个）
- `crash-517626e815e0afa9decd0ebb6d1dee63fb9907dd.docx`
- `Fuzzed.doc`
- `clusterfuzz-testcase-minimized-POIHWPFFuzzer-*.doc`

这些文件被 POI 收进来，恰恰是因为它们**能把解析器搞崩**——是被 minimizer 削到最小的字节汤，
不是文档。"本编辑器也打不开它"不构成发现。workflow 里的 `CORPUS_EXCLUDE` 已经排掉了
`password|corrupt|truncat|broken|invalid|damaged`，只是没覆盖 fuzz 这一类。

### 词要窄，不能直接写 `fuzz|crash`

把 POI 的 test-data（spreadsheet / document / slideshow 三个目录，1298 个受支持扩展名的文件）
拉下来核了一遍：`fuzz|crash` 命中 89 个，其中两个是**真实 bug 报告里的文档**——
`51921-Word-Crash067.doc` / `.docx`（POI bug 51921，崩的是 Word 不是 fuzzer）。把它们排掉就
排掉了真信号。最终用：

```
clusterfuzz|fuzzer|fuzzed|poi-fuzz|crash-[0-9a-f]{6}
```

命中 87 个（8 个 fuzz 家族 + 5 个 `crash-<sha1>` + `Fuzzed.doc` + `poi-fuzz.xls`），
`51921-Word-Crash067.*` 保留。全量语料从 1298 → 排掉 119（原本 ~32）。

## 三、剩下的 9 个是真信号，留着

| 文件                   | 表现                                                             |
| ---------------------- | ---------------------------------------------------------------- |
| `47950_lower.doc`      | -82 打不开                                                       |
| `47950_upper.doc`      | -82 打不开                                                       |
| `Bug51944.doc`         | -82 打不开                                                       |
| `2100a8d4….ppt`        | -82 打不开                                                       |
| `deep-table-cell.docx` | 跑 1.8 min 后**渲染进程崩溃**                                    |
| WebKit `entry-paths`   | IndexedDB 交接 `page.evaluate: null`                             |
| WebKit `main-site` ×2  | 编辑器 90s 不 ready；`sdk-all.js … due to access control checks` |
| Firefox `open-retry`   | SW 拦截 `fonts/076` / `api.js` 时报 unexpected error             |

这轮不动它们——本次改的是"让红代表缺陷"，不是把红消掉。四个 `.doc` / `.ppt` 的 -82 和
`deep-table-cell.docx` 的崩溃属于 v9 战役方向零的账，WebKit/Firefox 那四条是引擎差异，
Chromium 门禁看不到。

## 用例固化

`test/unit/workflow-contract.test.ts` 新增一个 `.github/workflows/nightly-corpus.yml` 段：

1. **按 project 跳过，不按 browserName**——扫 `test/e2e/*.spec.ts`，凡是做了
   `test.use({ ...devices[...] })` 的 spec，禁止出现 `test.skip(({ browserName })`，
   必须出现 `test.skip(({ projectName })`，并要求 l0 里确有 `projectName` fixture。
2. **排掉 fuzz 产物、但不排掉真实 bug 文档**——直接从 YAML 里抠出 `CORPUS_EXCLUDE` 编译成
   正则，对四个应排的文件名断言 `true`、对 `51921-Word-Crash067.doc` / `deep-table-cell.docx` /
   `Bug51944.doc` 断言 `false`。

两条都做了反向验证：分别退回旧写法后，`vitest run test/unit/workflow-contract.test.ts`
报 `2 failed | 57 passed`；恢复后 59 passed。

## 教训

一个"红了是信号不是门禁"的套件，如果红的原因里混着基础设施噪音，它就退化成噪音本身——
连着七晚全红，没人再点开看，那 9 个真信号也就等于没报。**信号源的第一要求是低假阳性，
不是高灵敏度。**
