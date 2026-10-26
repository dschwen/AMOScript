/* jshint esversion: 6 */
'use strict';

// Browser/headless prepared byte-string filesystem. Case/volume mapping belongs
// here, not in AMOS operations. Writes stay in session memory, never on disk.
function createRoller2GameFiles(initial) {
  const contents = new Map(Object.entries(initial).map(([name, bytes]) => [name.toLowerCase(), bytes])), writes = [];
  const key = name => name.toLowerCase();
  function isDirectory(name) {
    const prefix = /[:/]$/.test(name) ? key(name) : `${key(name)}/`;
    return [...contents.keys()].some(path => path.startsWith(prefix) && path !== prefix);
  }
  return {
    isDirectory, exists: name => contents.has(key(name)) || isDirectory(name),
    read(name) {
      if (!contents.has(key(name))) { const error = new Error(`Missing Roller II asset: ${name}`); error.code = 'ENOENT'; throw error; }
      return contents.get(key(name));
    },
    write(name, bytes) { contents.set(key(name), bytes); writes.push({ name, bytes: bytes.length }); },
    writes, snapshot: () => Object.fromEntries(contents)
  };
}
module.exports = createRoller2GameFiles;
