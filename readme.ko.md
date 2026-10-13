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

**사용자와 AI 에이전트를 위한 브라우저 문서 작업 공간.**

브라우저에서 Word, Excel, PowerPoint를 열고 편집하고 저장하세요. PDF에는 주석을 추가할 수 있습니다. 계정이나 Office 설치가 필요 없습니다.

**온라인으로 사용: [edit.chaxus.com](https://edit.chaxus.com/)**

---

## ✨ 특징

- **로컬 편집과 변환.** 문서를 기기에서 처리하므로 편집과 변환을 위해 업로드할 필요가 없습니다.
- **원하는 방식으로 저장.** 지원되는 브라우저에서는 선택한 파일에 저장하고, 그 외에는 다운로드합니다. 이 브라우저에서 최근 작업을 다시 열 수 있습니다.
- **AI와 함께 작업 (Experimental Beta).** 글 초안과 수정, 표 데이터 처리, 슬라이드 생성, 현재 PDF 페이지에 대한 질문을 지원합니다. 변경 내용을 확인한 뒤 적용하세요.
- **에이전트가 문서 도구 호출.** [WebMCP](docs/reference.md#webmcp-agent-tools) 지원 브라우저에서는 AI 에이전트가 파일을 열고 변환하고 내보내며, 텍스트 문서의 본문을 읽을 수 있습니다.
- **PWA로 설치.** 앱처럼 사용하고 캐시된 편집기 리소스를 오프라인에서 이용할 수 있습니다.
- **자체 호스팅과 통합.** 정적 사이트로 배포하거나 iframe API로 앱에 임베드하세요.

## 🚀 빠른 시작

[새 문서](https://edit.chaxus.com/editor?new=docx&locale=ko-KR) · [새 스프레드시트](https://edit.chaxus.com/editor?new=xlsx&locale=ko-KR) · [새 프레젠테이션](https://edit.chaxus.com/editor?new=pptx&locale=ko-KR)

직접 실행할 수도 있습니다:

```bash
docker run -d --name document -p 8080:80 ghcr.io/ranuts/document:latest
```

## 📄 지원 형식

| 종류         | 편집                      | 열기만 가능                 |
| ------------ | ------------------------- | --------------------------- |
| 문서         | `.docx`                   | `.doc` `.odt` `.rtf` `.txt` |
| 스프레드시트 | `.xlsx` `.csv`            | `.xls` `.ods`               |
| 프레젠테이션 | `.pptx`                   | `.ppt` `.odp`               |
| PDF          | 주석, 양식 작성, 내보내기 | `.pdf`                      |

지원 문서를 PDF로 내보낼 수 있습니다.

다국어 UI, 밝은 테마와 어두운 테마, 읽기 전용 미리보기도 지원합니다.

## 🔐 로컬 편집과 데이터 처리

복구 사본은 마지막 편집 또는 열기 후 7일 동안 이 브라우저에 보관됩니다. [저장된 문서](https://edit.chaxus.com/history)에서 삭제할 수 있습니다. 백업이 아니므로 중요한 파일은 내보내세요.

외부 AI 서비스에는 요청에 필요한 내용이 전송됩니다. 기기 내 모델은 로컬에서 처리합니다. 음성 입력은 온라인 서비스를 사용할 수 있고, 임베드 내보내기는 호스트 앱이 처리합니다.

## 문서 및 통합

[사용 안내](https://edit.chaxus.com/help) · [호스팅, URL 및 통합](docs/reference.md) · [임베드 API](docs/embed-api.md) · [글꼴](docs/fonts.md)

오프라인 사용에는 캐시된 편집기 리소스가 필요합니다. 캐시되지 않은 리소스와 원격 파일에는 네트워크가 필요합니다.

## AI 문서 도우미 (Experimental Beta)

글 초안과 수정, 표 데이터 처리, 슬라이드 생성, 현재 PDF 페이지에 대한 질문을 지원합니다. 변경 내용을 확인한 뒤 적용하고 필요하면 실행 취소하세요.

기기 내 모델을 선택하거나 자체 AI 서비스에 연결하세요. 지원되는 브라우저에서는 음성 입력도 사용할 수 있습니다.

**Experimental Beta.** 기본적으로 꺼져 있습니다. 답변과 수정이 틀릴 수 있으므로 중요한 결과는 확인하세요.

<details>
<summary>네 가지 데모 보기</summary>

| Word                                                                                                                                                 | Excel                                                                                                                                            |
| ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| [![초안 작성·삽입·요약·실행 취소](docs/media/ai-demos/word-ai.jpg)](https://github.com/user-attachments/assets/8d1d6386-e33a-45f2-b968-b8695c8f7da9) | [![입력·계산·정렬·실행 취소](docs/media/ai-demos/excel-ai.jpg)](https://github.com/user-attachments/assets/5bb253d7-3cc5-4f31-989e-0c88dcb1615c) |
| **초안 작성·삽입·요약·실행 취소**                                                                                                                    | **입력·계산·정렬·실행 취소**                                                                                                                     |
| PowerPoint                                                                                                                                           | PDF                                                                                                                                              |
| [![만들기·복제·실행 취소](docs/media/ai-demos/pptx-ai.jpg)](https://github.com/user-attachments/assets/db3fc7a7-b54e-4147-a7ca-e7f16243618e)         | [![읽기·질문·메모 검토](docs/media/ai-demos/pdf-ai.jpg)](https://github.com/user-attachments/assets/f01c2da6-0669-4111-87c1-c4440f4a60e9)        |
| **만들기·복제·실행 취소**                                                                                                                            | **읽기·질문·메모 검토**                                                                                                                          |

영어 UI와 미리 로드한 로컬 Qwen3 4B 모델로 전체 작업을 정상 속도로 녹화했습니다. 응답 시간은 모델과 기기에 따라 달라집니다.

[영상, 자막 및 설명](docs/media/ai-demos/README.md)

PDF는 선택 가능한 텍스트와 페이지 메모를 지원하며, 스캔 이미지 문자 인식이나 본문 수정은 지원하지 않습니다.

</details>

## 🛠 개발

소스에서 실행:

```bash
git clone https://github.com/ranuts/document.git
cd document
pnpm install --frozen-lockfile
pnpm run dev
```

피드백과 기여를 환영합니다: [Issues](https://github.com/ranuts/document/issues) · [Pull requests](https://github.com/ranuts/document/pulls)

## 📚 기반

- [sdkjs](https://github.com/ONLYOFFICE/sdkjs)와 [web-apps](https://github.com/ONLYOFFICE/web-apps) — OnlyOffice 편집기
- [onlyoffice-x2t-wasm](https://github.com/cryptpad/onlyoffice-x2t-wasm) — WASM 문서 변환기
- [ranui / ranuts](https://github.com/chaxus/ran) — 이 사이트를 이루는 디자인 시스템과 유틸리티
- [se-office](https://github.com/Qihoo360/se-office), [onlyoffice-web-local](https://github.com/sweetwisdom/onlyoffice-web-local) — 문서 서버 없이 OnlyOffice를 돌린 선행 사례

## 📄 라이선스

[AGPL-3.0](LICENSE) · [NOTICE](NOTICE)

<details>
<summary>상위 프로젝트 고지 및 상표</summary>

이 프로젝트는 ONLYOFFICE 편집기(sdkjs 및 web-apps, 저작권자 Ascensio System SIA)의
수정 버전입니다. 화면에는 중립적인 기능 이름을 사용하며 제품 로고나 브랜드 홍보를
표시하지 않습니다. 저작권, 라이선스, 수정 내역 및 소스 코드 링크는 편집기의 정보 패널과
[NOTICE](NOTICE)에 유지됩니다. 타사 GUI 자료와 글꼴에는 각각의 라이선스가 계속 적용됩니다.

제품 로고를 표시하지 않는 결정은 AGPLv3 제7조에 관한 FSF의 공개 해석을 참고합니다.
이는 법원 판결이나 완전한 법적 준수를 보장하는 주장이 아닙니다. 원본 프로젝트의 입장과
처리 근거는 NOTICE에 기록되어 있습니다.

ONLYOFFICE는 Ascensio System SIA의 상표입니다. 이 프로젝트는 공식 제품이 아니며
해당 회사와 제휴, 후원 또는 보증 관계가 없습니다. 법적 고지와 소스 참조의 이름은
원본 기술을 식별하기 위한 것이며 이 프로젝트의 브랜드가 아닙니다.

PWA 설치와 브라우저 탭에는 독립적으로 그린 중립적인 문서 아이콘을 사용합니다. 업스트림 로고, 상표 또는 프로젝트 이니셜은 포함하지 않습니다.

</details>
