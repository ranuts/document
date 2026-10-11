interface Suggestion {
  tool: string;
  input: Readonly<Record<string, unknown>>;
}
/** Ephemeral reference, never an executable plan or persisted tool receipt. */
export class ProposalContext {
  private read?: () => Suggestion | undefined;
  select(read: () => Suggestion | undefined): void {
    this.read = read;
  }
  clear(): void {
    this.read = undefined;
  }
  capture(): { kind: 'none' | 'expired' } | { kind: 'selected'; plan: Suggestion } {
    if (!this.read) return { kind: 'none' };
    const plan = this.read();
    return plan ? { kind: 'selected', plan } : { kind: 'expired' };
  }
}
