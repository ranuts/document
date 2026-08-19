import { getDocumentMimeType } from '@ranuts/shared/document-utils';

// Naming and byte-shape helpers shared by the save paths.

export function getSavedFileMimeType(fileName: string): string {
  return getDocumentMimeType(fileName);
}

export function getNormalizedFile(file: File): File {
  const mimeType = !file.type || file.type === 'application/octet-stream' ? getSavedFileMimeType(file.name) : file.type;
  return new File([file], file.name, { type: mimeType });
}

export function toUint8Array(data: BlobPart): Uint8Array {
  if (data instanceof Uint8Array) {
    return data;
  }
  if (data instanceof ArrayBuffer) {
    return new Uint8Array(data);
  }
  if (ArrayBuffer.isView(data)) {
    const arrayBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
    return new Uint8Array(arrayBuffer);
  }
  throw new Error('Unsupported saved data type');
}

export function getFileExtension(fileName: string): string {
  return fileName.split('.').pop()?.toUpperCase() || '';
}
