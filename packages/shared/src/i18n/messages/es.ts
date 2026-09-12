import type { I18nMessages } from '../types';

/**
 * The `es` message table.
 * Filled in from en.json where a translation is missing, which is what keeps
 * an untranslated string showing in English rather than as a raw key.
 *
 * Interpolation placeholders ({size}, {title}, {when}, {days}, {count},
 * {page}, {pages}) have to survive translation verbatim -- the
 * message-placeholders cases in test/unit/i18n.test.ts check that.
 */
export const es: Partial<I18nMessages> = {
  webOffice: 'Web Office',
  uploadDocument: 'Abrir / editar documento',
  newWord: 'Nuevo documento de Word',
  newExcel: 'Nueva hoja de Excel',
  newPowerPoint: 'Nueva presentación de PowerPoint',
  themeLabel: 'Tema',
  themeSystem: 'Sistema',
  themeLight: 'Claro',
  themeDark: 'Oscuro',
  fileSavedSuccess: 'Archivo guardado: ',
  documentLoaded: 'Documento cargado: ',
  failedToLoadEditor: 'No se pudo cargar el editor. Comprueba que la API de OnlyOffice esté instalada correctamente.',
  unsupportedFileType: 'Tipo de archivo no admitido: ',
  invalidFileObject: 'Archivo no válido',
  documentOperationFailed: 'Error al procesar el documento: ',
  openUrlFailed: 'No se pudo abrir ese enlace: ',
  openUrlUnreachable:
    'No se pudo obtener el archivo. Puede que el sitio no permita que otras páginas lean sus archivos, o que no haya red. Descárgalo y ábrelo desde tu dispositivo.',
  editorErrorToast: 'Error del documento',
  editorErrorFormatMismatch:
    'El contenido del archivo no coincide con su extensión; comprueba el formato e inténtalo de nuevo',
  editorErrorOpenFailed:
    'No se pudo abrir el archivo: puede estar dañado, tener un formato no admitido o no corresponder a su extensión',
  editorErrorOutOfMemory:
    'Este navegador no pudo reservar memoria para el motor de conversión de documentos (unos {mb} MB). Cierra otras pestañas o ventanas e inténtalo de nuevo; si sigue fallando, usa un navegador de 64 bits (Edge o Chrome de 64 bits).',
  editorOpenRetrying: 'El editor no estaba listo al abrir el documento; se está reintentando automáticamente…',
  agentTitle: 'Asistente de IA',
  agentOpenTip: 'Abrir el asistente de IA',
  agentSettings: 'Ajustes',
  agentRoleUser: 'Tú',
  agentRoleTool: 'Herramienta',
  agentRoleError: 'Error',
  agentProviderClaude: 'Claude (nube, requiere clave de API)',
  agentProviderOpenAI: 'OpenAI (nube, requiere clave de API)',
  agentProviderGemini: 'Gemini (nube, requiere clave de API)',
  agentProviderLocal: 'Local sin conexión (WebLLM, requiere WebGPU)',
  agentProviderOllama: 'Ollama (servidor local, lo ejecutas tú)',
  agentOllamaModelPlaceholder: 'Nombre del modelo, p. ej. llama3.2',
  agentOllamaHint:
    'Se conecta a Ollama en local (http://localhost:11434); no hace falta clave de API, pero asegúrate de que el modelo esté en marcha.',
  agentLoadModel: 'Cargar modelo',
  agentModelLoaded: 'Modelo cargado: ya puedes empezar a escribir.',
  agentCheckingCache: 'Comprobando la caché del modelo…',
  agentModelCached:
    'Este modelo ya está en caché: pulsa «Cargar modelo» para empezar al instante (al recargar no se descarga de nuevo).',
  agentModelFirstDownload:
    'La primera vez se descarga el modelo ({size}); después queda en caché, así que al recargar no se descarga de nuevo.',
  agentNoWebGPU: 'Este navegador no admite WebGPU, así que el modo local no está disponible.',
  agentLocalChatOnly:
    'El modelo local solo responde y reescribe: no edita el documento directamente. Para que la IA edite, ',
  agentSwitchCloud: 'cambia a la nube →',
  agentReviewMode: 'Control de cambios',
  agentQuote: 'Citar la selección',
  agentQuoteTip: 'Cita en el cuadro de texto lo que tengas seleccionado en el documento, la hoja o la diapositiva',
  agentClear: 'Borrar la conversación',
  agentInputPlaceholder: 'Pide a la IA que edite el documento… (Enter para enviar, Mayús+Enter para salto de línea)',
  agentSend: 'Enviar',
  agentStop: 'Detener',
  agentNeedKey: 'Introduce primero una clave de API.',
  agentNoSelection: 'No hay nada seleccionado: selecciona primero texto en el documento.',
  agentQuotePrefix: 'Ten en cuenta el contenido que he seleccionado:',
  agentStopped: 'Detenido.',
  agentMaxSteps: 'Se alcanzó el número máximo de pasos; proceso detenido.',
  agentToolCallPrefix: 'Llamada a herramienta: ',
  agentToolErrorPrefix: 'Error de herramienta: ',
  autosaveStopped:
    'Se ha detenido el guardado automático: este navegador se ha quedado sin espacio. Exporta este documento y borra algunos de los que tienes guardados.',
  historyTitle: 'Documentos guardados',
  historyIntro:
    'Copias de los documentos que has editado, conservadas en este navegador y en este dispositivo, para que recargar, cerrar una pestaña o un fallo no te cuesten el trabajo. Nada de esto se ha subido a ningún sitio.',
  historyColDocument: 'Documento',
  historyColEdited: 'Última edición',
  historyColSize: 'Tamaño',
  historyColExpires: 'Se borra',
  historyNotBackup:
    'Estas copias existen para que puedas retomar lo que estabas haciendo. No son una copia de seguridad: exporta lo que quieras conservar.',
  historySearchPlaceholder: 'Buscar por nombre de archivo',
  historyEmpty: 'Todavía no hay nada guardado. Los documentos que edites aquí aparecerán solos en esta lista.',
  historyEmptySearch: 'Ningún nombre de archivo coincide con esa búsqueda.',
  historyOpen: 'Abrir',
  historyDelete: 'Eliminar',
  historyDeleteConfirm: '¿Eliminar «{title}» y todas sus copias guardadas? Esto no se puede deshacer.',
  historyClearAll: 'Eliminar todo',
  historyClearConfirm:
    '¿Eliminar todas las copias de documentos guardadas en este dispositivo? Esto no se puede deshacer.',
  historyUnsaved: 'sin exportar',
  historyUsage: '{size} en uso',
  historyCount: '{count} documentos',
  historyPageInfo: 'Página {page} de {pages}',
  historyPrev: 'Anterior',
  historyNext: 'Siguiente',
  historyBack: 'Abrir el editor',
  historyAutosaveLabel: 'Guardado automático',
  historyAutosaveOff:
    'El guardado automático está desactivado: lo que edites ahora no se guarda y se perderá al cerrar la página.',
  historyRetention:
    'Cada documento se elimina automáticamente 7 días después de la última vez que lo editaste o lo abriste. También puedes borrar lo que quieras desde aquí, y surte efecto de inmediato.',
  historyExpiresIn: 'quedan {days} días',
  historyExpiresInOne: 'queda 1 día',
  historyExpiresToday: 'hoy',
  historyDownload: 'Descargar',
  historyDownloadFailed: 'No se pudo guardar esa copia en el disco.',
  historyOnlyUnsaved: 'Sin exportar',
  historyOpenFile: 'Abrir un archivo',
  historyRailSettings: 'Ajustes',
  historyRailRetention: 'Conservación',
  historyCancel: 'Cancelar',
  historyChip: 'En este dispositivo · nunca se sube',
  historyEmptyTitle: 'Todavía no hay nada guardado',
  historyEmptySearchTitle: 'Sin resultados',
  historyClearSearch: 'Borrar la búsqueda',
  historyDeleteTitle: 'Eliminar este documento',
  historyClearTitle: 'Eliminarlo todo',
};
