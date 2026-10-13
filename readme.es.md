<p align="center">
  <img src="public/icons/document.svg" width="88" height="88" alt="Document Editor">
</p>

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

Abre, edita y guarda Word, Excel y PowerPoint en el navegador. Añade anotaciones a PDF. Sin cuenta ni instalación de Office.

**[Probar en línea](https://edit.chaxus.com/)** · [Ver código](https://github.com/ranuts/document)

---

## ✨ Características

- **Edición local.** La conversión, edición y exportación se ejecutan en tu dispositivo.
- **Guarda como prefieras.** En el archivo elegido cuando el navegador lo permite, o mediante descarga.
- **Retoma tu trabajo.** Vuelve a abrir documentos recientes guardados en este navegador.
- **En tu entorno.** Instálalo como PWA, alójalo tú mismo o intégralo en una aplicación.

## 🚀 Empezar

**[Probar en línea](https://edit.chaxus.com/)** · [Ver código](https://github.com/ranuts/document)

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

## 🔐 Edición local y tratamiento de datos

Las copias de recuperación se conservan en este navegador durante 7 días desde la última edición o apertura. Puedes eliminarlas en [Documentos guardados](https://edit.chaxus.com/history). No son una copia de seguridad; exporta los archivos importantes.

Los servicios de IA externos reciben el contenido necesario para tu solicitud. Los modelos locales lo procesan en tu dispositivo. El dictado puede usar un servicio de voz en línea; la aplicación anfitriona gestiona las exportaciones integradas.

## Documentación e integración

[Guía de uso](https://edit.chaxus.com/help) · [Alojamiento, URL e integración](docs/reference.md) · [API de integración](docs/embed-api.md) · [Fuentes](docs/fonts.md)

El uso sin conexión requiere recursos del editor en caché. Los recursos no guardados y los archivos remotos necesitan conexión.

## Asistente de documentos con IA (Experimental Beta)

Redacta y mejora textos, trabaja con datos de hojas de cálculo, crea diapositivas o pregunta sobre la página PDF actual. Revisa los cambios antes de aplicarlos y deshazlos cuando lo necesites.

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
