'use strict';
const assert=require('assert');

// Original lines1094..1103 execute two 241-step scrolls with Wait Vbl on
// every step. Software WebGL on CI can take much longer than nominal PAL
// time; retain the real execution/input path and bound this specific wait.
module.exports=async function waitForRoller2ScoresReturn(page){
  try{
    await page.waitForFunction(()=>{
      const controls=document.getElementById('roller2-game-controls');
      return controls&&['menu','error','ended','stopped'].includes(controls.dataset.phase);
    },null,{timeout:90000});
    const state=await page.locator('#roller2-game-controls').evaluate(element=>({...element.dataset}));
    assert.strictEqual(state.phase,'menu','Roller II scores return failed: '+JSON.stringify(state));
  }catch(error){
    const state=await page.locator('#roller2-game-controls').evaluate(element=>({...element.dataset})).catch(()=>null);
    throw new Error('Roller II scores return state: '+JSON.stringify(state)+'; '+error.message,{cause:error});
  }
};
