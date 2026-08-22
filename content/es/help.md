---
title: Ayuda — usar el editor de documentos en línea
description: Cómo abrir, editar y guardar archivos de Word, Excel, PowerPoint, CSV y PDF en el navegador sin subirlos; solo lectura e integración, uso sin conexión, límites de privacidad, códigos de error y autoalojamiento.
eyebrow: Ayuda
breadcrumb: Ayuda
h1: Ayuda
lead: Respuestas prácticas para usar el editor. Todo se ejecuta dentro de la pestaña de tu navegador; tus archivos nunca se suben.
---

## Abrir y crear documentos

### ¿Qué formatos de archivo puedo abrir?

Word (`.docx`, el antiguo `.doc`), Excel (`.xlsx`, el antiguo `.xls`), PowerPoint (`.pptx`, el antiguo `.ppt`), valores separados por comas (`.csv`) y PDF (`.pdf`). Elige un archivo con **Abrir**, arrástralo a la página o pasa una URL con `/editor?file=https://…` / `/editor?src=https://…` (el servidor que aloja el archivo debe permitir peticiones de otro origen).

### ¿Cómo creo un documento nuevo?

Usa **Nuevo Word / Nuevo Excel / Nuevo PowerPoint** en la página de inicio, o abre directamente `/editor?new=docx`, `/editor?new=xlsx`, `/editor?new=pptx`. No se crea nada en ningún servidor: el documento en blanco existe solo en tu pestaña hasta que lo descargas.

### ¿Hay un límite de tamaño?

No hay límite fijo. El techo real es la memoria de tu dispositivo, porque todo el documento se analiza y se representa en local.

## Editar y guardar

### ¿Cómo guardo mis cambios?

Pulsa **Ctrl+S / ⌘S** o usa **Archivo → Descargar como**. Como no hay servidor, «guardar» significa que el navegador te entrega el archivo: aterriza en tu carpeta de descargas con el nombre original. Elige otro formato en **Descargar como** para convertir (por ejemplo DOCX → PDF, XLSX → CSV).

### ¿Por qué a veces el botón Guardar está en gris?

Se activa cuando el editor ha cargado el documento por completo y has hecho algún cambio. Si sigue en gris después de editar, el documento no terminó de cargarse: mira la notificación por si hay un error y consulta más abajo la sección de códigos de error.

### ¿Puedo convertir entre formatos?

Sí, en tu dispositivo: abre un documento y elige el formato de destino en **Descargar como**. Los documentos de Word exportan a DOCX / PDF / TXT, las hojas de cálculo a XLSX / CSV / PDF y las presentaciones a PPTX / PDF. Los archivos CSV se abren como hoja de cálculo y se pueden guardar de vuelta como CSV.

### Mi CSV con acentos o caracteres chinos se ve mal en otras herramientas. ¿Y aquí?

El editor detecta la codificación del CSV antes de abrirlo — primero UTF-8 estricto, después GB18030 (la codificación «ANSI» que usa Excel en las exportaciones en chino) y por último Latin-1 —, así que los archivos que se ven rotos en otras herramientas aquí se abren bien. Al guardar se escribe UTF-8 con marca de orden de bytes, que Excel abre sin asistente.

## PDF

### ¿Qué puedo hacer con un PDF?

Abrirlo y leerlo (desplazarte, hacer zoom, buscar), añadir comentarios y anotaciones de texto libre, y volver a descargarlo como un PDF que las conserva. Los formularios rellenables se pueden rellenar.

### ¿Puedo reescribir el texto de un PDF existente como en un documento de Word?

No como texto que fluye libremente: el PDF es un formato de maquetación fija. Para cambiar la redacción, abre el DOCX / XLSX / PPTX original y exporta un PDF nuevo. Ambos pasos ocurren en tu dispositivo.

## Solo lectura e integración

### ¿Puedo abrir un documento en solo lectura?

Sí. Añade `&readonly=1` a un enlace `/editor?file=`, o envía `document:set-readonly` a través de la API de integración. El modo de solo lectura se puede activar y desactivar en caliente sin recargar el documento.

### ¿Puedo poner el editor dentro de mi propia aplicación web?

Sí: el editor está pensado para integrarse en un iframe y controlarse con `postMessage`. Tu página obtiene el archivo (con su propia autenticación), lo envía al iframe y recibe de vuelta el `File` editado para subirlo donde quieras. Consulta la [referencia de la Embed API](/es/help/embed-api) y la [demo en vivo](/embed-demo.html).

## Agentes de IA del navegador (WebMCP)

### ¿Puede un asistente de IA de mi navegador manejar el editor?

Sí, donde el navegador lo admita. El editor registra un conjunto de herramientas WebMCP, de modo que un agente de IA del navegador puede abrir, convertir, leer y exportar documentos llamándolas directamente en vez de hacer clic por la interfaz. Todo sigue ejecutándose en tu dispositivo: el agente dispara el mismo código local que los botones, y no se sube nada.

Las herramientas son `open_document_url`, `open_document_buffer`, `create_document`, `save_document`, `get_document_text`, `set_readonly` y `get_document_state`.

### ¿Qué navegadores lo admiten?

WebMCP es una propuesta del W3C Web Machine Learning Community Group, disponible actualmente en Chrome tras una prueba de origen. Firefox y Safari no han anunciado soporte. Donde el navegador no ofrece la API, no se registra nada y nada cambia: es una adición pura.

### ¿Funciona en un editor integrado?

No, por diseño. Las herramientas solo se registran cuando el editor es la página de nivel superior. Un iframe de otro origen necesitaría que la página que lo integra concediera `allow="tools"`, lo que choca con el sentido de la integración: si integras el editor, contrólalo con la [Embed API](/es/help/embed-api).

### ¿Puede el agente leer el texto del documento?

En documentos de texto, sí: `get_document_text` devuelve el texto para que el agente pueda responder preguntas sobre el contenido sin exportar nada. Las hojas de cálculo y las presentaciones no exponen lectura de texto completo en este motor; la herramienta lo dice explícitamente (en vez de devolver una respuesta vacía que parecería un archivo vacío) y sugiere exportar.

## Sin conexión e instalación

### ¿Funciona sin conexión?

Sí. Tras la primera visita, un service worker guarda el editor en caché; puedes instalarlo como aplicación desde la barra de direcciones del navegador (PWA) y abrir documentos sin conexión. La primera vez que abres un documento con muchas fuentes, aún hace falta la red una vez para descargarlas; después también quedan en caché.

### ¿Cómo consigo la versión más reciente?

El sitio se actualiza solo en la siguiente visita. Si una página parece atascada en una versión antigua, recarga forzando (Ctrl+Mayús+R / ⌘⇧R) o anula el registro del service worker en la configuración del sitio en tu navegador.

## Privacidad

### ¿Mis documentos se suben a algún sitio?

No. El documento se lee desde tu disco a la pestaña del navegador y se procesa ahí con WebAssembly. En este sitio no hay ningún punto final de subida. Puedes comprobarlo en el panel de red del navegador mientras abres y guardas un documento, y el código es abierto bajo AGPL-3.0.

### ¿Qué carga la página desde la red?

Solo la propia aplicación: el JavaScript del editor, el conversor WebAssembly, las fuentes y los recursos de la página, todo desde el origen de este sitio, además de una baliza de Cloudflare Web Analytics respetuosa con la privacidad (sin cookies, sin rastreo entre sitios). Si activas el asistente de IA opcional con tu propia clave de API, sus peticiones van directamente desde tu navegador al proveedor que elijas; nada pasa por este sitio.

## Errores

### ¿Qué significan los códigos de error de la notificación?

- **-85**: el contenido del archivo no coincide con su extensión (por ejemplo, una página HTML guardada como `.xls`, o un `.docx` que en realidad es un `.doc`). Renómbralo o vuelve a exportarlo.
- **-82**: el archivo no se pudo convertir; puede estar dañado, protegido con contraseña o en una variante que el motor no admite.
- **-24 / -25**: falló la carga de un script del editor, normalmente por un corte de red o una versión antigua en caché. Recarga forzando e inténtalo de nuevo.
- **80**: falló la exportación dentro del conversor. Prueba otro formato de destino; si persiste, abre una incidencia indicando el tipo de archivo y los pasos.

### Algo parece roto. ¿Dónde lo comunico?

Abre una incidencia en [GitHub](https://github.com/ranuts/document/issues) indicando el navegador y su versión, el tipo de archivo y —si no es confidencial— un archivo que reproduzca el problema. Una reproducción mínima vale más que una descripción.

## Autoalojamiento

### ¿Puedo ejecutar mi propia copia?

Sí. Es un sitio estático, así que sirve cualquier servidor web: `docker run -d -p 8080:80 ghcr.io/ranuts/document:latest`, o compílalo con `pnpm run build` y sirve la carpeta `dist/`. En el [README](https://github.com/ranuts/document#readme) están las opciones de HTTPS y autenticación básica, y en las [novedades](/es/changelog) lo que cambió en cada versión.
