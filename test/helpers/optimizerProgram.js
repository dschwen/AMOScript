/* jshint esversion: 6 */
'use strict';
const { binary, token: t, word: w, integer: n, identifier: id, text } = require('./tokens');
module.exports = () => binary([
  [id('a'), t('='), n(1)], [id('b'), t('='), n(2)],
  [t('Do'), w(0)],
  ...Array.from({ length: 12 }, (_, i) => [id(i % 2 ? 'a' : 'b'), t('='), id('a'), t('+'), n(1)]),
  [id('s', 6, 2), t('='), text('Grüße')], [id('x', 6, 1), t('='), id('a'), t('/'), n(3)],
  [t('Loop')]
]);
