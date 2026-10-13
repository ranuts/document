# <img src="public/icons/document.svg" width="28" height="28" align="absmiddle" alt=""> オンライン ドキュメント エディター

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

**あなたと AI エージェントのための、ブラウザーの文書ワークスペース。**

ブラウザーで Word、Excel、PowerPoint を開き、編集して保存。PDF には注釈を追加できます。アカウントも Office のインストールも不要です。

**[オンラインで試す](https://edit.chaxus.com/)** · [ソースを見る](https://github.com/ranuts/document)

---

## ✨ 特長

- **ローカルで編集・変換。** 文書を端末内で処理。編集や変換のためのアップロードは不要です。
- **好きな方法で保存。** 対応ブラウザーでは選んだファイルに保存、それ以外はダウンロード。このブラウザーで最近の作業を再開できます。
- **AI と作業（Experimental Beta）。** 文章の下書きや推敲、表のデータ操作、スライド作成、現在の PDF ページへの質問に。変更を確認してから適用できます。
- **エージェントから文書ツールを呼び出し。** [WebMCP](docs/reference.md#webmcp-agent-tools) 対応ブラウザーでは、AI エージェントが文書を開き、変換・書き出しを行い、文字文書の本文を読めます。
- **PWA としてインストール。** アプリのように使え、キャッシュ済みの編集リソースはオフラインでも利用できます。
- **自分でホスト・組み込み。** 静的サイトとして配信するか、iframe API でアプリに組み込めます。

## 🚀 はじめかた

[文書を作成](https://edit.chaxus.com/editor?new=docx&locale=ja-JP) · [表計算を作成](https://edit.chaxus.com/editor?new=xlsx&locale=ja-JP) · [スライドを作成](https://edit.chaxus.com/editor?new=pptx&locale=ja-JP)

自分の環境で実行するには：

```bash
docker run -d --name document -p 8080:80 ghcr.io/ranuts/document:latest
```

## 📄 対応形式

| 種類               | 編集                 | 開くだけなら                |
| ------------------ | -------------------- | --------------------------- |
| ドキュメント       | `.docx`              | `.doc` `.odt` `.rtf` `.txt` |
| スプレッドシート   | `.xlsx` `.csv`       | `.xls` `.ods`               |
| プレゼンテーション | `.pptx`              | `.ppt` `.odp`               |
| PDF                | 注釈・入力・書き出し | `.pdf`                      |

対応文書は PDF に書き出せます。

多言語 UI、ライト・ダークテーマ、読み取り専用プレビューにも対応しています。

## 🔐 ローカル編集とデータの扱い

復元用コピーは最後の編集・閲覧から 7 日間、このブラウザーに保存されます。[保存済み文書](https://edit.chaxus.com/history)から削除できます。バックアップではないため、大切なファイルは書き出してください。

外部 AI サービスにはリクエストに必要な内容が送信されます。端末内モデルはローカルで処理します。音声入力はオンライン音声サービスを使う場合があり、埋め込み時の書き出しはホストアプリが扱います。

## ドキュメントと連携

[使い方](https://edit.chaxus.com/help) · [ホスティング・URL・連携](docs/reference.md) · [埋め込み API](docs/embed-api.md) · [フォント](docs/fonts.md)

オフライン利用にはキャッシュ済みの編集リソースが必要です。未取得のリソースやリモートファイルには通信が必要です。

## AI 文書アシスタント (Experimental Beta)

文章の下書きや推敲、表のデータ操作、スライド作成、現在の PDF ページへの質問に。変更を確認してから適用し、必要なら元に戻せます。

端末内モデルを選ぶか、自分の AI サービスに接続できます。対応ブラウザーでは音声入力も使えます。

**Experimental Beta.** 初期状態では無効です。回答や変更が間違うことがあるため、重要な結果は確認してください。

<details>
<summary>4 つのデモを見る</summary>

| Word                                                                                                                                              | Excel                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [![作成・挿入・要約・取り消し](docs/media/ai-demos/word-ai.jpg)](https://github.com/user-attachments/assets/8d1d6386-e33a-45f2-b968-b8695c8f7da9) | [![入力・計算・並べ替え・取り消し](docs/media/ai-demos/excel-ai.jpg)](https://github.com/user-attachments/assets/5bb253d7-3cc5-4f31-989e-0c88dcb1615c) |
| **作成・挿入・要約・取り消し**                                                                                                                    | **入力・計算・並べ替え・取り消し**                                                                                                                     |
| PowerPoint                                                                                                                                        | PDF                                                                                                                                                    |
| [![作成・複製・取り消し](docs/media/ai-demos/pptx-ai.jpg)](https://github.com/user-attachments/assets/db3fc7a7-b54e-4147-a7ca-e7f16243618e)       | [![読み取り・質問・メモの確認](docs/media/ai-demos/pdf-ai.jpg)](https://github.com/user-attachments/assets/f01c2da6-0669-4111-87c1-c4440f4a60e9)       |
| **作成・複製・取り消し**                                                                                                                          | **読み取り・質問・メモの確認**                                                                                                                         |

英語 UI、読み込み済みのローカル Qwen3 4B モデルで通常速度の全工程を収録。応答時間はモデルと端末によって異なります。

[動画・字幕・説明](docs/media/ai-demos/README.md)

PDF は選択可能な文字とページ注釈に対応。スキャン画像の文字認識や本文の書き換えには対応しません。

</details>

## 🛠 開発

ソースから実行：

```bash
git clone https://github.com/ranuts/document.git
cd document
pnpm install --frozen-lockfile
pnpm run dev
```

フィードバックや貢献を歓迎します： [Issues](https://github.com/ranuts/document/issues) · [Pull requests](https://github.com/ranuts/document/pulls)

## 📚 土台にしているもの

- [sdkjs](https://github.com/ONLYOFFICE/sdkjs) と [web-apps](https://github.com/ONLYOFFICE/web-apps) — OnlyOffice のエディター
- [onlyoffice-x2t-wasm](https://github.com/cryptpad/onlyoffice-x2t-wasm) — WASM 版のドキュメントコンバーター
- [ranui / ranuts](https://github.com/chaxus/ran) — このサイトを組み立てているデザインシステムとユーティリティ
- [se-office](https://github.com/Qihoo360/se-office)、[onlyoffice-web-local](https://github.com/sweetwisdom/onlyoffice-web-local) — ドキュメントサーバーなしで OnlyOffice を動かす先行事例

## 📄 ライセンス

[AGPL-3.0](LICENSE) · [NOTICE](NOTICE)

<details>
<summary>上流の告知と商標</summary>

本プロジェクトは ONLYOFFICE エディター（sdkjs と web-apps、著作権者 Ascensio
System SIA）の変更版です。画面には中立的な機能名を使用し、製品ロゴやブランドの
宣伝を表示しません。著作権、ライセンス、変更内容、ソースコードへのリンクは
「バージョン情報」と [NOTICE](NOTICE) に残しています。第三者の GUI 素材と
フォントには引き続きそれぞれのライセンスが適用されます。

ロゴを表示しない判断は、AGPLv3 第 7 条に関する FSF の公開解釈を参考にしています。
裁判所の判決や完全な適法性の保証ではありません。上流の立場と判断の根拠は NOTICE
を参照してください。

ONLYOFFICE は Ascensio System SIA の商標です。本プロジェクトは公式製品ではなく、
同社との提携、スポンサー関係、推奨関係はありません。法律上の表示とソースへの参照に
含まれる名称は上流の技術を示すもので、本プロジェクトのブランドではありません。

PWA とブラウザーのタブには、独自に描いた中立的な文書アイコンを使用します。上流のロゴ、商標、プロジェクトの頭文字は含みません。

</details>
