---
title: 'Sobre — quem faz este editor e por quê'
description: 'Sobre este editor de código aberto, seus autores, código-fonte e tratamento de dados. Edição local sem envio obrigatório.'
eyebrow: Sobre
breadcrumb: Sobre
h1: Sobre este editor
lead: Quem faz isto, o que ele realmente faz — e como você pode verificar as duas coisas por conta própria.
---

## O que é isto

Um **editor de documentos de escritório dentro do navegador**. Você abre um arquivo do Word (DOCX), Excel (XLSX), PowerPoint (PPTX), CSV ou PDF e edita direto na aba.

A abertura, edição e conversão básicas rodam localmente no navegador sem exigir o envio do documento. O assistente de IA integrado ainda não está concluído e não é uma função publicada. O app que incorpora o editor pode receber arquivos exportados e enviá-los conforme sua própria política.

Com o salvamento automático ativado, cópias de recuperação ficam na IndexedDB deste navegador por 7 dias após a última edição ou abertura. Fechar a aba não as apaga. Em /history você pode excluir cópias ou desativar o salvamento automático. O navegador pode limpar ou remover seu armazenamento, e edições ainda não salvas podem se perder; a recuperação não substitui salvar o arquivo.

## Quem faz

Este site é desenvolvido e mantido por **ranuts**, o mesmo autor por trás da [conta `ranuts` no GitHub](https://github.com/ranuts) e das [bibliotecas de componentes e utilitários ran](https://ran.chaxus.com).

É um projeto pessoal de código aberto, não o produto de uma empresa. Não há equipe de vendas nem capital de risco por trás — e é por isso que também não há venda adicional, nem um "plano gratuito" que expira, nem razão para este site querer os seus arquivos.

## Como verificar tudo isso

Afirmações sobre privacidade são baratas. Estas são as formas de conferir por conta própria:

- **Leia o código.** Tudo é aberto sob **AGPL-3.0** em [github.com/ranuts/document](https://github.com/ranuts/document). A licença exige que qualquer versão modificada e hospedada também publique seu código.
- Confira no painel de rede a abertura, edição e salvamento de um arquivo local. Teste separadamente a IA opcional, URLs remotas e apps que incorporam o editor; suas requisições não fazem parte da edição básica local.
- Abra o editor conectado e teste os formatos, fontes e exportações necessários. Depois desconecte e confira o mesmo fluxo antes de depender do modo offline.
- **Hospede você mesmo.** O repositório traz o necessário para rodar sua própria cópia.

## Sobre o que é construído

O motor de edição é baseado no **ONLYOFFICE**, compilado para rodar no navegador. Este projeto envolve esse motor com uma camada pensada para o local: manipulação de arquivos, conversão de formatos, a camada offline, suporte a incorporação e a interface que você vê.

Construir sobre um motor existente é deliberado. Formatos de documento — sobretudo DOCX e XLSX — são especificações enormes e bagunçadas, e uma implementação do zero renderizaria seus arquivos sutilmente errados. Reaproveitar um motor maduro significa que **o que você vê no navegador corresponde ao que veria em outro lugar**.

## Limites que vale conhecer

Uma lista honesta, porque uma página que só lista virtudes não serve para nada:

- **Arquivos grandes dependem do seu aparelho.** Tudo roda no seu navegador, então uma planilha muito grande é limitada pela sua memória e CPU, não por um servidor que você possa pagar para ampliar.
- Na edição básica local: **Sem sincronização e sem colaboração.** Nenhum servidor guarda seu documento, o que também significa nada de coedição em tempo real nem sincronia entre dispositivos.
- **A fidelidade é muito boa, não perfeita.** Layouts complexos, fontes incomuns e macros podem diferir de uma suíte de desktop.

Se algum desses pontos importa mais para você do que manter o arquivo local, uma suíte hospedada é a ferramenta melhor — e essa é uma escolha razoável.

## Como falar com a gente

Relatos de bugs, problemas de formatação e pedidos de funcionalidade funcionam melhor como issues no GitHub, onde ficam públicos e rastreáveis. Veja [Contato](/pt/contact) para as formas de alcançar o projeto.
