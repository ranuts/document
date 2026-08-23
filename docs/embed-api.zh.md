# iframe 嵌入 API

本项目支持通过 iframe 嵌入到任何 Web 应用中。推荐架构是：**父系统负责鉴权、下载文件和上传保存结果；iframe 只负责文档编辑**。Token、Cookie、业务接口都留在父系统内，编辑器不需要知道授权细节。

项目内置了完整示例页面 `/embed-demo.html`，包含保存时的 sha256 哈希日志，方便调试。

---

## 嵌入编辑器

```html
<iframe
  id="documentEditor"
  src="https://your-deployment/editor?embed=1"
  style="width: 100%; height: 720px; border: 0"
></iframe>
```

> 编辑器位于 `/editor`，首页 `/` 是纯静态落地页。旧链接 `/?embed=1`、`/?src=`、`/?file=`、`/?new=` 仍然有效——`/` 会带同样的参数跳转到 `/editor`。

如需限制只接受指定来源的消息，增加 `embedOrigin`：

```html
<iframe
  id="documentEditor"
  src="https://your-deployment/editor?embed=1&embedOrigin=https://your-system.example.com"
></iframe>
```

---

## 发送命令

建议每条命令带上 `id`，便于匹配响应：

```js
const iframe = document.getElementById('documentEditor');
const editorOrigin = 'https://your-deployment';

function sendEditorCommand(type, payload = {}) {
  const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  iframe.contentWindow.postMessage({ id, type, payload }, editorOrigin);
  return id;
}

window.addEventListener('message', (event) => {
  if (event.origin !== editorOrigin) return;
  const { id, type, payload } = event.data || {};
  if (!type?.startsWith('document:')) return;

  switch (type) {
    case 'document:ready':
      console.log('编辑器已就绪');
      break;
    case 'document:opened':
      console.log('文档已打开', id, payload);
      break;
    case 'document:saved':
      console.log('保存完成', payload.fileName, payload.file);
      break;
    case 'document:error':
      console.error('操作失败', payload.message);
      break;
  }
});
```

---

## 打开文档

### 通过 URL

> **这个 URL 必须允许 CORS。** 取文件的是浏览器而不是服务器，所以响应里要有覆盖编辑器所在
> 页面的 `Access-Control-Allow-Origin` 头。没有它，请求在编辑器拿到第一个字节之前就被拦掉了；
> URL 上的 `?src=`、`?file=` 同理。这是接入时最容易踩的一脚：如果一个文件手动下载能打开、
> 走编辑器打不开，先看响应头。跨域跳转也要一路带着这个头。
> 加不了的场景（第三方主机、签名 URL、需要鉴权的接口），改由父页面自己 fetch，再用
> `document:open-buffer` 把字节传进来。

```js
sendEditorCommand('document:open-url', {
  url: 'https://example.com/files/demo.xlsx',
  fileName: 'demo.xlsx',
  readonly: false,
});
```

如果 URL 需要授权头，可以传 `fetchOptions`。但对于需要鉴权的文件，更推荐由父系统自己 `fetch` 后传入二进制数据：

```js
sendEditorCommand('document:open-url', {
  url: 'https://example.com/api/files/1',
  fileName: 'demo.xlsx',
  fetchOptions: { headers: { Authorization: `Bearer ${token}` } },
});
```

### 通过本地文件选择

```js
const input = document.createElement('input');
input.type = 'file';
input.accept = '.xlsx,.xls,.csv,.docx,.doc,.pptx,.ppt';
input.onchange = () => {
  sendEditorCommand('document:open-file', { file: input.files[0], readonly: false });
};
input.click();
```

### 通过父系统授权请求（推荐用于受保护文件）

```js
const response = await fetch('/api/files/1', {
  headers: { Authorization: `Bearer ${token}` },
});
const buffer = await response.arrayBuffer();
sendEditorCommand('document:open-buffer', { fileName: 'demo.xlsx', buffer, readonly: false });
```

---

## 只读模式

在打开文档时通过 `readonly` 字段设置，或随时切换：

```js
sendEditorCommand('document:set-readonly', { readonly: true });
```

只读模式下编辑权限关闭，`document:save` 会返回 `document:error`。

---

## 保存并上传

保存命令触发编辑器导出当前文档，通过 `document:saved` 返回 `File` 对象。默认保存为当前文档自身的格式（`.docx` 存为 DOCX、`.csv` 存为 CSV……），通过 `targetExt` 指定其他格式。

```js
sendEditorCommand('document:save', { targetExt: 'XLSX' }); // XLSX、DOCX、PPTX、CSV
```

默认情况下，命令会等待编辑器返回**编辑后**的文件。超时则返回 `document:error`，避免误上传原始文件。如需超时时回传原文件，显式开启：

```js
sendEditorCommand('document:save', { targetExt: 'XLSX', returnOriginalOnTimeout: true });
```

父页面拿到文件后上传：

```js
window.addEventListener('message', async (event) => {
  if (event.origin !== editorOrigin) return;
  const { type, payload } = event.data || {};
  if (type !== 'document:saved') return;

  await fetch('/api/files/1', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: payload.file,
  });
});
```

> **注意：** 不要只用 `file.size` 判断文件是否变化。`.xlsx` 是 zip 压缩包格式，轻微编辑后文件大小可能完全相同。内置的 `/embed-demo.html` 每次保存都会在日志中打印 `sha256` 哈希值，方便调试。

---

## 查询当前状态

```js
sendEditorCommand('document:get-state');
// 响应：{ type: 'document:state', payload: { readonly: false, hasDocument: true } }
```

---

## 消息类型参考

| 方向            | 类型                        | 说明                                       |
| --------------- | --------------------------- | ------------------------------------------ |
| 父页面 → iframe | `document:open-url`         | 通过 URL 打开文档                          |
| 父页面 → iframe | `document:open-file`        | 通过 `File` / `Blob` 打开文档              |
| 父页面 → iframe | `document:open-buffer`      | 通过 `ArrayBuffer` / `Uint8Array` 打开文档 |
| 父页面 → iframe | `document:set-readonly`     | 设置只读或可编辑                           |
| 父页面 → iframe | `document:save`             | 保存并返回 `File`                          |
| 父页面 → iframe | `document:get-state`        | 查询当前状态                               |
| iframe → 父页面 | `document:ready`            | 编辑器初始化完成                           |
| iframe → 父页面 | `document:opened`           | 文档打开完成                               |
| iframe → 父页面 | `document:readonly-changed` | 只读状态已切换                             |
| iframe → 父页面 | `document:saved`            | 保存完成，返回文件                         |
| iframe → 父页面 | `document:state`            | 当前状态响应                               |
| iframe → 父页面 | `document:error`            | 操作失败                                   |
