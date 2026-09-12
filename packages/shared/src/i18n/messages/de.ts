import type { I18nMessages } from '../types';

/**
 * The `de` message table.
 * Filled in from en.json where a translation is missing, which is what keeps
 * an untranslated string showing in English rather than as a raw key.
 *
 * Interpolation placeholders ({size}, {title}, {when}, {days}, {count},
 * {page}, {pages}) have to survive translation verbatim -- the
 * message-placeholders cases in test/unit/i18n.test.ts check that.
 */
export const de: Partial<I18nMessages> = {
  webOffice: 'Web Office',
  uploadDocument: 'Dokument öffnen / bearbeiten',
  newWord: 'Neues Word-Dokument',
  newExcel: 'Neue Excel-Tabelle',
  newPowerPoint: 'Neue PowerPoint-Präsentation',
  themeLabel: 'Design',
  themeSystem: 'System',
  themeLight: 'Hell',
  themeDark: 'Dunkel',
  fileSavedSuccess: 'Datei gespeichert: ',
  documentLoaded: 'Dokument geladen: ',
  failedToLoadEditor:
    'Der Editor konnte nicht geladen werden. Bitte prüfen, ob die OnlyOffice-API korrekt eingebunden ist.',
  unsupportedFileType: 'Nicht unterstützter Dateityp: ',
  invalidFileObject: 'Ungültige Datei',
  documentOperationFailed: 'Dokumentvorgang fehlgeschlagen: ',
  openUrlFailed: 'Dieser Link konnte nicht geöffnet werden: ',
  openUrlUnreachable:
    'Die Datei konnte nicht abgerufen werden. Die Website erlaubt anderen Seiten möglicherweise nicht, ihre Dateien zu lesen, oder das Netzwerk ist nicht erreichbar. Laden Sie die Datei herunter und öffnen Sie sie von Ihrem Gerät.',
  editorErrorToast: 'Dokumentfehler',
  editorErrorFormatMismatch:
    'Der Inhalt der Datei passt nicht zur Dateiendung – bitte das Format prüfen und erneut versuchen',
  editorErrorOpenFailed:
    'Die Datei konnte nicht geöffnet werden: möglicherweise beschädigt, in einem nicht unterstützten Format, oder der Inhalt passt nicht zur Endung',
  editorErrorOutOfMemory:
    'Dieser Browser konnte keinen Speicher für die Konvertierungs-Engine belegen (etwa {mb} MB). Schließen Sie andere Tabs oder Fenster und versuchen Sie es erneut; falls es weiterhin fehlschlägt, verwenden Sie einen 64-Bit-Browser (Edge oder 64-Bit-Chrome).',
  editorOpenRetrying:
    'Der Editor war beim Öffnen des Dokuments noch nicht bereit; es wird automatisch erneut versucht …',
  agentTitle: 'KI-Assistent',
  agentOpenTip: 'KI-Assistenten öffnen',
  agentSettings: 'Einstellungen',
  agentRoleUser: 'Sie',
  agentRoleTool: 'Werkzeug',
  agentRoleError: 'Fehler',
  agentProviderClaude: 'Claude (Cloud, API-Schlüssel erforderlich)',
  agentProviderOpenAI: 'OpenAI (Cloud, API-Schlüssel erforderlich)',
  agentProviderGemini: 'Gemini (Cloud, API-Schlüssel erforderlich)',
  agentProviderLocal: 'Lokal und offline (WebLLM, WebGPU erforderlich)',
  agentProviderOllama: 'Ollama (lokaler Server, selbst gestartet)',
  agentOllamaModelPlaceholder: 'Modellname, z. B. llama3.2',
  agentOllamaHint:
    'Verbindet sich mit dem lokalen Ollama (http://localhost:11434); kein API-Schlüssel nötig – achten Sie darauf, dass das Modell läuft.',
  agentLoadModel: 'Modell laden',
  agentModelLoaded: 'Modell geladen – Sie können loslegen.',
  agentCheckingCache: 'Modell-Cache wird geprüft …',
  agentModelCached:
    'Dieses Modell liegt bereits im Cache – ein Klick auf „Modell laden“ startet sofort (ein Neuladen lädt es nicht erneut herunter).',
  agentModelFirstDownload:
    'Beim ersten Mal wird das Modell heruntergeladen ({size}); danach liegt es im Cache, ein Neuladen lädt es nicht erneut herunter.',
  agentNoWebGPU: 'Dieser Browser unterstützt kein WebGPU; der lokale Modus steht nicht zur Verfügung.',
  agentLocalChatOnly:
    'Das lokale Modell antwortet und formuliert um – es bearbeitet das Dokument nicht selbst. Für KI-gestütztes Bearbeiten ',
  agentSwitchCloud: 'zur Cloud wechseln →',
  agentReviewMode: 'Änderungen nachverfolgen',
  agentQuote: 'Auswahl zitieren',
  agentQuoteTip: 'Den im Dokument, in der Tabelle oder auf der Folie ausgewählten Text in die Eingabe übernehmen',
  agentClear: 'Verlauf löschen',
  agentInputPlaceholder: 'Die KI um eine Änderung am Dokument bitten … (Enter sendet, Umschalt+Enter für neue Zeile)',
  agentSend: 'Senden',
  agentStop: 'Anhalten',
  agentNeedKey: 'Bitte zuerst einen API-Schlüssel eingeben.',
  agentNoSelection: 'Keine Auswahl erkannt – bitte zuerst Text im Dokument markieren.',
  agentQuotePrefix: 'Bitte berücksichtige den von mir markierten Inhalt:',
  agentStopped: 'Angehalten.',
  agentMaxSteps: 'Maximale Anzahl an Schritten erreicht; angehalten.',
  agentToolCallPrefix: 'Werkzeugaufruf: ',
  agentToolErrorPrefix: 'Werkzeugfehler: ',
  autosaveStopped:
    'Automatisches Speichern angehalten: In diesem Browser ist kein Speicherplatz mehr frei. Exportieren Sie dieses Dokument und löschen Sie dann einige ältere aus Ihren gespeicherten Dokumenten.',
  historyTitle: 'Gespeicherte Dokumente',
  historyIntro:
    'Kopien der Dokumente, die Sie bearbeitet haben – in diesem Browser auf diesem Gerät, damit ein Neuladen, ein geschlossener Tab oder ein Absturz die Arbeit nicht kostet. Nichts davon wurde hochgeladen.',
  historyColDocument: 'Dokument',
  historyColEdited: 'Zuletzt bearbeitet',
  historyColSize: 'Größe',
  historyColExpires: 'Wird gelöscht',
  historyNotBackup:
    'Diese Kopien sind dazu da, angefangene Arbeit wieder aufzunehmen. Sie sind keine Sicherung – exportieren Sie alles, was Sie behalten möchten.',
  historySearchPlaceholder: 'Nach Dateiname suchen',
  historyEmpty: 'Noch nichts gespeichert. Dokumente, die Sie hier bearbeiten, erscheinen von selbst in dieser Liste.',
  historyEmptySearch: 'Kein Dateiname passt zu dieser Suche.',
  historyOpen: 'Öffnen',
  historyDelete: 'Löschen',
  historyDeleteConfirm:
    '„{title}“ und alle gespeicherten Kopien davon löschen? Das lässt sich nicht rückgängig machen.',
  historyClearAll: 'Alle löschen',
  historyClearConfirm:
    'Alle auf diesem Gerät gespeicherten Dokumentkopien löschen? Das lässt sich nicht rückgängig machen.',
  historyUnsaved: 'nicht exportiert',
  historyUsage: '{size} belegt',
  historyCount: '{count} Dokumente',
  historyPageInfo: 'Seite {page} von {pages}',
  historyPrev: 'Zurück',
  historyNext: 'Weiter',
  historyBack: 'Editor öffnen',
  historyAutosaveLabel: 'Automatisch speichern',
  historyAutosaveOff:
    'Automatisches Speichern ist aus: Was Sie jetzt bearbeiten, wird nicht gespeichert und geht beim Schließen der Seite verloren.',
  historyRetention:
    'Jedes Dokument wird 7 Tage nach der letzten Bearbeitung oder Öffnung automatisch gelöscht. Sie können hier auch selbst löschen – das wirkt sofort.',
  historyExpiresIn: 'noch {days} Tage',
  historyExpiresInOne: 'noch 1 Tag',
  historyExpiresToday: 'heute',
  historyDownload: 'Herunterladen',
  historyDownloadFailed: 'Diese Kopie konnte nicht auf der Festplatte gespeichert werden.',
  historyOnlyUnsaved: 'Nicht exportiert',
  historyOpenFile: 'Datei öffnen',
  historyRailSettings: 'Einstellungen',
  historyRailRetention: 'Aufbewahrung',
  historyCancel: 'Abbrechen',
  historyChip: 'Auf diesem Gerät · nie hochgeladen',
  historyEmptyTitle: 'Noch nichts gespeichert',
  historyEmptySearchTitle: 'Keine Treffer',
  historyClearSearch: 'Suche zurücksetzen',
  historyDeleteTitle: 'Dieses Dokument löschen',
  historyClearTitle: 'Alles löschen',
};
