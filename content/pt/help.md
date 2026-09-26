---
title: 'Ajuda — usando o editor de documentos online'
description: 'Como abrir, editar, salvar e recuperar documentos; privacidade e requisitos offline. Edição local sem envio obrigatório.'
eyebrow: Ajuda
breadcrumb: Ajuda
h1: Ajuda
lead: 'Abra, veja e edite DOCX, XLSX, PPTX e CSV no navegador sem Office ou conta. A edição básica não exige enviar documentos; o uso offline depende dos recursos em cache.'
---

## Abrir e criar documentos

### Quais formatos de arquivo posso abrir?

Word (`.docx`, o antigo `.doc`), Excel (`.xlsx`, o antigo `.xls`), PowerPoint (`.pptx`, o antigo `.ppt`), valores separados por vírgula (`.csv`) e PDF (`.pdf`). Escolha um arquivo com **Abrir**, arraste-o para a página ou passe uma URL com `/editor?file=https://…` / `/editor?src=https://…` (o servidor que hospeda o arquivo precisa permitir requisições de outra origem).

### Como crio um documento novo?

A abertura, edição e conversão básicas rodam localmente no navegador sem exigir o envio do documento. Com o salvamento automático ativado, cópias de recuperação ficam na IndexedDB deste navegador por 7 dias após a última edição ou abertura. Fechar a aba não as apaga. Em /history você pode excluir cópias ou desativar o salvamento automático. O navegador pode limpar ou remover seu armazenamento, e edições ainda não salvas podem se perder; a recuperação não substitui salvar o arquivo.

### Existe limite de tamanho?

Não há limite fixo. O teto prático é a memória do seu dispositivo, porque o documento inteiro é analisado e renderizado localmente.

## Editar e salvar

### Como salvo minhas alterações?

No Chrome, Edge e outros navegadores com File System Access API, o primeiro salvamento pede um arquivo e os seguintes gravam nele. Outros navegadores baixam uma cópia. Exporte outros formatos em Arquivo → Baixar como. As cópias de recuperação no navegador são independentes do arquivo salvo.

### Por que o botão Salvar às vezes fica cinza?

Ele acende quando o editor carregou o documento por completo e você fez alguma alteração. Se continuar cinza depois de editar, o documento não terminou de carregar — veja se a notificação traz um erro e consulte a seção de códigos de erro abaixo.

### Dá para converter entre formatos?

Na edição básica local: Sim, no seu dispositivo: abra um documento e escolha o formato de destino em **Baixar como**. Documentos do Word exportam para DOCX / PDF / TXT, planilhas para XLSX / CSV / PDF e apresentações para PPTX / PDF. Arquivos CSV são abertos como planilha e podem ser salvos de volta como CSV.

### Meu CSV com acentos ou caracteres chineses aparece quebrado em outras ferramentas. E aqui?

O editor detecta a codificação do CSV antes de abrir — primeiro UTF-8 estrito, depois GB18030 (a codificação «ANSI» que o Excel usa nas exportações em chinês) e por fim Latin-1 — então arquivos que aparecem quebrados em outras ferramentas abrem certos aqui. Ao salvar, é gravado UTF-8 com marca de ordem de bytes, que o Excel abre sem assistente.

## PDF

### O que dá para fazer com um PDF?

Abrir e ler (rolar, ampliar, pesquisar), adicionar comentários e anotações de texto livre, e baixar de novo como um PDF que mantém essas anotações. Formulários preenchíveis podem ser preenchidos.

### Dá para reescrever o texto de um PDF existente como num documento do Word?

Na edição básica local: Não como texto que flui livremente — o PDF é um formato de layout fixo. Para mudar a redação, abra o DOCX / XLSX / PPTX original e exporte um novo PDF. As duas etapas acontecem no seu dispositivo.

## Somente leitura e incorporação

### Dá para abrir um documento somente leitura?

Sim. Acrescente `&readonly=1` a um link `/editor?file=`, ou envie `document:set-readonly` pela API de incorporação. O modo somente leitura pode ser ligado e desligado em tempo de execução, sem recarregar o documento.

### Dá para colocar o editor dentro do meu próprio app web?

Sim — o editor foi feito para ser incorporado num iframe e controlado por `postMessage`: sua página busca o arquivo (com a própria autenticação), envia para o iframe e recebe de volta o `File` editado para enviar aonde quiser. Veja a [referência da Embed API](/pt/help/embed-api) e a [demo ao vivo](/embed-demo.html).

## Agentes de IA do navegador (WebMCP)

### Um assistente de IA do meu navegador pode operar o editor?

As ferramentas WebMCP editam e convertem localmente, mas um agente do navegador pode receber texto ou arquivos exportados e enviá-los ao seu próprio serviço de IA. Confira a política de dados do agente antes de compartilhar conteúdo confidencial.

### Quais navegadores dão suporte?

O WebMCP é uma proposta do W3C Web Machine Learning Community Group, disponível hoje no Chrome atrás de um origin trial. Firefox e Safari não anunciaram suporte. Onde o navegador não oferece a API, nada é registrado e nada muda — é uma adição pura.

### Funciona num editor incorporado?

Não, por design. As ferramentas só são registradas quando o editor é a página de nível superior. Um iframe de outra origem exigiria que a página incorporadora concedesse `allow="tools"`, o que conflita com o sentido da incorporação — se você incorporar o editor, controle-o pela [Embed API](/pt/help/embed-api).

### O agente pode ler o texto do documento?

Em documentos de texto, sim: `get_document_text` devolve o texto para o agente responder perguntas sobre o conteúdo sem exportar nada. Planilhas e apresentações não expõem leitura de texto completo neste motor; a ferramenta diz isso explicitamente (em vez de devolver uma resposta vazia que pareceria um arquivo vazio) e aponta para a exportação.

## Offline e instalação

### Funciona offline?

A edição offline depende de o navegador manter em cache o app, o motor, o conversor e as fontes e recursos de formato necessários. Uma visita ou a instalação da PWA não garante isso. URLs de arquivos remotos precisam de conexão.

### Como recebo a versão mais nova?

O site se atualiza sozinho na próxima visita. Se uma página parecer presa numa versão antiga, recarregue forçado (Ctrl+Shift+R / ⌘⇧R) ou remova o registro do service worker nas configurações do site no navegador.

## Privacidade

### Meus documentos são enviados para algum lugar?

A abertura, edição e conversão básicas rodam localmente no navegador sem exigir o envio do documento. O assistente de IA integrado ainda não está concluído e não é uma função publicada. O app que incorpora o editor pode receber arquivos exportados e enviá-los conforme sua própria política.

### O que a página carrega da rede?

A página carrega código, recursos do editor, fontes e uma requisição do Cloudflare Web Analytics. URLs remotas podem gerar requisições adicionais. Apps anfitriões e agentes externos do navegador definem suas próprias políticas de dados.

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

### O que fica depois de fechar a aba?

Com o salvamento automático ativado, cópias de recuperação ficam na IndexedDB deste navegador por 7 dias após a última edição ou abertura. Fechar a aba não as apaga. Em /history você pode excluir cópias ou desativar o salvamento automático. O navegador pode limpar ou remover seu armazenamento, e edições ainda não salvas podem se perder; a recuperação não substitui salvar o arquivo.

### O assistente de IA integrado está disponível?

O assistente de IA integrado ainda não está concluído e não é uma função publicada. O app que incorpora o editor pode receber arquivos exportados e enviá-los conforme sua própria política.
