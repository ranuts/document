---
title: 'Acerca de — quién hace este editor y por qué'
description: 'Sobre este editor de código abierto, sus autores, el código y el tratamiento de datos. Procesamiento de documentos sin servidor.'
eyebrow: Acerca de
breadcrumb: Acerca de
h1: Acerca de este editor
lead: Quién lo hace, qué hace de verdad, y cómo puedes comprobar ambas cosas por ti mismo.
---

## Qué es esto

Un **editor de documentos de oficina dentro del navegador**. Abres un archivo de Word (DOCX), Excel (XLSX), PowerPoint (PPTX), CSV o PDF y lo editas directamente en una pestaña.

Al abrir archivos locales directamente en este sitio, puedes verlos, editarlos y convertirlos en tu dispositivo sin subir los documentos.

Con el guardado automático activado, las copias de recuperación permanecen en este navegador durante 7 días desde la última edición o apertura. Puedes borrarlas o desactivar el guardado automático en /history. Los datos del navegador y los cambios aún no guardados pueden perderse; guarda los cambios importantes en un archivo.

## Quién lo hace

Este sitio lo desarrolla y mantiene **ranuts**, el mismo autor detrás de la [cuenta de GitHub `ranuts`](https://github.com/ranuts) y de las [bibliotecas de componentes y utilidades ran](https://ran.chaxus.com).

Es un proyecto personal de código abierto, no el producto de una empresa. No hay equipo comercial ni capital riesgo detrás — y por eso tampoco hay ventas adicionales, ni un «plan gratuito» que caduca, ni razón alguna para que este sitio quiera tus archivos.

## Cómo puedes comprobarlo todo

Las afirmaciones sobre privacidad son baratas. Estas son las formas de verificarlas tú mismo:

- **Lee el código.** Todo es de código abierto bajo **AGPL-3.0** en [github.com/ranuts/document](https://github.com/ranuts/document). La licencia obliga a que cualquier versión modificada y alojada publique también su código.
- Comprueba en el panel de red la apertura, edición y guardado de un archivo local. Prueba por separado la IA opcional, las URL remotas y las aplicaciones anfitrionas; sus solicitudes no pertenecen a la edición básica local.
- Abre el editor con conexión y prueba los formatos, fuentes y exportaciones necesarios. Después desconecta y verifica el mismo flujo antes de depender del modo sin conexión.
- **Alójalo tú mismo.** El repositorio incluye lo necesario para ejecutar tu propia copia.

## Sobre qué está construido

El motor de edición se basa en **ONLYOFFICE**, compilado para funcionar en el navegador. Este proyecto envuelve ese motor con una capa pensada para lo local: manejo de archivos, conversión de formatos, la capa sin conexión, el soporte de incrustación y la interfaz que ves.

Construir sobre un motor existente es deliberado. Los formatos de documento — sobre todo DOCX y XLSX — son especificaciones enormes y desordenadas, y una implementación desde cero mostraría tus archivos sutilmente mal. Reutilizar un motor maduro significa que **lo que ves en el navegador coincide con lo que verías en otro sitio**.

## Límites que conviene conocer

Una lista honesta, porque una página que solo enumera virtudes no sirve de nada:

- **Los archivos grandes dependen de tu equipo.** Todo corre en tu navegador, así que una hoja de cálculo muy grande está limitada por tu memoria y tu CPU, no por un servidor que puedas ampliar pagando.
- Los archivos locales se abren, editan y convierten en tu dispositivo, sin un servidor de procesamiento de documentos. El código es público y puedes consultarlo o alojar tu propia copia.
- **La fidelidad es muy buena, no perfecta.** Los diseños complejos, las fuentes poco habituales y las macros pueden diferir de una suite de escritorio.

Si algo de esto te importa más que mantener el archivo en local, una suite alojada es la mejor herramienta — y es una elección razonable.

## Cómo contactar

Los informes de errores, los problemas de formato y las peticiones de funciones van mejor como incidencias en GitHub, donde quedan públicas y se pueden seguir. Consulta [Contacto](/es/contact) para las vías de contacto con el proyecto.
