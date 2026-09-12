/**
 * A password-protected workbook, built rather than checked in.
 *
 * When Office encrypts an OOXML file it stops being a zip: the whole package
 * is wrapped in an OLE2 compound file (the pre-2007 container) holding two
 * streams, `EncryptionInfo` and `EncryptedPackage`. Nothing about the outside
 * of that file says "encrypted" -- the extension is still .xlsx and only the
 * first eight bytes give it away -- which is why it is worth a fixture: it is
 * a file a user will hand us, and it cannot be opened by anything we ship.
 *
 * Only the container is real here. The two streams hold filler, because what
 * is under test is what happens to a file the engine cannot unpack, not
 * decryption (there is none to do -- x2t has no key and we never ask for one).
 */

const SECTOR = 512;
const FREESECT = 0xffffffff;
const ENDOFCHAIN = 0xfffffffe;
const FATSECT = 0xfffffffd;

/** One 128-byte directory entry. */
const dirEntry = (
  name: string,
  type: 1 | 2 | 5,
  opts: { child?: number; right?: number; start?: number; size?: number } = {},
): Uint8Array => {
  const entry = new Uint8Array(128);
  const view = new DataView(entry.buffer);
  // The name is UTF-16LE and the length counts its bytes including the null.
  for (let i = 0; i < name.length; i++) view.setUint16(i * 2, name.charCodeAt(i), true);
  view.setUint16(64, name.length * 2 + 2, true);
  entry[66] = type;
  entry[67] = 1; // black, so a reader that walks the tree does not rebalance
  view.setUint32(68, FREESECT, true); // left sibling
  view.setUint32(72, opts.right ?? FREESECT, true);
  view.setUint32(76, opts.child ?? FREESECT, true);
  view.setUint32(116, opts.start ?? ENDOFCHAIN, true);
  view.setUint32(120, opts.size ?? 0, true);
  return entry;
};

/** Bytes that look exactly like an encrypted .xlsx and cannot be opened. */
export function buildEncryptedOoxml(): Uint8Array {
  const out = new Uint8Array(SECTOR * 5);
  const view = new DataView(out.buffer);

  // -- header ------------------------------------------------------------
  out.set([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1], 0);
  view.setUint16(0x18, 0x003e, true); // minor version
  view.setUint16(0x1a, 0x0003, true); // major version 3 -> 512-byte sectors
  view.setUint16(0x1c, 0xfffe, true); // little endian
  view.setUint16(0x1e, 9, true); // sector shift: 1 << 9
  view.setUint16(0x20, 6, true); // mini sector shift
  view.setUint32(0x2c, 1, true); // one FAT sector
  view.setUint32(0x30, 1, true); // directory starts at sector 1
  view.setUint32(0x38, 4096, true); // mini stream cutoff
  view.setUint32(0x3c, ENDOFCHAIN, true); // no mini FAT
  view.setUint32(0x44, ENDOFCHAIN, true); // no DIFAT
  view.setUint32(0x4c, 0, true); // DIFAT[0]: the FAT lives in sector 0
  for (let i = 1; i < 109; i++) view.setUint32(0x4c + i * 4, FREESECT, true);

  // -- sector 0: the FAT -------------------------------------------------
  const fat = SECTOR;
  const chain = [FATSECT, ENDOFCHAIN, ENDOFCHAIN, ENDOFCHAIN];
  for (let i = 0; i < SECTOR / 4; i++) view.setUint32(fat + i * 4, chain[i] ?? FREESECT, true);

  // -- sector 1: the directory ------------------------------------------
  const dir = SECTOR * 2;
  out.set(dirEntry('Root Entry', 5, { child: 1 }), dir);
  out.set(dirEntry('EncryptionInfo', 2, { right: 2, start: 2, size: SECTOR }), dir + 128);
  out.set(dirEntry('EncryptedPackage', 2, { start: 3, size: SECTOR }), dir + 256);
  out.fill(0, dir + 384, dir + 512); // the fourth slot stays unused
  for (const slot of [3]) view.setUint32(dir + slot * 128 + 66, 0, true); // type 0 = unallocated

  // -- sectors 2 and 3: the streams themselves ---------------------------
  // A plausible EncryptionInfo version header (4.4, agile encryption), then
  // filler standing in for ciphertext nobody is going to decrypt.
  view.setUint16(SECTOR * 3, 4, true);
  view.setUint16(SECTOR * 3 + 2, 4, true);
  out.fill(0x5a, SECTOR * 3 + 8, SECTOR * 4);
  out.fill(0xa5, SECTOR * 4, SECTOR * 5);

  return out;
}
