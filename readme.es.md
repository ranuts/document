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

**Un espacio de documentos de código abierto para ti y tus agentes de IA.**

Abre, edita, convierte y guarda Word, Excel y PowerPoint, y añade anotaciones a PDF en el navegador. El procesamiento básico de documentos es local, sin cuenta ni instalación de Office.

Usa asistencia de IA opcional (Experimental Beta), herramientas de documentos para agentes mediante WebMCP o la instalación como PWA. Los recursos del editor en caché funcionan sin conexión; también puedes alojarlo tú mismo o integrarlo en tu aplicación.

**Probar en línea: [edit.chaxus.com](https://edit.chaxus.com/)**

---

## ✨ Características

- **Edición y conversión local.** Los documentos se procesan en tu dispositivo sin necesidad de subirlos para editar o convertir.
- **Guarda como prefieras.** En el archivo elegido cuando el navegador lo permite, o mediante descarga. Retoma documentos recientes desde este navegador.
- **Trabaja con IA (Experimental Beta).** Redacta y mejora textos, trabaja con datos de hojas de cálculo, crea diapositivas o pregunta sobre la página PDF actual. Revisa los cambios antes de aplicarlos.
- **Los agentes usan herramientas de documentos.** En navegadores compatibles con [WebMCP](docs/reference.md#webmcp-agent-tools), los agentes de IA pueden abrir, convertir y exportar archivos, y leer texto de documentos de texto.
- **Instálalo como PWA.** Úsalo como una aplicación; los recursos del editor en caché funcionan sin conexión.
- **Alójalo o intégralo.** Despliega un sitio estático o integra el editor en tu aplicación mediante la API de iframe.

## 🚀 Empezar

[Nuevo documento](https://edit.chaxus.com/editor?new=docx&locale=es-ES) · [Nueva hoja de cálculo](https://edit.chaxus.com/editor?new=xlsx&locale=es-ES) · [Nueva presentación](https://edit.chaxus.com/editor?new=pptx&locale=es-ES)

O ejecuta tu propia copia:

```bash
docker run -d --name document -p 8080:80 ghcr.io/ranuts/document:latest
```

## 📄 Formatos

| Tipo             | Editar                     | También abre                |
| ---------------- | -------------------------- | --------------------------- |
| Documentos       | `.docx`                    | `.doc` `.odt` `.rtf` `.txt` |
| Hojas de cálculo | `.xlsx` `.csv`             | `.xls` `.ods`               |
| Presentaciones   | `.pptx`                    | `.ppt` `.odp`               |
| PDF              | anotar, rellenar, exportar | `.pdf`                      |

Los documentos compatibles se pueden exportar a PDF.

También admite interfaces multilingües, temas claro y oscuro y vista previa de solo lectura.

## 🔐 Edición local y tratamiento de datos

Las copias de recuperación se conservan en este navegador durante 7 días desde la última edición o apertura. Puedes eliminarlas en [Documentos guardados](https://edit.chaxus.com/history). No son una copia de seguridad; exporta los archivos importantes.

Los servicios de IA externos reciben el contenido necesario para tu solicitud. Los modelos locales lo procesan en tu dispositivo. El dictado puede usar un servicio de voz en línea; la aplicación anfitriona gestiona las exportaciones integradas.

El agente de IA del navegador que elijas controla cómo procesa el contenido devuelto por las herramientas de documentos.

## Documentación e integración

[Guía de uso](https://edit.chaxus.com/es/help) · [Alojamiento, URL e integración](docs/reference.md) · [API de integración](docs/embed-api.md) · [Fuentes](docs/fonts.md)

El uso sin conexión requiere recursos del editor en caché. Los recursos no guardados y los archivos remotos necesitan conexión.

## Asistente de documentos con IA (Experimental Beta)

Redacta y mejora textos, trabaja con datos de hojas de cálculo, crea diapositivas o pregunta sobre la página PDF actual. Revisa los cambios antes de aplicarlos y deshazlos cuando lo necesites.

Elige un modelo local o conecta tu propio servicio de IA. Puedes dictar instrucciones en navegadores con entrada de voz.

**Experimental Beta.** Desactivado por defecto. Las respuestas y los cambios pueden ser incorrectos; comprueba los resultados importantes.

<details>
<summary>Ver las cuatro demos</summary>

| Word                                                                                                                                                          | Excel                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [![Redactar, insertar, resumir y deshacer](docs/media/ai-demos/word-ai.jpg)](https://github.com/user-attachments/assets/8d1d6386-e33a-45f2-b968-b8695c8f7da9) | [![Rellenar, calcular, ordenar y deshacer](docs/media/ai-demos/excel-ai.jpg)](https://github.com/user-attachments/assets/5bb253d7-3cc5-4f31-989e-0c88dcb1615c) |
| **Redactar, insertar, resumir y deshacer**                                                                                                                    | **Rellenar, calcular, ordenar y deshacer**                                                                                                                     |
| PowerPoint                                                                                                                                                    | PDF                                                                                                                                                            |
| [![Crear, duplicar y deshacer](docs/media/ai-demos/pptx-ai.jpg)](https://github.com/user-attachments/assets/db3fc7a7-b54e-4147-a7ca-e7f16243618e)             | [![Leer, preguntar y revisar notas](docs/media/ai-demos/pdf-ai.jpg)](https://github.com/user-attachments/assets/f01c2da6-0669-4111-87c1-c4440f4a60e9)          |
| **Crear, duplicar y deshacer**                                                                                                                                | **Leer, preguntar y revisar notas**                                                                                                                            |

Flujos completos a velocidad normal, en inglés y con el modelo local Qwen3 4B ya cargado. Los tiempos de respuesta varían según el modelo y el dispositivo.

[Vídeos, subtítulos y descripciones](docs/media/ai-demos/README.md)

La asistencia PDF admite texto seleccionable y notas de página, no reconoce texto en imágenes escaneadas ni reescribe el cuerpo del PDF.

</details>

## 🛠 Desarrollo

Ejecutar desde el código:

```bash
git clone https://github.com/ranuts/document.git
cd document
pnpm install --frozen-lockfile
pnpm run dev
```

Se agradecen comentarios y contribuciones: [Issues](https://github.com/ranuts/document/issues) · [Pull requests](https://github.com/ranuts/document/pulls)

## 📚 Construido sobre

- [sdkjs](https://github.com/ONLYOFFICE/sdkjs) y [web-apps](https://github.com/ONLYOFFICE/web-apps) — los editores de OnlyOffice
- [onlyoffice-x2t-wasm](https://github.com/cryptpad/onlyoffice-x2t-wasm) — el convertidor de documentos en WASM
- [ranui / ranuts](https://github.com/chaxus/ran) — el sistema de diseño y las utilidades con las que está hecho este sitio
- [se-office](https://github.com/Qihoo360/se-office), [onlyoffice-web-local](https://github.com/sweetwisdom/onlyoffice-web-local) — trabajos previos sobre cómo usar OnlyOffice sin servidor de documentos

## 📄 Licencia

[AGPL-3.0](LICENSE) · [NOTICE](NOTICE)

<details>
<summary>Avisos del proyecto original y marcas</summary>

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

</details>
