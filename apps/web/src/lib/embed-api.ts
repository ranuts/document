import { setDocmentObj } from '../store';
import { handleDocumentOperation, loadEditorApi } from './converter';
import { openDocumentFromUrl } from './document';
import { getReadonlyMode, requestSaveDocument, setReadonlyMode } from './onlyoffice-editor';

type EmbedMessageType =
  | 'document:open'
  | 'document:open-url'
  | 'document:open-file'
  | 'document:open-buffer'
  | 'document:set-readonly'
  | 'document:save'
  | 'document:get-state';

type EmbedMessage = {
  id?: string;
  type?: EmbedMessageType;
  payload?: Record<string, any>;
};

type EmbedResponsePayload = Record<string, any>;

const EMBED_QUERY_KEYS = ['embed', 'embedded'];

let initialized = false;
let parentOrigin = '*';
let isEmbedMode = false;

function getQueryValue(key: string): string | null {
  return new URLSearchParams(window.location.search).get(key);
}

function detectEmbedMode(): boolean {
  if (window.parent !== window) {
    return true;
  }

  return EMBED_QUERY_KEYS.some((key) => {
    const value = getQueryValue(key);
    return value === '' || value === '1' || value === 'true';
  });
}

function normalizeTargetOrigin(origin: string): string {
  return origin && origin !== 'null' ? origin : '*';
}

function shouldAcceptMessage(event: MessageEvent): boolean {
  const allowedOrigin = getQueryValue('embedOrigin');
  if (!allowedOrigin) {
    return true;
  }

  return event.origin === allowedOrigin;
}

function postToParent(type: string, payload: EmbedResponsePayload = {}, id?: string): void {
  if (!isEmbedMode) {
    return;
  }

  window.parent.postMessage(
    {
      id,
      type,
      payload,
    },
    parentOrigin,
  );
}

function makeFileFromPayload(payload: Record<string, any>): File {
  const fileName = payload.fileName || payload.name || 'document.xlsx';

  if (payload.file instanceof File) {
    return payload.file;
  }

  if (payload.blob instanceof Blob) {
    return new File([payload.blob], fileName, {
      type: payload.blob.type || payload.mimeType || 'application/octet-stream',
    });
  }

  const buffer = payload.buffer || payload.arrayBuffer || payload.bytes || payload.data;
  if (buffer instanceof ArrayBuffer) {
    return new File([buffer], fileName, {
      type: payload.mimeType || 'application/octet-stream',
    });
  }

  if (buffer instanceof Uint8Array) {
    const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
    return new File([arrayBuffer], fileName, {
      type: payload.mimeType || 'application/octet-stream',
    });
  }

  throw new Error('document:open requires url, file, blob, buffer, arrayBuffer, bytes, or data');
}

async function openFile(file: File, readonly = false): Promise<void> {
  await loadEditorApi();
  setDocmentObj({
    fileName: file.name,
    file,
    url: URL.createObjectURL(file),
  });
  await handleDocumentOperation({
    fileName: file.name,
    file,
    isNew: false,
    readonly,
  });
}

async function handleOpen(payload: Record<string, any>): Promise<void> {
  const readonly = Boolean(payload.readonly);

  if (payload.url) {
    await openDocumentFromUrl(String(payload.url), payload.fileName, {
      readonly,
      fetchOptions: payload.fetchOptions,
    });
    return;
  }

  await openFile(makeFileFromPayload(payload), readonly);
}

async function handleMessage(event: MessageEvent): Promise<void> {
  const message = event.data as EmbedMessage;
  if (!message || typeof message !== 'object' || !message.type?.startsWith('document:')) {
    return;
  }

  if (!shouldAcceptMessage(event)) {
    return;
  }

  parentOrigin = normalizeTargetOrigin(event.origin);
  const payload = message.payload || {};

  try {
    switch (message.type) {
      case 'document:open':
      case 'document:open-url':
      case 'document:open-file':
      case 'document:open-buffer':
        await handleOpen(payload);
        postToParent('document:opened', { readonly: getReadonlyMode() }, message.id);
        break;

      case 'document:set-readonly':
        setReadonlyMode(Boolean(payload.readonly));
        postToParent('document:readonly-changed', { readonly: getReadonlyMode() }, message.id);
        break;

      case 'document:save': {
        const file = await requestSaveDocument(payload.targetExt || 'XLSX', {
          returnOriginalOnTimeout: Boolean(payload.returnOriginalOnTimeout),
        });
        postToParent(
          'document:saved',
          {
            file,
            fileName: file.name,
            mimeType: file.type,
            size: file.size,
          },
          message.id,
        );
        break;
      }

      case 'document:get-state':
        postToParent(
          'document:state',
          { readonly: getReadonlyMode(), hasDocument: Boolean(window.editor) },
          message.id,
        );
        break;

      default:
        break;
    }
  } catch (error) {
    postToParent(
      'document:error',
      {
        message: error instanceof Error ? error.message : String(error),
      },
      message.id,
    );
  }
}

export function initEmbedApi(): void {
  if (initialized) {
    return;
  }

  initialized = true;
  isEmbedMode = detectEmbedMode();

  if (!isEmbedMode) {
    return;
  }

  document.body.classList.add('embed-mode');
  window.addEventListener('message', (event) => {
    void handleMessage(event);
  });

  window.addEventListener('load', () => {
    postToParent('document:ready');
  });
}
