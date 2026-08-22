# save-to-file 用例读到一半的文件（CI 偶发红）

日期：2026-08-22
分支：`fix/save-to-file-read-race`
现场：PR #177（只改 readme 翻译）的 `E2E (Docker image) shard 3`
[run 32560753184](https://github.com/ranuts/document/actions/runs/32560753184/job/97001811809)

## 症状

```
1) [chromium] › test/e2e/save-to-file.spec.ts:103:3 › saving into the document own file (real editor)
   › still writes to the same file after a reload

  Error: page.evaluate: NotReadableError: The requested file could not be read,
  typically due to permission problems that have occurred after a reference to
  a file was acquired.

    > 29 |   page.evaluate(async () => {
      30 |     const root = await navigator.storage.getDirectory();
      31 |     const handle = await root.getFileHandle('saved-document.docx');
      32 |     return Array.from(new Uint8Array(await (await handle.getFile()).arrayBuffer()));
```

同一个 PR 的另外两套 E2E（vite preview / wrangler pages）全绿，改动本身是八个
readme 文件，与保存链路无关——**是用例自己的竞态**，不是被测代码的缺陷。

## 根因

`FileSystemWritableFileStream` 不在原文件上原地改写：写进别处，`close()` 时整体
换进来。`getFile()` 拿到的是**换进来之前**那个文件的快照（大小 + 修改时间），
真正读字节是在 `arrayBuffer()`。中间只要发生一次 swap，快照就作废，Chromium 抛
`NotReadableError`。

用例的读恰好排在这个窗口里：`Ctrl+S` 之后立刻开始 poll 文件内容，而一次保存要先
过 x2t 转换，`close()` 落在 poll 的某一轮中间。CI 的 docker 分片两个 worker 抢核，
时序更容易踩上，所以只有它偶发。

放大它的是第二件事：**`expect.poll` 的回调抛异常不会重试**，直接判失败。于是
"读早了一拍"被报成"文件读不出来"。

### 复现（脱离本项目，20 行）

```js
const handle = await (await navigator.storage.getDirectory()).getFileHandle('t.bin', { create: true });
let w = await handle.createWritable();
await w.write(new Uint8Array(1 << 20));
await w.close();

const snapshot = await handle.getFile(); // 读从这里开始
w = await handle.createWritable();
await w.write(new Uint8Array(2 << 20));
await w.close(); // 保存在这里提交
await snapshot.arrayBuffer(); // NotReadableError
```

实测输出：

```
naive   : threw NotReadableError
retrying: read ok on attempt 2 (3145728 bytes)
```

## 修法：不再和写抢，而是等写完

第一版是给读加重试（每次重新取快照，最多 5 次）。它能过，但只是把窗口变小——用例
仍然在"文件内容会不会变成我要的样子"上轮询，只是撞上的概率低了。既然窗口存在，
CI 的负载迟早会再撞一次。

**彻底的做法是让用例知道写在什么时候结束**，而不是猜。`stubPicker` 里包住
`FileSystemFileHandle.prototype.createWritable`，记两个数：

| 计数                | 含义                    |
| ------------------- | ----------------------- |
| `__writesInFlight`  | 此刻开着几个写入流      |
| `__writesCommitted` | 已经 `close()` 成功几次 |

包**原型**而不是包 picker 返回的那个 handle：第二个页面用的 handle 是 IndexedDB
重建出来的，挂在原对象上的东西那时早就没了——而"句柄能被结构化克隆存取回来"正是
这个用例要测的东西。

于是所有读都走同一道闸：

```ts
await waitForWrites(page, 1); // 这次保存的写已提交，且没有流开着
expect(await savedText(page)).toContain('first paragraph one');
```

竞态窗口不是被躲开，是不存在了：读开始的时候没有任何流开着，也不会有新的
——那个文件只有用户保存时才会被打开写。

顺带多出一条断言，是原来测不到的：

```ts
expect(await writesCommitted(page)).toBe(2); // 两次 Ctrl+S = 恰好两次写
```

保存之外没人动用户的文件（自动保存快照只进 IndexedDB，见
[2026-08-22-autosave-history-implementation.md](./2026-08-22-autosave-history-implementation.md)）。
这一条以后要是被破坏，红的是它，而不是某个下游用例偶发。

产品代码一行没动：`lib/save-target.ts` 一次保存只 `createWritable` 一次。

## 验证

1. **机制的反向验证**：上面那段复现脚本，`naive` 那半（老写法）必抛
   `NotReadableError`，`retrying` 那半读到完整字节。竞态是真的，不是猜的。
2. **断言活性**：把期望文本改成 `first paragraph one two THREE` 跑一遍，用例变红
   ——说明它确实在读真实存回的字节，绿不是因为断言没执行。
3. `--repeat-each=3` 跑这个 spec，6 次全绿；改动前的完整 e2e 套件（115 用例）
   也全绿。

## 顺带确认

`navigator.storage.getDirectory()` 全仓只有这个 spec 在用。
