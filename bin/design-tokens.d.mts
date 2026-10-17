export interface TokenAuditError {
  file: string;
  missing: string[];
}
export function unresolvedTokens(source: string, dependencies?: string[], external?: string[]): string[];
export function designTokenSources(root: string): string[];
export function authoredStyles(file: string, source: string): string;
export function auditDesignTokens(root: string, generated?: Array<{ rel: string; html: string }>): TokenAuditError[];
export function semanticLiterals(source: string): string[];
