import { vi } from 'vitest';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

URL.createObjectURL = vi.fn(() => 'blob:vitest-document');
URL.revokeObjectURL = vi.fn();

const storage = new Map<string, string>();
const localStorageMock: Storage = {
  get length() {
    return storage.size;
  },
  clear: vi.fn(() => storage.clear()),
  getItem: vi.fn((key: string) => storage.get(key) ?? null),
  key: vi.fn((index: number) => Array.from(storage.keys())[index] ?? null),
  removeItem: vi.fn((key: string) => {
    storage.delete(key);
  }),
  setItem: vi.fn((key: string, value: string) => {
    storage.set(key, String(value));
  }),
};

Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: localStorageMock,
});

Object.defineProperty(window, 'localStorage', {
  configurable: true,
  value: localStorageMock,
});
