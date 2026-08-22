---
title: 自分のサイトにドキュメントエディタを埋め込む — iframe + postMessage API
description: iframe 1 つと postMessage API で、DOCX・XLSX・PPTX・CSV のエディタを自分の Web アプリに組み込めます。認証もファイルもあなたのアプリ側に残り、エディタがトークンを見ることはありません。オープンソース（AGPL-3.0）、セルフホスト可能、ホワイトラベル対応。
eyebrow: 開発者向け · 埋め込み
h1: 自分の Web アプリにドキュメントエディタを埋め込む
lead: '**DOCX・XLSX・PPTX・CSV** のエディタを、iframe 1 つと **postMessage** API だけでプロダクトに追加できます。認証・ファイル取得・アップロードはあなたのアプリが持ち続け、エディタは編集だけを担当します——ユーザーのトークンを見ることはありません。'
cta: ライブデモを開く →
ctaHref: /embed-demo.html
ogDescription: iframe 1 つで DOCX/XLSX/PPTX/CSV エディタをアプリに組み込み。認証はアプリ側のまま、エディタはトークンを見ません。オープンソースでセルフホスト可能。
breadcrumb: Embed Document Editor
howTo: 自分のサイトにドキュメントエディタを埋め込む方法
appDescription: iframe と postMessage API で自分の Web アプリに埋め込める、ブラウザ内で動作するドキュメントエディタ。
---

エディタは OnlyOffice の WebAssembly エンジンでブラウザ内だけで動作するため、ドキュメントはクライアント側で描画・編集されます——ドキュメントサーバーを立てる必要はありません。推奨する構成は境界をきれいに保ちます: **親アプリが認証・取得・保存を担当し、iframe は編集だけを担当する。** トークンも Cookie も業務 API も、あなたのアプリの中に留まります。

## 一つの iframe で追加する

```html
<iframe
  id="documentEditor"
  src="https://edit.chaxus.com/editor?embed=1&embedOrigin=https://your-app.example.com"
  style="width: 100%; height: 720px; border: 0"
></iframe>
```

そのあとは `postMessage` で通信します。各コマンドは返信と対応づけるための `id` を持ち、エディタのイベントはすべて `document:*` メッセージです:

```js
// open a file your app already fetched (auth stays with you)
iframe.contentWindow.postMessage(
  { id, type: 'document:open-buffer', payload: { fileName: 'report.xlsx', buffer } },
  'https://edit.chaxus.com',
);

// ask for the edited file back, then upload it yourself
iframe.contentWindow.postMessage({ id, type: 'document:save', payload: { targetExt: 'XLSX' } }, editorOrigin);
// → editor replies with { type: 'document:saved', payload: { fileName, file } }
```

## 得られるもの

- iframe 1 つと小さな **postMessage** のコマンド／レスポンス API——インストールする SDK はありません
- **URL・File・ArrayBuffer** から開けます（あなたのアプリが自分の資格情報で取得したバイト列でも可）
- **XLSX・DOCX・PPTX・CSV** として保存し、`File` として返却——アップロードはあなたのアプリが行います
- 読み取り専用モード、メッセージ単位のオリジン制限（`embedOrigin`）、状態の問い合わせ
- 動かすドキュメントサーバーは不要——編集は 100% クライアントサイドの WebAssembly です
- オープンソース（AGPL-3.0）でセルフホスト可能——自分のドメインの下に埋め込めます

## 仕組み

1. `/editor?embed=1` を指す iframe を、レイアウトに合わせたサイズで追加します。
2. `document:ready` イベントを待ってから、`document:open-url`・`open-file`・`open-buffer` を送ります。
3. ユーザーはその場で編集します。あなたのアプリがどこかへ送らない限り、ファイルがブラウザから出ることはありません。
4. `document:save` を送ると、編集後のファイルが `document:saved` で返ります。アップロードはあなたのアプリが自分の認証で行います。

## 読み取り専用・プレビューモード

ビューア、レビュー工程、ロックされたレコードなど、読み取り専用で開きたいときは open コマンドに `readonly: true` を渡します。`document:set-readonly` でいつでも切り替えられます——再読み込みは不要で、ユーザーが見ていた位置も保たれます。読み取り専用のあいだは編集が無効になり、`document:save` は `document:error` を返します。`document:get-state` は現在の `readonly` フラグを報告します。

```js
// open locked, unlock later
send('document:open-url', { url, readonly: true });
send('document:set-readonly', { readonly: false });
```

## よくある質問

### ドキュメントエディタを埋め込むには？

`/editor?embed=1` を指す iframe を 1 つ追加し、postMessage API で開く・保存するを操作します。動作するデモは [/embed-demo.html](/embed-demo.html) にあります。

### エディタはユーザーの認証トークンを見ますか？

いいえ。認証・ファイル取得・アップロードはあなたのアプリに残ります——アプリが自分の資格情報でファイルを取得し、バイト列をエディタへ渡すため、トークンや Cookie が iframe に入ることはありません。

### 埋め込んだエディタはどの形式を扱えますか？

DOCX・XLSX・PPTX・CSV です。OnlyOffice の WebAssembly エンジンでクライアント側で編集します。save コマンドは XLSX・DOCX・PPTX・CSV へ書き出せます。

### セルフホストやホワイトラベルはできますか？

はい。AGPL-3.0 のオープンソースで、静的ファイルとして配布されるため、自分でホストして自分のドメインの下に埋め込めます。

### エディタと通信できるサイトを制限するには？

iframe の URL に `embedOrigin` を付けてメッセージのやり取りを特定のオリジンに限定し、あなた側のメッセージハンドラでも `event.origin` を検証してください。

### ドキュメントを読み取り専用で表示したり、途中からロックしたりできますか？

はい。開くときに `readonly: true` を渡すか、いつでも `document:set-readonly` を送ってください——再読み込みなしにその場で切り替わり、ロック中の保存は拒否されます。
