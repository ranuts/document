---
title: 'Ayuda — usar el editor de documentos en línea'
description: 'Cómo abrir, editar, guardar y recuperar documentos; privacidad y requisitos sin conexión. Edición local sin subidas obligatorias.'
eyebrow: Ayuda
breadcrumb: Ayuda
h1: Ayuda
lead: 'Abre, visualiza y edita DOCX, XLSX, PPTX y CSV en el navegador sin Office ni cuenta. La edición básica no exige subir documentos; el uso sin conexión depende de los recursos en caché.'
---

## Abrir y crear documentos

### ¿Qué formatos de archivo puedo abrir?

Word (`.docx`, el antiguo `.doc`), Excel (`.xlsx`, el antiguo `.xls`), PowerPoint (`.pptx`, el antiguo `.ppt`), valores separados por comas (`.csv`) y PDF (`.pdf`). Elige un archivo con **Abrir**, arrástralo a la página o pasa una URL con `/editor?file=https://…` / `/editor?src=https://…` (el servidor que aloja el archivo debe permitir peticiones de otro origen).

### ¿Cómo creo un documento nuevo?

La apertura, edición y conversión básicas se ejecutan localmente en el navegador sin exigir subir el documento. Con el guardado automático activado, las copias de recuperación permanecen en la IndexedDB de este navegador durante 7 días desde la última edición o apertura. Cerrar la pestaña no las elimina. En /history puedes borrar copias o desactivar el guardado automático. El navegador puede borrar o desalojar su almacenamiento y perder cambios aún no guardados; la recuperación no sustituye guardar el archivo.

### ¿Hay un límite de tamaño?

No hay límite fijo. El techo real es la memoria de tu dispositivo, porque todo el documento se analiza y se representa en local.

## Editar y guardar

### ¿Cómo guardo mis cambios?

En Chrome, Edge y otros navegadores con File System Access API, el primer guardado permite elegir un archivo y los siguientes escriben en él. Otros navegadores descargan una copia. Exporta otros formatos desde Archivo → Descargar como. Las copias de recuperación del navegador son independientes del archivo guardado.

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

## Sin conexión e instalación

### ¿Funciona sin conexión?

La edición sin conexión requiere que el navegador conserve en caché la aplicación, el motor, el conversor y las fuentes y recursos de formato necesarios. Una visita o la instalación de la PWA no lo garantiza. Las URL de archivos remotos necesitan conexión.

### ¿Cómo consigo la versión más reciente?

El sitio se actualiza solo en la siguiente visita. Si una página parece atascada en una versión antigua, recarga forzando (Ctrl+Mayús+R / ⌘⇧R) o anula el registro del service worker en la configuración del sitio en tu navegador.

## Privacidad

### ¿Mis documentos se suben a algún sitio?

La apertura, edición y conversión básicas se ejecutan localmente en el navegador sin exigir subir el documento. El asistente de escritura solo envía texto al destino que elijas: un servicio en tu propio equipo lo mantiene en el dispositivo, mientras que un endpoint en la nube configurado con tu propia clave de API recibe el texto seleccionado y tu instrucción. La aplicación anfitriona puede recibir archivos exportados y subirlos según su propia política.

### ¿Qué carga la página desde la red?

La página carga código, recursos del editor, fuentes y una baliza de Cloudflare Web Analytics. Las URL remotas pueden generar solicitudes adicionales. Si configuras un destino de escritura, la solicitud de escritura también va a la dirección que muestra la configuración del asistente. Las aplicaciones anfitrionas y los agentes externos del navegador tienen sus propias políticas de datos. Sin conexión no se puede acceder a un destino de escritura en la nube; en ese caso la escritura necesita un destino en este dispositivo.

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

Con el guardado automático activado, las copias de recuperación permanecen en la IndexedDB de este navegador durante 7 días desde la última edición o apertura. Cerrar la pestaña no las elimina. En /history puedes borrar copias o desactivar el guardado automático. El navegador puede borrar o desalojar su almacenamiento y perder cambios aún no guardados; la recuperación no sustituye guardar el archivo.

### ¿Está disponible un asistente de IA integrado?

Desactivado por defecto · Solo este navegador. [Cómo usarlo](/es/ai-document-assistant). La aplicación anfitriona puede recibir archivos exportados y subirlos según su propia política.

## Asistente de documentos con IA

Describe lo que necesitas: consultar contenido, trabajar con texto u organizar datos. Revisa los cambios antes de aplicarlos.

PDF: consulta, resume o traduce texto seleccionable de la página actual, o añade una nota a una página concreta. Se lee la página actual, no todo el PDF. No se reconoce texto en imágenes escaneadas; se indica cuando el texto no está disponible. Las notas se adjuntan a la página y no reescriben el texto del PDF. Para cambiar la distribución del texto, usa el Word original. [Guía del asistente de IA](/es/ai-document-assistant).
