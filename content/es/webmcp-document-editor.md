---
title: Editor de documentos con WebMCP — los agentes de IA del navegador pueden usarlo
description: Un editor de documentos que registra herramientas WebMCP, para que un agente de IA del navegador pueda abrir, leer, convertir y exportar archivos DOCX, XLSX, PPTX y PDF llamándolas directamente. Todo se ejecuta en tu dispositivo.
eyebrow: Para agentes del navegador · WebMCP
h1: Un editor de documentos que los agentes del navegador sí pueden usar
lead: Este editor registra herramientas **WebMCP**, de modo que un agente de IA que se ejecute en tu navegador puede abrir, leer, convertir y exportar documentos llamándolas, en lugar de intentar hacer clic en una interfaz pensada para personas.
cta: Abrir el editor →
ctaHref: /es/
ogDescription: Los agentes de IA del navegador pueden abrir, leer, convertir y exportar documentos aquí mediante herramientas WebMCP. En el dispositivo, sin subidas.
breadcrumb: webmcp-document-editor
howTo: Cómo dejar que un agente de IA del navegador trabaje con tus documentos
appDescription: Un editor de documentos en el navegador que expone herramientas WebMCP para agentes de IA del navegador; todo el procesamiento ocurre en el dispositivo.
---

## Cómo funciona

1. Usa un navegador que ofrezca la API WebMCP (Chrome, dentro de su prueba de origen).
2. Abre **el editor** como una pestaña normal: las herramientas solo se registran en la página de nivel superior.
3. Pide al agente de IA de tu navegador que abra, lea, convierta o exporte un documento.
4. El agente llama a las herramientas directamente; el trabajo ocurre en tu dispositivo y no se sube nada.

Para un agente de IA, la mayoría de las aplicaciones web son opacas. Ve una página de botones y tiene que adivinar cuál convierte un archivo, y luego confiar en que el clic haya acertado. WebMCP — una propuesta del W3C Web Machine Learning Community Group — permite a una página saltarse eso por completo declarando lo que sabe hacer como herramientas estructuradas y llamables, con entradas tipadas. Este editor declara siete.

Las herramientas son open_document_url, open_document_buffer, create_document, save_document, get_document_text, set_readonly y get_document_state. No son una implementación aparte: llaman al mismo código en el dispositivo que llaman los botones, que es también el que controla la API de integración por iframe. Así, un agente obtiene exactamente las capacidades de una persona, con la misma garantía: el motor de conversión es WebAssembly ejecutándose en tu pestaña, y el archivo nunca sale del dispositivo.

Esa propiedad es lo que hace razonable el acceso de agentes aquí. Entregar un documento a un agente suele significar entregarlo al servidor con el que ese agente habla. Aquí el agente orquesta y el documento se queda donde está: se lee del disco a la pestaña, se convierte en la pestaña y se vuelve a escribir. Un agente que lee el texto de un contrato para responder una pregunta sobre él no sube ese contrato a ninguna parte.

Hay dos límites deliberados. Las herramientas solo se registran cuando el editor es la página de nivel superior: un iframe de otro origen necesitaría que la página que lo integra concediera `allow="tools"`, lo que choca con el sentido de la integración, así que los editores integrados se controlan con la API postMessage. Y la lectura del texto completo está disponible para documentos de texto; las hojas de cálculo y las presentaciones no la exponen en este motor, así que la herramienta lo dice en lugar de devolver una respuesta vacía que un agente podría confundir con un archivo vacío.

## Preguntas frecuentes

### ¿Qué es WebMCP?

Una propuesta del W3C Web Machine Learning Community Group que permite a una página web registrar herramientas estructuradas que un agente de IA del navegador puede llamar directamente, en lugar de tener que interpretar y pulsar la interfaz.

### ¿Qué herramientas registra este editor?

Siete: open_document_url, open_document_buffer, create_document, save_document, get_document_text, set_readonly y get_document_state. Cubren abrir desde una URL o desde bytes, crear un documento nuevo, exportar o convertir, leer el texto, alternar el modo de solo lectura e informar del estado actual.

### ¿Qué navegadores lo admiten?

WebMCP está disponible en Chrome tras una prueba de origen. Firefox y Safari no han anunciado soporte. Donde la API no existe, no se registra nada y nada cambia.

### ¿Se sube mi documento cuando un agente trabaja con él?

No. Las herramientas llaman al mismo código en el dispositivo que llama la interfaz: el motor de conversión es WebAssembly en la pestaña de tu navegador, y el archivo nunca sale de tu dispositivo.

### ¿Puede un agente leer el contenido de mi documento?

En documentos de texto, get_document_text devuelve el texto para que el agente pueda responder preguntas sin exportar nada. Las hojas de cálculo y las presentaciones no tienen lectura de texto completo en este motor, y la herramienta lo indica en lugar de devolver una respuesta vacía.

### ¿Funciona cuando el editor está integrado en otro sitio?

No, por diseño. Las herramientas solo se registran en la página de nivel superior. Los editores integrados se controlan con la Embed API por postMessage.

### ¿Puede un agente convertir un archivo a PDF?

Sí. save_document acepta un formato de destino, así que un agente puede abrir un DOCX, XLSX o PPTX y exportar un PDF, todo en el dispositivo.

### ¿Necesito una cuenta o una clave de API?

Ninguna de las dos. El editor no necesita cuenta y no llama por sí mismo a ningún servicio de IA: el razonamiento lo hace el agente de tu navegador, y esta página solo expone las herramientas.
