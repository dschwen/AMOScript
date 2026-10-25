/* jshint esversion: 6 */
'use strict';
const assert=require('assert');
const {binary,token:t,integer:n,identifier:id,text,execute,compile}=require('./helpers/program');
test('branches: uncached integer identifiers resolve named Goto/Gosub targets without reading variables',()=>{
  const {logs}=execute(binary([[t('Goto'),id('start')],[id('sub',0xc),t('Print'),text('sub')],[t('Return')],
    [id('start',0xc),t('Gosub'),id('sub')],[t('Print'),text('end')],[t('End')]]));
  assert.deepStrictEqual(logs,[['sub'],['end']]);
  assert.throws(()=>compile(binary([[t('Goto'),id('missing')]])),/Unresolved label missing.*line 1/);
  assert.throws(()=>compile(binary([[t('Goto'),id('target',6,2)]])),/expression targets are not implemented/);
  assert.throws(()=>compile(binary([[t('Goto'),id('target'),t('('),n(1),t(')')]])),/Expected end of statement/);
});
