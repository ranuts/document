export type DocumentType = 'word' | 'cell' | 'slide';

export interface EditorCreateConfig {
  fileName: string;
  fileType: string;
  lang?: string;
}

export interface EditorAdapter {
  /** Load SDK scripts and warm up the editor environment */
  load(): Promise<void>;
  /** Create a new empty document of the given extension */
  openNew(ext: string): Promise<void>;
  /** Open the OS file picker */
  openPicker(): void;
  /** Open a document from a URL */
  openFromUrl(url: string | URL, fileName?: string): Promise<void>;
  /** Open a document from raw bytes (embed API) */
  openFromBytes(data: Uint8Array | ArrayBuffer | Blob | File, fileName: string): Promise<void>;
  /** Switch readonly mode */
  setReadonly(value: boolean): void;
  getReadonly(): boolean;
  /** Trigger save and return the resulting File */
  save(targetExt: string): Promise<File>;
  /** Register app-level callbacks */
  setCallbacks(callbacks: { onFileOpened?: (file: File) => void; onError?: (message: string) => void }): void;
}
