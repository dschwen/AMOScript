'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Transpiler = require('../lib/Transpiler');

test('lowering: Test21.AMOS emits goto/gosub and a label', () => {
  const buf = fs.readFileSync(path.join(__dirname, '..', 'examples', 'Test21.AMOS'));
  const t = new Transpiler(buf);
  const kinds = t._ops.map(o => o.kind);
  const labels = Object.keys(t._labels);

  assert.ok(kinds.includes('goto'), 'expected a goto op');
  assert.ok(kinds.includes('gosub'), 'expected a gosub op');
  assert.ok(labels.length > 0, 'expected at least one label');
});

