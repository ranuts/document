# Editor de documentos en línea

<p align="center">
  <a href="https://github.com/ranuts/document/actions/workflows/ci.yml">
    <img src="https://github.com/ranuts/document/actions/workflows/ci.yml/badge.svg" alt="CI Status">
  </a>
  <a href="https://github.com/ranuts/document/blob/main/LICENSE">
    <img src="https://img.shields.io/github/license/ranuts/document" alt="License">
  </a>
  <a href="https://github.com/ranuts/document/releases">
    <img src="https://img.shields.io/github/v/release/ranuts/document" alt="Version">
  </a>
  <a href="https://edit.chaxus.com/">
    <img src="https://img.shields.io/badge/Live-edit.chaxus.com-brightgreen" alt="Live site">
  </a>
  <a href="#asistente-de-documentos-con-ia-experimental-beta">
    <img src="https://img.shields.io/badge/AI_Assistant-Experimental_Beta-orange" alt="AI Assistant: Experimental Beta">
  </a>
</p>
<p align="center">
  <a href="readme.md">English</a> |
  <a href="readme.zh.md">简体中文</a> |
  <a href="readme.ja.md">日本語</a> |
  <a href="readme.ko.md">한국어</a> |
  <a href="readme.de.md">Deutsch</a> |
  <b>Español</b> |
  <a href="readme.pt.md">Português</a> |
  <a href="readme.fa.md">فارسی</a>
</p>

Edita archivos de Word, Excel y PowerPoint, y anota PDF directamente en el navegador. No necesitas instalar Office ni crear una cuenta. La edición y conversión se realizan localmente; puedes activar el asistente experimental de IA cuando lo necesites.

**Sitio en línea: [edit.chaxus.com](https://edit.chaxus.com/)**

---

## ✨ Características

- 🔒 **Edición local** — la conversión, edición y exportación se realizan en el navegador; tú eliges dónde se procesan las solicitudes opcionales de IA
- 📝 **Edición de verdad, no una vista previa** — DOCX, XLSX, PPTX y CSV, además de ODF, RTF, TXT y los antiguos formatos binarios; los PDF se abren y se pueden anotar
- 🕓 **Retoma tu trabajo** — las copias de recuperación locales ayudan a reabrir las ediciones recientes; se conservan 7 días y puedes borrarlas cuando quieras ([detalles](#-edición-local-y-tratamiento-de-datos))
- 📴 **Funciona sin conexión** — se instala como PWA; los recursos del editor en caché se reutilizan sin conexión; los recursos no almacenados y archivos remotos requieren red
- 🌍 **Multilingüe** — 7 idiomas de interfaz para el sitio y 45 para el editor
- 🧩 **Integrable** — API completa de postMessage para integrarlo en un iframe
- ✨ **Asistente de documentos con IA (Experimental Beta)** — Redacta textos, trabaja con tablas, crea diapositivas y pregunta sobre PDF con un modelo local o tu propio servicio de IA.
- 🤖 **Preparado para agentes** — expone herramientas WebMCP para que un agente de IA del navegador abra, convierta y lea documentos
- 🚀 **Se despliega en cualquier sitio** — una compilación estática; una carpeta de archivos detrás de cualquier servidor web

---

## Asistente de documentos con IA (Experimental Beta)

Describe lo que necesitas y comprueba el resultado en el documento. Redacta un texto, rellena una columna, crea una diapositiva o pregunta sobre la página actual de un PDF. Revisa o cancela las propuestas; puedes deshacer los cambios aplicados.

**Todavía experimental.** Las respuestas y los cambios pueden ser incorrectos. Comprueba los resultados importantes. El asistente está desactivado por defecto. Elige un modelo local o conecta tu propio servicio de IA. Los servicios externos reciben el contenido necesario para tu solicitud.

| Word                                                                                                                                                         | Excel                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [![Word: draft, insert and undo](docs/media/ai-demos/word-ai.jpg)](https://github.com/user-attachments/assets/97bf02e6-293c-44e3-b042-4334e03a7db5)          | [![Excel: fill cells and calculate](docs/media/ai-demos/excel-ai.jpg)](https://github.com/user-attachments/assets/fc68c9d5-4cb5-4a80-a29d-46665af1a409)  |
| PowerPoint                                                                                                                                                   | PDF                                                                                                                                                      |
| [![PowerPoint: review and create a slide](docs/media/ai-demos/pptx-ai.jpg)](https://github.com/user-attachments/assets/c8dda2cc-80f1-4c12-acc2-80469bd41007) | [![PDF: read a page and review a note](docs/media/ai-demos/pdf-ai.jpg)](https://github.com/user-attachments/assets/25355bc0-57cb-4a3d-a465-87dff2b68b4e) |

Los vídeos están en inglés y se han vuelto a grabar con Qwen3 4B local e información ficticia. Se omite la preparación del modelo y se acortan las esperas. La velocidad real depende del modelo y del dispositivo.

[Vídeos, subtítulos en inglés y descripciones](docs/media/ai-demos/README.md)

La asistencia para PDF usa el texto seleccionable de la página actual y notas de página. No reconoce el texto de imágenes escaneadas ni reescribe el cuerpo del PDF.

---

## 🚀 Empezar

**Usarlo tal cual:** [edit.chaxus.com](https://edit.chaxus.com/) — nada que instalar.

**Alojarlo tú con Docker:**

```bash
docker run -d --name document -p 8080:80 ghcr.io/ranuts/document:latest
```

**Ejecutarlo desde el código:**

```bash
git clone https://github.com/ranuts/document.git
cd document
pnpm install
pnpm run dev
```

---

## 📄 Formatos

| Tipo             | Editar                     | También abre                |
| ---------------- | -------------------------- | --------------------------- |
| Documentos       | `.docx`                    | `.doc` `.odt` `.rtf` `.txt` |
| Hojas de cálculo | `.xlsx` `.csv`             | `.xls` `.ods`               |
| Presentaciones   | `.pptx`                    | `.ppt` `.odp`               |
| PDF              | anotar, rellenar, exportar | `.pdf`                      |

Todos ellos se pueden exportar a PDF. El CSV mantiene su codificación al salir (al abrirlo
se detectan UTF-8, GB18030 y Latin-1).

---

## 🔗 Rutas y parámetros de URL

| Ruta                  | Qué es                                                        |
| --------------------- | ------------------------------------------------------------- |
| `/`                   | Página de inicio. No se carga el editor hasta que abres algo. |
| `/editor`             | El editor.                                                    |
| `/history`            | Documentos que guarda este navegador (más abajo).             |
| `/help`, `/changelog` | Se generan a partir del markdown de `content/`.               |

Parámetros de `/editor`:

| Parámetro    | Descripción                                                                                                                            |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| `src=<url>`  | Abrir un documento desde una URL (esa URL debe permitir CORS)                                                                          |
| `file=<url>` | Lo mismo, en la grafía antigua; si están los dos, gana este                                                                            |
| `new=docx`   | Empezar un documento en blanco (`docx`, `xlsx`, `pptx`)                                                                                |
| `doc=<id>`   | Reabrir un documento del historial de este navegador: el editor pone aquí su propio id, así que al recargar vuelves al mismo documento |
| `readonly=1` | Abrir solo para ver: la edición y la exportación quedan deshabilitadas                                                                 |
| `embed=1`    | Modo integrado; la página anfitriona maneja el editor por postMessage                                                                  |
| `locale=es`  | Idioma de la interfaz                                                                                                                  |

---

## 🔐 Edición local y tratamiento de datos

La edición y la conversión se realizan localmente. Solo quedan dos cosas guardadas en local, y las
dos puedes borrarlas tú:

- **Copias de lo que has editado.** Mientras trabajas, el editor guarda el documento en este
  navegador (IndexedDB) para que recargar, cerrar una pestaña o un fallo no te cuesten el
  trabajo. Al volver a abrir el editor te lo ofrece de nuevo. Estas copias existen para que
  puedas retomar lo que estabas haciendo: no son una copia de seguridad, así que sigue
  exportando lo que quieras conservar.
- **Siete días y desaparecen.** Cada documento se borra automáticamente siete días después
  de la última vez que lo editaste o lo abriste, vuelvas o no.

[`/history`](https://edit.chaxus.com/history) muestra lo que hay guardado, con un botón de
borrar en cada fila, otro para borrarlo todo y un interruptor para desactivar por completo
el guardado automático. Borrar ahí surte efecto de inmediato. En un ordenador compartido,
esa es la página a la que ir.

El asistente de IA está desactivado por defecto. Con un modelo local, el contenido permanece en tu dispositivo. Si conectas tu propio servicio de IA, el contenido necesario para la solicitud se envía a ese servicio. El dictado del navegador puede usar un servicio de reconocimiento de voz en línea. En modo integrado, los archivos exportados vuelven a la aplicación anfitriona, que controla las subidas posteriores.

---

## 🧩 Integración mediante iframe

Integra el editor y manéjalo por postMessage. El reparto habitual: tu sistema se encarga de
la autenticación y el almacenamiento, y el iframe de la edición.

```html
<iframe
  id="documentEditor"
  src="https://your-deployment/editor?embed=1"
  style="width: 100%; height: 720px; border: 0"
></iframe>
```

```js
// Abrir un documento
iframe.contentWindow.postMessage(
  { id: '1', type: 'document:open-url', payload: { url: 'https://example.com/doc.xlsx' } },
  'https://your-deployment',
);

// Escuchar el resultado
window.addEventListener('message', (e) => {
  if (e.data?.type === 'document:opened') console.log('Listo para editar');
  if (e.data?.type === 'document:saved') uploadFile(e.data.payload.file);
});
```

Los editores integrados no guardan historial local: el documento es de la página anfitriona.

→ **[Referencia completa de la API](docs/embed-api.md)** — todos los tipos de mensaje, la
lista de orígenes permitidos, el modo de solo lectura y el flujo de guardado.

También disponible como componente: este proyecto es lo que mueve la vista previa de
documentos de [@ranui/preview](https://www.npmjs.com/package/@ranui/preview)
([documentación](https://chaxus.github.io/ran/src/ranui/preview/)).

---

## 🚀 Despliegue

Una compilación estática: sin runtime y sin base de datos.

```bash
pnpm build   # se genera en dist/
```

### Alojamiento estático (Cloudflare Pages, Nginx, Vercel, Netlify…)

Sube `dist/`. En `public/_headers` está el acuerdo de caché que el sitio da por hecho (los
recursos con hash son inmutables, el service worker no se cachea nunca); los alojamientos
que lo ignoran también funcionan, solo revalidan más a menudo.

En Nginx, sirve `index.html` como respaldo para las rutas desconocidas:

```nginx
location / {
  root /var/www/document;
  try_files $uri $uri/ /index.html;
}
```

### GitHub Pages

`.github/workflows/pages-build-site.yml` compila y publica en cada push a `main`. Activa
Pages en los ajustes del repositorio con **GitHub Actions** como origen.

### Docker

```bash
# Básico
docker run -d --name document -p 8080:80 ghcr.io/ranuts/document:latest

# Con HTTPS y autenticación básica
docker run -d --name document -p 443:443 \
  -v /path/to/certs:/ssl \
  -e SERVER_BASIC_AUTH='user:$2y$...' \
  -e SERVER_HTTP2_TLS=true \
  -e SERVER_HTTP2_TLS_CERT=/ssl/cert.pem \
  -e SERVER_HTTP2_TLS_KEY=/ssl/key.pem \
  ghcr.io/ranuts/document:latest
```

`SERVER_BASIC_AUTH` espera un hash BCrypt; duplica los caracteres `$` para escaparlos en el
shell. El caché de la imagen se configura en `sws.toml`.

---

## 🔤 Tipografías

La compilación de OnlyOffice incluida trae su biblioteca de fuentes en `public/fonts/`,
indexada por `public/sdkjs/common/AllFonts.js`. Las fuentes se piden bajo demanda: un
documento solo descarga las que realmente usa.

→ **[Guía de gestión de fuentes](docs/fonts.md)** — el formato del catálogo indexado, los
registros y cómo añadir fuentes con `bin/font-catalog.mjs`.

---

## 🛠 Desarrollo

```bash
pnpm install --frozen-lockfile
pnpm run dev            # servidor de desarrollo
pnpm run build          # compilación de producción (bin/build.sh)
pnpm run lint           # oxlint + tsc + configuración de docker
pnpm run test           # pruebas unitarias (Vitest)
pnpm run test:e2e       # pruebas de extremo a extremo (Playwright, editor real + WASM real)
```

La suite de extremo a extremo mueve el editor real y el convertidor real en lugar de
simulaciones, incluidos los viajes de ida y vuelta de documentos, el protocolo de
integración y el flujo de recuperación. `docs/explorations/` deja por escrito por qué cada
pieza poco evidente es como es: merece una lectura antes de tocar la integración del editor.

---

## 🤖 Agentes de IA en el navegador (WebMCP)

Donde el navegador lo admite, la página registra herramientas que un agente puede invocar
directamente en vez de manejar la interfaz: `open_document_url`, `open_document_buffer`,
`create_document`, `save_document`, `get_document_text`, `set_readonly`,
`get_document_state`. Los documentos siguen sin salir del dispositivo: es el propio
navegador quien los descarga y los convierte. Donde no existe esa API, no ocurre nada.

---

## 📚 Construido sobre

- [sdkjs](https://github.com/ONLYOFFICE/sdkjs) y [web-apps](https://github.com/ONLYOFFICE/web-apps) — los editores de OnlyOffice
- [onlyoffice-x2t-wasm](https://github.com/cryptpad/onlyoffice-x2t-wasm) — el convertidor de documentos en WASM
- [ranui / ranuts](https://github.com/chaxus/ran) — el sistema de diseño y las utilidades con las que está hecho este sitio
- [se-office](https://github.com/Qihoo360/se-office), [onlyoffice-web-local](https://github.com/sweetwisdom/onlyoffice-web-local) — trabajos previos sobre cómo usar OnlyOffice sin servidor de documentos

## 🤝 Colaborar

Las incidencias y los pull requests son bienvenidos. `main` está protegida: trabaja en una
rama y abre un PR, que ejecuta el lint, las pruebas unitarias y tres suites de extremo a
extremo (servidor de desarrollo, comportamiento de Cloudflare Pages e imagen Docker de
producción).

## 📄 Licencia

[AGPL-3.0](LICENSE).

Este proyecto es una versión modificada de los editores ONLYOFFICE (sdkjs y
web-apps, copyright de Ascensio System SIA). La interfaz utiliza nombres
funcionales neutros, sin logotipos de productos ni promoción de marcas. Los
avisos de copyright, las licencias, las modificaciones y los enlaces al código
fuente se conservan en el panel Acerca de y en [NOTICE](NOTICE). Los recursos GUI
y las fuentes de terceros mantienen sus respectivas licencias.

La decisión de no mostrar logotipos se basa en la interpretación publicada por
la FSF de la sección 7 de AGPLv3. No se presenta como una sentencia judicial ni
como una garantía de cumplimiento legal. NOTICE documenta la posición del
proyecto original y los motivos de esta decisión.

ONLYOFFICE es una marca de Ascensio System SIA. Este proyecto no es un producto
oficial ni está afiliado, patrocinado o respaldado por dicha empresa. Los nombres
en avisos legales y referencias al código identifican la tecnología original,
no la marca de este proyecto.

La instalación PWA y las pestañas del navegador usan un icono de documento neutral
dibujado de forma independiente, sin logotipos, marcas ni iniciales del proyecto.
