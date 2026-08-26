---
title: Acerca de — quién hace este editor y por qué
description: Quién está detrás de edit.chaxus.com, qué hace realmente, cómo está construido y dónde vive el código fuente. Un editor de código abierto (AGPL-3.0) para archivos de Word, Excel, PowerPoint, CSV y PDF que funciona en el navegador y nunca sube tus documentos.
eyebrow: Acerca de
breadcrumb: Acerca de
h1: Acerca de este editor
lead: Quién lo hace, qué hace de verdad, y cómo puedes comprobar ambas cosas por ti mismo.
---

## Qué es esto

Un **editor de documentos de oficina dentro del navegador**. Abres un archivo de Word (DOCX), Excel (XLSX), PowerPoint (PPTX), CSV o PDF y lo editas directamente en una pestaña.

Lo que más importa: **tu archivo nunca sale de tu dispositivo**. No hay paso de subida, no hay cuenta y no hay copia de tu documento en ningún servidor. El motor de edición se ejecuta dentro de tu navegador, así que el archivo va de tu disco a la pestaña y vuelve — sin nada en medio.

Esa sola propiedad determina casi todas las decisiones de diseño de aquí: sin registro, sin almacenamiento en la nube, sin telemetría que pudiera llevarse el contenido de un documento, y un modo sin conexión que sigue funcionando cuando la red no lo hace.

## Quién lo hace

Este sitio lo desarrolla y mantiene **ranuts**, el mismo autor detrás de la [cuenta de GitHub `ranuts`](https://github.com/ranuts) y de las [bibliotecas de componentes y utilidades ran](https://ran.chaxus.com).

Es un proyecto personal de código abierto, no el producto de una empresa. No hay equipo comercial ni capital riesgo detrás — y por eso tampoco hay ventas adicionales, ni un «plan gratuito» que caduca, ni razón alguna para que este sitio quiera tus archivos.

## Cómo puedes comprobarlo todo

Las afirmaciones sobre privacidad son baratas. Estas son las formas de verificarlas tú mismo:

- **Lee el código.** Todo es de código abierto bajo **AGPL-3.0** en [github.com/ranuts/document](https://github.com/ranuts/document). La licencia obliga a que cualquier versión modificada y alojada publique también su código.
- **Mira la pestaña de red.** Abre las herramientas de desarrollo del navegador, carga un documento, edítalo y observa las peticiones. No verás tu archivo yendo a ninguna parte.
- **Desconecta la red.** Carga el sitio una vez, ponte sin conexión y abre y edita un archivo. Sigue funcionando, algo que solo es posible porque la edición ocurre en local.
- **Alójalo tú mismo.** El repositorio incluye lo necesario para ejecutar tu propia copia.

## Sobre qué está construido

El motor de edición se basa en **ONLYOFFICE**, compilado para funcionar en el navegador. Este proyecto envuelve ese motor con una capa pensada para lo local: manejo de archivos, conversión de formatos, la capa sin conexión, el soporte de incrustación y la interfaz que ves.

Construir sobre un motor existente es deliberado. Los formatos de documento — sobre todo DOCX y XLSX — son especificaciones enormes y desordenadas, y una implementación desde cero mostraría tus archivos sutilmente mal. Reutilizar un motor maduro significa que **lo que ves en el navegador coincide con lo que verías en otro sitio**.

## Límites que conviene conocer

Una lista honesta, porque una página que solo enumera virtudes no sirve de nada:

- **Los archivos grandes dependen de tu equipo.** Todo corre en tu navegador, así que una hoja de cálculo muy grande está limitada por tu memoria y tu CPU, no por un servidor que puedas ampliar pagando.
- **Ni sincronización ni colaboración.** Ningún servidor guarda tu documento, lo que también significa que no hay coedición en tiempo real ni sincronización entre dispositivos.
- **La fidelidad es muy buena, no perfecta.** Los diseños complejos, las fuentes poco habituales y las macros pueden diferir de una suite de escritorio.

Si algo de esto te importa más que mantener el archivo en local, una suite alojada es la mejor herramienta — y es una elección razonable.

## Cómo contactar

Los informes de errores, los problemas de formato y las peticiones de funciones van mejor como incidencias en GitHub, donde quedan públicas y se pueden seguir. Consulta [Contacto](/es/contact) para las vías de contacto con el proyecto.
