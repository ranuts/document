# オンライン ドキュメント エディター

<p align="center">
  <a href="https://github.com/ranuts/document/actions/workflows/ci.yml">
    <img src="https://github.com/ranuts/document/actions/workflows/ci.yml/badge.svg" alt="CI Status">
  </a>
  <a href="https://github.com/ranuts/document/blob/main/LICENSE">
    <img src="https://img.shields.io/github/license/ranuts/document" alt="License">
  </a>
  <a href="https://github.com/ranuts/document/releases">
    <img src="https://img.shields.io/github/v/release/ranuts/document" alt="Version">
  </a>
  <a href="https://edit.chaxus.com/">
    <img src="https://img.shields.io/badge/Live-edit.chaxus.com-brightgreen" alt="Live site">
  </a>
</p>
<p align="center">
  <a href="readme.md">English</a> |
  <a href="readme.zh.md">简体中文</a> |
  <b>日本語</b> |
  <a href="readme.ko.md">한국어</a> |
  <a href="readme.de.md">Deutsch</a> |
  <a href="readme.es.md">Español</a> |
  <a href="readme.pt.md">Português</a> |
  <a href="readme.fa.md">فارسی</a>
</p>

Word・Excel・PowerPoint のファイルを、ブラウザーのタブだけで開いて編集できます。サーバーはありません。OnlyOffice
エンジンとその WASM コンバーターは訪問者自身の端末で動くので、ドキュメントがアップロードされることはなく、
アカウントも不要です。

**公開サイト: [edit.chaxus.com](https://edit.chaxus.com/)**

---

## ✨ 特長

- 🔒 **何もアップロードしない** — 変換も編集も書き出しも、すべてタブの中で完結します
- 📝 **プレビューではなく本物の編集** — DOCX・XLSX・PPTX・CSV に加え、ODF・RTF・TXT と旧来のバイナリ形式にも対応。PDF は開いて注釈を付けられます
- 🕓 **タブを閉じても失われない** — 編集内容はお使いのブラウザーに自動保存され、7 日間保管、いつでも削除できます（[詳しく](#-データは端末から出ません)）
- 📴 **オフラインでも動く** — PWA としてインストール可能。初回訪問のあとはネットワーク不要です
- 🌍 **多言語** — サイトの表示言語は 8 種類、エディター自体は 45 種類
- 🧩 **組み込める** — iframe 連携のための postMessage API を完備
- 🤖 **エージェント対応** — WebMCP ツールを公開し、ブラウザー内の AI エージェントがドキュメントを開く・変換する・読むことができます
- 🚀 **どこにでも配置できる** — 静的ビルド。任意の Web サーバーに置くファイル群です

---

## 🚀 はじめかた

**そのまま使う:** [edit.chaxus.com](https://edit.chaxus.com/) — インストール不要です。

**Docker で自分で動かす:**

```bash
docker run -d --name document -p 8080:80 ghcr.io/ranuts/document:latest
```

**ソースから動かす:**

```bash
git clone https://github.com/ranuts/document.git
cd document
pnpm install
pnpm run dev
```

---

## 📄 対応形式

| 種類               | 編集                 | 開くだけなら                |
| ------------------ | -------------------- | --------------------------- |
| ドキュメント       | `.docx`              | `.doc` `.odt` `.rtf` `.txt` |
| スプレッドシート   | `.xlsx` `.csv`       | `.xls` `.ods`               |
| プレゼンテーション | `.pptx`              | `.ppt` `.odp`               |
| PDF                | 注釈・入力・書き出し | `.pdf`                      |

いずれも PDF に書き出せます。CSV は書き出し時も元の文字コードを保ちます（開くときに
UTF-8・GB18030・Latin-1 を判別します）。

---

## 🔗 ルートと URL パラメーター

| ルート                | 内容                                                             |
| --------------------- | ---------------------------------------------------------------- |
| `/`                   | ランディングページ。何かを開くまでエディターは読み込まれません。 |
| `/editor`             | エディター本体。                                                 |
| `/history`            | このブラウザーが保持しているドキュメント（下記参照）。           |
| `/help`, `/changelog` | `content/` 以下の Markdown から生成されます。                    |

`/editor` のパラメーター:

| パラメーター | 説明                                                                                                                                 |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `src=<url>`  | URL からドキュメントを開く（その URL が CORS を許可している必要があります）                                                          |
| `file=<url>` | 同じ意味の旧表記。両方あるとこちらが優先されます                                                                                     |
| `new=docx`   | 空のドキュメントを新規作成（`docx`・`xlsx`・`pptx`）                                                                                 |
| `doc=<id>`   | このブラウザーの履歴からドキュメントを再度開く。エディターが自身の ID をここに入れるため、再読み込みしても同じドキュメントに戻ります |
| `readonly=1` | 閲覧専用で開く。編集と書き出しは無効になります                                                                                       |
| `embed=1`    | 埋め込みモード。親ページが postMessage でエディターを操作します                                                                      |
| `locale=ja`  | 表示言語                                                                                                                             |

---

## 🔐 データは端末から出ません

ドキュメントがどこかに送られることはありません。端末に残るのは次の 2 つだけで、
どちらもご自身で削除できます。

- **編集したものの控え。** 作業中、エディターはドキュメントをこのブラウザー（IndexedDB）に
  保存します。再読み込みしても、タブを閉じても、クラッシュしても作業が失われないためです。
  次にエディターを開いたときに復元を提案します。これは作業を再開するためのものであり、
  バックアップではありません。残したいものは書き出してください。
- **7 日で消えます。** 各ドキュメントは、最後に編集または開いた日から 7 日後に、
  あなたが戻ってこなくても自動的に削除されます。

[`/history`](https://edit.chaxus.com/history) に保管中のものが一覧で表示されます。
各行の削除、まとめて削除、自動保存を完全に切るスイッチがあります。ここでの削除は
すぐに反映されます。共用のパソコンでは、まずこのページをご覧ください。

---

## 🧩 iframe への組み込み

エディターを埋め込み、postMessage で操作します。よくある分担は、認証と保存は自社システム、
編集は iframe、という形です。

```html
<iframe
  id="documentEditor"
  src="https://your-deployment/editor?embed=1"
  style="width: 100%; height: 720px; border: 0"
></iframe>
```

```js
// ドキュメントを開く
iframe.contentWindow.postMessage(
  { id: '1', type: 'document:open-url', payload: { url: 'https://example.com/doc.xlsx' } },
  'https://your-deployment',
);

// 結果を受け取る
window.addEventListener('message', (e) => {
  if (e.data?.type === 'document:opened') console.log('編集できます');
  if (e.data?.type === 'document:saved') uploadFile(e.data.payload.file);
});
```

埋め込みモードのエディターはローカルに履歴を残しません。ドキュメントは親ページのものだからです。

→ **[API 仕様の全文](docs/embed-api.md)** — すべてのメッセージ種別、オリジンの許可リスト、
読み取り専用モード、保存の流れ。

コンポーネントとしても提供しています。このプロジェクトは
[@ranui/preview](https://www.npmjs.com/package/@ranui/preview)
（[ドキュメント](https://chaxus.github.io/ran/src/ranui/preview/)）のドキュメントプレビューを支えています。

---

## 🤖 ブラウザー内 AI エージェント（WebMCP）

ブラウザーが対応していれば、画面を操作する代わりにエージェントが直接呼び出せるツールを
ページが登録します。`open_document_url`・`open_document_buffer`・`create_document`・
`save_document`・`get_document_text`・`set_readonly`・`get_document_state` です。
この場合もドキュメントは端末から出ません。取得も変換もブラウザー自身が行います。
API がない環境では何も起きません。

---

## 🚀 デプロイ

静的ビルドです。ランタイムもデータベースもありません。

```bash
pnpm build   # dist/ に出力されます
```

### 静的ホスティング（Cloudflare Pages・Nginx・Vercel・Netlify など）

`dist/` をアップロードしてください。`public/_headers` にサイトが前提とするキャッシュの
取り決めが書かれています（ハッシュ付きアセットは不変、Service Worker は決してキャッシュしない）。
これを読まないホストでも動作しますが、再検証の回数が増えます。

Nginx では、未知のルートのフォールバックとして `index.html` を返してください。

```nginx
location / {
  root /var/www/document;
  try_files $uri $uri/ /index.html;
}
```

### GitHub Pages

`.github/workflows/pages-build-site.yml` が `main` への push でビルドとデプロイを行います。
リポジトリの設定で Pages を有効にし、ソースに **GitHub Actions** を選んでください。

### Docker

```bash
# 基本
docker run -d --name document -p 8080:80 ghcr.io/ranuts/document:latest

# HTTPS と Basic 認証つき
docker run -d --name document -p 443:443 \
  -v /path/to/certs:/ssl \
  -e SERVER_BASIC_AUTH='user:$2y$...' \
  -e SERVER_HTTP2_TLS=true \
  -e SERVER_HTTP2_TLS_CERT=/ssl/cert.pem \
  -e SERVER_HTTP2_TLS_KEY=/ssl/key.pem \
  ghcr.io/ranuts/document:latest
```

`SERVER_BASIC_AUTH` には BCrypt ハッシュを渡します。シェルのエスケープのため `$` は
二重にしてください。イメージのキャッシュ設定は `sws.toml` にあります。

---

## 🔤 フォント

同梱の OnlyOffice ビルドは、フォントライブラリを `public/fonts/` に置き、
`public/sdkjs/common/AllFonts.js` で索引しています。フォントは必要になった時点で
取得されるため、ドキュメントが実際に使うものだけが読み込まれます。

→ **[フォント管理ガイド](docs/fonts.md)** — 索引付きカタログのワイヤ形式、各レジストリ、
`bin/font-catalog.mjs` を使ったフォントの追加方法。

---

## 🛠 開発

```bash
pnpm install --frozen-lockfile
pnpm run dev            # 開発サーバー
pnpm run build          # 本番ビルド（bin/build.sh）
pnpm run lint           # oxlint + tsc + docker の設定確認
pnpm run test           # ユニットテスト（Vitest）
pnpm run test:e2e       # エンドツーエンドテスト（Playwright、実際のエディターと実際の WASM）
```

エンドツーエンドのテストはモックではなく本物のエディターとコンバーターを動かします。
ドキュメントの往復、埋め込みプロトコル、復元の流れまで含みます。`docs/explorations/` には、
一見不可解な実装がなぜそうなっているのかが記録されています。エディター連携に手を入れる前に
目を通す価値があります。

---

## 📚 土台にしているもの

- [sdkjs](https://github.com/ONLYOFFICE/sdkjs) と [web-apps](https://github.com/ONLYOFFICE/web-apps) — OnlyOffice のエディター
- [onlyoffice-x2t-wasm](https://github.com/cryptpad/onlyoffice-x2t-wasm) — WASM 版のドキュメントコンバーター
- [ranui / ranuts](https://github.com/chaxus/ran) — このサイトを組み立てているデザインシステムとユーティリティ
- [se-office](https://github.com/Qihoo360/se-office)、[onlyoffice-web-local](https://github.com/sweetwisdom/onlyoffice-web-local) — ドキュメントサーバーなしで OnlyOffice を動かす先行事例

## 🤝 コントリビューション

Issue と Pull Request を歓迎します。`main` は保護されています。ブランチで作業して
PR を作成してください。lint、ユニットテスト、3 種類のエンドツーエンドテスト（開発サーバー、
Cloudflare Pages の挙動、本番 Docker イメージ）が実行されます。

## 📄 ライセンス

[AGPL-3.0](LICENSE)
