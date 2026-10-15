import type { LLMProvider } from '@ranuts/agent-core/llm/types';

/** Owns endpoint connections independently of browser-model and view lifetimes. */
export class EndpointConnection {
  current: LLMProvider | null = null;
  pending: LLMProvider | null = null;
  revision = 0;

  constructor(private readonly onChange: () => void = () => {}) {}

  disconnect(): void {
    this.revision++;
    const providers = new Set([this.current, this.pending]);
    this.current = this.pending = null;
    for (const provider of providers) {
      if (provider && 'dispose' in provider && typeof provider.dispose === 'function') {
        try {
          void Promise.resolve(provider.dispose()).catch(() => {});
        } catch {
          /* Already disconnected. */
        }
      }
    }
    this.onChange();
  }

  async connect(create: () => LLMProvider): Promise<boolean> {
    this.disconnect();
    const revision = this.revision;
    try {
      const provider = create();
      this.pending = provider;
      this.onChange();
      if ('preload' in provider && typeof provider.preload === 'function') await provider.preload();
      if (revision !== this.revision) return false;
      if (!provider.isReady()) throw new Error('Writing endpoint is not ready');
      this.current = provider;
      this.pending = null;
      this.onChange();
      return true;
    } catch (error) {
      if (revision !== this.revision) return false;
      this.disconnect();
      throw error;
    }
  }
}
