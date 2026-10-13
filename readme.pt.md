# Editor de documentos online

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
  <a href="readme.ko.md">한국어</a> |
  <a href="readme.de.md">Deutsch</a> |
  <a href="readme.es.md">Español</a> |
  <b>Português</b> |
  <a href="readme.fa.md">فارسی</a>
</p>

**Um espaço para os seus documentos e agentes de IA, no navegador.**

Abra, edite e guarde Word, Excel e PowerPoint no navegador. Anote PDFs. Sem conta nem instalação do Office.

**Experimentar online: [edit.chaxus.com](https://edit.chaxus.com/)**

---

## ✨ Funcionalidades

- **Edição e conversão local.** Os documentos são processados no dispositivo sem precisar de upload para editar ou converter.
- **Guarde como preferir.** No ficheiro escolhido quando o navegador permite, ou por download. Retome documentos recentes neste navegador.
- **Trabalhe com IA (Experimental Beta).** Redija e melhore textos, trabalhe com dados de folhas de cálculo, crie diapositivos ou faça perguntas sobre a página PDF atual. Reveja as alterações antes de aplicar.
- **Agentes usam ferramentas de documentos.** Em navegadores compatíveis com [WebMCP](docs/reference.md#webmcp-agent-tools), os agentes de IA podem abrir, converter e exportar ficheiros e ler texto de documentos de texto.
- **Instale como PWA.** Utilize como uma aplicação; os recursos do editor em cache funcionam offline.
- **Hospede ou incorpore.** Publique um site estático ou incorpore o editor na sua aplicação através da API de iframe.

## 🚀 Começar

[Novo documento](https://edit.chaxus.com/editor?new=docx&locale=pt-PT) · [Nova folha de cálculo](https://edit.chaxus.com/editor?new=xlsx&locale=pt-PT) · [Nova apresentação](https://edit.chaxus.com/editor?new=pptx&locale=pt-PT)

Ou execute a sua própria cópia:

```bash
docker run -d --name document -p 8080:80 ghcr.io/ranuts/document:latest
```

## 📄 Formatos

| Tipo              | Editar                      | Também abre                 |
| ----------------- | --------------------------- | --------------------------- |
| Documentos        | `.docx`                     | `.doc` `.odt` `.rtf` `.txt` |
| Folhas de cálculo | `.xlsx` `.csv`              | `.xls` `.ods`               |
| Apresentações     | `.pptx`                     | `.ppt` `.odp`               |
| PDF               | anotar, preencher, exportar | `.pdf`                      |

Os documentos compatíveis podem ser exportados para PDF.

Também suporta interfaces multilingues, temas claro e escuro e pré-visualização só de leitura.

## 🔐 Edição local e tratamento de dados

As cópias de recuperação ficam neste navegador durante 7 dias após a última edição ou abertura. Apague-as em [Documentos guardados](https://edit.chaxus.com/history). Não são um backup; exporte os ficheiros importantes.

Os serviços de IA externos recebem o conteúdo necessário para o pedido. Os modelos locais processam-no no dispositivo. O ditado pode usar um serviço de voz online; a aplicação anfitriã trata as exportações incorporadas.

## Documentação e integração

[Guia de utilização](https://edit.chaxus.com/help) · [Hospedagem, URLs e integração](docs/reference.md) · [API de incorporação](docs/embed-api.md) · [Tipos de letra](docs/fonts.md)

A utilização offline exige recursos do editor em cache. Recursos não guardados e ficheiros remotos precisam de ligação.

## Assistente de documentos com IA (Experimental Beta)

Redija e melhore textos, trabalhe com dados de folhas de cálculo, crie diapositivos ou faça perguntas sobre a página PDF atual. Reveja as alterações antes de aplicar e desfaça-as quando necessário.

Escolha um modelo local ou ligue o seu próprio serviço de IA. Pode ditar instruções em navegadores com entrada de voz.

**Experimental Beta.** Desativado por predefinição. Respostas e alterações podem estar erradas; confirme resultados importantes.

<details>
<summary>Ver as quatro demos</summary>

| Word                                                                                                                                                        | Excel                                                                                                                                                           |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [![Redigir, inserir, resumir e desfazer](docs/media/ai-demos/word-ai.jpg)](https://github.com/user-attachments/assets/8d1d6386-e33a-45f2-b968-b8695c8f7da9) | [![Preencher, calcular, ordenar e desfazer](docs/media/ai-demos/excel-ai.jpg)](https://github.com/user-attachments/assets/5bb253d7-3cc5-4f31-989e-0c88dcb1615c) |
| **Redigir, inserir, resumir e desfazer**                                                                                                                    | **Preencher, calcular, ordenar e desfazer**                                                                                                                     |
| PowerPoint                                                                                                                                                  | PDF                                                                                                                                                             |
| [![Criar, duplicar e desfazer](docs/media/ai-demos/pptx-ai.jpg)](https://github.com/user-attachments/assets/db3fc7a7-b54e-4147-a7ca-e7f16243618e)           | [![Ler, perguntar e rever notas](docs/media/ai-demos/pdf-ai.jpg)](https://github.com/user-attachments/assets/f01c2da6-0669-4111-87c1-c4440f4a60e9)              |
| **Criar, duplicar e desfazer**                                                                                                                              | **Ler, perguntar e rever notas**                                                                                                                                |

Fluxos completos à velocidade normal, em inglês, com o modelo local Qwen3 4B já carregado. O tempo de resposta depende do modelo e do dispositivo.

[Vídeos, legendas e descrições](docs/media/ai-demos/README.md)

O PDF suporta texto selecionável e notas de página, não reconhece texto em imagens digitalizadas nem reescreve o corpo do PDF.

</details>

## 🛠 Desenvolvimento

Executar a partir do código:

```bash
git clone https://github.com/ranuts/document.git
cd document
pnpm install --frozen-lockfile
pnpm run dev
```

Comentários e contribuições são bem-vindos: [Issues](https://github.com/ranuts/document/issues) · [Pull requests](https://github.com/ranuts/document/pulls)

## 📚 Construído sobre

- [sdkjs](https://github.com/ONLYOFFICE/sdkjs) e [web-apps](https://github.com/ONLYOFFICE/web-apps) — os editores do OnlyOffice
- [onlyoffice-x2t-wasm](https://github.com/cryptpad/onlyoffice-x2t-wasm) — o conversor de documentos em WASM
- [ranui / ranuts](https://github.com/chaxus/ran) — o sistema de design e os utilitários com que este site é feito
- [se-office](https://github.com/Qihoo360/se-office), [onlyoffice-web-local](https://github.com/sweetwisdom/onlyoffice-web-local) — trabalho anterior sobre usar o OnlyOffice sem servidor de documentos

## 📄 Licença

[AGPL-3.0](LICENSE) · [NOTICE](NOTICE)

<details>
<summary>Avisos do projeto original e marcas</summary>

Este projeto é uma versão modificada dos editores ONLYOFFICE (sdkjs e web-apps,
copyright de Ascensio System SIA). A interface usa nomes funcionais neutros, sem
logótipos de produtos ou promoção de marcas. Os avisos de copyright, licenças,
modificações e ligações ao código-fonte permanecem no painel Sobre e em
[NOTICE](NOTICE). Os recursos GUI e as fontes de terceiros mantêm as suas licenças.

A decisão de não apresentar logótipos segue a interpretação publicada pela FSF
da secção 7 da AGPLv3. Não é apresentada como uma decisão judicial nem como uma
garantia de conformidade legal. A posição do projeto original e os fundamentos
da decisão estão documentados em NOTICE.

ONLYOFFICE é uma marca da Ascensio System SIA. Este projeto não é um produto
oficial e não tem afiliação, patrocínio ou aprovação dessa empresa. Os nomes nos
avisos legais e nas referências ao código identificam a tecnologia original,
não a marca deste projeto.

A instalação PWA e as abas do navegador usam um ícone de documento neutro desenhado
de forma independente, sem logótipos, marcas ou iniciais do projeto.

</details>
