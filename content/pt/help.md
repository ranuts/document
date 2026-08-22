---
title: Ajuda — usando o editor de documentos online
description: Como abrir, editar e salvar arquivos do Word, Excel, PowerPoint, CSV e PDF no navegador sem enviá-los; somente leitura e incorporação, uso offline, limites de privacidade, códigos de erro e auto-hospedagem.
eyebrow: Ajuda
breadcrumb: Ajuda
h1: Ajuda
lead: Respostas práticas para usar o editor. Tudo roda dentro da aba do seu navegador; seus arquivos nunca são enviados.
---

## Abrir e criar documentos

### Quais formatos de arquivo posso abrir?

Word (`.docx`, o antigo `.doc`), Excel (`.xlsx`, o antigo `.xls`), PowerPoint (`.pptx`, o antigo `.ppt`), valores separados por vírgula (`.csv`) e PDF (`.pdf`). Escolha um arquivo com **Abrir**, arraste-o para a página ou passe uma URL com `/editor?file=https://…` / `/editor?src=https://…` (o servidor que hospeda o arquivo precisa permitir requisições de outra origem).

### Como crio um documento novo?

Use **Novo Word / Novo Excel / Novo PowerPoint** na página inicial, ou abra direto `/editor?new=docx`, `/editor?new=xlsx`, `/editor?new=pptx`. Nada é criado em servidor nenhum: o documento em branco existe só na sua aba até você baixá-lo.

### Existe limite de tamanho?

Não há limite fixo. O teto prático é a memória do seu dispositivo, porque o documento inteiro é analisado e renderizado localmente.

## Editar e salvar

### Como salvo minhas alterações?

Pressione **Ctrl+S / ⌘S** ou use **Arquivo → Baixar como**. Como não há servidor, «salvar» significa que o navegador entrega o arquivo para você: ele cai na sua pasta de downloads com o nome original. Escolha outro formato em **Baixar como** para converter (por exemplo DOCX → PDF, XLSX → CSV).

### Por que o botão Salvar às vezes fica cinza?

Ele acende quando o editor carregou o documento por completo e você fez alguma alteração. Se continuar cinza depois de editar, o documento não terminou de carregar — veja se a notificação traz um erro e consulte a seção de códigos de erro abaixo.

### Dá para converter entre formatos?

Sim, no seu dispositivo: abra um documento e escolha o formato de destino em **Baixar como**. Documentos do Word exportam para DOCX / PDF / TXT, planilhas para XLSX / CSV / PDF e apresentações para PPTX / PDF. Arquivos CSV são abertos como planilha e podem ser salvos de volta como CSV.

### Meu CSV com acentos ou caracteres chineses aparece quebrado em outras ferramentas. E aqui?

O editor detecta a codificação do CSV antes de abrir — primeiro UTF-8 estrito, depois GB18030 (a codificação «ANSI» que o Excel usa nas exportações em chinês) e por fim Latin-1 — então arquivos que aparecem quebrados em outras ferramentas abrem certos aqui. Ao salvar, é gravado UTF-8 com marca de ordem de bytes, que o Excel abre sem assistente.

## PDF

### O que dá para fazer com um PDF?

Abrir e ler (rolar, ampliar, pesquisar), adicionar comentários e anotações de texto livre, e baixar de novo como um PDF que mantém essas anotações. Formulários preenchíveis podem ser preenchidos.

### Dá para reescrever o texto de um PDF existente como num documento do Word?

Não como texto que flui livremente — o PDF é um formato de layout fixo. Para mudar a redação, abra o DOCX / XLSX / PPTX original e exporte um novo PDF. As duas etapas acontecem no seu dispositivo.

## Somente leitura e incorporação

### Dá para abrir um documento somente leitura?

Sim. Acrescente `&readonly=1` a um link `/editor?file=`, ou envie `document:set-readonly` pela API de incorporação. O modo somente leitura pode ser ligado e desligado em tempo de execução, sem recarregar o documento.

### Dá para colocar o editor dentro do meu próprio app web?

Sim — o editor foi feito para ser incorporado num iframe e controlado por `postMessage`: sua página busca o arquivo (com a própria autenticação), envia para o iframe e recebe de volta o `File` editado para enviar aonde quiser. Veja a [referência da Embed API](/pt/help/embed-api) e a [demo ao vivo](/embed-demo.html).

## Agentes de IA do navegador (WebMCP)

### Um assistente de IA do meu navegador pode operar o editor?

Sim, onde o navegador der suporte. O editor registra um conjunto de ferramentas WebMCP, então um agente de IA do navegador pode abrir, converter, ler e exportar documentos chamando-as diretamente, em vez de clicar pela interface. Tudo continua rodando no seu dispositivo — o agente aciona o mesmo código local que os botões, e nada é enviado.

As ferramentas são `open_document_url`, `open_document_buffer`, `create_document`, `save_document`, `get_document_text`, `set_readonly` e `get_document_state`.

### Quais navegadores dão suporte?

O WebMCP é uma proposta do W3C Web Machine Learning Community Group, disponível hoje no Chrome atrás de um origin trial. Firefox e Safari não anunciaram suporte. Onde o navegador não oferece a API, nada é registrado e nada muda — é uma adição pura.

### Funciona num editor incorporado?

Não, por design. As ferramentas só são registradas quando o editor é a página de nível superior. Um iframe de outra origem exigiria que a página incorporadora concedesse `allow="tools"`, o que conflita com o sentido da incorporação — se você incorporar o editor, controle-o pela [Embed API](/pt/help/embed-api).

### O agente pode ler o texto do documento?

Em documentos de texto, sim: `get_document_text` devolve o texto para o agente responder perguntas sobre o conteúdo sem exportar nada. Planilhas e apresentações não expõem leitura de texto completo neste motor; a ferramenta diz isso explicitamente (em vez de devolver uma resposta vazia que pareceria um arquivo vazio) e aponta para a exportação.

## Offline e instalação

### Funciona offline?

Sim. Depois da primeira visita, o editor fica em cache por um service worker; você pode instalá-lo como aplicativo pela barra de endereços do navegador (PWA) e abrir documentos sem conexão. A primeira abertura de um documento com muitas fontes ainda precisa da rede uma vez para buscá-las; depois elas também ficam em cache.

### Como recebo a versão mais nova?

O site se atualiza sozinho na próxima visita. Se uma página parecer presa numa versão antiga, recarregue forçado (Ctrl+Shift+R / ⌘⇧R) ou remova o registro do service worker nas configurações do site no navegador.

## Privacidade

### Meus documentos são enviados para algum lugar?

Não. O documento é lido do seu disco para a aba do navegador e processado ali com WebAssembly. Não existe endpoint de upload neste site. Você pode conferir no painel de rede do navegador enquanto abre e salva um documento — e o código é aberto sob a AGPL-3.0.

### O que a página carrega da rede?

Só a própria aplicação: o JavaScript do editor, o conversor WebAssembly, as fontes e os recursos da página — tudo da origem deste site — além de um beacon do Cloudflare Web Analytics respeitoso com a privacidade (sem cookies, sem rastreamento entre sites). Se você ativar o assistente de IA opcional com a sua própria chave de API, as requisições dele vão direto do seu navegador para o provedor escolhido; nada passa por este site.

## Erros

### O que significam os códigos de erro da notificação?

- **-85** — o conteúdo do arquivo não corresponde à extensão (por exemplo, uma página HTML salva como `.xls`, ou um `.docx` que na verdade é um `.doc`). Renomeie ou exporte de novo.
- **-82** — o arquivo não pôde ser convertido; pode estar corrompido, protegido por senha ou numa variante que o motor não suporta.
- **-24 / -25** — um script do editor falhou ao carregar, normalmente um soluço de rede ou uma versão antiga em cache. Recarregue forçado e tente de novo.
- **80** — a exportação falhou dentro do conversor. Tente outro formato de destino; se persistir, abra uma issue com o tipo de arquivo e os passos.

### Algo parece quebrado. Onde eu reporto?

Abra uma issue no [GitHub](https://github.com/ranuts/document/issues) com o navegador e a versão, o tipo de arquivo e — se não for confidencial — um arquivo que reproduza o problema. Uma reprodução mínima vale mais que uma descrição.

## Auto-hospedagem

### Posso rodar a minha própria cópia?

Sim. É um site estático, então qualquer servidor web serve: `docker run -d -p 8080:80 ghcr.io/ranuts/document:latest`, ou compile com `pnpm run build` e sirva a pasta `dist/`. Veja o [README](https://github.com/ranuts/document#readme) para opções de HTTPS e autenticação básica, e as [novidades](/pt/changelog) para o que mudou em cada versão.
