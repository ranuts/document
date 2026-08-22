---
title: 내 사이트에 문서 편집기 임베드하기 — iframe + postMessage API
description: iframe 하나와 postMessage API로 DOCX·XLSX·PPTX·CSV 편집기를 내 웹 앱에 넣으세요. 인증과 파일은 내 앱에 남고, 편집기는 토큰을 보지 않습니다. 오픈 소스(AGPL-3.0), 자체 호스팅 가능, 화이트라벨.
eyebrow: 개발자 · 임베드
h1: 내 웹 앱에 문서 편집기 임베드하기
lead: 'iframe 하나와 **postMessage** API만으로 **DOCX·XLSX·PPTX·CSV** 편집기를 제품에 추가하세요. 인증, 파일 접근, 업로드는 내 앱이 계속 담당하고 편집기는 편집만 합니다 — 사용자의 토큰을 보지 않습니다.'
cta: 라이브 데모 열기 →
ctaHref: /embed-demo.html
ogDescription: iframe 하나로 DOCX/XLSX/PPTX/CSV 편집기를 앱에 넣으세요. 인증은 앱에 남고 편집기는 토큰을 보지 않습니다. 오픈 소스이며 자체 호스팅 가능.
breadcrumb: Embed Document Editor
howTo: 내 사이트에 문서 편집기를 임베드하는 방법
appDescription: iframe과 postMessage API로 내 웹 앱에 임베드할 수 있는, 브라우저에서 동작하는 문서 편집기.
---

편집기는 OnlyOffice의 WebAssembly 엔진으로 브라우저 안에서만 동작하므로 문서는 클라이언트에서 렌더링되고 편집됩니다 — 문서 서버를 세울 필요가 없습니다. 권장 구성은 경계를 깔끔하게 유지합니다: **부모 앱이 인증·가져오기·저장을 담당하고, iframe은 편집만 담당합니다.** 토큰, 쿠키, 업무 API는 내 앱 안에 남습니다.

## iframe 하나로 추가하기

```html
<iframe
  id="documentEditor"
  src="https://edit.chaxus.com/editor?embed=1&embedOrigin=https://your-app.example.com"
  style="width: 100%; height: 720px; border: 0"
></iframe>
```

그다음에는 `postMessage`로 통신합니다. 각 명령은 응답과 짝지을 `id`를 가지며, 편집기의 모든 이벤트는 `document:*` 메시지입니다:

```js
// 내 앱이 이미 가져온 파일 열기(인증은 내 앱에 남습니다)
iframe.contentWindow.postMessage(
  { id, type: 'document:open-buffer', payload: { fileName: 'report.xlsx', buffer } },
  'https://edit.chaxus.com',
);

// 편집된 파일을 돌려받고 직접 업로드
iframe.contentWindow.postMessage({ id, type: 'document:save', payload: { targetExt: 'XLSX' } }, editorOrigin);
// → 편집기가 다음으로 응답합니다 { type: 'document:saved', payload: { fileName, file } }
```

## 무엇을 얻나요

- iframe 하나와 작은 **postMessage** 명령/응답 API — 설치할 SDK가 없습니다
- 내 앱이 자체 자격 증명으로 가져온 **URL·File·ArrayBuffer**에서 열기
- **XLSX·DOCX·PPTX·CSV**로 저장하고 `File`로 돌려받아 내 앱이 업로드
- 읽기 전용 모드, 메시지 단위 오리진 제한(`embedOrigin`), 상태 조회
- 운영할 문서 서버 없음 — 편집은 100% 클라이언트의 WebAssembly
- 오픈 소스(AGPL-3.0)이며 자체 호스팅 가능 — 내 도메인 아래에 임베드

## 동작 방식

1. 레이아웃에 맞춘 크기로 `/editor?embed=1`을 가리키는 iframe을 추가합니다.
2. `document:ready` 이벤트를 기다린 뒤 `document:open-url`, `open-file`, `open-buffer`를 보냅니다.
3. 사용자가 그 자리에서 편집합니다. 내 앱이 어딘가로 보내지 않는 한 파일은 브라우저를 벗어나지 않습니다.
4. `document:save`를 보내면 편집기가 `document:saved`로 편집된 파일을 돌려주고, 내 앱이 자체 인증으로 업로드합니다.

## 읽기 전용과 미리보기 모드

뷰어, 검토 단계, 잠긴 레코드처럼 읽기 전용으로 열려면 open 명령에 `readonly: true`를 전달하고, 언제든 `document:set-readonly`로 전환하세요 — 다시 불러오지 않으며 사용자가 보던 위치도 유지됩니다. 읽기 전용 동안에는 편집이 비활성화되고 `document:save`는 `document:error`로 응답합니다. `document:get-state`는 현재 `readonly` 값을 알려 줍니다.

```js
// 잠긴 상태로 열고 나중에 해제
send('document:open-url', { url, readonly: true });
send('document:set-readonly', { readonly: false });
```

## 자주 묻는 질문

### 문서 편집기를 어떻게 임베드하나요?

`/editor?embed=1`을 가리키는 iframe을 하나 추가하고 postMessage API로 열기와 저장을 제어하세요. 동작하는 데모는 [/embed-demo.html](/embed-demo.html)에 있습니다.

### 편집기가 사용자의 인증 토큰을 보나요?

아니요. 인증, 파일 가져오기, 업로드는 내 앱에 남습니다 — 내 앱이 자체 자격 증명으로 파일을 가져와 바이트를 편집기에 넘기므로 토큰과 쿠키는 iframe에 들어가지 않습니다.

### 임베드된 편집기는 어떤 형식을 다루나요?

DOCX, XLSX, PPTX, CSV입니다. OnlyOffice의 WebAssembly 엔진으로 클라이언트에서 편집합니다. save 명령은 XLSX, DOCX, PPTX, CSV로 내보냅니다.

### 자체 호스팅이나 화이트라벨이 가능한가요?

네. AGPL-3.0 오픈 소스이며 정적 파일로 배포되므로 자신의 사본을 호스팅해 자기 도메인 아래에 임베드할 수 있습니다.

### 어떤 사이트가 편집기와 통신할 수 있는지 제한하려면?

iframe URL에 `embedOrigin`을 추가해 메시지를 특정 오리진으로 제한하고, 내 메시지 핸들러에서도 `event.origin`을 검증하세요.

### 문서를 읽기 전용으로 보여 주거나 도중에 잠글 수 있나요?

네. 열 때 `readonly: true`를 전달하거나 언제든 `document:set-readonly`를 보내세요 — 다시 불러오지 않고 즉시 전환되며, 잠긴 동안에는 저장이 거부됩니다.
