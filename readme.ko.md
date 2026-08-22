# 온라인 문서 편집기

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
  <a href="readme.ja.md">日本語</a> |
  <b>한국어</b> |
  <a href="readme.de.md">Deutsch</a> |
  <a href="readme.es.md">Español</a> |
  <a href="readme.pt.md">Português</a> |
  <a href="readme.fa.md">فارسی</a>
</p>

Word, Excel, PowerPoint 파일을 브라우저 탭에서 바로 열고 편집합니다. 서버는 없습니다.
OnlyOffice 엔진과 WASM 변환기가 방문자의 기기에서 직접 돌아가므로 문서가 업로드되는 일이
없고, 계정도 필요 없습니다.

**서비스 주소: [edit.chaxus.com](https://edit.chaxus.com/)**

---

## ✨ 특징

- 🔒 **아무것도 올라가지 않습니다** — 변환, 편집, 내보내기가 모두 탭 안에서 끝납니다
- 📝 **미리보기가 아니라 진짜 편집** — DOCX, XLSX, PPTX, CSV와 함께 ODF, RTF, TXT 및 옛 바이너리 형식까지. PDF는 열어서 주석을 달 수 있습니다
- 🕓 **탭을 닫아도 잃지 않습니다** — 편집 내용이 내 브라우저에 자동 저장되어 7일간 보관되고, 언제든 지울 수 있습니다 ([자세히](#-데이터는-기기-밖으로-나가지-않습니다))
- 📴 **오프라인에서도 동작** — PWA로 설치할 수 있고, 첫 방문 이후에는 네트워크가 필요 없습니다
- 🌍 **다국어** — 사이트 인터페이스 8개 언어, 편집기 자체는 45개 언어
- 🧩 **임베드 가능** — iframe 연동을 위한 완전한 postMessage API
- 🤖 **에이전트 지원** — WebMCP 도구를 공개해 브라우저 안의 AI 에이전트가 문서를 열고, 변환하고, 읽을 수 있습니다
- 🚀 **어디에나 배포** — 정적 빌드. 아무 웹 서버 뒤에 두면 되는 파일 묶음입니다

---

## 🚀 빠른 시작

**그냥 쓰기:** [edit.chaxus.com](https://edit.chaxus.com/) — 설치할 것이 없습니다.

**Docker로 직접 운영하기:**

```bash
docker run -d --name document -p 8080:80 ghcr.io/ranuts/document:latest
```

**소스에서 실행하기:**

```bash
git clone https://github.com/ranuts/document.git
cd document
pnpm install
pnpm run dev
```

---

## 📄 지원 형식

| 종류         | 편집                      | 열기만 가능                 |
| ------------ | ------------------------- | --------------------------- |
| 문서         | `.docx`                   | `.doc` `.odt` `.rtf` `.txt` |
| 스프레드시트 | `.xlsx` `.csv`            | `.xls` `.ods`               |
| 프레젠테이션 | `.pptx`                   | `.ppt` `.odp`               |
| PDF          | 주석, 양식 작성, 내보내기 | `.pdf`                      |

모두 PDF로 내보낼 수 있습니다. CSV는 내보낼 때도 원래 인코딩을 유지합니다(열 때 UTF-8,
GB18030, Latin-1을 판별합니다).

---

## 🔗 경로와 URL 매개변수

| 경로                  | 설명                                                      |
| --------------------- | --------------------------------------------------------- |
| `/`                   | 첫 화면. 무언가를 열기 전에는 편집기를 내려받지 않습니다. |
| `/editor`             | 편집기.                                                   |
| `/history`            | 이 브라우저가 보관 중인 문서(아래 참조).                  |
| `/help`, `/changelog` | `content/` 아래의 마크다운에서 생성됩니다.                |

`/editor`의 매개변수:

| 매개변수     | 설명                                                                                                           |
| ------------ | -------------------------------------------------------------------------------------------------------------- |
| `src=<url>`  | URL에서 문서 열기(해당 URL이 CORS를 허용해야 합니다)                                                           |
| `file=<url>` | 같은 뜻의 옛 표기. 둘 다 있으면 이쪽이 우선합니다                                                              |
| `new=docx`   | 빈 문서 새로 만들기(`docx`, `xlsx`, `pptx`)                                                                    |
| `doc=<id>`   | 이 브라우저의 기록에서 문서를 다시 열기. 편집기가 자기 ID를 여기에 넣으므로 새로 고쳐도 같은 문서로 돌아옵니다 |
| `readonly=1` | 보기 전용으로 열기. 편집과 내보내기가 꺼집니다                                                                 |
| `embed=1`    | 임베드 모드. 호스트 페이지가 postMessage로 편집기를 조종합니다                                                 |
| `locale=ko`  | 인터페이스 언어                                                                                                |

---

## 🔐 데이터는 기기 밖으로 나가지 않습니다

문서는 어디로도 전송되지 않습니다. 기기에 남는 것은 두 가지뿐이고, 둘 다 직접 지울 수 있습니다.

- **편집한 것의 사본.** 작업하는 동안 편집기는 문서를 이 브라우저(IndexedDB)에 저장합니다.
  새로 고침, 탭 닫기, 브라우저 멈춤이 작업을 앗아가지 않게 하기 위해서입니다. 편집기를 다시
  열면 그 사본을 되돌려 줍니다. 이 사본은 하던 일을 이어가기 위한 것이지 백업이 아닙니다.
  보관하고 싶은 것은 계속 내보내 두세요.
- **7일 뒤에는 사라집니다.** 각 문서는 마지막으로 편집하거나 연 날로부터 7일 뒤, 다시 오지
  않더라도 자동으로 삭제됩니다.

[`/history`](https://edit.chaxus.com/history)에 보관 중인 목록이 있습니다. 줄마다 삭제
버튼이 있고, 전체 삭제와 자동 저장을 아예 끄는 스위치도 있습니다. 여기서 지우면 즉시
반영됩니다. 공용 컴퓨터라면 먼저 들러야 할 페이지입니다.

---

## 🧩 iframe으로 임베드하기

편집기를 임베드하고 postMessage로 조종합니다. 흔한 분담은 인증과 저장은 내 시스템이,
편집은 iframe이 맡는 형태입니다.

```html
<iframe
  id="documentEditor"
  src="https://your-deployment/editor?embed=1"
  style="width: 100%; height: 720px; border: 0"
></iframe>
```

```js
// 문서 열기
iframe.contentWindow.postMessage(
  { id: '1', type: 'document:open-url', payload: { url: 'https://example.com/doc.xlsx' } },
  'https://your-deployment',
);

// 결과 받기
window.addEventListener('message', (e) => {
  if (e.data?.type === 'document:opened') console.log('편집할 수 있습니다');
  if (e.data?.type === 'document:saved') uploadFile(e.data.payload.file);
});
```

임베드된 편집기는 로컬 기록을 남기지 않습니다. 문서는 호스트 페이지의 것이기 때문입니다.

→ **[전체 API 문서](docs/embed-api.md)** — 모든 메시지 종류, 오리진 허용 목록,
읽기 전용 모드, 저장 흐름.

컴포넌트로도 제공합니다. 이 프로젝트가
[@ranui/preview](https://www.npmjs.com/package/@ranui/preview)
([문서](https://chaxus.github.io/ran/src/ranui/preview/))의 문서 미리보기를 구동합니다.

---

## 🤖 브라우저 AI 에이전트(WebMCP)

브라우저가 지원하는 경우, 페이지는 에이전트가 화면을 조작하는 대신 직접 호출할 수 있는
도구를 등록합니다. `open_document_url`, `open_document_buffer`, `create_document`,
`save_document`, `get_document_text`, `set_readonly`, `get_document_state`입니다.
이때도 문서는 기기를 떠나지 않습니다. 내려받기와 변환을 브라우저가 직접 하기 때문입니다.
해당 API가 없는 환경에서는 아무 일도 일어나지 않습니다.

---

## 🚀 배포

정적 빌드입니다. 런타임도 데이터베이스도 없습니다.

```bash
pnpm build   # dist/ 에 출력됩니다
```

### 정적 호스팅(Cloudflare Pages, Nginx, Vercel, Netlify 등)

`dist/`를 올리면 됩니다. `public/_headers`에 이 사이트가 전제하는 캐시 규약이 들어 있습니다
(해시가 붙은 자산은 불변, 서비스 워커는 절대 캐시하지 않음). 이를 읽지 않는 호스트에서도
동작하지만 재검증이 잦아집니다.

Nginx에서는 알 수 없는 경로의 대체로 `index.html`을 내주세요.

```nginx
location / {
  root /var/www/document;
  try_files $uri $uri/ /index.html;
}
```

### GitHub Pages

`.github/workflows/pages-build-site.yml`이 `main`에 push할 때 빌드와 배포를 수행합니다.
저장소 설정에서 Pages를 켜고 소스를 **GitHub Actions**로 지정하세요.

### Docker

```bash
# 기본
docker run -d --name document -p 8080:80 ghcr.io/ranuts/document:latest

# HTTPS와 기본 인증 포함
docker run -d --name document -p 443:443 \
  -v /path/to/certs:/ssl \
  -e SERVER_BASIC_AUTH='user:$2y$...' \
  -e SERVER_HTTP2_TLS=true \
  -e SERVER_HTTP2_TLS_CERT=/ssl/cert.pem \
  -e SERVER_HTTP2_TLS_KEY=/ssl/key.pem \
  ghcr.io/ranuts/document:latest
```

`SERVER_BASIC_AUTH`에는 BCrypt 해시를 넣습니다. 셸 이스케이프를 위해 `$`는 두 번 씁니다.
이미지의 캐시 설정은 `sws.toml`에 있습니다.

---

## 🔤 글꼴

함께 넣은 OnlyOffice 빌드는 글꼴 라이브러리를 `public/fonts/`에 두고
`public/sdkjs/common/AllFonts.js`로 색인합니다. 글꼴은 필요할 때 받아오므로, 문서가 실제로
쓰는 것만 내려받습니다.

→ **[글꼴 관리 안내](docs/fonts.md)** — 색인 카탈로그의 형식, 각 레지스트리,
`bin/font-catalog.mjs`로 글꼴 추가하기.

---

## 🛠 개발

```bash
pnpm install --frozen-lockfile
pnpm run dev            # 개발 서버
pnpm run build          # 프로덕션 빌드(bin/build.sh)
pnpm run lint           # oxlint + tsc + docker 설정 검사
pnpm run test           # 단위 테스트(Vitest)
pnpm run test:e2e       # 종단 간 테스트(Playwright, 실제 편집기 + 실제 WASM)
```

종단 간 테스트는 모의 객체가 아니라 진짜 편집기와 진짜 변환기를 돌립니다. 문서 왕복,
임베드 프로토콜, 복구 흐름까지 포함합니다. `docs/explorations/`에는 언뜻 이해하기 어려운
구현이 왜 그렇게 되어 있는지가 기록되어 있습니다. 편집기 연동을 건드리기 전에 읽어 볼
가치가 있습니다.

---

## 📚 기반

- [sdkjs](https://github.com/ONLYOFFICE/sdkjs)와 [web-apps](https://github.com/ONLYOFFICE/web-apps) — OnlyOffice 편집기
- [onlyoffice-x2t-wasm](https://github.com/cryptpad/onlyoffice-x2t-wasm) — WASM 문서 변환기
- [ranui / ranuts](https://github.com/chaxus/ran) — 이 사이트를 이루는 디자인 시스템과 유틸리티
- [se-office](https://github.com/Qihoo360/se-office), [onlyoffice-web-local](https://github.com/sweetwisdom/onlyoffice-web-local) — 문서 서버 없이 OnlyOffice를 돌린 선행 사례

## 🤝 기여

이슈와 풀 리퀘스트를 환영합니다. `main`은 보호되어 있으니 브랜치에서 작업하고 PR을
열어 주세요. lint, 단위 테스트, 세 가지 종단 간 테스트(개발 서버, Cloudflare Pages 동작,
프로덕션 Docker 이미지)가 실행됩니다.

## 📄 라이선스

[AGPL-3.0](LICENSE)
