/** The assembled full-text file, as it would be written. */
export function render(): string;
/**
 * Write public/llms-full.txt, or with `check` report whether it is current
 * without writing (true = up to date).
 */
export function generate(opts?: { check?: boolean }): boolean;
