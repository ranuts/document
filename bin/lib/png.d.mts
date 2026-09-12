/** Types for bin/lib/png.mjs -- see that file for what the sprites need. */

/** Encode an alpha mask as an 8-bit RGBA PNG (grey `255 - a` at opacity `a`). */
export function encodeAlphaPng(alpha: Uint8Array | number[], width: number, height: number): Buffer;

/** Read the alpha channel back out of an 8-bit RGBA, non-interlaced PNG. */
export function decodeAlphaPng(bytes: Uint8Array | Buffer): {
  width: number;
  height: number;
  alpha: Uint8Array;
};
