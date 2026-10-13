<p align="center">
  <img src="public/icons/document.svg" width="88" height="88" alt="Document Editor">
</p>

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
  <a href="#assistente-de-documentos-com-ia-experimental-beta">
    <img src="https://img.shields.io/badge/AI_Assistant-Experimental_Beta-orange" alt="AI Assistant: Experimental Beta">
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

Edite ficheiros do Word, Excel e PowerPoint e anote PDFs diretamente no navegador. Não é preciso instalar o Office nem criar uma conta. A edição e conversão são locais; pode ativar o assistente experimental de IA quando precisar.

**Site: [edit.chaxus.com](https://edit.chaxus.com/)**

---

## ✨ Funcionalidades

- 🔒 **Edição local** — a conversão, edição e exportação acontecem no navegador; escolhe onde os pedidos opcionais de IA são processados
- 📝 **Edição a sério, não pré-visualização** — DOCX, XLSX, PPTX e CSV, além de ODF, RTF, TXT e os antigos formatos binários; os PDF abrem e podem ser anotados
- 🕓 **Retome o trabalho** — as cópias de recuperação locais ajudam a reabrir as edições recentes; ficam guardadas 7 dias e podem ser apagadas a qualquer momento ([pormenores](#-edição-local-e-tratamento-de-dados))
- 📴 **Funciona sem ligação** — instalável como PWA; os recursos do editor em cache podem ser reutilizados offline; recursos não guardados e ficheiros remotos precisam de rede
- 🌍 **Multilingue** — 7 idiomas de interface para o site e 45 para o editor
- 🧩 **Incorporável** — API completa de postMessage para integração em iframe
- ✨ **Assistente de documentos com IA (Experimental Beta)** — Crie textos, trabalhe com tabelas, gere slides e faça perguntas sobre PDFs com um modelo local ou seu próprio serviço de IA.
- 🤖 **Pronto para agentes** — expõe ferramentas WebMCP para que um agente de IA do navegador abra, converta e leia documentos
- 🚀 **Implanta-se em qualquer lado** — uma compilação estática; uma pasta de ficheiros atrás de qualquer servidor web

---

## Assistente de documentos com IA (Experimental Beta)

Descreva o que precisa e confira o resultado no documento. Crie um texto, preencha uma coluna, gere um slide ou faça perguntas sobre a página atual de um PDF. Revise ou cancele as sugestões; as alterações aplicadas podem ser desfeitas.

**Ainda experimental.** As respostas e alterações podem estar erradas. Confira os resultados importantes. O assistente vem desativado. Escolha um modelo local ou conecte seu próprio serviço de IA. Serviços externos recebem o conteúdo necessário para sua solicitação.

| Word                                                                                                                                                         | Excel                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [![Word: draft, insert and undo](docs/media/ai-demos/word-ai.jpg)](https://github.com/user-attachments/assets/97bf02e6-293c-44e3-b042-4334e03a7db5)          | [![Excel: fill cells and calculate](docs/media/ai-demos/excel-ai.jpg)](https://github.com/user-attachments/assets/fc68c9d5-4cb5-4a80-a29d-46665af1a409)  |
| PowerPoint                                                                                                                                                   | PDF                                                                                                                                                      |
| [![PowerPoint: review and create a slide](docs/media/ai-demos/pptx-ai.jpg)](https://github.com/user-attachments/assets/c8dda2cc-80f1-4c12-acc2-80469bd41007) | [![PDF: read a page and review a note](docs/media/ai-demos/pdf-ai.jpg)](https://github.com/user-attachments/assets/25355bc0-57cb-4a3d-a465-87dff2b68b4e) |

Os vídeos estão em inglês e foram gravados novamente com Qwen3 4B local e informações fictícias. A preparação do modelo foi omitida e as esperas foram encurtadas. A velocidade real depende do modelo e do dispositivo.

[Vídeos, legendas em inglês e descrições](docs/media/ai-demos/README.md)

A assistência para PDF usa o texto selecionável da página atual e notas de página. Não reconhece texto em imagens digitalizadas nem reescreve o corpo do PDF.

---

## 🚀 Começar

**Usar já:** [edit.chaxus.com](https://edit.chaxus.com/) — nada a instalar.

**Alojar por si com Docker:**

```bash
docker run -d --name document -p 8080:80 ghcr.io/ranuts/document:latest
```

**Correr a partir do código:**

```bash
git clone https://github.com/ranuts/document.git
cd document
pnpm install
pnpm run dev
```

---

## 📄 Formatos

| Tipo              | Editar                      | Também abre                 |
| ----------------- | --------------------------- | --------------------------- |
| Documentos        | `.docx`                     | `.doc` `.odt` `.rtf` `.txt` |
| Folhas de cálculo | `.xlsx` `.csv`              | `.xls` `.ods`               |
| Apresentações     | `.pptx`                     | `.ppt` `.odp`               |
| PDF               | anotar, preencher, exportar | `.pdf`                      |

Qualquer um deles pode ser exportado para PDF. O CSV mantém a codificação à saída (na
abertura são detetados UTF-8, GB18030 e Latin-1).

---

## 🔗 Rotas e parâmetros de URL

| Rota                  | O que é                                                           |
| --------------------- | ----------------------------------------------------------------- |
| `/`                   | Página inicial. O editor só é carregado quando abre alguma coisa. |
| `/editor`             | O editor.                                                         |
| `/history`            | Documentos que este navegador tem guardados (ver abaixo).         |
| `/help`, `/changelog` | Gerados a partir do markdown em `content/`.                       |

Parâmetros de `/editor`:

| Parâmetro    | Descrição                                                                                                                               |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| `src=<url>`  | Abrir um documento a partir de um URL (esse URL tem de permitir CORS)                                                                   |
| `file=<url>` | O mesmo, na grafia antiga; se ambos existirem, prevalece este                                                                           |
| `new=docx`   | Criar um documento em branco (`docx`, `xlsx`, `pptx`)                                                                                   |
| `doc=<id>`   | Reabrir um documento do histórico deste navegador — o editor coloca aqui o seu próprio id, por isso recarregar volta ao mesmo documento |
| `readonly=1` | Abrir só para consulta: edição e exportação ficam desativadas                                                                           |
| `embed=1`    | Modo incorporado; a página anfitriã comanda o editor por postMessage                                                                    |
| `locale=pt`  | Idioma da interface                                                                                                                     |

---

## 🔐 Edição local e tratamento de dados

A edição e a conversão são realizadas localmente. Só ficam duas coisas guardadas localmente,
e ambas pode remover:

- **Cópias daquilo que editou.** Enquanto trabalha, o editor guarda o documento neste
  navegador (IndexedDB) para que recarregar, fechar um separador ou uma falha não lhe custem
  o trabalho. Ao reabrir o editor, ele volta a oferecê-las. Estas cópias existem para poder
  retomar o que estava a meio — não são uma cópia de segurança, por isso continue a exportar
  tudo o que quiser guardar.
- **Sete dias e desaparecem.** Cada documento é apagado automaticamente sete dias depois da
  última vez que o editou ou abriu, quer volte ou não.

[`/history`](https://edit.chaxus.com/history) lista o que está guardado, com um botão de
eliminar em cada linha, um para eliminar tudo e um interruptor para desligar por completo a
gravação automática. Eliminar ali tem efeito imediato. Num computador partilhado, é a página
a visitar.

O assistente de IA vem desativado. Com um modelo local, o conteúdo fica no seu dispositivo. Ao ligar o seu próprio serviço de IA, o conteúdo necessário para o pedido é enviado a esse serviço. O ditado do navegador pode usar um serviço de reconhecimento de voz online. No modo incorporado, os ficheiros exportados voltam à aplicação anfitriã, que controla os envios posteriores.

---

## 🧩 Incorporar num iframe

Incorpore o editor e comande-o por postMessage. A divisão habitual é: o seu sistema trata da
autenticação e do armazenamento, o iframe trata da edição.

```html
<iframe
  id="documentEditor"
  src="https://your-deployment/editor?embed=1"
  style="width: 100%; height: 720px; border: 0"
></iframe>
```

```js
// Abrir um documento
iframe.contentWindow.postMessage(
  { id: '1', type: 'document:open-url', payload: { url: 'https://example.com/doc.xlsx' } },
  'https://your-deployment',
);

// Ouvir o resultado
window.addEventListener('message', (e) => {
  if (e.data?.type === 'document:opened') console.log('Pronto a editar');
  if (e.data?.type === 'document:saved') uploadFile(e.data.payload.file);
});
```

Os editores incorporados não mantêm histórico local — o documento pertence à página anfitriã.

→ **[Referência completa da API](docs/embed-api.md)** — todos os tipos de mensagem, a lista
de origens permitidas, o modo de leitura e o fluxo de gravação.

Também disponível como componente: é este projeto que move a pré-visualização de documentos
do [@ranui/preview](https://www.npmjs.com/package/@ranui/preview)
([documentação](https://chaxus.github.io/ran/src/ranui/preview/)).

---

## 🚀 Implantação

Uma compilação estática — sem runtime, sem base de dados.

```bash
pnpm build   # sai para dist/
```

### Alojamento estático (Cloudflare Pages, Nginx, Vercel, Netlify…)

Carregue `dist/`. O ficheiro `public/_headers` traz o contrato de cache que o site pressupõe
(recursos com hash imutáveis, service worker nunca em cache); alojamentos que o ignorem
continuam a funcionar, apenas revalidam mais vezes.

No Nginx, sirva `index.html` como alternativa para rotas desconhecidas:

```nginx
location / {
  root /var/www/document;
  try_files $uri $uri/ /index.html;
}
```

### GitHub Pages

`.github/workflows/pages-build-site.yml` compila e publica a cada push para `main`. Ative as
Pages nas definições do repositório com **GitHub Actions** como origem.

### Docker

```bash
# Básico
docker run -d --name document -p 8080:80 ghcr.io/ranuts/document:latest

# Com HTTPS e autenticação básica
docker run -d --name document -p 443:443 \
  -v /path/to/certs:/ssl \
  -e SERVER_BASIC_AUTH='user:$2y$...' \
  -e SERVER_HTTP2_TLS=true \
  -e SERVER_HTTP2_TLS_CERT=/ssl/cert.pem \
  -e SERVER_HTTP2_TLS_KEY=/ssl/key.pem \
  ghcr.io/ranuts/document:latest
```

`SERVER_BASIC_AUTH` recebe um hash BCrypt; duplique os caracteres `$` para os escapar na
shell. A cache da imagem é configurada em `sws.toml`.

---

## 🔤 Tipos de letra

A compilação do OnlyOffice incluída traz a biblioteca de tipos de letra em `public/fonts/`,
indexada por `public/sdkjs/common/AllFonts.js`. Os tipos de letra são obtidos a pedido — um
documento só descarrega aqueles que realmente usa.

→ **[Guia de gestão de tipos de letra](docs/fonts.md)** — o formato do catálogo indexado, os
registos e como acrescentar tipos de letra com `bin/font-catalog.mjs`.

---

## 🛠 Desenvolvimento

```bash
pnpm install --frozen-lockfile
pnpm run dev            # servidor de desenvolvimento
pnpm run build          # compilação de produção (bin/build.sh)
pnpm run lint           # oxlint + tsc + configuração do docker
pnpm run test           # testes unitários (Vitest)
pnpm run test:e2e       # testes de ponta a ponta (Playwright, editor real + WASM real)
```

A suíte de ponta a ponta usa o editor verdadeiro e o conversor verdadeiro em vez de
simulações, incluindo idas e voltas de documentos, o protocolo de incorporação e o fluxo de
recuperação. `docs/explorations/` regista por que razão cada peça menos óbvia é como é —
vale a pena ler antes de mexer na integração do editor.

---

## 🤖 Agentes de IA no navegador (WebMCP)

Onde o navegador o suporta, a página regista ferramentas que um agente pode invocar
diretamente em vez de manobrar a interface: `open_document_url`, `open_document_buffer`,
`create_document`, `save_document`, `get_document_text`, `set_readonly`,
`get_document_state`. Também aqui os documentos não saem do dispositivo — é o próprio
navegador que os obtém e converte. Onde a API não existe, nada acontece.

---

## 📚 Construído sobre

- [sdkjs](https://github.com/ONLYOFFICE/sdkjs) e [web-apps](https://github.com/ONLYOFFICE/web-apps) — os editores do OnlyOffice
- [onlyoffice-x2t-wasm](https://github.com/cryptpad/onlyoffice-x2t-wasm) — o conversor de documentos em WASM
- [ranui / ranuts](https://github.com/chaxus/ran) — o sistema de design e os utilitários com que este site é feito
- [se-office](https://github.com/Qihoo360/se-office), [onlyoffice-web-local](https://github.com/sweetwisdom/onlyoffice-web-local) — trabalho anterior sobre usar o OnlyOffice sem servidor de documentos

## 🤝 Contribuir

Issues e pull requests são bem-vindos. O `main` está protegido: trabalhe num ramo e abra um
PR, que corre o lint, os testes unitários e três suítes de ponta a ponta (servidor de
desenvolvimento, comportamento do Cloudflare Pages e imagem Docker de produção).

## 📄 Licença

[AGPL-3.0](LICENSE).

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
