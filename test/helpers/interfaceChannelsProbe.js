'use strict';
module.exports=async function interfaceChannelsProbe(page){
  const Transpiler=require('../../lib/Transpiler'),startup=require('./interfaceStartup'),{binary,token:t,integer:n,text,identifier:v}=require('./tokens');
  const cases=[['Communication.AMOS',379,40],['Editing_Zones.AMOS',586,29],['Sliders.AMOS',883,52]].map(([name,length,instructions])=>({name,length,instructions,source:new Transpiler(startup.channelPrefix(name)).toModule()}));
  const access=name=>[t(name),t('('),n(1),t(','),n(name==='Vdialog'?0:1),t(')')];
  cases.push({name:'Compiled Vdialog numeric and string transfer',length:3,instructions:1,system:true,source:new Transpiler(binary([
    [t('Resource Screen Open'),n(0),t(','),n(640),t(','),n(200),t(','),n(0)],
    [t('Cls'),n(0)],[t('Dialog Open'),n(1),t(','),text('EX;')],
    [...access('Vdialog'),t('='),n(42)],[...access('Vdialog$'),t('='),text('READY')],
    [v('N'),t('='),...access('Vdialog')],[v('S',6,2),t('='),...access('Vdialog$')],[t('Wait Key')]
  ])).toModule()});
  cases.push({name:'Sliders.AMOS through Array',length:883,instructions:52,arrays:true,source:new Transpiler(startup.arrayPrefix()).toModule()});
  return page.evaluate(({cases,asset,clockSource,gpuSources})=>{
    const make=source=>new Function('return ('+source+');')(),check=(value,message)=>{if(!value)throw Error(message);};
    const model=make(gpuSources.model)(),createGpu=make(gpuSources.renderer)(model,make(gpuSources.sprites)(),make(gpuSources.resources)(model),make(gpuSources.shaders),make(gpuSources.layout));
    let frames=0,gpuFrames=0,independentPixels=0,arrayEntries=0;
    for(const entry of cases){
      const compiled={exports:{}};new Function('module',entry.source)(compiled);const clock=make(clockSource)(4);
      const p=compiled.exports({now:clock.now,setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout,print(){},files:{read(name){check(name.toLowerCase()==='amospro_tutorial:tutorials/interface/example_resource.abk','Unexpected channel asset');return atob(asset);}}});
      const canvas=document.createElement('canvas'),gpu=createGpu(document.createElement('canvas'));
      const host=AMOS_BROWSER.createCanvasHost(canvas,{requestAnimationFrame:()=>1,cancelAnimationFrame(){}}),gpuHost=AMOS_BROWSER.createCanvasHost(gpu.resources.context.canvas,{renderer:gpu,requestAnimationFrame:()=>1,cancelAnimationFrame(){}});
      try{
        host.attach(p);gpuHost.attach(p);p.tick(1000);clock.tick(40);const d=p.display,s=d.screen(),channels=p.dialogChannels(),c=channels[0];
        check(p.state.waiting==='key'&&channels.length===1&&c.id===1&&c.source.length===entry.length&&c.instructions===entry.instructions&&c.variables===17&&c.bufferBytes===1024&&c.resourceBank===(entry.system?0:16),'Original channel state differs');
        if(entry.system)check(p.state.variables.int_n===42&&p.state.variables.string_s==='READY','Compiled dialogue variable transfer differs');
        else for(let i=entry.arrays?1:0;i<17;i++)check(p.dialogVariable('number',1,i)===0,'Prepared channel variable was not zero');
        let pointer;if(entry.arrays){pointer=p.dialogVariable('number',1,0);check(p.interfaceArraySize(pointer)===100,'Original array size differs');for(let i=0;i<101;i++){check(p.arrayReferenceValue(pointer,i)==='Select number '+i,'Original list entry differs');arrayEntries++;}check(p.interfaceArrayRead(pointer,99)==='Select number 99','Native AR value differs');let rejected=false;try{p.interfaceArrayRead(pointer,100);}catch(error){rejected=/bounds/.test(error.message);}check(rejected,'Native AR upper bound was accepted');}
        check(s.pixels.every(value=>value===0),'Dialog Open executed graphics');host.render();
        const blank=canvas.getContext('2d').getImageData(0,0,640,200).data;for(let i=0;i<blank.length;i+=4){check(blank[i]===0&&blank[i+1]===0&&blank[i+2]===0&&blank[i+3]===255,'Original preparation framebuffer differs');independentPixels++;}
        // Added diagnostic preview, explicitly outside the original AMOS script.
        d.ink(7,0);d.text(16,24,entry.name+' - channel 1 prepared');d.text(16,48,c.source.length+' script bytes / '+c.instructions+' verified nodes');d.text(16,72,'17 values / 1024 byte buffer / resource bank '+c.resourceBank);d.text(16,104,'Dialog Open does not execute this script.');d.text(16,128,'Prepared only - see the separate Dialog Run execution demo.');if(entry.system)d.text(16,152,'Compiled transfer: 42 / READY');if(entry.arrays){d.ink(0);d.bar(0,116,639,199);d.ink(7,0);d.text(16,128,'101 entries; native AS=100; AR indices 0..99');d.text(16,152,p.interfaceArrayRead(pointer,0)+' / '+p.arrayReferenceValue(pointer,100));d.text(16,176,'List preview only - Interface controls remain gated.');}
        host.render();const cpu=d.canvasFrame(),old=d.canvasFrame;d.canvasFrame=()=>{throw Error('Interface GPU used CPU presentation');};try{gpuHost.render();}finally{d.canvasFrame=old;}
        const actual=gpu.readPixels(),reference=d.renderDisplay();check(gpu.stats.lastResult.backend==='gpu'&&actual.length===reference.length&&actual.every((v,i)=>v===reference[i]),'Interface GPU pixels differ');frames++;gpuFrames++;
        if(globalThis.AMOS_DEMO_OBSERVE){globalThis.AMOS_DEMO_OBSERVE({name:'Canvas: '+entry.name+' / channel inspector preview',width:cpu.width,height:cpu.height,rgba:cpu.rgba});globalThis.AMOS_DEMO_OBSERVE({name:'WebGL: '+entry.name+' / channel inspector preview',width:gpu.stats.lastResult.width,height:gpu.stats.lastResult.lines,rgba:actual});}
        const saved=p.dialogChannels();p.stop();p.resume();check(p.dialogChannels().length===1,'Stop/Resume lost channel');p.dialogClose(1);check(!p.dialogChannels().length&&saved.length===1,'Channel close corrupted retained inspection snapshot');if(entry.arrays){check(p.arrayReferenceValue(pointer,100)==='Select number 100','Closing dialogue retired its AMOS array');p.arraySet(p.state.variables.array_string_v,[100],'changed');check(p.arrayReferenceValue(pointer,100)==='changed','Array reference lost live edits');}
      }finally{host.detach();gpuHost.detach();p.stop();check(clock.pending()===0,'Interface fixture retained timers');const gl=gpu.resources.context;gpu.dispose();const ext=gl.getExtension('WEBGL_lose_context');if(ext&&!gl.isContextLost())ext.loseContext();}
    }
    return {frames,gpuFrames,independentPixels,arrayEntries,programs:cases.length};
  },{cases,asset:startup.resource().toString('base64'),clockSource:require('./fakeTimers').createFakeTimers.toString(),gpuSources:require('./webglHostSources')()});
};
