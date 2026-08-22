---
title: Integrar un editor de documentos en tu web — iframe + API postMessage
description: Integra un editor de DOCX, XLSX, PPTX y CSV en tu aplicación web con un iframe y una API postMessage. La autenticación y los archivos se quedan en tu app: el editor nunca ve tus tokens. Código abierto (AGPL-3.0), autoalojable, marca blanca.
eyebrow: Desarrolladores · Integración
h1: Integrar un editor de documentos en tu aplicación web
lead: 'Añade a tu producto un editor de **DOCX, XLSX, PPTX y CSV** con un solo iframe y una API **postMessage**. Tu aplicación conserva la autenticación, el acceso a los archivos y la subida; el editor solo edita, y nunca ve los tokens de tus usuarios.'
cta: Abrir la demo en vivo →
ctaHref: /embed-demo.html
ogDescription: Añade un editor de DOCX/XLSX/PPTX/CSV a tu app con un iframe. La auth se queda en tu app; el editor nunca ve tus tokens. Código abierto y autoalojable.
breadcrumb: Embed Document Editor
howTo: Cómo integrar un editor de documentos en tu web
appDescription: Un editor de documentos en el navegador que se integra en tu propia aplicación web mediante un iframe y una API postMessage.
---

El editor se ejecuta por completo en el navegador con el motor WebAssembly de OnlyOffice, así que los documentos se representan y se editan en el cliente: no levantas ningún servidor de documentos. El patrón recomendado mantiene una frontera limpia: **la aplicación padre se encarga de la autenticación, la obtención y el guardado; el iframe se encarga solo de editar.** Los tokens, las cookies y las API de negocio se quedan en tu app.

## Añádelo con un iframe

```html
<iframe
  id="documentEditor"
  src="https://edit.chaxus.com/editor?embed=1&embedOrigin=https://your-app.example.com"
  style="width: 100%; height: 720px; border: 0"
></iframe>
```

Después háblale por `postMessage`. Cada comando lleva un `id` para que puedas emparejarlo con la respuesta, y cada evento del editor es un mensaje `document:*`:

```js
// abre un archivo que tu app ya ha obtenido (la auth se queda contigo)
iframe.contentWindow.postMessage(
  { id, type: 'document:open-buffer', payload: { fileName: 'report.xlsx', buffer } },
  'https://edit.chaxus.com',
);

// pide de vuelta el archivo editado y súbelo tú
iframe.contentWindow.postMessage({ id, type: 'document:save', payload: { targetExt: 'XLSX' } }, editorOrigin);
// → el editor responde con { type: 'document:saved', payload: { fileName, file } }
```

## Qué obtienes

- Un iframe y una pequeña API **postMessage** de comando y respuesta: no hay SDK que instalar
- Abrir desde una **URL, un File o un ArrayBuffer** que tu app haya obtenido con sus propias credenciales
- Guardar de vuelta a **XLSX, DOCX, PPTX o CSV**, devuelto como un `File` para que tu app lo suba
- Modo de solo lectura, bloqueo de origen por mensaje (`embedOrigin`) y una consulta de estado
- Ningún servidor de documentos que operar: la edición es 100% WebAssembly en el cliente
- Código abierto (AGPL-3.0) y autoalojable: intégralo bajo tu propio dominio

## Cómo funciona

1. Añade el iframe apuntando a `/editor?embed=1`, con el tamaño que encaje en tu diseño.
2. Espera al evento `document:ready` y envía entonces `document:open-url`, `open-file` u `open-buffer`.
3. La persona edita ahí mismo; el archivo no sale del navegador salvo que tu app lo envíe a algún sitio.
4. Envía `document:save`; el editor devuelve el archivo editado en `document:saved`, y tu app lo sube con su propia autenticación.

## Solo lectura y modo vista previa

Abre un documento en solo lectura (un visor, un paso de revisión, un registro bloqueado) pasando `readonly: true` con el comando de apertura, y cambia cuando quieras con `document:set-readonly`: sin recargar, y el documento se queda donde estaba la persona. En modo de solo lectura la edición se desactiva y `document:save` responde con `document:error`; `document:get-state` informa del valor actual de `readonly`.

```js
// ábrelo bloqueado, desbloquéalo después
send('document:open-url', { url, readonly: true });
send('document:set-readonly', { readonly: false });
```

## Preguntas frecuentes

### ¿Cómo integro el editor de documentos?

Añade un iframe apuntando a `/editor?embed=1` y contrólalo con la API postMessage para abrir y guardar documentos. Tienes una demo funcionando en [/embed-demo.html](/embed-demo.html).

### ¿El editor ve los tokens de autenticación de mis usuarios?

No. La autenticación, la obtención del archivo y la subida se quedan en tu app: tu aplicación obtiene el archivo con sus credenciales y pasa los bytes al editor, así que los tokens y las cookies nunca entran en el iframe.

### ¿Qué formatos admite el editor integrado?

DOCX, XLSX, PPTX y CSV, editados en el cliente con el motor WebAssembly de OnlyOffice. El comando de guardado exporta a XLSX, DOCX, PPTX o CSV.

### ¿Puedo autoalojarlo o usarlo en marca blanca?

Sí. Es código abierto bajo AGPL-3.0 y se distribuye como archivos estáticos, así que puedes alojar tu propia copia e integrarlo bajo tu dominio.

### ¿Cómo restrinjo qué sitio puede hablar con el editor?

Añade `embedOrigin` a la URL del iframe para limitar los mensajes a un origen concreto, y verifica también `event.origin` en tu propio manejador de mensajes.

### ¿Puedo mostrar un documento en solo lectura, o bloquearlo más tarde?

Sí. Pasa `readonly: true` al abrirlo, o envía `document:set-readonly` cuando quieras: cambia el editor en vivo sin recargar, y los guardados se rechazan mientras está bloqueado.
