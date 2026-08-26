/**
 * What gets generated: the landing slugs, and every page with its markdown
 * source per locale.
 */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT } from './constants.mjs';
import { LOCALES } from './locales.mjs';

export const LANDING_SLUGS = [
  'offline-document-editor',
  // en + zh only, on purpose: this one targets people searching for ONLYOFFICE
  // itself, and the shell derives hreflang and the language switch from the
  // sources a page actually has (see `translations` in renderPage), so a page
  // in two languages stays correct in two languages.
  'onlyoffice-online-free',
  'no-signup-document-editor',
  'private-document-editor',
  'edit-documents-without-account',
  'embed-document-editor',
  'webmcp-document-editor',
  'open/docx',
  'open/xlsx',
  'open/pptx',
  'open/pdf',
  'open/odt',
  'open/ods',
  'open/odp',
  'convert/docx-to-pdf',
  'convert/xlsx-to-pdf',
  'convert/pptx-to-pdf',
  'convert/xlsx-to-csv',
  'convert/csv-to-xlsx',
];

export const PAGES = [
  // Entity pages. Not keyword landing pages -- these exist so a reader (and a
  // rater) can answer "who is responsible for this site and how do I reach
  // them", which the Quality Rater Guidelines expect most sites to answer
  // (§2.5.3, and §4.5.1 rates a site with no such information Lowest).
  //
  // en + zh-CN on purpose, like `onlyoffice-online-free`: the shell derives
  // hreflang and the language switch from the sources a page actually has, so a
  // page in two languages stays correct in two languages. A trust page is the
  // worst place for an unreviewed translation -- awkward phrasing undermines
  // exactly the thing the page is for. Add a locale when someone can review it.
  {
    slug: 'about',
    sources: {
      en: 'content/en/about.md',
      'zh-CN': 'content/zh-CN/about.md',
    },
  },
  {
    slug: 'contact',
    sources: {
      en: 'content/en/contact.md',
      'zh-CN': 'content/zh-CN/contact.md',
    },
  },
  {
    slug: 'help',
    sources: {
      en: 'content/en/help.md',
      'zh-CN': 'content/zh-CN/help.md',
      ja: 'content/ja/help.md',
      de: 'content/de/help.md',
      es: 'content/es/help.md',
      ko: 'content/ko/help.md',
      pt: 'content/pt/help.md',
    },
  },
  {
    slug: 'help/embed-api',
    sources: {
      en: 'docs/embed-api.md',
      'zh-CN': 'docs/embed-api.zh.md',
      ja: 'docs/embed-api.md',
      de: 'docs/embed-api.md',
      es: 'docs/embed-api.md',
      ko: 'docs/embed-api.md',
      pt: 'docs/embed-api.md',
    },
    meta: {
      en: {
        title: 'Embed API — iframe + postMessage reference',
        description:
          'Reference for embedding the document editor in your own web app: iframe setup, postMessage commands (open URL/File/buffer, read-only, save), responses and origin restriction.',
        eyebrow: 'Help · Embed API',
        breadcrumb: 'Embed API',
        parent: { href: '/help', name: 'Help' },
      },
      ko: {
        title: 'Embed API — iframe + postMessage 참고',
        description:
          '내 웹 앱에 문서 편집기를 임베드하기 위한 참고 문서: iframe 설정, postMessage 명령(URL/File/buffer로 열기, 읽기 전용, 저장), 응답, 오리진 제한.',
        eyebrow: '도움말 · Embed API',
        breadcrumb: 'Embed API',
        parent: { href: '/ko/help', name: '도움말' },
        notice: 'Embed API 참고 문서는 영어로 관리됩니다(단일 출처). 한국어판은 추후 추가됩니다.',
      },
      pt: {
        title: 'Embed API — referência de iframe + postMessage',
        description:
          'Referência para incorporar o editor de documentos no seu app web: configuração do iframe, comandos postMessage (abrir de URL/File/buffer, somente leitura, salvar), respostas e restrição de origem.',
        eyebrow: 'Ajuda · Embed API',
        breadcrumb: 'Embed API',
        parent: { href: '/pt/help', name: 'Ajuda' },
        notice: 'A referência da Embed API é mantida em inglês (fonte única). A versão em português virá depois.',
      },
      de: {
        title: 'Embed API — Referenz zu iframe + postMessage',
        description:
          'Referenz zum Einbetten des Dokumenteneditors in Ihre eigene Web-App: iframe-Einrichtung, postMessage-Befehle (aus URL/File/Buffer öffnen, schreibgeschützt, speichern), Antworten und Origin-Beschränkung.',
        eyebrow: 'Hilfe · Embed API',
        breadcrumb: 'Embed API',
        parent: { href: '/de/help', name: 'Hilfe' },
        notice: 'Die Embed-API-Referenz wird auf Englisch gepflegt (eine einzige Quelle). Eine deutsche Fassung folgt.',
      },
      es: {
        title: 'Embed API — referencia de iframe + postMessage',
        description:
          'Referencia para integrar el editor de documentos en tu propia aplicación web: configuración del iframe, comandos postMessage (abrir desde URL/File/buffer, solo lectura, guardar), respuestas y restricción de origen.',
        eyebrow: 'Ayuda · Embed API',
        breadcrumb: 'Embed API',
        parent: { href: '/es/help', name: 'Ayuda' },
        notice:
          'La referencia de la Embed API se mantiene en inglés (una única fuente). La versión en español llegará más adelante.',
      },
      ja: {
        title: 'Embed API — iframe + postMessage リファレンス',
        description:
          '自分の Web アプリにドキュメントエディタを埋め込むためのリファレンス: iframe の設定、postMessage コマンド（URL / File / buffer から開く、読み取り専用、保存）、応答、オリジン制限。',
        eyebrow: 'ヘルプ · Embed API',
        breadcrumb: 'Embed API',
        parent: { href: '/ja/help', name: 'ヘルプ' },
        notice: 'Embed API リファレンスは英語で管理されています（単一の情報源）。日本語版は今後追加します。',
      },
      'zh-CN': {
        title: 'Embed API——iframe + postMessage 参考',
        description:
          '在你自己的 Web 应用中嵌入文档编辑器的参考：iframe 接入、postMessage 命令（按 URL/File/buffer 打开、只读、保存）、响应格式与来源限制。',
        eyebrow: '帮助 · Embed API',
        breadcrumb: 'Embed API',
        parent: { href: '/zh-CN/help', name: '帮助' },
      },
    },

    stripFirstHeading: true,
  },
  {
    slug: 'changelog',
    sources: {
      en: 'CHANGELOG.md',
      'zh-CN': 'CHANGELOG.md',
      ja: 'CHANGELOG.md',
      de: 'CHANGELOG.md',
      es: 'CHANGELOG.md',
      ko: 'CHANGELOG.md',
      pt: 'CHANGELOG.md',
    },
    meta: {
      en: {
        title: 'Changelog — what changed in the online document editor',
        description:
          'User-facing release notes for edit.chaxus.com: new formats, editor fixes, performance and privacy changes, in reverse chronological order.',
        eyebrow: 'Changelog',
        breadcrumb: 'Changelog',
      },
      ko: {
        title: '변경 내역 — 온라인 문서 편집기가 무엇이 달라졌나',
        description:
          'edit.chaxus.com의 사용자 대상 릴리스 노트: 새 형식, 편집기 수정, 성능과 프라이버시 변경 사항을 최신순으로 정리했습니다.',
        eyebrow: '변경 내역',
        breadcrumb: '변경 내역',
        notice: '변경 내역은 영어로 관리됩니다(단일 출처 CHANGELOG.md). 한국어판은 추후 추가됩니다.',
      },
      pt: {
        title: 'Novidades — o que mudou no editor de documentos online',
        description:
          'Notas de versão do edit.chaxus.com: novos formatos, correções do editor, mudanças de desempenho e privacidade, em ordem cronológica inversa.',
        eyebrow: 'Novidades',
        breadcrumb: 'Novidades',
        notice: 'As novidades são mantidas em inglês (fonte única, CHANGELOG.md). A versão em português virá depois.',
      },
      de: {
        title: 'Änderungen — was sich im Online-Dokumenteneditor geändert hat',
        description:
          'Versionshinweise für edit.chaxus.com: neue Formate, Korrekturen im Editor, Änderungen an Leistung und Datenschutz, in umgekehrt chronologischer Reihenfolge.',
        eyebrow: 'Änderungen',
        breadcrumb: 'Änderungen',
        notice:
          'Die Änderungen werden auf Englisch gepflegt (eine einzige Quelle, CHANGELOG.md). Eine deutsche Fassung folgt.',
      },
      es: {
        title: 'Novedades — qué ha cambiado en el editor de documentos en línea',
        description:
          'Notas de versión de edit.chaxus.com: formatos nuevos, correcciones del editor, cambios de rendimiento y privacidad, en orden cronológico inverso.',
        eyebrow: 'Novedades',
        breadcrumb: 'Novedades',
        notice:
          'Las novedades se mantienen en inglés (una única fuente, CHANGELOG.md). La versión en español llegará más adelante.',
      },
      ja: {
        title: '変更履歴 — オンラインドキュメントエディタの更新内容',
        description:
          'edit.chaxus.com のユーザー向けリリースノート: 新しい形式、エディタの修正、パフォーマンスとプライバシーの変更を、新しい順に掲載しています。',
        eyebrow: '変更履歴',
        breadcrumb: '変更履歴',
        notice: '変更履歴は英語で管理されています（単一の情報源 CHANGELOG.md）。日本語版は今後追加します。',
      },
      'zh-CN': {
        title: '更新日志——在线文档编辑器改了什么',
        description: 'edit.chaxus.com 面向用户的版本记录：新增格式、编辑器修复、性能与隐私改动，按时间倒序。',
        eyebrow: '更新日志',
        breadcrumb: '更新日志',
        notice: '更新日志以英文维护（单一数据源 CHANGELOG.md），中文版稍后补充。',
      },
    },
    stripFirstHeading: true,
  },
  // The SEO landing pages. They were 36 hand-written HTML files (18 slugs x 2
  // locales) with the same shell copy-pasted into each: canonical, hreflang,
  // JSON-LD, top bar, rail, footer. That is maintainable at two languages and
  // not at eight -- every fix had to be applied 2n times, and adding a locale
  // meant writing 18 more files by hand. The copy now lives in content/<locale>/,
  // and everything around it comes from this shell like /help does.
  ...LANDING_SLUGS.map((slug) => ({
    slug,
    kind: 'landing',
    sources: Object.fromEntries(
      Object.keys(LOCALES)
        .filter((locale) => existsSync(resolve(ROOT, `content/${locale}/${slug}.md`)))
        .map((locale) => [locale, `content/${locale}/${slug}.md`]),
    ),
  })),
];

// ---------------------------------------------------------------------------
