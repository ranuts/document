---
title: Editor de documentos com WebMCP — agentes de IA do navegador conseguem usá-lo
description: Um editor de documentos que registra ferramentas WebMCP, para que um agente de IA do navegador possa abrir, ler, converter e exportar arquivos DOCX, XLSX, PPTX e PDF chamando-as diretamente. Tudo roda no seu dispositivo.
eyebrow: Para agentes do navegador · WebMCP
h1: Um editor de documentos que agentes do navegador conseguem usar de verdade
lead: Este editor registra ferramentas **WebMCP**, então um agente de IA rodando no seu navegador pode abrir, ler, converter e exportar documentos chamando-as — em vez de tentar clicar numa interface feita para pessoas.
cta: Abrir o editor →
ctaHref: /pt/
ogDescription: Agentes de IA do navegador podem abrir, ler, converter e exportar documentos aqui por ferramentas WebMCP. No dispositivo, sem upload.
breadcrumb: webmcp-document-editor
howTo: Como deixar um agente de IA do navegador trabalhar com seus documentos
appDescription: Um editor de documentos no navegador que expõe ferramentas WebMCP para agentes de IA do navegador; todo o processamento acontece no dispositivo.
---

## Como funciona

1. Use um navegador que ofereça a API WebMCP (Chrome, no origin trial).
2. Abra **o editor** como uma aba normal — as ferramentas só são registradas na página de nível superior.
3. Peça ao agente de IA do seu navegador para abrir, ler, converter ou exportar um documento.
4. O agente chama as ferramentas diretamente; o trabalho acontece no seu dispositivo e nada é enviado.

Para um agente de IA, a maioria dos apps web é opaca. Ele vê uma página de botões e precisa adivinhar qual converte um arquivo, torcendo para o clique acertar. O WebMCP — uma proposta do W3C Web Machine Learning Community Group — permite que uma página pule isso por completo, declarando o que sabe fazer como ferramentas estruturadas e chamáveis, com entradas tipadas. Este editor declara sete delas.

As ferramentas são open_document_url, open_document_buffer, create_document, save_document, get_document_text, set_readonly e get_document_state. Elas não são uma implementação à parte: chamam o mesmo código no dispositivo que os botões chamam, que é também o que a API de incorporação por iframe aciona. Assim o agente ganha exatamente as capacidades de uma pessoa, com a mesma garantia — o motor de conversão é WebAssembly rodando na sua aba, e o arquivo nunca sai do dispositivo.

É essa propriedade que torna o acesso de agentes razoável aqui. Entregar um documento a um agente costuma significar entregá-lo ao servidor com que esse agente conversa. Aqui o agente orquestra e o documento fica onde está: é lido do disco para a aba, convertido na aba e gravado de volta. Um agente que lê o texto de um contrato para responder a uma pergunta sobre ele não envia esse contrato para lugar nenhum.

Há dois limites deliberados. As ferramentas só são registradas quando o editor é a página de nível superior — um iframe de outra origem exigiria que a página incorporadora concedesse `allow="tools"`, o que conflita com o sentido da incorporação, então editores incorporados são controlados pela API postMessage. E a leitura do texto completo está disponível para documentos de texto; planilhas e apresentações não a expõem neste motor, então a ferramenta diz isso em vez de devolver uma resposta vazia que um agente poderia confundir com um arquivo vazio.

## Perguntas frequentes

### O que é WebMCP?

Uma proposta do W3C Web Machine Learning Community Group que permite a uma página registrar ferramentas estruturadas que um agente de IA do navegador pode chamar diretamente, em vez de ter que interpretar e clicar na interface.

### Quais ferramentas este editor registra?

Sete: open_document_url, open_document_buffer, create_document, save_document, get_document_text, set_readonly e get_document_state. Elas cobrem abrir a partir de uma URL ou de bytes, criar um documento novo, exportar ou converter, ler o texto, alternar somente leitura e informar o estado atual.

### Quais navegadores dão suporte?

O WebMCP está disponível no Chrome atrás de um origin trial. Firefox e Safari não anunciaram suporte. Onde a API não existe, nada é registrado e nada muda.

### Meu documento é enviado quando um agente trabalha nele?

Não. As ferramentas chamam o mesmo código no dispositivo que a interface chama — o motor de conversão é WebAssembly na aba do seu navegador, e o arquivo nunca sai do dispositivo.

### Um agente pode ler o conteúdo do meu documento?

Em documentos de texto, get_document_text devolve o texto para o agente responder perguntas sem exportar nada. Planilhas e apresentações não têm leitura de texto completo neste motor, e a ferramenta informa isso em vez de devolver uma resposta vazia.

### Funciona quando o editor está incorporado em outro site?

Não, por design. As ferramentas só são registradas na página de nível superior. Editores incorporados são controlados pela Embed API por postMessage.

### Um agente pode converter um arquivo em PDF?

Sim. save_document recebe um formato de destino, então um agente pode abrir um DOCX, XLSX ou PPTX e exportar um PDF, tudo no dispositivo.

### Preciso de conta ou de uma chave de API?

De nenhuma das duas. O editor não precisa de conta e não chama nenhum serviço de IA por conta própria — o raciocínio é do agente do seu navegador, e esta página só expõe as ferramentas.
