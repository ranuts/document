/** Decode remote names without letting malformed percent escapes block opening. */
function decodeName(value: string): string | undefined {
  try {
    return decodeURIComponent(value);
  } catch {
    return undefined;
  }
}

export function remoteFileName(url: string, disposition: string | null, baseUrl: string): string {
  if (disposition) {
    // Quoted strings may contain semicolons and escaped quotes. Extended
    // parameters take precedence regardless of their order in the header.
    const parameters = [...disposition.matchAll(/(?:^|;)\s*(filename\*?)\s*=\s*("(?:\\.|[^"\\])*"|[^;]*)/gi)];
    const extended = parameters.find((match) => match[1].toLowerCase() === 'filename*');
    if (extended) {
      const value = extended[2].trim().replace(/^"|"$/g, '');
      const encoded = /^utf-8'[^']*'(.*)$/i.exec(value);
      const decoded = encoded && decodeName(encoded[1]);
      if (decoded) return decoded;
    }
    const ordinary = parameters.find((match) => match[1].toLowerCase() === 'filename');
    if (ordinary) {
      const value = ordinary[2].trim();
      const name = value.startsWith('"') ? value.slice(1, -1).replace(/\\(.)/g, '$1') : value;
      if (name) return name;
    }
  }
  try {
    const name = new URL(url, baseUrl).pathname.split('/').pop();
    return name ? decodeName(name) || name : 'document';
  } catch {
    return 'document';
  }
}
