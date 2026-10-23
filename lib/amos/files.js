/* jshint esversion: 6 */
'use strict';

function createMemoryFiles(initial = {}) {
  const contents = new Map(Object.entries(initial));
  return {
    read(name) {
      if (!contents.has(name)) {
        const error = new Error(`File not found: ${name}`);
        error.code = 'ENOENT';
        throw error;
      }
      return contents.get(name);
    },
    write(name, text) { contents.set(name, text); },
    snapshot() { return Object.fromEntries(contents); }
  };
}

// Resolve relative AMOS filenames against an explicit host working directory.
// This is a filesystem adapter, not a filesystem sandbox.
function createNodeFiles(directory = '.') {
  const fs = require('fs');
  const path = require('path');
  const base = path.resolve(directory);
  return {
    read(name) { return fs.readFileSync(path.resolve(base, name), 'latin1'); },
    write(name, text) { fs.writeFileSync(path.resolve(base, name), text, 'latin1'); }
  };
}

if (typeof module === 'object' && module.exports) module.exports = { createMemoryFiles, createNodeFiles };
else globalThis.AMOS_FILES = { createMemoryFiles, createNodeFiles };
