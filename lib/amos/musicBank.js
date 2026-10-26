/* jshint esversion: 6 */
'use strict';

// Owned, bounded AMOS Music payload decoder. Offsets are relative to their
// section/song, not file or emulated machine addresses. No playback or host APIs.
function readMusicBank(bytes) {
  const fail = message => { throw new Error(`AMOS Music: ${message}`); };
  if (!ArrayBuffer.isView(bytes) || Object.prototype.toString.call(bytes) !== '[object Uint8Array]') fail('expected byte storage');
  if (bytes.length > 16 * 1024 * 1024) fail('payload exceeds 16 MiB');
  const bounds = (offset, length, end = bytes.length) => {
    if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length) || offset < 0 || length < 0 || offset > end - length) fail(`invalid range at byte ${offset}`);
  };
  const word = offset => { bounds(offset, 2); return bytes[offset] * 256 + bytes[offset + 1]; };
  const long = offset => word(offset) * 65536 + word(offset + 2);
  const name = (offset, length) => { bounds(offset, length); return String.fromCharCode(...bytes.subarray(offset, offset + length)).split('\0')[0]; };
  bounds(0, 16);
  const instrumentBase = long(0), songBase = long(4), patternBase = long(8);
  if (instrumentBase < 16 || instrumentBase % 2 || songBase % 2 || patternBase % 2 ||
      songBase <= instrumentBase || patternBase <= songBase || patternBase >= bytes.length) fail('invalid section offsets');
  const instrumentCount = word(instrumentBase), songCount = word(songBase), patternCount = word(patternBase);
  if (!instrumentCount || instrumentCount > 256 || !songCount || songCount > 256 || !patternCount || patternCount > 256) fail('unsupported table count');
  const instrumentEnd = instrumentBase + 2 + instrumentCount * 32, songTableEnd = songBase + 2 + songCount * 4;
  bounds(instrumentBase + 2, instrumentCount * 32, songBase); bounds(songBase + 2, songCount * 4, patternBase);
  const instruments = Array.from({ length: instrumentCount }, (_, index) => {
    const at = instrumentBase + 2 + index * 32, start = instrumentBase + long(at), repeat = instrumentBase + long(at + 4);
    const length = word(at + 8) * 2, repeatLength = word(at + 10) * 2, volume = word(at + 12), storedLength = word(at + 14) * 2;
    if (start % 2 || repeat % 2 || start < instrumentEnd || repeat < instrumentEnd || !length || !repeatLength || storedLength < length) fail(`invalid instrument ${index}`);
    bounds(start, storedLength, songBase); bounds(repeat, repeatLength, songBase);
    return { number: index, name: name(at + 16, 16), offset: start, repeatOffset: repeat, length, repeatLength, storedLength, volume,
      pcm: Uint8Array.from(bytes.subarray(start, start + length)), repeatPcm: Uint8Array.from(bytes.subarray(repeat, repeat + repeatLength)), storedPcm: Uint8Array.from(bytes.subarray(start, start + storedLength)) };
  });
  const tableEnd = patternBase + 2 + patternCount * 8;
  bounds(patternBase + 2, patternCount * 8);
  const offsets = Array.from({ length: patternCount * 4 }, (_, index) => word(patternBase + 2 + index * 2));
  for (const offset of offsets) if (offset && (offset % 2 || patternBase + offset < tableEnd || patternBase + offset >= bytes.length)) fail('invalid pattern offset');
  const unique = [...new Set(offsets.filter(Boolean))].sort((a, b) => a - b), streams = new Map();
  for (const [index, offset] of unique.entries()) {
    const start = patternBase + offset, end = index + 1 < unique.length ? patternBase + unique[index + 1] : bytes.length;
    if ((end - start) % 2 || end - start < 2) fail('invalid pattern length');
    const words = Uint16Array.from({ length: (end - start) / 2 }, (_, i) => word(start + i * 2));
    if (words[words.length - 1] !== 0x8000 || words.slice(0, -1).includes(0x8000)) fail('pattern must end at its sole end marker');
    streams.set(offset, { offset: start, words });
  }
  const patterns = Array.from({ length: patternCount }, (_, index) => offsets.slice(index * 4, index * 4 + 4).map(offset => offset ? streams.get(offset) : null));
  const songOffsets = Array.from({ length: songCount }, (_, index) => songBase + long(songBase + 2 + index * 4));
  if (new Set(songOffsets).size !== songCount || songOffsets.some(offset => offset % 2 || offset < songTableEnd || offset > patternBase - 28)) fail('invalid song offset');
  const sortedSongs = [...songOffsets].sort((a, b) => a - b);
  const songs = songOffsets.map((start, index) => {
    const next = sortedSongs.indexOf(start) + 1, end = next < sortedSongs.length ? sortedSongs[next] : patternBase;
    const starts = Array.from({ length: 4 }, (_, v) => start + word(start + v * 2));
    if (starts.some(offset => offset % 2 || offset < start + 28 || offset > end - 2)) fail('invalid song voice offset');
    const boundaries = [...new Set(starts)].sort((a, b) => a - b);
    const voices = starts.map(at => {
      const next = boundaries.indexOf(at) + 1, limit = next < boundaries.length ? boundaries[next] : end, orders = [];
      for (let offset = at; offset < limit && orders.length <= 4096; offset += 2) {
        const value = word(offset);
        if (value === 0xfffe || value === 0xffff) return { orders, loop: value === 0xfffe };
        if (value >= patternCount) fail('invalid song pattern number');
        orders.push(value);
      }
      return fail('unterminated/oversized song voice list');
    });
    return { number: index + 1, name: name(start + 12, 16), tempo: word(start + 8), voices };
  });
  return { version: 1, byteLength: bytes.length, instrumentBase, songBase, patternBase, instruments, songs, patterns };
}

if (typeof module === 'object' && module.exports) module.exports = readMusicBank;
else globalThis.AMOS_MUSIC_BANK = readMusicBank;
