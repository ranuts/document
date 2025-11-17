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
    };
  };
  editorConfig: {
    lang: string;
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
    onSave: (event: SaveEvent) => void;
    writeFile: (event: WriteFileEvent) => void;
    /** Handle external messages from plugins */
    onExternalPluginMessage?: (event: {
      type: string;
      data: any;
      pluginName?: string;
    }) => void;
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

interface DocEditor {
  sendCommand: (params: {
    command: string;
    data: {
      err_code?: number;
      urls?: Record<string, string>;
      path?: string;
      imgName?: string;
      buf?: ArrayBuffer;
      success?: boolean;
      error?: string;
    };
  }) => void;
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
