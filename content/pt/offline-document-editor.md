---
title: 'Editor de documentos offline — edite DOCX, XLSX e PPTX sem internet'
description: 'Edite DOCX, XLSX, PPTX e CSV offline com app, motor e fontes já armazenados em cache.'
eyebrow: Offline · PWA
h1: Um editor de documentos offline que funciona sem internet
lead: 'Recursos de edição em cache funcionam offline; arquivos remotos e IA na nuvem precisam de conexão.'
cta: Abrir o editor →
ctaHref: /pt/
ogDescription: 'Edite DOCX, XLSX, PPTX e CSV offline com app, motor e fontes já armazenados em cache.'
breadcrumb: Editor offline
howTo: Como usar o editor de documentos offline
appDescription: 'Edite DOCX, XLSX, PPTX e CSV offline com app, motor e fontes já armazenados em cache.'
---

A abertura, edição e conversão básicas rodam localmente no navegador sem exigir o envio do documento.

A edição offline depende de o navegador manter em cache o app, o motor, o conversor e as fontes e recursos de formato necessários. Uma visita ou a instalação da PWA não garante isso. URLs de arquivos remotos e IA na nuvem precisam de conexão; o WebLLM local precisa do modelo já disponível.

## Como funciona

1. Abra o editor conectado e teste os formatos, fontes e exportações necessários. Depois desconecte e confira o mesmo fluxo antes de depender do modo offline.
2. Instalar a PWA é opcional: use a opção do navegador ou Adicionar à tela de início. A instalação não garante que todos os recursos estejam em cache.
3. Recursos de edição em cache funcionam offline; arquivos remotos e IA na nuvem precisam de conexão.
4. No Chrome, Edge e outros navegadores com File System Access API, o primeiro salvamento pede um arquivo e os seguintes gravam nele. Outros navegadores baixam uma cópia. Exporte outros formatos em Arquivo → Baixar como. As cópias de recuperação no navegador são independentes do arquivo salvo.

## Por que funciona offline

- Recursos de edição em cache funcionam offline; arquivos remotos e IA na nuvem precisam de conexão.
- **PWA instalável** — coloque na tela de início ou na área de trabalho e abra como um aplicativo
- **Roda em qualquer lugar** — Chromebook, Windows, macOS, Linux, Android; qualquer navegador moderno
- Edite DOCX, XLSX, PPTX e CSV
- Na edição básica local: Sem upload, sem conta, sem cadastro

## Perguntas frequentes

### Funciona mesmo offline?

A edição offline depende de o navegador manter em cache o app, o motor, o conversor e as fontes e recursos de formato necessários. Uma visita ou a instalação da PWA não garante isso. URLs de arquivos remotos e IA na nuvem precisam de conexão; o WebLLM local precisa do modelo já disponível.

### Funciona num Chromebook?

Sim. Ele roda em qualquer navegador moderno — Chromebook, notebook, Windows, macOS, Linux e Android.

### Meus arquivos são enviados?

A abertura, edição e conversão básicas rodam localmente no navegador sem exigir o envio do documento. A IA na nuvem opcional pode enviar instruções e conteúdo obtido pelas ferramentas ao provedor escolhido. O WebLLM faz inferência local após baixar o modelo. O app que incorpora o editor pode receber arquivos exportados e enviá-los conforme sua própria política.

### Quais formatos posso editar?

DOCX, XLSX, PPTX e CSV, com o OnlyOffice.

### Como instalo como aplicativo?

Use o ícone de instalar na barra de endereços do Chrome ou do Edge, ou «Adicionar à tela de início» no celular ou tablet.

### Preciso estar online na primeira vez?

Abra o editor conectado e teste os formatos, fontes e exportações necessários. Depois desconecte e confira o mesmo fluxo antes de depender do modo offline.

### Onde meus arquivos são salvos quando estou offline?

No Chrome, Edge e outros navegadores com File System Access API, o primeiro salvamento pede um arquivo e os seguintes gravam nele. Outros navegadores baixam uma cópia. Exporte outros formatos em Arquivo → Baixar como. As cópias de recuperação no navegador são independentes do arquivo salvo. Com o salvamento automático ativado, cópias de recuperação ficam na IndexedDB deste navegador por 7 dias após a última edição ou abertura. Fechar a aba não as apaga. Em /history você pode excluir cópias ou desativar o salvamento automático. O navegador pode limpar ou remover seu armazenamento, e edições ainda não salvas podem se perder; a recuperação não substitui salvar o arquivo.

### O que fica depois de fechar a aba?

Com o salvamento automático ativado, cópias de recuperação ficam na IndexedDB deste navegador por 7 dias após a última edição ou abertura. Fechar a aba não as apaga. Em /history você pode excluir cópias ou desativar o salvamento automático. O navegador pode limpar ou remover seu armazenamento, e edições ainda não salvas podem se perder; a recuperação não substitui salvar o arquivo.

### Como a IA na nuvem e o app que incorpora o editor tratam os dados?

A IA na nuvem opcional pode enviar instruções e conteúdo obtido pelas ferramentas ao provedor escolhido. O WebLLM faz inferência local após baixar o modelo. O app que incorpora o editor pode receber arquivos exportados e enviá-los conforme sua própria política.
