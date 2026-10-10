export function verifyArchive(
  root: string,
  manifest: { version: number; files: { path: string; sha256: string }[] },
  options?: { syntax?: boolean },
): number;
