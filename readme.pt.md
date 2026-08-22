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

Abra e edite ficheiros do Word, do Excel e do PowerPoint num separador do navegador. Não há
servidor: o motor do OnlyOffice e o respetivo conversor WASM correm no próprio dispositivo de
quem visita, por isso os documentos nunca são enviados para lado nenhum e não é preciso conta.

**Site: [edit.chaxus.com](https://edit.chaxus.com/)**

---

## ✨ Funcionalidades

- 🔒 **Nada é enviado** — cada conversão, edição e exportação acontece dentro do separador
- 📝 **Edição a sério, não pré-visualização** — DOCX, XLSX, PPTX e CSV, além de ODF, RTF, TXT e os antigos formatos binários; os PDF abrem e podem ser anotados
- 🕓 **Nada se perde ao fechar o separador** — o que edita é guardado no seu próprio navegador, mantido 7 dias e apagável a qualquer momento ([pormenores](#-os-seus-dados-ficam-no-seu-dispositivo))
- 📴 **Funciona sem ligação** — instalável como PWA; depois da primeira visita não precisa de rede
- 🌍 **Multilingue** — 8 idiomas de interface para o site e 45 para o editor
- 🧩 **Incorporável** — API completa de postMessage para integração em iframe
- 🤖 **Pronto para agentes** — expõe ferramentas WebMCP para que um agente de IA do navegador abra, converta e leia documentos
- 🚀 **Implanta-se em qualquer lado** — uma compilação estática; uma pasta de ficheiros atrás de qualquer servidor web

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

## 🔐 Os seus dados ficam no seu dispositivo

Os documentos não são enviados para lugar nenhum. Só ficam duas coisas guardadas localmente,
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

## 🤖 Agentes de IA no navegador (WebMCP)

Onde o navegador o suporta, a página regista ferramentas que um agente pode invocar
diretamente em vez de manobrar a interface: `open_document_url`, `open_document_buffer`,
`create_document`, `save_document`, `get_document_text`, `set_readonly`,
`get_document_state`. Também aqui os documentos não saem do dispositivo — é o próprio
navegador que os obtém e converte. Onde a API não existe, nada acontece.

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

[AGPL-3.0](LICENSE)
