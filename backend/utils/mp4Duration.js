// Reads a video's real length (seconds) from its MP4 / MOV header: the "moov" box holds an
// "mvhd" box with a time scale and a duration. Only the bytes needed are read, so it works on
// local files and on remote files through HTTP range requests.

const MAX_MOOV = 32 * 1024 * 1024;

const readBoxHeader = (buf, offset) => {
  if (offset + 8 > buf.length) return null;
  let size = buf.readUInt32BE(offset);
  const type = buf.toString('latin1', offset + 4, offset + 8);
  let headerSize = 8;
  if (size === 1) {
    if (offset + 16 > buf.length) return null;
    size = Number(buf.readBigUInt64BE(offset + 8));
    headerSize = 16;
  }
  return { size, type, headerSize };
};

/** Duration in seconds from the contents of a "moov" box, or null */
const durationFromMoov = (moov) => {
  let offset = 0;
  while (offset + 8 <= moov.length) {
    const box = readBoxHeader(moov, offset);
    if (!box || box.size < 8) return null;
    if (box.type === 'mvhd') {
      const p = offset + box.headerSize;
      const version = moov.readUInt8(p);
      const timescale = version === 1 ? moov.readUInt32BE(p + 20) : moov.readUInt32BE(p + 12);
      const duration = version === 1 ? Number(moov.readBigUInt64BE(p + 24)) : moov.readUInt32BE(p + 16);
      if (!timescale || !duration) return null;
      return duration / timescale;
    }
    offset += box.size;
  }
  return null;
};

/**
 * @param {(start: number, end: number) => Promise<Buffer>} readRange  inclusive byte range reader
 * @param {number} fileSize
 * @returns {Promise<number|null>} seconds, or null if no MP4/MOV duration was found
 */
const readMp4Duration = async (readRange, fileSize) => {
  let offset = 0;
  let guard = 0;
  while (offset + 8 <= fileSize && guard++ < 64) {
    const head = await readRange(offset, Math.min(fileSize - 1, offset + 15));
    const box = readBoxHeader(head, 0);
    if (!box || box.size < 8) return null;
    const size = box.size === 0 ? fileSize - offset : box.size;
    if (box.type === 'moov') {
      if (size > MAX_MOOV) return null;
      const moov = await readRange(offset + box.headerSize, offset + size - 1);
      return durationFromMoov(moov);
    }
    offset += size;
  }
  return null;
};

module.exports = { readMp4Duration };
