---
title: Incorporar um editor de documentos no seu site — iframe + API postMessage
description: Incorpore um editor de DOCX, XLSX, PPTX e CSV no seu app web com um iframe e uma API postMessage. Autenticação e arquivos ficam no seu app — o editor nunca vê seus tokens. Código aberto (AGPL-3.0), auto-hospedável, white-label.
eyebrow: Desenvolvedores · Incorporar
h1: Incorporar um editor de documentos no seu app web
lead: 'Adicione ao seu produto um editor de **DOCX, XLSX, PPTX e CSV** com um único iframe e uma API **postMessage**. Seu app mantém autenticação, acesso a arquivos e upload — o editor só edita, e nunca vê os tokens dos seus usuários.'
cta: Abrir a demo ao vivo →
ctaHref: /embed-demo.html
ogDescription: Coloque um editor de DOCX/XLSX/PPTX/CSV no seu app com um iframe. A autenticação fica no seu app; o editor nunca vê seus tokens. Código aberto e auto-hospedável.
breadcrumb: Embed Document Editor
howTo: Como incorporar um editor de documentos no seu site
appDescription: Um editor de documentos no navegador que se incorpora ao seu próprio app web por iframe e API postMessage.
---

O editor roda inteiramente no navegador com o motor WebAssembly do OnlyOffice, então os documentos são renderizados e editados no cliente — você não sobe nenhum servidor de documentos. O padrão recomendado mantém a fronteira limpa: **o app pai cuida da autenticação, da busca e do salvamento; o iframe cuida só da edição.** Tokens, cookies e APIs de negócio ficam no seu app.

## Adicione com um iframe

```html
<iframe
  id="documentEditor"
  src="https://edit.chaxus.com/editor?embed=1&embedOrigin=https://your-app.example.com"
  style="width: 100%; height: 720px; border: 0"
></iframe>
```

Depois é só falar com ele por `postMessage`. Cada comando leva um `id` para você casar com a resposta, e cada evento do editor é uma mensagem `document:*`:

```js
// abre um arquivo que seu app já buscou (a auth fica com você)
iframe.contentWindow.postMessage(
  { id, type: 'document:open-buffer', payload: { fileName: 'report.xlsx', buffer } },
  'https://edit.chaxus.com',
);

// peça de volta o arquivo editado e envie você mesmo
iframe.contentWindow.postMessage({ id, type: 'document:save', payload: { targetExt: 'XLSX' } }, editorOrigin);
// → o editor responde com { type: 'document:saved', payload: { fileName, file } }
```

## O que você ganha

- Um iframe e uma pequena API **postMessage** de comando/resposta — sem SDK para instalar
- Abrir a partir de uma **URL, um File ou um ArrayBuffer** que seu app buscou com as próprias credenciais
- Salvar de volta em **XLSX, DOCX, PPTX ou CSV**, devolvido como um `File` para o seu app enviar
- Modo somente leitura, trava de origem por mensagem (`embedOrigin`) e uma consulta de estado
- Nenhum servidor de documentos para operar — a edição é 100% WebAssembly no cliente
- Código aberto (AGPL-3.0) e auto-hospedável — incorpore sob o seu próprio domínio

## Como funciona

1. Adicione o iframe apontando para `/editor?embed=1`, no tamanho do seu layout.
2. Espere o evento `document:ready` e então envie `document:open-url`, `open-file` ou `open-buffer`.
3. A pessoa edita ali mesmo; o arquivo não sai do navegador a menos que seu app o envie para algum lugar.
4. Envie `document:save`; o editor devolve o arquivo editado em `document:saved`, e seu app o envia com a própria autenticação.

## Somente leitura e modo prévia

Abra um documento somente leitura (um visualizador, uma etapa de revisão, um registro travado) passando `readonly: true` no comando de abertura, e alterne quando quiser com `document:set-readonly` — sem recarregar, e o documento continua onde a pessoa estava. No modo somente leitura a edição fica desativada e `document:save` responde com `document:error`; `document:get-state` informa o valor atual de `readonly`.

```js
// abrir travado, destravar depois
send('document:open-url', { url, readonly: true });
send('document:set-readonly', { readonly: false });
```

## Perguntas frequentes

### Como incorporo o editor de documentos?

Adicione um iframe apontando para `/editor?embed=1` e controle-o com a API postMessage para abrir e salvar documentos. Há uma demo funcionando em [/embed-demo.html](/embed-demo.html).

### O editor vê os tokens de autenticação dos meus usuários?

Não. Autenticação, busca do arquivo e upload ficam no seu app — seu app busca o arquivo com as próprias credenciais e passa os bytes ao editor, então tokens e cookies nunca entram no iframe.

### Quais formatos o editor incorporado aceita?

DOCX, XLSX, PPTX e CSV, editados no cliente com o motor WebAssembly do OnlyOffice. O comando de salvar exporta para XLSX, DOCX, PPTX ou CSV.

### Dá para auto-hospedar ou usar em white-label?

Sim. É código aberto sob a AGPL-3.0 e é distribuído como arquivos estáticos, então você pode hospedar a sua cópia e incorporá-la sob o seu domínio.

### Como restrinjo qual site pode falar com o editor?

Acrescente `embedOrigin` à URL do iframe para limitar as mensagens a uma origem, e verifique também `event.origin` no seu próprio manipulador de mensagens.

### Dá para mostrar um documento somente leitura, ou travá-lo depois?

Sim. Passe `readonly: true` ao abrir, ou envie `document:set-readonly` quando quiser — ele alterna o editor ao vivo sem recarregar, e os salvamentos são recusados enquanto está travado.
