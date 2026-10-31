/* jshint esversion: 6 */
'use strict';

function createMemoryFiles(initial = {}, choices = [], directories = [], { capacity = 16 * 1024 * 1024 } = {}) {
  if (!Number.isInteger(capacity) || capacity < 0 || capacity > 2147483647) throw Error('Invalid memory filesystem capacity');
  if (!Array.isArray(choices)) throw new Error('File selections must be an array');
  if (!Array.isArray(directories) || directories.some(name => typeof name !== 'string')) throw new Error('Directories must be an array of paths');
  const contents = new Map(Object.entries(initial));
  const displayNames = new Map(Object.keys(initial).map(name => [name, name]));
  const used = () => [...contents.values()].reduce((sum, bytes) => sum + bytes.length, 0);
  const directoryPath = name => !name || /[:/]$/.test(name) ? name : `${name}/`;
  const knownDirectories = new Set(directories.map(directoryPath));
  function isDirectory(name) {
    const path = directoryPath(name);
    return !path || knownDirectories.has(path) || [...contents.keys(), ...knownDirectories].some(key => key.startsWith(path) && key !== path);
  }
  const selections = choices.slice(), requests = [];
  return {
    isDirectory,
    exists: name => contents.has(name) || isDirectory(name),
    read(name) {
      if (!contents.has(name)) {
        const error = new Error(`File not found: ${name}`);
        error.code = 'ENOENT';
        throw error;
      }
      return contents.get(name);
    },
    write(name, text, displayName = name) {
      if (used() - (contents.get(name) || '').length + text.length > capacity) throw Error('Memory filesystem full');
      contents.set(name, text); displayNames.set(name, displayName);
    },
    remove(name) {
      if (!contents.has(name)) throw Error('File not found: ' + name);
      contents.delete(name); displayNames.delete(name);
    },
    freeSpace() { return Math.max(0, capacity - used()); },
    list(name) {
      if (!isDirectory(name)) throw Error('Directory not found: ' + name);
      const prefix = directoryPath(name), result = new Map();
      for (const key of [...contents.keys(), ...knownDirectories]) if (key.startsWith(prefix) && key !== prefix) {
        const relative = key.slice(prefix.length), slash = relative.indexOf('/');
        const directory = slash >= 0 || knownDirectories.has(key), canonical = slash >= 0 ? relative.slice(0, slash) : relative;
        const shown = (displayNames.get(key) || key).slice(prefix.length).split('/')[0];
        if (!result.has(canonical)) result.set(canonical, { name: shown, size: directory ? 0 : contents.get(key).length, directory });
      }
      return [...result.values()];
    },
    snapshot() { return Object.fromEntries(contents); },
    select(request) {
      if (!selections.length) throw new Error('No queued file selection: prepare a choice before execution');
      requests.push(Object.freeze({ ...request }));
      return selections.shift();
    },
    queueSelection(name) {
      if (typeof name !== 'string') throw new Error('File selection must be a string');
      selections.push(name);
    },
    selectionRequests() { return requests.slice(); }
  };
}

// Resolve relative AMOS filenames against an explicit host working directory.
// This is a filesystem adapter, not a filesystem sandbox.
function createNodeFiles(directory = '.') {
  const fs = require('fs');
  const path = require('path');
  const base = path.resolve(directory);
  function stat(name) {
    try { return fs.statSync(path.resolve(base, name)); }
    catch (error) { if (['ENOENT', 'ENOTDIR'].includes(error.code)) return null; throw error; }
  }
  return {
    exists: name => stat(name) != null,
    isDirectory(name) { const entry = stat(name); return !!entry && entry.isDirectory(); },
    read(name) { return fs.readFileSync(path.resolve(base, name), 'latin1'); },
    write(name, text) { fs.writeFileSync(path.resolve(base, name), text, 'latin1'); },
    remove(name) { fs.unlinkSync(path.resolve(base, name)); },
    freeSpace(name) { const info = fs.statfsSync(path.resolve(base, name || '.')); return Math.min(2147483647, info.bavail * info.bsize); },
    list(name) {
      return fs.readdirSync(path.resolve(base, name || '.')).map(entry => {
        const info = fs.statSync(path.resolve(base, name, entry));
        return { name: entry, size: info.isDirectory() ? 0 : info.size, directory: info.isDirectory() };
      });
    }
  };
}

if (typeof module === 'object' && module.exports) module.exports = { createMemoryFiles, createNodeFiles };
else globalThis.AMOS_FILES = { createMemoryFiles, createNodeFiles };
