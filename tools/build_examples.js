/* jshint esversion: 6 */
'use strict';

// Reproducible synthetic .AMOS fixtures, using the original token layout.
// These are not emulator exports; internal AMOS reference offsets are left zero.
const { token: t, word: w, integer: n, identifier: id, text, binary } = require('../test/helpers/tokens');
const array = (name, indices, flags = 0) => [id(name, 6, flags | 0x40), t('('), indices.flatMap((value, i) => [...(i ? t(',') : []), ...value.flat(Infinity)]), t(')')];
const fn = (name, argument) => [t(name), t('('), argument, t(')')];
const complete = (lines, banks = []) => Buffer.concat([binary(lines), Buffer.from('AmBs'), Buffer.from(w(banks.length)), ...banks]);

// Original 16x16 robot tile, encoded as complete consecutive bitplanes.
const robot = Array.from({ length: 256 }, (_, i) => {
  const x = i % 16, y = Math.floor(i / 16);
  if (x < 3 || x > 12 || y < 2 || y > 13) return 0;
  if (x === 3 || x === 12 || y === 2 || y === 13) return 3;
  if (x === 4 && y === 8) return 2; // Asymmetric cheek shows horizontal flips.
  if ((y === 5 || y === 6) && [5, 6, 9, 10].includes(x)) return 2;
  if (y === 10 && x >= 6 && x <= 9) return 3;
  return 5;
});
function robotBank(type) {
  const planar = [];
  for (let plane = 0; plane < 4; plane++) {
    for (let y = 0; y < 16; y++) {
      let row = 0;
      for (let x = 0; x < 16; x++) if (robot[y * 16 + x] & (1 << plane)) row |= 0x8000 >>> x;
      planar.push(...w(row));
    }
  }
  const palette = [0x000, 0x123, 0xfff, 0xf80, 0x08f, 0x2c8, ...Array(26).fill(0)];
  return Buffer.concat([Buffer.from(type), Buffer.from([w(1), w(1), w(16), w(4), w(8), w(8), planar, palette.map(w)].flat(Infinity))]);
}

const programs = {
  Bobs: {
    source: [
      'Screen Open 0,320,200,16,Lowres', 'Get Bob Palette', 'Cls 0', 'Hot Spot 1,8,8',
      'Ink 4', 'Bar 16,80 To 304,160', 'Paper 0', 'Pen 2', 'Locate 2,2',
      'Print "Buffered Bobs: press a key"', 'Double Buffer', 'Autoback 0', 'Bob Update Off',
      'Set Bob 0,5,1,$66',
      'Bob 0,40,112,1', 'Bob 1,48,112,Hrev(1)', 'Bob Draw',
      'HITSTART=Bob Col(0,1 To 1)', 'OTHERSTART=Col(-1)', 'Wait Key', 'Screen Swap', 'Wait Key',
      'Limit Bob 0,48,80 To 128,160',
      'For X=40 To 120 Step 20', 'Bob 0,X+4,112,1', 'Bob 1,X+24,128,Hrev(1)',
      'Bob Update', 'Wait 3', 'Next X', 'HITEND=Bob Col(0)', 'OTHEREND=Col(1)',
      'Wait Key', 'Bob Off', 'Bob Update', 'Bob Update', 'End'
    ].join('\n') + '\n',
    data: complete([
      [t('Screen Open'), n(0), t(','), n(320), t(','), n(200), t(','), n(16), t(','), t('Lowres')],
      [t('Get Bob Palette')], [t('Cls Colour'), n(0)],
      [t('Hot Spot'), n(1), t(','), n(8), t(','), n(8)], [t('Ink'), n(4)],
      [t('Bar'), n(16), t(','), n(80), t('To'), n(304), t(','), n(160)],
      [t('Paper'), n(0)], [t('Pen'), n(2)], [t('Locate'), n(2), t(','), n(2)],
      [t('Print'), text('Buffered Bobs: press a key')], [t('Double Buffer')], [t('Autoback'), n(0)], [t('Bob Update Off')],
      [t('Set Bob'), n(0), t(','), n(5), t(','), n(1), t(','), n(0x66)],
      [t('Bob'), n(0), t(','), n(40), t(','), n(112), t(','), n(1)],
      [t('Bob'), n(1), t(','), n(48), t(','), n(112), t(','), fn('Hrev', n(1))],
      [t('Bob Draw')],
      [id('hitstart'), t('='), t('Bob Col Range'), t('('), n(0), t(','), n(1), t('To'), n(1), t(')')],
      [id('otherstart'), t('='), fn('Col', n(-1))],
      [t('Wait Key')], [t('Screen Swap')], [t('Wait Key')],
      [t('Limit Bob Area'), n(0), t(','), n(48), t(','), n(80), t('To'), n(128), t(','), n(160)],
      [t('For'), w(0), id('x'), t('='), n(40), t('To'), n(120), t('Step'), n(20)],
      [t('Bob'), n(0), t(','), id('x'), t('+'), n(4), t(','), n(112), t(','), n(1)],
      [t('Bob'), n(1), t(','), id('x'), t('+'), n(24), t(','), n(128), t(','), fn('Hrev', n(1))],
      [t('Bob Update')], [t('Wait'), n(3)], [t('Next'), id('x')],
      [id('hitend'), t('='), fn('Bob Col', n(0))], [id('otherend'), t('='), fn('Col', n(1))], [t('Wait Key')],
      [t('Bob Off')], [t('Bob Update')], [t('Bob Update')], [t('End')]
    ], [robotBank('AmSp')])
  },
  Graphics: {
    source: [
      'Screen Open 0,320,200,16,Lowres', 'Palette $000,$123,$FFF,$F80,$08F,$2C8',
      'Cls 0', 'Ink 4', 'Bar 16,80 To 144,160', 'Ink 5', 'Box 176,80 To 304,160',
      'Ink 3', 'Draw 16,160 To 144,80', 'Get Bob Palette', 'Ink 4',
      'Bar 192,96 To 239,143', 'Bar 248,96 To 295,143',
      'Paste Bob 200,104,1', 'Paste Icon 256,104,1', 'Paper 0', 'Pen 2',
      'Locate 2,2', 'Print "AMOScript"', 'Locate 2,4', 'Print "Press a key to continue"',
      'Wait Key', 'Make Icon Mask 1', 'Paste Icon 256,128,Hrev(1)',
      'No Mask 1', 'Paste Bob 200,128,Vrev(1)', 'Locate 2,6', 'Print "Ready"'
    ].join('\n') + '\n',
    data: complete([
      [t('Screen Open'), n(0), t(','), n(320), t(','), n(200), t(','), n(16), t(','), t('Lowres')],
      [t('Palette'), n(0x000), t(','), n(0x123), t(','), n(0xfff), t(','), n(0xf80), t(','), n(0x08f), t(','), n(0x2c8)],
      [t('Cls Colour'), n(0)], [t('Ink'), n(4)], [t('Bar'), n(16), t(','), n(80), t('To'), n(144), t(','), n(160)],
      [t('Ink'), n(5)], [t('Box'), n(176), t(','), n(80), t('To'), n(304), t(','), n(160)],
      [t('Ink'), n(3)], [t('Draw'), n(16), t(','), n(160), t('To'), n(144), t(','), n(80)],
      [t('Get Bob Palette')], [t('Ink'), n(4)],
      [t('Bar'), n(192), t(','), n(96), t('To'), n(239), t(','), n(143)],
      [t('Bar'), n(248), t(','), n(96), t('To'), n(295), t(','), n(143)],
      [t('Paste Bob'), n(200), t(','), n(104), t(','), n(1)],
      [t('Paste Icon'), n(256), t(','), n(104), t(','), n(1)],
      [t('Paper'), n(0)], [t('Pen'), n(2)], [t('Locate'), n(2), t(','), n(2)], [t('Print'), text('AMOScript')],
      [t('Locate'), n(2), t(','), n(4)], [t('Print'), text('Press a key to continue')],
      [t('Wait Key')], [t('Make Icon Mask Image'), n(1)],
      [t('Paste Icon'), n(256), t(','), n(128), t(','), fn('Hrev', n(1))],
      [t('No Mask Image'), n(1)], [t('Paste Bob'), n(200), t(','), n(128), t(','), fn('Vrev', n(1))],
      [t('Locate'), n(2), t(','), n(6)], [t('Print'), text('Ready')]
    ], [robotBank('AmSp'), robotBank('AmIc')])
  },
  ArraysData: {
    source: [
      'Dim GRID(1,2),NAME$(1)',
      'For I=0 To 1', 'For J=0 To 2', 'Read GRID(I,J)', 'Next J', 'Next I',
      'Read NAME$(0),NAME$(1)', 'Print GRID(0,0),GRID(1,2)', 'Print NAME$(0);NAME$(1)',
      'Restore ROW', 'Read AGAIN', 'Print AGAIN',
      'ROW: Data 1,2,3,4,5,6,"AMOS","cript"'
    ].join('\n') + '\n',
    data: complete([
      [t('Dim'), array('grid', [n(1), n(2)]), t(','), array('name', [n(1)], 2)],
      [t('For'), w(0), id('i'), t('='), n(0), t('To'), n(1)],
      [t('For'), w(0), id('j'), t('='), n(0), t('To'), n(2)],
      [t('Read'), array('grid', [id('i'), id('j')])], [t('Next'), id('j')], [t('Next'), id('i')],
      [t('Read'), array('name', [n(0)], 2), t(','), array('name', [n(1)], 2)],
      [t('Print'), array('grid', [n(0), n(0)]), t(','), array('grid', [n(1), n(2)])],
      [t('Print'), array('name', [n(0)], 2), t(';'), array('name', [n(1)], 2)],
      [t('Restore'), id('row', 0x18)], [t('Read'), id('again')], [t('Print'), id('again')],
      [id('row', 0xc), t('Data'), w(0), n(1), t(','), n(2), t(','), n(3), t(','), n(4), t(','), n(5), t(','), n(6), t(','), text('AMOS'), t(','), text('cript')]
    ])
  },
  SequentialFile: {
    source: [
      'Open Out 1,"greetings.txt"', 'Print #1,"AMOS";",";42', 'Close 1',
      'Open In 1,"greetings.txt"', 'Input #1,A$,N', 'Close 1', 'Print Upper$(A$);" ";N'
    ].join('\n') + '\n',
    data: complete([
      [t('Open Out'), n(1), t(','), text('greetings.txt')],
      [t('Print#'), n(1), t(','), text('AMOS'), t(';'), text(','), t(';'), n(42)],
      [t('Close'), n(1)], [t('Open In'), n(1), t(','), text('greetings.txt')],
      [t('Input#'), n(1), t(','), id('a', 6, 2), t(','), id('n')], [t('Close'), n(1)],
      [t('Print'), fn('Upper$', id('a', 6, 2)), t(';'), text(' '), t(';'), id('n')]
    ])
  }
};

if (require.main === module) {
  const fs = require('fs');
  const path = require('path');
  for (const [name, program] of Object.entries(programs)) {
    fs.writeFileSync(path.join(__dirname, '../examples', `${name}.AMOS`), program.data);
    fs.writeFileSync(path.join(__dirname, '../examples', `${name}.Asc`), program.source);
  }
}

module.exports = programs;
