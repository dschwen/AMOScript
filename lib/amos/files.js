/* jshint esversion: 6 */
'use strict';

function createMemoryFiles(initial = {}, choices = []) {
  if (!Array.isArray(choices)) throw new Error('File selections must be an array');
  const contents = new Map(Object.entries(initial));
  const selections = choices.slice(), requests = [];
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
  return {
    read(name) { return fs.readFileSync(path.resolve(base, name), 'latin1'); },
    write(name, text) { fs.writeFileSync(path.resolve(base, name), text, 'latin1'); }
  };
}

if (typeof module === 'object' && module.exports) module.exports = { createMemoryFiles, createNodeFiles };
else globalThis.AMOS_FILES = { createMemoryFiles, createNodeFiles };
