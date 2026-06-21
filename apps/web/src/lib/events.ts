import { MessageCodec, Platform, createObjectURL } from 'ranuts/utils';
import type { MessageHandler } from 'ranuts/utils';
import { getDocmentObj, setDocmentObj } from '../store';
import { handleDocumentOperation, initX2T } from './converter';
import { showLoading } from './loading';

// UI callbacks to avoid circular dependency
let hideControlPanelFn: (() => void) | null = null;
let showMenuGuideFn: (() => void) | null = null;

export function setEventUICallbacks(callbacks: { hideControlPanel: () => void; showMenuGuide: () => void }): void {
  hideControlPanelFn = callbacks.hideControlPanel;
  showMenuGuideFn = callbacks.showMenuGuide;
}

export interface RenderOfficeData {
  chunkIndex: number;
  data: string;
  lastModified: number;
  name: string;
  size: number;
  totalChunks: number;
  type: string;
}

let fileChunks: RenderOfficeData[] = [];

export const events: Record<string, MessageHandler<any, unknown>> = {
  RENDER_OFFICE: async (data: RenderOfficeData) => {
    // Hide the control panel when rendering office
    if (hideControlPanelFn) {
      hideControlPanelFn();
    }
    fileChunks.push(data);
    if (fileChunks.length >= data.totalChunks) {
      const { removeLoading, setProgress } = showLoading();
      try {
        const file = await MessageCodec.decodeFileChunked(fileChunks);
        setDocmentObj({
          fileName: file.name,
          file: file,
          url: await createObjectURL(file),
        });
        await initX2T();
        setProgress(60, 'Converting document…');
        const { fileName, file: fileBlob } = getDocmentObj();
        await handleDocumentOperation({ file: fileBlob, fileName, isNew: !fileBlob });
        setProgress(90, 'Opening editor…');
        // Show menu guide after document is loaded
        if (showMenuGuideFn) {
          setTimeout(() => {
            showMenuGuideFn!();
          }, 1000);
        }
      } catch (error) {
        console.error('Error rendering office document:', error);
      } finally {
        fileChunks = [];
        // Always remove loading, even if there's an error
        removeLoading();
      }
    }
  },
  CLOSE_EDITOR: () => {
    fileChunks = [];
    if (window.editor && typeof window.editor.destroyEditor === 'function') {
      window.editor.destroyEditor();
    }
  },
};

export function initEvents(): void {
  Platform.init(events);
}
