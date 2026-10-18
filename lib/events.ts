import { clearActiveSource } from './active-document-source';
import { beginDocumentOpen, cancelDocumentOpen, commitDocumentOpen } from './document-open';
import { clearDocumentSession } from './history/autosave';
import { MessageCodec, Platform } from 'ranuts/utils';
import type { MessageHandler } from 'ranuts/utils';
import { setDocmentObj } from '@ranuts/shared/store';
import { handleDocumentOperation } from './converter';
import { showLoading } from './loading';

// UI callbacks to avoid circular dependency
let hideControlPanelFn: (() => void) | null = null;

export function setEventUICallbacks(callbacks: { hideControlPanel: () => void }): void {
  hideControlPanelFn = callbacks.hideControlPanel;
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
let chunkOpening: ReturnType<typeof beginDocumentOpen> | null = null;

export const events: Record<string, MessageHandler<any, unknown>> = {
  RENDER_OFFICE: async (data: RenderOfficeData) => {
    // Hide the control panel when rendering office
    if (hideControlPanelFn) {
      hideControlPanelFn();
    }
    if (data.chunkIndex === 0 || !chunkOpening) {
      fileChunks = [];
      chunkOpening = beginDocumentOpen();
    }
    const opening = chunkOpening;
    fileChunks.push(data);
    if (fileChunks.length >= data.totalChunks) {
      const chunks = fileChunks;
      fileChunks = [];
      chunkOpening = null;
      const { removeLoading } = showLoading();
      try {
        const file = await MessageCodec.decodeFileChunked(chunks);
        opening.assertCurrent();
        await handleDocumentOperation({ file, fileName: file.name, isNew: false, isCurrent: opening.isCurrent });
        if (commitDocumentOpen(opening.id)) {
          setDocmentObj({ fileName: file.name, file });
          clearDocumentSession();
          await clearActiveSource();
        }
      } catch (error) {
        if (opening.isCurrent()) console.error('Error rendering office document:', error);
      } finally {
        // Always remove loading, even if there's an error
        removeLoading();
      }
    }
  },
  CLOSE_EDITOR: () => {
    cancelDocumentOpen();
    clearDocumentSession();
    chunkOpening = null;
    fileChunks = [];
    if (window.editor && typeof window.editor.destroyEditor === 'function') {
      window.editor.destroyEditor();
    }
  },
};

export function initEvents(): void {
  Platform.init(events);
}
