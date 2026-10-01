---
title: 'Ayuda — usar el editor de documentos en línea'
description: 'Cómo abrir, editar, guardar y recuperar documentos; privacidad y requisitos sin conexión. Procesamiento de documentos sin servidor.'
eyebrow: Ayuda
breadcrumb: Ayuda
h1: Ayuda
lead: 'Edita archivos de Word, Excel y PowerPoint en el navegador, sin instalar Office ni crear una cuenta. Los documentos se procesan en tu dispositivo y el código está disponible para consultarlo.'
---

## Abrir y crear documentos

### ¿Qué formatos de archivo puedo abrir?

Word (`.docx`, el antiguo `.doc`), Excel (`.xlsx`, el antiguo `.xls`), PowerPoint (`.pptx`, el antiguo `.ppt`), valores separados por comas (`.csv`) y PDF (`.pdf`). Elige un archivo con **Abrir**, arrástralo a la página o pasa una URL con `/editor?file=https://…` / `/editor?src=https://…` (el servidor que aloja el archivo debe permitir peticiones de otro origen).

### ¿Cómo creo un documento nuevo?

Elige un nuevo archivo de Word, Excel o PowerPoint en la página de inicio. Edita el archivo en blanco y guárdalo en tu dispositivo.

### ¿Hay un límite de tamaño?

No hay límite fijo. El techo real es la memoria de tu dispositivo, porque todo el documento se analiza y se representa en local.

## Editar y guardar

### ¿Cómo guardo mis cambios?

En navegadores compatibles como Chrome y Edge, el primer guardado permite elegir un archivo; los siguientes lo actualizan. Otros navegadores descargan una copia. Para otro formato, usa Archivo → Descargar como. Las copias de recuperación no sustituyen guardar el archivo.

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

Las herramientas WebMCP editan y convierten localmente, pero un agente del navegador puede recibir texto o archivos exportados y enviarlos a su propio servicio de IA. Revisa su política de datos antes de compartir contenido confidencial.

### ¿Qué navegadores lo admiten?

WebMCP es una propuesta del W3C Web Machine Learning Community Group, disponible actualmente en Chrome tras una prueba de origen. Firefox y Safari no han anunciado soporte. Donde el navegador no ofrece la API, no se registra nada y nada cambia: es una adición pura.

### ¿Funciona en un editor integrado?

No, por diseño. Las herramientas solo se registran cuando el editor es la página de nivel superior. Un iframe de otro origen necesitaría que la página que lo integra concediera `allow="tools"`, lo que choca con el sentido de la integración: si integras el editor, contrólalo con la [Embed API](/es/help/embed-api).

### ¿Puede el agente leer el texto del documento?

En documentos de texto, sí: `get_document_text` devuelve el texto para que el agente pueda responder preguntas sobre el contenido sin exportar nada. Las hojas de cálculo y las presentaciones no exponen lectura de texto completo en este motor; la herramienta lo dice explícitamente (en vez de devolver una respuesta vacía que parecería un archivo vacío) y sugiere exportar.

## Sin conexión e instalación

### ¿Funciona sin conexión?

Conéctate primero, abre los archivos que necesitas y prueba la edición y la exportación. Luego desconéctate y comprueba los mismos pasos. Visitar la página de inicio o instalar la aplicación no garantiza todas las funciones sin conexión. Borrar los datos del navegador puede requerir otra conexión. Abrir archivos desde enlaces requiere conexión.

### ¿Cómo consigo la versión más reciente?

El sitio se actualiza solo en la siguiente visita. Si una página parece atascada en una versión antigua, recarga forzando (Ctrl+Mayús+R / ⌘⇧R) o anula el registro del service worker en la configuración del sitio en tu navegador.

## Privacidad

### ¿Mis documentos se suben a algún sitio?

Al editar archivos locales directamente en este sitio, los documentos se procesan en tu dispositivo y no se envían a nuestros servidores. El código es público. Si usas el editor desde otra web o permites que un asistente externo lea archivos, consulta su política de datos.

### ¿Qué carga la página desde la red?

La página carga código, recursos del editor, fuentes y una baliza de Cloudflare Web Analytics. Las URL remotas pueden generar solicitudes adicionales. Las aplicaciones anfitrionas y los agentes externos del navegador tienen sus propias políticas de datos.

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

### ¿Qué queda después de cerrar la pestaña?

Con el guardado automático activado, las copias de recuperación permanecen en este navegador durante 7 días desde la última edición o apertura. Puedes borrarlas o desactivar el guardado automático en /history. Los datos del navegador y los cambios aún no guardados pueden perderse; guarda los cambios importantes en un archivo.

### ¿Está disponible un asistente de IA integrado?

El asistente de IA integrado está sin terminar y no es una función publicada.
