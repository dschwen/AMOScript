/* jshint esversion: 6 */
'use strict';
// Current playable asset set; keep older bounded fixtures byte-for-byte frozen.
module.exports = function roller2CurrentAssets() {
  const fs = require('fs'), path = require('path'), root = path.join(__dirname, '../../examples/Roller2/current');
  return Object.fromEntries(Object.entries(require('../../examples/Roller2/current/manifest.json').files).map(([name, entry]) => [`rii:${name}`, fs.readFileSync(path.join(root, entry.path), 'latin1')]));
};
