/* jshint esversion: 6 */
'use strict';

module.exports = async function screenWindowProbe(page) {
  const fs = require('fs'), path = require('path'), Transpiler = require('../../lib/Transpiler');
  const directory = path.join(__dirname, '../../examples/Wonderland');
  const names = ['Landscape.Iff','Score_Panel.Iff','Editor_Panel.Iff'];
  const assets = names.map(name => ({ name, bytes: fs.readFileSync(path.join(directory,name)).toString('base64'),
    png: fs.readFileSync(path.join(__dirname,'../fixtures/wonderland',`${name}.png`)).toString('base64') }));
  const image = fs.readFileSync(path.join(directory,'Landscape.Iff'));
  let palette;
  for(let at=12;at<image.length;) { const length=image.readUInt32BE(at+4); if(image.toString('ascii',at,at+4)==='CMAP') {
    palette=Array.from({length:length/3},(_,i)=>((image[at+8+i*3]>>4)<<8)|((image[at+9+i*3]>>4)<<4)|(image[at+10+i*3]>>4)); break;
  } at+=8+length+(length&1); }
  const sources = [1,2].map(game=>new Transpiler(require('./wonderlandScreens')(game,1)).toModule());
  return page.evaluate(async ({assets,palette,sources}) => {
    const requireCheck=(condition,message)=>{if(!condition)throw new Error(message);};
    const originals = new Map();
    for(const asset of assets) {
      const image=new Image();image.src=`data:image/png;base64,${asset.png}`;await image.decode();
      const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
      const context=canvas.getContext('2d');context.drawImage(image,0,0);
      originals.set(asset.name,{width:image.width,rgba:context.getImageData(0,0,image.width,image.height).data});
    }
    let frames=0, comparedPixels=0, gapRows=0;
    const sizes=[];
    for(let index=0;index<sources.length;index++) {
      let time=0,seq=0;const tasks=new Map(),module={exports:{}};new Function('module',sources[index])(module);
      const program=module.exports({now:()=>time,setTimeout:(fn,ms)=>{tasks.set(++seq,{fn,at:time+ms});return seq;},clearTimeout:id=>tasks.delete(id),
        files:{read:name=>{const asset=assets.find(asset=>name.endsWith(`/${asset.name}`));if(!asset)throw new Error(`Missing asset ${name}`);return atob(asset.bytes);}}});
      const canvas=document.createElement('canvas'),host=AMOS_BROWSER.createCanvasHost(canvas);
      try {
        host.attach(program);program.tick(1000);requireCheck(tasks.size===1,'Expected original Wait Vbl');
        const [id,task]=tasks.entries().next().value;tasks.delete(id);time=task.at;task.fn();
        const d=program.display,game=index+1,fieldHeight=game===1?168:144,panelName=game===1?'Score_Panel.Iff':'Editor_Panel.Iff';
        if(game===1)d.setPalette(...palette); // Explicitly restore the source landscape palette after the original black setup.
        const offsets=game===1?[[0,0],[37,84],[640,120]]:[[0,0],[320,144]];
        for(const [xOffset,yOffset]of offsets) {
          d.screenOffset(0,xOffset,yOffset);host.render();
          const actual=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
          const snapshot=d.snapshotDisplay(),cpu=d.renderDisplay();
          requireCheck(canvas.width===320&&canvas.height===fieldHeight+34,'Incorrect split-screen dimensions');
          for(let y=0;y<canvas.height;y++)for(let x=0;x<320;x++) {
            const at=(y*320+x)*4,reference=(y*640+x*2)*4;
            for(let c=0;c<4;c++)requireCheck(actual[at+c]===cpu[reference+c],`Canvas/CPU difference ${game} ${x},${y}`);
            if(y<fieldHeight&&game===1) {
              const original=originals.get('Landscape.Iff'),source=((y+yOffset)*original.width+(x+xOffset)*2)*4;
              for(let c=0;c<4;c++)requireCheck(actual[at+c]===original.rgba[source+c],`Landscape mismatch ${xOffset} ${x},${y}`);
            } else if(y>=fieldHeight+2) {
              const original=originals.get(panelName),source=((y-fieldHeight-2)*original.width+x*2)*4;
              for(let c=0;c<4;c++)requireCheck(actual[at+c]===original.rgba[source+c],`Panel mismatch ${game} ${x},${y}`);
            }
            comparedPixels++;
          }
          for(const y of [fieldHeight,fieldHeight+1]) {requireCheck((snapshot.frame.lineRegs[y*32+16]&2)===0,'Gap performed bitplane DMA');gapRows++;}
          const name=`${game===1?'Game':'Editor'} window at ${xOffset},${yOffset}`;
          if(globalThis.AMOS_DEMO_OBSERVE)globalThis.AMOS_DEMO_OBSERVE({name,width:canvas.width,height:canvas.height,rgba:actual});
          frames++;sizes.push([canvas.width,canvas.height]);
        }
        const before=d.canvasFrame();d.autoViewOff();d.screenDisplay(0,null,60,null,100);host.render();
        requireCheck(canvas.height===before.height,'Auto View Off did not preserve committed geometry');
        d.view();host.render();requireCheck(canvas.height===before.height-12,'View did not commit moved top edge');
        d.autoViewOn();
      } finally {host.detach();program.stop();}
    }
    return {frames,comparedPixels,gapRows,sizes,gameRunning:false};
  },{assets,palette,sources});
};
