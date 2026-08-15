interface PluginConfig {
  name: string;
  url: string;
  config?: Record<string, any>;
}

interface DocEditorConfig {
  document: {
    title: string;
    url: string;
    fileType: string;
    permissions: {
      edit: boolean;
      chat: boolean;
      protect: boolean;
      download?: boolean;
    };
  };
  editorConfig: {
    lang: string;
    customization: {
      help: boolean;
      about: boolean;
      hideRightMenu: boolean;
      /** Interface theme id (e.g. theme-classic-light, theme-white, theme-dark, theme-system) or default-light/default-dark */
      uiTheme?: string;
      /** Enable/disable plugins. Set to false to disable plugins */
      plugins?: boolean;
      features: {
        spellcheck: {
          change: boolean;
        };
      };
      anonymous: {
        request: boolean;
        label: string;
      };
    };
    /** Plugin configuration. Can specify a list of plugins to load */
    plugins?: {
      pluginsData?: PluginConfig[];
    };
    /** v9: opt out of real-time collaboration (no document server behind Web Mode) */
    canCoAuthoring?: boolean;
    coEditing?: {
      mode: string;
      change: boolean;
    };
  };
  events: {
    onAppReady: () => void;
    onDocumentReady: () => void;
    /** v7 */
    onSave?: (event: SaveEvent) => void;
    /** v9 renamed onSave -> onSaveDocument (and changed its event.data shape) */
    onSaveDocument?: (event: SaveDocumentEventV9) => void;
    onDownloadAs?: (event: DownloadAsEvent) => void;
    writeFile: (event: WriteFileEvent) => void;
    /** Handle external messages from plugins */
    onExternalPluginMessage?: (event: { type: string; data: any; pluginName?: string }) => void;
  };
}

interface SaveEvent {
  data: {
    data: {
      data: ArrayBuffer;
    };
    option: {
      outputformat: number;
    };
  };
}

/** v9's onSaveDocument fires with the raw saved bytes, not the nested v7 shape. */
interface SaveDocumentEventV9 {
  data: ArrayBuffer;
}

interface WriteFileEvent {
  data: {
    data: Uint8Array;
    file: string;
    target: {
      frameOrigin: string;
    };
  };
  callback?: (result: { success: boolean; error?: string }) => void;
}

interface DownloadAsEvent {
  data?: {
    url?: string;
    fileType?: string | number;
  };
}

interface DocEditor {
  sendCommand: (params: {
    command: string;
    data: {
      err_code?: number;
      urls?: Record<string, string>;
      path?: string;
      imgName?: string;
      buf?: ArrayBuffer | string;
      success?: boolean;
      error?: string;
      enabled?: boolean;
      message?: string;
    };
  }) => void;
  /** v9 renamed sendCommand -> serviceCommand */
  serviceCommand?: DocEditor['sendCommand'];
  downloadAs?: (data?: string) => void;
  destroyEditor: () => void;
}

interface DocsAPI {
  DocEditor: new (elementId: string, config: DocEditorConfig) => DocEditor;
}

declare global {
  interface Window {
    onCreateNew: (ext: string) => Promise<void>;
    DocsAPI: DocsAPI;
    editor: DocEditor;
  }
}
