'use strict';
const assert=require('assert'),path=require('path');
module.exports=async function checkFullscreenControls(browser){
  for(const touch of [false,true]){
    const context=await browser.newContext({viewport:{width:960,height:600},hasTouch:touch,isMobile:touch});
    const page=await context.newPage();
    try{
      await page.setContent('<meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}canvas{border:1px solid red}#surface{border:1px solid red;border-radius:8px}</style><section id="game"><div class="amos-fullscreen-toolbar"><button id="enter">Fullscreen</button><button id="stop">Stop</button></div><div id="surface"><canvas width="320" height="200"></canvas></div></section>');
      await page.addScriptTag({path:path.join(__dirname,'../../lib/amos/fullscreen.js')});
      await page.evaluate(()=>{globalThis.testFullscreen=AMOS_FULLSCREEN.createFullscreenHost(document.querySelector('#game'),{button:document.querySelector('#enter'),surface:document.querySelector('#surface')});});
      await page.click('#enter');await page.waitForFunction(()=>!!document.fullscreenElement);
      // Chromium delivers its fullscreen resize after fullscreenchange.
      await page.waitForTimeout(150);
      const visible=()=>page.locator('.amos-fullscreen-toolbar').isVisible();
      assert.strictEqual(await visible(),false,'Landscape controls start hidden');
      const geometry=await page.evaluate(()=>{const s=document.querySelector('#surface').getBoundingClientRect(),c=document.querySelector('canvas').getBoundingClientRect();return{surface:[s.x,s.y,s.width,s.height],viewport:[innerWidth,innerHeight],canvas:[c.width,c.height],border:getComputedStyle(document.querySelector('canvas')).borderTopWidth};});
      assert.deepStrictEqual(geometry.surface,[0,0,...geometry.viewport]);assert.strictEqual(geometry.border,'0px');assert.ok(Math.abs(geometry.canvas[0]/geometry.canvas[1]-1.6)<.01);assert.ok(geometry.canvas[0]>=geometry.viewport[0]-1||geometry.canvas[1]>=geometry.viewport[1]-1,'Canvas fills at least one axis');
      if(!touch){
        await page.mouse.move(10,1);assert.strictEqual(await visible(),true);
        const panel=await page.locator('.amos-fullscreen-toolbar').boundingBox();await page.mouse.move(panel.x+panel.width/2,panel.y+panel.height/2);assert.strictEqual(await visible(),true,'Panel stays open while using controls');
        await page.mouse.move(300,300);assert.strictEqual(await visible(),false);
        await page.keyboard.press('Tab');assert.strictEqual(await visible(),true,'Keyboard users can reveal controls');
        await page.mouse.move(300,300);
      }
      const session=await context.newCDPSession(page);
      await session.send('Emulation.setDeviceMetricsOverride',{width:600,height:900,screenWidth:600,screenHeight:900,deviceScaleFactor:1,mobile:touch});
      await page.waitForFunction(()=>innerHeight>innerWidth);
      assert.strictEqual(await visible(),touch,'Only touch portrait keeps controls visible');
      await session.send('Emulation.setDeviceMetricsOverride',{width:960,height:600,screenWidth:960,screenHeight:600,deviceScaleFactor:1,mobile:touch});await page.waitForFunction(()=>innerWidth>innerHeight);
      // Leaving the panel clears any keyboard/pointer reveal before checking orientation.
      await page.mouse.move(300,300);assert.strictEqual(await visible(),false);
      await page.evaluate(()=>testFullscreen.dispose());await page.waitForFunction(()=>!document.fullscreenElement);
      assert.strictEqual(await page.locator('#game').getAttribute('class'),'');
      assert.strictEqual(await page.locator('canvas').evaluate(c=>c.style.width),'');
    }finally{await context.close();}
  }
  console.log('Fullscreen controls passed: edge reveal, keyboard access, touch portrait/landscape, borderless full-area sizing and disposal.');
};
