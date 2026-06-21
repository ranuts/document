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
    canCoAuthoring?: boolean;
    coEditing?: {
      mode: 'fast' | 'strict';
      change: boolean;
    };
    customization: {
      help: boolean;
      about: boolean;
      hideRightMenu: boolean;
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
  };
  events: {
    onAppReady: () => void;
    onDocumentReady: () => void;
    /** 9.3.0+ event name — api.js sets canSaveDocumentToBinary=true when this is present.
     *  event.data = ArrayBuffer (raw DOCY binary transferred via postMessage). */
    onSaveDocument?: (event: { target: DocEditor; data: ArrayBuffer }) => void;
    /** 7.4.1 legacy event name — kept for reference, no longer dispatched by 9.3.0 api.js. */
    onSave?: (event: SaveEvent) => void;
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
  /** 9.3.0+ replacement for sendCommand */
  serviceCommand?: (params: { command: string; data: Record<string, any> }) => void;
  /** 7.4.1 legacy — removed in 9.3.0; use editorSendCommand() helper which falls back */
  sendCommand?: (params: {
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
  openDocument?: (data: Uint8Array) => void;
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
